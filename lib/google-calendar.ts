// =============================================================================
// google-calendar — lectura de eventos del calendario (3ra fuente de auto-reuniones)
// =============================================================================
// OAuth aparte del login (ese es online/openid): acá pedimos calendar.readonly
// con access_type=offline para guardar un refresh_token del dueño. Con ese token
// refrescamos un access_token y consultamos la Calendar API. Fase 1: la conexión
// es global del dueño (como Chatwoot/Fathom), guardada en app_settings.

import 'server-only';
import { getSetting, setSetting } from './settings';

export const GCAL_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
const TOKEN_KEY = 'google.calendar.refresh_token';

/**
 * Redirect URI del OAuth de Google Calendar. DEBE coincidir EXACTAMENTE con una
 * de las "URIs de redireccionamiento autorizadas" del cliente OAuth en Google
 * Cloud Console; si no, Google devuelve `Error 400: redirect_uri_mismatch`.
 *
 * Prioriza `GOOGLE_REDIRECT_URI` (fija el valor y evita que un proxy/dominio
 * distinto rompa el match). Si no está, la deriva del origin del request. El
 * paso 1 (auth) y el paso 2 (token exchange) tienen que usar el MISMO valor.
 */
export function googleRedirectUri(origin: string): string {
  const fijo = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (fijo) return fijo;
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim()?.replace(/\/+$/, '') || origin.replace(/\/+$/, '');
  return `${base}/api/integraciones/google-calendar/callback`;
}

export async function guardarRefreshTokenGoogle(rt: string): Promise<void> {
  await setSetting(TOKEN_KEY, rt);
}
export async function desconectarGoogleCalendar(): Promise<void> {
  await setSetting(TOKEN_KEY, '');
}
export async function googleCalendarConectado(): Promise<boolean> {
  return !!(await getSetting(TOKEN_KEY))?.trim();
}

// refresh_token → access_token (corto). null si no está conectado o falla.
async function accessTokenGoogle(): Promise<string | null> {
  const rt = (await getSetting(TOKEN_KEY))?.trim();
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!rt || !clientId || !clientSecret) return null;
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: rt, grant_type: 'refresh_token' }),
      cache: 'no-store',
    });
    const j = (await res.json()) as { access_token?: string };
    return typeof j.access_token === 'string' ? j.access_token : null;
  } catch {
    return null;
  }
}

export type GEvent = { summary: string | null; start: string | null; attendees: string[] };

/**
 * Eventos del calendario primario del dueño que involucran a `email` dentro del
 * rango [timeMin, timeMax] (ISO). Vacío si no está conectado o falla (silencioso:
 * es una fuente auxiliar, nunca debe romper el flujo).
 */
export async function buscarEventosGoogle(email: string | null, timeMin: string, timeMax: string): Promise<GEvent[]> {
  const at = await accessTokenGoogle();
  if (!at || !email) return [];
  try {
    const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
    url.searchParams.set('timeMin', timeMin);
    url.searchParams.set('timeMax', timeMax);
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');
    url.searchParams.set('maxResults', '50');
    url.searchParams.set('q', email);
    const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${at}` }, cache: 'no-store' });
    const j = (await res.json()) as { items?: Array<{ summary?: string; start?: { dateTime?: string; date?: string }; attendees?: Array<{ email?: string }> }> };
    return (j.items ?? []).map((e) => ({
      summary: e.summary ?? null,
      start: e.start?.dateTime ?? e.start?.date ?? null,
      attendees: (e.attendees ?? []).map((a) => a.email).filter((x): x is string => !!x),
    }));
  } catch {
    return [];
  }
}
