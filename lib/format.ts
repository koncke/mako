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

/** Entero con separador de miles (es-MX). */
export function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('es-MX').format(Math.round(n));
}
