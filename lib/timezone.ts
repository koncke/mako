// =============================================================================
// timezone — zona horaria POR WORKSPACE (base para crons/avisos multi-tenant)
// =============================================================================
// Hasta ahora todo el negocio se anclaba a 'America/Tijuana' (donde vive el primer
// cliente). Con multi-inquilino cada workspace puede estar en otra zona: la
// guardamos en app_settings (key mako.timezone) por workspace y la resolvemos con
// tzDeWorkspace(ws). Los crons corren en UTC (Vercel); esta zona es solo para
// CALENDARIZAR ("hoy", "ayer") y para MOSTRAR a qué hora local dispara algo.

import 'server-only';
import { getSetting, setSetting } from '@/lib/settings';
import { getWorkspaceActual, runWithWorkspace } from '@/lib/workspace';
import { hoyEnTz, TZ_TIJUANA } from '@/lib/date-utils';

// El literal vive en date-utils (que NO es server-only): los componentes de
// cliente necesitan la zona por defecto para su primer render y no pueden
// importar este módulo. Duplicarlo era garantizar que un día se separen.
export const TZ_DEFAULT = TZ_TIJUANA;
export const KEY_TIMEZONE = 'mako.timezone';

/** Zona horaria del workspace (setting mako.timezone) con fallback al default. */
export async function tzDeWorkspace(ws: number): Promise<string> {
  const tz = await runWithWorkspace(ws, () => getSetting(KEY_TIMEZONE));
  return tz && esTzValida(tz) ? tz : TZ_DEFAULT;
}

/** Zona del workspace ACTUAL. Nunca lanza: una zona rota no puede tirar la página. */
export async function tzActual(): Promise<string> {
  try {
    const ws = await getWorkspaceActual();
    return ws == null ? TZ_DEFAULT : await tzDeWorkspace(ws);
  } catch {
    return TZ_DEFAULT;
  }
}

/**
 * 'YYYY-MM-DD' de HOY en la zona del workspace actual.
 *
 * Es el reemplazo multi-inquilino de hoyEnTijuana() para las pantallas que le
 * muestran "hoy" a un cliente. Con Tijuana fijo, un workspace en Madrid a las
 * 03:00 todavía veía el día anterior: el `min` del selector de fecha dejaba elegir
 * un día ya vencido y el server (que filtra los horarios pasados en la zona del
 * WORKSPACE) devolvía el día vacío. Y al revés, un workspace por detrás de Tijuana
 * no podía elegir su propio hoy.
 *
 * El resto del repo sigue anclado a hoyEnTijuana: migrarlo entero es otra tarea.
 */
export async function hoyEnWorkspace(date: Date = new Date()): Promise<string> {
  return hoyEnTz(await tzActual(), date);
}

/** Fija la zona horaria del workspace (desde onboarding / configuraciones). */
export async function setTimezoneWorkspace(ws: number, tz: string): Promise<void> {
  if (!esTzValida(tz)) throw new Error(`Zona horaria inválida: ${tz}`);
  await runWithWorkspace(ws, () => setSetting(KEY_TIMEZONE, tz));
}

/** Valida que la zona sea una IANA que el runtime entienda. */
export function esTzValida(tz: string): boolean {
  try { new Intl.DateTimeFormat('en-CA', { timeZone: tz }); return true; } catch { return false; }
}
