// =============================================================================
// format — formatters de pantalla compartidos
// =============================================================================
// Evita reescribir fmtUSD/fmtNum en cada página. Re-exporta fmtDDMMYYYY (fechas
// siempre dd/mm/aaaa). Módulo puro (Intl) → server y cliente.
// Nota: /marketing usa una variante de fmtUSD con decimales dinámicos (CPM/CPC),
// así que conserva la suya local.

export { fmtDDMMYYYY } from './date-utils';

/** Monto en USD, dólares enteros (la mayoría de los montos del dashboard). */
export function fmtUSD(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

/**
 * Un monto en su moneda, con el estilo de `fmtUSD` (Intl en-US): sin centavos desde 100 o si es entero, y con DOS decimales
 * si los tiene («$9.07», «$7.80», «$30», «$2,140»), para que un costo por lead y un gasto del mes se lean igual en la misma
 * pantalla. Una moneda que no es USD va con su símbolo («MX$1,250»). Lo pidió el Cerebro el 25/10/2026 al ver el Media
 * Buyer con dos formatos.
 */
export function fmtDinero(n: number | null | undefined, monedaDe?: string | null): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  // Sin moneda leída, dólares: es como la casa muestra la plata (fmtUSD). Quien la lee de Meta no pone su propio default.
  const moneda = monedaDe || 'USD';
  const dec = Math.abs(n) < 100 && !Number.isInteger(Math.round(n * 100) / 100) ? 2 : 0;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: moneda, minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n);
  } catch {
    return `${fmtNum(n)} ${moneda}`;
  }
}

/** Entero con separador de miles (es-MX). */
export function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('es-MX').format(Math.round(n));
}
