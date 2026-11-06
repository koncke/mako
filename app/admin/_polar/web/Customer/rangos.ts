// Aviso de licencia (Apache-2.0): lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo (6/11/2026): las opciones del selector de rango de Customers y de la ficha de un negocio (el `CHART_RANGES` de Polar:
// All Time · 12m · 3m · 30d · Today). «Desde siempre» no entra en el teléfono: el selector medía ~290 px en un panel de ~240,
// la página se corría de costado, y con el rótulo en una línea seguía sin entrar. Va «Todo», el mismo rótulo que el selector
// del Overview (`ROTULO_RANGO.all_time`, app/admin/_polar/datos/resumen.ts): el mismo rango se llama igual en las dos
// pantallas. Lo demás, como en Polar. `CHART_RANGES` no se toca: lo usan las pantallas de Analytics.

import { ROTULO_RANGO } from '@/app/admin/_polar/datos/resumen'
import { CHART_RANGES, type ChartRange } from '@/app/admin/_polar/web/utils/metrics'

export const OPCIONES_DE_RANGO: ReadonlyArray<{ value: ChartRange; label: string }> = (
  Object.entries(CHART_RANGES) as [ChartRange, string][]
).map(([value, label]) => ({ value, label: value === 'all_time' ? ROTULO_RANGO.all_time : label }))
