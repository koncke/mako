// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/analytics/costs/utils.ts. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: queda `fmtPct`. Los defaults del rango y `getCostsSearchParams` se sacaron: Costs mira un MES (`?mes=YYYY-MM`,
// lo que `resumenDelPeriodo` sabe leer), no un rango de días, y no se filtra por cliente (ver CostsPage.tsx).

import { formatCurrency } from '@/app/admin/_polar/lib/currency'

export const fmtPct = (n: number) =>
  Math.abs(n).toLocaleString('es-AR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }) + '%'

// MaKo (10/11/2026): plata en DÓLARES. El `formatCurrency` de Polar recibe CENTAVOS (divide por 100): pasarle dólares directo
// mostraba el fijo de US$438,25 como «US$ 4,38». Y el negativo lleva el signo menos tipográfico (U+2212), que no se separa
// del número al cortar la línea: con el guion común, una tarjeta angosta dejaba «-» solo arriba y «US$ 24,37» abajo.

const contable = formatCurrency('accounting')
export const fmtUsd = (dolares: number) =>
  contable(Math.round(dolares * 100), 'usd').replace(/^-/, '\u2212')
