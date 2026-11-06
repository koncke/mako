// =============================================================================
// Los tipos de la API de Polar que usan sus componentes de MÉTRICAS, con lo que MaKo tiene para llenarlos
// =============================================================================
// Polar tipa sus componentes con `schemas[...]` de @polar-sh/client (su OpenAPI). Para los gráficos se conserva la MISMA
// forma (un período por timestamp con un valor por métrica, los totales y el catálogo de métricas), así MetricChartBox,
// MetricChart y GenericChart se portan sin tocar su lógica. Lo demás de `schemas` (Customer, Order, Subscription…) NO
// vive acá: cada sección arma su tipo con lo que MaKo de verdad tiene (app/admin/_polar/datos/<sección>.ts).
//
// ⚠️ LA PLATA VA EN CENTAVOS, como en Polar (`formatCurrency` divide por 100). MaKo guarda dólares: quien arma los
//    períodos multiplica por 100 (`aCentavos`).

import type { MetricaSlug } from './metricas'

export type TimeInterval = 'hour' | 'day' | 'week' | 'month' | 'year'
export type MetricType = 'scalar' | 'currency' | 'percentage' | 'currency_sub_cent'
export type Metric = { slug: MetricaSlug; display_name: string; type: MetricType }
export type MetricPeriod = { timestamp: string } & Partial<Record<MetricaSlug, number | null>>
export type MetricsTotals = Partial<Record<MetricaSlug, number | null>>

export type ParsedMetricPeriod = Omit<MetricPeriod, 'timestamp'> & { timestamp: Date }
export interface ParsedMetricsResponse {
  periods: ParsedMetricPeriod[]
  totals: MetricsTotals
  metrics: Partial<Record<MetricaSlug, Metric>>
}

/** La forma `schemas['…']` de Polar, para lo de métricas. */
export type schemas = {
  Metric: Metric
  Metrics: Record<MetricaSlug, Metric>
  TimeInterval: TimeInterval
  MetricPeriod: MetricPeriod
  MetricsTotals: MetricsTotals
}
