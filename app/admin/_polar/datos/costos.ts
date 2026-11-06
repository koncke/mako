// =============================================================================
// Admin › Analytics › Costs: el gasto de IA de MaKo, con la pantalla de Costs de Polar (6/11/2026)
// =============================================================================
// Polar reparte el costo de sus eventos (`_cost.amount`) por tipo de evento, cliente, modelo y proveedor, y lo compara con
// el período anterior. MaKo tiene lo mismo, agregado, en lib/costos-ia.ts (`resumenDelPeriodo`): por FEATURE (lo que en
// Polar es el tipo de evento), por negocio, por modelo y por proveedor, de un MES (o de todo). Acá sólo las cuentas que
// arman lo que dibuja la vista; la lectura, en costos-server.ts.
//
// ⚠️ EL CORTE POR NEGOCIO NO SIEMPRE ES REAL (la cabecera de lib/costos-ia.ts): toda fila de Claude con la clave de MaKo se
//    anota en el workspace 1. Cuando el período tiene filas así (`atribuible: false`), «By Customer» NO se dibuja con
//    números: se dice por qué (`porNegocio: null`). Mostrarlo sería decir que un cliente gastó lo de todos.
// ⚠️ LO QUE NO ES DE MAKO NO ENTRA: lo pagado con la clave de Anthropic de un negocio y lo del crédito de los planes Max ya
//    vienen en 0 en `costUsd` (`costoDe`). Polar no tiene ese corte; se anota en el relevo.
// La plata va en CENTAVOS (como en Polar: `formatCurrency` divide por 100), y un costo de IA es de fracciones de centavo:
// no se redondea.
// Puro (sin server-only): lo usan la vista y los tests; el tipo de `resumenDelPeriodo` se importa sólo como tipo.
// =============================================================================

import type { Corte, ResumenPeriodo } from '@/lib/costos-ia'
import { METRICAS, totalesDe } from './metricas'
import type { ParsedMetricPeriod, ParsedMetricsResponse } from './polar-tipos'

/** Las métricas de costos de Polar que MaKo puede llenar (las de Polar sin `cost_per_user`, margen ni cashflow). */
export const COST_METRICS = ['costs', 'cumulative_costs'] as const

export type FilaCosto = {
  clave: string
  label: string
  llamadas: number
  /** En centavos. */
  costo: number
  /** Costo por llamada, en centavos. */
  promedio: number
  /** La parte del total del período (0 a 1). */
  share: number
  /** El costo del período anterior, en centavos (null = no hay período anterior para comparar). */
  previo: number | null
  delta: number
  /** El cambio contra el anterior, en %. null = no se puede (sin anterior, o el anterior en 0). */
  pct: number | null
  /** Sólo en el corte por negocio: a qué ficha lleva. */
  ws?: number
}

export type PeriodoCostos = { periodo: string; desde: string; hasta: string }

export type VistaCostos = {
  /** El mes que se mira (YYYY-MM). */
  periodo: string
  /** Los meses con datos, más nuevo primero (para el selector), con el mirado adentro. */
  meses: string[]
  desde: string
  hasta: string
  /** El mes anterior, si se pudo leer (para las comparaciones). */
  previo: PeriodoCostos | null
  metricas: ParsedMetricsResponse
  porFeature: FilaCosto[]
  /** Lo que más cambió contra el mes anterior (los 6 de Polar). Vacío sin mes anterior. */
  cambios: FilaCosto[]
  /** null = el corte por negocio no es real en este período (ver la cabecera). */
  porNegocio: FilaCosto[] | null
  porModelo: FilaCosto[]
  porProveedor: FilaCosto[]
  avisos: string[]
}

const centavos = (usd: number) => usd * 100

/** El mes anterior a «YYYY-MM». */
export function mesAnterior(mes: string): string {
  const [y, m] = mes.split('-').map(Number)
  return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7)
}

export const esMes = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s)

/** Los cortes con costo, ordenados por lo que gastaron, con su parte del total y su cambio contra el mes anterior. */
export function filasDe(
  actual: readonly Corte[],
  previo: readonly Corte[] | null,
  label: (clave: string) => string = (c) => c,
): FilaCosto[] {
  const antes = new Map((previo ?? []).map((c) => [c.clave, centavos(c.costUsd)]))
  const filas = actual.filter((c) => c.costUsd > 0)
  const suma = filas.reduce((s, c) => s + centavos(c.costUsd), 0) || 1
  return filas
    .map((c) => {
      const costo = centavos(c.costUsd)
      const prev = previo ? (antes.get(c.clave) ?? 0) : null
      const delta = prev == null ? 0 : costo - prev
      return {
        clave: c.clave,
        label: label(c.clave),
        llamadas: c.llamadas,
        costo,
        promedio: c.llamadas ? costo / c.llamadas : 0,
        share: costo / suma,
        previo: prev,
        delta,
        pct: prev != null && prev > 0 ? (delta / prev) * 100 : null,
      }
    })
    .sort((a, b) => b.costo - a.costo)
}

/**
 * «What changed» de Polar: lo que más se movió contra el mes anterior (de lo que gastó en éste, como en Polar: recorre los
 * totales del período actual). Sin mes anterior no hay cambios que mostrar.
 */
export function cambiosDe(actual: readonly Corte[], previo: readonly Corte[] | null, label: (clave: string) => string = (c) => c, n = 6): FilaCosto[] {
  if (!previo) return []
  const antes = new Map(previo.map((c) => [c.clave, centavos(c.costUsd)]))
  return actual
    .map((c) => {
      const costo = centavos(c.costUsd)
      const prev = antes.get(c.clave) ?? 0
      const delta = costo - prev
      return {
        clave: c.clave, label: label(c.clave), llamadas: c.llamadas, costo,
        promedio: c.llamadas ? costo / c.llamadas : 0, share: 0, previo: prev, delta,
        pct: prev > 0 ? (delta / prev) * 100 : null,
      }
    })
    .filter((f) => Math.abs(f.delta) > 0)
    .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta))
    .slice(0, n)
}

/** Los días del mes (UTC, como `porDia`) hasta `hoy` si es el mes en curso. */
export function diasDelMes(mes: string, hoy: Date): string[] {
  const [y, m] = mes.split('-').map(Number)
  const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const hoyIso = hoy.toISOString().slice(0, 10)
  const out: string[] = []
  for (let d = 1; d <= ultimo; d++) {
    const iso = `${mes}-${String(d).padStart(2, '0')}`
    if (iso > hoyIso) break
    out.push(iso)
  }
  return out
}

/** El gasto por día del mes, con el acumulado, en la forma de las métricas de Polar (`costs`, `cumulative_costs`). */
export function metricasDeCostos(porDia: readonly Corte[], mes: string, hoy: Date): ParsedMetricsResponse {
  const delDia = new Map(porDia.map((c) => [c.clave, centavos(c.costUsd)]))
  let acumulado = 0
  const periods: ParsedMetricPeriod[] = diasDelMes(mes, hoy).map((iso) => {
    const [y, mm, d] = iso.split('-').map(Number)
    const costo = delDia.get(iso) ?? 0
    acumulado += costo
    return { timestamp: new Date(y, mm - 1, d), costs: costo, cumulative_costs: acumulado }
  })
  const metrics: ParsedMetricsResponse['metrics'] = { costs: METRICAS.costs, cumulative_costs: METRICAS.cumulative_costs }
  return { periods, totals: totalesDe(periods, metrics), metrics }
}

/** Los cortes por negocio, sólo si son reales (ver la cabecera); los 5 de Polar. */
export function negociosDe(actual: ResumenPeriodo['porWorkspace'], nombres: Readonly<Record<number, string>>, n = 5): FilaCosto[] | null {
  if (actual.some((c) => !c.atribuible)) return null
  return filasDe(actual, null, (clave) => nombres[Number(clave)] ?? `Negocio ${clave}`)
    .slice(0, n)
    .map((f) => ({ ...f, ws: Number(f.clave) }))
}

const limites = (mes: string) => {
  const [y, m] = mes.split('-').map(Number)
  return { desde: new Date(Date.UTC(y, m - 1, 1)).toISOString(), hasta: new Date(Date.UTC(y, m, 1) - 1).toISOString() }
}

export function armarCostos(e: {
  periodo: string
  actual: ResumenPeriodo
  /** null = el mes anterior no se pudo leer (su aviso va en `avisos`). */
  previo: ResumenPeriodo | null
  nombres: Readonly<Record<number, string>>
  hoy: Date
  avisos: string[]
}): VistaCostos {
  const prev = e.previo
  const meses = [...new Set([e.periodo, ...e.actual.mesesDisponibles])].sort().reverse()
  return {
    periodo: e.periodo,
    meses,
    ...limites(e.periodo),
    previo: prev ? { periodo: mesAnterior(e.periodo), ...limites(mesAnterior(e.periodo)) } : null,
    metricas: metricasDeCostos(e.actual.porDia, e.periodo, e.hoy),
    porFeature: filasDe(e.actual.porFeature, prev?.porFeature ?? null),
    cambios: cambiosDe(e.actual.porFeature, prev?.porFeature ?? null),
    porNegocio: negociosDe(e.actual.porWorkspace, e.nombres),
    porModelo: filasDe(e.actual.porModelo, prev?.porModelo ?? null),
    porProveedor: filasDe(e.actual.porProveedor, prev?.porProveedor ?? null),
    avisos: e.avisos,
  }
}
