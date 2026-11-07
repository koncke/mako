// =============================================================================
// Admin › Customers: lo que MaKo tiene para llenar las páginas de Customers de Polar, ya convertido a sus props (6/11/2026)
// =============================================================================
// Polar (polarsource/polar, Apache-2.0) arma Customers con un Customer por persona o equipo que le compró a la
// organización. En MaKo, un Customer es un NEGOCIO (un workspace). Las páginas son las de Polar
// (…/(header)/customers/: la lista a la izquierda, Overview, Top Customers, At Risk y Cost Drivers) y sus componentes
// (clients/apps/web/src/components/Customer/). Lo que Polar pide por un hook en el navegador, acá lo lee el server
// (app/admin/_polar/datos/clientes-server.ts) y estas funciones PURAS lo convierten en las props de cada vista.
//
// DE DÓNDE SALE CADA DATO:
//   · la lista y el crecimiento: `vistaDeClientes()` (lib/clientes-plataforma.ts), un renglón por negocio (sin el de la
//     plataforma ni los clientes de una agencia: `esClienteDeMaKo`);
//   · Top Customers: `vistaDeIngresos().entradas` (lib/admin-ingresos.ts), cada pago con la clave de su cliente: el navegador
//     suma los del rango elegido (como el `useTopCustomers` de Polar);
//   · At Risk: los atrasados y los que dejaron de pagar (ingresos) + los pausados, los cobros fallidos y los sin uso
//     (clientes);
//   · Cost Drivers: `resumenDelPeriodo(<mes>)` (lib/costos-ia.ts), el corte por workspace, y SÓLO si es atribuible.
//
// ⚠️ NADA DE INGRESO MENSUAL EN CUSTOMERS (Martín, 6/11/2026: rechazó una versión por «ingreso mensual en Customers»). El
//    gráfico de Customers es el de Polar: cuántos negocios hay. El MRR vive en Overview y en Analytics.
// ⚠️ PURO: sin `server-only`. Lo usan el navegador (el crecimiento y la lista se recalculan al cambiar el rango o el
//    filtro) y tests/admin-polar-clientes.test.ts. De los módulos del server, sólo `import type`.
// =============================================================================

import {
  addDays,
  addHours,
  addMonths,
  addWeeks,
  addYears,
  startOfDay,
  startOfHour,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from 'date-fns'
import type { FilaCliente } from '@/lib/clientes-plataforma'
import { mesTxt, type ClienteResumen, type Ingresos } from '@/lib/admin-ingresos-reglas'
import type { ResumenPeriodo } from '@/lib/costos-ia'
import { nombreDePlan } from '@/lib/clientes-plataforma-reglas'
import { aCentavos } from './metricas'
import type { TimeInterval } from './polar-tipos'

/** La ruta de Customers (la barra de Polar cuelga de /admin: app/admin/_polar/web/Dashboard/navigation.tsx). */
export const RUTA_CUSTOMERS = '/admin/customers'

/** El link de la ficha de un negocio (app/admin/(polar)/customers/[id]/, adentro del layout de Customers). */
export const rutaDeNegocio = (ws: number) => `${RUTA_CUSTOMERS}/${ws}`

/** Un id de negocio que viaja en el path. Nunca `?ws=` (AGENTS.md: un parámetro de URL lo escribe cualquiera). */
export const WS_VALIDO = /^[1-9]\d{0,11}$/

/** Una lectura del server: lo que se leyó, o el motivo por el que no se pudo (un «no pude leer» no es un vacío). */
export type Lectura<T> = { ok: true; datos: T; avisos: string[] } | { ok: false; error: string }

// ── La lista de la izquierda (CustomerListSidebar) ─────────────────────────────────────────────────────────────────

/** Un renglón de la lista. Polar muestra nombre, nombre de facturación y email: un negocio de MaKo tiene su nombre. */
export type ClienteDeLista = {
  ws: number
  nombre: string
  /** ISO: cuándo se dio de alta. */
  creado: string
  /** El workspace está activo (el filtro Active / Inactive de Polar). */
  activo: boolean
  /** El plan como lo vende MaKo (para el CSV). */
  plan: string
  estado: string
}

export const ORDENES = ['-created_at', 'created_at', 'name', '-name'] as const
export type OrdenLista = (typeof ORDENES)[number]
export const FILTROS = ['all', 'active', 'inactive'] as const
export type FiltroLista = (typeof FILTROS)[number]

/** Lo que lee la lista de la URL (los `useQueryState` de Polar): un valor que no es de la lista cae al default. */
export const ordenDeParam = (v: string | null | undefined): OrdenLista =>
  (ORDENES as readonly string[]).includes(v ?? '') ? (v as OrdenLista) : '-created_at'
export const filtroDeParam = (v: string | null | undefined): FiltroLista =>
  (FILTROS as readonly string[]).includes(v ?? '') ? (v as FiltroLista) : 'all'

/**
 * ¿Va en la lista de Customers? Un cliente de una AGENCIA no (Martín, 28/09/2026, en la grilla vieja de Admin: «Los clientes de
 * agencia deberían aparecer dentro de la tab de EQUIPO de esa agencia como una card de cliente. No como un cliente más de
 * MaKo»): a ese negocio no le factura MaKo, le factura su agencia, y contarlo decía que MaKo tiene un cliente donde tiene medio.
 * Cuenta el pedido pendiente y no el revocado (lib/clientes-plataforma.ts → `esCarteraVigente` → el segmento «de-agencia»).
 * Su ficha se sigue abriendo por su link, y la búsqueda ⌘K lo encuentra diciendo de qué agencia es (./busqueda-tipos.ts).
 */
export const esClienteDeMaKo = (f: Pick<FilaCliente, 'segmentos'>): boolean => !f.segmentos.includes('de-agencia')

export function listaDeClientes(filas: ReadonlyArray<Pick<FilaCliente, 'ws' | 'nombre' | 'creado' | 'estado' | 'capa' | 'segmentos'>>): ClienteDeLista[] {
  return filas.filter(esClienteDeMaKo).map((f) => ({
    ws: f.ws,
    nombre: f.nombre,
    creado: f.creado,
    activo: f.estado === 'activo',
    plan: nombreDePlan(f.capa),
    estado: f.estado,
  }))
}

/** Sin mayúsculas ni tildes: «Óptica» se encuentra escribiendo «optica». */
const plano = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** La búsqueda, el filtro y el orden de la lista, en memoria (Polar lo pide paginado a su API). */
export function filtrarClientes(
  lista: readonly ClienteDeLista[],
  { query, sorting, filter }: { query?: string | null; sorting: OrdenLista; filter: FiltroLista },
): ClienteDeLista[] {
  const q = plano(query ?? '')
  const out = lista.filter((c) => {
    if (filter === 'active' && !c.activo) return false
    if (filter === 'inactive' && c.activo) return false
    return !q || plano(c.nombre).includes(q) || String(c.ws) === q
  })
  const desc = sorting.startsWith('-')
  const porNombre = sorting.endsWith('name')
  return out.sort((a, b) => {
    const r = porNombre ? a.nombre.localeCompare(b.nombre, 'es') : a.creado < b.creado ? -1 : a.creado > b.creado ? 1 : 0
    return (desc ? -r : r) || a.ws - b.ws
  })
}

/** Las filas del CSV de «Export Customers» (lo arma `armarCsv` de lib/csv-celda.ts en la lista). Sin personas ni plata. */
export function filasDeExportacion(lista: readonly ClienteDeLista[]): Array<Array<string | number>> {
  return [
    ['ID', 'Nombre', 'Plan', 'Estado', 'Creado'],
    ...lista.map((c) => [c.ws, c.nombre, c.plan, c.estado, c.creado.slice(0, 10)]),
  ]
}

// ── El crecimiento (CustomerGrowthChart) ───────────────────────────────────────────────────────────────────────────

/** Un período del gráfico: la forma que Polar recibe de `useCustomerGrowth`. */
export type PeriodoCrecimiento = { timestamp: Date; new_customers: number; total_customers: number }

const INICIO: Record<TimeInterval, (d: Date) => Date> = {
  hour: startOfHour,
  day: startOfDay,
  // La semana arranca el lunes, como el `date_trunc('week')` de Postgres con el que Polar agrupa.
  week: (d) => startOfWeek(d, { weekStartsOn: 1 }),
  month: startOfMonth,
  year: startOfYear,
}
const SIGUIENTE: Record<TimeInterval, (d: Date) => Date> = {
  hour: (d) => addHours(d, 1),
  day: (d) => addDays(d, 1),
  week: (d) => addWeeks(d, 1),
  month: (d) => addMonths(d, 1),
  year: (d) => addYears(d, 1),
}

/**
 * Los negocios nuevos de cada período entre `start` y `end`, y cuántos había al cierre de cada uno (contando los de
 * antes de `start`). Un alta sin fecha legible no se cuenta en ningún lado.
 */
export function crecimientoDeClientes(creados: readonly string[], start: Date, end: Date, interval: TimeInterval): PeriodoCrecimiento[] {
  const fechas = creados.map((c) => Date.parse(c)).filter((t) => Number.isFinite(t)).sort((a, b) => a - b)
  const out: PeriodoCrecimiento[] = []
  let i = 0
  let total = 0
  let desde = INICIO[interval](start)
  // Lo de antes del primer período cuenta para el total, no para los nuevos.
  while (i < fechas.length && fechas[i] < desde.getTime()) { i += 1; total += 1 }
  for (let vueltas = 0; desde.getTime() <= end.getTime() && vueltas < 2000; vueltas += 1) {
    const hasta = SIGUIENTE[interval](desde)
    let nuevos = 0
    while (i < fechas.length && fechas[i] < hasta.getTime()) { i += 1; nuevos += 1 }
    total += nuevos
    out.push({ timestamp: desde, new_customers: nuevos, total_customers: total })
    desde = hasta
  }
  return out
}

/** El alta más vieja (el «All Time» de Polar arranca en la fecha de creación de la organización). */
export function primerAlta(creados: readonly string[], ahoraMs: number): string {
  const ts = creados.map((c) => Date.parse(c)).filter((t) => Number.isFinite(t))
  return new Date(ts.length ? Math.min(...ts) : ahoraMs).toISOString()
}

// ── Top Customers (TopCustomersList, TopCustomersPage) ─────────────────────────────────────────────────────────────

export type ClienteTop = {
  clave: string
  /** Su negocio en MaKo. `null` = pagó sin cuenta de MaKo (un lead del CRM de la plataforma): sin ficha que abrir. */
  ws: number | null
  nombre: string
  /** Cuántos pagos entraron en el período (las «orders» de Polar). */
  pagos: number
  /** Lo que pagó en el período, en CENTAVOS de dólar (como lo formatea Polar). */
  totalCentavos: number
}

/** Un pago que entró, de quién (la clave de lib/admin-ingresos: `ws:<n>` o `lead:<id>`), cuándo (YYYY-MM-DD) y cuánto. */
export type PagoDeCliente = { cliente: string; fecha: string; usd: number }
export type QuienPaga = { clave: string; ws: number | null; nombre: string }
/** Lo que el navegador necesita para contar los que más pagaron en cualquier rango (el de Polar lo pide a su API). */
export type DatosTop = { pagos: PagoDeCliente[]; quien: QuienPaga[] }

/**
 * Los pagos con su dueño, de `vistaDeIngresos()`. Un pago sin su valor en dólares no suma (no se inventa una tasa) y uno sin
 * la clave de su cliente no se puede atribuir: los dos quedan afuera.
 */
export function datosDeTop(ingresos: Pick<Ingresos, 'entradas' | 'clientes'>): DatosTop {
  const quien = new Map<string, QuienPaga>(ingresos.clientes.map((c) => [c.clave, { clave: c.clave, ws: c.ws, nombre: c.nombre }]))
  const pagos: PagoDeCliente[] = []
  for (const e of ingresos.entradas) {
    if (!e.cliente || e.usd == null || !Number.isFinite(e.usd)) continue
    if (!quien.has(e.cliente)) quien.set(e.cliente, { clave: e.cliente, ws: wsDeClave(e.cliente), nombre: e.nombre })
    pagos.push({ cliente: e.cliente, fecha: e.fecha, usd: e.usd })
  }
  return { pagos, quien: [...quien.values()] }
}

/** `ws:<n>` → n. La clave la arma lib/admin-ingresos.ts. */
const wsDeClave = (clave: string): number | null => {
  const m = /^ws:([1-9]\d{0,11})$/.exec(clave)
  return m ? Number(m[1]) : null
}

/**
 * Los que más pagaron entre `desde` y `hasta` (YYYY-MM-DD, los dos incluidos; `null` = sin límite), el que más primero.
 * Sólo los que pagaron algo en el período (Polar: «No paid orders were recorded in this period»).
 */
export function topClientes(datos: DatosTop, desde: string | null, hasta: string | null, limite = 50): ClienteTop[] {
  const porCliente = new Map<string, { pagos: number; usd: number }>()
  for (const p of datos.pagos) {
    if ((desde && p.fecha < desde) || (hasta && p.fecha > hasta)) continue
    const a = porCliente.get(p.cliente) ?? { pagos: 0, usd: 0 }
    a.pagos += 1
    a.usd += p.usd
    porCliente.set(p.cliente, a)
  }
  const quien = new Map(datos.quien.map((q) => [q.clave, q]))
  return [...porCliente.entries()]
    .filter(([, a]) => a.usd > 0)
    .map(([clave, a]) => {
      const q = quien.get(clave)
      return { clave, ws: q?.ws ?? wsDeClave(clave), nombre: q?.nombre ?? clave, pagos: a.pagos, totalCentavos: aCentavos(a.usd) }
    })
    .sort((a, b) => b.totalCentavos - a.totalCentavos || a.nombre.localeCompare(b.nombre, 'es'))
    .slice(0, limite)
}

// ── At Risk (useAtRisk, AtRiskList, AtRiskPage) ────────────────────────────────────────────────────────────────────

/**
 * Por qué está en riesgo, del más grave al menos. Los dos primeros son el «Past due» de Polar (rojo): un pago que ya
 * venció y un cobro de la pasarela que falló. Los demás, el amarillo.
 */
export const MOTIVOS_RIESGO = ['atrasado', 'cobro', 'pausado', 'cortado', 'sin-uso'] as const
export type MotivoEnRiesgo = (typeof MOTIVOS_RIESGO)[number]
const GRAVES: ReadonlySet<MotivoEnRiesgo> = new Set(['atrasado', 'cobro'])

export type ClienteEnRiesgo = {
  clave: string
  ws: number | null
  nombre: string
  /** El plan (el «Product» de Polar). `null` = no tiene negocio en MaKo. */
  plan: string | null
  /** Lo que paga por mes (el «Amount» de la suscripción en Polar), en centavos. `null` = no se sabe. */
  montoCentavos: number | null
  motivo: MotivoEnRiesgo
  /** El estado en pocas palabras («Atrasado 4 días»). */
  texto: string
  /** Rojo (true) o amarillo. */
  grave: boolean
}

type FilaParaRiesgo = Pick<FilaCliente, 'ws' | 'nombre' | 'capa' | 'estado' | 'motivoRiesgo' | 'sinEntrar' | 'mrrUsd' | 'planAManoTxt'>
type IngresoParaRiesgo = Pick<ClienteResumen, 'clave' | 'ws' | 'nombre' | 'estado' | 'mrr' | 'diasAtraso'>

const dias = (n: number) => (n === 1 ? '1 día' : `${n} días`)

function textoDeRiesgo(motivo: MotivoEnRiesgo, d: { diasAtraso?: number | null; sinEntrar?: number | null }): string {
  switch (motivo) {
    case 'atrasado':
      return d.diasAtraso ? `Atrasado ${dias(d.diasAtraso)}` : 'Vence hoy'
    case 'cobro':
      return 'Cobro fallido'
    case 'pausado':
      return 'Pausado'
    case 'cortado':
      return 'Dejó de pagar'
    case 'sin-uso':
      return d.sinEntrar == null ? 'Nadie entró nunca' : `Sin entrar hace ${dias(d.sinEntrar)}`
  }
}

/**
 * Cuántos negocios en riesgo se leen (Polar: `LIMIT = 100`). Lo usan Customers › At Risk y la tarjeta «At Risk» del Overview,
 * que en Polar comparten la misma consulta (`useAtRisk`): la tarjeta muestra las primeras filas de ESTA lista y su número es el
 * total de ella («100+» si llegó al tope), app/admin/_polar/datos/resumen.ts `riesgoDeLaTarjeta`.
 */
export const LIMITE_AT_RISK = 100

/**
 * Los negocios en riesgo, uno por negocio y con su motivo más grave (Polar junta las suscripciones atrasadas y las que se
 * cancelan, sin repetir). El orden: el motivo, y adentro el que más paga primero.
 *
 * ⚠️ «Dejó de pagar» cuenta SÓLO si el negocio sigue activo y no tiene un plan a mano: uno que se fue hace meses no está
 *    en riesgo, ya se fue; y uno con meses gratis no tiene por qué pagar.
 */
export function clientesEnRiesgo(filas: readonly FilaParaRiesgo[], ingresos: readonly IngresoParaRiesgo[], limite = LIMITE_AT_RISK): ClienteEnRiesgo[] {
  const fila = new Map(filas.map((f) => [f.ws, f]))
  const out = new Map<string, ClienteEnRiesgo>()
  const poner = (c: ClienteEnRiesgo) => {
    const ya = out.get(c.clave)
    if (!ya || MOTIVOS_RIESGO.indexOf(c.motivo) < MOTIVOS_RIESGO.indexOf(ya.motivo)) out.set(c.clave, c)
  }
  for (const i of ingresos) {
    const f = i.ws != null ? fila.get(i.ws) : undefined
    const base = { clave: i.ws != null ? `ws:${i.ws}` : i.clave, ws: i.ws, nombre: f?.nombre ?? i.nombre, plan: f ? nombreDePlan(f.capa) : null }
    if (i.estado === 'atrasado') {
      poner({ ...base, montoCentavos: aCentavos(i.mrr), motivo: 'atrasado', texto: textoDeRiesgo('atrasado', i), grave: true })
    } else if (i.estado === 'cortado' && f && f.estado === 'activo' && !f.planAManoTxt) {
      poner({ ...base, montoCentavos: null, motivo: 'cortado', texto: textoDeRiesgo('cortado', {}), grave: false })
    }
  }
  for (const f of filas) {
    if (!f.motivoRiesgo) continue
    poner({
      clave: `ws:${f.ws}`, ws: f.ws, nombre: f.nombre, plan: nombreDePlan(f.capa),
      montoCentavos: aCentavos(f.mrrUsd), motivo: f.motivoRiesgo, texto: textoDeRiesgo(f.motivoRiesgo, f),
      grave: GRAVES.has(f.motivoRiesgo),
    })
  }
  return [...out.values()]
    .sort((a, b) =>
      MOTIVOS_RIESGO.indexOf(a.motivo) - MOTIVOS_RIESGO.indexOf(b.motivo)
      || (b.montoCentavos ?? -1) - (a.montoCentavos ?? -1)
      || a.nombre.localeCompare(b.nombre, 'es'))
    .slice(0, limite)
}

// ── Cost Drivers (TopCostCustomersList, CostDriversPage) ───────────────────────────────────────────────────────────

export type ClienteCosto = {
  ws: number
  nombre: string
  /** Llamadas a la IA en el período (los «events» de Polar). */
  llamadas: number
  /** Su parte del gasto de MaKo en el período, de 0 a 1. */
  share: number
  /** En centavos de dólar, con decimales (Polar los formatea con `subcent`). */
  costoCentavos: number
}

export type VistaCostos = {
  /** 'YYYY-MM'. */
  periodo: string
  /**
   * false = el gasto de Claude con la clave de MaKo se anota siempre en el workspace 1 (lib/costos-ia.ts): el corte por
   * negocio de ese período no es una medición y NO se muestra.
   */
  atribuible: boolean
  clientes: ClienteCosto[]
}

/** El mes en curso, en UTC (es la ventana de `resumenDelPeriodo`). */
export const mesActual = (ahoraMs: number) => new Date(ahoraMs).toISOString().slice(0, 7)

/**
 * LA regla del gasto de IA POR NEGOCIO (la de Cost Drivers, y la única: la ficha de un negocio la pregunta acá, 6/11/2026). El
 * corte por negocio de un período vale sólo si es ATRIBUIBLE: con filas de Claude de la clave de MaKo en el período, su
 * `workspace_id` lo pone `wsDeProveedor` (lib/anthropic-usage.ts), no la medición, y el reparto es una constante
 * (lib/costos-ia.ts marca cada corte `atribuible: false`). Entonces no se reparte: `null`. Si vale, lo de cada negocio es su
 * corte tal cual (el mismo `costoDe` de lib/costos-ia.ts: sin la clave del propio negocio ni el crédito de la plataforma).
 */
export function gastoPorNegocio(
  resumen: Pick<ResumenPeriodo, 'porWorkspace'>,
): ReadonlyMap<number, { llamadas: number; costUsd: number }> | null {
  if (!resumen.porWorkspace.every((c) => c.atribuible)) return null
  const out = new Map<number, { llamadas: number; costUsd: number }>()
  for (const c of resumen.porWorkspace) {
    const ws = Number(c.clave)
    if (Number.isSafeInteger(ws)) out.set(ws, { llamadas: c.llamadas, costUsd: c.costUsd })
  }
  return out
}

/**
 * Lo que MaKo gastó en IA por UN negocio en el período (la ficha › Overview: Costs, Profit y Profit Margin), con
 * `gastoPorNegocio`, así dice lo mismo que Cost Drivers para ese negocio y ese mes. No atribuible = no hay plata que decir. Un
 * negocio sin corte en un período atribuible no gastó nada (Cost Drivers no lo lista).
 */
export type CostoDelNegocio =
  | { periodo: string; atribuible: false }
  | { periodo: string; atribuible: true; llamadas: number; costoCentavos: number }

export function costoDelNegocio(resumen: Pick<ResumenPeriodo, 'periodo' | 'porWorkspace'>, ws: number): CostoDelNegocio {
  const gasto = gastoPorNegocio(resumen)
  if (!gasto) return { periodo: resumen.periodo, atribuible: false }
  const suyo = gasto.get(ws)
  return { periodo: resumen.periodo, atribuible: true, llamadas: suyo?.llamadas ?? 0, costoCentavos: (suyo?.costUsd ?? 0) * 100 }
}

/**
 * El gasto de IA de cada negocio del período (lo que le costó a MaKo, sin lo que pagó el negocio con su propia clave ni el
 * crédito de la plataforma), con `gastoPorNegocio`. Sólo los que gastaron algo y son negocios de la lista (no la plataforma).
 */
export function costosPorCliente(
  resumen: Pick<ResumenPeriodo, 'periodo' | 'costUsd' | 'porWorkspace'>,
  nombres: ReadonlyMap<number, string>,
  limite = 200,
): VistaCostos {
  const gasto = gastoPorNegocio(resumen)
  if (!gasto) return { periodo: resumen.periodo, atribuible: false, clientes: [] }
  const total = resumen.costUsd
  const clientes = [...gasto.entries()]
    .filter(([ws, corte]) => nombres.has(ws) && corte.costUsd > 0)
    .map(([ws, corte]) => ({
      ws,
      nombre: nombres.get(ws) ?? `Workspace ${ws}`,
      llamadas: corte.llamadas,
      share: total > 0 ? corte.costUsd / total : 0,
      costoCentavos: corte.costUsd * 100,
    }))
    .sort((a, b) => b.costoCentavos - a.costoCentavos || a.nombre.localeCompare(b.nombre, 'es'))
    .slice(0, limite)
  return { periodo: resumen.periodo, atribuible: true, clientes }
}

// ── Las props de cada página (lo que arma el page.tsx con las lecturas de clientes-server.ts) ─────────────────────

type LecturaClientes = Lectura<{ filas: ReadonlyArray<FilaParaRiesgo & Pick<FilaCliente, 'creado'>> }>
/** Overview cuenta los negocios de la lista (sin los clientes de una agencia): necesita su segmento. */
type LecturaClientesConSegmento = Lectura<{ filas: ReadonlyArray<FilaParaRiesgo & Pick<FilaCliente, 'creado' | 'segmentos'>> }>
type LecturaIngresos = Lectura<Pick<Ingresos, 'entradas' | 'clientes'>>
type LecturaCostos = Lectura<Pick<ResumenPeriodo, 'periodo' | 'costUsd' | 'porWorkspace'>>

const errorDe = <T,>(l: Lectura<T>): string | null => (l.ok ? null : l.error)
const avisosDe = (...ls: ReadonlyArray<Lectura<unknown>>): string[] => ls.flatMap((l) => (l.ok ? l.avisos : []))

export type PropsTop = { datos: DatosTop | null; error: string | null; avisos: string[]; desde: string }
export type PropsAtRisk = { atRisk: ClienteEnRiesgo[] | null; error: string | null; avisos: string[] }
export type PropsCostos = { costos: VistaCostos | null; error: string | null; mesDeCostos: string }
export type PropsOverview = {
  /** La fecha de alta (ISO) de cada negocio. */
  creados: string[]
  /** El alta más vieja: donde arranca «All Time». */
  desde: string
  top: DatosTop | null
  topError: string | null
  topAvisos: string[]
  atRisk: ClienteEnRiesgo[] | null
  atRiskError: string | null
  atRiskAvisos: string[]
  costos: VistaCostos | null
  costosError: string | null
  /** El mes del gasto de IA, ya dicho («nov 2026»). */
  mesDeCostos: string
}

/**
 * Top Customers: los pagos con su dueño (el rango lo elige el navegador). `desde` es donde arranca «All Time»: el alta más
 * vieja si se pasan las altas (en Overview el rango es el mismo del crecimiento), y si no el primer pago (antes no hay nada
 * que sumar, y así la página no lee la lista de negocios otra vez).
 */
export function vistaDeTop(ingresos: LecturaIngresos, ahoraMs: number, creados?: readonly string[]): PropsTop {
  const datos = ingresos.ok ? datosDeTop(ingresos.datos) : null
  return {
    datos,
    error: errorDe(ingresos),
    avisos: avisosDe(ingresos),
    desde: primerAlta(creados ?? (datos?.pagos ?? []).map((p) => `${p.fecha}T00:00:00`), ahoraMs),
  }
}

/**
 * At Risk: necesita las DOS lecturas. Sin la de los ingresos no se sabe quién está atrasado, y una lista sin ellos diría
 * «Nada en riesgo» sobre un negocio que debe: es un «no pude leer», no un vacío.
 */
export function vistaDeAtRisk(clientes: LecturaClientes, ingresos: LecturaIngresos, limite = LIMITE_AT_RISK): PropsAtRisk {
  if (!clientes.ok || !ingresos.ok) return { atRisk: null, error: errorDe(clientes) ?? errorDe(ingresos), avisos: [] }
  return { atRisk: clientesEnRiesgo(clientes.datos.filas, ingresos.datos.clientes, limite), error: null, avisos: avisosDe(clientes, ingresos) }
}

/** Cost Drivers: el gasto de IA del mes, con los nombres de la lista. */
export function vistaDeCostos(clientes: LecturaClientes, costos: LecturaCostos, periodo: string, limite = 200): PropsCostos {
  const mesDeCostos = mesTxt(periodo)
  if (!costos.ok) return { costos: null, error: costos.error, mesDeCostos }
  const nombres = new Map(clientes.ok ? clientes.datos.filas.map((f) => [f.ws, f.nombre] as const) : [])
  return { costos: costosPorCliente(costos.datos, nombres, limite), error: null, mesDeCostos }
}

/** Overview: el crecimiento (los negocios de la lista: sin los clientes de una agencia) y las tres listas cortas. */
export function vistaDeOverview(clientes: LecturaClientesConSegmento, ingresos: LecturaIngresos, costos: LecturaCostos, periodo: string, ahoraMs: number): PropsOverview {
  const creados = clientes.ok ? clientes.datos.filas.filter(esClienteDeMaKo).map((f) => f.creado) : []
  const top = vistaDeTop(ingresos, ahoraMs, creados)
  const riesgo = vistaDeAtRisk(clientes, ingresos, 5)
  const costo = vistaDeCostos(clientes, costos, periodo, 5)
  return {
    creados,
    desde: top.desde,
    top: top.datos,
    topError: top.error,
    topAvisos: top.avisos,
    atRisk: riesgo.atRisk,
    atRiskError: riesgo.error,
    atRiskAvisos: riesgo.avisos,
    costos: costo.costos,
    costosError: costo.error,
    mesDeCostos: costo.mesDeCostos,
  }
}
