// =============================================================================
// Admin › Customers › <negocio>: la ficha de UN negocio, con las subpáginas de Polar (Overview · Usage · Events · Members) (6/11/2026)
// =============================================================================
// Polar (polarsource/polar, Apache-2.0) arma la ficha de un Customer en …/(header)/customers/[customerId]/ con los componentes de
// clients/apps/web/src/components/Customer/CustomerPage/. En MaKo un Customer es un NEGOCIO (un workspace), y la URL es
// /admin/customers/<ws>. Lo que Polar pide por un hook en el navegador, acá lo lee el server
// (app/admin/_polar/datos/cliente-server.ts) y estas funciones PURAS lo convierten en las props de cada vista.
//
// DE DÓNDE SALE CADA DATO:
//   · la cabecera y el «Alta» (plan, estado, onboarding, prueba, plan a mano, agencia): `getWorkspace` y la fila del negocio de
//     `vistaDeClientes()` (lib/clientes-plataforma.ts), la misma que dibuja la lista de la izquierda;
//   · Metrics, Subscriptions y Orders: `vistaDeIngresos()` (lib/admin-ingresos.ts) — sus `entradas` (cada pago, con la clave
//     `ws:<n>` del cliente) y sus `clientes` (lo que paga por mes HOY). Sin gráfico de ingresos (Martín, 6/11/2026: nunca en
//     Customers): sólo las cifras, en las cajas de Polar;
//   · las Conexiones: `integracionConectada` de cada servicio de /metodo y las computadoras (lib/ia-pc.ts `listarPcDelNegocio`);
//   · Usage: `actividad_uso` (lib/actividad.ts, el día y la tab de cada uno) y las llamadas de IA anotadas en ese negocio
//     (`anthropic_usage` con su `workspace_id`);
//   · Events (y el Timeline): los pagos, los movimientos de su suscripción, lo que hizo MaKo (`actividad_acciones`), sus errores
//     (`errores_app`) y sus reportes (`tickets`);
//   · Members: sus personas (`usuarios` con ese `workspace_id`). Es el ÚNICO lugar de Admin donde se ven y se gestionan.
//
// ⚠️ PURO: sin `server-only`. Lo usan el navegador (el rango, el filtro de eventos, el formulario) y
//    tests/admin-polar-cliente.test.ts. De los módulos del server, sólo `import type`.
// =============================================================================

import type { CapaId } from '@/lib/capas'
import { CAPAS_VENDIBLES } from '@/lib/capas'
import { nombreDePlan } from '@/lib/clientes-plataforma-reglas'
import { DIAS_PLAN_A_MANO, rotuloDeDias } from '@/lib/plan-a-mano-reglas'
import type { Movimiento } from '@/lib/admin-ingresos-reglas'
import type { FilaUso } from '@/lib/actividad-reglas'
import type { RolWorkspace } from '@/lib/auth-session'
import { aCentavos } from './metricas'
import type { TimeInterval } from './polar-tipos'
import { medioEnTexto, ROTULO_ESTADO_PEDIDO, totalesDePedidos, type Pedido, type SuscripcionVenta } from './ventas'

export { aCentavos }

/** La ficha y sus subpáginas (la ruta de Customers la define app/admin/_polar/datos/clientes.ts). */
export const rutaDeFicha = (ws: number, sub?: 'usage' | 'events' | 'members') => `/admin/customers/${ws}${sub ? `/${sub}` : ''}`

/**
 * El detalle de un pago y de una suscripción, en Admin › Sales (sus ids los define app/admin/_polar/datos/ventas.ts:
 * `p-<pago>`, `c-<cobro>`, `r-<recibo>` y `l-<lead>`, `c-<cobro>`). Polar: /sales/<id> y /sales/subscriptions/<id>.
 */
export const rutaDePedido = (p: Pick<Pedido, 'id'>) => `/admin/sales/${p.id}`
export const rutaDeSuscripcion = (s: Pick<SuscripcionVenta, 'id'>) => `/admin/sales/subscriptions/${s.id}`

/** El id del negocio que viaja en el path. `null` = no es un id (la página contesta 404). Nunca `?ws=`. */
export function wsDeId(id: string | null | undefined): number | null {
  const s = String(id ?? '')
  if (!/^[1-9]\d{0,11}$/.test(s)) return null
  const n = Number(s)
  return Number.isSafeInteger(n) ? n : null
}

// ── La cabecera (CustomerPageShell + CustomerHeader) ───────────────────────────────────────────────────────────────

export type NegocioCabecera = {
  ws: number
  nombre: string
  /** El plan como lo vende MaKo («MaKo Pro»). */
  plan: string
  capa: CapaId
  estado: 'activo' | 'pausado'
  /** El email de quien administra su cuenta, para «Contactar» (el mailto de Polar). `null` = no tiene un admin activo. */
  contacto: string | null
  /** Su plan a mano, ya dicho («Gratis hasta el 1 de mayo de 2027»). `null` = no tiene (o no se pudo leer). */
  planAMano: string | null
}

// ── Overview › Metrics, Subscriptions y Orders (CustomerMetricsOverview, sin los gráficos, y sus dos tablas) ────────
// Los pedidos y las suscripciones son los de Admin › Sales (`vistaOrders`, `vistaSuscripciones`: app/admin/_polar/datos/
// ventas-server.ts), los del negocio: el mismo estado (devuelto, anulado, atrasada), los mismos ids y el mismo detalle. Una tabla
// propia acá sería la segunda cuenta de lo mismo.

/** Los pedidos de un negocio (los de su cuenta, `cliente.ws`), el más nuevo primero. */
export function pedidosDelNegocio(pedidos: readonly Pedido[], ws: number): Pedido[] {
  return pedidos.filter((p) => p.cliente?.ws === ws).sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : b.id.localeCompare(a.id)))
}

/** Las suscripciones de un negocio, las vivas primero (atrasadas, activas, cortadas). */
export function suscripcionesDelNegocio(subs: readonly SuscripcionVenta[], ws: number): SuscripcionVenta[] {
  const peso: Record<SuscripcionVenta['estado'], number> = { past_due: 0, active: 1, canceled: 2 }
  return subs.filter((s) => s.cliente.ws === ws).sort((a, b) => peso[a.estado] - peso[b.estado] || String(b.empezo ?? '').localeCompare(String(a.empezo ?? '')))
}

export type CifrasNegocio = {
  /** Lo que pagó en el rango, en CENTAVOS (como lo dibuja Polar). Lo devuelto no suma (`totalesDePedidos` de Sales). */
  revenue: number
  /** Lo que paga por mes HOY, en centavos (no depende del rango). */
  mrr: number
  /** Cuántos pedidos hubo en el rango. */
  orders: number
  /** Pedidos del rango sin su valor en dólares (no suman). */
  sinDolares: number
}

/** Las cifras de las cajas de Metrics: lo pagado y los pedidos en el rango (días YYYY-MM-DD, los dos incluidos) y el MRR de hoy. */
export function cifrasDelRango(pedidos: readonly Pedido[], mrrUsd: number, desde: string, hasta: string): CifrasNegocio {
  const t = totalesDePedidos(pedidos.filter((p) => p.fecha >= desde && p.fecha <= hasta))
  return { revenue: t.revenue, mrr: aCentavos(mrrUsd), orders: t.orders, sinDolares: t.sinDolares }
}

// ── Overview › Details (CustomerDetailsSection): su identidad, su alta y sus conexiones ───────────────────────────

export type AltaNegocio = {
  /** ISO: cuándo se dio de alta. */
  creado: string
  plan: string
  estado: 'activo' | 'pausado'
  /** `null` = no se pudo leer (no es «no lo terminó»). */
  onboardingHecho: boolean | null
  /** Está en su prueba con tarjeta (un cobro de prueba vivo). */
  prueba: boolean | null
  planAMano: string | null
  /** Partner, Agency, Cliente, Cliente de agencia (lib/clientes-plataforma-reglas.ts `ROTULO_SEGMENTO`). */
  segmentos: string[]
  /** El nombre de la agencia que lo lleva, si es cliente de una. */
  agencia: string | null
}

export type ConexionNegocio = { key: string; nombre: string; conectada: boolean }

export type ComputadoraNegocio = {
  id: number
  nombre: string
  /** De quién es (la persona que la conectó). */
  persona: string
  sistema: 'Windows' | 'Mac' | null
  enLinea: boolean
  conectadaAt: string | null
}

/** Las conexiones que muestra la sección: las conectadas primero, y sin las que no están (Polar no lista lo vacío). */
export function conexionesConectadas(conexiones: readonly ConexionNegocio[]): ConexionNegocio[] {
  return conexiones.filter((c) => c.conectada).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

// ── Events y Timeline (CustomerEventsView, CustomerTimeline) ───────────────────────────────────────────────────────

/** Los «system events» son lo que pasa en MaKo con la cuenta; los «user events», lo que hizo el negocio (por MaKo o reportando). */
export type FuenteEvento = 'system' | 'user'
export type ImportanciaEvento = 'high' | 'medium' | 'low'

export const NOMBRES_EVENTO = {
  'customer.created': { label: 'Se creó la cuenta', source: 'system', importancia: 'medium' },
  'order.paid': { label: 'Pago recibido', source: 'system', importancia: 'high' },
  'order.refunded': { label: 'Pago devuelto', source: 'system', importancia: 'high', negativo: true },
  'order.voided': { label: 'Pago anulado', source: 'system', importancia: 'high', negativo: true },
  'subscription.created': { label: 'Empezó a pagar por mes', source: 'system', importancia: 'high' },
  'subscription.reactivated': { label: 'Volvió a pagar por mes', source: 'system', importancia: 'high' },
  'subscription.updated': { label: 'Cambió lo que paga por mes', source: 'system', importancia: 'medium' },
  'subscription.canceled': { label: 'Dejó de pagar por mes', source: 'system', importancia: 'high', negativo: true },
  'error.app': { label: 'Error en la app', source: 'system', importancia: 'high', negativo: true },
  'mako.action': { label: 'Acción de MaKo', source: 'user', importancia: 'medium' },
  'ticket.created': { label: 'Reporte a soporte', source: 'user', importancia: 'medium' },
} as const satisfies Record<string, { label: string; source: FuenteEvento; importancia: ImportanciaEvento; negativo?: true }>

export type NombreEvento = keyof typeof NOMBRES_EVENTO
export const esNombreEvento = (s: string): s is NombreEvento => Object.prototype.hasOwnProperty.call(NOMBRES_EVENTO, s)

export type EventoNegocio = {
  id: string
  /** ISO (o YYYY-MM-DD para lo que se registra por día: un pago). */
  timestamp: string
  name: NombreEvento
  /** Lo que se lee en el renglón. */
  label: string
  source: FuenteEvento
  importancia: ImportanciaEvento
  /** La segunda línea del Timeline («US$ 238 · Transferencia»). */
  resumen: string | null
  negativo: boolean
  /** A dónde lleva (el pago a Sales). `null` = no tiene una página propia en Admin. */
  href: string | null
  /** Lo que se ve al abrir el renglón en Events (el EventCard de Polar), como pares rótulo / valor. */
  detalle: Array<[string, string]>
}

/** Lo que hizo MaKo en un negocio (`actividad_acciones`, sin contenido: la operación, el canal y si salió). */
export type AccionDeMaKo = { creado: string; titulo: string; operacion: string; canal: string; ok: boolean }
/** Un error de la app que le pasó al negocio (`errores_app`, agrupado por su huella). */
export type ErrorDelNegocio = { id: number; titulo: string; origen: string; veces: number; ultimaVez: string; ruta: string | null; estado: string }
/** Un reporte (ticket) que levantó alguien del negocio. */
export type ReporteDelNegocio = { id: number; titulo: string; tipo: string; estado: string; creado: string }

const usdTxt = (n: number) => `US$ ${n.toLocaleString('es-AR', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`
const CANAL: Record<string, string> = { app: 'En la app', whatsapp: 'Por WhatsApp', http: 'Por la API' }
const ORIGEN: Record<string, string> = { navegador: 'En el navegador', servidor: 'En el servidor', mako: 'En MaKo' }

const MOVIMIENTO_A_EVENTO: Record<Movimiento['tipo'], NombreEvento> = {
  nuevo: 'subscription.created', vuelve: 'subscription.reactivated', sube: 'subscription.updated', baja: 'subscription.updated', corte: 'subscription.canceled',
}

export type FuentesDeEventos = {
  ws: number
  /** ISO: el alta del negocio. */
  creado: string
  /** Sus pedidos (los de Admin › Sales). */
  pedidos: ReadonlyArray<Pick<Pedido, 'id' | 'fecha' | 'usd' | 'medio' | 'concepto' | 'recurrente' | 'estado'>>
  /** Los movimientos de su MRR (lib/admin-ingresos-reglas.ts `movimientosDe`), ya los de este negocio. */
  movimientos: ReadonlyArray<Pick<Movimiento, 'fecha' | 'tipo' | 'delta' | 'antes' | 'despues'>>
  acciones: readonly AccionDeMaKo[]
  errores: readonly ErrorDelNegocio[]
  reportes: readonly ReporteDelNegocio[]
}

/** Todo lo que pasó en el negocio, un evento por hecho, el más nuevo primero (lo que Polar pide a /v1/events con `customer_id`). */
export function eventosDelNegocio(f: FuentesDeEventos): EventoNegocio[] {
  const out: EventoNegocio[] = []
  const meta = (n: NombreEvento) => NOMBRES_EVENTO[n] as { label: string; source: FuenteEvento; importancia: ImportanciaEvento; negativo?: true }
  const base = (n: NombreEvento) => ({ name: n, source: meta(n).source, importancia: meta(n).importancia, negativo: meta(n).negativo === true })
  out.push({ id: `alta:${f.ws}`, timestamp: f.creado, ...base('customer.created'), label: meta('customer.created').label, resumen: null, href: null, detalle: [] })
  for (const p of f.pedidos) {
    const monto = p.usd == null ? 'Sin su valor en dólares' : usdTxt(p.usd)
    const n: NombreEvento = p.estado === 'void' ? 'order.voided' : p.estado === 'paid' ? 'order.paid' : 'order.refunded'
    out.push({
      id: `pedido:${p.id}`, timestamp: p.fecha, ...base(n), label: meta(n).label,
      resumen: [monto, p.medio ? medioEnTexto(p.medio) : null].filter(Boolean).join(' · '),
      href: rutaDePedido(p),
      detalle: [['Monto', monto], ['Medio', medioEnTexto(p.medio)], ['Concepto', p.concepto ?? '—'], ['Tipo', p.recurrente ? 'Mensualidad' : 'Pago único'], ['Estado', ROTULO_ESTADO_PEDIDO[p.estado]]],
    })
  }
  for (const m of f.movimientos) {
    const n = MOVIMIENTO_A_EVENTO[m.tipo]
    const label = m.tipo === 'sube' ? 'Subió lo que paga por mes' : m.tipo === 'baja' ? 'Bajó lo que paga por mes' : meta(n).label
    out.push({
      id: `mrr:${m.fecha}:${m.tipo}`, timestamp: m.fecha, ...base(n), label, negativo: m.tipo === 'corte' || m.tipo === 'baja',
      resumen: m.tipo === 'corte' ? `Pagaba ${usdTxt(m.antes)} por mes` : `${usdTxt(m.despues)} por mes`,
      href: null,
      detalle: [['Antes', `${usdTxt(m.antes)} por mes`], ['Después', `${usdTxt(m.despues)} por mes`]],
    })
  }
  f.acciones.forEach((a, i) => {
    out.push({
      id: `accion:${a.creado}:${i}`, timestamp: a.creado, ...base('mako.action'), label: a.titulo, negativo: !a.ok,
      resumen: [CANAL[a.canal] ?? a.canal, a.ok ? null : 'No salió'].filter(Boolean).join(' · '),
      href: null,
      detalle: [['Operación', a.operacion], ['Canal', CANAL[a.canal] ?? a.canal], ['Resultado', a.ok ? 'Salió' : 'No salió']],
    })
  })
  for (const e of f.errores) {
    out.push({
      id: `error:${e.id}`, timestamp: e.ultimaVez, ...base('error.app'), label: e.titulo,
      resumen: [ORIGEN[e.origen] ?? e.origen, e.veces === 1 ? '1 vez' : `${e.veces} veces`].join(' · '),
      href: null,
      detalle: [['Dónde', ORIGEN[e.origen] ?? e.origen], ['Veces', String(e.veces)], ['Pantalla', e.ruta ?? '—'], ['Estado', e.estado]],
    })
  }
  for (const r of f.reportes) {
    out.push({
      id: `ticket:${r.id}`, timestamp: r.creado, ...base('ticket.created'), label: r.titulo || meta('ticket.created').label,
      resumen: `Ticket #${r.id}`,
      href: null,
      detalle: [['Ticket', `#${r.id}`], ['Tipo', r.tipo || '—'], ['Estado', r.estado || '—']],
    })
  }
  return out.sort((a, b) => (a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : a.id.localeCompare(b.id)))
}

/** Los nombres que hay, para el selector de eventos de Polar (EventSelect), agrupados por fuente. */
export function nombresDeEventos(eventos: readonly EventoNegocio[]): Array<{ name: NombreEvento; label: string; source: FuenteEvento }> {
  const hay = new Set(eventos.map((e) => e.name))
  return (Object.keys(NOMBRES_EVENTO) as NombreEvento[])
    .filter((n) => hay.has(n))
    .map((n) => ({ name: n, label: NOMBRES_EVENTO[n].label, source: NOMBRES_EVENTO[n].source }))
}

/** Los eventos del filtro de Events: los nombres elegidos (ninguno = todos) y el rango de días (YYYY-MM-DD, incluidos). */
export function filtrarEventos(eventos: readonly EventoNegocio[], f: { nombres?: readonly string[]; desde?: string; hasta?: string; source?: FuenteEvento }): EventoNegocio[] {
  const nombres = new Set(f.nombres ?? [])
  return eventos.filter((e) => {
    if (nombres.size && !nombres.has(e.name)) return false
    if (f.source && e.source !== f.source) return false
    const dia = e.timestamp.slice(0, 10)
    if (f.desde && dia < f.desde) return false
    if (f.hasta && dia > f.hasta) return false
    return true
  })
}

/** El pliegue del Timeline de Polar (`buildSegments`): los eventos de importancia baja seguidos van juntos, plegados. */
export type SegmentoTimeline = { type: 'event'; evento: EventoNegocio } | { type: 'fold'; eventos: EventoNegocio[] }
export function segmentosDeTimeline(eventos: readonly EventoNegocio[]): SegmentoTimeline[] {
  const out: SegmentoTimeline[] = []
  let buffer: EventoNegocio[] = []
  const flush = () => {
    if (buffer.length >= 1) out.push({ type: 'fold', eventos: buffer })
    buffer = []
  }
  for (const e of eventos) {
    if (e.importancia === 'low') buffer.push(e)
    else {
      flush()
      out.push({ type: 'event', evento: e })
    }
  }
  flush()
  return out
}

// ── Usage (CustomerUsageView): las tabs que usa, las que no, y la IA ───────────────────────────────────────────────

const COLORES = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#9333ea', '#0891b2', '#ea580c', '#db2777']

/** Un «medidor» de Polar: una tab de MaKo (lo que se abrió y se hizo) o la IA (las llamadas). */
export type MedidorUso = {
  key: string
  nombre: string
  color: string
  /** En qué se cuenta lo consumido. */
  unidad: 'pantallas' | 'llamadas'
  consumido: number
  /** Las acciones hechas en la tab (la IA no tiene). */
  acciones: number | null
  /** Cuántas personas distintas la usaron (la IA no se mide por persona). */
  personas: number | null
  /** Lo que costaron esas llamadas de IA, en dólares (la tab no tiene). */
  costoUsd: number | null
  /** El último día con uso (YYYY-MM-DD). */
  ultimo: string | null
}

/** Las llamadas de IA del negocio, sumadas por día (de `anthropic_usage` con su `workspace_id`). */
export type IaDelDia = { dia: string; llamadas: number; costoUsd: number }

export type UsoDelNegocio = {
  medidores: MedidorUso[]
  /** Las tabs de los negocios que nadie de este abrió en el rango («lo que no usa»). */
  sinUso: Array<{ key: string; label: string }>
  /** El gráfico apilado de Polar: un punto por intervalo, una serie por tab (sin la IA, que se cuenta en otra unidad). */
  serie: Array<Record<string, number | string>>
  series: Array<{ key: string; label: string; color: string }>
}

/** El primer día del intervalo de `dia` (YYYY-MM-DD → ISO del inicio, a medianoche UTC). */
export function cubetaDe(dia: string, intervalo: TimeInterval): string {
  const d = new Date(`${dia}T00:00:00Z`)
  if (intervalo === 'week') d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  else if (intervalo === 'month') d.setUTCDate(1)
  else if (intervalo === 'year') d.setUTCMonth(0, 1)
  return d.toISOString()
}

/**
 * Lo que usó el negocio entre `desde` y `hasta` (YYYY-MM-DD, incluidos): una fila por tab con uso, la IA si tuvo llamadas, las
 * tabs que no abrió nadie, y la serie del gráfico. `tabs` son las de los negocios (lib/actividad-reglas.ts `tabsDeNegocios`),
 * juntas por su nombre: dos keys que se dibujan igual son una tab.
 */
export function usoDelNegocio(
  filas: ReadonlyArray<Pick<FilaUso, 'dia' | 'usuario' | 'tab' | 'pantallas' | 'acciones'>>,
  tabs: ReadonlyArray<{ key: string; label: string; keys: readonly string[] }>,
  ia: readonly IaDelDia[],
  desde: string,
  hasta: string,
  intervalo: TimeInterval,
): UsoDelNegocio {
  const tabDe = new Map<string, { key: string; label: string }>()
  for (const t of tabs) for (const k of t.keys) tabDe.set(k, { key: t.key, label: t.label })
  const porTab = new Map<string, { nombre: string; pantallas: number; acciones: number; personas: Set<number>; ultimo: string | null }>()
  const cubetas = new Map<string, Record<string, number | string>>()
  for (const f of filas) {
    if (f.dia < desde || f.dia > hasta || (f.pantallas <= 0 && f.acciones <= 0)) continue
    const t = tabDe.get(f.tab) ?? { key: f.tab, label: f.tab === 'otra' ? 'Otras pantallas' : f.tab }
    const m = porTab.get(t.key) ?? { nombre: t.label, pantallas: 0, acciones: 0, personas: new Set<number>(), ultimo: null }
    m.pantallas += f.pantallas
    m.acciones += f.acciones
    m.personas.add(f.usuario)
    if (!m.ultimo || f.dia > m.ultimo) m.ultimo = f.dia
    porTab.set(t.key, m)
    const c = cubetaDe(f.dia, intervalo)
    const punto = cubetas.get(c) ?? { timestamp: c }
    punto[t.key] = (Number(punto[t.key]) || 0) + f.pantallas
    cubetas.set(c, punto)
  }
  const orden = [...porTab.entries()].sort((a, b) => b[1].pantallas + b[1].acciones - (a[1].pantallas + a[1].acciones) || a[1].nombre.localeCompare(b[1].nombre, 'es'))
  const medidores: MedidorUso[] = orden.map(([key, m], i) => ({
    key, nombre: m.nombre, color: COLORES[i % COLORES.length], unidad: 'pantallas', consumido: m.pantallas, acciones: m.acciones,
    personas: m.personas.size, costoUsd: null, ultimo: m.ultimo,
  }))
  let llamadas = 0
  let costo = 0
  let ultimoIa: string | null = null
  for (const d of ia) {
    if (d.dia < desde || d.dia > hasta || d.llamadas <= 0) continue
    llamadas += d.llamadas
    costo += d.costoUsd
    if (!ultimoIa || d.dia > ultimoIa) ultimoIa = d.dia
  }
  if (llamadas > 0) {
    medidores.push({ key: 'ia', nombre: 'IA', color: COLORES[medidores.length % COLORES.length], unidad: 'llamadas', consumido: llamadas, acciones: null, personas: null, costoUsd: Math.round(costo * 10000) / 10000, ultimo: ultimoIa })
  }
  const usadas = new Set(porTab.keys())
  const sinUso = tabs.filter((t) => !usadas.has(t.key)).map(({ key, label }) => ({ key, label }))
  const series = medidores.filter((m) => m.key !== 'ia').map((m) => ({ key: m.key, label: m.nombre, color: m.color }))
  const serie = [...cubetas.values()].sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)))
  return { medidores, sinUso, serie, series }
}

// ── Members (MembersSection, EditMemberModal) ──────────────────────────────────────────────────────────────────────

export type MiembroNegocio = {
  id: number
  nombre: string
  email: string
  /** Su rol en el negocio. `null` = sin rol (no debería pasar en un usuario-cliente). */
  rol: RolWorkspace | null
  estado: 'invitado' | 'activo' | 'suspendido'
  /** Cuándo se le mandó el mail de acceso. `null` = nunca se le avisó que tiene cuenta. */
  accesoEnviado: string | null
  ultimoIngreso: string | null
  creado: string
  /** Si tiene un segundo factor activo. `null` = no se sabe. */
  mfa: boolean | null
  /** La cara que se dibuja (su foto, o la de su Gravatar). */
  cara: string | null
}

export const ROLES_MIEMBRO: readonly RolWorkspace[] = ['admin', 'closer', 'setter']
export const ROTULO_ROL: Record<RolWorkspace, [string, 'blue' | 'purple' | 'gray']> = {
  admin: ['Admin', 'blue'],
  closer: ['Closer', 'purple'],
  setter: ['Setter', 'gray'],
}
export const ROTULO_ESTADO_MIEMBRO: Record<MiembroNegocio['estado'], [string, 'green' | 'yellow' | 'gray']> = {
  activo: ['Activo', 'green'],
  invitado: ['Invitado', 'yellow'],
  suspendido: ['Suspendido', 'gray'],
}

/** Lo que hace falta de una fila de `usuarios` (lib/usuarios.ts `Usuario`). */
export type UsuarioParaMiembro = {
  id: number; email: string; nombre: string; rol: string; estado: string; ultimo_login: string | null; created_at: string
  workspace_id: number | null; rol_ws: RolWorkspace | null; invitacion_enviada_at: string | null; mfa_activo?: boolean
}

/** Las personas del negocio: sus usuarios-cliente (nunca los admins de MaKo, que cruzan negocios), en el orden de alta. */
export function miembrosDe(usuarios: readonly UsuarioParaMiembro[], ws: number, caraDe?: (u: UsuarioParaMiembro) => string | null): MiembroNegocio[] {
  return usuarios
    .filter((u) => u.rol === 'usuario' && u.workspace_id === ws)
    .map((u): MiembroNegocio => ({
      id: u.id, nombre: u.nombre ?? '', email: u.email, rol: u.rol_ws,
      estado: u.estado === 'activo' ? 'activo' : u.estado === 'suspendido' ? 'suspendido' : 'invitado',
      accesoEnviado: u.invitacion_enviada_at, ultimoIngreso: u.ultimo_login, creado: u.created_at,
      mfa: typeof u.mfa_activo === 'boolean' ? u.mfa_activo : null, cara: caraDe?.(u) ?? null,
    }))
    .sort((a, b) => (a.creado < b.creado ? -1 : a.creado > b.creado ? 1 : a.id - b.id))
}

/** El contacto del negocio (el «Contact Customer» de Polar): el email de su primer admin activo. */
export function contactoDe(miembros: readonly MiembroNegocio[]): string | null {
  return miembros.find((m) => m.rol === 'admin' && m.estado === 'activo')?.email ?? miembros.find((m) => m.rol === 'admin')?.email ?? null
}

/** Lo que se le pide a /api/admin/usuarios por cada acción del menú de un miembro (las mismas que tenía Admin). */
export type AccionMiembro =
  | { action: 'reinvitar'; id: number }
  | { action: 'estado'; id: number; estado: 'activo' | 'suspendido' }
  | { action: 'rolws'; id: number; rol_ws: RolWorkspace }
  | { action: 'nombre'; id: number; nombre: string }

/** «Suspender» o «Reactivar» (el estado contrario al de hoy; un invitado se suspende). */
export const cambioDeEstado = (m: Pick<MiembroNegocio, 'id' | 'estado'>): AccionMiembro =>
  ({ action: 'estado', id: m.id, estado: m.estado === 'suspendido' ? 'activo' : 'suspendido' })

/** Los pedidos del formulario «Editar persona»: sólo lo que cambió, el nombre primero. */
export function cambiosDelMiembro(m: Pick<MiembroNegocio, 'id' | 'nombre' | 'rol'>, form: { nombre: string; rol: RolWorkspace | null }): AccionMiembro[] {
  const out: AccionMiembro[] = []
  const nombre = form.nombre.trim()
  if (nombre && nombre !== m.nombre) out.push({ action: 'nombre', id: m.id, nombre })
  if (form.rol && form.rol !== m.rol) out.push({ action: 'rolws', id: m.id, rol_ws: form.rol })
  return out
}

// ── Editar el negocio (EditCustomerModal) ──────────────────────────────────────────────────────────────────────────

/** Los planes que se pueden poner (nunca `superadmin`: es la identidad de la plataforma). */
export const PLANES_ASIGNABLES: ReadonlyArray<{ capa: CapaId; nombre: string }> = CAPAS_VENDIBLES.map((c) => ({ capa: c.id, nombre: nombreDePlan(c.id) }))

/** El valor de «No cambiarlo» (un select de radix no acepta un valor vacío). */
export const SIN_CAMBIO = 'igual'

/** Las opciones del plan a mano: no tocarlo, los días que se pueden dar y quitarlo (sólo si tiene uno). */
export function opcionesDePlanAMano(tiene: boolean): Array<{ value: string; label: string }> {
  return [
    { value: SIN_CAMBIO, label: 'No cambiarlo' },
    ...DIAS_PLAN_A_MANO.map((d) => ({ value: String(d), label: rotuloDeDias(d) })),
    ...(tiene ? [{ value: '0', label: 'Quitar el plan a mano' }] : []),
  ]
}

export type AccionNegocio =
  | { action: 'nombre'; id: number; nombre: string }
  | { action: 'capa'; id: number; capa: CapaId }
  | { action: 'plan_a_mano'; id: number; dias: number }
  | { action: 'estado'; id: number; estado: 'activo' | 'pausado' }
  | { action: 'eliminar'; id: number; nombre: string }

/** Los pedidos a /api/admin/workspaces de «Guardar»: sólo lo que cambió (nombre, plan, plan a mano), en ese orden. */
export function cambiosDelNegocio(n: Pick<NegocioCabecera, 'ws' | 'nombre' | 'capa'>, form: { nombre: string; capa: string; planAMano: string }): AccionNegocio[] {
  const out: AccionNegocio[] = []
  const nombre = form.nombre.trim()
  if (nombre && nombre !== n.nombre) out.push({ action: 'nombre', id: n.ws, nombre })
  const plan = PLANES_ASIGNABLES.find((p) => p.capa === form.capa)
  if (plan && plan.capa !== n.capa) out.push({ action: 'capa', id: n.ws, capa: plan.capa })
  if (form.planAMano !== SIN_CAMBIO && form.planAMano !== '') {
    const dias = Number(form.planAMano)
    if (dias === 0 || (DIAS_PLAN_A_MANO as readonly number[]).includes(dias)) out.push({ action: 'plan_a_mano', id: n.ws, dias })
  }
  return out
}

const plural = (n: number, s: string) => `${n} ${n === 1 ? s : `${s}s`}`

/**
 * Lo que dice «Eliminar» cuando sale bien: lo que se llevó (la respuesta de /api/admin/workspaces `eliminar`: `borrado` por
 * tabla, `usuarios`, `leadsDesligados`, `avisos`), como lo decía la grilla vieja.
 */
export function resumenDeBorrado(nombre: string, r: Record<string, unknown>): string {
  const borrado = r.borrado && typeof r.borrado === 'object' ? (r.borrado as Record<string, unknown>) : {}
  const filas = Object.values(borrado).reduce<number>((a, b) => a + (Number(b) || 0), 0)
  const tablas = Object.keys(borrado).length
  const usuarios = Number(r.usuarios) || 0
  const leads = Number(r.leadsDesligados) || 0
  const avisos = Array.isArray(r.avisos) ? r.avisos.filter((a): a is string => typeof a === 'string') : []
  return [
    `Se eliminó ${nombre}: ${plural(filas, 'fila')} en ${plural(tablas, 'tabla')}, ${plural(usuarios, 'persona')}`,
    leads ? ` y ${plural(leads, 'lead')} de tu CRM que quedaron sin cuenta` : '',
    '.',
    avisos.length ? ` ${avisos.join(' ')}` : '',
  ].join('')
}

/** «Pausar» o «Reactivar» la cuenta. */
export const cambioDeEstadoNegocio = (n: Pick<NegocioCabecera, 'ws' | 'estado'>): AccionNegocio =>
  ({ action: 'estado', id: n.ws, estado: n.estado === 'pausado' ? 'activo' : 'pausado' })

// ── El rango (useCustomerMetricsParams) ────────────────────────────────────────────────────────────────────────────

/** Los parámetros del rango, que viajan entre las subpáginas (los mismos de Polar). */
export const PARAMS_DEL_RANGO = ['startDate', 'endDate', 'interval'] as const

const DIA_RE = /^\d{4}-\d{2}-\d{2}$/
/** YYYY-MM-DD en la hora local (como `toISODate` de Polar). */
export const diaLocal = (d: Date): string => {
  const o = new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
  return o.toISOString().slice(0, 10)
}
/** Un YYYY-MM-DD válido de la URL, o `null`. */
export const diaDeParam = (v: string | null | undefined): string | null => (v && DIA_RE.test(v) && Number.isFinite(Date.parse(`${v}T00:00:00Z`)) ? v : null)

/** El principio de la actividad del negocio (`getCustomerActivityStart` de Polar): su alta, o su primer pago si fue antes. */
export function inicioDeActividad(creado: string, pedidos: ReadonlyArray<Pick<Pedido, 'fecha'>>): string {
  const alta = creado.slice(0, 10)
  const primero = pedidos.reduce<string | null>((m, p) => (m == null || p.fecha < m ? p.fecha : m), null)
  return primero && primero < alta ? primero : alta
}
