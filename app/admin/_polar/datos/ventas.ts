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
//     atado a su RECIBO por el cobro (`recibos.cobro_id`), más los recibos que no tienen su pago en lo cobrado (los de «Cargar
//     pago»: el libro de recibos, lib/recibos.ts). El estado sale del recibo (devuelto, anulado…); sin recibo, «Pagado».
//   · Subscriptions: cada lead de suscripción de la plataforma con su historia mes a mes (`suscripcionesDeLaPlataforma`, la misma
//     cuenta que la ficha) y los cobros de suscripción de la pasarela que no son de ninguno de esos leads.
//   · Checkouts: los cobros de la pasarela que NO se pagaron (pendientes, rechazados, anulados): lo pagado ya es un pedido.
//   · Disputes: los cobros cuyo motivo es un contracargo (lib/cobros-reglas.ts, `esTextoDeContracargo`) y los recibos marcados.
//
// Sin `server-only` ni `'use client'`: lo usan las vistas del navegador y tests/admin-polar-ventas.test.ts, que lo EJECUTA.
// ⚠️ PLATA EN DÓLARES DE VERDAD. Lo que no tiene su valor en dólares (`usd: null`) no suma: nunca se convierte con una tasa.
// =============================================================================

import { esTextoDeContracargo } from '@/lib/cobros-reglas'
import { NOMBRE_PASARELA, esPasarela, type EstadoAlta, type EstadoCobro, type ModoCobro, type TipoCobro } from '@/lib/cobros-tipos'
import { MEDIOS, ROTULO_MEDIO, esMedio, referenciaNormal, type EstadoRecibo, type MedioRecibo } from '@/lib/recibos-reglas'
import type { Metric } from './polar-tipos'

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

/** Un pedido: un pago que entró (con su recibo, si tiene) o un recibo cuyo pago no está en lo cobrado. */
export type Pedido = {
  /** `p-<id de pagos>` (el CRM), `c-<id de cobros>` (la pasarela) o `r-<id de recibos>` (sólo el recibo). */
  id: string
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
 * Los pedidos: cada entrada de lo cobrado con su recibo (atado por el cobro), y cada recibo que no quedó atado a ninguna entrada
 * (un pago cargado a mano con «Cargar pago», que no vive en el CRM). El más nuevo primero.
 * ⚠️ Un pago cargado a mano en el CRM Y con su recibo de «Cargar pago» sale DOS veces: MaKo no guarda qué recibo es de qué pago
 * del CRM (no hay columna que los ate), y atarlos por fecha y monto sería adivinar. Lo dice el informe de la tab.
 */
export function pedidosDe(e: {
  entradas: readonly EntradaVenta[]
  recibos: readonly ReciboVenta[]
  clientes: ReadonlyMap<string, Omit<ClienteVenta, 'email'> & { email?: string | null }>
  nombreDeWs: ReadonlyMap<number, string>
}): Pedido[] {
  const reciboDeCobro = new Map<number, ReciboVenta>()
  for (const r of e.recibos) if (r.cobroId != null && !reciboDeCobro.has(r.cobroId)) reciboDeCobro.set(r.cobroId, r)
  const usados = new Set<number>()
  const out: Pedido[] = []
  for (const x of e.entradas) {
    if (!x.id || !/^[pc]:\d+$/.test(x.id)) continue
    const recibo = x.cobroId != null ? reciboDeCobro.get(x.cobroId) ?? null : null
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
    })
  }
  for (const r of e.recibos) {
    if (usados.has(r.id)) continue
    const nombre = r.destinoWs != null ? e.nombreDeWs.get(r.destinoWs) ?? r.aNombre : r.aNombre
    out.push({
      id: `r-${r.id}`,
      fecha: r.fechaPago.slice(0, 10),
      cliente: { clave: r.destinoWs != null ? `ws:${r.destinoWs}` : null, nombre, ws: r.destinoWs, leadId: null, email: null },
      concepto: r.lineas.map((l) => l.concepto).join(', ') || null,
      medio: r.pagos.find((p) => !p.anulado)?.medio ?? null,
      recurrente: false,
      usd: usdDelRecibo(r),
      estado: estadoDePedido(r),
      recibo: r,
      cobroId: r.cobroId,
      origen: 'recibo',
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
 * centavos, como las métricas de Polar. Lo devuelto (refunded/void) no suma a lo que entró; lo que no tiene dólares, tampoco.
 */
export function totalesDePedidos(pedidos: readonly Pedido[]): { orders: number; revenue: number; averageOrderValue: number; sinDolares: number } {
  const valen = pedidos.filter((p) => p.estado === 'paid' || p.estado === 'partially_refunded')
  const conUsd = valen.filter((p) => p.usd != null)
  const revenue = r2(conUsd.reduce((s, p) => s + (p.usd as number), 0))
  return {
    orders: pedidos.length,
    revenue: aCentavos(revenue),
    averageOrderValue: conUsd.length ? aCentavos(r2(revenue / conUsd.length)) : 0,
    sinDolares: valen.length - conUsd.length,
  }
}

/** Lo que MiniMetricChartBox lee de una métrica: su nombre y su tipo (no su slug). */
export const METRICA_ORDERS: Metric = { slug: 'revenue', display_name: 'Orders', type: 'scalar' }
export const METRICA_REVENUE: Metric = { slug: 'revenue', display_name: 'Revenue', type: 'currency' }
export const METRICA_AOV: Metric = { slug: 'revenue', display_name: 'Average Order Value', type: 'currency' }

/** «Billing reason» de Polar, con lo que MaKo sabe: si es de una suscripción o un pago suelto. */
export const motivoDePedido = (p: Pick<Pedido, 'recurrente' | 'origen'>): string =>
  p.origen === 'recibo' ? 'Cargado a mano' : p.recurrente ? 'Suscripción' : 'Pago único'

/** El CSV de «Export» (Polar: ExportOrdersModal), con las filas del filtro. Las celdas las escapa quien arma el archivo. */
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
export type PagoCargarPago = { medio: MedioRecibo; referencia: string; fecha: string; hora: string; monto: string; moneda: string; de: string; comprobante: { path: string; nombre: string } | null }
export type FormCargarPago = { cuenta: string; aNombre: string; moneda: string; lineas: LineaCargarPago[]; pagos: PagoCargarPago[]; notaPdf: string; notaInterna: string }

export function formCargarPagoInicial(hoy: string): FormCargarPago {
  return {
    cuenta: '', aNombre: '', moneda: 'USD',
    lineas: [{ concepto: '', mes: '', monto: '' }],
    pagos: [{ medio: 'binance', referencia: '', fecha: hoy, hora: '12:00', monto: '', moneda: 'USDT', de: '', comprobante: null }],
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
    })),
    notaPdf: f.notaPdf.trim() || null,
    notaInterna: f.notaInterna.trim() || null,
    enviar,
  }
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
  createdAt: string
  pagadoAt: string | null
  /** /pagar/<token>, sólo mientras se puede pagar. */
  link: string | null
  suscripcionViva: boolean
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
    const estado: EstadoSuscripcionVenta = s.estado !== 'activa' ? 'canceled' : s.fuente === 'manual' && h.mesesSinPagar > 0 ? 'past_due' : s.renovacionFallida ? 'past_due' : 'active'
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
    })
  }
  return out
}

export type FiltroSuscripciones = { estado: FiltroEstadoSuscripcion; intervalo: Intervalo }

/** Polar filtra por estado y por la fecha en que EMPEZÓ (`started_after`/`started_before`). */
export function filtrarSuscripciones(subs: readonly SuscripcionVenta[], f: FiltroSuscripciones, hoy: string): SuscripcionVenta[] {
  const rango = rangoDe(f.intervalo, hoy)
  return subs.filter((s) => (f.estado === 'any' || s.estado === f.estado) && (rango == null || (s.empezo != null && enRango(s.empezo, rango))))
}

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

/** Los cobros SIN pagar: lo pagado ya es un pedido (Orders), y un reembolsado también. El más nuevo primero. */
export function checkoutsDe(cobros: readonly CobroVenta[]): CheckoutVenta[] {
  return cobros
    .flatMap((c): CheckoutVenta[] => {
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
