// =============================================================================
// pasarela-eventos — la deduplicación y el rastro de los avisos de Stripe y Mercado Pago
// =============================================================================
// La tabla `pasarela_eventos` (mig 0250, molde: `email_entrantes` de la 0245) es DOS cosas:
//   · LA DEDUPLICACIÓN: (proveedor, evento_id) es único. Stripe y Mercado Pago REINTENTAN y mandan
//     el mismo aviso más de una vez; el segundo choca acá en vez de volver a tocar el CRM. Se reclama
//     ANTES de aplicar.
//   · EL RASTRO: lo que se ignoró (no es un cobro de MaKo, otro modo, un estado en curso) y lo que
//     falló queda escrito con su motivo (AGENTS.md «Una política puede RECHAZAR; no puede no dejar
//     rastro»), sin datos personales (`motivoSinDatos`).
//
// ⚠️ UN «procesando» VIEJO SE PUEDE RECLAMAR. En `email_entrantes` un `procesando` que quedó colgado
// (la función murió por maxDuration) cuenta como duplicado PARA SIEMPRE, y el reintento del proveedor
// no lo arregla nunca. Acá se reclama un `error` en el acto y un `procesando` con más de
// `MIN_PROCESANDO_VIEJO` minutos sin moverse (por `updated_at`), con compare-and-set: de dos
// reintentos simultáneos, uno solo lo gana.
//
// Quien lo usa: app/api/webhooks/stripe y app/api/webhooks/mercadopago. Lo que NO se lee con
// getTenantDb: `pasarela_eventos` no está en TENANT_TABLES (workspace nullable: un aviso que no es de
// nadie también deja su fila), así que va con el cliente de servicio y el workspace explícito.

import 'server-only';
import { getSupabaseServer } from './supabase';
import { mensajeDeError } from './calendly-error';
import { motivoSinDatos, type ResultadoEvento } from './cobros-eventos';
import type { Pasarela } from './cobros-tipos';

const TABLA = 'pasarela_eventos';
const LOG = '[pasarela-eventos]';

/** Cuánto tiene que estar quieto un `procesando` para darlo por muerto (maxDuration de las rutas: 60 s). */
export const MIN_PROCESANDO_VIEJO = 10;

/** El código de PostgREST / Postgres de una tabla que no existe (la 0250 sin aplicar). */
export const esTablaQueFalta = (code: unknown): boolean => code === '42P01' || code === 'PGRST205';

type ErrorDeBase = { message: string; code?: string; details?: string | null; hint?: string | null };
/** El error con `code`/`details`/`hint` del original: es lo que lee el clasificador de transitorios. */
const errorDeBase = (donde: string, e: ErrorDeBase): Error =>
  Object.assign(new Error(`${TABLA} (${donde}): ${e.message}`), { code: e.code, details: e.details, hint: e.hint });

export type EventoPasarela = { proveedor: Pasarela; eventoId: string; ws: number | null; tipo: string };

/**
 * `nuevo`: hay que procesarlo (es la primera vez, o se reclamó un `error` o un `procesando` muerto).
 * `duplicado`: ya se procesó o se está procesando. `sin_tabla`: falta la 0250, y sin fila no hay
 * cómo deduplicar. `{ error }`: la base no contestó; lo clasifica quien llama (503 si es transitorio).
 */
export type Reclamo = 'nuevo' | 'duplicado' | 'sin_tabla' | { error: Error };

export async function reclamarEvento(e: EventoPasarela): Promise<Reclamo> {
  const db = getSupabaseServer();
  const eventoId = e.eventoId.slice(0, 200);
  const { error } = await db.from(TABLA).insert({
    proveedor: e.proveedor, evento_id: eventoId, workspace_id: e.ws, tipo: e.tipo.slice(0, 120), estado: 'procesando',
  });
  if (!error) return 'nuevo';
  if (esTablaQueFalta(error.code)) return 'sin_tabla';
  if (error.code !== '23505') return { error: errorDeBase('insert', error) };

  const { data: previa, error: e2 } = await db.from(TABLA).select('estado, intentos')
    .eq('proveedor', e.proveedor).eq('evento_id', eventoId).maybeSingle();
  if (e2) return { error: errorDeBase('select', e2) };
  const p = previa as { estado?: string; intentos?: number } | null;
  if (!p || (p.estado !== 'error' && p.estado !== 'procesando')) return 'duplicado';

  // Compare-and-set en UNA sentencia: la condición vive en el `update`, así que de dos reintentos que
  // leyeron lo mismo, el segundo ya no encuentra la fila en `error` (ni el `procesando` viejo).
  const hace = new Date(Date.now() - MIN_PROCESANDO_VIEJO * 60_000).toISOString();
  const { data: reclamada, error: e3 } = await db.from(TABLA)
    .update({ estado: 'procesando', motivo: null, intentos: (Number(p.intentos) || 1) + 1, updated_at: new Date().toISOString() })
    .eq('proveedor', e.proveedor).eq('evento_id', eventoId)
    .or(`estado.eq.error,and(estado.eq.procesando,updated_at.lt.${hace})`)
    .select('id');
  if (e3) return { error: errorDeBase('reclamo', e3) };
  return (reclamada ?? []).length ? 'nuevo' : 'duplicado';
}

export type EstadoFinal = { estado: 'procesado' | 'ignorado' | 'error'; motivo?: string | null; cobroId?: number | null };

/** Deja la fila en su estado final. Best-effort: el rastro no cambia la respuesta, y nunca tira. */
export async function marcarEvento(proveedor: Pasarela, eventoId: string, r: EstadoFinal): Promise<void> {
  try {
    const { error } = await getSupabaseServer().from(TABLA).update({
      estado: r.estado,
      motivo: r.motivo ? motivoSinDatos(r.motivo) || null : null,
      ...(r.cobroId != null ? { cobro_id: r.cobroId } : {}),
      updated_at: new Date().toISOString(),
    }).eq('proveedor', proveedor).eq('evento_id', eventoId.slice(0, 200));
    if (error && !esTablaQueFalta(error.code)) console.error(`${LOG} no pude marcar ${proveedor}/${eventoId} como ${r.estado}: ${error.message}`);
  } catch (e) {
    console.error(`${LOG} no pude marcar ${proveedor}/${eventoId} como ${r.estado}: ${mensajeDeError(e)}`);
  }
}

/**
 * Deja escrito un aviso que se descartó ANTES de procesarlo (no es de ningún negocio, no se pudo
 * releer): se reclama su fila y se marca. Si ya existía, no se pisa. Nunca tira.
 */
export async function anotarEvento(e: EventoPasarela, r: EstadoFinal): Promise<void> {
  try {
    const reclamo = await reclamarEvento(e);
    if (reclamo === 'nuevo') await marcarEvento(e.proveedor, e.eventoId, r);
    else if (typeof reclamo === 'object') console.error(`${LOG} no pude anotar ${e.proveedor}/${e.eventoId}: ${reclamo.error.message}`);
  } catch (err) {
    console.error(`${LOG} no pude anotar ${e.proveedor}/${e.eventoId}: ${mensajeDeError(err)}`);
  }
}

/**
 * Lo que siguió en segundo plano (`after()`, porque pasó el tope de tiempo del proveedor): espera el
 * trabajo y deja la fila en su estado. Si falla, la fila queda en `error` con el motivo: el proveedor
 * ya recibió su 200 y no va a reintentar, así que la red de seguridad es el cron
 * (app/api/cron/cobros-reconciliar). Nunca tira.
 */
export async function cerrarAlTerminar(proveedor: Pasarela, eventoId: string, trabajo: Promise<ResultadoEvento>): Promise<void> {
  try {
    const r = await trabajo;
    await marcarEvento(proveedor, eventoId, r);
  } catch (e) {
    console.error(`[webhook:${proveedor}] ${eventoId} falló en segundo plano: ${motivoSinDatos(mensajeDeError(e))}`);
    await marcarEvento(proveedor, eventoId, { estado: 'error', motivo: mensajeDeError(e) });
  }
}
