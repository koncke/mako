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
//     plataforma; los clientes de una agencia, `esClienteDeMaKo`, sólo con el filtro «De agencias» y fuera del crecimiento);
//   · Top Customers: `vistaDeIngresos().entradas` (lib/admin-ingresos.ts), cada pago con la clave de su cliente: el navegador
//     suma los del rango elegido (como el `useTopCustomers` de Polar);
//   · At Risk: los atrasados y los que dejaron de pagar (ingresos) + los pausados, los cobros fallidos y los sin uso
//     (clientes);
//   · Cost Drivers: el gasto de IA del período (lib/costos-ia.ts) por workspace, repartido por negocio desde el 1/11/2026
//     (`REPARTO_DESDE`); lo anotado en la plataforma (Claude con la clave de MaKo) y lo de antes, en una línea aparte.
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
import { ETIQUETA_PARA_MIRAR, nombreDePlan, type ItemParaMirar, type MotivoParaMirar } from '@/lib/clientes-plataforma-reglas'
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

/**
 * Un renglón de la lista. Polar muestra nombre, nombre de facturación y email: un negocio de MaKo tiene su nombre y, en la
 * segunda línea (la que quedó vacía al sacar el email), lo que dice ⌘K de él: su agencia, su plan y si está pausado
 * (`detalleDeNegocio`, ./busqueda-tipos.ts; revisión del Cerebro del 6/11/2026, punto 35).
 */
export type ClienteDeLista = {
  ws: number
  nombre: string
  /** ISO: cuándo se dio de alta. */
  creado: string
  /** El workspace está activo (el filtro Active / Inactive de Polar). `false` = pausado (no hay otro estado). */
  activo: boolean
  /** El plan como lo vende MaKo (la segunda línea del renglón y el CSV). */
  plan: string
  estado: string
  /** Es cliente de una agencia (`esClienteDeMaKo` da false): sólo sale con el filtro «De agencias». */
  deAgencia: boolean
  /** El nombre de su agencia, si se sabe. */
  agencia: string | null
}

export const ORDENES = ['-created_at', 'created_at', 'name', '-name'] as const
export type OrdenLista = (typeof ORDENES)[number]
/**
 * El filtro de la lista (el `CustomerFilter` de Polar: All, Active, Inactive) y uno más de MaKo, «De agencias» (decisión del
 * Cerebro, 6/11/2026): los clientes de una agencia no son clientes de MaKo y no salen en «Todos», pero tienen que poder
 * encontrarse en la lista además de en la búsqueda ⌘K. Es un filtro más del mismo menú, como los de Polar.
 * ⚠️ El de Polar «Inactive» se dice «Pausados» (punto 35): un negocio inactivo es uno pausado (`workspaces.estado` no tiene
 *    otro), y «Inactivos» se confundía con «Sin uso» de At Risk. La clave de la URL sigue siendo `inactive`.
 */
export const FILTROS = ['all', 'active', 'inactive', 'agency'] as const
export type FiltroLista = (typeof FILTROS)[number]
/** El rótulo de cada filtro en el menú de la lista (el orden es el del menú). */
export const ROTULO_FILTRO: Record<FiltroLista, string> = {
  all: 'Todos',
  active: 'Activos',
  inactive: 'Pausados',
  agency: 'De agencias',
}

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

/**
 * Los renglones de la lista: TODOS los negocios, cada uno con su agencia si es cliente de una. Los de agencia no salen con los
 * filtros de siempre (`filtrarClientes`), sólo con «De agencias».
 */
export function listaDeClientes(
  filas: ReadonlyArray<Pick<FilaCliente, 'ws' | 'nombre' | 'creado' | 'estado' | 'capa' | 'segmentos'> & { agencia?: string | null }>,
): ClienteDeLista[] {
  return filas.map((f) => ({
    ws: f.ws,
    nombre: f.nombre,
    creado: f.creado,
    activo: f.estado === 'activo',
    plan: nombreDePlan(f.capa),
    estado: f.estado,
    deAgencia: !esClienteDeMaKo(f),
    agencia: esClienteDeMaKo(f) ? null : (f.agencia ?? null),
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
    // «De agencias» muestra SÓLO los clientes de una agencia; los demás filtros, sólo los de MaKo (`esClienteDeMaKo`).
    if ((filter === 'agency') !== c.deAgencia) return false
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

// ── A dónde lleva un cliente que pagó ───────────────────────────────────────────────────────────────────────────────

/**
 * La ficha de quien le pagó a MaKo: su negocio en Customers, o, si pagó sin cuenta de MaKo, su ficha del CRM de la plataforma
 * (`/crm/<lead>?ws=<plataforma>`, la misma regla que «Ver su ficha del CRM» de un pedido, `rutaDelCliente` de
 * web/Orders/OrderCustomerContext.tsx). `null` = no hay nada que abrir: la fila no se dibuja clicable (revisión del Cerebro del
 * 6/11/2026, punto 24: una fila de un lead sin cuenta parecía clicable y no abría nada).
 */
export function rutaDeQuienPaga(c: { ws: number | null; leadId?: number | null }, plataforma: number | null): string | null {
  if (c.ws != null) return rutaDeNegocio(c.ws)
  return c.leadId != null && plataforma != null ? `/crm/${c.leadId}?ws=${plataforma}` : null
}

/** `lead:<n>` → n. La clave la arma lib/admin-ingresos.ts. */
export const leadDeClave = (clave: string): number | null => {
  const m = /^lead:([1-9]\d{0,11})$/.exec(clave)
  return m ? Number(m[1]) : null
}

// ── Top Customers (TopCustomersList, TopCustomersPage) ─────────────────────────────────────────────────────────────

export type ClienteTop = {
  clave: string
  /** Su negocio en MaKo. `null` = pagó sin cuenta de MaKo (un lead del CRM de la plataforma): su ficha es la del CRM. */
  ws: number | null
  /** Su ficha en el CRM de la plataforma, si tiene (`rutaDeQuienPaga`). */
  leadId: number | null
  nombre: string
  /** Cuántos pagos entraron en el período (las «orders» de Polar). */
  pagos: number
  /** Lo que pagó en el período, en CENTAVOS de dólar (como lo formatea Polar). */
  totalCentavos: number
}

/** Un pago que entró, de quién (la clave de lib/admin-ingresos: `ws:<n>` o `lead:<id>`), cuándo (YYYY-MM-DD) y cuánto. */
export type PagoDeCliente = { cliente: string; fecha: string; usd: number }
export type QuienPaga = { clave: string; ws: number | null; leadId: number | null; nombre: string }
/** Lo que el navegador necesita para contar los que más pagaron en cualquier rango (el de Polar lo pide a su API). */
export type DatosTop = { pagos: PagoDeCliente[]; quien: QuienPaga[] }

/**
 * Los pagos con su dueño, de `vistaDeIngresos()`. Un pago sin su valor en dólares no suma (no se inventa una tasa) y uno sin
 * la clave de su cliente no se puede atribuir: los dos quedan afuera.
 */
export function datosDeTop(ingresos: Pick<Ingresos, 'entradas' | 'clientes'>): DatosTop {
  const quien = new Map<string, QuienPaga>(ingresos.clientes.map((c) => [c.clave, { clave: c.clave, ws: c.ws, leadId: c.leadId, nombre: c.nombre }]))
  const pagos: PagoDeCliente[] = []
  for (const e of ingresos.entradas) {
    if (!e.cliente || e.usd == null || !Number.isFinite(e.usd)) continue
    if (!quien.has(e.cliente)) quien.set(e.cliente, { clave: e.cliente, ws: wsDeClave(e.cliente), leadId: leadDeClave(e.cliente), nombre: e.nombre })
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
      return { clave, ws: q?.ws ?? wsDeClave(clave), leadId: q?.leadId ?? leadDeClave(clave), nombre: q?.nombre ?? clave, pagos: a.pagos, totalCentavos: aCentavos(a.usd) }
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
  /** Su ficha en el CRM de la plataforma, si tiene (la de un atrasado sin cuenta de MaKo: `rutaDeQuienPaga`). */
  leadId: number | null
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

type FilaParaRiesgo = Pick<FilaCliente, 'ws' | 'nombre' | 'capa' | 'estado' | 'motivoRiesgo' | 'sinEntrar' | 'mrrUsd' | 'planAManoTxt' | 'segmentos'>
type IngresoParaRiesgo = Pick<ClienteResumen, 'clave' | 'ws' | 'nombre' | 'estado' | 'mrr' | 'diasAtraso'> & { leadId?: number | null }

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
 * Los negocios en riesgo, uno por negocio y con su motivo más grave (Polar junta las suscripciones atrasadas y las que se
 * cancelan, sin repetir). El orden: el motivo, y adentro el que más paga primero.
 *
 * ⚠️ «Dejó de pagar» cuenta SÓLO si el negocio sigue activo y no tiene un plan a mano: uno que se fue hace meses no está
 *    en riesgo, ya se fue; y uno con meses gratis no tiene por qué pagar.
 * ⚠️ UN CLIENTE DE UNA AGENCIA NO VA (revisión del Cerebro del 6/11/2026, punto 7): no está en la lista de Customers
 *    (`esClienteDeMaKo`), y contarlo acá daba un riesgo que no se puede encontrar en ningún lado. Se saca en LOS DOS bucles:
 *    sacarlo de `filas` antes de llamar no alcanza, porque un atrasado entra por `ingresos`.
 * ⚠️ Es LA cuenta de riesgo de Admin: la usan la página At Risk, su columna en Customers › Overview y la tarjeta de la portada
 *    (`riesgoDeOverview`, ./resumen.ts). Antes la tarjeta tenía la suya y escondía a los atrasados.
 */
export function clientesEnRiesgo(filas: readonly FilaParaRiesgo[], ingresos: readonly IngresoParaRiesgo[], limite = 100): ClienteEnRiesgo[] {
  const fila = new Map(filas.map((f) => [f.ws, f]))
  const out = new Map<string, ClienteEnRiesgo>()
  const poner = (c: ClienteEnRiesgo) => {
    const ya = out.get(c.clave)
    if (!ya || MOTIVOS_RIESGO.indexOf(c.motivo) < MOTIVOS_RIESGO.indexOf(ya.motivo)) out.set(c.clave, c)
  }
  const leadDe = new Map<number, number>()
  for (const i of ingresos) if (i.ws != null && i.leadId != null && !leadDe.has(i.ws)) leadDe.set(i.ws, i.leadId)
  for (const i of ingresos) {
    const f = i.ws != null ? fila.get(i.ws) : undefined
    if (f && !esClienteDeMaKo(f)) continue
    const base = {
      clave: i.ws != null ? `ws:${i.ws}` : i.clave, ws: i.ws, leadId: i.leadId ?? null, nombre: f?.nombre ?? i.nombre,
      plan: f ? nombreDePlan(f.capa) : null,
    }
    if (i.estado === 'atrasado') {
      poner({ ...base, montoCentavos: aCentavos(i.mrr), motivo: 'atrasado', texto: textoDeRiesgo('atrasado', i), grave: true })
    } else if (i.estado === 'cortado' && f && f.estado === 'activo' && !f.planAManoTxt) {
      poner({ ...base, montoCentavos: null, motivo: 'cortado', texto: textoDeRiesgo('cortado', {}), grave: false })
    }
  }
  for (const f of filas) {
    if (!f.motivoRiesgo || !esClienteDeMaKo(f)) continue
    poner({
      clave: `ws:${f.ws}`, ws: f.ws, leadId: leadDe.get(f.ws) ?? null, nombre: f.nombre, plan: nombreDePlan(f.capa),
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

// ── «Para mirar», adentro de At Risk ─────────────────────────────────────────────────────────────────────────────────

/**
 * Lo que la pantalla vieja de Customers llamaba «Para mirar» y Polar no tiene (decisión del Cerebro, 6/11/2026: «entra en At
 * Risk»): lo que pide atención sin ser un riesgo de cobro. Los motivos que At Risk ya cuenta (pausado, cobro fallido, sin uso)
 * no se repiten acá: la regla es `paraMirar` (lib/clientes-plataforma-reglas.ts), la misma que lee la API de MaKo.
 * ⚠️ Va en su PROPIA tabla, debajo de la de riesgo, y no suma al «At risk» del Overview: un negocio nuevo o en prueba no está
 *    en riesgo, y contarlo inflaría ese número.
 */
export const MOTIVOS_SOLO_PARA_MIRAR: ReadonlySet<MotivoParaMirar> = new Set(['pago', 'regalo', 'sin-empezar', 'prueba', 'nuevo'])

export type ClienteParaMirar = {
  ws: number
  nombre: string
  plan: string | null
  motivo: MotivoParaMirar
  /** La etiqueta («Pago pendiente») y lo que pasa («Tiene un pago esperando»). */
  rotulo: string
  texto: string
  tono: 'bad' | 'warn' | 'info' | 'good'
}

/** Los de «Para mirar» que no están ya en la tabla de riesgo, en el orden de `paraMirar` (el más urgente primero). */
export function clientesParaMirar(
  items: readonly ItemParaMirar[],
  enRiesgo: readonly Pick<ClienteEnRiesgo, 'ws'>[],
  filas: readonly Pick<FilaCliente, 'ws' | 'capa'>[],
): ClienteParaMirar[] {
  const yaEnRiesgo = new Set(enRiesgo.map((c) => c.ws).filter((ws): ws is number => ws != null))
  const capa = new Map(filas.map((f) => [f.ws, f.capa] as const))
  return items
    .filter((i) => MOTIVOS_SOLO_PARA_MIRAR.has(i.motivo) && !yaEnRiesgo.has(i.ws))
    .map((i) => {
      const c = capa.get(i.ws)
      return {
        ws: i.ws, nombre: i.nombre, plan: c ? nombreDePlan(c) : null, motivo: i.motivo,
        rotulo: ETIQUETA_PARA_MIRAR[i.motivo].rotulo, texto: i.texto, tono: ETIQUETA_PARA_MIRAR[i.motivo].tono,
      }
    })
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

/**
 * Desde cuándo el gasto de IA se reparte por negocio (UTC). Desde el 17/10/2026 cada fila de gasto queda en el negocio que la
 * pidió, salvo Claude con la clave de MaKo, que va a la plataforma (lib/costos-ia.ts, la cabecera); se reparte desde el primer
 * mes entero con esa regla. Antes, todo Claude con la clave de MaKo se anotaba en el workspace 1: ese gasto no se puede
 * repartir (revisión del Cerebro, 6/11/2026, punto 11).
 */
export const REPARTO_DESDE = '2026-11-01T00:00:00.000Z'

/**
 * El gasto de IA de una ventana, partido en `REPARTO_DESDE` (lo lee clientes-server.ts con `partirEnElReparto`).
 * `antes`: lo de antes de esa fecha adentro de la ventana, sólo el total (null = la ventana arranca en esa fecha o después).
 * `despues`: lo de desde esa fecha, por workspace (null = la ventana es toda de antes).
 * `plataforma`: el workspace de la plataforma; lo anotado ahí es Claude con la clave de MaKo, que no es de ningún negocio.
 */
export type GastoParaRepartir = {
  periodo: string
  antes: Pick<ResumenPeriodo, 'costUsd' | 'llamadas'> | null
  despues: Pick<ResumenPeriodo, 'costUsd' | 'porWorkspace'> | null
  plataforma: number | null
}

/** Una línea de lo que no se reparte por negocio (Claude con la clave de MaKo, o lo de antes del 1/11). */
export type GastoSinRepartir = { llamadas: number; costoCentavos: number }

export type VistaCostos = {
  /** El mes ('YYYY-MM') o el rango de Cost Drivers. */
  periodo: string
  /** false = el período es entero de antes de `REPARTO_DESDE`: no hay corte por negocio y NO se muestra un número. */
  atribuible: boolean
  clientes: ClienteCosto[]
  /** Lo anotado en la plataforma (Claude con la clave de MaKo): no se reparte. null = nada en el período. */
  deMako: GastoSinRepartir | null
  /** Lo de antes de `REPARTO_DESDE`, si el período lo cruza: no se reparte. null = nada antes. */
  antes: GastoSinRepartir | null
}

/** La fecha de `REPARTO_DESDE`, dicha («1 nov 2026»). */
export const REPARTO_DESDE_TXT = '1 nov 2026'

/**
 * Dónde se parte una ventana [desde, hasta) en `REPARTO_DESDE`: lo que se lee entero de antes y lo de después (`null` = no hay
 * esa parte). `desde` null = sin borde (desde siempre); `hasta` null = hasta ahora.
 */
export function partirEnElReparto(
  desde: string | null,
  hasta: string | null,
): { antes: { desde: string | null; hasta: string } | null; despues: { desde: string; hasta: string | null } | null } {
  const corte = Date.parse(REPARTO_DESDE)
  const d = desde == null ? -Infinity : Date.parse(desde)
  const h = hasta == null ? Infinity : Date.parse(hasta)
  return {
    antes: d < corte ? { desde, hasta: h <= corte && hasta != null ? hasta : REPARTO_DESDE } : null,
    despues: h > corte ? { desde: d >= corte && desde != null ? desde : REPARTO_DESDE, hasta } : null,
  }
}

/** La ventana UTC de un mes «YYYY-MM» (la de `resumenDelPeriodo`): del primer instante al primero del mes siguiente. */
export function ventanaDelMes(mes: string): { desde: string; hasta: string } {
  const [y, m] = mes.split('-').map(Number)
  return { desde: new Date(Date.UTC(y, m - 1, 1)).toISOString(), hasta: new Date(Date.UTC(y, m, 1)).toISOString() }
}

// ── Cost Drivers con el selector de rango de Polar ────────────────────────────────────────────────────────────────

/**
 * Los rangos del selector de Polar (los de `CHART_RANGES`, app/admin/_polar/web/utils/metrics.ts), en el orden del control.
 * Cost Drivers los lee de la URL (`?range=`) porque el gasto lo lee el server; el default es el de Polar, «30d».
 */
export const RANGOS_COSTOS = ['all_time', '12m', '3m', '30d', 'today'] as const
export type RangoCostos = (typeof RANGOS_COSTOS)[number]
export const rangoDeParam = (v: string | string[] | null | undefined): RangoCostos => {
  const x = Array.isArray(v) ? v[0] : v
  return (RANGOS_COSTOS as readonly string[]).includes(x ?? '') ? (x as RangoCostos) : '30d'
}

const ROTULO_RANGO_COSTOS: Record<RangoCostos, string> = {
  all_time: 'Gasto de IA desde siempre',
  '12m': 'Gasto de IA de los últimos 12 meses',
  '3m': 'Gasto de IA de los últimos 3 meses',
  '30d': 'Gasto de IA de los últimos 30 días',
  today: 'Gasto de IA de hoy',
}

/**
 * La ventana EXACTA de cada rango, como `getMetricsRangeDates` de Polar (hoy menos 12 o 3 meses, menos 30 días, el principio de
 * hoy), sobre `created_at` y en UTC (el día del gasto de IA, `porDia` de lib/costos-ia.ts). «Desde siempre» no tiene borde.
 */
export function ventanaDeCostos(range: RangoCostos, ahoraMs: number): { desde: string | null; hasta: string; rotulo: string } {
  const fin = new Date(ahoraMs)
  const inicio = new Date(ahoraMs)
  if (range === '12m') inicio.setUTCMonth(inicio.getUTCMonth() - 12)
  else if (range === '3m') inicio.setUTCMonth(inicio.getUTCMonth() - 3)
  else if (range === '30d') inicio.setUTCDate(inicio.getUTCDate() - 30)
  else if (range === 'today') inicio.setUTCHours(0, 0, 0, 0)
  return {
    desde: range === 'all_time' ? null : inicio.toISOString(),
    hasta: fin.toISOString(),
    rotulo: ROTULO_RANGO_COSTOS[range],
  }
}

/** Las props de la página Cost Drivers: las de la lista corta, con el rango elegido y lo que dice el subtítulo. */
export type PropsCostDrivers = PropsCostos & { range: RangoCostos; rotulo: string }

/** El mes en curso, en UTC (es la ventana de `resumenDelPeriodo`). */
export const mesActual = (ahoraMs: number) => new Date(ahoraMs).toISOString().slice(0, 7)

/**
 * El gasto de IA de cada negocio del período (lo que le costó a MaKo, sin lo que pagó el negocio con su propia clave ni el
 * crédito de la plataforma), desde `REPARTO_DESDE`: sólo los que gastaron algo y son negocios de la lista. La parte de cada uno
 * es del total repartible (el de desde esa fecha, con lo de la plataforma adentro). Aparte, en una línea cada uno: lo anotado
 * en la plataforma (Claude con la clave de MaKo) y lo de antes de esa fecha si el período la cruza. Un período entero de antes
 * no se reparte (`atribuible: false`): no se muestra ningún número por negocio.
 */
export function costosPorCliente(gasto: GastoParaRepartir, nombres: ReadonlyMap<number, string>, limite = 200): VistaCostos {
  const sinRepartir = (r: { llamadas: number; costUsd: number } | null | undefined): GastoSinRepartir | null =>
    r && r.costUsd > 0 ? { llamadas: r.llamadas, costoCentavos: r.costUsd * 100 } : null
  const antes = sinRepartir(gasto.antes)
  if (!gasto.despues) return { periodo: gasto.periodo, atribuible: false, clientes: [], deMako: null, antes: null }
  const total = gasto.despues.costUsd
  const plataforma = gasto.plataforma
  const clientes = gasto.despues.porWorkspace
    .map((c) => ({ ws: Number(c.clave), corte: c }))
    .filter(({ ws, corte }) => ws !== plataforma && nombres.has(ws) && corte.costUsd > 0)
    .map(({ ws, corte }) => ({
      ws,
      nombre: nombres.get(ws) ?? `Workspace ${ws}`,
      llamadas: corte.llamadas,
      share: total > 0 ? corte.costUsd / total : 0,
      costoCentavos: corte.costUsd * 100,
    }))
    .sort((a, b) => b.costoCentavos - a.costoCentavos || a.nombre.localeCompare(b.nombre, 'es'))
    .slice(0, limite)
  const deMako = plataforma == null ? null : sinRepartir(gasto.despues.porWorkspace.find((c) => Number(c.clave) === plataforma))
  return { periodo: gasto.periodo, atribuible: true, clientes, deMako, antes }
}

// ── Las props de cada página (lo que arma el page.tsx con las lecturas de clientes-server.ts) ─────────────────────

type LecturaClientes = Lectura<{ filas: ReadonlyArray<FilaParaRiesgo & Pick<FilaCliente, 'creado'>>; paraMirar?: readonly ItemParaMirar[] }>
/** Overview cuenta los negocios de la lista (sin los clientes de una agencia): necesita su segmento. */
type LecturaClientesConSegmento = Lectura<{ filas: ReadonlyArray<FilaParaRiesgo & Pick<FilaCliente, 'creado' | 'segmentos'>> }>
type LecturaIngresos = Lectura<Pick<Ingresos, 'entradas' | 'clientes'>>
type LecturaCostos = Lectura<GastoParaRepartir>

const errorDe = <T,>(l: Lectura<T>): string | null => (l.ok ? null : l.error)
const avisosDe = (...ls: ReadonlyArray<Lectura<unknown>>): string[] => ls.flatMap((l) => (l.ok ? l.avisos : []))

export type PropsTop = { datos: DatosTop | null; error: string | null; avisos: string[]; desde: string }
export type PropsAtRisk = {
  atRisk: ClienteEnRiesgo[] | null
  error: string | null
  avisos: string[]
  /** «Para mirar» (la tabla de abajo de la página). `null` = la lectura no lo trae (el Overview no lo usa). */
  paraMirar: ClienteParaMirar[] | null
}
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
export function vistaDeAtRisk(clientes: LecturaClientes, ingresos: LecturaIngresos, limite = 100): PropsAtRisk {
  if (!clientes.ok || !ingresos.ok) return { atRisk: null, error: errorDe(clientes) ?? errorDe(ingresos), avisos: [], paraMirar: null }
  const atRisk = clientesEnRiesgo(clientes.datos.filas, ingresos.datos.clientes, limite)
  const paraMirar = clientes.datos.paraMirar ? clientesParaMirar(clientes.datos.paraMirar, atRisk, clientes.datos.filas) : null
  return { atRisk, error: null, avisos: avisosDe(clientes, ingresos), paraMirar }
}

/** Cost Drivers: el gasto de IA del período (un mes 'YYYY-MM' o un rango de `RANGOS_COSTOS`), con los nombres de la lista. */
export function vistaDeCostos(clientes: LecturaClientes, costos: LecturaCostos, periodo: string, limite = 200): PropsCostos {
  // `mesDeCostos` sólo se dice de un mes (el Overview); la página dice su rango con `ventanaDeCostos().rotulo`.
  const mesDeCostos = /^\d{4}-\d{2}$/.test(periodo) ? mesTxt(periodo) : ''
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
