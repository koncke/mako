import 'server-only';

// =============================================================================
// calendly-agenda — MaKo reserva la reunión de verdad (Scheduling API)
// =============================================================================
// Hasta acá Calendly era de una sola dirección: entraba el webhook cuando el
// lead reservaba solo. Esto es lo que faltaba para el caso que pidió el dueño:
// está saliendo de la R1, el lead dijo que sí, y en vez de mandarle un link y
// esperar a que lo abra, le escribe a MaKo por WhatsApp y la reunión queda.
//
// ── LO QUE HAY QUE SABER ANTES DE TOCAR ESTO ─────────────────────────────────
//
// 1. `POST /invitees` NO es la vieja API de Calendly. Es la Scheduling API, que
//    existe desde hace poco y EXIGE PLAN PAGO. Verificado en vivo contra la
//    cuenta del dueño (2026-08-11): el endpoint responde y el personal access
//    token alcanza — no hace falta armar una app OAuth.
//
// 2. `start_time` tiene que ser un hueco ABIERTO en ese momento. No hay
//    redondeo ni "el más cercano": si el slot no está exactamente disponible,
//    Calendly rechaza. Por eso nunca se reserva una hora inventada por el
//    modelo — se reserva uno de los `start_time` que devolvió `huecosDisponibles`,
//    tal cual (regla de la casa: un dato exacto no lo transporta un LLM).
//
// 3. ⚠️ HOY `POST /invitees` NO RESERVA, Y NO ES POR LO QUE MANDAMOS. Los event
//    types del dueño declaran `locations: [{kind:'zoom_conference'}]` y la API
//    contesta «Specified location kind is not configured for this event type».
//    Lo importante es CÓMO se descartó la hipótesis obvia: se probaron CINCO
//    formas del pedido —con el kind correcto, con los otros once kinds, con el
//    campo arriba de todo, en null, y OMITIDO POR COMPLETO— y las cinco dan el
//    MISMO error. Si el error no cambia cuando cambia lo que mandás, el problema
//    no es lo que mandás. Está reportado en la comunidad de desarrolladores de
//    Calendly para event types con videollamada. NO es «reconectar Zoom» —eso
//    fue el primer diagnóstico y era el equivocado—.
//
//    Por eso existe `linkParaAgendar`, que es la MISMA jugada que ya hace el CRM
//    (app/crm/calendly-widget.ts): el formulario de Calendly con el nombre y el
//    email prellenados. El popup del CRM funciona porque lo completa una PERSONA
//    en un navegador; el iframe es de Calendly y el server no lo puede enviar
//    por su cuenta. Mandar ese mismo formulario por WhatsApp deja la reserva a
//    un toque, y NO depende de que Calendly arregle nada.
//
//    El orden que usa el doer: intentar la reserva directa, y si Calendly la
//    rechaza, caer al link prellenado. El día que la arreglen, el agendado
//    directo empieza a funcionar solo, sin tocar una línea.
// =============================================================================

import { credWs } from './credenciales';
import { mismoEventType } from './calendly';
import { huellaDe } from './agenda-cache';

const API = 'https://api.calendly.com';

export class CalendlyAgendaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CalendlyAgendaError';
  }
}

export type EventTypeCalendly = {
  uri: string;
  nombre: string;
  duracionMin: number;
  /** Ubicaciones declaradas por el event type; la 1ª es la que se manda al reservar. */
  kinds: string[];
  /** La página pública de agenda (calendly.com/…): la base del link prellenado. */
  schedulingUrl: string;
};

export type HuecoCalendly = {
  /** ISO UTC exacto. Es EL dato que se le pasa a `reservarReunion` sin tocar. */
  startIso: string;
};

/** Con `token`, ése (23/10/2026: quien llama lo leyó, y con varias cuentas por proveedor elige cuál); sin él, el del negocio. */
async function headers(token?: string): Promise<Record<string, string>> {
  const t = token ?? await credWs('CALENDLY_API_TOKEN');
  if (!t) throw new CalendlyAgendaError('Este negocio no tiene el token de Calendly cargado (Configuraciones › Integraciones).');
  return { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' };
}

/**
 * Los errores de Calendly vienen como `{title, message, details:[{parameter,message}]}`.
 * Se arma UNA frase con todo: el `message` solo dice «The supplied parameters are
 * invalid», que no le sirve a nadie para saber qué parámetro.
 */
function errorDeCalendly(status: number, body: unknown): string {
  const b = body as { message?: string; title?: string; details?: Array<{ parameter?: string; message?: string }> } | null;
  const base = b?.message || b?.title || `HTTP ${status}`;
  const det = (b?.details ?? []).map((d) => [d.parameter, d.message].filter(Boolean).join(' ')).filter(Boolean);
  return det.length ? `${base} (${det.join('; ')})` : base;
}

async function pedir<T>(url: string, init?: RequestInit, token?: string): Promise<T> {
  const res = await fetch(url, { ...init, headers: await headers(token), cache: 'no-store' });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new CalendlyAgendaError(errorDeCalendly(res.status, body));
  return body as T;
}

/** El usuario de cada token, por su huella (23/10/2026): no cambia nunca, y pedirlo era un viaje más en fila antes de
 *  cada lista y de cada evento creado. En globalThis, como la caché de lib/credenciales.ts. */
const gCal = globalThis as typeof globalThis & { __makoCalendlyUsuario?: Map<string, string> };
const usuarios = (gCal.__makoCalendlyUsuario ??= new Map<string, string>());

/** El usuario de Calendly detrás del token (su URI hace falta para listar event types). */
async function usuarioUri(token?: string): Promise<string> {
  const huella = token ? huellaDe(token) : null;
  const ya = huella ? usuarios.get(huella) : undefined;
  if (ya) return ya;
  const r = await pedir<{ resource?: { uri?: string } }>(`${API}/users/me`, undefined, token);
  const uri = r.resource?.uri;
  if (!uri) throw new CalendlyAgendaError('Calendly no devolvió el usuario del token.');
  if (huella) {
    if (usuarios.size >= 200) usuarios.delete(usuarios.keys().next().value as string);
    usuarios.set(huella, uri);
  }
  return uri;
}

/** Los event types ACTIVOS de la cuenta del token (sin él, la del negocio: `eventTypeDeReunion` y `primerHuecoLibre`). */
export async function listarEventTypes(token?: string): Promise<EventTypeCalendly[]> {
  const user = await usuarioUri(token);
  const r = await pedir<{ collection?: Array<{ uri: string; name: string; duration: number; active: boolean; scheduling_url?: string; locations?: Array<{ kind?: string }> }> }>(
    `${API}/event_types?user=${encodeURIComponent(user)}&count=100`, undefined, token,
  );
  return (r.collection ?? [])
    .filter((e) => e.active)
    .map((e) => ({
      uri: e.uri,
      nombre: (e.name ?? '').trim(),
      duracionMin: e.duration,
      kinds: (e.locations ?? []).map((l) => l.kind).filter((k): k is string => Boolean(k)),
      schedulingUrl: e.scheduling_url ?? '',
    }));
}

// ── CREAR Y EDITAR un tipo de evento (21/10/2026) ───────────────────────────────────────────────
// Martín, 21/10/2026, sobre «Asignar evento»: «me gustaría que se pueda editar o crear eventos desde allí también».
// Calendly lo abrió el 17/06/2025 (community.calendly.com, «New Event Type management APIs»): `POST /event_types` y
// `PATCH /event_types/{uuid}`, SÓLO uno a uno, con los datos básicos (dueño, nombre, duración, ubicación, color…). Lo de
// la disponibilidad va aparte y no se toca acá: el evento nace con la de la cuenta.
// ⚠️ NO MEDIDO contra una cuenta real (21/10/2026): la forma sale del anuncio y de la referencia pública. Un token sin
// permiso de escritura contesta 403: el mensaje de Calendly llega entero (`errorDeCalendly`).

type EventTypeCrudo = { uri?: string; name?: string; duration?: number; active?: boolean; scheduling_url?: string; locations?: Array<{ kind?: string }> };

function eventTypeDe(e: EventTypeCrudo | undefined): EventTypeCalendly {
  if (!e?.uri) throw new CalendlyAgendaError('Calendly no devolvió el evento.');
  return {
    uri: e.uri, nombre: (e.name ?? '').trim(), duracionMin: Number(e.duration) || 0,
    kinds: (e.locations ?? []).map((l) => l.kind).filter((k): k is string => Boolean(k)),
    schedulingUrl: e.scheduling_url ?? '',
  };
}

/** Crea un tipo de evento uno a uno en la cuenta del token, ACTIVO (sin `active`, Calendly lo deja apagado). */
export async function crearEventTypeCalendly(token: string, i: { nombre: string; duracionMin: number }): Promise<EventTypeCalendly> {
  const owner = await usuarioUri(token);
  const r = await pedir<{ resource?: EventTypeCrudo }>(`${API}/event_types`, {
    method: 'POST', body: JSON.stringify({ owner, name: i.nombre, duration: i.duracionMin, active: true }),
  }, token);
  return eventTypeDe(r.resource);
}

/** El uuid de un event type, de su URI (la que se vincula). Un identificador cualquiera armaría otra ruta. */
function uuidDeCalendly(uri: string): string {
  const uuid = uri.trim().replace(/\/+$/, '').split('/').pop() ?? '';
  if (!/^[A-Za-z0-9-]{6,}$/.test(uuid)) throw new CalendlyAgendaError('Ese no es un evento de Calendly.');
  return uuid;
}

/**
 * Cambia un tipo de evento (por su URI): el nombre, la duración y, desde el 23/10/2026 (la edición completa), la
 * descripción y dónde es la reunión. ⚠️ El campo es `description`: `description_plain` es sólo de la respuesta.
 * `locations` reemplaza la lista entera.
 */
export async function editarEventTypeCalendly(token: string, uri: string, i: { nombre?: string; duracionMin?: number; descripcion?: string; locations?: Array<{ kind: string; location?: string }> }): Promise<EventTypeCalendly> {
  const uuid = uuidDeCalendly(uri);
  const cuerpo: Record<string, unknown> = {};
  if (i.nombre != null) cuerpo.name = i.nombre;
  if (i.duracionMin != null) cuerpo.duration = i.duracionMin;
  if (i.descripcion != null) cuerpo.description = i.descripcion;
  if (i.locations) cuerpo.locations = i.locations;
  const r = await pedir<{ resource?: EventTypeCrudo }>(`${API}/event_types/${uuid}`, { method: 'PATCH', body: JSON.stringify(cuerpo) }, token);
  return eventTypeDe(r.resource);
}

/** Lo que se edita de un tipo de evento además del nombre (23/10/2026): su descripción, dónde y sus preguntas (éstas,
 *  sólo para mostrarlas: la API de Calendly no deja cambiarlas). */
export async function detalleEventTypeCalendly(token: string, uri: string): Promise<{
  descripcion: string; locations: Array<{ kind?: string; location?: string }>;
  preguntas: Array<{ name?: string; position?: number; enabled?: boolean; required?: boolean }>;
}> {
  const r = await pedir<{ resource?: {
    description_plain?: string | null; locations?: Array<{ kind?: string; location?: string }> | null;
    custom_questions?: Array<{ name?: string; position?: number; enabled?: boolean; required?: boolean }> | null;
  } }>(`${API}/event_types/${uuidDeCalendly(uri)}`, undefined, token);
  const e = r.resource;
  if (!e) throw new CalendlyAgendaError('Calendly no devolvió el evento.');
  return { descripcion: (e.description_plain ?? '').trim(), locations: e.locations ?? [], preguntas: e.custom_questions ?? [] };
}

/**
 * A qué event type corresponde una R1 / R2 en ESTE workspace.
 *
 * Sale de `CALENDLY_EVENT_TYPE_J1` / `_J2`, que es la MISMA configuración con la
 * que el webhook clasifica lo que entra (`clasificarJunta`), comparada con el
 * MISMO matcher (`mismoEventType`). Si acá se resolviera distinto, MaKo
 * reservaría en un event type y el webhook clasificaría esa misma reunión como
 * la otra: el lead terminaría con la R2 escrita en el campo de la R1.
 */
export async function eventTypeDeReunion(tipo: 'R1' | 'R2'): Promise<EventTypeCalendly> {
  const configurado = await credWs(tipo === 'R1' ? 'CALENDLY_EVENT_TYPE_J1' : 'CALENDLY_EVENT_TYPE_J2');
  if (!configurado?.trim()) {
    throw new CalendlyAgendaError(`No está configurado el event type de la ${tipo} en Calendly (Configuraciones › Integraciones › Calendly).`);
  }
  const tipos = await listarEventTypes();
  const match = tipos.find((t) => mismoEventType(t.uri, configurado) || mismoEventType(t.nombre, configurado));
  if (!match) {
    throw new CalendlyAgendaError(
      `El event type de la ${tipo} está configurado como «${configurado}» y no coincide con ninguno activo de Calendly (${tipos.map((t) => t.nombre).join(' · ') || 'ninguno'}).`,
    );
  }
  return match;
}

/**
 * Los huecos REALES de un event type. Calendly topea la ventana en 31 días por
 * llamada y no acepta `start_time` en el pasado, así que el arranque se empuja
 * un minuto adelante: pedirle "desde ahora" con el reloj justo devuelve 400.
 */
export async function huecosDisponibles(
  eventTypeUri: string,
  opts: { desde?: Date; dias?: number } = {},
): Promise<HuecoCalendly[]> {
  const dias = Math.min(Math.max(opts.dias ?? 7, 1), 31);
  const desde = new Date(Math.max((opts.desde ?? new Date()).getTime(), Date.now() + 60_000));
  const hasta = new Date(desde.getTime() + dias * 86_400_000);
  const url = `${API}/event_type_available_times`
    + `?event_type=${encodeURIComponent(eventTypeUri)}`
    + `&start_time=${encodeURIComponent(desde.toISOString())}`
    + `&end_time=${encodeURIComponent(hasta.toISOString())}`;
  const r = await pedir<{ collection?: Array<{ start_time?: string; status?: string }> }>(url);
  return (r.collection ?? [])
    .filter((s) => s.status === 'available' && s.start_time)
    .map((s) => ({ startIso: s.start_time as string }));
}

/**
 * CON CUÁNTA ANTICIPACIÓN SE PUEDE AGENDAR HOY (16/10/2026, Martín: «si MaKo sabe por la API que el evento permite
 * agendar con poca anticipación (por ejemplo 3 h), el delay "1 día antes" lo advierte»).
 *
 * ⚠️ LA API DE CALENDLY NO PUBLICA LA «ANTICIPACIÓN MÍNIMA» de un event type (es un ajuste de la pantalla). Lo que sí
 * da son los huecos libres: el PRIMERO de cada event type activo dice con cuánto se puede agendar AHORA. Si hay uno en
 * 3 h, alguien puede agendar con 3 h. Es una MEDICIÓN (cambia con la agenda), y así se dice: «hay huecos a 3 h».
 * Devuelve el event type con el hueco más cercano, o null si ninguno tiene huecos en la semana.
 */
export async function primerHuecoLibre(ahoraMs = Date.now()): Promise<{ minutos: number; evento: string } | null> {
  let mejor: { minutos: number; evento: string } | null = null;
  for (const t of await listarEventTypes()) {
    const [primero] = await huecosDisponibles(t.uri, { dias: 7 });
    const ms = primero ? Date.parse(primero.startIso) : NaN;
    if (!Number.isFinite(ms)) continue;
    const minutos = Math.max(0, Math.round((ms - ahoraMs) / 60_000));
    if (!mejor || minutos < mejor.minutos) mejor = { minutos, evento: t.nombre };
  }
  return mejor;
}

/**
 * Un link de Calendly LISTO PARA TOCAR: el formulario con el nombre y el email
 * ya puestos, para que el otro solo elija horario y confirme.
 *
 * Es EXACTAMENTE lo que ya hace el CRM cuando movés un lead a R1/R2: abre el
 * popup de Calendly con `prefill: {name, email}` (app/crm/calendly-widget.ts).
 * Eso funciona porque lo completa una PERSONA en un navegador — el iframe es de
 * Calendly y no hay forma de que el server lo mande por su cuenta. Lo que se
 * puede hacer, y es lo que hace esto, es mandar ese mismo formulario por
 * WhatsApp para que se complete de un toque.
 *
 * `unUso: true` acuña además un link de un solo uso (`POST /scheduling_links`):
 * se quema al reservar, así que no queda dando vueltas en un chat.
 */
export async function linkParaAgendar(input: {
  eventType: EventTypeCalendly;
  invitado: { nombre?: string | null; email?: string | null };
  unUso?: boolean;
}): Promise<string> {
  const { eventType, invitado, unUso } = input;

  let base = eventType.schedulingUrl;
  if (unUso) {
    const r = await pedir<{ resource?: { booking_url?: string } }>(`${API}/scheduling_links`, {
      method: 'POST',
      body: JSON.stringify({ max_event_count: 1, owner: eventType.uri, owner_type: 'EventType' }),
    });
    // Si Calendly no devuelve el link de un solo uso, se cae al público: es
    // preferible un link que funciona a no mandar nada. Nunca al revés.
    base = r.resource?.booking_url || base;
  }
  if (!base) throw new CalendlyAgendaError('Calendly no devolvió la URL de agenda de ese tipo de reunión.');

  const q = new URLSearchParams();
  if (invitado.nombre?.trim()) q.set('name', invitado.nombre.trim());
  if (invitado.email?.trim()) q.set('email', invitado.email.trim());
  const qs = q.toString();
  return qs ? `${base}${base.includes('?') ? '&' : '?'}${qs}` : base;
}

export type ReservaHecha = {
  /** URI del scheduled_event creado, si Calendly lo devuelve. */
  eventUri: string | null;
  startIso: string;
  /** Link de la reunión (Zoom/Meet) cuando el event type lo genera. */
  joinUrl: string | null;
};

/**
 * Reserva de verdad. `startIso` tiene que ser uno de los `startIso` que devolvió
 * `huecosDisponibles` — no una hora reconstruida.
 */
export async function reservarReunion(input: {
  eventType: EventTypeCalendly;
  startIso: string;
  invitado: { email: string; nombre: string; timezone: string };
}): Promise<ReservaHecha> {
  const { eventType, startIso, invitado } = input;
  if (!invitado.email.trim()) throw new CalendlyAgendaError('El lead no tiene email cargado, y Calendly lo exige para reservar.');

  const body: Record<string, unknown> = {
    event_type: eventType.uri,
    start_time: startIso,
    invitee: { email: invitado.email.trim(), name: invitado.nombre.trim(), timezone: invitado.timezone },
  };
  // Se manda la ubicación que el PROPIO event type declara. Si Calendly la
  // rechaza (ver la nota 3 del encabezado), su error sube textual: es la única
  // pista de que hay que reconectar la integración del lado de Calendly.
  const kind = eventType.kinds[0];
  if (kind) body.event = { location_configuration: { kind } };

  const r = await pedir<{ resource?: { event?: string; uri?: string; event_details?: { location?: { join_url?: string } } } }>(
    `${API}/invitees`,
    { method: 'POST', body: JSON.stringify(body) },
  );
  return {
    eventUri: r.resource?.event ?? r.resource?.uri ?? null,
    startIso,
    joinUrl: r.resource?.event_details?.location?.join_url ?? null,
  };
}
