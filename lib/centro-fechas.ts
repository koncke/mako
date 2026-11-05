// =============================================================================
// Las fechas y horas de la conversación del Ops Center, con el reloj de Argentina
// =============================================================================
// Las usan el hilo (app/admin/operaciones/Hilo.tsx: la hora de cada mensaje y la píldora del día) y el bloque del «Completado»
// (BloqueCompletado.tsx: cuándo terminó, 26/10/2026, Martín: «En "completado" falta la fecha y hora»). Una sola forma de
// decir cuándo en toda la conversación. PURO: sin nada del navegador.

const ZONA = 'America/Argentina/Buenos_Aires';

/** «10:52». */
export const horaAR = (t: number): string => new Date(t).toLocaleTimeString('es-AR', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** El día en Argentina (UTC−3), para comparar días. */
export const diaAR = (t: number): number => Math.floor((t - 3 * 3_600_000) / 86_400_000);

/** La píldora del día: «Hoy», «Ayer» o «25 oct». */
export function rotuloDia(t: number, ahora: number): string {
  const d = diaAR(ahora) - diaAR(t);
  if (d <= 0) return 'Hoy';
  if (d === 1) return 'Ayer';
  return new Date(t).toLocaleDateString('es-AR', { timeZone: ZONA, day: 'numeric', month: 'short' });
}

/** Cuándo, con fecha y hora: «Hoy · 12:30», «Ayer · 23:10», «25 oct · 10:52». */
export const cuandoAR = (t: number, ahora: number): string => `${rotuloDia(t, ahora)} · ${horaAR(t)}`;

/** Lo que tiene más de esto ya no es de hoy (5/11/2026, Martín: «Lo que tiene más de 48 horas se distingue de lo reciente»). */
export const VIEJA_MS = 48 * 3_600_000;

/** «hace 6 días», «hace 3 horas», «hace 20 minutos», «recién». */
export function haceAR(t: number, ahora: number): string {
  const ms = Math.max(0, ahora - t);
  const d = Math.floor(ms / 86_400_000);
  if (d >= 1) return d === 1 ? 'hace 1 día' : `hace ${d} días`;
  const h = Math.floor(ms / 3_600_000);
  if (h >= 1) return h === 1 ? 'hace 1 hora' : `hace ${h} horas`;
  const m = Math.floor(ms / 60_000);
  if (m < 1) return 'recién';
  return m === 1 ? 'hace 1 minuto' : `hace ${m} minutos`;
}

/** La fecha entera, para tener a mano: «jueves 30 de octubre de 2026, 14:20». */
export const fechaCompletaAR = (t: number): string =>
  `${new Date(t).toLocaleDateString('es-AR', { timeZone: ZONA, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}, ${horaAR(t)}`;

/**
 * Cuándo se hizo una pregunta o una decisión que espera a Martín (5/11/2026: le llegó una del 30/10 y no había cómo saber que era
 * vieja). `hace` va a la vista; `cuando` («30 oct, 10:52») al lado, para no tener que tocar nada; `completa` en el `title`; `vieja`
 * con más de 48 horas. null = la fecha no se puede leer (no se inventa una).
 */
export function edadDe(iso: string | null | undefined, ahora: number): { hace: string; cuando: string; completa: string; vieja: boolean; iso: string } | null {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return null;
  return { hace: haceAR(t, ahora), cuando: `${rotuloDia(t, ahora)}, ${horaAR(t)}`, completa: fechaCompletaAR(t), vieja: ahora - t > VIEJA_MS, iso: new Date(t).toISOString() };
}
