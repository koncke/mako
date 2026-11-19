// =============================================================================
// cuenta-sin-cobro — lee y guarda el interruptor «Habilitado sin cobro» de un negocio (19/11/2026)
// =============================================================================
// El ajuste `cuenta.sin_cobro` (lib/cuenta-sin-cobro-reglas.ts) de ESE negocio, con el cliente de servicio. Lo escribe sólo la acción del super
// admin; ningún cron ni código lo cambia solo. Sin migración (es un renglón de `app_settings`).
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';
import { CLAVE_SIN_COBRO, sinCobroDeSetting, type SinCobro } from './cuenta-sin-cobro-reglas';

const esWs = (ws: unknown): ws is number => typeof ws === 'number' && Number.isInteger(ws) && ws > 0;

/** El interruptor de un negocio (`null` = nunca se tocó). Si no se puede leer, tira: «no pude leer» no es «apagado». */
export async function leerSinCobro(ws: number): Promise<SinCobro | null> {
  const { data, error } = await getSupabaseServer().from('app_settings').select('value').eq('workspace_id', ws).eq('key', CLAVE_SIN_COBRO).maybeSingle();
  if (error) throw new Error(`No pude leer el interruptor del negocio ${ws}: ${error.message}`);
  return sinCobroDeSetting(((data as { value?: string } | null)?.value) ?? null);
}

/** Los negocios con el interruptor PRENDIDO (para el chip de la lista). Si no se puede leer, vacío (y el aviso queda en el log). */
export async function negociosSinCobro(): Promise<Set<number>> {
  try {
    const { data, error } = await getSupabaseServer().from('app_settings').select('workspace_id, value').eq('key', CLAVE_SIN_COBRO).limit(5000);
    if (error) throw new Error(error.message);
    return new Set(((data ?? []) as Array<{ workspace_id: number; value: string }>).filter((f) => sinCobroDeSetting(f.value)?.activo === true).map((f) => Number(f.workspace_id)));
  } catch (e) {
    console.warn(`[sin-cobro] no pude leer los negocios sin cobro: ${e instanceof Error ? e.message : String(e)}`);
    return new Set();
  }
}

/** Prende o apaga el interruptor. Anota quién y cuándo. Devuelve lo guardado. */
export async function ponerSinCobro(ws: number, activo: boolean, por: string, ahora: Date = new Date()): Promise<{ ok: true; sinCobro: SinCobro } | { ok: false; error: string }> {
  if (!esWs(ws)) return { ok: false, error: 'Negocio inválido.' };
  const valor: SinCobro = { activo, por: por.slice(0, 120) || null, at: ahora.toISOString() };
  const { error } = await getSupabaseServer().from('app_settings')
    .upsert({ workspace_id: ws, key: CLAVE_SIN_COBRO, value: JSON.stringify(valor), updated_at: ahora.toISOString() }, { onConflict: 'workspace_id,key' });
  if (error) return { ok: false, error: `No pude guardarlo: ${error.message}` };
  return { ok: true, sinCobro: valor };
}
