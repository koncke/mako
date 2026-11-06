// =============================================================================
// Overview de Admin (la portada del dashboard de Polar, `(home)/DashboardPage.tsx`) con lo que MaKo tiene para llenarla
// =============================================================================
// Puro (sin server-only): lo usan la vista del navegador (app/admin/_polar/web/DashboardOverview), los datos de ejemplo y
// los tests. La lectura de la base, en ./resumen-server.ts. De dónde sale cada widget:
//   · Revenue y la sección Metrics: lib/admin-ingresos.ts (`vistaDeIngresos`), lo que ENTRÓ por mes. Overview y
//     Analytics › Metrics son los ÚNICOS lugares con el gráfico de ingresos (Martín, 6/11/2026).
//   · Activity: los pagos que entraron (la misma vista) y lo que hizo MaKo (lib/actividad.ts, `vistaDeActividad`).
//   · Top Customers: los que más pagaron desde el primer pago (los clientes de `vistaDeIngresos`).
//   · At Risk: los negocios en riesgo de lib/clientes-plataforma.ts (`vistaDeClientes`): pausados, con un cobro fallido o
//     sin uso.
//   · Lo que ESPERA a Martín (los banners de arriba, donde Polar pone el estado de la organización y las disputas): quién
//     pidió entrar (lib/pedidos-ingreso.ts), qué pidieron las agencias (lib/agencia.ts) y quién pidió eliminar su cuenta
//     (lib/baja-cuenta.ts).
//
// ⚠️ LA PLATA VA EN CENTAVOS, como en Polar (`formatCurrency` divide por 100). MaKo guarda dólares: se multiplica acá.
// ⚠️ «NO PUDE LEER» ES OTRO ESTADO: cada lectura viaja como `Lectura` y la vista dice el error, nunca un cero.

import type { Entrada, MesIngresos, Movimiento } from '@/lib/admin-ingresos-reglas'
import { haceTxt } from '@/lib/clientes-plataforma-reglas'
import { diasQueQuedan, fechaDeLaBaja } from '@/lib/baja-cuenta-reglas'
import { detalleDelPedido } from '@/lib/pedidos-ingreso-reglas'
import { ROTULO_ROL, type RolAlta } from '@/lib/agencia-altas'
import { ALL_METRICS } from '@/app/admin/_polar/web/utils/metrics'
import type { MetricaSlug } from './metricas'
import type { PlanAlta } from './alta'

/** Lo que leyó el server: los datos, o por qué no se pudo. */
export type Lectura<T> = { ok: true; datos: T } | { ok: false; error: string }

export const aCentavos = (usd: number) => Math.round(usd * 100)

// ── Los links viejos (/admin?tab=…) ────────────────────────────────────────────────────────────────────────────────
// /admin?tab=… viaja en mails ya mandados, en marcadores y en otras pantallas (lib/pedidos-ingreso-reglas.ts,
// `destinoDeCustomers` de app/admin/pestanas-reglas.ts). La portada lo manda a su sección nueva ANTES de leer nada.

export const ID_WS = /^[1-9]\d{0,11}$/

type Param = string | string[] | undefined
const uno = (v: Param): string | undefined => (Array.isArray(v) ? v[0] : v)

/** A dónde va un `/admin?tab=…` viejo. `null` = no es un link viejo: se dibuja Overview. */
export function destinoDeTabViejo(sp: { tab?: Param; cliente?: Param; cuenta?: Param }): string | null {
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
      const n = ws(sp.cuenta)
      return n ? `/admin/customers/${n}` : '/admin/customers'
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

export type ClienteTop = { clave: string; nombre: string; ws: number | null; pagos: number; totalCentavos: number }
/** `parte`: el % de todo lo cobrado que pagaron los de la lista (`null` sin nada cobrado). */
export type TopClientes = { filas: ClienteTop[]; parte: number | null }

/**
 * Los que más pagaron (Polar: los 5 con más `net_revenue` de los últimos 12 meses). MaKo tiene lo pagado por cliente desde
 * SIEMPRE (`ClienteResumen.total`), no por período: el titular dice «del total cobrado», no «de los últimos 12 meses».
 */
export function topClientes(
  clientes: ReadonlyArray<{ clave: string; nombre: string; ws: number | null; pagos: number; total: number }>,
  cobradoTotal: number,
  n = 5,
): TopClientes {
  const filas = clientes
    .filter((c) => c.total > 0)
    .slice()
    .sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre, 'es'))
    .slice(0, n)
    .map((c) => ({ clave: c.clave, nombre: c.nombre, ws: c.ws, pagos: c.pagos, totalCentavos: aCentavos(c.total) }))
  const suma = filas.reduce((s, c) => s + c.totalCentavos, 0)
  const total = aCentavos(cobradoTotal)
  return { filas, parte: total > 0 ? Math.round((suma / total) * 100) : null }
}

// ── At Risk ───────────────────────────────────────────────────────────────────────────────────────────────────────

export type MotivoRiesgo = 'pausado' | 'cobro' | 'sin-uso'
export type FilaRiesgo = { ws: number; nombre: string; plan: string; motivo: string; mrrCentavos: number }
export type Riesgo = { filas: FilaRiesgo[]; total: number }

/** Lo que Polar escribe como «Past due» / «Cancels …», con los motivos de MaKo. */
export function motivoDeRiesgoTxt(motivo: MotivoRiesgo, sinEntrar: number | null): string {
  if (motivo === 'pausado') return 'Pausado'
  if (motivo === 'cobro') return 'Cobro fallido'
  return sinEntrar == null ? 'Nadie entró nunca' : `Sin entrar · ${haceTxt(sinEntrar).toLowerCase()}`
}

const PESO_RIESGO: Record<MotivoRiesgo, number> = { pausado: 0, cobro: 1, 'sin-uso': 2 }

/** Los negocios en riesgo de `vistaDeClientes`, el más grave primero (y a igual motivo, el que más paga). */
export function filasDeRiesgo(
  filas: ReadonlyArray<{ ws: number; nombre: string; plan: string; riesgo: boolean; motivoRiesgo: MotivoRiesgo | null; sinEntrar: number | null; mrrUsd: number }>,
): Riesgo {
  const en = filas.filter((f): f is typeof f & { motivoRiesgo: MotivoRiesgo } => f.riesgo && f.motivoRiesgo != null)
  const orden = en
    .slice()
    .sort((a, b) => PESO_RIESGO[a.motivoRiesgo] - PESO_RIESGO[b.motivoRiesgo] || b.mrrUsd - a.mrrUsd || a.nombre.localeCompare(b.nombre, 'es'))
  return {
    total: orden.length,
    filas: orden.map((f) => ({ ws: f.ws, nombre: f.nombre, plan: f.plan, motivo: motivoDeRiesgoTxt(f.motivoRiesgo, f.sinEntrar), mrrCentavos: aCentavos(f.mrrUsd) })),
  }
}

// ── Activity ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** Una fila del widget Activity: el título, de quién, cuándo (corto) y a dónde lleva. */
export type FilaActividad = { id: string; titulo: string; detalle: string | null; cuando: string; href: string | null }
/** `hoy`: cuántos eventos hubo hoy (pagos y todo lo que corrió MaKo); `hoyMas`: puede haber más que los leídos. */
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
 * lo que corrió MaKo (con su hora): se muestran sus ACCIONES (lo que cambió algo); las lecturas cuentan para «hoy».
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
  const deHoy = p.acciones.filter((a) => a.dia === p.hoy).length
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
  ingreso: Lectura<{ pedidos: PedidoIngreso[]; hayMas: boolean }>
  /** ⚠️ lib/agencia.ts devuelve `[]` cuando no puede leer: acá no se distingue «no hay» de «no pude» (se anota). */
  agencias: { carteras: PedidoCartera[]; altas: PedidoAlta[] }
  bajas: Lectura<{ bajas: PedidoBaja[] }>
  planes: PlanAlta[]
  planPorDefecto: string
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

/** El título de cada banner (el `title` del `Alert` de Polar). `null` = no hay nada: el banner no se dibuja. */
export function tituloDeIngreso(n: number): string | null {
  if (n <= 0) return null
  return n === 1 ? 'Una persona quiere entrar a MaKo' : `${n} personas quieren entrar a MaKo`
}
export function tituloDeAgencias(n: number): string | null {
  if (n <= 0) return null
  return n === 1 ? 'Una agencia espera tu firma' : `${n} pedidos de agencias esperan tu firma`
}
export function tituloDeBajas(n: number): string | null {
  if (n <= 0) return null
  return n === 1 ? 'Una persona pidió eliminar su cuenta' : `${n} personas pidieron eliminar su cuenta`
}

// ── Todo junto ────────────────────────────────────────────────────────────────────────────────────────────────────

export type ResumenAdmin = {
  ingresos: Lectura<IngresosResumen>
  top: Lectura<TopClientes>
  riesgo: Lectura<Riesgo>
  actividad: Lectura<Actividad>
  esperan: Esperan
  /** Lo que no se pudo leer del todo: lo que se muestra puede quedarse corto. */
  avisos: string[]
}
