// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/analytics/costs/utils.ts. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: queda `fmtPct`. Los defaults del rango y `getCostsSearchParams` se sacaron: Costs mira un MES (`?mes=YYYY-MM`,
// lo que `resumenDelPeriodo` sabe leer), no un rango de días, y no se filtra por cliente (ver CostsPage.tsx).

export const fmtPct = (n: number) =>
  Math.abs(n).toLocaleString('es-AR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }) + '%'
