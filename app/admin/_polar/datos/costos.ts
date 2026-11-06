// =============================================================================
// Admin › Analytics › Costs: el gasto de IA de MaKo, con la pantalla de Costs de Polar (6/11/2026)
// =============================================================================
// Polar reparte el costo de sus eventos (`_cost.amount`) por tipo de evento, cliente, modelo y proveedor, y lo compara con
// el período anterior. MaKo tiene lo mismo, agregado, en lib/costos-ia.ts (`resumenDelPeriodo`): por FEATURE (lo que en
// Polar es el tipo de evento), por modelo y por proveedor, de un MES (o de todo). Acá sólo las cuentas que arman lo que
// dibuja la vista; la lectura, en costos-server.ts.
//
// ⚠️ SIN EL CORTE POR NEGOCIO (6/11/2026): el gasto de IA de cada negocio vive en UN lugar, Customers › Cost Drivers (donde lo
//    puso Martín; app/admin/_polar/datos/clientes.ts `costosPorCliente`). El «By Customer» de Polar en Costs era la misma
//    lista dos veces y se sacó.
// ⚠️ LO QUE NO ES DE MAKO NO ENTRA: lo pagado con la clave de Anthropic de un negocio y lo del crédito de los planes Max ya
//    vienen en 0 en `costUsd` (`costoDe`). Polar no tiene ese corte; se anota en el relevo.
// La plata va en CENTAVOS (como en Polar: `formatCurrency` divide por 100), y un costo de IA es de fracciones de centavo:
// no se redondea.
// ⚠️ NINGÚN `Date` VIAJA DEL SERVER (punto 5 de la revisión del 6/11/2026): el server corre en UTC y el navegador en la hora
//    de quien mira, y un día armado allá se dibujaba como el día anterior. `VistaCostos` lleva el mes, los días y «hoy» como
//    TEXTO; el gráfico (`metricasDeCostos`) y las fechas de las comparaciones (`rangoDelMes`) se arman en la vista.
// AI MARGIN (punto 12): arriba del gráfico, lo cobrado del mes (la misma suma que Revenue) y su margen contra el gasto de IA.
//    Sólo resta la IA pagada por API con las claves de MaKo: ni los planes Max (su uso se anota en 0) ni la infraestructura.
//    Por eso se llama «AI margin» y no «Gross margin», que espera a que se puedan cargar los costos fijos.
// Puro (sin server-only): lo usan la vista y los tests; el tipo de `resumenDelPeriodo` se importa sólo como tipo.
// =============================================================================

import type { Corte, ResumenPeriodo } from '@/lib/costos-ia'
import { aCentavos, finDeMes, inicioDeMes, METRICAS, totalesDe } from './metricas'
import { margenPorcentaje } from './resumen'
import type { ParsedMetricPeriod, ParsedMetricsResponse } from './polar-tipos'

/**
 * Las métricas de costos de Polar que MaKo puede llenar como gráfico (las de Polar sin `cost_per_user` ni cashflow). El
 * margen no es un gráfico: va arriba, en su tarjeta («AI margin», `margenDelMes`).
 */
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
}

export type PeriodoCostos = { periodo: string }

/**
 * Lo cobrado del mes y su margen contra el gasto de IA (la tarjeta «AI margin»). `cobradoCentavos` null = los ingresos no se
 * pudieron leer (su aviso va en `avisos`); `margen` null = sin cobros, o sin ninguna fila de gasto ese mes (un 100% sería
 * inventado: `margenBruto`, ./resumen.ts).
 */
export type MargenDelMes = { cobradoCentavos: number | null; margen: number | null }

export type VistaCostos = {
  /** El mes que se mira (YYYY-MM). */
  periodo: string
  /** Los meses con datos, más nuevo primero (para el selector), con el mirado adentro. */
  meses: string[]
  /** El día de hoy del server (YYYY-MM-DD, UTC como `porDia`): el gráfico del mes en curso llega hasta acá. */
  hoy: string
  /** El gasto de cada día del mes (YYYY-MM-DD, UTC): el gráfico lo arma la vista (`metricasDeCostos`). */
  porDia: Corte[]
  /** El mes anterior, si se pudo leer (para las comparaciones). */
  previo: PeriodoCostos | null
  /** Lo cobrado del mes y el «AI margin». */
  margen: MargenDelMes
  porFeature: FilaCosto[]
  /** Lo que más cambió contra el mes anterior (los 6 de Polar). Vacío sin mes anterior. */
  cambios: FilaCosto[]
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

/** Los días del mes (UTC, como `porDia`) hasta `hoy` (YYYY-MM-DD) si es el mes en curso. */
export function diasDelMes(mes: string, hoyIso: string): string[] {
  const [y, m] = mes.split('-').map(Number)
  const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const out: string[] = []
  for (let d = 1; d <= ultimo; d++) {
    const iso = `${mes}-${String(d).padStart(2, '0')}`
    if (iso > hoyIso) break
    out.push(iso)
  }
  return out
}

/**
 * El gasto por día del mes, con el acumulado, en la forma de las métricas de Polar (`costs`, `cumulative_costs`). Cada día es la
 * medianoche LOCAL de su fecha: se llama en el NAVEGADOR (CostsPage), así el «2 nov» se dibuja «2 nov» en la hora de quien mira.
 */
export function metricasDeCostos(porDia: readonly Corte[], mes: string, hoy: string): ParsedMetricsResponse {
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

/** El primer y el último instante del mes «YYYY-MM» en la hora LOCAL (las fechas de las comparaciones). Sólo en el navegador. */
export const rangoDelMes = (mes: string): { from: Date; to: Date } => ({ from: inicioDeMes(mes), to: finDeMes(mes) })

/**
 * Lo que entró en el mes «YYYY-MM», en dólares: los pagos con su valor en dólares, la misma suma que `meses[].cobrado` de la
 * vista de ingresos (el widget Revenue), pero para cualquier mes (esa vista trae los últimos 12).
 */
export function cobradoDelMes(entradas: ReadonlyArray<{ fecha: string; usd: number | null }>, mes: string): number {
  return entradas.reduce((s, e) => (e.fecha.slice(0, 7) === mes && e.usd != null ? s + e.usd : s), 0)
}

/**
 * Lo cobrado del mes (la misma suma que Revenue) contra el gasto de IA del mes.
 * `cobrado` null = los ingresos no se pudieron leer. Un mes sin ninguna fila de gasto no tiene margen (`filas === 0`).
 */
export function margenDelMes(cobrado: number | null, gasto: Pick<ResumenPeriodo, 'costUsd' | 'filas'>): MargenDelMes {
  if (cobrado == null) return { cobradoCentavos: null, margen: null }
  const cobradoCentavos = aCentavos(cobrado)
  return { cobradoCentavos, margen: margenPorcentaje(cobradoCentavos, gasto.filas > 0 ? gasto.costUsd * 100 : null) }
}

export function armarCostos(e: {
  periodo: string
  actual: ResumenPeriodo
  /** null = el mes anterior no se pudo leer (su aviso va en `avisos`). */
  previo: ResumenPeriodo | null
  /** YYYY-MM-DD (UTC, como `porDia`). */
  hoy: string
  /** Los meses con datos (`mesesConDatos`, lib/costos-ia.ts), leídos UNA vez para el selector. */
  mesesConDatos: readonly string[]
  /** Lo cobrado en el mes, en dólares. null = no se pudo leer (su aviso va en `avisos`). */
  cobrado: number | null
  avisos: string[]
}): VistaCostos {
  const prev = e.previo
  const meses = [...new Set([e.periodo, ...e.mesesConDatos])].sort().reverse()
  return {
    periodo: e.periodo,
    meses,
    hoy: e.hoy,
    porDia: e.actual.porDia,
    previo: prev ? { periodo: mesAnterior(e.periodo) } : null,
    margen: margenDelMes(e.cobrado, e.actual),
    porFeature: filasDe(e.actual.porFeature, prev?.porFeature ?? null),
    cambios: cambiosDe(e.actual.porFeature, prev?.porFeature ?? null),
    porModelo: filasDe(e.actual.porModelo, prev?.porModelo ?? null),
    porProveedor: filasDe(e.actual.porProveedor, prev?.porProveedor ?? null),
    avisos: e.avisos,
  }
}
