// =============================================================================
// Las pendientes de MaKo que se reclamaron y nunca terminaron: cuándo se dan por cortadas. PURO (sin base ni `server-only`)
// =============================================================================
// Confirmar una pendiente la RECLAMA antes de ejecutarla ('pendiente' → 'confirmada', `reclamarPendiente` en
// lib/mako-pendientes.ts): dos «sí» ejecutan UNA vez. La contracara: si la ejecución se corta en el medio (la función de Vercel
// muere, un deploy), la fila queda 'confirmada' para siempre. `ver_pendiente` lo infería («sin_resultado») y nada la cerraba
// (F114, 18/11/2026; docs/hallazgos-api-mako.md → «Confirmar reclama antes de ejecutar…: Sin hacer»).
//
// El barrido (`cerrarConfirmadasColgadas`, que corre /api/cron/limpieza-colgados) la cierra como 'error' con un texto que dice que
// pudo haber escrito a medias. Lo prueba tests/api-mako-nucleo-1811.test.ts.
// ⚠️ 30 MINUTOS, no 5: lo más largo que corre una confirmación es un trabajo de fondo (lib/chat-trabajos.ts) adentro de una función
//    de Vercel, que corta a los 800 s. Con menos, el barrido cerraría como cortada una ejecución que sigue viva. Y si igual
//    termina después, gana su resultado: `resolverPendiente` escribe el final sin mirar el estado.
// =============================================================================

/** Cuánto después de reclamada (o de vencida, sin la hora del reclamo) una 'confirmada' sin resultado se da por cortada. */
export const COLGADA_TRAS_MS = 30 * 60_000;

/** Lo que queda escrito en `resultado` de una pendiente cortada: lo lee MaKo (lo que propuso, lib/doer-hilo.ts) y la bandeja. */
export const RESULTADO_COLGADA = 'Se confirmó y se cortó antes de terminar: pudo haber quedado a medias. Revisa en su pestaña si se hizo antes de volver a pedirlo.';

/**
 * Los dos cortes del barrido, en ISO. Con la hora del reclamo (mig 0420), desde ella; sin ella (filas de antes, o la migración
 * todavía sin aplicar), desde el vencimiento: reclamar exige que la pendiente siga vigente, así que pasado su `vence_at` más el
 * margen, seguro se cortó (la misma inferencia que hacía `ver_pendiente`).
 */
export function cortesDeColgadas(ahoraMs: number): { reclamadaAntesDe: string; vencidaAntesDe: string } {
  const corte = new Date(ahoraMs - COLGADA_TRAS_MS).toISOString();
  return { reclamadaAntesDe: corte, vencidaAntesDe: corte };
}

/** El error de PostgREST de una columna que todavía no existe (una migración sin aplicar): 42703 en Postgres, PGRST204 en el caché. */
export function faltaLaColumna(error: { code?: string | null; message?: string | null } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === '42703' || error.code === 'PGRST204') return true;
  return /column .* does not exist|could not find the .* column/i.test(error.message ?? '');
}

/**
 * Una escritura que lleva una columna NUEVA, tolerando que su migración no esté: intenta con la columna y, si la base contesta
 * que no existe, repite sin ella. Cualquier otro error vuelve tal cual (quien llama decide). Es la regla del brief: el código
 * tolera la migración sin aplicar.
 */
export async function conColumnaNueva<T extends { error: { code?: string | null; message?: string | null } | null }>(
  intentar: (conLaColumna: boolean) => PromiseLike<T>,
): Promise<T> {
  const r = await intentar(true);
  return faltaLaColumna(r.error) ? intentar(false) : r;
}
