// =============================================================================
// google-calendar — leer Y MOVER eventos del calendario del dueño
// =============================================================================
// OAuth aparte del login (ese es online/openid): acá pedimos los scopes de
// calendario con access_type=offline para guardar un refresh_token del dueño.
// Con ese token refrescamos un access_token y consultamos la Calendar API.
// Fase 1: la conexión es global del dueño (como Chatwoot/Fathom), guardada en
// app_settings.
//
// Escribir (mover/crear un evento) es lo que hace real el "Reagendar" del CRM:
// Calendly NO tiene endpoint de reschedule —y menos sobre un evento que ya
// pasó—, así que la única forma de que la reunión se mueva DE VERDAD y el
// invitado se entere es tocar el evento en Google.

import 'server-only';
import { OWNER_WS } from './auth-session';
import { cifrarSecreto, descifrarSecreto } from './credenciales';
import { getSetting, setSetting } from './settings';
import { esTzValida, TZ_DEFAULT, tzDeWorkspace } from './timezone';
import { getWorkspaceActual } from './workspace';
// La traducción de los fallos de Google vive en el módulo puro del contrato de
// horarios (testeable: este archivo es server-only y no se puede importar en tests).
import { motivoLegible } from '../app/crm/horarios-respuesta';

export const GCAL_SCOPE_LECTURA = 'https://www.googleapis.com/auth/calendar.readonly';
/**
 * Escritura ACOTADA a eventos: deja crear, mover y cancelar eventos, pero no
 * tocar la lista de calendarios ni sus permisos. Es el mínimo que necesita
 * "Reagendar" — pedir el `calendar` completo sería pedir de más para lo mismo.
 */
export const GCAL_SCOPE_ESCRITURA = 'https://www.googleapis.com/auth/calendar.events';
/**
 * Lo que se pide en el consentimiento. Van los DOS: `events` no alcanza para
 * `calendars.get` (de ahí sale el email de la agenda, ver emailDelCalendario) y
 * `readonly` no alcanza para mover nada.
 *
 * ⚠️ Los refresh_token YA EMITIDOS conservan el scope con el que se otorgaron:
 * subir esta constante NO le da escritura a quien conectó antes. Por eso existe
 * permisoCalendarioGoogle() — la UI tiene que poder decir "reconectá" en vez de
 * fallar en silencio al primer intento de mover.
 */
export const GCAL_SCOPE = `${GCAL_SCOPE_LECTURA} ${GCAL_SCOPE_ESCRITURA}`;
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

/** El access_token corto + los permisos con los que Google lo emitió. */
type TokenGoogle = { access: string; scopes: string[] };

/**
 * refresh_token → access_token (corto). null si no está conectado o falla.
 *
 * Devuelve también los SCOPES: el endpoint de refresh los informa en cada
 * respuesta, así que saber si este token puede escribir sale gratis, sin un
 * request extra a /tokeninfo. Es la única forma de distinguir un token viejo
 * (solo lectura) de uno nuevo antes de intentar mover un evento.
 */
async function tokenGoogle(): Promise<TokenGoogle | null> {
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
      // Con timeout: este refresh es la puerta de TODO lo demás (leer y mover), y
      // sin tope colgaba el request que lo llamó hasta el límite de la plataforma.
      signal: AbortSignal.timeout(8000),
    });
    const j = (await res.json()) as { access_token?: string; scope?: string };
    if (typeof j.access_token !== 'string') return null;
    return { access: j.access_token, scopes: (j.scope ?? '').split(/\s+/).filter(Boolean) };
  } catch {
    return null;
  }
}

// Compat: los lectores solo necesitan el token.
async function accessTokenGoogle(): Promise<string | null> {
  return (await tokenGoogle())?.access ?? null;
}

/**
 * ¿Este token puede mover eventos? OPTIMISTA a propósito cuando Google no
 * informó los scopes: afirmar "no podés" sin pruebas mandaría al usuario a
 * reconectar una agenda que funciona. Si igual no puede, el 403 de la API lo
 * dice con certeza y ahí sí se le pide reconectar.
 */
function puedeEscribir(scopes: string[]): boolean {
  if (!scopes.length) return true;
  return scopes.some((s) => s === GCAL_SCOPE_ESCRITURA || s === 'https://www.googleapis.com/auth/calendar');
}

// El evento tal como lo devuelve la API, con lo único que miramos. `id` y `end`
// no le servían a nadie mientras esto solo leía; ahora son lo que permite MOVER
// (a qué evento le pego el PATCH y cuánto duraba para conservar la duración).
type EventoCrudo = {
  id?: string;
  summary?: string;
  status?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: Array<{ email?: string; displayName?: string; resource?: boolean }>;
  organizer?: { email?: string; self?: boolean };
};

const EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

/**
 * UN solo lector de eventos del calendario primario. Los tres casos de uso
 * (confirmar a alguien conocido, averiguar los invitados de una grabación,
 * encontrar el evento a mover) hacían el mismo request con distinto recorte:
 * separarlos garantizaba que el próximo ajuste —`singleEvents`, el tope de
 * resultados, el timeout— quedara aplicado en uno solo.
 *
 * `singleEvents=true` es clave para mover: expande las series recurrentes en
 * instancias con id propio, así el PATCH corre esa ocurrencia y no toda la serie.
 */
async function listarEventos(at: string, p: { timeMin: string; timeMax: string; q?: string; max?: number }): Promise<EventoCrudo[]> {
  const url = new URL(EVENTS_URL);
  url.searchParams.set('timeMin', p.timeMin);
  url.searchParams.set('timeMax', p.timeMax);
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');
  url.searchParams.set('maxResults', String(p.max ?? 50));
  if (p.q) url.searchParams.set('q', p.q);
  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${at}` }, cache: 'no-store', signal: AbortSignal.timeout(10000) });
  if (!res.ok) return [];
  const j = (await res.json()) as { items?: EventoCrudo[] };
  // Un evento cancelado sigue apareciendo en la lista: moverlo sería resucitar
  // algo que alguien canceló a propósito.
  return (j.items ?? []).filter((e) => e.status !== 'cancelled');
}

const inicioDe = (e: EventoCrudo): string | null => e.start?.dateTime ?? e.start?.date ?? null;

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
    return (await listarEventos(at, { timeMin, timeMax, q: email })).map((e) => ({
      summary: e.summary ?? null,
      start: inicioDe(e),
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
 * ¿El título del evento y el que traemos hablan de lo mismo? `includes` en las
 * dos direcciones porque uno suele contener al otro («Juan Pérez» dentro de
 * «Llamada con Juan Pérez»). Pide 4 caracteres: con menos, cualquier evento
 * matchea con cualquier cosa.
 */
function titulosParecidos(a: string, b: string): boolean {
  const x = normTxt(a);
  const y = normTxt(b);
  if (x.length < 4 || y.length < 4) return false;
  return x.includes(y) || y.includes(x);
}

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
    const items = (await listarEventos(at, {
      timeMin: new Date(t0 - VENTANA_MS).toISOString(),
      timeMax: new Date(t0 + VENTANA_MS).toISOString(),
      max: 20,
    })).filter((e) => (e.attendees ?? []).length > 0);
    if (!items.length) return [];

    const puntaje = (e: EventoCrudo): number => {
      const st = Date.parse(inicioDe(e) ?? '');
      const cerca = Number.isFinite(st) ? Math.abs(st - t0) : VENTANA_MS;
      // El título pesa: media hora de cercanía. Un «Mau <> Martin» que arranca 10
      // minutos después le gana a otro evento que arranca justo pero se llama distinto.
      const porTitulo = titulo && titulosParecidos(e.summary ?? '', titulo) ? 30 * 60 * 1000 : 0;
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

// =============================================================================
// ESCRIBIR — mover (o crear) el evento de una reunión
// =============================================================================

/** Qué puede hacer HOY el token guardado. `puedeMover` es lo que gatea "Reagendar". */
export type PermisoCalendario = { conectado: boolean; puedeMover: boolean; email: string | null };

/**
 * Si el permiso alcanza para mover reuniones. Existe porque subir GCAL_SCOPE no
 * migra los tokens ya emitidos: quien conectó su agenda cuando solo se pedía
 * `readonly` sigue con `readonly` hasta que vuelva a autorizar. Sin este chequeo
 * la UI mostraría el botón como si funcionara y el usuario se enteraría recién
 * cuando la reunión NO se movió.
 *
 * Pega contra Google (refresca el token para leer los scopes): llamalo cuando el
 * usuario abre la pantalla, no en cada render de una lista.
 */
export async function permisoCalendarioGoogle(): Promise<PermisoCalendario> {
  try {
    const tk = await tokenGoogle();
    if (!tk) return { conectado: false, puedeMover: false, email: null };
    return { conectado: true, puedeMover: puedeEscribir(tk.scopes), email: await googleCalendarDueno() };
  } catch {
    return { conectado: false, puedeMover: false, email: null };
  }
}

/** Por qué salió como salió. La UI decide con esto si ofrece reconectar. */
export type CodigoCalendario = 'ok' | 'sin-conexion' | 'sin-permiso' | 'sin-fecha' | 'no-organizador' | 'api';

/**
 * Resultado SIEMPRE tipado, nunca una excepción: quien reagenda ya guardó la
 * fecha en el CRM y esto es lo que pasó *además*. Si Google falla, el reagendado
 * no se cae — se informa.
 */
export type ResultadoCalendario = {
  ok: boolean;
  accion: 'movido' | 'creado' | 'nada';
  codigo: CodigoCalendario;
  /** Frase lista para mostrar y para el historial del lead. */
  motivo: string;
  eventoId: string | null;
  /** A quién se le avisó (o a quién se le iba a avisar). */
  invitado: string | null;
};

export type PedidoMoverEvento = {
  /** Cuándo pasa a ser la reunión (ISO). */
  nuevoInicioIso: string;
  /** Cuándo ESTABA (ISO con hora, de Calendly). Es el ancla para encontrar el evento. */
  inicioAnteriorIso?: string | null;
  /** Fallback si no había hora: el día (YYYY-MM-DD) en que estaba la reunión. */
  fechaAnterior?: string | null;
  /** Email del lead: la señal más fuerte para reconocer el evento, y a quién se le avisa. */
  emailInvitado?: string | null;
  /**
   * Con qué texto reconocer el evento. Va CORTO (el nombre del lead): el match
   * es por `includes`, así que un título largo tipo «Reunión 1 · Juan Pérez» no
   * matchearía contra un evento que se llama «Llamada con Juan Pérez».
   */
  titulo?: string | null;
  /** Título del evento NUEVO, si hay que crearlo. Acá sí conviene que sea descriptivo. */
  tituloSiSeCrea?: string | null;
  /** Solo se usa si no se pudo deducir cuánto duraba el evento original. */
  duracionMin?: number;
};

const DURACION_DEFECTO_MIN = 45;

/**
 * Traduce un error de la Calendar API a algo que el usuario pueda leer y accionar.
 * El caso que importa distinguir es el scope corto: es el ÚNICO que se arregla
 * reconectando, y confundirlo con "falló Google" haría que el usuario reintente
 * para siempre.
 */
async function leerFallo(res: Response): Promise<{ codigo: CodigoCalendario; motivo: string }> {
  let msg = '';
  let reason = '';
  try {
    const j = (await res.json()) as { error?: { message?: string; errors?: Array<{ reason?: string }> } };
    msg = j.error?.message ?? '';
    reason = j.error?.errors?.[0]?.reason ?? '';
  } catch {
    /* respuesta sin JSON: nos quedamos con el status */
  }
  const txt = `${reason} ${msg}`.toLowerCase();
  if (res.status === 401 || txt.includes('invalid credentials') || txt.includes('invalid_grant')) {
    return { codigo: 'sin-permiso', motivo: 'Google rechazó la conexión de la agenda (el permiso venció o se revocó): hay que reconectarla.' };
  }
  if (res.status === 403 && (txt.includes('insufficient') || txt.includes('scope'))) {
    return { codigo: 'sin-permiso', motivo: 'El permiso de Google es de solo lectura: reconectá la agenda para poder mover reuniones.' };
  }
  if (txt.includes('organizer')) {
    return { codigo: 'no-organizador', motivo: 'El evento lo organiza otra cuenta y Google no deja moverlo desde esta agenda.' };
  }
  return { codigo: 'api', motivo: msg ? `Google devolvió: ${msg}` : `Google respondió ${res.status}.` };
}

/**
 * El evento de ESTA reunión, o null si no aparece ninguno convincente.
 *
 * Es deliberadamente EXIGENTE: mover el evento equivocado le manda una
 * notificación de cambio a gente que no tiene nada que ver y le pisa la agenda
 * al dueño. Ante la duda preferimos no encontrar nada (el caller crea uno nuevo,
 * que es recuperable) antes que mover algo ajeno.
 *
 * Acepta el candidato solo si pasa alguna de estas tres:
 *   · el lead está invitado al evento (prueba directa),
 *   · el título se parece al que traemos, o
 *   · arranca prácticamente a la misma hora que la reunión vieja (±10 min).
 */
async function buscarEventoDeReunion(at: string, p: PedidoMoverEvento): Promise<EventoCrudo | null> {
  const email = (p.emailInvitado ?? '').trim().toLowerCase();
  const anclaHora = Date.parse(p.inicioAnteriorIso ?? '');
  const tieneHora = Number.isFinite(anclaHora);
  const anclaDia = /^\d{4}-\d{2}-\d{2}$/.test(p.fechaAnterior ?? '') ? Date.parse(`${p.fechaAnterior}T12:00:00Z`) : NaN;

  // Sin saber CUÁNDO estaba, no hay forma honesta de identificar el evento.
  const t0 = tieneHora ? anclaHora : anclaDia;
  if (!Number.isFinite(t0)) return null;
  // Con hora exacta basta una ventana chica; con solo el día hay que barrer el
  // día entero (y el huso puede correrlo unas horas para cualquier lado).
  const ventana = tieneHora ? 3 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

  const items = await listarEventos(at, {
    timeMin: new Date(t0 - ventana).toISOString(),
    timeMax: new Date(t0 + ventana).toISOString(),
    max: 50,
  });
  if (!items.length) return null;

  const invitadoEsta = (e: EventoCrudo): boolean =>
    !!email && (e.attendees ?? []).some((a) => (a.email ?? '').trim().toLowerCase() === email);
  const distancia = (e: EventoCrudo): number => {
    const st = Date.parse(inicioDe(e) ?? '');
    return Number.isFinite(st) ? Math.abs(st - t0) : ventana * 2;
  };

  const evaluados = items.map((e) => {
    const porInvitado = invitadoEsta(e);
    const porTitulo = !!p.titulo && titulosParecidos(e.summary ?? '', p.titulo);
    // La hora sola alcanza SOLO si el ancla es una hora real. Si el ancla es "ese
    // día" (mediodía inventado), la cercanía no prueba nada y por sí sola movería
    // cualquier reunión del mediodía.
    const casiExacto = tieneHora && distancia(e) <= 10 * 60 * 1000;
    return {
      e,
      sirve: porInvitado || porTitulo || casiExacto,
      // El invitado manda sobre todo lo demás; después el título; y a igualdad,
      // el que arranca más cerca de la hora vieja.
      score: (porInvitado ? 1e12 : 0) + (porTitulo ? 1e9 : 0) - distancia(e),
    };
  }).filter((x) => x.sirve);

  if (!evaluados.length) return null;
  return evaluados.sort((a, b) => b.score - a.score)[0].e;
}

/** Cuánto duraba el evento original, en ms. null si es de día completo o no se puede leer. */
function duracionMs(e: EventoCrudo): number | null {
  const ini = Date.parse(e.start?.dateTime ?? '');
  const fin = Date.parse(e.end?.dateTime ?? '');
  if (!Number.isFinite(ini) || !Number.isFinite(fin)) return null;
  const d = fin - ini;
  // Acotado: una duración absurda (evento de varios días marcado con hora) haría
  // que la reunión reagendada le tape la agenda entera al dueño.
  return d >= 5 * 60 * 1000 && d <= 8 * 60 * 60 * 1000 ? d : null;
}

/**
 * MUEVE la reunión en Google Calendar. Si no encuentra el evento, lo CREA con el
 * lead invitado. En los dos casos con `sendUpdates=all`, que es lo que hace que
 * al invitado le llegue el aviso — sin eso el CRM diría "reagendada" y el otro
 * seguiría esperando a la hora vieja.
 *
 * Nunca lanza: devuelve el resultado tipado para que el caller lo muestre y lo
 * escriba en el historial. Reagendar en el CRM tiene que funcionar aunque Google
 * esté caído.
 */
export async function moverEventoDeReunion(p: PedidoMoverEvento): Promise<ResultadoCalendario> {
  const invitado = (p.emailInvitado ?? '').trim().toLowerCase() || null;
  const nada = (codigo: CodigoCalendario, motivo: string): ResultadoCalendario =>
    ({ ok: false, accion: 'nada', codigo, motivo, eventoId: null, invitado });

  const t1 = Date.parse(p.nuevoInicioIso ?? '');
  if (!Number.isFinite(t1)) return nada('sin-fecha', 'La fecha nueva no es una fecha válida.');

  try {
    const tk = await tokenGoogle();
    if (!tk) return nada('sin-conexion', 'No hay una agenda de Google conectada a este espacio.');
    if (!puedeEscribir(tk.scopes)) {
      return nada('sin-permiso', 'El permiso de Google es de solo lectura: reconectá la agenda para poder mover reuniones.');
    }

    const evento = await buscarEventoDeReunion(tk.access, p);
    const desde = new Date(t1).toISOString();
    const avisar = '?sendUpdates=all';

    if (evento?.id) {
      // Un evento que organiza otra cuenta (te invitaron) no se puede mover: la
      // API responde 403 y, sobre todo, moverlo no sería correcto. Se avisa y NO
      // se crea uno paralelo — dos eventos para la misma reunión es peor.
      if (evento.organizer?.self === false) {
        return { ...nada('no-organizador', `El evento «${evento.summary ?? 'sin título'}» lo organiza otra cuenta: movelo desde ahí.`), eventoId: evento.id };
      }
      const dur = duracionMs(evento) ?? (p.duracionMin ?? DURACION_DEFECTO_MIN) * 60 * 1000;
      const res = await fetch(`${EVENTS_URL}/${encodeURIComponent(evento.id)}${avisar}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tk.access}`, 'Content-Type': 'application/json' },
        // Solo start/end: un PATCH no toca lo que no mandás, así que el título,
        // la descripción, el Meet y los invitados quedan como estaban.
        body: JSON.stringify({ start: { dateTime: desde }, end: { dateTime: new Date(t1 + dur).toISOString() } }),
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        return {
          ok: true, accion: 'movido', codigo: 'ok', eventoId: evento.id, invitado,
          motivo: invitado ? `Evento movido en Google Calendar y avisado a ${invitado}.` : 'Evento movido en Google Calendar.',
        };
      }
      // 404/410 = el evento ya no existe (alguien lo borró): no es un error del
      // usuario, es exactamente el caso de "no hay nada que mover" → se crea.
      if (res.status !== 404 && res.status !== 410) {
        const f = await leerFallo(res);
        return { ...nada(f.codigo, f.motivo), eventoId: evento.id };
      }
    }

    const titulo = (p.tituloSiSeCrea ?? '').trim() || (p.titulo ?? '').trim() || 'Reunión';
    const crear = await fetch(`${EVENTS_URL}${avisar}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tk.access}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: titulo,
        description: 'Creado desde el CRM al reagendar la reunión.',
        start: { dateTime: desde },
        end: { dateTime: new Date(t1 + (p.duracionMin ?? DURACION_DEFECTO_MIN) * 60 * 1000).toISOString() },
        ...(invitado ? { attendees: [{ email: invitado }] } : {}),
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });
    if (!crear.ok) {
      const f = await leerFallo(crear);
      return nada(f.codigo, f.motivo);
    }
    const j = (await crear.json()) as { id?: string };
    return {
      ok: true, accion: 'creado', codigo: 'ok', eventoId: j.id ?? null, invitado,
      motivo: invitado
        ? `No había evento en la agenda: se creó «${titulo}» y se invitó a ${invitado}.`
        : `No había evento en la agenda: se creó «${titulo}».`,
    };
  } catch (e) {
    // Timeout o red: el CRM ya guardó, esto es lo único que se perdió.
    const msg = e instanceof Error && e.name === 'TimeoutError' ? 'Google no respondió a tiempo.' : 'No se pudo contactar a Google Calendar.';
    console.error('[google-calendar] mover evento:', e);
    return nada('api', msg);
  }
}

// =============================================================================
// LEER HUECOS — qué horarios de un día están libres en la agenda
// =============================================================================
// Para qué: al reagendar, la grilla de horas se generaba a ciegas (9:00→19:00 por
// constantes, app/crm/SelectorHora.tsx) y el usuario elegía encima de reuniones
// que ya tenía. Esto lee la agenda y marca cuáles están ocupados.
//
// ⚠️ Lo importante de esta parte del módulo: usa freeBusy, que Google acepta con
// `calendar.readonly`. Es decir, LOS HORARIOS FUNCIONAN CON PERMISO DE SOLO
// LECTURA — que es justo lo que tiene hoy el token del dueño. Por eso NO pasa por
// puedeEscribir(): copiar el guard de moverEventoDeReunion le negaría los huecos a
// todos los tokens viejos. "No poder mover el evento" y "no poder leer la agenda"
// son dos permisos distintos y acá solo hace falta el segundo.
//
// Por qué freeBusy y no listarEventos: respeta `transparency: 'transparent'` (los
// eventos marcados "disponible" no bloquean) e ignora los que el dueño rechazó —
// dos cosas que EventoCrudo ni siquiera modela. Si algún día freeBusy diera 403,
// listarEventos() ya está probado en prod y permite derivar lo mismo con menos
// precisión.

const FREEBUSY_URL = 'https://www.googleapis.com/calendar/v3/freeBusy';

/**
 * Jornada laboral por defecto y paso de la grilla. Son los MISMOS valores que
 * app/crm/SelectorHora.tsx (HORA_DESDE / HORA_HASTA / PASO_MIN): ese componente es
 * de cliente y este módulo es `server-only`, así que no se pueden compartir sin
 * un tercer módulo puro. Mientras tanto, la regla es que la UI PINTE LA GRILLA QUE
 * DEVUELVE ESTA FUNCIÓN en vez de generar la suya y cruzarla — así, aunque las
 * constantes se separen, no hay chips sin slot ni slots sin chip.
 */
const HORA_DESDE_DEFECTO = 9;
const HORA_HASTA_DEFECTO = 19;
const PASO_MIN_DEFECTO = 30;

/** Un horario de la grilla, con su estado real según la agenda. */
export type SlotHorario = {
  /** 'HH:MM' en la zona del workspace — el mismo formato que maneja SelectorHora. */
  hora: string;
  /**
   * El instante absoluto de ese horario (ISO UTC). Es lo que la UI tiene que MANDAR
   * al reagendar: si lo recalcula con `new Date(\`${fecha}T${hora}\`)` usa la zona
   * del navegador, y un closer en otro huso vería un slot y guardaría otro momento.
   */
  inicioIso: string;
  /** false = hay algo en la agenda que se pisa con la reunión completa. */
  libre: boolean;
};

export type OpcionesHorarios = {
  /** Zona IANA. Si no viene, se resuelve con tzDeWorkspace del workspace actual. */
  tz?: string;
  /** Jornada laboral local (hora entera). Default 9 y 19, inclusive las dos puntas. */
  desdeHora?: number;
  hastaHora?: number;
  /** Paso de la grilla en minutos. Default 30. */
  pasoMin?: number;
  /** Cuánto dura la reunión: el hueco solo sirve si entra ENTERA. Default 45. */
  duracionMin?: number;
  /** No ofrecer horarios ya pasados cuando la fecha es hoy. Default true. */
  ocultarPasados?: boolean;
  /** Solo para tests: qué momento se considera "ahora". */
  ahora?: Date;
};

/**
 * Por qué salió como salió. Es un subconjunto de CodigoCalendario a propósito:
 * 'sin-permiso' y 'no-organizador' no aplican a leer huecos, y un token revocado
 * se informa como 'sin-conexion' porque la salida del usuario es la misma
 * (reconectar la agenda), no reintentar.
 */
export type CodigoHorarios = Extract<CodigoCalendario, 'ok' | 'sin-conexion' | 'sin-fecha' | 'api'>;

export type ResultadoHorarios = {
  codigo: CodigoHorarios;
  /**
   * Frase lista para mostrar, o '' si no hay nada que aclarar. Con codigo distinto
   * de 'ok' SIEMPRE viene con texto (por qué no se pudo leer la agenda); con 'ok'
   * puede venir con un aviso igual (ej: hoy ya no quedan horarios).
   */
  motivo: string;
  /**
   * La grilla ENTERA del día: libres y ocupados. No se filtran los ocupados a
   * propósito — si el horario habitual del usuario desaparece sin explicación no
   * entiende por qué, y el layout salta. La UI los pinta apagados.
   * Vacía solo si la fecha es inválida o si ya pasaron todos los horarios de hoy.
   */
  slots: SlotHorario[];
  /** La zona en la que se interpretaron las horas, para que la UI la pueda decir. */
  tz: string;
};

/** Zona del workspace actual. Nunca lanza: una zona rota no puede tirar la pantalla. */
async function tzParaHorarios(pedida?: string): Promise<string> {
  if (pedida && esTzValida(pedida)) return pedida;
  try {
    return await tzDeWorkspace((await getWorkspaceActual()) ?? OWNER_WS);
  } catch {
    return TZ_DEFAULT;
  }
}

/**
 * Cuánto está corrida `tz` respecto de UTC en ESE instante (ms). Se calcula
 * formateando el instante en la zona y volviendo a leer las partes como si fueran
 * UTC: la diferencia es el offset real, con DST incluido.
 */
function offsetTzMs(tz: string, tsUtc: number): number {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(new Date(tsUtc));
  const g = (t: string): number => Number(p.find((x) => x.type === t)?.value);
  // Algunos runtimes devuelven "24" en vez de "00" a medianoche con hour12:false.
  const h = g('hour') % 24;
  return Date.UTC(g('year'), g('month') - 1, g('day'), h, g('minute'), g('second')) - tsUtc;
}

/**
 * Día local ('YYYY-MM-DD') + minutos desde medianoche + zona → instante UTC.
 * Es el INVERSO de fechaHoraEnTz (lib/date-utils) y no existía en el repo; el
 * único precedente era un offset fijo -6 en lib/nutricion.ts, que ignora DST y por
 * eso NO se copia.
 *
 * Dos pasadas: la primera estima el offset del día suponiendo la hora en UTC, y la
 * segunda lo recalcula ya parado en el instante estimado. Sin eso, el día del
 * cambio de horario queda corrido una hora.
 *
 * Las dos horas patológicas del cambio de horario están cubiertas sin caso
 * especial: la que NO existe (2:00 el día que adelanta) cae en la hora real más
 * cercana y la que se repite toma la primera vuelta. Ninguna de las dos entra en
 * la jornada laboral por defecto, y en cualquier caso el instante devuelto existe.
 */
function instanteDeLocal(fechaISO: string, minutosDelDia: number, tz: string): string | null {
  const [y, m, d] = fechaISO.split('-').map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  try {
    const local = Date.UTC(y, m - 1, d) + minutosDelDia * 60_000;
    let ts = local - offsetTzMs(tz, local);
    ts = local - offsetTzMs(tz, ts);
    return Number.isFinite(ts) ? new Date(ts).toISOString() : null;
  } catch {
    return null;
  }
}

const hhmm = (min: number): string => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/** Igual que esFechaValida de lib/date-utils, pero acá no se puede importar cliente-code. */
function esDiaValido(fecha: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const [y, m, d] = fecha.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Un intervalo ocupado, ya parseado a milisegundos. */
type Ocupado = { ini: number; fin: number };

/**
 * LOS HORARIOS DE UNA FECHA CON SU DISPONIBILIDAD REAL, leídos de Google.
 *
 * NUNCA lanza y NUNCA bloquea: si no hay agenda conectada, el token no abre o
 * Google falla, devuelve la grilla COMPLETA con todo en `libre:true` y un `codigo`
 * distinto de 'ok' para que la UI muestre el aviso y siga dejando elegir la hora a
 * mano. Perder la ayuda no puede impedir reagendar — mismo criterio que
 * moverEventoDeReunion.
 *
 * @param fechaISO día local 'YYYY-MM-DD' (el mismo valor del <input type="date">).
 */
export async function horariosLibresDeGoogle(fechaISO: string, opts: OpcionesHorarios = {}): Promise<ResultadoHorarios> {
  const tz = await tzParaHorarios(opts.tz);
  const fecha = (fechaISO ?? '').trim();
  if (!esDiaValido(fecha)) {
    return { codigo: 'sin-fecha', motivo: 'La fecha no es válida.', slots: [], tz };
  }

  // Parámetros acotados: un `hastaHora` de 99 o un paso de 0 generarían una grilla
  // infinita y el request moriría por timeout en vez de devolver algo usable.
  const desde = Math.min(23, Math.max(0, Math.trunc(opts.desdeHora ?? HORA_DESDE_DEFECTO)));
  const hasta = Math.min(23, Math.max(desde, Math.trunc(opts.hastaHora ?? HORA_HASTA_DEFECTO)));
  const paso = Math.min(180, Math.max(5, Math.trunc(opts.pasoMin ?? PASO_MIN_DEFECTO)));
  const duracionMs = Math.min(8 * 60, Math.max(5, Math.trunc(opts.duracionMin ?? DURACION_DEFECTO_MIN))) * 60_000;

  // La grilla se arma ANTES de hablar con Google: es la respuesta de todos los
  // caminos de error, así que no puede depender de que la consulta salga bien.
  const grilla: SlotHorario[] = [];
  for (let min = desde * 60; min <= hasta * 60; min += paso) {
    const inicioIso = instanteDeLocal(fecha, min, tz);
    if (!inicioIso) continue;
    grilla.push({ hora: hhmm(min), inicioIso, libre: true });
  }

  // Un horario que ya pasó no es una opción: ofrecerlo solo genera el error de
  // agendar en el pasado. Se van de la grilla, no se marcan "ocupados" (ocupado
  // significa "hay otra cosa ahí", que es distinto).
  const ahora = (opts.ahora ?? new Date()).getTime();
  const slots = (opts.ocultarPasados ?? true) ? grilla.filter((s) => Date.parse(s.inicioIso) > ahora) : grilla;

  if (!slots.length) {
    // Sin slots no hay nada que consultar: nos ahorramos el request a Google.
    const motivo = grilla.length
      ? 'Ya pasaron todos los horarios de hoy: elegí otro día o cargá la hora a mano.'
      : 'No hay horarios configurados para ese día.';
    return { codigo: 'ok', motivo, slots: [], tz };
  }

  const falla = (codigo: CodigoHorarios, motivo: string): ResultadoHorarios => ({ codigo, motivo, slots, tz });

  try {
    const tk = await tokenGoogle();
    // OJO: acá NO va puedeEscribir(). freeBusy anda con calendar.readonly y ese es
    // justo el token que hoy tiene el dueño; gatearlo dejaría la feature muerta
    // para quien más la necesita.
    if (!tk) return falla('sin-conexion', 'No hay una agenda de Google conectada a este espacio.');

    // La ventana cubre desde el primer slot hasta el final de la reunión que
    // arrancaría en el último: un evento que empieza a las 19:20 tiene que pisar
    // el slot de las 19:00 si la reunión dura 45 minutos.
    const timeMin = slots[0].inicioIso;
    const timeMax = new Date(Date.parse(slots[slots.length - 1].inicioIso) + duracionMs).toISOString();

    const res = await fetch(FREEBUSY_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tk.access}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ timeMin, timeMax, timeZone: tz, items: [{ id: 'primary' }] }),
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      const f = await leerFallo(res);
      // 'sin-permiso' acá significa token revocado/vencido (freeBusy no necesita
      // scope de escritura): para el usuario es lo mismo que no tener agenda, y la
      // salida es reconectar, no reintentar.
      //
      // El motivo NO se reenvía tal cual: `leerFallo` está escrito para el camino
      // de ESCRITURA y para un 403 de scope dice "el permiso es de solo lectura,
      // reconectá para poder MOVER reuniones" — exactamente al revés de lo que
      // pasó acá (lo que faltó es el permiso de LEER, y mover anda).
      if (f.codigo === 'sin-permiso') {
        return falla('sin-conexion', res.status === 403
          ? 'El permiso de Google no alcanza para leer tu agenda: reconectala desde Integraciones.'
          : f.motivo);
      }
      // El texto de Google NUNCA va a pantalla: son párrafos en inglés con el id
      // del proyecto y una URL de la consola de desarrolladores. El usuario del CRM
      // no puede hacer nada con eso; el dueño sí, pero desde Integraciones.
      console.error(`[google-calendar] freeBusy ${res.status}: ${f.motivo}`);
      return falla('api', motivoLegible(res.status, f.motivo));
    }

    const j = (await res.json()) as {
      calendars?: Record<string, { busy?: Array<{ start?: string; end?: string }>; errors?: Array<{ reason?: string }> }>;
    };
    // Google devuelve el calendario bajo la clave que pediste ('primary'); tomamos
    // la primera entrada por si algún día responde con el email resuelto.
    const cal = j.calendars?.primary ?? Object.values(j.calendars ?? {})[0];

    // ⚠️ LA TRAMPA DE freeBusy: cuando el calendario trae `errors`, `busy` viene
    // VACÍO. Si no se chequea, la respuesta se lee como "el día entero está libre"
    // y el usuario agenda encima de otra reunión sin que nada avise. Un error tiene
    // que decir que NO SE PUDO LEER, nunca que está todo disponible.
    if (!cal || cal.errors?.length) {
      const razon = cal?.errors?.[0]?.reason ?? 'respuesta incompleta';
      console.error(`[google-calendar] freeBusy sin datos (${razon})`);
      return falla('api', `No pude leer tu agenda (${razon}): los horarios de abajo no están verificados.`);
    }

    const ocupados: Ocupado[] = (cal.busy ?? [])
      .map((b) => ({ ini: Date.parse(b.start ?? ''), fin: Date.parse(b.end ?? '') }))
      .filter((b) => Number.isFinite(b.ini) && Number.isFinite(b.fin) && b.fin > b.ini);

    const marcados = slots.map((s) => {
      const ini = Date.parse(s.inicioIso);
      const fin = ini + duracionMs;
      // El hueco sirve solo si la reunión entra ENTERA: se solapa si algo empieza
      // antes de que termine y termina después de que empieza.
      const choca = ocupados.some((b) => b.ini < fin && b.fin > ini);
      return { ...s, libre: !choca };
    });

    return { codigo: 'ok', motivo: '', slots: marcados, tz };
  } catch (e) {
    const msg = e instanceof Error && e.name === 'TimeoutError'
      ? 'Google no respondió a tiempo: los horarios de abajo no están verificados.'
      : 'No se pudo contactar a Google Calendar: los horarios de abajo no están verificados.';
    console.error('[google-calendar] horarios libres:', e);
    return falla('api', msg);
  }
}
