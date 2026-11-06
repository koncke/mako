// =============================================================================
// Overview de Admin (la portada del dashboard de Polar, `(home)/DashboardPage.tsx`) con lo que MaKo tiene para llenarla
// =============================================================================
// Puro (sin server-only): lo usan la vista del navegador (app/admin/_polar/web/DashboardOverview), los datos de ejemplo y
// los tests. La lectura de la base, en ./resumen-server.ts. De dónde sale cada widget:
//   · Revenue y la sección Metrics: lib/admin-ingresos.ts (`vistaDeIngresos`), lo que ENTRÓ por mes. Overview y
//     Analytics › Metrics son los ÚNICOS lugares con el gráfico de ingresos (Martín, 6/11/2026).
//   · Activity: los pagos que entraron (la misma vista) y lo que hizo MaKo (lib/actividad.ts, `vistaDeActividad`).
//   · Top Customers: los que más pagaron desde el primer pago (los clientes de `vistaDeIngresos`).
//   · At Risk: LA MISMA lista que Customers › At Risk (`vistaDeAtRisk` de ./clientes.ts): atrasados, cobros fallidos,
//     pausados, los que dejaron de pagar y los sin uso, sin los clientes de una agencia (revisión del Cerebro, 6/11/2026,
//     punto 7: la tarjeta tenía su propia cuenta y escondía a los atrasados).
//   · Por cobrar (el «Available balance» de Polar, decidido 6/11/2026): los próximos cobros de `vistaDeIngresos().porCobrar`
//     (lo atrasado y lo que vence en los próximos 31 días, con la historia mes a mes de cada suscripción). No se recalcula.
//   · AI margin (el «Gross margin» de Polar, con otro nombre: sólo resta la IA pagada por API, ni los planes Max ni la
//     infraestructura; revisión del Cerebro, puntos 12 y 39): lo cobrado (lo mismo que suma Revenue) contra el gasto de IA que
//     paga MaKo (lib/costos-ia.ts, el mismo `costoDe` que Analytics › Costs), de los últimos 30 días y de cada mes de antes.
//   · Lo que ESPERA a Martín (arriba de los widgets, donde Polar avisa las disputas por responder): un contracargo abierto
//     (`disputasDe` de ./ventas.ts, puntos 28 y 38), quién pidió eliminar su cuenta (lib/baja-cuenta.ts), qué pidieron las
//     agencias (lib/agencia.ts) y quién pidió entrar (lib/pedidos-ingreso.ts). Una lista, una fila por espera.
//
// ⚠️ LA PLATA VA EN CENTAVOS, como en Polar (`formatCurrency` divide por 100). MaKo guarda dólares: se multiplica acá.
// ⚠️ «NO PUDE LEER» ES OTRO ESTADO: cada lectura viaja como `Lectura` y la vista dice el error, nunca un cero.

import { diaTxt, type Entrada, type MesIngresos, type Movimiento, type PorCobrar } from '@/lib/admin-ingresos-reglas'
import type { Corte } from '@/lib/costos-ia'
import { diasQueQuedan, fechaDeLaBaja } from '@/lib/baja-cuenta-reglas'
import { textoContracargo } from '@/lib/cobros-reglas'
import { detalleDelPedido } from '@/lib/pedidos-ingreso-reglas'
import { ROTULO_ROL, type RolAlta } from '@/lib/agencia-altas'
import { ALL_METRICS } from '@/app/admin/_polar/web/utils/metrics'
import type { MetricaSlug } from './metricas'
import type { PlanAlta } from './alta'
import { leadDeClave, rutaDeQuienPaga, type ClienteEnRiesgo, type PropsAtRisk } from './clientes'
import type { DisputaVenta } from './ventas'

/** Lo que leyó el server: los datos, o por qué no se pudo. */
export type Lectura<T> = { ok: true; datos: T } | { ok: false; error: string }

export const aCentavos = (usd: number) => Math.round(usd * 100)

// ── Los links viejos (/admin?tab=…) ────────────────────────────────────────────────────────────────────────────────
// /admin?tab=… viaja en mails ya mandados, en marcadores y en otras pantallas (lib/pedidos-ingreso-reglas.ts,
// `destinoDeCustomers` de app/customers/destino.ts). La portada lo manda a su sección nueva ANTES de leer nada.

export const ID_WS = /^[1-9]\d{0,11}$/

type Param = string | string[] | undefined
const uno = (v: Param): string | undefined => (Array.isArray(v) ? v[0] : v)

/**
 * A dónde va un `/admin?tab=…` viejo. `null` = no es un link viejo: se dibuja Overview.
 * ⚠️ `accounts` era un contrato de la Admin vieja (app/admin/pestanas-reglas.ts: «Su `?tab=accounts` se queda: lo nombran los
 *    mails de "Quieren entrar"»). Sin negocio, es el link de esos mails: los pedidos viven en Overview, arriba de los widgets, y
 *    no en Customers (revisión del Cerebro del 6/11/2026, punto 34). Con un negocio nombrado va a su ficha: por `cuenta` (el
 *    «Administrar» de la ficha vieja) o por `ws` (los avisos de plan a mano, `linkApp('/admin?tab=accounts', ws)`). El `ws`
 *    sólo arma el destino: la ficha vuelve a preguntar por el super admin.
 */
export function destinoDeTabViejo(sp: { tab?: Param; cliente?: Param; cuenta?: Param; ws?: Param }): string | null {
  const tab = uno(sp.tab)
  const ws = (v: Param) => {
    const s = uno(v)
    return s && ID_WS.test(s) ? s : null
  }
  switch (tab) {
    case 'revenue':
      return '/admin/analytics/metrics'
    case 'users':
      return '/admin/customers'
    case 'customers': {
      const n = ws(sp.cliente)
      return n ? `/admin/customers/${n}` : '/admin/customers'
    }
    case 'accounts': {
      const n = ws(sp.cuenta) ?? ws(sp.ws)
      return n ? `/admin/customers/${n}` : '/admin'
    }
    case 'billing':
      return '/admin/sales'
    case 'activity':
      return '/admin/analytics/events'
    case 'agents':
      return '/admin/analytics/events?tipo=agente'
    case 'errors':
      return '/admin/analytics/events?tipo=error'
    default:
      return null
  }
}

// ── Los ingresos (Revenue y la sección Metrics) ───────────────────────────────────────────────────────────────────

export type IngresosResumen = {
  /** YYYY-MM-DD, el día de la plataforma. */
  hoy: string
  /** Los últimos meses, el más viejo primero (lib/admin-ingresos-reglas.ts, `mesesDe`). */
  meses: MesIngresos[]
  /** Lo que entró desde siempre, en dólares (de ahí arranca el acumulado). */
  cobradoTotal: number
  /** YYYY-MM-DD del primer pago que entró. `null` = todavía ninguno. */
  primerPago: string | null
  /** Cada pago y cada movimiento de una suscripción: con ellos `metricasDeIngresos` llena las mismas métricas que
   *  Analytics › Metrics (pagos, ticket promedio, suscripciones), y Customize de Overview puede ofrecer todas. */
  entradas: Entrada[]
  movimientos: Movimiento[]
}

/**
 * Los rangos de Polar (`CHART_RANGES`) que MaKo puede contestar: mide POR MES, así que «30d» y «Today» no tienen un dato
 * detrás y no se ofrecen. «Todo» sólo si el primer pago cae adentro de los meses leídos (si no, sería «12m» con otro nombre).
 */
export const RANGOS_OVERVIEW = ['all_time', '12m', '3m'] as const
export type RangoOverview = (typeof RANGOS_OVERVIEW)[number]
export const ROTULO_RANGO: Record<RangoOverview, string> = { all_time: 'Todo', '12m': '12m', '3m': '3m' }
export const RANGO_POR_DEFECTO: RangoOverview = '12m'

export function rangosDisponibles(ing: Pick<IngresosResumen, 'meses' | 'primerPago'>): RangoOverview[] {
  const primero = ing.meses[0]?.mes
  const todo = ing.primerPago != null && primero != null && ing.primerPago.slice(0, 7) >= primero
  return RANGOS_OVERVIEW.filter((r) => (r === 'all_time' ? todo : true))
}

/** Los meses de un rango, el más viejo primero: los últimos N, o desde el mes del primer pago. */
export function mesesDelRango(ing: Pick<IngresosResumen, 'meses' | 'primerPago'>, rango: RangoOverview): MesIngresos[] {
  if (rango === '3m') return ing.meses.slice(-3)
  if (rango === '12m') return ing.meses.slice(-12)
  const desde = ing.primerPago?.slice(0, 7)
  return desde ? ing.meses.filter((m) => m.mes >= desde) : ing.meses.slice()
}

/** Cuántas métricas entran en la sección Metrics de Overview (Polar: `limit={5}` en su selector). */
export const LIMITE_METRICAS_OVERVIEW = 5

/** Las métricas que el navegador recordó, si todavía valen: que existan, sin repetir y hasta el límite. */
export function metricasRecordadas(crudo: string): MetricaSlug[] | null {
  try {
    const lista: unknown = JSON.parse(crudo)
    if (!Array.isArray(lista)) return null
    const validas = [...new Set(lista)].filter((slug): slug is MetricaSlug => ALL_METRICS.some((m) => m.slug === slug))
    return validas.length > 0 ? validas.slice(0, LIMITE_METRICAS_OVERVIEW) : null
  } catch {
    return null
  }
}

const MES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic']
const numMes = (mes: string) => Number(mes.slice(5, 7)) - 1
/** «noviembre» (el `format(…, 'MMMM')` de Polar). */
export const mesLargo = (mes: string) => MES_LARGO[numMes(mes)] ?? mes
/** «nov» (el `format(…, 'MMM')` de Polar). */
export const mesCorto = (mes: string) => MES_CORTO[numMes(mes)] ?? mes

/** El último día de un mes YYYY-MM. */
const ultimoDia = (mes: string) => {
  const [y, m] = mes.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
}

/**
 * El link de un mes a Analytics › Metrics, con los parámetros de Polar (`start_date`, `end_date`). Sin `interval`: MaKo mide
 * por mes y esa página lo saca de la URL redirigiendo (app/admin/(polar)/analytics/metrics/page.tsx).
 */
export function hrefDeMes(mes: string, hoy: string): string {
  const fin = ultimoDia(mes)
  const q = new URLSearchParams({ start_date: `${mes}-01`, end_date: fin < hoy ? fin : hoy })
  return `/admin/analytics/metrics?${q.toString()}`
}

export type BarraMes = { mes: string; centavos: number; enCurso: boolean; href: string }

/** Las barras del widget Revenue: los últimos `n` meses (Polar: `MONTHS = 5`), el más viejo primero. */
export function barrasDeIngresos(ing: Pick<IngresosResumen, 'meses' | 'hoy'>, n = 5): BarraMes[] {
  return ing.meses.slice(-n).map((m) => ({ mes: m.mes, centavos: aCentavos(m.cobrado), enCurso: m.enCurso, href: hrefDeMes(m.mes, ing.hoy) }))
}

// ── Top Customers ─────────────────────────────────────────────────────────────────────────────────────────────────

/** `href`: su ficha, o la del CRM si pagó sin cuenta de MaKo (`rutaDeQuienPaga`); `null` = nada que abrir. */
export type ClienteTop = { clave: string; nombre: string; ws: number | null; leadId: number | null; pagos: number; totalCentavos: number; href: string | null }
/** `parte`: el % de todo lo cobrado que pagaron los de la lista (`null` sin nada cobrado). */
export type TopClientes = { filas: ClienteTop[]; parte: number | null }

/**
 * Los que más pagaron (Polar: los 5 con más `net_revenue` de los últimos 12 meses). MaKo tiene lo pagado por cliente desde
 * SIEMPRE (`ClienteResumen.total`), no por período: el titular dice «del total cobrado», no «de los últimos 12 meses».
 */
export function topClientes(
  clientes: ReadonlyArray<{ clave: string; nombre: string; ws: number | null; leadId?: number | null; pagos: number; total: number }>,
  cobradoTotal: number,
  n = 5,
  plataforma: number | null = null,
): TopClientes {
  const filas = clientes
    .filter((c) => c.total > 0)
    .slice()
    .sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre, 'es'))
    .slice(0, n)
    .map((c) => {
      const leadId = c.leadId ?? leadDeClave(c.clave)
      return {
        clave: c.clave, nombre: c.nombre, ws: c.ws, leadId, pagos: c.pagos, totalCentavos: aCentavos(c.total),
        href: rutaDeQuienPaga({ ws: c.ws, leadId }, plataforma),
      }
    })
  const suma = filas.reduce((s, c) => s + c.totalCentavos, 0)
  const total = aCentavos(cobradoTotal)
  return { filas, parte: total > 0 ? Math.round((suma / total) * 100) : null }
}

// ── At Risk ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** Un negocio en riesgo de la tarjeta: el renglón de Customers › At Risk, con a dónde lleva. */
export type FilaRiesgo = ClienteEnRiesgo & { href: string | null }
/** `total` es el largo de la lista (la de la página At Risk, adonde lleva «Ver todo»): la tarjeta muestra las primeras. */
export type Riesgo = { filas: FilaRiesgo[]; total: number }

/**
 * La tarjeta At Risk: LA lista de Customers › At Risk (`vistaDeAtRisk`, ./clientes.ts), no una cuenta propia (revisión del
 * Cerebro del 6/11/2026, punto 7: la tarjeta contaba pausados, cobros fallidos y sin uso, y escondía a los atrasados que la
 * página sí cuenta, así que un cliente que debía salía en rojo en Por cobrar y al lado «Nada en riesgo»). Si falta una de las
 * dos lecturas, es «no pude leer», como en la página: nunca «Nada en riesgo».
 */
export function riesgoDeOverview(v: Pick<PropsAtRisk, 'atRisk' | 'error'>, plataforma: number | null): Lectura<Riesgo> {
  if (v.atRisk == null) return { ok: false, error: v.error ?? 'no se pudo leer' }
  const filas = v.atRisk.map((c) => ({ ...c, href: rutaDeQuienPaga(c, plataforma) }))
  return { ok: true, datos: { filas, total: filas.length } }
}

// ── Por cobrar (el «Available balance» de Polar) ─────────────────────────────────────────────────────────────────

/**
 * Un próximo cobro: de quién, cuándo vence y cuánto. `atrasado`: ya venció (hoy incluido) y no está completo. `href`: su ficha,
 * o la del CRM si no tiene cuenta de MaKo (`rutaDeQuienPaga`); `null` = nada que abrir.
 */
export type FilaPorCobrar = {
  id: string; nombre: string; ws: number | null; leadId: number | null; fecha: string; cuando: string; atrasado: boolean; centavos: number; href: string | null
}
/** `totalCentavos` es la suma de TODAS las filas (la lista no se corta: la tarjeta scrollea, como la de Polar). */
export type PorCobrarResumen = { filas: FilaPorCobrar[]; totalCentavos: number }

/**
 * La tarjeta «Por cobrar»: lo que `vistaDeIngresos()` ya calculó en `porCobrar` (lo atrasado y lo que vence en los próximos
 * 31 días, con la historia mes a mes de cada suscripción, lib/admin-ingresos-reglas.ts `porCobrarDe`). Acá NO se recalcula
 * nada: se le pone el nombre del negocio (de la misma vista, `clientes`), la fecha en palabras y el link a su ficha. El orden
 * es el de la vista (lo más cercano primero).
 */
export function porCobrarResumen(
  porCobrar: ReadonlyArray<PorCobrar>,
  clientes: ReadonlyArray<{ clave: string; nombre: string; ws: number | null; leadId?: number | null }>,
  hoy: string,
  plataforma: number | null = null,
): PorCobrarResumen {
  const quien = new Map(clientes.map((c) => [c.clave, c]))
  const filas = porCobrar.map((p, i): FilaPorCobrar => {
    const c = quien.get(p.cliente)
    const ws = c?.ws ?? wsDeClave(p.cliente)
    const leadId = c?.leadId ?? leadDeClave(p.cliente)
    return {
      id: `${p.cliente}:${p.fecha}:${i}`,
      nombre: c?.nombre ?? (ws != null ? `Workspace ${ws}` : p.cliente),
      ws,
      leadId,
      fecha: p.fecha,
      cuando: diaTxt(p.fecha, hoy),
      atrasado: p.atrasado,
      centavos: aCentavos(p.usd),
      href: rutaDeQuienPaga({ ws, leadId }, plataforma),
    }
  })
  return { filas, totalCentavos: filas.reduce((s, f) => s + f.centavos, 0) }
}

/**
 * A dónde lleva «Ver todo» de Por cobrar: con algo atrasado, a las suscripciones atrasadas (`?status=past_due`), que es lo que
 * hay que mirar; si no, a Subscriptions (revisión del Cerebro del 6/11/2026, punto 8: abría filtrada en «Activa» y escondía a
 * los que deben).
 */
export function hrefDePorCobrar(r: Pick<PorCobrarResumen, 'filas'> | null): string {
  return r?.filas.some((f) => f.atrasado) ? '/admin/sales/subscriptions?status=past_due' : '/admin/sales/subscriptions'
}

// ── Margen bruto (el «Gross margin» de Polar) ────────────────────────────────────────────────────────────────────

/** Polar: `TRAILING_DAYS = 30` y `MONTHS = 5` (los cinco meses COMPLETOS antes del actual). */
export const DIAS_MARGEN = 30
export const MESES_MARGEN = 5

/** `(ingresos − costos) / ingresos`, redondeado (el `marginPercentage` de Polar). `null` sin ingresos o sin el gasto medido. */
export function margenPorcentaje(ingresosCentavos: number, costosCentavos: number | null): number | null {
  if (costosCentavos == null) return null
  return ingresosCentavos > 0 ? Math.round(((ingresosCentavos - costosCentavos) / ingresosCentavos) * 100) : null
}

export type MesMargen = { mes: string; margen: number | null; href: string }
/** `ultimos30`: el margen de los últimos 30 días (el titular); `meses`: el de cada mes completo, el más viejo primero. */
export type MargenBruto = { ultimos30: number | null; meses: MesMargen[] }

/** YYYY-MM-DD `n` días antes de `dia`. */
const diasAntes = (dia: string, n: number) => new Date(Date.parse(`${dia}T00:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10)

/** El primer día que tiene que traer la lectura del gasto: el del mes más viejo del margen (`MESES_MARGEN` antes del actual). */
export function desdeDelMargen(hoy: string): string {
  const [y, m] = hoy.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 - MESES_MARGEN, 1)).toISOString().slice(0, 10)
}

/**
 * El margen bruto de Overview. Los ingresos son lo cobrado con la MISMA suma que el widget Revenue (`meses[].cobrado` por mes;
 * los pagos de `entradas` para la ventana de 30 días); los costos, el gasto de IA que paga MaKo por día (`porDia` de
 * lib/costos-ia.ts, el mismo `costoDe` que Analytics › Costs, en dólares).
 *
 * ⚠️ «NO SE MIDIÓ» NO ES CERO: un mes (o la ventana) sin NINGUNA fila de gasto es un mes en que MaKo no registró uso de IA (la
 *    tabla todavía no existía, o no se escribió), y su margen sería un 100% inventado: va `null` («–»). Un mes con filas en
 *    0 (todo con IA gratis) sí es un gasto medido de 0. El gasto que NO SE PUDO LEER no llega acá: `margenDeLecturas` lo
 *    deja como error de la tarjeta.
 * ⚠️ Los días del gasto son UTC (como `porDia` y la pantalla de Costs) y los de los pagos, los de su fecha: en el borde de un
 *    día puede caer en la ventana uno de un lado y no del otro.
 */
export function margenBruto(p: {
  hoy: string
  meses: ReadonlyArray<Pick<MesIngresos, 'mes' | 'cobrado'>>
  entradas: ReadonlyArray<Pick<Entrada, 'fecha' | 'usd'>>
  gastoPorDia: ReadonlyArray<Pick<Corte, 'clave' | 'costUsd'>>
}): MargenBruto {
  const mesActual = p.hoy.slice(0, 7)
  const desde = diasAntes(p.hoy, DIAS_MARGEN - 1)
  const enVentana = (dia: string) => dia >= desde && dia <= p.hoy

  const gastoVentana = p.gastoPorDia.filter((d) => enVentana(d.clave))
  const cobradoVentana = p.entradas.reduce((s, e) => (enVentana(e.fecha) && e.usd != null ? s + e.usd : s), 0)
  const ultimos30 = margenPorcentaje(
    aCentavos(cobradoVentana),
    gastoVentana.length ? gastoVentana.reduce((s, d) => s + d.costUsd, 0) * 100 : null,
  )

  const cobradoDe = new Map(p.meses.map((m) => [m.mes, m.cobrado]))
  const gastoDe = new Map<string, number>()
  for (const d of p.gastoPorDia) {
    const mes = d.clave.slice(0, 7)
    gastoDe.set(mes, (gastoDe.get(mes) ?? 0) + d.costUsd)
  }
  const [y, m] = mesActual.split('-').map(Number)
  const meses: MesMargen[] = []
  for (let i = MESES_MARGEN; i >= 1; i--) {
    const mes = new Date(Date.UTC(y, m - 1 - i, 1)).toISOString().slice(0, 7)
    const gasto = gastoDe.get(mes)
    meses.push({
      mes,
      margen: margenPorcentaje(aCentavos(cobradoDe.get(mes) ?? 0), gasto == null ? null : gasto * 100),
      href: `/admin/analytics/costs?mes=${mes}`,
    })
  }
  return { ultimos30, meses }
}

/** La tarjeta con lo que leyó el server: si no se pudieron leer los ingresos o el gasto, es un error (nunca un 0%). */
export function margenDeLecturas(
  ingresos: Lectura<Pick<IngresosResumen, 'hoy' | 'meses' | 'entradas'>>,
  gasto: Lectura<ReadonlyArray<Pick<Corte, 'clave' | 'costUsd'>>>,
): Lectura<MargenBruto> {
  if (!ingresos.ok) return { ok: false, error: `los ingresos: ${ingresos.error}` }
  if (!gasto.ok) return { ok: false, error: `el gasto de IA: ${gasto.error}` }
  return { ok: true, datos: margenBruto({ hoy: ingresos.datos.hoy, meses: ingresos.datos.meses, entradas: ingresos.datos.entradas, gastoPorDia: gasto.datos }) }
}

// ── Activity ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** Una fila del widget Activity: el título, de quién, cuándo (corto) y a dónde lleva. */
export type FilaActividad = { id: string; titulo: string; detalle: string | null; cuando: string; href: string | null }
/** `hoy`: cuántos eventos hubo hoy (pagos y acciones de MaKo); `hoyMas`: puede haber más que los leídos. */
export type Actividad = { filas: FilaActividad[]; hoy: number; hoyMas: boolean }

/** Lo que Polar escribe con `formatRelativeTime` («now», «5m ago», «3h ago», «2d ago», «Nov 5»), en español. */
export function tiempoRelativo(iso: string, ahoraMs: number): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return '—'
  const minutos = Math.floor((ahoraMs - t) / 60_000)
  if (minutos < 1) return 'ahora'
  if (minutos < 60) return `hace ${minutos} min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `hace ${horas} h`
  const dias = Math.floor(horas / 24)
  if (dias < 7) return `hace ${dias} d`
  const d = new Date(t)
  return `${d.getUTCDate()} ${MES_CORTO[d.getUTCMonth()]}`
}

/** Lo mismo para un día sin hora (un pago se anota con su día): «hoy», «ayer», «hace 3 d», «5 nov». */
export function diaRelativo(dia: string, hoy: string): string {
  const dias = Math.round((Date.parse(`${hoy}T00:00:00Z`) - Date.parse(`${dia}T00:00:00Z`)) / 86_400_000)
  if (!Number.isFinite(dias)) return '—'
  if (dias <= 0) return 'hoy'
  if (dias === 1) return 'ayer'
  if (dias < 7) return `hace ${dias} d`
  return `${Number(dia.slice(8, 10))} ${MES_CORTO[numMes(dia.slice(0, 7))] ?? ''}`.trim()
}

/** Las filas que se ven (Polar: `VISIBLE_ROWS = 5`). */
export const FILAS_ACTIVIDAD = 5
/** Cuántas acciones de MaKo lee lib/actividad.ts (las últimas 100): si las 100 son de hoy, puede haber más. */
export const ACCIONES_LEIDAS = 100

const hrefDeCliente = (ws: number | null) => (ws != null ? `/admin/customers/${ws}` : null)
const wsDeClave = (clave: string): number | null => {
  const m = /^ws:(\d+)$/.exec(clave)
  return m ? Number(m[1]) : null
}

/**
 * El widget Activity. Polar muestra los eventos de importancia alta del sistema (pedidos, suscripciones, clientes) y
 * cuenta todos los de hoy. MaKo tiene dos clases: los PAGOS que entraron (de importancia alta, con su día pero sin hora) y
 * lo que corrió MaKo (con su hora): se muestran y se cuentan sus ACCIONES (lo que cambió algo), no sus lecturas.
 * Orden: el día más nuevo primero; dentro del mismo día, los pagos primero (no se sabe su hora) y después las acciones.
 */
export function actividadReciente(p: {
  hoy: string
  ahoraMs: number
  /** Todos los pagos que entraron (para contar los de hoy): `vistaDeIngresos().entradas`. */
  entradas: ReadonlyArray<{ fecha: string }>
  /** Los últimos pagos, el más nuevo primero: `vistaDeIngresos().pagos`. */
  pagos: ReadonlyArray<{ id: string; fecha: string; usd: number | null; nombre: string; cliente: string; recurrente: boolean }>
  /** Las últimas acciones de MaKo, la más nueva primero, con su día ya en la zona de la plataforma. */
  acciones: ReadonlyArray<{ creado: string; dia: string; ws: number | null; titulo: string; tipo: string; ok: boolean }>
  nombres: Readonly<Record<number, string>>
  usdTxt: (centavos: number) => string
  n?: number
}): Actividad {
  const n = p.n ?? FILAS_ACTIVIDAD
  type Candidata = { dia: string; orden: number; clave: string; fila: FilaActividad }
  const candidatas: Candidata[] = []
  for (const pg of p.pagos) {
    candidatas.push({
      dia: pg.fecha, orden: 0, clave: pg.fecha,
      fila: {
        id: `pago:${pg.id}`,
        titulo: pg.recurrente ? 'Pago de una mensualidad' : 'Pago',
        detalle: pg.usd != null ? `${pg.nombre} · ${p.usdTxt(aCentavos(pg.usd))}` : pg.nombre,
        cuando: diaRelativo(pg.fecha, p.hoy),
        href: hrefDeCliente(wsDeClave(pg.cliente)),
      },
    })
  }
  for (const a of p.acciones) {
    if (a.tipo !== 'accion') continue
    const negocio = a.ws != null ? (p.nombres[a.ws] ?? `Workspace ${a.ws}`) : null
    candidatas.push({
      dia: a.dia, orden: 1, clave: a.creado,
      fila: {
        id: `mako:${a.creado}:${a.titulo}`,
        titulo: a.titulo,
        detalle: a.ok ? negocio : [negocio, 'no salió'].filter(Boolean).join(' · '),
        cuando: tiempoRelativo(a.creado, p.ahoraMs),
        href: hrefDeCliente(a.ws),
      },
    })
  }
  candidatas.sort((x, y) => (x.dia < y.dia ? 1 : x.dia > y.dia ? -1 : x.orden - y.orden || (x.clave < y.clave ? 1 : x.clave > y.clave ? -1 : 0)))
  // «Hoy» cuenta lo que se ve: los pagos y las ACCIONES (lo que cambió algo). Las lecturas de MaKo no se listan ni se cuentan:
  // con ellas el número no se podía comprobar en ninguna pantalla (punto 13, revisión del 6/11/2026). «Ver todo» abre Events con
  // `eventTypes=pago,mako&range=today`, que da el mismo número.
  const deHoy = p.acciones.filter((a) => a.dia === p.hoy && a.tipo === 'accion').length
  const leidasTodasDeHoy = p.acciones.length >= ACCIONES_LEIDAS && p.acciones[p.acciones.length - 1]?.dia === p.hoy
  return {
    filas: candidatas.slice(0, n).map((c) => c.fila),
    hoy: p.entradas.filter((e) => e.fecha === p.hoy).length + deHoy,
    hoyMas: leidasTodasDeHoy,
  }
}

// ── Lo que espera a Martín (los banners) ──────────────────────────────────────────────────────────────────────────

export type PedidoIngreso = { id: number; email: string; nombre: string | null; detalle: string }
export type PedidoCartera = { agenciaWs: number; clienteWs: number; agencia: string; cliente: string }
export type PedidoAlta = { id: number; agencia: string; cliente: string; email: string; rol: string }
export type PedidoBaja = {
  id: number
  titulo: string
  plazo: string
  /** Se pasó del plazo que le dijimos a la persona. */
  vencido: boolean
  notas: string | null
  /** El negocio entero se borra desde su ficha (Customers › <negocio>), no desde esta lista. */
  negocioWs: number | null
  /** Una persona (no de prueba): se puede eliminar desde acá. */
  puedeEliminar: boolean
  /** El negocio ya se borró y quedó algo: se cierra avisándole. */
  puedeTerminar: boolean
}
/** Los planes que se pueden dar al dar de alta: los de UN formulario, el de Customers (./alta.ts). */
export type { PlanAlta } from './alta'

export type Esperan = {
  /** Los contracargos que todavía piden algo (`disputasPorResponder`): se cuentan, la lista vive en Sales › Disputes. */
  disputas: Lectura<{ porResponder: number }>
  ingreso: Lectura<{ pedidos: PedidoIngreso[]; hayMas: boolean }>
  /** ⚠️ lib/agencia.ts devuelve `[]` cuando no puede leer: acá no se distingue «no hay» de «no pude» (se anota). */
  agencias: { carteras: PedidoCartera[]; altas: PedidoAlta[] }
  bajas: Lectura<{ bajas: PedidoBaja[] }>
  planes: PlanAlta[]
  planPorDefecto: string
}

/**
 * El texto con que Mercado Pago avisa un contracargo que está en revisión (`textoContracargo`, fase «mp», `in_process`). Es el
 * ÚNICO texto de Mercado Pago que pide algo: `estadoDeDisputa` (./ventas.ts) dice `en_revision` de TODO texto de Mercado Pago,
 * incluso del que ya se resolvió, y contarlos a todos dejaba el aviso prendido para siempre (revisión del Cerebro, punto 28).
 */
const MP_EN_REVISION = textoContracargo({ pasarela: 'mercadopago', fase: 'mp', estado: 'in_process' })

/**
 * Cuántos contracargos piden algo: los abiertos, los que ya descontaron la plata y el de Mercado Pago en revisión, de la MISMA
 * lista que Sales › Disputes (`disputasDe`). Los ganados, perdidos, cerrados o con la plata devuelta no avisan.
 */
export function disputasPorResponder(disputas: ReadonlyArray<Pick<DisputaVenta, 'estado' | 'texto'>>): number {
  return disputas.filter((d) =>
    d.estado === 'abierta' || d.estado === 'plata_afuera' || (d.estado === 'en_revision' && d.texto.trim() === MP_EN_REVISION),
  ).length
}

const nombreWs = (nombres: Readonly<Record<number, string>>, ws: number) => nombres[ws] ?? `Workspace ${ws}`

export function pedidosDeIngreso(
  filas: ReadonlyArray<{ id: number; email: string; nombre: string | null } & Parameters<typeof detalleDelPedido>[0]>,
): PedidoIngreso[] {
  return filas.map((f) => ({ id: f.id, email: f.email, nombre: f.nombre, detalle: detalleDelPedido(f) }))
}

export function pedidosDeAgencias(
  carteras: ReadonlyArray<{ agencia_ws: number; cliente_ws: number }>,
  altas: ReadonlyArray<{ id: number; agencia_ws: number; cliente_ws: number; email: string; rol_ws: string }>,
  nombres: Readonly<Record<number, string>>,
): Esperan['agencias'] {
  return {
    carteras: carteras.map((c) => ({ agenciaWs: Number(c.agencia_ws), clienteWs: Number(c.cliente_ws), agencia: nombreWs(nombres, Number(c.agencia_ws)), cliente: nombreWs(nombres, Number(c.cliente_ws)) })),
    altas: altas.map((a) => ({
      id: a.id, agencia: nombreWs(nombres, Number(a.agencia_ws)), cliente: nombreWs(nombres, Number(a.cliente_ws)), email: a.email,
      rol: ROTULO_ROL[a.rol_ws as RolAlta] ?? a.rol_ws,
    })),
  }
}

export function pedidosDeBaja(
  filas: ReadonlyArray<{ id: number; alcance: 'persona' | 'negocio'; email: string | null; negocio: string | null; negocio_id: number | null; prueba: boolean; vence_at: string; notas: string | null }>,
  ahoraMs: number,
): PedidoBaja[] {
  return filas.map((b) => {
    const dias = diasQueQuedan(b.vence_at, ahoraMs)
    const quien = b.alcance === 'negocio' ? `El negocio entero: ${b.negocio ?? `#${b.negocio_id}`}` : (b.email ?? 'Una persona')
    const plazo = dias < 0
      ? `Se pasó del plazo: era el ${fechaDeLaBaja(b.vence_at)}`
      : `Hasta el ${fechaDeLaBaja(b.vence_at)} (${dias} ${dias === 1 ? 'día' : 'días'})`
    return {
      id: b.id,
      titulo: `${quien}${b.prueba ? ' · de prueba' : ''}`,
      plazo: b.alcance === 'negocio' && b.email ? `${b.email} · ${plazo}` : plazo,
      vencido: dias < 0,
      notas: b.notas,
      negocioWs: b.alcance === 'negocio' ? b.negocio_id : null,
      puedeEliminar: b.alcance === 'persona' && !b.prueba,
      puedeTerminar: b.alcance === 'negocio' && (b.notas ?? '').startsWith('Se borró'),
    }
  })
}

/** El título de cada fila de lo que espera. `null` = no hay nada: la fila no se dibuja. */
export function tituloDeDisputas(n: number): string | null {
  if (n <= 0) return null
  return n === 1 ? 'Un cliente disputó un cargo' : `${n} clientes disputaron un cargo`
}
export function tituloDeIngreso(n: number): string | null {
  if (n <= 0) return null
  return n === 1 ? 'Una persona quiere entrar a MaKo' : `${n} personas quieren entrar a MaKo`
}
export function tituloDeAgencias(n: number): string | null {
  if (n <= 0) return null
  return n === 1 ? 'Una agencia espera tu firma' : `${n} pedidos de agencias esperan tu firma`
}
/** Con alguna vencida, el dato que iba en la frase del aviso pasa al título («… · 1 vencida»; punto 38). */
export function tituloDeBajas(n: number, vencidas = 0): string | null {
  if (n <= 0) return null
  const base = n === 1 ? 'Una persona pidió eliminar su cuenta' : `${n} personas pidieron eliminar su cuenta`
  return vencidas > 0 ? `${base} · ${vencidas} ${vencidas === 1 ? 'vencida' : 'vencidas'}` : base
}

/**
 * Las filas de lo que espera, en el orden en que se dibujan (revisión del Cerebro del 6/11/2026, puntos 28 y 38): UNA lista
 * chica, una fila por espera, con el título a la izquierda y su botón a la derecha. Cada aviso de Polar medía unos 130 px, y con
 * tres prendidos los widgets quedaban fuera de la primera pantalla. El contracargo va primero: es plata que se va. `peligro`: va
 * en rojo (un contracargo, o una baja que se pasó del plazo). Lo que no se pudo leer no es una fila: va en el aviso de arriba
 * (`faltasDeEspera`).
 */
export type ClaveEspera = 'disputas' | 'bajas' | 'agencias' | 'ingreso'
export type FilaEspera = { clave: ClaveEspera; titulo: string; peligro: boolean; accion: string }

export function filasDeEspera(e: Pick<Esperan, 'disputas' | 'bajas' | 'agencias' | 'ingreso'>): FilaEspera[] {
  const filas: FilaEspera[] = []
  const disputas = e.disputas.ok ? tituloDeDisputas(e.disputas.datos.porResponder) : null
  if (disputas) filas.push({ clave: 'disputas', titulo: disputas, peligro: true, accion: 'Revisar' })
  if (e.bajas.ok) {
    const vencidas = e.bajas.datos.bajas.filter((b) => b.vencido).length
    const t = tituloDeBajas(e.bajas.datos.bajas.length, vencidas)
    if (t) filas.push({ clave: 'bajas', titulo: t, peligro: vencidas > 0, accion: 'Revisar' })
  }
  const agencias = tituloDeAgencias(e.agencias.carteras.length + e.agencias.altas.length)
  if (agencias) filas.push({ clave: 'agencias', titulo: agencias, peligro: false, accion: 'Revisar' })
  if (e.ingreso.ok) {
    const n = e.ingreso.datos.pedidos.length
    const t = tituloDeIngreso(n)
    if (t) filas.push({ clave: 'ingreso', titulo: t, peligro: false, accion: n === 1 ? 'Ver el pedido' : 'Ver los pedidos' })
  }
  return filas
}

/** Una fila por clave (para que cada pieza dibuje la suya con la MISMA regla que la lista). */
export const filaDeEspera = (e: Parameters<typeof filasDeEspera>[0], clave: ClaveEspera): FilaEspera | null =>
  filasDeEspera(e).find((f) => f.clave === clave) ?? null

/**
 * Lo que no se pudo leer de lo que espera, dicho como lo dice el aviso de lectura («No pude leer …», `AvisosDeLectura`). Un
 * «no pude leer» no es «no hay nadie»: si no, un pedido de entrar se perdería sin que nada lo dijera.
 */
export function faltasDeEspera(e: Pick<Esperan, 'disputas' | 'bajas' | 'ingreso'>): string[] {
  return [
    !e.disputas.ok ? `las disputas: ${e.disputas.error}` : null,
    !e.bajas.ok ? `quién pidió eliminar su cuenta: ${e.bajas.error}` : null,
    !e.ingreso.ok ? `quién quiere entrar: ${e.ingreso.error}` : null,
  ].filter((x): x is string => x != null)
}

// ── Todo junto ────────────────────────────────────────────────────────────────────────────────────────────────────

export type ResumenAdmin = {
  ingresos: Lectura<IngresosResumen>
  top: Lectura<TopClientes>
  riesgo: Lectura<Riesgo>
  actividad: Lectura<Actividad>
  porCobrar: Lectura<PorCobrarResumen>
  margen: Lectura<MargenBruto>
  esperan: Esperan
  /** Lo que no se pudo leer del todo: lo que se muestra puede quedarse corto. */
  avisos: string[]
}
