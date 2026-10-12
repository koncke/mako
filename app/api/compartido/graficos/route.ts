// =============================================================================
// POST /api/compartido/graficos — los datos de un informe del Dashboard compartido por link
// =============================================================================
// Lo pide la pantalla montada con `compartido={{ token }}` (/compartido/<token>), SIN sesión, en lugar de
// /api/graficos. El cuerpo es el contrato de la pantalla, `pedidoDeLectura` (app/dashboard/lectura-compartida.ts):
//
//   { accion: 'datos',   token, hojaId, pedidos: [{ id, desde, hasta, filtros?, agrupar?, … }] } → { datos: Record<id, DatosGrafico> }
//   { accion: 'valores', token, hojaId, controlId, componenteId?, desde, hasta, … }              → { valores: [{ valor, filas }] }
//   { accion: 'detalle', … }                                                                    → 403 «El detalle no se comparte»
//   { accion: 'guardar', … }                                                                    → 403 «Sólo lectura»
//   { …, popupDe }                                                                              → 403 «No se comparte en un link»
//
// ⚠️ EL SERVER NO CONFÍA EN EL PEDIDO (decisión de la tanda, 11/10/2026). Lo que el cuerpo dice del
//    gráfico (`grafico`, `campo`, `fuentes`) viaja porque es el MISMO cuerpo que /api/graficos, y NO se
//    lee: cada consulta se rearma desde el gráfico GUARDADO en el informe del share (hojaId + id),
//    y del cuerpo sólo vale lo que la vista puede mover — el período, el «agrupar por» y los filtros sobre
//    los controles que la hoja YA tiene, de campos públicos (app/compartido/[token]/informe-reglas.ts). Un
//    link no sirve para consultar cualquier conjunto del negocio.
// ⚠️ LO QUE NO SE COMPARTE NO SE LEE (v5, informe-reglas.ts → `seComparte`): el mapa de calor contesta «No se
//    comparte en un link»; un pop-up (`popupDe`) ni se busca — sus piezas son la ficha de una llamada o de un
//    anuncio, y viven adentro de su gráfico, no en la hoja. Los bloques de MaKo ya no existen (v5): no hay
//    acción `bloques`.
// ⚠️ EL TOKEN VIAJA EN EL CUERPO, no en la URL (que queda en los logs): por eso es POST aunque sólo lea, y
//    por eso está EXACTA en PUBLICOS_ESCRITURA (lib/rutas-publicas.ts) — el proxy le contesta 405 a todo
//    POST bajo /api/compartido que no esté ahí. Es el mismo caso que /api/compartido/comunidad. No lee la
//    cookie de sesión para nada: la credencial entera es el token, que el navegador no manda solo.
// ⚠️ CADA PEDIDO revalida el token contra la fila VIVA y corre en el workspace DEL SHARE
//    (app/compartido/[token]/informe-compartido.ts). Un token inválido, revocado o vencido es 404, igual que
//    un informe que no tiene esa hoja: no se distingue (eso ayudaría a enumerar tokens).
// ⚠️ TOPES: por IP antes de leer nada (corta el barrido de tokens sin tocar la base) y por TOKEN después
//    (un link repartido no puede usarse para martillar la base de un negocio). En memoria y por instancia
//    (lib/rate-limit.ts): corta lo trivial, no un ataque distribuido.

import type { NextRequest } from 'next/server';
import { createHash } from 'node:crypto';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { leerJsonTopeado } from '@/lib/curso-portal';
import type { LecturaDatos, LecturaValores } from '@/app/dashboard/lectura-compartida';
import {
  accesoAInforme, graficosDelCuerpo, hoyDelInforme, leerInformeCompartido, valoresCompartidos,
} from '@/app/compartido/[token]/informe-compartido';
import { DETALLE_NO_SE_COMPARTE, NO_SE_COMPARTE, idDeInforme } from '@/app/compartido/[token]/informe-reglas';

/**
 * El cuerpo, con los NOMBRES del contrato de la pantalla (`pedidoDeLectura`, app/dashboard/lectura-compartida.ts)
 * y todo `unknown` hasta sanearse. Atado a sus tipos y no copiado: si la pantalla renombra un campo, esto
 * deja de compilar en vez de leer `undefined` en silencio.
 */
type CuerpoDelLink = Partial<Record<keyof LecturaDatos | keyof LecturaValores | 'token' | 'popupDe', unknown>>;

export const dynamic = 'force-dynamic';
export const revalidate = 0;
// El mismo tope que /api/graficos: una hoja pesada (Landing) lee mucho.
export const maxDuration = 60;

const SIN_CACHE = { 'Cache-Control': 'private, no-store' };
const responder = (cuerpo: object, status = 200) => Response.json(cuerpo, { status, headers: SIN_CACHE });
const NO_EXISTE = () => responder({ error: 'No existe' }, 404);
const MUCHO = () => responder({ error: 'Vas muy rápido. Espera un momento.' }, 429);

/** Una hoja de 60 componentes con sus filtros entra holgada. */
const TOPE_PEDIDO = 128_000;
/** Por IP: varias personas detrás de la misma red miran a la vez. Por token: una hoja pide sus datos en cada
 *  cambio de la vista, y una lista desplegable sus valores. */
const POR_IP = 300;
const POR_TOKEN = 120;
const VENTANA_MS = 60_000;

export async function POST(req: NextRequest) {
  if (!rateLimit(`compartido-graficos:ip:${clientIp(req)}`, POR_IP, VENTANA_MS)) return MUCHO();

  const leido = await leerJsonTopeado(req, TOPE_PEDIDO);
  if (!leido.ok) return responder({ error: leido.status === 413 ? 'Pedido muy grande' : 'JSON inválido' }, leido.status);
  const body = (leido.valor && typeof leido.valor === 'object' && !Array.isArray(leido.valor) ? leido.valor : {}) as CuerpoDelLink;

  const token = typeof body.token === 'string' ? body.token : '';
  if (token.length < 20 || token.length > 200) return NO_EXISTE();
  // La clave del tope es la HUELLA del token, no el token: lo que queda en memoria no abre nada.
  const huella = createHash('sha256').update(token).digest('hex').slice(0, 24);
  if (!rateLimit(`compartido-graficos:t:${huella}`, POR_TOKEN, VENTANA_MS)) return MUCHO();

  try {
    // La fila VIVA, en cada pedido: revocar corta también a la pestaña que ya estaba abierta.
    const informe = await accesoAInforme(token);
    if (!informe) return NO_EXISTE();

    const accion = body.accion;
    // El detalle de un número es la lista de personas que lo forman (nombre, email, teléfono): no sale.
    if (accion === 'detalle') return responder({ error: DETALLE_NO_SE_COMPARTE }, 403);
    if (accion === 'guardar') return responder({ error: 'Sólo lectura' }, 403);
    // Un pop-up no se sirve en un link (la ficha de una llamada, de un anuncio): ni se busca.
    if (body.popupDe != null && body.popupDe !== '') return responder({ error: NO_SE_COMPARTE }, 403);
    if (accion !== 'datos' && accion !== 'valores') return responder({ error: 'Acción desconocida' }, 400);

    const tablero = await leerInformeCompartido(informe);
    if (!tablero) return responder({ error: 'No pude leer el informe' }, 503);
    const hojaId = idDeInforme(body.hojaId);
    const hoja = hojaId ? tablero.hojas.find((h) => h.id === hojaId) : undefined;
    if (!hoja) return NO_EXISTE();
    const hoy = hoyDelInforme();

    if (accion === 'valores') {
      const r = await valoresCompartidos(informe, hoja, body.controlId, body.componenteId, body.desde, body.hasta, hoy);
      // Un filtro de personas no se mueve en un link: sus opciones serían los nombres.
      if (!r.ok) return r.motivo === 'periodo' ? responder({ error: 'Período inválido' }, 400) : responder({ error: NO_SE_COMPARTE }, 403);
      return responder({ valores: r.valores });
    }
    return responder({ datos: await graficosDelCuerpo(informe, hoja, body.pedidos, hoy) });
  } catch (e) {
    console.error(`[compartido/graficos] ${e instanceof Error ? e.message : String(e)}`);
    return responder({ error: 'No pude leer los datos' }, 500);
  }
}
