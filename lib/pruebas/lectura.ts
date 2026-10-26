// =============================================================================
// pruebas/lectura — las fechas de una lectura diaria (PURO, 25/10/2026)
// =============================================================================
// Las ventanas terminan AYER (diseño 2.8, el molde del Media Buyer): el cron lee una vez por día y nunca mira el día que
// corre. `hasta` es la medianoche UTC de hoy (las 21 h de ayer en Argentina): unas horas de corrimiento no cambian quién
// maduró con ventanas de días. El día de la prueba se cuenta desde que arrancó su época: editar una rama la reinicia.
// =============================================================================

import type { Asignacion } from './metricas';

const DIA_MS = 86_400_000;

/** La medianoche UTC de hoy: hasta ahí mira una lectura. */
export function finDeAyer(ahora: Date): string {
  return new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate())).toISOString();
}

/** El día de la prueba (1 el día que arrancó la época), contado hasta `hasta`. */
export function diaDeLaPrueba(desde: string | null, hasta: string): number {
  const d = desde ? Date.parse(desde) : NaN;
  const h = Date.parse(hasta);
  if (!Number.isFinite(d) || !Number.isFinite(h) || h < d) return 0;
  return Math.floor((h - d) / DIA_MS) + 1;
}

/** Las asignaciones que ya cumplieron su ventana: las únicas que se le piden al medidor. */
export function maduras(asignaciones: readonly Asignacion[], ventanaDias: number, hasta: string): Asignacion[] {
  const h = Date.parse(hasta);
  return asignaciones.filter((a) => {
    const d = Date.parse(a.asignadaAt);
    return Number.isFinite(d) && d + ventanaDias * DIA_MS <= h;
  });
}
