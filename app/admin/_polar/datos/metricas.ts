// =============================================================================
// Las métricas de Admin, con el catálogo de Polar (utils/metrics.ts → METRIC_GROUPS) recortado a lo que MaKo mide
// =============================================================================
// Puro (sin server-only): lo usan los gráficos del navegador y los tests. Los valores salen de lib/admin-ingresos.ts
// (`vistaDeIngresos`), un renglón por mes; Polar elige el intervalo, MaKo mide por mes (no se inventa un día).
//
// LAS QUE SE SUMARON EL 6/11/2026 (Analytics › Metrics), cada una con una cuenta que sale de lo que la vista YA trae:
//   · orders, one_time_products, one_time_products_revenue, average_order_value → de `entradas` (cada pago que entró);
//   · new_subscriptions, active_subscriptions, churned_subscriptions, average_revenue_per_user → de `movimientos` (los
//     cambios del MRR de cada CLIENTE: un cliente con dos lugares cuenta una vez, como en el MRR de la vista).
//   Si quien llama no pasa `entradas` o `movimientos`, esas métricas NO salen (no van en cero: no se midieron).
//   · costs y cumulative_costs → el gasto de IA por día de Analytics › Costs (`metricasDeCostos`, datos/costos.ts).
//
// Las de Polar que MaKo no puede llenar (net revenue, checkouts, committed/trial MRR, renewed, cancelaciones por motivo,
// churn rate, LTV, cost per user, gross margin, cashflow, seats, usage…) no están: se anotan en docs/relevo/nube-admin-polar.md.
// =============================================================================

import type { Entrada, Ingresos, MesIngresos, Movimiento } from '@/lib/admin-ingresos-reglas'
import type { Metric, MetricsTotals, ParsedMetricPeriod, ParsedMetricsResponse } from './polar-tipos'

export const METRICAS = {
  revenue: { slug: 'revenue', display_name: 'Revenue', type: 'currency' },
  cumulative_revenue: { slug: 'cumulative_revenue', display_name: 'Cumulative Revenue', type: 'currency' },
  average_order_value: { slug: 'average_order_value', display_name: 'Average Order Value', type: 'currency' },
  orders: { slug: 'orders', display_name: 'Orders', type: 'scalar' },
  one_time_products: { slug: 'one_time_products', display_name: 'One-Time Products', type: 'scalar' },
  one_time_products_revenue: { slug: 'one_time_products_revenue', display_name: 'One-Time Products Revenue', type: 'currency' },
  new_subscriptions: { slug: 'new_subscriptions', display_name: 'New Subscriptions', type: 'scalar' },
  active_subscriptions: { slug: 'active_subscriptions', display_name: 'Active Subscriptions', type: 'scalar' },
  monthly_recurring_revenue: { slug: 'monthly_recurring_revenue', display_name: 'Monthly Recurring Revenue', type: 'currency' },
  new_mrr: { slug: 'new_mrr', display_name: 'New MRR', type: 'currency' },
  expansion_mrr: { slug: 'expansion_mrr', display_name: 'Expansion MRR', type: 'currency' },
  contraction_mrr: { slug: 'contraction_mrr', display_name: 'Contraction MRR', type: 'currency' },
  churned_mrr: { slug: 'churned_mrr', display_name: 'Churned MRR', type: 'currency' },
  reactivated_mrr: { slug: 'reactivated_mrr', display_name: 'Reactivated MRR', type: 'currency' },
  churned_subscriptions: { slug: 'churned_subscriptions', display_name: 'Churned Subscriptions', type: 'scalar' },
  average_revenue_per_user: { slug: 'average_revenue_per_user', display_name: 'Average Revenue Per User', type: 'currency' },
  costs: { slug: 'costs', display_name: 'Costs', type: 'currency_sub_cent' },
  cumulative_costs: { slug: 'cumulative_costs', display_name: 'Cumulative Costs', type: 'currency_sub_cent' },
} as const satisfies Record<string, { slug: string; display_name: string; type: Metric['type'] }>

export type MetricaSlug = keyof typeof METRICAS

/** La descripción de cada una (la de Polar, en español, y de dónde sale en MaKo). */
export const DESCRIPCION: Record<MetricaSlug, string> = {
  revenue: 'Lo que entró en el período: cada pago registrado en el CRM de la plataforma o cobrado por la pasarela.',
  cumulative_revenue: 'Lo que entró desde el primer pago, sumado mes a mes.',
  average_order_value: 'Lo que entró dividido por la cantidad de pagos.',
  orders: 'Los pagos que entraron, de una suscripción o no (los que no tienen su valor en dólares no cuentan).',
  one_time_products: 'Los pagos que no son de una suscripción: un pago único, una cuota de un plan por tramos.',
  one_time_products_revenue: 'Lo que entró por pagos que no son de una suscripción.',
  new_subscriptions: 'Los clientes que empezaron a pagar una suscripción ese mes.',
  active_subscriptions: 'Los clientes con una suscripción viva al cierre de cada mes (al día de hoy, el mes en curso).',
  monthly_recurring_revenue: 'Lo que pagan por mes las suscripciones vivas al cierre de cada mes.',
  new_mrr: 'El MRR que sumaron los clientes que empezaron a pagar ese mes.',
  expansion_mrr: 'Lo que subió el MRR de los clientes que ya pagaban.',
  contraction_mrr: 'Lo que bajó el MRR de los clientes que siguen pagando.',
  churned_mrr: 'El MRR de las suscripciones que se cortaron ese mes.',
  reactivated_mrr: 'El MRR de los clientes que volvieron a pagar después de cortar.',
  churned_subscriptions: 'Los clientes cuya suscripción se cortó ese mes (pasada la gracia sin pagar).',
  average_revenue_per_user: 'El MRR dividido por los clientes con una suscripción viva.',
  costs: 'Lo que MaKo gastó en IA, con sus propias claves (lo de la clave de un negocio y el crédito de los planes Max no entran).',
  cumulative_costs: 'El gasto de IA sumado día a día dentro del período.',
}

/**
 * Cómo se resume cada métrica para un período entero (lo que el cuadro muestra sin el cursor encima):
 * `flujo` se suma; `stock` es el valor del último período con dato; las dos razones se rehacen con sus sumas.
 */
export const RESUMEN: Record<MetricaSlug, 'flujo' | 'stock' | 'aov' | 'arpu'> = {
  revenue: 'flujo', cumulative_revenue: 'stock', average_order_value: 'aov', orders: 'flujo', one_time_products: 'flujo',
  one_time_products_revenue: 'flujo', new_subscriptions: 'flujo', active_subscriptions: 'stock', monthly_recurring_revenue: 'stock',
  new_mrr: 'flujo', expansion_mrr: 'flujo', contraction_mrr: 'flujo', churned_mrr: 'flujo', reactivated_mrr: 'flujo',
  churned_subscriptions: 'flujo', average_revenue_per_user: 'arpu', costs: 'flujo', cumulative_costs: 'stock',
}

export const aCentavos = (usd: number) => Math.round(usd * 100)

/** El primer día del mes «YYYY-MM» a medianoche local (como `fromISODate` de Polar). */
export const inicioDeMes = (mes: string) => {
  const [y, m] = mes.split('-').map(Number)
  return new Date(y, m - 1, 1)
}
/** El último instante del mes «YYYY-MM», hora local. */
export const finDeMes = (mes: string) => {
  const [y, m] = mes.split('-').map(Number)
  return new Date(y, m, 1, 0, 0, 0, -1)
}
/** El último día del mes «YYYY-MM» en ISO (YYYY-MM-DD). */
const ultimoDiaIso = (mes: string) => {
  const [y, m] = mes.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
}

/**
 * Cuántos clientes tenían una suscripción viva el día `fecha` (YYYY-MM-DD): los que en su último movimiento hasta ese
 * día quedaron con MRR. Es lo mismo que `mrrPorClienteEn(tramos, fecha).size` de las reglas, porque el MRR de un cliente
 * cambia SÓLO en las fechas de sus movimientos (`movimientosDe`).
 */
export function clientesConSuscripcionAl(movimientos: readonly Movimiento[], fecha: string): number {
  const ultimo = new Map<string, Movimiento>()
  for (const mv of movimientos) {
    if (mv.fecha > fecha) continue
    const antes = ultimo.get(mv.cliente)
    if (!antes || mv.fecha >= antes.fecha) ultimo.set(mv.cliente, mv)
  }
  let n = 0
  for (const mv of ultimo.values()) if (mv.despues > 0) n += 1
  return n
}

/** Los totales de unos períodos, con la regla de cada métrica (`RESUMEN`). Sólo las métricas de `metrics`. */
export function totalesDe(periods: readonly ParsedMetricPeriod[], metrics: ParsedMetricsResponse['metrics']): MetricsTotals {
  const out: MetricsTotals = {}
  const suma = (slug: MetricaSlug) => periods.reduce((s, p) => s + (p[slug] ?? 0), 0)
  for (const slug of Object.keys(metrics) as MetricaSlug[]) {
    const regla = RESUMEN[slug]
    if (regla === 'flujo') out[slug] = suma(slug)
    else if (regla === 'stock' || regla === 'arpu') {
      const con = periods.filter((p) => p[slug] != null)
      out[slug] = con.length ? (con[con.length - 1][slug] ?? null) : null
    } else {
      const pagos = suma('orders')
      out[slug] = pagos > 0 ? Math.round(suma('revenue') / pagos) : null
    }
  }
  return out
}

type VistaParaMetricas = Pick<Ingresos, 'cobradoTotal'> & Partial<Pick<Ingresos, 'entradas' | 'movimientos'>>

/**
 * Los meses de la vista de ingresos → la respuesta de métricas de Polar (un período por mes, plata en centavos).
 * Con `entradas` suma las de pagos y con `movimientos` las de suscripciones (ver la cabecera).
 */
export function metricasDeIngresos(meses: readonly MesIngresos[], vista: VistaParaMetricas): ParsedMetricsResponse {
  let acumulado = Math.max(0, vista.cobradoTotal - meses.reduce((s, m) => s + m.cobrado, 0))
  const entradas: readonly Entrada[] | null = vista.entradas ?? null
  const movimientos: readonly Movimiento[] | null = vista.movimientos ?? null
  const periods: ParsedMetricPeriod[] = meses.map((m) => {
    acumulado += m.cobrado
    const p: ParsedMetricPeriod = {
      timestamp: inicioDeMes(m.mes),
      revenue: aCentavos(m.cobrado),
      cumulative_revenue: aCentavos(acumulado),
      monthly_recurring_revenue: aCentavos(m.mrr),
      new_mrr: aCentavos(m.nuevo),
      expansion_mrr: aCentavos(m.sube),
      contraction_mrr: aCentavos(m.baja),
      churned_mrr: aCentavos(m.corte),
      reactivated_mrr: aCentavos(m.vuelve),
    }
    if (entradas) {
      const delMes = entradas.filter((e) => e.fecha.slice(0, 7) === m.mes && e.usd != null)
      const unicos = delMes.filter((e) => !e.recurrente)
      const cobrado = delMes.reduce((s, e) => s + (e.usd ?? 0), 0)
      p.orders = delMes.length
      p.one_time_products = unicos.length
      p.one_time_products_revenue = aCentavos(unicos.reduce((s, e) => s + (e.usd ?? 0), 0))
      p.average_order_value = delMes.length ? Math.round(aCentavos(cobrado) / delMes.length) : null
    }
    if (movimientos) {
      const delMes = movimientos.filter((mv) => mv.fecha.slice(0, 7) === m.mes)
      const activos = clientesConSuscripcionAl(movimientos, ultimoDiaIso(m.mes))
      p.new_subscriptions = delMes.filter((mv) => mv.tipo === 'nuevo').length
      p.churned_subscriptions = delMes.filter((mv) => mv.tipo === 'corte').length
      p.active_subscriptions = activos
      p.average_revenue_per_user = activos > 0 ? Math.round(aCentavos(m.mrr) / activos) : null
    }
    return p
  })
  const SIN_ENTRADAS: MetricaSlug[] = ['orders', 'one_time_products', 'one_time_products_revenue', 'average_order_value']
  const SIN_MOVIMIENTOS: MetricaSlug[] = ['new_subscriptions', 'churned_subscriptions', 'active_subscriptions', 'average_revenue_per_user']
  const COSTOS: MetricaSlug[] = ['costs', 'cumulative_costs']
  const metrics: ParsedMetricsResponse['metrics'] = {}
  for (const slug of Object.keys(METRICAS) as MetricaSlug[]) {
    if (COSTOS.includes(slug)) continue
    if (!entradas && SIN_ENTRADAS.includes(slug)) continue
    if (!movimientos && SIN_MOVIMIENTOS.includes(slug)) continue
    metrics[slug] = METRICAS[slug]
  }
  const totals = totalesDe(periods, metrics)
  // Lo acumulado de TODO el tiempo (no sólo de los meses leídos): es lo que pagaron desde el primer pago.
  totals.cumulative_revenue = aCentavos(vista.cobradoTotal)
  return { periods, totals, metrics }
}

/**
 * Los períodos que tocan el rango [desde, hasta] (un mes entra si alguna parte suya cae adentro: así reparte Polar con el
 * intervalo mensual), con los totales rehechos para ese rango.
 */
export function recortarMetricas(data: ParsedMetricsResponse, desde: Date, hasta: Date): ParsedMetricsResponse {
  const periods = data.periods.filter((p) => {
    const ini = p.timestamp
    const fin = new Date(ini.getFullYear(), ini.getMonth() + 1, 1, 0, 0, 0, -1)
    return ini.getTime() <= hasta.getTime() && fin.getTime() >= desde.getTime()
  })
  return { periods, totals: totalesDe(periods, data.metrics), metrics: data.metrics }
}

/** Un rango para elegir (la forma de `DateRangeInterval` de Polar). */
export type RangoPreset = { slug: string; label: string; value: [Date, Date] }

/**
 * Los rangos que un dato MENSUAL puede contestar, con los slugs de Polar (`dateRangeIntervals`) y alineados al mes: «Hoy»,
 * «Ayer» y «Esta semana» no van (mostrarían el mes entero como si fuera ese día), y uno que arranca antes del primer mes
 * leído (`minDate`) tampoco (diría «el año pasado» sobre un pedazo). El primero son todos los meses leídos.
 */
export function rangosMensuales(minDate: Date, hoy: Date, mesesLeidos: number): RangoPreset[] {
  const fin = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59, 999)
  const mes = (delta: number) => new Date(hoy.getFullYear(), hoy.getMonth() + delta, 1)
  const finDe = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 1, 0, 0, 0, -1)
  const anio = (delta: number) => new Date(hoy.getFullYear() + delta, 0, 1)
  const todos: RangoPreset[] = [
    { slug: 'allTime', label: `Últimos ${mesesLeidos} meses`, value: [minDate, fin] },
    { slug: 'thisMonth', label: 'Este mes', value: [mes(0), fin] },
    { slug: 'lastMonth', label: 'El mes pasado', value: [mes(-1), finDe(mes(-1))] },
    { slug: 'last3Months', label: 'Últimos 3 meses', value: [mes(-2), fin] },
    { slug: 'thisYear', label: 'Este año', value: [anio(0), fin] },
    { slug: 'lastYear', label: 'El año pasado', value: [anio(-1), new Date(hoy.getFullYear(), 0, 1, 0, 0, 0, -1)] },
  ]
  return todos.filter((r, i) => i === 0 || r.value[0].getTime() >= minDate.getTime())
}

/** Lo que Analytics › Metrics le pasa a su vista, armado desde la vista de ingresos (`vistaDeIngresos`). */
export type PropsDeMetricas = {
  data: ParsedMetricsResponse
  /** El primer día del primer mes leído (YYYY-MM-DD). */
  earliestDateISOString: string
  mesesLeidos: number
  avisos: string[]
}

export function propsDeMetricas(
  vista: Pick<Ingresos, 'cobradoTotal' | 'meses' | 'hoy'> & Partial<Pick<Ingresos, 'entradas' | 'movimientos'>> & { avisos?: string[] },
): PropsDeMetricas {
  const primero = vista.meses[0]?.mes ?? vista.hoy.slice(0, 7)
  return {
    data: metricasDeIngresos(vista.meses, vista),
    earliestDateISOString: `${primero}-01`,
    mesesLeidos: vista.meses.length,
    avisos: vista.avisos ?? [],
  }
}
