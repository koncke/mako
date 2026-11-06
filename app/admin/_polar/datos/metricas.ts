// =============================================================================
// Las métricas de Admin, con el catálogo de Polar (utils/metrics.ts → METRIC_GROUPS) recortado a lo que MaKo mide
// =============================================================================
// Puro (sin server-only): lo usan los gráficos del navegador y los tests. Los valores salen de lib/admin-ingresos.ts
// (`vistaDeIngresos`), un renglón por mes; Polar elige el intervalo, MaKo mide por mes (no se inventa un día).
// Las de Polar que MaKo no puede llenar (net revenue, checkouts, churn rate, LTV, costos por evento…) no están: se
// anotan en docs/relevo/nube-admin-polar.md.

import type { Ingresos, MesIngresos } from '@/lib/admin-ingresos-reglas'
import type { Metric, ParsedMetricsResponse } from './polar-tipos'

export const METRICAS = {
  revenue: { slug: 'revenue', display_name: 'Revenue', type: 'currency' },
  cumulative_revenue: { slug: 'cumulative_revenue', display_name: 'Cumulative Revenue', type: 'currency' },
  monthly_recurring_revenue: { slug: 'monthly_recurring_revenue', display_name: 'Monthly Recurring Revenue', type: 'currency' },
  new_mrr: { slug: 'new_mrr', display_name: 'New MRR', type: 'currency' },
  expansion_mrr: { slug: 'expansion_mrr', display_name: 'Expansion MRR', type: 'currency' },
  contraction_mrr: { slug: 'contraction_mrr', display_name: 'Contraction MRR', type: 'currency' },
  churned_mrr: { slug: 'churned_mrr', display_name: 'Churned MRR', type: 'currency' },
  reactivated_mrr: { slug: 'reactivated_mrr', display_name: 'Reactivated MRR', type: 'currency' },
} as const satisfies Record<string, { slug: string; display_name: string; type: Metric['type'] }>

export type MetricaSlug = keyof typeof METRICAS

/** La descripción de cada una (la de Polar, en español, y de dónde sale en MaKo). */
export const DESCRIPCION: Record<MetricaSlug, string> = {
  revenue: 'Lo que entró en el período: cada pago registrado en el CRM de la plataforma o cobrado por la pasarela.',
  cumulative_revenue: 'Lo que entró desde el primer pago, sumado mes a mes.',
  monthly_recurring_revenue: 'Lo que pagan por mes las suscripciones vivas al cierre de cada mes.',
  new_mrr: 'El MRR que sumaron los clientes que empezaron a pagar ese mes.',
  expansion_mrr: 'Lo que subió el MRR de los clientes que ya pagaban.',
  contraction_mrr: 'Lo que bajó el MRR de los clientes que siguen pagando.',
  churned_mrr: 'El MRR de las suscripciones que se cortaron ese mes.',
  reactivated_mrr: 'El MRR de los clientes que volvieron a pagar después de cortar.',
}

export const aCentavos = (usd: number) => Math.round(usd * 100)

/** El primer día del mes «YYYY-MM» a medianoche local (como `fromISODate` de Polar). */
const inicioDeMes = (mes: string) => {
  const [y, m] = mes.split('-').map(Number)
  return new Date(y, m - 1, 1)
}

/** Los meses de la vista de ingresos → la respuesta de métricas de Polar (un período por mes, plata en centavos). */
export function metricasDeIngresos(meses: readonly MesIngresos[], vista: Pick<Ingresos, 'cobradoTotal'>): ParsedMetricsResponse {
  let acumulado = Math.max(0, vista.cobradoTotal - meses.reduce((s, m) => s + m.cobrado, 0))
  const periods = meses.map((m) => {
    acumulado += m.cobrado
    return {
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
  })
  const ultimo = meses[meses.length - 1]
  return {
    periods,
    totals: {
      revenue: aCentavos(meses.reduce((s, m) => s + m.cobrado, 0)),
      cumulative_revenue: aCentavos(vista.cobradoTotal),
      monthly_recurring_revenue: aCentavos(ultimo?.mrr ?? 0),
      new_mrr: aCentavos(meses.reduce((s, m) => s + m.nuevo, 0)),
      expansion_mrr: aCentavos(meses.reduce((s, m) => s + m.sube, 0)),
      contraction_mrr: aCentavos(meses.reduce((s, m) => s + m.baja, 0)),
      churned_mrr: aCentavos(meses.reduce((s, m) => s + m.corte, 0)),
      reactivated_mrr: aCentavos(meses.reduce((s, m) => s + m.vuelve, 0)),
    },
    metrics: METRICAS,
  }
}
