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
// 3. `event.location_configuration.kind` es obligatorio y tiene que ser una
//    ubicación CONFIGURADA en ese event type. Acá hay una trampa medida: los
//    event types del dueño declaran `locations: [{kind:'zoom_conference'}]` y la
//    API igual contesta «Specified location kind is not configured for this
//    event type» — para ese kind y para los otros once que se probaron. La
//    causa más probable es que la integración de Zoom en Calendly esté
//    desconectada o sin re-autorizar, y se arregla en el panel de Calendly, no
//    acá. Por eso el error de Calendly se devuelve TEXTUAL hasta el WhatsApp:
//    un «no se pudo agendar» genérico manda a buscar el problema al lugar
//    equivocado.
// =============================================================================

import { credWs } from './credenciales';
import { mismoEventType } from './calendly';

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
};

export type HuecoCalendly = {
  /** ISO UTC exacto. Es EL dato que se le pasa a `reservarReunion` sin tocar. */
  startIso: string;
};

async function headers(): Promise<Record<string, string>> {
  const token = await credWs('CALENDLY_API_TOKEN');
  if (!token) throw new CalendlyAgendaError('Este negocio no tiene el token de Calendly cargado (Configuraciones › Integraciones).');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
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

async function pedir<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: await headers(), cache: 'no-store' });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new CalendlyAgendaError(errorDeCalendly(res.status, body));
  return body as T;
}

/** El usuario de Calendly detrás del token (su URI hace falta para listar event types). */
async function usuarioUri(): Promise<string> {
  const r = await pedir<{ resource?: { uri?: string } }>(`${API}/users/me`);
  const uri = r.resource?.uri;
  if (!uri) throw new CalendlyAgendaError('Calendly no devolvió el usuario del token.');
  return uri;
}

/** Los event types ACTIVOS de la cuenta. */
export async function listarEventTypes(): Promise<EventTypeCalendly[]> {
  const user = await usuarioUri();
  const r = await pedir<{ collection?: Array<{ uri: string; name: string; duration: number; active: boolean; locations?: Array<{ kind?: string }> }> }>(
    `${API}/event_types?user=${encodeURIComponent(user)}&count=100`,
  );
  return (r.collection ?? [])
    .filter((e) => e.active)
    .map((e) => ({
      uri: e.uri,
      nombre: (e.name ?? '').trim(),
      duracionMin: e.duration,
      kinds: (e.locations ?? []).map((l) => l.kind).filter((k): k is string => Boolean(k)),
    }));
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
