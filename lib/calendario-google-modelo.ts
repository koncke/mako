// =============================================================================
// calendario-google-modelo — lo que el Calendario de MaKo lee y escribe de Google Calendar, en puro
// =============================================================================
// Martín, 14/10/2026: «el calendario quiero que sea una copia fiel a Google Calendar, y que refleje todas las tareas y
// eventos que se tienen en google calendar». Decisiones del mismo día (no se re-preguntan):
//   · TODOS los calendarios de la cuenta conectada (no sólo el principal), cada uno con su color, y sus eventos.
//   · Las TAREAS de Google quedan para cuando Google apruebe la verificación de la app: piden un permiso nuevo
//     (`tasks.readonly`) que la verificación en revisión desde el 10/10 no incluye (docs/hallazgos-calendario.md).
//   · Lo que se crea, mueve o borra desde MaKo SE ESCRIBE EN GOOGLE, como en Google: en los calendarios donde la cuenta
//     tiene permiso de edición.
//
// ⚠️ LA AGENDA NO PASA POR LA IA (decisión del 07/10/2026): nada de este módulo viaja a un modelo. Lo lee la pantalla.
// ⚠️ UN DÍA COMPLETO DE GOOGLE TIENE EL FIN EXCLUSIVO: un evento del 14 dice `end.date = 15`. `fechaFin` guarda el
//    ÚLTIMO día incluido, que es lo que la grilla dibuja.
//
// Puro, sin `server-only`: lo importan la pantalla, el server (lib/calendario-google.ts) y el test.
// =============================================================================

/**
 * Los colores de un EVENTO en la web de Google Calendar (el `colorId` 1-11). Son los de la interfaz, no los de
 * `/colors` de la API (que devuelve la paleta vieja): lo que se copia es lo que la persona ve en Google.
 */
export const COLORES_EVENTO_GOOGLE: Readonly<Record<string, { nombre: string; hex: string }>> = {
  '1': { nombre: 'Lavanda', hex: '#7986cb' },
  '2': { nombre: 'Salvia', hex: '#33b679' },
  '3': { nombre: 'Uva', hex: '#8e24aa' },
  '4': { nombre: 'Flamenco', hex: '#e67c73' },
  '5': { nombre: 'Banana', hex: '#f6bf26' },
  '6': { nombre: 'Mandarina', hex: '#f4511e' },
  '7': { nombre: 'Pavo real', hex: '#039be5' },
  '8': { nombre: 'Grafito', hex: '#616161' },
  '9': { nombre: 'Arándano', hex: '#3f51b5' },
  '10': { nombre: 'Albahaca', hex: '#0b8043' },
  '11': { nombre: 'Tomate', hex: '#d50000' },
};

/** El color de un calendario sin color propio (el «Pavo real» de Google). */
export const COLOR_CALENDARIO_DEFECTO = '#039be5';

/** Un calendario de la cuenta de Google conectada. */
export type CalendarioGoogle = {
  id: string;
  nombre: string;
  /** El color de fondo con el que Google lo dibuja. */
  color: string;
  primario: boolean;
  /** Se pueden crear, mover y borrar eventos (rol `owner` o `writer`). */
  editable: boolean;
  /** Está tildado en Google (`selected`): arranca prendido. */
  seleccionado: boolean;
};

/** Un evento de Google, listo para dibujar. */
export type EventoGoogle = {
  id: string;
  calendarioId: string;
  titulo: string;
  /** El instante de inicio (ISO). Un día completo: el inicio de su primer día en la zona del negocio. */
  inicio: string;
  fin: string | null;
  diaCompleto: boolean;
  /** Día completo: el primer y el ÚLTIMO día incluidos ('YYYY-MM-DD'). */
  fecha: string | null;
  fechaFin: string | null;
  /** El color con que se dibuja: el del evento si lo tiene, si no el de su calendario. */
  color: string;
  colorId: string | null;
  ubicacion: string;
  descripcion: string;
  /** El link al evento en Google. */
  enlace: string | null;
  /** El link de la videollamada (Meet u otra). */
  videollamada: string | null;
  invitados: number;
  /** Quien lo organiza, si no es la cuenta conectada. */
  organizador: string | null;
  recurrente: boolean;
  /** La cuenta conectada dijo que no va: Google lo dibuja tachado. */
  rechazado: boolean;
  /** Se puede mover y borrar desde MaKo (el calendario es editable y lo organiza la cuenta). */
  editable: boolean;
};

/** El evento como lo devuelve la API, con lo único que se mira. */
export type EventoCrudoGoogle = {
  id?: string;
  summary?: string;
  status?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  colorId?: string;
  location?: string;
  description?: string;
  htmlLink?: string;
  hangoutLink?: string;
  conferenceData?: { entryPoints?: Array<{ entryPointType?: string; uri?: string }> };
  attendees?: Array<{ email?: string; self?: boolean; responseStatus?: string; resource?: boolean }>;
  organizer?: { email?: string; displayName?: string; self?: boolean };
  recurringEventId?: string;
  eventType?: string;
};

export type CalendarioCrudoGoogle = {
  id?: string;
  summary?: string;
  summaryOverride?: string;
  backgroundColor?: string;
  primary?: boolean;
  accessRole?: string;
  selected?: boolean;
  hidden?: boolean;
  deleted?: boolean;
};

/** Hasta dónde se lee la descripción de un evento (la de una invitación puede traer el HTML de una conferencia). */
export const TOPE_DESCRIPCION = 2000;

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const RE_HEX = /^#[0-9a-fA-F]{6}$/;

/** Un calendario de la lista de Google, saneado. null = no se dibuja (oculto, borrado o sin id). */
export function calendarioDeGoogle(c: CalendarioCrudoGoogle): CalendarioGoogle | null {
  if (!c.id || c.hidden || c.deleted) return null;
  const rol = c.accessRole ?? 'reader';
  return {
    id: c.id,
    nombre: (c.summaryOverride || c.summary || c.id).trim(),
    color: c.backgroundColor && RE_HEX.test(c.backgroundColor) ? c.backgroundColor.toLowerCase() : COLOR_CALENDARIO_DEFECTO,
    primario: !!c.primary,
    editable: rol === 'owner' || rol === 'writer',
    seleccionado: c.selected !== false,
  };
}

/** El orden de la lista «Mis calendarios» de Google: el principal primero, después los editables, por nombre. */
export function ordenarCalendarios(cs: readonly CalendarioGoogle[]): CalendarioGoogle[] {
  return [...cs].sort((a, b) =>
    a.primario !== b.primario ? (a.primario ? -1 : 1)
      : a.editable !== b.editable ? (a.editable ? -1 : 1)
        : a.nombre.localeCompare(b.nombre, 'es'));
}

/** Resta un día a 'YYYY-MM-DD'. */
function diaAnterior(fecha: string): string {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}

/**
 * Un evento de Google, saneado. `inicioDeDia(fecha)` convierte un día completo al instante de su comienzo en la zona
 * del negocio (lo da el server: este módulo no sabe de zonas). null = no se dibuja (cancelado o sin fecha).
 */
export function eventoDeGoogle(e: EventoCrudoGoogle, cal: CalendarioGoogle, inicioDeDia: (fecha: string) => string): EventoGoogle | null {
  if (!e.id || e.status === 'cancelled') return null;
  const diaCompleto = !e.start?.dateTime;
  let inicio: string;
  let fin: string | null = null;
  let fecha: string | null = null;
  let fechaFin: string | null = null;
  if (diaCompleto) {
    if (!e.start?.date || !RE_FECHA.test(e.start.date)) return null;
    fecha = e.start.date;
    // El fin de Google es EXCLUSIVO: el último día incluido es el anterior (y nunca antes del primero).
    const finExcl = e.end?.date && RE_FECHA.test(e.end.date) ? e.end.date : null;
    fechaFin = finExcl ? diaAnterior(finExcl) : fecha;
    if (fechaFin < fecha) fechaFin = fecha;
    inicio = inicioDeDia(fecha);
  } else {
    const t = Date.parse(e.start!.dateTime!);
    if (!Number.isFinite(t)) return null;
    inicio = new Date(t).toISOString();
    const tf = e.end?.dateTime ? Date.parse(e.end.dateTime) : NaN;
    fin = Number.isFinite(tf) && tf > t ? new Date(tf).toISOString() : null;
  }
  const yo = (e.attendees ?? []).find((a) => a.self);
  const organizaOtro = !!e.organizer && e.organizer.self === false;
  const meet = e.hangoutLink || e.conferenceData?.entryPoints?.find((p) => p.entryPointType === 'video')?.uri || null;
  const colorEvento = e.colorId && COLORES_EVENTO_GOOGLE[e.colorId] ? COLORES_EVENTO_GOOGLE[e.colorId].hex : null;
  return {
    id: e.id,
    calendarioId: cal.id,
    titulo: (e.summary ?? '').trim() || '(Sin título)',
    inicio, fin, diaCompleto, fecha, fechaFin,
    color: colorEvento ?? cal.color,
    colorId: colorEvento ? e.colorId! : null,
    ubicacion: (e.location ?? '').trim().slice(0, 300),
    descripcion: (e.description ?? '').trim().slice(0, TOPE_DESCRIPCION),
    enlace: e.htmlLink && /^https:\/\//.test(e.htmlLink) ? e.htmlLink : null,
    videollamada: meet && /^https:\/\//.test(meet) ? meet : null,
    invitados: (e.attendees ?? []).filter((a) => !a.resource).length,
    organizador: organizaOtro ? (e.organizer?.displayName || e.organizer?.email || null) : null,
    recurrente: !!e.recurringEventId,
    rechazado: yo?.responseStatus === 'declined',
    // Lo que organiza otra cuenta no se mueve desde acá (Google tampoco deja: lo cambia quien lo organiza).
    editable: cal.editable && !organizaOtro && (e.eventType ?? 'default') === 'default',
  };
}

// ── Lo que se escribe ─────────────────────────────────────────────────────────────────────────

/** Lo que manda la pantalla para crear o cambiar un evento de Google. */
export type EntradaEventoGoogle = {
  titulo: string;
  /** 'YYYY-MM-DD'. */
  fecha: string;
  /** 'HH:MM' en la zona del negocio. null = todo el día. */
  hora: string | null;
  /** Hasta qué día (día completo) o cuántos minutos dura (con hora). */
  fechaFin?: string | null;
  duracionMin?: number | null;
  descripcion?: string;
  ubicacion?: string;
  colorId?: string | null;
};

const RE_HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;
export const TOPE_TITULO_GOOGLE = 300;

/**
 * El cuerpo para la API de Google (POST o PATCH). La hora de pared viaja CON SU ZONA (`timeZone`): Google la convierte
 * él mismo, así un evento de las 10 queda a las 10 aunque cambie el horario de verano. ⚠️ En un texto que escribe una
 * PERSONA el tope rechaza, no recorta.
 */
export function cuerpoEventoGoogle(e: EntradaEventoGoogle, tz: string): { ok: true; cuerpo: Record<string, unknown> } | { ok: false; error: string } {
  const titulo = (e.titulo ?? '').replace(/\s+/g, ' ').trim();
  if (titulo.length > TOPE_TITULO_GOOGLE) return { ok: false, error: `El título tiene más de ${TOPE_TITULO_GOOGLE} caracteres.` };
  if (!RE_FECHA.test(e.fecha ?? '')) return { ok: false, error: 'La fecha no es válida.' };
  const descripcion = (e.descripcion ?? '').trim();
  if (descripcion.length > 8000) return { ok: false, error: 'La descripción es demasiado larga.' };
  const cuerpo: Record<string, unknown> = { summary: titulo || '(Sin título)' };
  if (e.descripcion !== undefined) cuerpo.description = descripcion;
  if (e.ubicacion !== undefined) cuerpo.location = (e.ubicacion ?? '').trim().slice(0, 300);
  if (e.colorId !== undefined) cuerpo.colorId = e.colorId && COLORES_EVENTO_GOOGLE[e.colorId] ? e.colorId : null;
  if (e.hora == null || e.hora === '') {
    const ultimo = e.fechaFin && RE_FECHA.test(e.fechaFin) && e.fechaFin >= e.fecha ? e.fechaFin : e.fecha;
    const [y, m, d] = ultimo.split('-').map(Number);
    const finExcl = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
    cuerpo.start = { date: e.fecha };
    cuerpo.end = { date: finExcl };
    return { ok: true, cuerpo };
  }
  const h = RE_HORA.exec(e.hora);
  if (!h) return { ok: false, error: 'La hora no es válida.' };
  const dur = e.duracionMin == null ? 60 : Math.round(Number(e.duracionMin));
  if (!Number.isFinite(dur) || dur < 5 || dur > 24 * 60 * 14) return { ok: false, error: 'La duración no es válida.' };
  const inicioLocal = `${e.fecha}T${e.hora}:00`;
  const [y, m, d] = e.fecha.split('-').map(Number);
  // El fin como hora de pared: sumar minutos sobre una fecha sin zona (UTC como reloj de pared) y volver a escribirla.
  const finPared = new Date(Date.UTC(y, m - 1, d, Number(h[1]), Number(h[2])) + dur * 60_000).toISOString().slice(0, 19);
  cuerpo.start = { dateTime: inicioLocal, timeZone: tz };
  cuerpo.end = { dateTime: finPared, timeZone: tz };
  return { ok: true, cuerpo };
}
