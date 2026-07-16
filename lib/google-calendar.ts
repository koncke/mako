// =============================================================================
// google-calendar — lectura de eventos del calendario (3ra fuente de auto-reuniones)
// =============================================================================
// OAuth aparte del login (ese es online/openid): acá pedimos calendar.readonly
// con access_type=offline para guardar un refresh_token del dueño. Con ese token
// refrescamos un access_token y consultamos la Calendar API. Fase 1: la conexión
// es global del dueño (como Chatwoot/Fathom), guardada en app_settings.

import 'server-only';
import { cifrarSecreto, descifrarSecreto } from './credenciales';
import { getSetting, setSetting } from './settings';

export const GCAL_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
const TOKEN_KEY = 'google.calendar.refresh_token';
// De QUIÉN es la agenda conectada. El token es UNO por workspace, y un workspace
// puede tener varias cuentas (en ws1 hay 3, todas rol_ws=admin): sin esto, el
// último en entrar con Google pisaba la agenda del anterior en silencio y el
// buscador de reuniones pasaba a leer la del empleado equivocado.
const EMAIL_KEY = 'google.calendar.email';

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

// El refresh_token es una credencial de larga vida (acceso a la agenda del
// cliente) y app_settings no cifra nada: sin esto quedaba EN CLARO en la base, a
// un SELECT de distancia, mientras el resto de las llaves van cifradas. El email
// sí va en claro: es un identificador, no un secreto (y se muestra en la UI).
export async function guardarRefreshTokenGoogle(rt: string, email?: string | null): Promise<void> {
  await setSetting(TOKEN_KEY, cifrarSecreto(rt));
  if (email?.trim()) await setSetting(EMAIL_KEY, email.trim());
}
export async function desconectarGoogleCalendar(): Promise<void> {
  await setSetting(TOKEN_KEY, '');
  await setSetting(EMAIL_KEY, '');
}
/** Email de la cuenta cuya agenda usa este workspace, o null si no hay ninguna. */
export async function googleCalendarDueno(): Promise<string | null> {
  return (await getSetting(EMAIL_KEY))?.trim() || null;
}

/**
 * De quién es este token: el `id` del calendario primario ES el email de la
 * cuenta. Lo pedimos así (y no a /userinfo) porque el flujo manual solo tiene el
 * scope de calendar.readonly. Best-effort: null si falla, y el token igual se
 * guarda — solo quedaría sin saber de quién es la agenda.
 */
export async function emailDelCalendario(accessToken: string): Promise<string | null> {
  try {
    const r = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary', {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    const j = (await r.json()) as { id?: string };
    return typeof j.id === 'string' && j.id.includes('@') ? j.id.toLowerCase() : null;
  } catch {
    return null;
  }
}
export async function googleCalendarConectado(): Promise<boolean> {
  return !!(await getSetting(TOKEN_KEY))?.trim();
}

// refresh_token → access_token (corto). null si no está conectado o falla.
async function accessTokenGoogle(): Promise<string | null> {
  const guardado = (await getSetting(TOKEN_KEY))?.trim();
  const rt = guardado ? descifrarSecreto(guardado)?.trim() : null;
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
