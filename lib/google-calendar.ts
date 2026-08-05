// =============================================================================
// google-calendar — lectura de eventos del calendario (3ra fuente de auto-reuniones)
// =============================================================================
// OAuth aparte del login (ese es online/openid): acá pedimos calendar.readonly
// con access_type=offline para guardar un refresh_token del dueño. Con ese token
// refrescamos un access_token y consultamos la Calendar API. Fase 1: la conexión
// es global del dueño (como Chatwoot/Fathom), guardada en app_settings.

import 'server-only';
import { OWNER_WS } from './auth-session';
import { cifrarSecreto, descifrarSecreto } from './credenciales';
import { getSetting, setSetting } from './settings';
import { getWorkspaceActual } from './workspace';

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
// El ws va explícito en el cifrado (clave derivada + AAD), así que tiene que ser
// el MISMO que usa setSetting para elegir la fila. Los dos resuelven por
// getWorkspaceActual, y el callback del login llama a esto dentro de
// runWithWorkspace — o sea que ven el mismo workspace.
async function wsDelSetting(): Promise<number> {
  return (await getWorkspaceActual()) ?? OWNER_WS;
}

export async function guardarRefreshTokenGoogle(rt: string, email?: string | null): Promise<void> {
  await setSetting(TOKEN_KEY, cifrarSecreto(rt, await wsDelSetting(), TOKEN_KEY));
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
/**
 * Conectada = el token existe Y SE PUEDE ABRIR. Chequear solo que no esté vacío
 * dejaba que el semáforo mintiera: si el token quedaba ilegible (rotación de
 * secreto, migración a medias), el tile seguía en verde diciendo "cruzando tus
 * reuniones" mientras el buscador devolvía vacío para siempre y en silencio.
 * A diferencia de la tabla `credenciales`, acá no hay estado "ilegible" que
 * avise: si no abre, no está conectada.
 */
export async function googleCalendarConectado(): Promise<boolean> {
  return (await refreshTokenGoogle()) !== null;
}

// El token en claro, o null si no está o no abre. Único lugar que lo descifra.
async function refreshTokenGoogle(): Promise<string | null> {
  const guardado = (await getSetting(TOKEN_KEY))?.trim();
  if (!guardado) return null;
  const rt = descifrarSecreto(guardado, await wsDelSetting(), TOKEN_KEY)?.trim();
  return rt || null;
}

// refresh_token → access_token (corto). null si no está conectado o falla.
async function accessTokenGoogle(): Promise<string | null> {
  const rt = await refreshTokenGoogle();
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

/** Un invitado del calendario: el email y el nombre que puso quien creó el evento. */
export type InvitadoCal = { email: string; nombre: string };

const normTxt = (s: string): string =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * LOS INVITADOS DE UNA REUNIÓN, buscando por CUÁNDO fue (y opcionalmente cómo se
 * llamaba). Es la vuelta que faltaba: `buscarEventosGoogle` exige un email de entrada
 * y lo usa como texto de búsqueda, así que solo sirve para confirmar a alguien que ya
 * conocés. Acá es al revés — «esta grabación es del martes 2 a las 15:04, ¿quién estaba
 * invitado?» — que es el caso real de un Meet improvisado: Fathom no devuelve invitados
 * y la única forma de saber con quién hablaste es el calendario.
 *
 * Cómo elige el evento, en orden:
 *   1. el que EMPIEZA más cerca del inicio de la grabación (tope: 90 minutos), y
 *   2. si el título de la grabación se parece al del evento, ese gana.
 * Devuelve [] si no está conectado, si falla o si no hay ningún evento cerca: es una
 * fuente auxiliar y NUNCA puede romper la extracción.
 */
export async function invitadosDeReunionPorFecha(inicioIso: string, titulo?: string | null): Promise<InvitadoCal[]> {
  const at = await accessTokenGoogle();
  if (!at || !inicioIso) return [];
  const t0 = Date.parse(inicioIso);
  if (!Number.isFinite(t0)) return [];
  const VENTANA_MS = 90 * 60 * 1000;
  try {
    const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
    url.searchParams.set('timeMin', new Date(t0 - VENTANA_MS).toISOString());
    url.searchParams.set('timeMax', new Date(t0 + VENTANA_MS).toISOString());
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');
    url.searchParams.set('maxResults', '20');
    const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${at}` }, cache: 'no-store' });
    if (!res.ok) return [];
    const j = (await res.json()) as { items?: Array<{ summary?: string; start?: { dateTime?: string; date?: string }; attendees?: Array<{ email?: string; displayName?: string; resource?: boolean }> }> };
    const items = (j.items ?? []).filter((e) => (e.attendees ?? []).length > 0);
    if (!items.length) return [];

    const tituloNorm = normTxt(titulo ?? '');
    const puntaje = (e: { summary?: string; start?: { dateTime?: string; date?: string } }): number => {
      const st = Date.parse(e.start?.dateTime ?? e.start?.date ?? '');
      const cerca = Number.isFinite(st) ? Math.abs(st - t0) : VENTANA_MS;
      // El título pesa: media hora de cercanía. Un «Mau <> Martin» que arranca 10
      // minutos después le gana a otro evento que arranca justo pero se llama distinto.
      const porTitulo = tituloNorm && normTxt(e.summary ?? '') && (normTxt(e.summary ?? '').includes(tituloNorm) || tituloNorm.includes(normTxt(e.summary ?? ''))) ? 30 * 60 * 1000 : 0;
      return cerca - porTitulo;
    };
    const mejor = items.slice().sort((a, b) => puntaje(a) - puntaje(b))[0];
    const vistos = new Set<string>();
    const out: InvitadoCal[] = [];
    for (const a of mejor.attendees ?? []) {
      // Las salas y los recursos NO son personas.
      if (a.resource) continue;
      const email = (a.email ?? '').trim().toLowerCase();
      if (!email || email.endsWith('.calendar.google.com') || vistos.has(email)) continue;
      vistos.add(email);
      out.push({ email, nombre: (a.displayName ?? '').trim() });
    }
    if (out.length) console.log(`[google-calendar] «${titulo ?? inicioIso}» → ${out.length} invitado(s) del evento «${mejor.summary ?? ''}»`);
    return out;
  } catch {
    return [];
  }
}
