// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/utils/metrics.ts. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.

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

// MaKo: las métricas de Polar que MaKo mide (app/admin/_polar/datos/metricas.ts). Las otras (orders, checkouts,
// net revenue, churn rate, LTV, cancelaciones por motivo…) no tienen un dato detrás: se sacaron (relevo, «se sacó»).
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
  { category: 'Revenue', metrics: [entrada('revenue'), entrada('cumulative_revenue')] },
  {
    category: 'Subscriptions',
    metrics: [entrada('monthly_recurring_revenue'), entrada('new_mrr'), entrada('expansion_mrr'), entrada('contraction_mrr'), entrada('churned_mrr'), entrada('reactivated_mrr')],
  },
]

export const ALL_METRICS = METRIC_GROUPS.flatMap((g) => g.metrics)

export const metricGroupSlug = (category: string): string =>
  category.toLowerCase().replace(/\s+/g, '-')
