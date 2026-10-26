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
