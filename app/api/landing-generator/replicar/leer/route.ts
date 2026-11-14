// =============================================================================
// POST /api/landing-generator/replicar/leer — LEER una landing de afuera antes de replicarla (28/10/2026)
// =============================================================================
// Pedido de Martín (28/10/2026): que se defina qué se replica (diseño, estructura, ángulos, texto) y que la lectura de
// la landing se vea ANTES de replicar. Recibe `{ url, lectura?, texto? }` (como /replicar: la lectura del navegador o
// el texto pegado reemplazan la bajada) y contesta `{ ok, lectura, borrador }` con las secciones y su molde, los ángulos y el
// diseño de la original (lib/editor-landing/replicar-lectura.ts). Si la página no se lee desde el server, la falla trae
// `pegable`, `enNavegador` y `motivo` (422), y la pantalla la lee en la ventana del clic y vuelve con la `lectura`.
//
// La puerta, la de /replicar: admin del workspace y la tab `landing-writer` en su capa (los ángulos usan la IA del
// negocio), y MaKo Pro desde el 14/11/2026 (403 con `pasarAPro`, lib/editor-landing/replicar-candado.ts).
//
// ⚠️ DESDE EL 4/11/2026 (ticket #54) ESCRIBE: lo leído queda como BORRADOR del negocio, con lo elegido (`eleccion`), por
// la dirección pedida (lib/editor-landing/replica-borrador.ts). Hasta ahí «la lectura vivía en la pantalla», y volver al
// chat, ir a otra landing o el «atrás» se la llevaban: Leandro perdió lo leído y lo conversado. Un borrador que no se pudo
// guardar no tumba la lectura (`borrador: false`); la pantalla sigue igual.
// maxDuration 120: la bajada (hasta ~20 s) y los ángulos (`PLAZO_ANGULOS_MS`, 75 s) corren casi en paralelo.
// =============================================================================

import { getCapaActual, getRolWsEfectivo } from '@/lib/workspace';
import { tabEnCapa } from '@/lib/capas';
import { leerParaReplicar, type ResultadoLectura } from '@/lib/editor-landing/replicar-lectura';
import { candadoDeReplicarEnPantalla } from '@/lib/editor-landing/replicar-candado';
import { guardarBorradorReplica } from '@/lib/editor-landing/replica-borrador-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const falla = (status: number, error: string, extra: Record<string, unknown> = {}) =>
  Response.json({ ok: false, error, ...extra }, { status });

export async function POST(req: Request) {
  const rol = await getRolWsEfectivo();
  if (rol == null) return falla(401, 'no autenticado');
  if (rol !== 'admin') return falla(403, 'Sólo el admin de la cuenta');
  if (!tabEnCapa('landing-writer', await getCapaActual())) return falla(404, 'No existe');
  // SÓLO MaKo Pro (14/11/2026, lib/editor-landing/replicar-candado.ts): leer ya baja la página y paga los ángulos.
  const pro = await candadoDeReplicarEnPantalla();
  if (pro) return falla(403, pro.error, { pasarAPro: pro.pasarAPro });

  let body: { url?: unknown; lectura?: unknown; texto?: unknown; angulos?: unknown; eleccion?: unknown };
  try { body = await req.json(); } catch { return falla(400, 'body inválido'); }
  if (!body || typeof body !== 'object') return falla(400, 'body inválido');

  try {
    // `angulos: false`: sin la llamada de IA (la «Página web» de la caja no los usa).
    const r: ResultadoLectura = await leerParaReplicar({ url: body.url, lectura: body.lectura, texto: body.texto, conAngulos: body.angulos !== false });
    if (!r.ok) {
      return falla(r.status ?? 400, r.error, r.enNavegador && r.motivo ? { pegable: true, enNavegador: true, motivo: r.motivo } : {});
    }
    const borrador = await guardarBorradorReplica({ url: body.url, lectura: r.lectura, fuente: { lectura: body.lectura, texto: body.texto }, eleccion: body.eleccion });
    return Response.json({ ok: true, lectura: r.lectura, borrador });
  } catch (err) {
    // leerParaReplicar no tira (devuelve {ok:false}); esto es la red por si algo de afuera lo hace.
    console.error('[landing-generator/replicar/leer]', err instanceof Error ? err.message : err);
    return falla(500, 'Algo falló. Vuelve a intentar.');
  }
}
