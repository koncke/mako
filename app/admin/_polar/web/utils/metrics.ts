// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/utils/metrics.ts. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.

import type { schemas } from '@/app/admin/_polar/datos/polar-tipos'
import { DESCRIPCION, METRICAS, type MetricaSlug } from '@/app/admin/_polar/datos/metricas'
import { formatCurrency } from '@/app/admin/_polar/lib/currency'
import {
  differenceInDays,
  differenceInMonths,
  differenceInWeeks,
  differenceInYears,
  parse,
} from 'date-fns'
import { formatCostAmount, formatPercentage, formatScalar } from './formatters'
import { armarCsv } from '@/lib/csv-celda'

/**
 * Converts a Date object to an ISO date string (YYYY-MM-DD) in local timezone.
 * Adjusts for timezone offset to ensure the local date is preserved.
 */
export const toISODate = (date: Date) => {
  // Offset the date by the timezone offset so that when converted to UTC,
  // we get the correct local date values
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return offsetDate.toISOString().split('T')[0]
}

/**
 * Parses an ISO date string (YYYY-MM-DD) to a Date object at midnight local time.
 * Uses a local reference date to avoid timezone issues.
 */
export const fromISODate = (date: string) =>
  parse(date, 'yyyy-MM-dd', new Date(1970, 0, 1, 0, 0, 0))

export const getFormattedMetricValue = (
  metric: schemas['Metric'],
  value: number,
): string => {
  switch (metric.type) {
    case 'scalar':
      return formatScalar(value)
    case 'currency':
      return formatCurrency('statistics')(value, 'usd')
    case 'percentage':
      return formatPercentage(value)
    case 'currency_sub_cent':
      return formatCostAmount(value)
  }
}

export const getTimestampFormatter = (
  interval: schemas['TimeInterval'],
  locale: string = 'en-US',
): ((value: Date) => string) => {
  switch (interval) {
    case 'hour':
      return (value: Date) =>
        value.toLocaleTimeString(locale, {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
    case 'day':
    case 'week':
      return (value: Date) =>
        value.toLocaleDateString(locale, {
          month: 'short',
          day: '2-digit',
        })
    case 'month':
      return (value: Date) =>
        value.toLocaleDateString(locale, {
          month: 'short',
          year: 'numeric',
        })
    case 'year':
      return (value: Date) =>
        value.toLocaleDateString(locale, {
          year: 'numeric',
        })
    default:
      return (value: Date) =>
        value.toLocaleDateString(locale, {
          month: 'short',
          day: '2-digit',
        })
  }
}

export const dateRangeToInterval = (startDate: Date, endDate: Date) => {
  const diffInYears = differenceInYears(endDate, startDate)
  const diffInMonths = differenceInMonths(endDate, startDate)
  const diffInWeeks = differenceInWeeks(endDate, startDate)
  const diffInDays = differenceInDays(endDate, startDate)

  if (diffInYears >= 3) {
    return 'year'
  } else if (diffInMonths >= 4) {
    return 'month'
  } else if (diffInWeeks > 4) {
    return 'week'
  } else if (diffInDays > 1) {
    return 'day'
  } else {
    return 'hour'
  }
}

export type ChartRange = 'all_time' | '12m' | '3m' | '30d' | 'today'

export const CHART_RANGES: Record<ChartRange, string> = {
  all_time: 'All Time',
  '12m': '12m',
  '3m': '3m',
  '30d': '30d',
  today: 'Today',
}

/**
 * El `getMetricsRangeDates` de @polar-sh/client: el principio y el fin de cada rango (todo el tiempo arranca en la fecha
 * de creación). MaKo mide por mes, así que los rangos se redondean al mes en la cuenta de los períodos.
 */
const getMetricsRangeDates = (range: ChartRange, { createdAt }: { createdAt: string | Date }): [Date, Date] => {
  const end = new Date()
  const start = new Date(end)
  if (range === 'all_time') return [new Date(createdAt), end]
  if (range === '12m') start.setMonth(start.getMonth() - 12)
  else if (range === '3m') start.setMonth(start.getMonth() - 3)
  else if (range === '30d') start.setDate(start.getDate() - 30)
  else start.setHours(0, 0, 0, 0)
  return [start, end]
}

export const getChartRangeParams = (
  range: ChartRange,
  createdAt: string | Date,
): [Date, Date, schemas['TimeInterval']] => {
  const [startDate, endDate] = getMetricsRangeDates(range, {
    createdAt,
  })
  const interval = dateRangeToInterval(startDate, endDate)
  return [startDate, endDate, interval]
}

export const getPreviousDateRange = (
  startDate: Date,
  endDate: Date,
): [Date, Date] => {
  const delta = endDate.getTime() - startDate.getTime()
  const previousEndDate = new Date(startDate.getTime())
  const previousStartDate = new Date(startDate.getTime() - delta)
  return [previousStartDate, previousEndDate]
}

// MaKo: las métricas de Polar que MaKo mide (app/admin/_polar/datos/metricas.ts). Las otras (net revenue, checkouts,
// committed/trial MRR, renewed, cancelaciones por motivo, churn rate, LTV, seats, usage…) no tienen un dato detrás: se sacaron
// (relevo, «se sacó»). Los grupos van en el orden de Polar; los de costos viven en Analytics › Costs, no acá.
export const DEFAULT_OVERVIEW_METRICS: MetricaSlug[] = ['revenue', 'monthly_recurring_revenue', 'cumulative_revenue']

type MetricEntry = {
  slug: keyof schemas['Metrics']
  display_name: string
  description: string
}

export type MetricGroup = {
  category: string
  metrics: MetricEntry[]
}

const entrada = (slug: MetricaSlug): MetricEntry => ({ slug, display_name: METRICAS[slug].display_name, description: DESCRIPCION[slug] })

export const METRIC_GROUPS: MetricGroup[] = [
  { category: 'Revenue', metrics: [entrada('revenue'), entrada('cumulative_revenue'), entrada('average_order_value')] },
  { category: 'Orders', metrics: [entrada('orders'), entrada('one_time_products'), entrada('one_time_products_revenue')] },
  {
    category: 'Subscriptions',
    metrics: [
      entrada('new_subscriptions'), entrada('active_subscriptions'), entrada('monthly_recurring_revenue'), entrada('new_mrr'),
      entrada('expansion_mrr'), entrada('contraction_mrr'), entrada('churned_mrr'), entrada('reactivated_mrr'),
    ],
  },
  { category: 'Cancellations', metrics: [entrada('churned_subscriptions')] },
  { category: 'Unit Economics', metrics: [entrada('average_revenue_per_user')] },
]

/**
 * MaKo: el «Export» de Polar baja `/v1/metrics/export`; acá el CSV se arma en el navegador con lo que la pantalla ya tiene,
 * por el único armador de CSV de la app (lib/csv-celda.ts: comillas y sin fórmulas). Una fila por período, una columna por
 * métrica, la plata en dólares.
 */
export const filasCsvDeMetricas = (
  data: { periods: ReadonlyArray<{ timestamp: Date } & Partial<Record<MetricaSlug, number | null>>> },
  slugs: readonly MetricaSlug[],
): (string | number | null)[][] => [
  ['Timestamp', ...slugs.map((s) => METRICAS[s].display_name)],
  ...data.periods.map((p) => [
    toISODate(p.timestamp),
    ...slugs.map((s) => {
      const v = p[s]
      if (v == null) return null
      return METRICAS[s].type === 'currency' || METRICAS[s].type === 'currency_sub_cent' ? v / 100 : v
    }),
  ]),
]

export const descargarCsv = (nombre: string, filas: (string | number | null)[][]) => {
  const blob = new Blob([armarCsv(filas)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  URL.revokeObjectURL(url)
}

export const ALL_METRICS = METRIC_GROUPS.flatMap((g) => g.metrics)

export const metricGroupSlug = (category: string): string =>
  category.toLowerCase().replace(/\s+/g, '-')

/**
 * MaKo: los grupos de Polar que tienen al menos una métrica medida, con sólo esas métricas (Analytics › Metrics). Es el
 * `RECURRING_ONLY_GROUPS` de Polar con la regla de MaKo: lo que no se midió no se dibuja, ni en cero ni vacío.
 */
export const gruposConDatos = (
  metrics: Partial<Record<MetricaSlug, unknown>>,
): { slug: string; title: string; metrics: MetricaSlug[] }[] =>
  METRIC_GROUPS.map((g) => ({
    slug: metricGroupSlug(g.category),
    title: g.category,
    metrics: g.metrics.map((m) => m.slug).filter((slug) => metrics[slug]),
  })).filter((g) => g.metrics.length > 0)
