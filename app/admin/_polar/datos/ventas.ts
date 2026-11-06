// =============================================================================
// Admin › Sales — los tipos y las cuentas PURAS de Orders, Subscriptions, Checkouts y Disputes (6/11/2026)
// =============================================================================
// Copia de las páginas de Sales del dashboard de Polar (clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/sales/,
// Apache-2.0). Polar tipa todo con `schemas['Order']`, `schemas['Subscription']`, `schemas['Checkout']` y `schemas['Dispute']`;
// MaKo no tiene esos objetos, así que cada página recibe acá lo que MaKo DE VERDAD tiene, ya armado por el server
// (./ventas-server.ts), y estas funciones lo convierten en las filas, los filtros y los totales de la pantalla.
//
// De dónde sale cada cosa (la lectura, en ventas-server.ts):
//   · Orders: cada pago que entró (lib/admin-ingresos.ts, `vistaDeIngresos().entradas`: el CRM de la plataforma y la pasarela),
//     atado a SU recibo por el PAGO (revisión del Cerebro, 6/11/2026, punto 2: hay un recibo por cada pago, y atarlo por el cobro
//     le daba a cada renovación el recibo de otro mes): `recibo_pagos.pago_id` (mig 0408, lo que ata «Cargar pago»), o la clave
//     de `reciboDePago` (`medio + referencia` del recibo contra `proveedor + proveedor_pago_id` del pago). Un pago viejo sin su
//     `proveedor_pago_id` se ata por el cobro sólo si ese cobro tiene UN recibo. Más los cobros DEVUELTOS (`c-<id>`, en estado
//     devuelto: su pago ya no está en lo cobrado, punto 3) y los recibos que no quedaron atados a ningún pago (`r-<id>`; los de
//     «Cargar pago» sin atar al CRM no suman: punto 4). El estado sale del recibo (devuelto, anulado…); sin recibo, «Pagado».
//   · Subscriptions: cada lead de suscripción de la plataforma con su historia mes a mes (`suscripcionesDeLaPlataforma`, la misma
//     cuenta que la ficha) y los cobros de suscripción de la pasarela que no son de ninguno de esos leads.
//   · Checkouts: los cobros de la pasarela que NO se pagaron (pendientes, rechazados, anulados): lo pagado ya es un pedido. Un
//     link de «Vender un plan» NO: es un Checkout Link y vive en Products (./checkout-link.ts, la misma regla para las dos).
//   · Disputes: los cobros cuyo motivo es un contracargo (lib/cobros-reglas.ts, `esTextoDeContracargo`) y los recibos marcados.
//
// Sin `server-only` ni `'use client'`: lo usan las vistas del navegador y tests/admin-polar-ventas.test.ts, que lo EJECUTA.
// ⚠️ PLATA EN DÓLARES DE VERDAD. Lo que no tiene su valor en dólares (`usd: null`) no suma: nunca se convierte con una tasa.
// =============================================================================

import { esTextoDeContracargo } from '@/lib/cobros-reglas'
import { NOMBRE_PASARELA, esPasarela, type EstadoAlta, type EstadoCobro, type ModoCobro, type TipoCobro } from '@/lib/cobros-tipos'
import { MEDIOS, ROTULO_MEDIO, diferencia, esMedio, referenciaNormal, type EstadoRecibo, type MedioRecibo } from '@/lib/recibos-reglas'
import { formatoMonto } from '@/lib/pasarela-moneda'
import { diaEnLaZona } from '@/lib/admin-ingresos-reglas'
import type { Metric } from './polar-tipos'
import { esDeVenderUnPlan } from './checkout-link'
import { armarCsv } from '@/lib/csv-celda'

// ── Lo común ──────────────────────────────────────────────────────────────────────────────────────────────────────────

const r2 = (n: number) => Math.round(n * 100) / 100
export const aCentavos = (usd: number) => Math.round(usd * 100)
/** El ws de una clave de cliente (`ws:<n>`), o null. */
export const wsDeClave = (clave: string | null | undefined): number | null => {
  const m = /^ws:(\d{1,12})$/.exec(String(clave ?? ''))
  return m ? Number(m[1]) : null
}

/** Quién pagó: el negocio (su cuenta de MaKo) o, si no tiene cuenta, su ficha del CRM de la plataforma. */
export type ClienteVenta = {
  /** `ws:<n>` o `lead:<id>`; null si sólo se sabe el nombre (un recibo a nombre de alguien). */
  clave: string | null
  nombre: string
  ws: number | null
  leadId: number | null
  email: string | null
}

/** Cómo se lee el medio de un pago («transferencia» → «Transferencia», «stripe» → «Stripe»). */
export function medioEnTexto(medio: string | null | undefined): string {
  if (!medio) return '—'
  if (esMedio(medio)) return ROTULO_MEDIO[medio]
  if (esPasarela(medio)) return NOMBRE_PASARELA[medio]
  return medio.charAt(0).toUpperCase() + medio.slice(1)
}

// ── Los intervalos de fecha (DateRangePicker de Polar, `dateRangeIntervals`) ─────────────────────────────────────────

export const INTERVALOS = ['today', 'yesterday', 'thisWeek', 'thisMonth', 'lastMonth', 'last3Months', 'thisYear', 'lastYear', 'allTime'] as const
export type Intervalo = (typeof INTERVALOS)[number]
export const esIntervalo = (v: unknown): v is Intervalo => INTERVALOS.includes(v as Intervalo)
export const ROTULO_INTERVALO: Readonly<Record<Intervalo, string>> = {
  today: 'Hoy', yesterday: 'Ayer', thisWeek: 'Esta semana', thisMonth: 'Este mes', lastMonth: 'El mes pasado',
  last3Months: 'Últimos 3 meses', thisYear: 'Este año', lastYear: 'El año pasado', allTime: 'Desde siempre',
}

const diaUtc = (iso: string) => new Date(`${iso}T00:00:00Z`)
const isoDe = (d: Date) => d.toISOString().slice(0, 10)
const masDias = (iso: string, n: number) => isoDe(new Date(diaUtc(iso).getTime() + n * 86_400_000))

/**
 * El rango de un intervalo, en días del negocio (YYYY-MM-DD, `hoy` en su zona). `null` = desde siempre. La semana arranca el
 * domingo, como `startOfWeek` de date-fns en Polar.
 */
export function rangoDe(intervalo: Intervalo, hoy: string): { desde: string; hasta: string } | null {
  const [y, m] = hoy.split('-').map(Number)
  const finDeMes = (yy: number, mm: number) => isoDe(new Date(Date.UTC(yy, mm, 0)))
  switch (intervalo) {
    case 'today': return { desde: hoy, hasta: hoy }
    case 'yesterday': { const a = masDias(hoy, -1); return { desde: a, hasta: a } }
    case 'thisWeek': { const dow = diaUtc(hoy).getUTCDay(); const d = masDias(hoy, -dow); return { desde: d, hasta: masDias(d, 6) } }
    case 'thisMonth': return { desde: `${hoy.slice(0, 7)}-01`, hasta: finDeMes(y, m) }
    case 'lastMonth': { const d = new Date(Date.UTC(y, m - 2, 1)); return { desde: isoDe(d), hasta: finDeMes(d.getUTCFullYear(), d.getUTCMonth() + 1) } }
    case 'last3Months': { const d = new Date(Date.UTC(y, m - 4, Number(hoy.slice(8, 10)))); return { desde: isoDe(d), hasta: hoy } }
    case 'thisYear': return { desde: `${y}-01-01`, hasta: `${y}-12-31` }
    case 'lastYear': return { desde: `${y - 1}-01-01`, hasta: `${y - 1}-12-31` }
    case 'allTime': return null
  }
}

export const enRango = (fecha: string, rango: { desde: string; hasta: string } | null): boolean =>
  !rango || (fecha.slice(0, 10) >= rango.desde && fecha.slice(0, 10) <= rango.hasta)

// ── El orden y la página (DataTable de Polar pagina y ordena en su server: acá en memoria) ───────────────────────────

export type Orden = { id: string; desc: boolean }
export const PAGINA_POR_DEFECTO = 50

/** Ordena con el comparador de la columna; las columnas sin comparador no ordenan. Estable. */
export function ordenar<T>(filas: readonly T[], orden: Orden | null, comparadores: Readonly<Record<string, (a: T, b: T) => number>>): T[] {
  const cmp = orden ? comparadores[orden.id] : undefined
  if (!cmp || !orden) return [...filas]
  return filas.map((f, i) => ({ f, i })).sort((a, b) => (orden.desc ? -cmp(a.f, b.f) : cmp(a.f, b.f)) || a.i - b.i).map((x) => x.f)
}

export function paginar<T>(filas: readonly T[], pagina: number, tamano: number): { filas: T[]; total: number; paginas: number; pagina: number } {
  const t = Math.max(1, Math.trunc(tamano) || PAGINA_POR_DEFECTO)
  const paginas = Math.max(1, Math.ceil(filas.length / t))
  const p = Math.min(Math.max(0, Math.trunc(pagina) || 0), paginas - 1)
  return { filas: filas.slice(p * t, p * t + t), total: filas.length, paginas, pagina: p }
}

const porTexto = (a: string | null | undefined, b: string | null | undefined) => String(a ?? '').localeCompare(String(b ?? ''), 'es')
const porNumero = (a: number | null | undefined, b: number | null | undefined) => (a ?? -Infinity) - (b ?? -Infinity)

// =============================================================================
// ORDERS
// =============================================================================

/** El estado de un pedido, con los nombres de Polar (`schemas['OrderStatus']`) que MaKo puede llenar. */
export const ESTADOS_PEDIDO = ['paid', 'partially_refunded', 'refunded', 'void'] as const
export type EstadoPedido = (typeof ESTADOS_PEDIDO)[number]
export const esEstadoPedido = (v: unknown): v is EstadoPedido => ESTADOS_PEDIDO.includes(v as EstadoPedido)

/** El estado del pedido sale de su recibo; sin recibo, entró y está pagado. Un contracargo se ve en Disputes, no acá. */
export function estadoDePedido(recibo: Pick<ReciboVenta, 'estado'> | null): EstadoPedido {
  switch (recibo?.estado) {
    case 'devuelto': return 'refunded'
    case 'devuelto_parcial': return 'partially_refunded'
    case 'anulado': return 'void'
    default: return 'paid'
  }
}

export type PagoDelRecibo = {
  id: number
  medio: string
  referencia: string
  fecha: string
  monto: number
  moneda: string
  montoUsd: number | null
  de: string | null
  comprobante: boolean
  anulado: boolean
  /** El pago del CRM de la plataforma que es este cobro (`recibo_pagos.pago_id`, mig 0408). Sin la migración, ausente. */
  pagoId?: number | null
}

/** Un recibo del libro (lib/recibos.ts), con lo que dibuja la pantalla y nada más (sin rutas de archivos). */
export type ReciboVenta = {
  id: number
  numero: number
  estado: EstadoRecibo
  origen: 'pasarela' | 'manual'
  aNombre: string
  destinoWs: number | null
  cobroId: number | null
  emitidoAt: string
  fechaPago: string
  /**
   * El DÍA del pago en la zona del recibo (YYYY-MM-DD, `diaDelRecibo`): el que dice su PDF. `fechaPago` es un instante en UTC, y
   * un pago del 31/10 a las 22:00 de Argentina es el 1/11 en UTC (punto 6). Sin él, el día de `fechaPago`.
   */
  diaPago?: string
  lineas: Array<{ concepto: string; mes: string | null; monto: number; moneda: string }>
  totalDetalle: number
  monedaDetalle: string
  totales: Array<{ moneda: string; monto: number }>
  impuesto: number | null
  correoEstado: string
  correoA: string[]
  correoError: string | null
  waEstado: string
  waError: string | null
  soloCorreo: boolean
  devueltoAt: string | null
  devueltoMonto: number | null
  disputa: string | null
  anuladoAt: string | null
  pagos: PagoDelRecibo[]
  historial: Array<{ at: string; que: string; quien?: string }>
}

/** Un pedido: un pago que entró (con su recibo, si tiene), un cobro devuelto o un recibo cuyo pago no está en lo cobrado. */
export type Pedido = {
  /** `p-<id de pagos>` (el CRM), `c-<id de cobros>` (la pasarela) o `r-<id de recibos>` (sólo el recibo). */
  id: string
  /**
   * El id del pago en la pasarela (`pagos.proveedor_pago_id`, o el del cobro si el pedido es el cobro). Dice si es el pago que
   * devuelve «Devolver el pago» (el PRIMERO del cobro, `cobros.proveedor_pago_id`) o una renovación (punto 1). null = no se sabe.
   */
  proveedorPagoId?: string | null
  /**
   * ¿Suma en los totales? `false` = un recibo cargado a mano que no quedó atado a ningún pago del CRM (`r-`, origen manual):
   * Overview no lo ve, y si el mismo pago está en el CRM se contaría dos veces (punto 4). Ausente = suma.
   */
  suma?: boolean
  /** YYYY-MM-DD, el día que entró. */
  fecha: string
  cliente: ClienteVenta | null
  concepto: string | null
  medio: string | null
  /** De una suscripción (MRR) o un pago suelto. */
  recurrente: boolean
  /** En dólares; null = sin su valor en dólares (no suma). */
  usd: number | null
  estado: EstadoPedido
  recibo: ReciboVenta | null
  /** El cobro de la pasarela que lo asentó, si salió por la pasarela. */
  cobroId: number | null
  origen: 'crm' | 'pasarela' | 'recibo'
}

/** Lo que llega de `vistaDeIngresos().entradas`, con las claves que suma la tab Admin (id, cliente, concepto, cobroId). */
export type EntradaVenta = {
  id?: string
  fecha: string
  usd: number | null
  medio: string | null
  recurrente: boolean
  nombre: string
  cliente?: string
  concepto?: string | null
  cobroId?: number | null
  /** La pasarela del pago (`pagos.proveedor`, o la del cobro): con `proveedorPagoId`, la clave de su recibo. */
  proveedor?: string | null
  /** El id del pago en la pasarela (`pagos.proveedor_pago_id`, o el del cobro). */
  proveedorPagoId?: string | null
}

/** El id de un renglón de lo cobrado (`p:12`, `c:34`) en la URL (`p-12`). */
export const idDePedido = (idIngreso: string): string => idIngreso.replace(':', '-')
export const ES_ID_PEDIDO = /^[pcr]-[1-9]\d{0,11}$/

/** La suma en dólares de lo que entró por un recibo (sus pagos sin anular). null si alguno no tiene su valor en dólares. */
export function usdDelRecibo(r: Pick<ReciboVenta, 'pagos'>): number | null {
  const vivos = r.pagos.filter((p) => !p.anulado)
  if (!vivos.length || vivos.some((p) => p.montoUsd == null)) return null
  return r2(vivos.reduce((s, p) => s + (p.montoUsd as number), 0))
}

/**
 * El día del pago de un recibo en SU zona (la que se copió al emitirlo, `recibos.zona`): el que dice su PDF. Lo arma
 * `reciboDeListado` (ventas-server.ts). Punto 6: con el día de la fecha en UTC, un pago de la noche caía en el día siguiente.
 */
export const diaDelRecibo = (fechaPago: string, zona: string | null | undefined): string => diaEnLaZona(fechaPago, zona)

/**
 * La clave de un pago en el libro de recibos: la de `reciboDePago` (lib/recibos.ts), `medio + referencia` normalizada. De un
 * pago del CRM: `proveedor + proveedor_pago_id`. null si el medio no es del libro o la referencia no se puede leer.
 */
export function claveDePago(medio: string | null | undefined, referencia: string | null | undefined): string | null {
  const m = String(medio ?? '').trim().toLowerCase()
  if (!esMedio(m) || referencia == null) return null
  const ref = referenciaNormal(m, referencia)
  return ref ? `${m}:${ref}` : null
}

/**
 * Los pedidos: cada entrada de lo cobrado con SU recibo, cada cobro DEVUELTO (`cobros`, su pago ya no está en lo cobrado) y cada
 * recibo que no quedó atado a ningún pago. El más nuevo primero.
 *
 * Cómo se ata un pago a su recibo (punto 2 de la revisión del 6/11/2026), en este orden:
 *   1. `recibo_pagos.pago_id` (mig 0408): lo que ata «Cargar pago» con el pago del CRM que registró o eligió;
 *   2. la clave de `reciboDePago`: el `medio + referencia` del recibo contra el `proveedor + proveedor_pago_id` del pago;
 *   3. un pago viejo SIN `proveedor_pago_id`, por su cobro, sólo si ese cobro tiene UN recibo (con varios, cada uno es de otra
 *      renovación: elegir uno sería darle el recibo de otro mes, que es lo que pasaba atando por el cobro).
 *
 * Un recibo cargado a mano que no se ató a ningún pago sale como `r-` y NO SUMA (`suma: false`, punto 4): Overview no lo ve, y si
 * el mismo pago está en el CRM se contaría dos veces.
 *
 * `zona`: la de la plataforma, para el día de un cobro devuelto sin recibo (punto 6).
 */
export function pedidosDe(e: {
  entradas: readonly EntradaVenta[]
  recibos: readonly ReciboVenta[]
  clientes: ReadonlyMap<string, Omit<ClienteVenta, 'email'> & { email?: string | null }>
  nombreDeWs: ReadonlyMap<number, string>
  /** Los cobros de la plataforma (`cobrosDeMakoAction`): de acá salen los devueltos, que `vistaDeIngresos` no trae (punto 3). */
  cobros?: readonly CobroVenta[]
  zona?: string | null
}): Pedido[] {
  const reciboDePagoId = new Map<number, ReciboVenta>()
  const reciboDeClave = new Map<string, ReciboVenta>()
  const recibosDeCobro = new Map<number, ReciboVenta[]>()
  for (const r of e.recibos) {
    for (const p of r.pagos) {
      if (p.anulado) continue
      if (p.pagoId != null && !reciboDePagoId.has(p.pagoId)) reciboDePagoId.set(p.pagoId, r)
      const clave = claveDePago(p.medio, p.referencia)
      if (clave && !reciboDeClave.has(clave)) reciboDeClave.set(clave, r)
    }
    if (r.cobroId != null) recibosDeCobro.set(r.cobroId, [...(recibosDeCobro.get(r.cobroId) ?? []), r])
  }
  const reciboDelPago = (q: { pagoId: number | null; proveedor: string | null | undefined; proveedorPagoId: string | null | undefined; cobroId: number | null | undefined }): ReciboVenta | null => {
    if (q.pagoId != null) {
      const r = reciboDePagoId.get(q.pagoId)
      if (r) return r
    }
    if (q.proveedorPagoId) {
      const clave = claveDePago(q.proveedor, q.proveedorPagoId)
      return clave ? reciboDeClave.get(clave) ?? null : null
    }
    const delCobro = q.cobroId != null ? recibosDeCobro.get(q.cobroId) ?? [] : []
    return delCobro.length === 1 ? delCobro[0] : null
  }

  const usados = new Set<number>()
  const vistos = new Set<string>()
  const out: Pedido[] = []
  for (const x of e.entradas) {
    if (!x.id || !/^[pc]:\d+$/.test(x.id)) continue
    vistos.add(x.id)
    const recibo = reciboDelPago({ pagoId: x.id.startsWith('p:') ? Number(x.id.slice(2)) : null, proveedor: x.proveedor, proveedorPagoId: x.proveedorPagoId, cobroId: x.cobroId })
    if (recibo) usados.add(recibo.id)
    const c = x.cliente ? e.clientes.get(x.cliente) : undefined
    const ws = c?.ws ?? wsDeClave(x.cliente)
    out.push({
      id: idDePedido(x.id),
      fecha: x.fecha.slice(0, 10),
      cliente: { clave: x.cliente ?? null, nombre: c?.nombre ?? x.nombre, ws, leadId: c?.leadId ?? null, email: c?.email ?? null },
      concepto: x.concepto ?? null,
      medio: x.medio,
      recurrente: x.recurrente,
      usd: x.usd,
      estado: estadoDePedido(recibo),
      recibo,
      cobroId: x.cobroId ?? null,
      origen: x.id.startsWith('c:') ? 'pasarela' : 'crm',
      proveedorPagoId: x.proveedorPagoId ?? null,
    })
  }
  // Punto 3: un cobro DEVUELTO ya no está en lo cobrado (el cobro pasa a `reembolsado` y su pago a `pagado: false`). Sin esto, el
  // pedido desaparecía al devolverlo (la página caía en 404 y se perdía el resultado) o reaparecía como un recibo «Cargado a mano».
  for (const c of e.cobros ?? []) {
    if (c.estado !== 'reembolsado' || vistos.has(`c:${c.id}`)) continue
    const recibo = reciboDelPago({ pagoId: null, proveedor: c.proveedor, proveedorPagoId: c.proveedorPagoId, cobroId: c.id })
    if (recibo) usados.add(recibo.id)
    out.push({
      id: `c-${c.id}`,
      fecha: recibo?.diaPago ?? (c.pagadoAt ? diaEnLaZona(c.pagadoAt, e.zona) : c.createdAt.slice(0, 10)),
      cliente: { clave: c.altaWs != null ? `ws:${c.altaWs}` : null, nombre: c.altaWsNombre ?? c.nombre ?? c.email ?? `Cobro ${c.id}`, ws: c.altaWs, leadId: null, email: c.email },
      concepto: c.plan ?? c.concepto,
      medio: c.proveedor,
      recurrente: c.tipo === 'suscripcion',
      usd: (recibo ? usdDelRecibo(recibo) : null) ?? c.montoUsd,
      // La pasarela ya lo devolvió entero (`reembolsado`), aunque el recibo todavía no lo diga.
      estado: 'refunded',
      recibo,
      cobroId: c.id,
      origen: 'pasarela',
      proveedorPagoId: c.proveedorPagoId ?? null,
    })
  }
  for (const r of e.recibos) {
    if (usados.has(r.id)) continue
    const nombre = r.destinoWs != null ? e.nombreDeWs.get(r.destinoWs) ?? r.aNombre : r.aNombre
    out.push({
      id: `r-${r.id}`,
      fecha: r.diaPago ?? r.fechaPago.slice(0, 10),
      cliente: { clave: r.destinoWs != null ? `ws:${r.destinoWs}` : null, nombre, ws: r.destinoWs, leadId: null, email: null },
      concepto: r.lineas.map((l) => l.concepto).join(', ') || null,
      medio: r.pagos.find((p) => !p.anulado)?.medio ?? null,
      recurrente: false,
      usd: usdDelRecibo(r),
      estado: estadoDePedido(r),
      recibo: r,
      cobroId: r.cobroId,
      origen: 'recibo',
      proveedorPagoId: null,
      suma: r.origen !== 'manual',
    })
  }
  return out.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : b.id.localeCompare(a.id)))
}

export type FiltroPedidos = { estado: EstadoPedido | null; intervalo: Intervalo }

export function filtrarPedidos(pedidos: readonly Pedido[], f: FiltroPedidos, hoy: string): Pedido[] {
  const rango = rangoDe(f.intervalo, hoy)
  return pedidos.filter((p) => (!f.estado || p.estado === f.estado) && enRango(p.fecha, rango))
}

export const COMPARADORES_PEDIDO: Readonly<Record<string, (a: Pedido, b: Pedido) => number>> = {
  created_at: (a, b) => porTexto(a.fecha, b.fecha) || porTexto(a.id, b.id),
  customer: (a, b) => porTexto(a.cliente?.nombre, b.cliente?.nombre),
  status: (a, b) => ESTADOS_PEDIDO.indexOf(a.estado) - ESTADOS_PEDIDO.indexOf(b.estado),
  net_amount: (a, b) => porNumero(a.usd, b.usd),
}

/**
 * Las tres cajas de arriba de Orders (Polar: `orders`, `revenue`, `average_order_value` con los mismos filtros de la tabla). En
 * centavos, como las métricas de Polar. Lo devuelto (refunded/void) no suma a lo que entró; lo que no tiene dólares, tampoco; y un
 * recibo cargado a mano sin atar a un pago del CRM (`suma: false`), tampoco: Overview no lo ve y podría ser el mismo pago que ya
 * está en el CRM (punto 4). Ése se cuenta aparte, en `aManoSinSumar`, para decirlo debajo de las cajas.
 */
export function totalesDePedidos(pedidos: readonly Pedido[]): {
  orders: number; revenue: number; averageOrderValue: number; sinDolares: number
  /** Los recibos cargados a mano que no suman (con su plata en dólares, la que tiene). */
  aManoSinSumar: { recibos: number; usd: number }
} {
  const entraron = pedidos.filter((p) => p.estado === 'paid' || p.estado === 'partially_refunded')
  const valen = entraron.filter((p) => p.suma !== false)
  const conUsd = valen.filter((p) => p.usd != null)
  const revenue = r2(conUsd.reduce((s, p) => s + (p.usd as number), 0))
  const sueltos = entraron.filter((p) => p.suma === false)
  return {
    orders: pedidos.length,
    revenue: aCentavos(revenue),
    averageOrderValue: conUsd.length ? aCentavos(r2(revenue / conUsd.length)) : 0,
    sinDolares: valen.length - conUsd.length,
    aManoSinSumar: { recibos: sueltos.length, usd: r2(sueltos.reduce((s, p) => s + (p.usd ?? 0), 0)) },
  }
}

/** «2 recibos cargados a mano no suman en Ingresos: US$ 300» (debajo de las cajas de Orders). null si no hay. */
export function textoDeSinSumar(t: { recibos: number; usd: number }): string | null {
  if (!t.recibos) return null
  return `${t.recibos === 1 ? '1 recibo cargado a mano no suma' : `${t.recibos} recibos cargados a mano no suman`} en Ingresos: ${usdEnTextoPlano(t.usd)}`
}

const usdEnTextoPlano = (n: number) => `US$ ${n.toLocaleString('es-AR', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`

/** Lo que MiniMetricChartBox lee de una métrica: su nombre y su tipo (no su slug). */
export const METRICA_ORDERS: Metric = { slug: 'revenue', display_name: 'Pedidos', type: 'scalar' }
export const METRICA_REVENUE: Metric = { slug: 'revenue', display_name: 'Ingresos', type: 'currency' }
export const METRICA_AOV: Metric = { slug: 'revenue', display_name: 'Pago promedio', type: 'currency' }

/**
 * «Billing reason» de Polar, con lo que MaKo sabe: si es de una suscripción o un pago suelto. «Cargado a mano» lo dice el RECIBO
 * (`origen: 'manual'`), no que el pedido sea sólo un recibo: un cobro devuelto con su recibo de la pasarela sigue siendo de la
 * pasarela (punto 3), y un pago del CRM atado a su recibo de «Cargar pago» sí se cargó a mano.
 */
export const motivoDePedido = (p: Pick<Pedido, 'recurrente'> & { recibo: Pick<ReciboVenta, 'origen'> | null }): string =>
  p.recibo?.origen === 'manual' ? 'Cargado a mano' : p.recurrente ? 'Suscripción' : 'Pago único'

// ── Devolver un pedido (OrderRefundsSection) ──────────────────────────────────────────────────────────────────────────

/**
 * Qué ofrece «Devoluciones» para un pedido (punto 1 de la revisión del 6/11/2026). `reembolsarCobroMakoAction` devuelve el pago
 * del COBRO (`cobros.proveedor_pago_id`), que es el PRIMERO: cada renovación de la pasarela es otro pedido con el mismo cobro, y
 * ofrecer el botón ahí devolvía septiembre al pedir noviembre. Así que:
 *   · `pasarela`: el pedido ES el pago del cobro (los dos ids coinciden) → «Devolver el pago», por el monto del PEDIDO (`usd`: el
 *     del cobro es la mensualidad de hoy, y el primer mes pudo ser otro);
 *   · `en-la-pasarela`: otro pago del mismo cobro (una renovación, o uno sin su id) → sin botón, con el texto de qué hacer;
 *   · `a-mano`: un recibo de «Cargar pago» sin cobro → «Marcar devuelto»;
 *   · null: ya devuelto, o nada que devolver desde acá.
 */
export type DevolucionDelPedido = { tipo: 'pasarela'; usd: number | null } | { tipo: 'a-mano' } | { tipo: 'en-la-pasarela'; texto: string } | null

export function devolucionDelPedido(
  order: Pick<Pedido, 'estado' | 'proveedorPagoId' | 'usd'> & { recibo: Pick<ReciboVenta, 'origen' | 'estado'> | null },
  cobro: Pick<CobroVenta, 'estado' | 'modo' | 'proveedorPagoId' | 'montoUsd'> | null,
): DevolucionDelPedido {
  if (order.estado === 'refunded' || order.estado === 'partially_refunded') return null
  if (cobro && cobro.modo === 'real' && (cobro.estado === 'pagado' || cobro.estado === 'reembolsado')) {
    if (cobro.estado === 'pagado' && cobro.proveedorPagoId && order.proveedorPagoId && cobro.proveedorPagoId === order.proveedorPagoId) return { tipo: 'pasarela', usd: order.usd ?? cobro.montoUsd }
    return {
      tipo: 'en-la-pasarela',
      texto: order.proveedorPagoId
        ? 'Una renovación se devuelve desde el panel de la pasarela; MaKo la registra sola con el aviso.'
        : 'Este pago se devuelve desde el panel de la pasarela; MaKo lo registra solo con el aviso.',
    }
  }
  if (!cobro && order.recibo?.origen === 'manual' && order.recibo.estado === 'emitido') return { tipo: 'a-mano' }
  return null
}

/** El resumen de una devolución que viaja en la URL (`?hecho=`, punto 3): texto plano, recortado. null si no es un texto. */
export function hechoDeLaUrl(v: unknown): string | null {
  const s = typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : ''
  return s ? s.slice(0, 300) : null
}

/**
 * La suscripción de un pedido, para el enlace «Suscripción» del detalle (punto 19): primero la del COBRO (la de la pasarela,
 * `c-<cobro>` o la del lead que lo tiene), y si no, la de a mano cuya historia lista ESTE pedido entre los pagos de un mes. Sin
 * ninguna, null: el enlace no se dibuja (armar `l-<lead>` a ciegas daba 404, o la suscripción de otro lead del mismo negocio).
 */
export function suscripcionDelPedido(order: Pick<Pedido, 'id' | 'cobroId'>, subs: readonly Pick<SuscripcionVenta, 'id' | 'cobroIds' | 'historia'>[]): string | null {
  if (order.cobroId != null) {
    const s = subs.find((x) => x.id === `c-${order.cobroId}`) ?? subs.find((x) => x.cobroIds?.includes(order.cobroId as number))
    if (s) return `/admin/sales/subscriptions/${s.id}`
  }
  const s = subs.find((x) => x.historia.some((m) => m.pedidos.includes(order.id)))
  return s ? `/admin/sales/subscriptions/${s.id}` : null
}

/**
 * El archivo de «Export» (Polar: ExportOrdersModal / ExportSubscriptionsModal), ya armado por el único armador de CSV de la app
 * (lib/csv-celda.ts: comillas, y lo que arranca como fórmula se neutraliza: un nombre o un concepto lo escribió otra persona).
 * `filas` es cuántos renglones de datos lleva (sin el encabezado). Lo baja ExportCsvModal.
 */
export type ArchivoCsv = { texto: string; filas: number }

export const csvDePedidos = (pedidos: readonly Pedido[]): ArchivoCsv => ({ texto: armarCsv(filasCsvPedidos(pedidos)), filas: pedidos.length })
export const csvDeSuscripciones = (subs: readonly SuscripcionVenta[]): ArchivoCsv => ({ texto: armarCsv(filasCsvSuscripciones(subs)), filas: subs.length })

/** Las filas del CSV de pedidos, con las del filtro (las celdas las escapa `armarCsv`, en `csvDePedidos`). */
export function filasCsvPedidos(pedidos: readonly Pedido[]): Array<Array<string | number | null>> {
  return [
    ['Fecha', 'Cliente', 'Concepto', 'Estado', 'Motivo', 'Medio', 'Monto (USD)', 'Recibo'],
    ...pedidos.map((p) => [
      p.fecha, p.cliente?.nombre ?? null, p.concepto, ROTULO_ESTADO_PEDIDO[p.estado], motivoDePedido(p), medioEnTexto(p.medio), p.usd,
      p.recibo ? `N.º ${String(p.recibo.numero).padStart(4, '0')}` : null,
    ]),
  ]
}

export const ROTULO_ESTADO_PEDIDO: Readonly<Record<EstadoPedido, string>> = {
  paid: 'Pagado', partially_refunded: 'Devolución parcial', refunded: 'Devuelto', void: 'Anulado',
}

// ── Cargar pago (el recibo de lo que entró por fuera de la pasarela) ─────────────────────────────────────────────────
// Los mismos campos que pide `emitirReciboManual` (lib/recibos.ts), que es quien vuelve a validar todo. Acá se avisa antes.

export const MONEDAS_RECIBO = ['USD', 'USDT', 'USDC', 'ARS', 'MXN', 'EUR'] as const

export type LineaCargarPago = { concepto: string; mes: string; monto: string }
/**
 * `pagoCrm`: el pago del CRM de la plataforma que ES este cobro (su id, como texto del select), o '' = registrarlo en el CRM al
 * emitir (punto 4: «Cargar pago» registra el pago en `pagos` del lead de esa cuenta; si ya estaba, se ata en vez de crear otro).
 */
export type PagoCargarPago = { medio: MedioRecibo; referencia: string; fecha: string; hora: string; monto: string; moneda: string; de: string; comprobante: { path: string; nombre: string } | null; pagoCrm: string }
export type FormCargarPago = { cuenta: string; aNombre: string; moneda: string; lineas: LineaCargarPago[]; pagos: PagoCargarPago[]; notaPdf: string; notaInterna: string }

export function formCargarPagoInicial(hoy: string): FormCargarPago {
  return {
    cuenta: '', aNombre: '', moneda: 'USD',
    lineas: [{ concepto: '', mes: '', monto: '' }],
    pagos: [{ medio: 'binance', referencia: '', fecha: hoy, hora: '12:00', monto: '', moneda: 'USDT', de: '', comprobante: null, pagoCrm: '' }],
    notaPdf: '', notaInterna: '',
  }
}

const numero = (s: string): number => {
  const n = Number(String(s).replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

/** El primer problema del formulario, o null (los textos de `emitirReciboManual`). */
export function problemaCargarPago(f: FormCargarPago, subiendo: boolean): string | null {
  if (!f.cuenta) return 'Elige la cuenta.'
  if (!f.aNombre.trim()) return 'Falta a nombre de quién va.'
  if (!f.lineas.length || f.lineas.some((l) => !l.concepto.trim() || !(numero(l.monto) > 0))) return 'Cada renglón necesita concepto e importe.'
  if (!f.pagos.length) return 'Falta cómo se pagó.'
  for (const p of f.pagos) {
    if (!esMedio(p.medio)) return `Ese medio no está en la lista (${MEDIOS.join(', ')}).`
    if (!referenciaNormal(p.medio, p.referencia)) return p.medio === 'binance' ? 'La orden de Binance son los 18 dígitos del «Order ID».' : 'Falta la referencia del pago.'
    if (!(numero(p.monto) > 0) || !p.fecha) return 'Cada pago necesita fecha y monto.'
  }
  if (subiendo) return 'Espera a que termine de subir el comprobante.'
  return null
}

/** Por moneda, lo que suman los montos válidos (> 0), redondeado a centavos: el detalle en la moneda del recibo, lo recibido en las de cada pago. */
function totalesPorMoneda(xs: ReadonlyArray<{ monto: string; moneda: string }>): Array<{ moneda: string; monto: number }> {
  const t: Record<string, number> = {}
  for (const x of xs) {
    const n = numero(x.monto)
    if (n > 0) t[x.moneda] = Math.round(((t[x.moneda] ?? 0) + n) * 100) / 100
  }
  return Object.entries(t).map(([moneda, monto]) => ({ moneda, monto }))
}

/**
 * El aviso de la pantalla de antes (app/admin/cobros/CargarPago.tsx, 146b280e) cuando lo recibido no es lo que dice el recibo: de más
 * o de menos, y que la diferencia no queda como saldo. La regla es la de siempre (`diferencia`, lib/recibos-reglas.ts): sólo si TODO
 * se pagó en la moneda del recibo (nunca se calcula una tasa) y hay algo en el detalle; con monedas distintas no hay aviso. null =
 * no hay nada que avisar.
 */
export function avisoDeDiferencia(f: Pick<FormCargarPago, 'moneda' | 'lineas' | 'pagos'>): string | null {
  const detalle = totalesPorMoneda(f.lineas.map((l) => ({ monto: l.monto, moneda: f.moneda })))
  if (detalle.length !== 1) return null
  const dif = diferencia(detalle[0].monto, detalle[0].moneda, totalesPorMoneda(f.pagos))
  if (dif == null || dif === 0) return null
  return `${dif > 0 ? 'De más' : 'De menos'}: ${formatoMonto(Math.abs(dif), detalle[0].moneda)}. No queda como saldo: anótalo en la nota.`
}

/** Lo que recibe `cargarPagoAction` (app/admin/cobros/recibos-actions.ts). */
export function pedidoCargarPago(f: FormCargarPago, formId: string, enviar: boolean) {
  return {
    formId,
    destinoWs: Number(f.cuenta),
    aNombre: f.aNombre.trim(),
    mes: null,
    lineas: f.lineas.map((l) => ({ concepto: l.concepto.trim(), mes: l.mes.trim() || null, monto: numero(l.monto), moneda: f.moneda })),
    pagos: f.pagos.map((p) => ({
      medio: p.medio, referencia: p.referencia, fecha: `${p.fecha}T${p.hora || '00:00'}`, monto: numero(p.monto), moneda: p.moneda,
      de: p.de.trim() || null, comprobante_path: p.comprobante?.path ?? null, comprobante_nombre: p.comprobante?.nombre ?? null,
      pago_crm: /^[1-9]\d{0,11}$/.test(p.pagoCrm) ? Number(p.pagoCrm) : null,
    })),
    notaPdf: f.notaPdf.trim() || null,
    notaInterna: f.notaInterna.trim() || null,
    enviar,
  }
}

/**
 * «Usar el precio de un plan»: el concepto y el precio del plan en el primer renglón, y la moneda del recibo en DÓLARES (punto 17:
 * el precio de un plan es en dólares; con el recibo en ARS dejaba «ARS 97», y el aviso de diferencia no lo veía).
 */
export function conElPrecioDelPlan(f: FormCargarPago, plan: { nombre: string; precioUsd: number }): FormCargarPago {
  return {
    ...f,
    moneda: 'USD',
    lineas: f.lineas.map((l, i) => (i === 0 ? { ...l, concepto: plan.nombre, monto: String(plan.precioUsd) } : l)),
  }
}

/** Un pago del CRM de la plataforma que no tiene recibo: lo que «Cargar pago» ofrece primero para atar (punto 4). */
export type PagoSinRecibo = { pagoId: number; ws: number; fecha: string; usd: number | null; medio: string | null; concepto: string | null }

/** Los pagos del CRM (`p-<id>`) con su cuenta de MaKo y sin recibo, de los pedidos de Orders. El más nuevo primero. */
export function pagosSinReciboDe(pedidos: readonly Pedido[]): PagoSinRecibo[] {
  return pedidos
    .filter((p) => p.origen === 'crm' && !p.recibo && p.estado === 'paid' && p.cliente?.ws != null && /^p-\d+$/.test(p.id))
    .map((p) => ({ pagoId: Number(p.id.slice(2)), ws: p.cliente!.ws as number, fecha: p.fecha, usd: p.usd, medio: p.medio, concepto: p.concepto }))
    .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : b.pagoId - a.pagoId))
}

// =============================================================================
// SUBSCRIPTIONS
// =============================================================================

/** El estado, con los nombres de Polar (`schemas['SubscriptionStatus']`) que MaKo puede llenar. */
export const ESTADOS_SUSCRIPCION = ['active', 'past_due', 'canceled'] as const
export type EstadoSuscripcionVenta = (typeof ESTADOS_SUSCRIPCION)[number]
export const esEstadoSuscripcion = (v: unknown): v is EstadoSuscripcionVenta => ESTADOS_SUSCRIPCION.includes(v as EstadoSuscripcionVenta)
export const ROTULO_ESTADO_SUSCRIPCION: Readonly<Record<EstadoSuscripcionVenta, string>> = {
  active: 'Activa', past_due: 'Atrasada', canceled: 'Cortada',
}
/** El filtro de Polar arranca en «Activa» (`DEFAULT_SUBSCRIPTION_STATUS`). */
export type FiltroEstadoSuscripcion = 'any' | EstadoSuscripcionVenta
export const ESTADO_SUSCRIPCION_POR_DEFECTO: FiltroEstadoSuscripcion = 'active'

export type EstadoMesVenta = 'pagado' | 'parcial' | 'vencido' | 'vence-hoy' | 'por-cobrar' | 'proximo' | 'cortado'
export type CambioMesVenta = 'empezo' | 'subio' | 'bajo' | 'se-corto' | 'volvio'
export const ROTULO_ESTADO_MES: Readonly<Record<EstadoMesVenta, string>> = {
  pagado: 'Pagado', parcial: 'Parcial', vencido: 'Vencido', 'vence-hoy': 'Vence hoy', 'por-cobrar': 'Por cobrar', proximo: 'Próximo', cortado: 'Cortada',
}
export const ROTULO_CAMBIO_MES: Readonly<Record<CambioMesVenta, string>> = {
  empezo: 'Empezó', subio: 'Subió', bajo: 'Bajó', 'se-corto': 'Se cortó', volvio: 'Volvió',
}

/** Un mes de la historia (lib/suscripcion-meses.ts), con los pedidos que lo pagaron. */
export type MesVenta = {
  mes: string
  vence: string
  esperadoUsd: number | null
  pagadoUsd: number
  faltaUsd: number | null
  estado: EstadoMesVenta
  cambio: CambioMesVenta | null
  antesUsd: number | null
  /** Los pedidos (`p-<id>`) de los pagos de este mes. */
  pedidos: string[]
}

export type SuscripcionVenta = {
  /** `l-<id del lead>` (a mano o la pasarela de ese lead) o `c-<id del cobro>` (la pasarela, sin lead de suscripción). */
  id: string
  fuente: 'manual' | 'pasarela'
  cliente: ClienteVenta
  estado: EstadoSuscripcionVenta
  /** La venta (YYYY-MM-DD). */
  empezo: string | null
  /** El próximo vencimiento de hoy en adelante (lo que dice «próxima el …»). Null si no renueva o no se sabe. */
  renovacion: string | null
  /** Plazo fijo que todavía no terminó: cuándo termina. */
  terminaEl: string | null
  /** Cuándo se cortó o terminó (YYYY-MM-DD o YYYY-MM). */
  termino: string | null
  /** Lo que se vendió: el plan o el concepto del cobro; a mano, el concepto del último pago. */
  producto: string | null
  /** Lo que paga por mes hoy. */
  mensualidadUsd: number | null
  /** La mensualidad no está cargada: sale de lo pagado el último mes. */
  mensualidadEstimada: boolean
  diaDeCobro: number | null
  /** El plazo fijo en meses (null = mes a mes). */
  meses: number | null
  deudaUsd: number
  mesesSinPagar: number
  mesesParciales: number
  pagadoUsd: number
  /** El primer mes que falta completar (lo que va en «Próximo cobro»). */
  proximo: { mes: string; vence: string; faltaUsd: number | null; vencido: boolean } | null
  historia: MesVenta[]
  /** La renovación de la pasarela falló y no entró otra (el motivo). */
  renovacionFallida: string | null
  /** El cobro de la pasarela que la cobra todos los meses, si se puede cortar desde acá. */
  cobroParaCortar: number | null
  /** Los cobros de suscripción de la pasarela que son de ella (los de su lead, o el suyo): para hallarla desde un pedido (punto 19). */
  cobroIds?: number[]
}

/** Lo que el server lee de una suscripción de un lead (lib/admin-ingresos.ts, `suscripcionesDeLaPlataforma`), recortado. */
export type SuscripcionDeLead = {
  leadId: number
  nombre: string
  email: string | null
  clienteWs: number | null
  estadoLead: string | null
  fechaCierre: string | null
  cobradoUsd: number
  suscripcion: {
    estado: 'activa' | 'cancelada' | 'terminada'
    fuente: 'manual' | 'pasarela'
    mensualidadUsd: number | null
    mensualidadInferida: boolean
    meses: number | null
    finPlazo: string | null
    proximaRenovacion: string | null
    renovacionFallida: string | null
    proximoMes: { mes: string; vence: string; faltaUsd: number | null; vencido: boolean } | null
    historia: {
      meses: Array<{ mes: string; vence: string; esperadoUsd: number | null; pagadoUsd: number; faltaUsd: number | null; estado: EstadoMesVenta; cambio: CambioMesVenta | null; antesUsd: number | null; pagos: Array<{ id: number | null }> }>
      diaDeCobro: number | null
      cortadaDesde: string | null
      terminada: boolean
      deudaUsd: number
      mesesSinPagar: number
      mesesParciales: number
      totalPagadoUsd: number
    }
  }
  /** Los conceptos de sus pagos cobrados, del más viejo al más nuevo. */
  conceptos: string[]
  /** Los cobros de suscripción de la pasarela de este lead. */
  cobroIds: number[]
}

/** Lo que el server lee de un cobro de la pasarela (`cobrosDeMakoAction`, app/admin/cobros/actions.ts), recortado. */
export type CobroVenta = {
  id: number
  nombre: string | null
  email: string | null
  plan: string | null
  concepto: string
  monto: number
  moneda: string
  montoUsd: number | null
  tipo: TipoCobro
  modo: ModoCobro
  proveedor: string
  estado: EstadoCobro
  motivo: string | null
  altaEstado: EstadoAlta | null
  altaWs: number | null
  altaWsNombre: string | null
  /** La capa que da de alta al pagarse (con `creadoPor` dice si es un link de «Vender un plan»: ./checkout-link.ts). */
  altaCapa: string | null
  creadoPor: string | null
  createdAt: string
  pagadoAt: string | null
  /** /pagar/<token>, sólo mientras se puede pagar. */
  link: string | null
  suscripcionViva: boolean
  /**
   * El id en la pasarela del PRIMER pago del cobro (`cobros.proveedor_pago_id`): el que devuelve `reembolsarCobro`. Un pedido con
   * otro id es una renovación (punto 1).
   */
  proveedorPagoId?: string | null
}

/**
 * Las suscripciones: los leads de suscripción que son clientes (ganados, o que pagaron alguna vez: un lead que se perdió
 * después de cortar sigue siendo una suscripción cortada; un prospecto con `venta_tipo` puesto y sin pagos, no), y los cobros de
 * suscripción de la pasarela que no son de ninguno de esos leads.
 */
export function suscripcionesDe(e: {
  leads: readonly SuscripcionDeLead[]
  cobros: readonly CobroVenta[]
  nombreDeWs: ReadonlyMap<number, string>
  hoy: string
}): SuscripcionVenta[] {
  const out: SuscripcionVenta[] = []
  const deLeads = new Set<number>()
  const cobroDe = new Map(e.cobros.map((c) => [c.id, c]))
  for (const l of e.leads) {
    for (const id of l.cobroIds) deLeads.add(id)
    if (l.estadoLead !== 'ganado' && !(l.cobradoUsd > 0)) continue
    const s = l.suscripcion
    const h = s.historia
    // «Atrasada» también con deuda (punto 8): quien pagó una parte de un mes vencido seguía «Activa» y no se distinguía.
    const estado: EstadoSuscripcionVenta = s.estado !== 'activa' ? 'canceled' : s.fuente === 'manual' && (h.mesesSinPagar > 0 || h.deudaUsd > 0) ? 'past_due' : s.renovacionFallida ? 'past_due' : 'active'
    const viva = l.cobroIds.map((id) => cobroDe.get(id)).find((c) => c?.suscripcionViva)
    out.push({
      id: `l-${l.leadId}`,
      fuente: s.fuente,
      cliente: { clave: l.clienteWs != null ? `ws:${l.clienteWs}` : `lead:${l.leadId}`, nombre: l.clienteWs != null ? e.nombreDeWs.get(l.clienteWs) ?? l.nombre : l.nombre, ws: l.clienteWs, leadId: l.leadId, email: l.email },
      estado,
      empezo: l.fechaCierre,
      renovacion: estado === 'canceled' ? null : s.proximaRenovacion,
      terminaEl: estado !== 'canceled' && s.finPlazo && s.finPlazo > e.hoy ? s.finPlazo : null,
      termino: s.estado === 'terminada' ? s.finPlazo : s.estado === 'cancelada' ? h.cortadaDesde ?? null : null,
      producto: viva?.plan ?? viva?.concepto ?? l.conceptos.at(-1) ?? null,
      mensualidadUsd: estado === 'canceled' ? null : s.mensualidadUsd,
      mensualidadEstimada: s.mensualidadInferida,
      diaDeCobro: h.diaDeCobro,
      meses: s.meses,
      deudaUsd: s.fuente === 'manual' ? h.deudaUsd : 0,
      mesesSinPagar: s.fuente === 'manual' ? h.mesesSinPagar : 0,
      mesesParciales: s.fuente === 'manual' ? h.mesesParciales : 0,
      pagadoUsd: l.cobradoUsd,
      proximo: estado === 'canceled' ? null : s.proximoMes,
      historia: s.fuente === 'manual'
        ? h.meses.map((m) => ({ mes: m.mes, vence: m.vence, esperadoUsd: m.esperadoUsd, pagadoUsd: m.pagadoUsd, faltaUsd: m.faltaUsd, estado: m.estado, cambio: m.cambio, antesUsd: m.antesUsd, pedidos: m.pagos.filter((p) => p.id != null).map((p) => `p-${p.id}`) }))
        : [],
      renovacionFallida: s.renovacionFallida,
      cobroParaCortar: viva?.id ?? null,
      cobroIds: [...l.cobroIds],
    })
  }
  for (const c of e.cobros) {
    if (c.tipo !== 'suscripcion' || deLeads.has(c.id) || (c.estado !== 'pagado' && c.estado !== 'reembolsado')) continue
    out.push({
      id: `c-${c.id}`,
      fuente: 'pasarela',
      cliente: { clave: c.altaWs != null ? `ws:${c.altaWs}` : null, nombre: c.altaWsNombre ?? c.nombre ?? c.email ?? `Cobro ${c.id}`, ws: c.altaWs, leadId: null, email: c.email },
      estado: c.suscripcionViva ? 'active' : 'canceled',
      empezo: (c.pagadoAt ?? c.createdAt).slice(0, 10),
      // La pasarela no le cuenta a MaKo cuándo vuelve a cobrar: no se dibuja una fecha calculada.
      renovacion: null,
      terminaEl: null,
      termino: null,
      producto: c.plan ?? c.concepto,
      mensualidadUsd: c.suscripcionViva ? c.montoUsd : null,
      mensualidadEstimada: false,
      diaDeCobro: null,
      meses: null,
      deudaUsd: 0, mesesSinPagar: 0, mesesParciales: 0,
      pagadoUsd: c.estado === 'pagado' ? c.montoUsd ?? 0 : 0,
      proximo: null,
      historia: [],
      renovacionFallida: null,
      cobroParaCortar: c.suscripcionViva ? c.id : null,
      cobroIds: [c.id],
    })
  }
  return out
}

export type FiltroSuscripciones = { estado: FiltroEstadoSuscripcion; intervalo: Intervalo }

/**
 * Polar filtra por estado y por la fecha en que EMPEZÓ (`started_after`/`started_before`). ⚠️ «Activa» también muestra las
 * ATRASADAS (punto 8): Polar no las incluye en Active, pero esta pantalla contesta quién debe, y «Por cobrar › Ver todo» abría la
 * lista en «Activa» sin ninguna de las que deben (está en «Diferencias con Polar» del relevo). «Atrasada» sigue aparte.
 */
export function filtrarSuscripciones(subs: readonly SuscripcionVenta[], f: FiltroSuscripciones, hoy: string): SuscripcionVenta[] {
  const rango = rangoDe(f.intervalo, hoy)
  const pasa = (s: SuscripcionVenta) => f.estado === 'any' || s.estado === f.estado || (f.estado === 'active' && s.estado === 'past_due')
  return subs.filter((s) => pasa(s) && (rango == null || (s.empezo != null && enRango(s.empezo, rango))))
}

/** Las atrasadas primero, sin tocar el orden de adentro de cada grupo (el de la columna elegida): como `suscripcionesDelNegocio`. */
export const primeroLasAtrasadas = <T extends Pick<SuscripcionVenta, 'estado'>>(subs: readonly T[]): T[] =>
  [...subs.filter((s) => s.estado === 'past_due'), ...subs.filter((s) => s.estado !== 'past_due')]

export const COMPARADORES_SUSCRIPCION: Readonly<Record<string, (a: SuscripcionVenta, b: SuscripcionVenta) => number>> = {
  customer: (a, b) => porTexto(a.cliente.nombre, b.cliente.nombre),
  status: (a, b) => ESTADOS_SUSCRIPCION.indexOf(a.estado) - ESTADOS_SUSCRIPCION.indexOf(b.estado),
  started_at: (a, b) => porTexto(a.empezo, b.empezo),
  current_period_end: (a, b) => porTexto(a.renovacion, b.renovacion),
  product: (a, b) => porTexto(a.producto, b.producto),
}

export function filasCsvSuscripciones(subs: readonly SuscripcionVenta[]): Array<Array<string | number | null>> {
  return [
    ['Cliente', 'Estado', 'Desde', 'Próxima', 'Producto', 'Por mes (USD)', 'Debe (USD)', 'Cobra'],
    ...subs.map((s) => [s.cliente.nombre, ROTULO_ESTADO_SUSCRIPCION[s.estado], s.empezo, s.renovacion, s.producto, s.mensualidadUsd, s.deudaUsd || null, s.fuente === 'manual' ? 'A mano' : 'La pasarela']),
  ]
}

// =============================================================================
// CHECKOUTS
// =============================================================================

/** El estado de un checkout, con los de Polar (`schemas['CheckoutStatus']`) que MaKo llena: un link sin pagar. */
export const ESTADOS_CHECKOUT = ['open', 'failed', 'expired'] as const
export type EstadoCheckout = (typeof ESTADOS_CHECKOUT)[number]
export const esEstadoCheckout = (v: unknown): v is EstadoCheckout => ESTADOS_CHECKOUT.includes(v as EstadoCheckout)
export const ROTULO_ESTADO_CHECKOUT: Readonly<Record<EstadoCheckout, string>> = { open: 'Abierto', failed: 'Rechazado', expired: 'Anulado' }
const ESTADO_CHECKOUT_DE: Partial<Record<EstadoCobro, EstadoCheckout>> = { pendiente: 'open', fallido: 'failed', anulado: 'expired' }

export type CheckoutVenta = {
  id: number
  estado: EstadoCheckout
  createdAt: string
  nombre: string | null
  email: string | null
  producto: string
  monto: number
  moneda: string
  montoUsd: number | null
  tipo: TipoCobro
  modo: ModoCobro
  proveedor: string
  motivo: string | null
  link: string | null
}

/**
 * Los cobros SIN pagar: lo pagado ya es un pedido (Orders), y un reembolsado también. El más nuevo primero. Un link de «Vender
 * un plan» no es un checkout: es un Checkout Link (Products › Checkout Links), y mostrarlo acá era el mismo cobro dos veces.
 */
export function checkoutsDe(cobros: readonly CobroVenta[]): CheckoutVenta[] {
  return cobros
    .flatMap((c): CheckoutVenta[] => {
      if (esDeVenderUnPlan({ alta_capa: c.altaCapa, creado_por: c.creadoPor })) return []
      const estado = ESTADO_CHECKOUT_DE[c.estado]
      return estado
        ? [{ id: c.id, estado, createdAt: c.createdAt, nombre: c.nombre, email: c.email, producto: c.plan ?? c.concepto, monto: c.monto, moneda: c.moneda, montoUsd: c.montoUsd, tipo: c.tipo, modo: c.modo, proveedor: c.proveedor, motivo: c.motivo, link: c.link }]
        : []
    })
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : b.id - a.id))
}

export type FiltroCheckouts = { estado: EstadoCheckout | null; consulta: string }

/** Polar filtra por email (`query`) y por estado. */
export function filtrarCheckouts(lista: readonly CheckoutVenta[], f: FiltroCheckouts): CheckoutVenta[] {
  const q = f.consulta.trim().toLocaleLowerCase('es')
  return lista.filter((c) => (!f.estado || c.estado === f.estado) && (!q || `${c.email ?? ''} ${c.nombre ?? ''}`.toLocaleLowerCase('es').includes(q)))
}

export const COMPARADORES_CHECKOUT: Readonly<Record<string, (a: CheckoutVenta, b: CheckoutVenta) => number>> = {
  created_at: (a, b) => porTexto(a.createdAt, b.createdAt) || a.id - b.id,
  status: (a, b) => ESTADOS_CHECKOUT.indexOf(a.estado) - ESTADOS_CHECKOUT.indexOf(b.estado),
}

// =============================================================================
// DISPUTES
// =============================================================================

/** En qué quedó un contracargo, leído del texto que escribió lib/cobros-reglas.ts (`textoContracargo`): es lo único guardado. */
export const ESTADOS_DISPUTA = ['abierta', 'plata_afuera', 'plata_volvio', 'ganada', 'perdida', 'cerrada', 'en_revision'] as const
export type EstadoDisputa = (typeof ESTADOS_DISPUTA)[number]
export const esEstadoDisputa = (v: unknown): v is EstadoDisputa => ESTADOS_DISPUTA.includes(v as EstadoDisputa)
export const ROTULO_ESTADO_DISPUTA: Readonly<Record<EstadoDisputa, { titulo: string; color: 'green' | 'red' | 'yellow' | 'gray' }>> = {
  abierta: { titulo: 'Abierta', color: 'yellow' },
  plata_afuera: { titulo: 'Plata descontada', color: 'red' },
  plata_volvio: { titulo: 'Plata devuelta', color: 'green' },
  ganada: { titulo: 'Ganada', color: 'green' },
  perdida: { titulo: 'Perdida', color: 'red' },
  cerrada: { titulo: 'Cerrada', color: 'gray' },
  en_revision: { titulo: 'En revisión', color: 'yellow' },
}

export function estadoDeDisputa(texto: string): EstadoDisputa {
  if (/^El cliente disputó/.test(texto)) return 'abierta'
  if (/descontó la plata/.test(texto)) return 'plata_afuera'
  if (/devolvió la plata de la disputa/.test(texto)) return 'plata_volvio'
  if (/^La disputa se ganó/.test(texto)) return 'ganada'
  if (/^La disputa se perdió/.test(texto)) return 'perdida'
  if (/^Contracargo en Mercado Pago/.test(texto)) return 'en_revision'
  return 'cerrada'
}

/** El porqué que dijo el cliente (lo que va entre paréntesis en el texto: «dice que no reconoce la compra»), o null. */
export function razonDeDisputa(texto: string): string | null {
  const m = /\(([^)]+)\)/.exec(texto)
  return m ? m[1] : null
}

export type DisputaVenta = {
  /** `c-<id del cobro>` o `r-<id del recibo>`. */
  id: string
  /** El pedido que se disputó (su detalle tiene la disputa), si está en Orders. */
  pedido: string | null
  cliente: string
  estado: EstadoDisputa
  razon: string | null
  texto: string
  usd: number | null
  proveedor: string | null
}

/**
 * Los contracargos: los cobros de la plataforma cuyo motivo es uno de `textoContracargo`, y los recibos con su disputa escrita
 * que no son de esos cobros. MaKo no guarda cuándo se abrió ni hasta cuándo se responde: esas columnas de Polar no van.
 */
export function disputasDe(e: { cobros: readonly CobroVenta[]; recibos: readonly ReciboVenta[]; pedidos: readonly Pedido[] }): DisputaVenta[] {
  const pedidoDeCobro = new Map<number, string>()
  for (const p of e.pedidos) if (p.cobroId != null && !pedidoDeCobro.has(p.cobroId)) pedidoDeCobro.set(p.cobroId, p.id)
  const pedidoDeRecibo = new Map<number, string>()
  for (const p of e.pedidos) if (p.recibo) pedidoDeRecibo.set(p.recibo.id, p.id)
  const out: DisputaVenta[] = []
  const cobrosConDisputa = new Set<number>()
  for (const c of e.cobros) {
    if (!c.motivo || !esTextoDeContracargo(c.motivo)) continue
    cobrosConDisputa.add(c.id)
    out.push({
      id: `c-${c.id}`, pedido: pedidoDeCobro.get(c.id) ?? null, cliente: c.altaWsNombre ?? c.nombre ?? c.email ?? `Cobro ${c.id}`,
      estado: estadoDeDisputa(c.motivo), razon: razonDeDisputa(c.motivo), texto: c.motivo, usd: c.montoUsd, proveedor: c.proveedor,
    })
  }
  for (const r of e.recibos) {
    if (!r.disputa || (r.cobroId != null && cobrosConDisputa.has(r.cobroId))) continue
    out.push({
      id: `r-${r.id}`, pedido: pedidoDeRecibo.get(r.id) ?? null, cliente: r.aNombre, estado: estadoDeDisputa(r.disputa),
      razon: razonDeDisputa(r.disputa), texto: r.disputa, usd: usdDelRecibo(r), proveedor: r.pagos.find((p) => !p.anulado)?.medio ?? null,
    })
  }
  return out
}

export function filtrarDisputas(lista: readonly DisputaVenta[], estado: EstadoDisputa | null): DisputaVenta[] {
  return estado ? lista.filter((d) => d.estado === estado) : [...lista]
}
