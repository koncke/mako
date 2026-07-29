// =============================================================================
// Helpers de fecha en zona America/Tijuana
// =============================================================================
// Toda la lógica de "ayer", "hoy", etc. del dashboard se ancla a Tijuana
// (donde vive Mauricio), NO a UTC ni a la zona del server. Razón: los crons
// corren en UTC en Vercel, pero la fecha "calendarizada" del negocio es TJ.

const TIJUANA = 'America/Tijuana';

/**
 * Fecha en una zona horaria arbitraria, formato 'YYYY-MM-DD'. Base multi-tenant:
 * cada workspace puede tener su propia zona (setting mako.timezone) — usá
 * tzDeWorkspace(ws) del lib/timezone para resolverla antes de llamar acá.
 */
export function hoyEnTz(tz: string, date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

/**
 * Devuelve la fecha actual en zona Tijuana, formato 'YYYY-MM-DD'.
 */
export function hoyEnTijuana(date: Date = new Date()): string {
  return hoyEnTz(TIJUANA, date);
}

/**
 * Describe en HORA LOCAL de una zona un horario de cron dado en UTC (los crons de
 * Vercel corren en UTC). Ej: (14, 10, 'America/Tijuana') → '7:10 a. m.' en verano
 * o '6:10 a. m.' en invierno (respeta DST real). Sirve para MOSTRAR cuándo dispara
 * una automatización sin clavar una hora que cambia con el horario de verano.
 */
export function horaCronEnTz(utcHour: number, utcMin: number, tz: string, date: Date = new Date()): string {
  // Anclamos el H:M UTC al día de hoy y lo formateamos en la zona destino.
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), utcHour, utcMin));
  return new Intl.DateTimeFormat('es-MX', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true }).format(d);
}

/**
 * Formatea una fecha 'YYYY-MM-DD' (o con timestamp) como dd/mm/aaaa para pantalla.
 * Convención del proyecto: TODA fecha de calendario visible va en dd/mm/aaaa.
 * Devuelve '—' si la entrada es nula/ inválida.
 */
/**
 * Momento legible en una zona: "mié 28 jul · 15:30". Para decirle a alguien CUÁNDO
 * pasó algo (una reunión, un envío) por WhatsApp o en pantalla.
 *
 * El `timeZone` es obligatorio a propósito: sin él, el server (UTC en Vercel) le
 * escribe al dueño una hora que no es la que él vivió. Resolvé la zona con
 * tzDeWorkspace(ws) antes de llamar.
 */
export function fechaHoraEnTz(iso: string | null | undefined, tz: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  try {
    const p = new Intl.DateTimeFormat('es-AR', {
      timeZone: tz, weekday: 'short', day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(d);
    const get = (t: string) => p.find((x) => x.type === t)?.value ?? '';
    const dia = get('weekday').replace('.', '');
    const mes = get('month').replace('.', '');
    return `${dia} ${get('day')} ${mes} · ${get('hour')}:${get('minute')}`;
  } catch { return ''; } // zona inválida → mejor sin fecha que con una hora mentirosa
}

export function fmtDDMMYYYY(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  if (!y || !m || !d) return '—';
  return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
}

/**
 * Devuelve la fecha de "ayer" en zona Tijuana, formato 'YYYY-MM-DD'.
 * Bulletproof contra DST: trabaja en calendar-day, no en deltas de horas.
 */
export function ayerEnTijuana(date: Date = new Date()): string {
  return diasAntes(hoyEnTijuana(date), 1);
}

/**
 * Devuelve la fecha N días antes de la dada (formato 'YYYY-MM-DD' → 'YYYY-MM-DD').
 * Opera en UTC para evitar issues de DST.
 */
export function diasAntes(fecha: string, n: number): string {
  const [y, m, d] = fecha.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - n);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * Valida que el string sea formato 'YYYY-MM-DD' y represente una fecha real.
 * Útil para sanitizar parámetros de query.
 */
export function esFechaValida(fecha: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const [y, m, d] = fecha.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

/**
 * Devuelve el LUNES de la semana que contiene la fecha dada.
 * Si la fecha es lunes, devuelve la misma fecha.
 */
export function lunesDeFecha(fecha: string): string {
  const [y, m, d] = fecha.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  // getUTCDay: 0=domingo, 1=lunes, ... 6=sábado
  const dia = dt.getUTCDay();
  const offset = dia === 0 ? 6 : dia - 1;
  return diasAntes(fecha, offset);
}

/**
 * Devuelve el primer día del mes que contiene la fecha dada.
 */
export function primerDiaDelMesDeFecha(fecha: string): string {
  const [y, m] = fecha.split('-').map(Number);
  const mm = String(m).padStart(2, '0');
  return `${y}-${mm}-01`;
}

/**
 * Devuelve el ÚLTIMO día del mes que contiene la fecha dada (YYYY-MM-DD).
 * Trabaja en UTC: el día 0 del mes siguiente es el último del mes actual.
 */
export function finDeMesDeFecha(fecha: string): string {
  const [y, m] = fecha.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m, 0));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * Devuelve el LUNES de la semana actual en zona Tijuana, formato 'YYYY-MM-DD'.
 * Si hoy es lunes, devuelve hoy.
 */
export function lunesActualEnTijuana(date: Date = new Date()): string {
  return lunesDeFecha(hoyEnTijuana(date));
}

/**
 * Devuelve el primer día del mes actual en zona Tijuana, formato 'YYYY-MM-DD'.
 */
export function primerDiaDelMesEnTijuana(date: Date = new Date()): string {
  return primerDiaDelMesDeFecha(hoyEnTijuana(date));
}
