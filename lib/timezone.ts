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
import { runWithWorkspace } from '@/lib/workspace';

export const TZ_DEFAULT = 'America/Tijuana';
export const KEY_TIMEZONE = 'mako.timezone';

/** Zona horaria del workspace (setting mako.timezone) con fallback al default. */
export async function tzDeWorkspace(ws: number): Promise<string> {
  const tz = await runWithWorkspace(ws, () => getSetting(KEY_TIMEZONE));
  return tz && esTzValida(tz) ? tz : TZ_DEFAULT;
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
