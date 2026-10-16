import 'server-only';

// =============================================================================
// reunion-descartadas — las reuniones que el cron NO leyó, escritas y a la vista (mig 0300)
// =============================================================================
// 16/10/2026, «Fathom sin fricción». El cron de Fathom (lib/reunion-auto.ts) lee sólo las de
// equipo y entrega. Las de ventas y las «otra» se descartaban con un `console.log` y nada más, así
// que una reunión de trabajo mal clasificada desaparecía sin rastro: no hay borrador, no hay aviso,
// y en el log de Vercel no la busca nadie. Ahora cada descarte queda en `plan_reuniones_descartadas`
// con su motivo (`motivoDelTipo`, lib/reunion-clasificar.ts) y el modal de Fathom la lista con
// «Leer igual».
//
// ⚠️ Y TAMBIÉN LAS QUE FALLARON (`tipo = 'fallo'`). Medido en el ws1 del 08 al 15/10: 11 reuniones,
// ninguna descartada por tipo, y diez sin borrador — la lectura falló (la clave de IA no contestaba) y
// salieron de la ventana de 26 h sin rastro. El diagnóstico que parecía obvio («el clasificador se
// las come») era el equivocado; la regla que queda es la de fondo: ninguna reunión desaparece sin
// rastro. La falla se anota en el primer intento fallido (el cron la sigue reintentando; si sale,
// deja borrador y el lector la saca de la lista).
//
// ⚠️ LA TABLA ES OPCIONAL PARA EL CÓDIGO: si la migración todavía no corrió, escribir y leer fallan
// con un log que lo dice y nada más. Un cron que se cae por no poder anotar un descarte perdería las
// reuniones que SÍ tenía que leer.
// =============================================================================

import { getTenantDb } from './workspace';
import type { ReunionMeta } from './plan-fathom';
import type { TipoReunion } from './reunion-clasificar';

export type ReunionDescartada = {
  recordingId: number; titulo: string; fecha: string | null; url: string | null;
  /** 'ventas' / 'otra' = el clasificador; 'fallo' = iba al plan y la lectura no salió. */
  tipo: Extract<TipoReunion, 'ventas' | 'otra'> | 'fallo'; motivo: string; createdAt: string;
};

const TABLA = 'plan_reuniones_descartadas';
const msg = (e: unknown) => (e instanceof Error ? e.message : (e as { message?: string })?.message ?? String(e));

/** Anota las que el cron dejó afuera. Idempotente (`ignoreDuplicates`): una reunión que se vuelve
 *  a ver en la corrida siguiente no se reescribe, y un «Leer igual» (`leida_at`) no se borra.
 *  Devuelve cuántas intentó anotar (`null` si no pudo escribir). */
export async function registrarDescartadas(reuniones: Array<Pick<ReunionMeta, 'recordingId' | 'titulo' | 'fecha' | 'url' | 'tipo' | 'motivo'>>): Promise<number | null> {
  const filas = reuniones
    .filter((r) => (r.tipo === 'ventas' || r.tipo === 'otra') && Number.isFinite(r.recordingId))
    .map((r) => ({
      recording_id: r.recordingId,
      titulo: (r.titulo ?? '').slice(0, 300),
      fecha: r.fecha ?? null,
      url: r.url ?? null,
      tipo: r.tipo,
      motivo: (r.motivo ?? '').slice(0, 300),
    }));
  if (!filas.length) return 0;
  try {
    const db = await getTenantDb();
    const { error } = await db.from(TABLA).upsert(filas, { onConflict: 'workspace_id,recording_id', ignoreDuplicates: true });
    if (error) { console.error(`[reunion-descartadas] no pude anotar ${filas.length} descarte(s): ${error.message}`); return null; }
    return filas.length;
  } catch (e) { console.error(`[reunion-descartadas] no pude anotar: ${msg(e)}`); return null; }
}

/** Una reunión que el cron INTENTÓ leer y no pudo. Mismo registro, `tipo = 'fallo'`. */
export async function registrarNoLeida(r: Pick<ReunionMeta, 'recordingId' | 'titulo' | 'fecha' | 'url'>, motivo: string): Promise<boolean> {
  try {
    const db = await getTenantDb();
    const { error } = await db.from(TABLA).upsert({
      recording_id: r.recordingId, titulo: (r.titulo ?? '').slice(0, 300), fecha: r.fecha ?? null, url: r.url ?? null,
      tipo: 'fallo', motivo: motivo.slice(0, 300),
    }, { onConflict: 'workspace_id,recording_id', ignoreDuplicates: true });
    if (error) { console.error(`[reunion-descartadas] no pude anotar la falla de ${r.recordingId}: ${error.message}`); return false; }
    return true;
  } catch (e) { console.error(`[reunion-descartadas] no pude anotar la falla de ${r.recordingId}: ${msg(e)}`); return false; }
}

/**
 * Las descartadas que nadie leyó todavía, de la más nueva a la más vieja. `null` = no pude leer
 * (que no es «no hay»: la pantalla no dice «ninguna» sobre una lectura que falló).
 */
export async function listarDescartadas(opts: { dias?: number; limite?: number } = {}): Promise<ReunionDescartada[] | null> {
  const desde = new Date(Date.now() - (opts.dias ?? 14) * 86_400_000).toISOString();
  try {
    const db = await getTenantDb();
    const { data, error } = await db.from(TABLA)
      .select('recording_id, titulo, fecha, url, tipo, motivo, created_at')
      .is('leida_at', null)
      .gte('created_at', desde)
      .order('fecha', { ascending: false })
      .limit(opts.limite ?? 10);
    if (error) { console.error(`[reunion-descartadas] no pude leer: ${error.message}`); return null; }
    return ((data ?? []) as Array<Record<string, unknown>>).map((f) => ({
      recordingId: Number(f.recording_id),
      titulo: String(f.titulo ?? ''),
      fecha: f.fecha ? String(f.fecha) : null,
      url: f.url ? String(f.url) : null,
      tipo: f.tipo === 'ventas' ? 'ventas' : f.tipo === 'fallo' ? 'fallo' : 'otra',
      motivo: String(f.motivo ?? ''),
      createdAt: String(f.created_at ?? ''),
    }));
  } catch (e) { console.error(`[reunion-descartadas] no pude leer: ${msg(e)}`); return null; }
}

/** «Leer igual»: la reunión sale de la lista. No se borra: queda que se decidió leerla. */
export async function marcarDescartadaLeida(recordingId: number): Promise<void> {
  if (!Number.isFinite(recordingId)) return;
  try {
    const db = await getTenantDb();
    const { error } = await db.from(TABLA).update({ leida_at: new Date().toISOString() }).eq('recording_id', recordingId).is('leida_at', null);
    if (error) console.error(`[reunion-descartadas] no pude marcar ${recordingId} como leída: ${error.message}`);
  } catch (e) { console.error(`[reunion-descartadas] no pude marcar ${recordingId}: ${msg(e)}`); }
}
