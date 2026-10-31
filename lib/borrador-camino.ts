// =============================================================================
// borrador-camino — por dónde sale un borrador de WhatsApp, y la ÚNICA puerta de envío
// =============================================================================
// Acá vive la decisión de POR DÓNDE sale cada borrador, y la decisión la toma el
// SERVIDOR: el cliente nunca elige canal.
//
//   · Sale por el número de empresa (Evolution). Un borrador que NOMBRA su línea sale
//     por ella o no sale: el lead venía hablando con ESE número. Uno sin línea sale por
//     la de por default.
//   · 'conectando' cuenta como vivo: quitarle el botón a un número que está
//     re-vinculando es sacarle una función que en un minuto vuelve.
//   · Si no hay por dónde, el camino es `null` con el motivo en una frase, que es lo
//     que la pantalla muestra en lugar del botón.
//
// ⛔ Hasta el 09/10/2026 se llamaba lib/borrador-oficial.ts y tenía un SEGUNDO camino: si
// el número de empresa no estaba vivo, el borrador salía por el WhatsApp OFICIAL
// (Chatwoot), y sólo dentro de la ventana de 24 h de Meta (lib/ventana-24h.ts). Chatwoot
// se borró (decisión de Martín: «que no exista más»), y con él ese camino y su ventana: el
// número de empresa no tiene ventana. El código viejo está en la etiqueta de git
// `archivo/chatwoot-2026-10-09`.
// =============================================================================

import 'server-only';
import { estaBloqueadoEstricto } from './evolution-block';
import { getTenantDb } from '@/lib/workspace';
import { listarLineas } from '@/lib/evolution';
import { lineaPorDefault } from '@/lib/lineas-whatsapp';
import { enviarBorrador } from '@/lib/evolution-envio';
import { leerConfigAutomatizacion } from '@/lib/config-automatizacion-db';
import { frenoAlAprobar, goteoDeHoy, SIN_USO, type UsoGoteo } from '@/lib/goteo';
import { subidasPorAutomatizacion } from '@/lib/goteo-db';
import { tzActual } from '@/lib/timezone';

export type ViaBorrador = 'empresa';

/**
 * Por dónde puede salir un borrador. `via: null` = no puede salir, y `motivo`
 * es la frase que la pantalla dibuja EN LUGAR del botón.
 */
export type CaminoBorrador = {
  via: ViaBorrador | null;
  motivo: string | null;
};

/**
 * El camino de un borrador para el que `caminosDeEnvio` no devolvió entrada.
 * No puede pasar (devuelve una por id recibido) y existe igual: un hueco se
 * leería como «todavía no sé» y dejaría el botón en «Comprobando…» para
 * siempre, que es un control muerto.
 */
export const CAMINO_INDETERMINADO: CaminoBorrador = { via: null, motivo: 'No se pudo determinar por dónde mandarlo.' };

const POR_EMPRESA: CaminoBorrador = { via: 'empresa', motivo: null };
const SIN_CANAL: CaminoBorrador = { via: null, motivo: 'No hay ningún WhatsApp conectado para mandarlo.' };
const LINEA_CAIDA: CaminoBorrador = { via: null, motivo: 'El número de este borrador está desconectado.' };
const LINEA_IDA: CaminoBorrador = { via: null, motivo: 'El número de este borrador ya no está vinculado.' };

/**
 * El camino de CADA borrador, en un solo viaje. Devuelve una entrada por id
 * recibido (nunca un hueco: un borrador sin entrada dibujaría un botón sin gate).
 */
export async function caminosDeEnvio(
  borradores: Array<{ id: number; linea?: string | null }>,
): Promise<Map<number, CaminoBorrador>> {
  const out = new Map<number, CaminoBorrador>();
  if (!borradores.length) return out;

  // ⚠️ CADA BORRADOR CON SU LÍNEA (06/10/2026, varios números por negocio). Un borrador que
  // NOMBRA su línea sale por ella o no sale — nunca por otra: el lead venía hablando con ESE
  // número.
  const lineas = await listarLineas().catch(() => null);
  const viva = (estado: string | null | undefined) => estado === 'conectado' || estado === 'conectando';
  const def = lineas ? lineaPorDefault(lineas) : null;
  for (const b of borradores) {
    if (b.linea) {
      const fila = lineas?.find((l) => l.instance_name === b.linea);
      out.set(b.id, fila ? (viva(fila.estado) ? POR_EMPRESA : LINEA_CAIDA) : (lineas ? LINEA_IDA : CAMINO_INDETERMINADO));
    } else if (def && viva(def.estado)) {
      out.set(b.id, POR_EMPRESA);
    } else {
      // «No pude leer las líneas» no es «no hay ninguna»: se dice que no se sabe.
      out.set(b.id, lineas ? SIN_CANAL : CAMINO_INDETERMINADO);
    }
  }
  return out;
}

type BorradorFila = { id: number; estado: string; instance_name: string | null; telefono: string | null; secuencia_id: number | null };

async function leerBorrador(id: number): Promise<BorradorFila | null> {
  const db = await getTenantDb();
  const { data } = await db.from('wa_borradores').select('id, estado, instance_name, telefono, secuencia_id').eq('id', id).maybeSingle();
  return (data as BorradorFila | null) ?? null;
}

/**
 * ÚNICA puerta de envío de un borrador: el servidor vuelve a decidir el camino acá, no en
 * el cliente. El gate del botón se calculó al cargar la lista, y entre el dibujo y el clic
 * el número se puede haber caído. La línea sale de la FILA, nunca del navegador.
 */
export async function enviarBorradorPorSuCanal(id: number, porEmail: string): Promise<{ ok: boolean; error?: string }> {
  const b = await leerBorrador(id);
  if (!b || b.estado !== 'pendiente') return { ok: false, error: 'el borrador ya no está pendiente' };
  // ⚠️ UN CONTACTO BLOQUEADO NO RECIBE NADA, venga de donde venga (revisión del 21/10/2026): /chats deshabilita «Enviar»
  // con el bloqueo, pero /whatsapp y MaKo mandaban el borrador igual. Acá, que es la puerta de los tres.
  if (await estaBloqueadoEstricto(b.telefono)) return { ok: false, error: 'el contacto está bloqueado' };
  // ⚠️ Y EL GOTEO DE SU AUTOMATIZACIÓN (22/10/2026, AU1): aprobar de a varios no los manda juntos (`frenoDelGoteoAlAprobar`).
  const freno = await frenoDelGoteoAlAprobar(b.secuencia_id);
  if (freno) return { ok: false, error: freno };

  const camino = (await caminosDeEnvio([{ id: b.id, linea: b.instance_name }])).get(b.id);
  if (camino?.via === 'empresa') return enviarBorrador(id, porEmail);
  return { ok: false, error: camino?.motivo ?? SIN_CANAL.motivo ?? 'No hay por dónde mandarlo.' };
}

/**
 * EL GOTEO AL APROBAR (22/10/2026, AU1 del plan del Cerebro). #289 nace para aprobar: el motor deja los borradores de a uno
 * (lib/goteo.ts, `cuentaParaElGoteo`), pero aprobar los mandaba en el acto, y aprobar diez seguidos eran diez juntos por la
 * línea de Mauricio. Lo aprobado de una automatización con goteo respeta su goteo: cuenta lo que ya salió de ella en 24 h
 * (`wa_borradores` enviados, por su `enviado_at`) y, si no hay lugar, no sale y dice cuándo sí. null = sale.
 * Si no puede leer, NO sale: sin saber qué salió, no puede decir que hay lugar (como el motor, `usoDelGoteo`).
 */
export async function frenoDelGoteoAlAprobar(secuenciaId: number | null): Promise<string | null> {
  if (secuenciaId == null) return null;
  try {
    const db = await getTenantDb();
    // ⚠️ UNA AUTOMATIZACIÓN PAUSADA NO MANDA NADA (22/10/2026, Martín: «se puede pausar el envío desde Automations»): el motor
    // ya congela su cola (lib/nutricion.ts, `idsDePausadas`), pero un borrador suyo ya escrito se podía aprobar y salía.
    const { data: sec, error: eSec } = await db.from('nutricion_secuencias').select('nombre, activa').eq('id', secuenciaId).maybeSingle();
    if (eSec) throw new Error(eSec.message);
    const fila = sec as { nombre?: unknown; activa?: unknown } | null;
    const nombre = String(fila?.nombre ?? 'Esta automatización');
    if (fila && fila.activa !== true) return `«${nombre}» está pausada: no sale nada hasta que la actives en Automations.`;
    const g = (await leerConfigAutomatizacion(secuenciaId)).goteo;
    if (!g || (g.minutos == null && g.dia == null)) return null;
    const desde = new Date(Date.now() - 86_400_000).toISOString();
    const { data, error } = await db.from('wa_borradores').select('enviado_at')
      .eq('secuencia_id', secuenciaId).eq('estado', 'enviado').gte('enviado_at', desde).limit(1000);
    if (error) throw new Error(error.message);
    let uso: UsoGoteo = SIN_USO;
    for (const r of (data ?? []) as Array<{ enviado_at: string | null }>) {
      const ms = Date.parse(String(r.enviado_at ?? ''));
      if (!Number.isFinite(ms)) continue;
      uso = { enviados: uso.enviados + 1, ultimoMs: Math.max(uso.ultimoMs ?? ms, ms), primeroMs: Math.min(uso.primeroMs ?? ms, ms) };
    }
    // Con arranque gradual, el tope de HOY (lib/goteo.ts). Los borradores son de WhatsApp.
    const yaMando = g.arranque && g.dia != null ? (await subidasPorAutomatizacion(db, new Map([[secuenciaId, g]]), await tzActual())).get(secuenciaId) ?? 0 : 0;
    return frenoAlAprobar(goteoDeHoy(g, yaMando), uso, Date.now(), nombre);
  } catch (e) {
    return `No pude comprobar el goteo de esta automatización (${e instanceof Error ? e.message : String(e)}): prueba de nuevo en un momento.`;
  }
}
