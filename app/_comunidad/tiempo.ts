// =============================================================================
// tiempo — las fechas y horas del calendario, EN LA ZONA DE QUIEN MIRA
// =============================================================================
// Skool muestra cada evento en la hora de quien lo mira (relevo, B.6: «4:00pm Los Angeles time»). Acá
// igual: la hora grande es la de este navegador, y si el evento se armó en otra zona, va al lado la del
// evento («17:00 en Bogota»), que es la que el equipo eligió y la que sale en el link de la llamada.
//
// ⚠️ SÓLO CORRE EN EL NAVEGADOR, DESPUÉS DE MONTAR: la zona del navegador no la sabe el server, así que
//    un texto armado allá y otro acá no coinciden al hidratar. El calendario se pide al abrir su pestaña
//    (nunca viene en el HTML), y por eso puede usar esto sin un reloj en `null` como el del feed.
//
// Sin 'use client' (son funciones, no un componente) y sin 'server-only': lo usan las piezas del
// calendario y de la campana.

/** La zona de este navegador (`America/Mexico_City`). Sin Intl, UTC. */
export function zonaDelNavegador(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

const formatos = new Map<string, Intl.DateTimeFormat>();
function fmt(zona: string, opciones: Intl.DateTimeFormatOptions, clave: string): Intl.DateTimeFormat {
  const k = `${zona}|${clave}`;
  let f = formatos.get(k);
  if (!f) {
    f = new Intl.DateTimeFormat('es', { ...opciones, timeZone: zona });
    formatos.set(k, f);
  }
  return f;
}

/** La fecha LOCAL (`YYYY-MM-DD`) de un instante en `zona`: la celda del mes donde cae. */
export function fechaEn(iso: string | number, zona: string): string {
  const f = fmt(zona, { year: 'numeric', month: '2-digit', day: '2-digit' }, 'ymd');
  const p: Record<string, string> = {};
  for (const x of f.formatToParts(new Date(iso))) p[x.type] = x.value;
  return `${p.year}-${p.month}-${p.day}`;
}

/** «18:00». */
export const horaEn = (iso: string | number, zona: string): string =>
  fmt(zona, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }, 'hm').format(new Date(iso));

/** «jueves, 15 de octubre». */
export const diaLargoEn = (iso: string | number, zona: string): string =>
  fmt(zona, { weekday: 'long', day: 'numeric', month: 'long' }, 'dl').format(new Date(iso));

/** «jue 15 oct». */
export const diaCortoEn = (iso: string | number, zona: string): string =>
  fmt(zona, { weekday: 'short', day: 'numeric', month: 'short' }, 'dc').format(new Date(iso)).replace(/\./g, '').replace(/,/g, '');

/** «octubre de 2026». */
export const mesTexto = (y: number, m: number): string =>
  new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1)));

/**
 * La primera letra en mayúscula: «jueves, 8 de octubre» → «Jueves, 8 de octubre». No con
 * `text-transform: capitalize`, que sube TODAS las palabras («Jueves, 8 De Octubre»).
 */
export const mayuscula = (s: string): string => (s ? s.charAt(0).toLocaleUpperCase('es') + s.slice(1) : s);

/** El nombre corto de una zona para leerlo: `America/Mexico_City` → «Mexico City». */
export const nombreDeZona = (zona: string): string => (zona.split('/').pop() ?? zona).replace(/_/g, ' ');

/** «1 h 30 min», «45 min», «24 h». */
export function duracionTexto(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Las zonas que conoce el navegador, para elegir la de un evento (la del navegador primero). */
export function zonasDisponibles(primera: string): string[] {
  let todas: string[] = [];
  try {
    todas = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? [];
  } catch {
    todas = [];
  }
  const lista = todas.length ? todas : [primera, 'UTC'];
  return [...new Set([primera, ...lista.filter((z) => z !== primera)])];
}

/** Hoy, como fecha local de `zona`. */
export const hoyEn = (zona: string): string => fechaEn(Date.now(), zona);

/** Suma días a una fecha `YYYY-MM-DD` (del calendario, sin zona). */
export function sumarDiasTexto(fecha: string, n: number): string {
  const [y, m, d] = fecha.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

/** El día de la semana de una fecha `YYYY-MM-DD` (0 = domingo). */
export function diaDeSemanaTexto(fecha: string): number {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
