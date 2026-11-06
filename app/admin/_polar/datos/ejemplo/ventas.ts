// =============================================================================
// Admin › Sales (y Finance › Income) — datos de EJEMPLO (ficticios) para capturar cada vista sin la base
// =============================================================================
// Nada de acá es de un cliente real (AGENTS.md): negocios, personas y montos inventados. Los negocios, sus números, sus planes y
// sus PAGOS son los de ./negocios.ts (los mismos que el Overview, Customers y la ficha): cada pago de ahí es un pedido de Orders,
// pasado por la MISMA función que usa el server (`pedidosDe`), así Orders suma lo mismo que el Overview (revisión del 6/11/2026:
// antes eran otros negocios, con montos que no eran de ningún plan). Lo que ./negocios.ts no tiene y Sales necesita se arma acá,
// apoyado en sus negocios y sus pagos (sin tocarlo):
//   · los cobros de la pasarela (COBROS_EJEMPLO): el link de «Vender un plan» con que entró Floristería Pétalo (su pago del 2 de
//     noviembre es ese cobro), el de noviembre de Estudio Norte (con su recibo), el de octubre de Viajes Horizonte (disputado), el
//     rechazado de Taller Mecánico Ruta 9 (el 15 de octubre) y los que todavía nadie pagó;
//   · los recibos: el de Estudio Norte, y uno cargado a mano («Cargar pago») de Agencia Brújula que se DEVOLVIÓ (por eso no suma
//     en Orders ni mueve el total del Overview: entra y sale en Finance › Income);
//   · la historia mes a mes de cada suscripción, con los pagos de ./negocios.ts y el «Por cobrar» del Overview (las mismas filas).
// Cada objeto se TIPA con el tipo de su vista. Lo usan tests/admin-polar-ventas.test.ts, -arreglos-2 y -arreglos-3.

import { textoContracargo } from '@/lib/cobros-reglas'
import {
  checkoutsDe, conPorCobrar, disputasDe, pedidosDe, suscripcionesDe,
  type CheckoutVenta, type ClienteVenta, type CobroVenta, type DisputaVenta, type EntradaVenta, type EstadoMesVenta, type CambioMesVenta,
  type Pedido, type ReciboVenta, type SuscripcionDeLead, type SuscripcionVenta,
} from '../ventas'
import { resumenEjemplo } from './resumen'
import { ESENCIAL, HOY_NEGOCIOS, LEAD_SIN_CUENTA, NEGOCIOS, PAGOS_EJEMPLO, PRO, pagadoPor, type NegocioEjemplo, type PagoEjemplo } from './negocios'

export const HOY_EJEMPLO = HOY_NEGOCIOS

const { estudioNorte, panaderia, clinica, optica, gimnasio, taller, floristeria, viajes, agencia } = NEGOCIOS

/** La ficha del CRM de la plataforma de cada negocio (Estudio Norte es el lead 7, como en la ficha: ./cliente.ts). */
const LEAD: Record<number, number> = {
  [estudioNorte.ws]: 7, [panaderia.ws]: 8, [clinica.ws]: 9, [optica.ws]: 10, [gimnasio.ws]: 11, [taller.ws]: 12, [viajes.ws]: 14,
}

/** Quién es cada uno en su negocio (una persona, UNA vez: Ana Gómez es la de Estudio Norte, como en la ficha). */
export const PERSONAS_EJEMPLO: Record<number, { nombre: string; email: string }> = {
  [estudioNorte.ws]: { nombre: 'Ana Gómez', email: 'ana@ejemplo.com' },
  [panaderia.ws]: { nombre: 'Darío Ruiz', email: 'dario@otro-ejemplo.com' },
  [clinica.ws]: { nombre: 'Laura Pérez', email: 'laura@ejemplo.com' },
  [optica.ws]: { nombre: 'Pedro Díaz', email: 'pedro@ejemplo.com' },
  [gimnasio.ws]: { nombre: 'Mateo Lagos', email: 'mateo@ejemplo.com' },
  [taller.ws]: { nombre: 'Raúl Medina', email: 'raul@ejemplo.com' },
  [floristeria.ws]: { nombre: 'Sol Herrera', email: 'sol@ejemplo.com' },
  [viajes.ws]: { nombre: 'Inés Vidal', email: 'ines@ejemplo.com' },
  [agencia.ws]: { nombre: 'Nora Castro', email: 'nora@ejemplo.com' },
}

// ── Los cobros de la pasarela de la plataforma ──────────────────────────────────────────────────────────────────────────

const cobro = (c: Partial<CobroVenta> & Pick<CobroVenta, 'id' | 'nombre' | 'email' | 'createdAt'>): CobroVenta => ({
  plan: null, concepto: '', monto: ESENCIAL.precioUsd, moneda: 'USD', montoUsd: ESENCIAL.precioUsd, tipo: 'unico', modo: 'real',
  proveedor: 'stripe', estado: 'pendiente', motivo: null, altaEstado: null, altaWs: null, altaWsNombre: null, altaCapa: null,
  creadoPor: 'Super admin', pagadoAt: null, link: null, suscripcionViva: false, ...c,
})

/** El contracargo abierto del cobro de octubre de Viajes Horizonte, con el texto que escribe lib/cobros-reglas.ts. */
const DISPUTA_VIAJES = textoContracargo({ pasarela: 'stripe', fase: 'abierto', razon: 'fraudulent' })

export const COBROS_EJEMPLO: CobroVenta[] = [
  // «Vender un plan» (Products › Checkout Links): el link con que entró Floristería Pétalo, y dos que todavía no se pagaron.
  cobro({
    id: 101, nombre: PERSONAS_EJEMPLO[floristeria.ws].nombre, email: PERSONAS_EJEMPLO[floristeria.ws].email, plan: PRO.nombre, concepto: PRO.nombre,
    monto: PRO.precioUsd, montoUsd: PRO.precioUsd, tipo: 'suscripcion', estado: 'pagado', altaEstado: 'hecha', altaWs: floristeria.ws,
    altaWsNombre: floristeria.nombre, altaCapa: PRO.capa, createdAt: '2026-11-01T10:00:00Z', pagadoAt: '2026-11-02T13:05:00Z', suscripcionViva: true,
  }),
  cobro({
    id: 102, nombre: 'Julia Méndez', email: 'julia@ejemplo.com', plan: ESENCIAL.nombre, concepto: ESENCIAL.nombre, tipo: 'suscripcion',
    altaCapa: ESENCIAL.capa, createdAt: '2026-11-04T15:20:00Z', link: '/pagar/tok-ejemplo-102',
  }),
  cobro({
    id: 103, nombre: 'Diego Paz', email: 'diego@ejemplo.com', plan: ESENCIAL.nombre, concepto: ESENCIAL.nombre, tipo: 'suscripcion',
    proveedor: 'mercadopago', moneda: 'ARS', monto: 56000, montoUsd: null, estado: 'fallido', motivo: 'Mercado Pago rechazó la tarjeta.',
    altaCapa: ESENCIAL.capa, createdAt: '2026-11-03T18:00:00Z', link: '/pagar/tok-ejemplo-103',
  }),
  // El checkout público de /planes: no es un link de «Vender un plan» (va en Sales › Checkouts).
  cobro({
    id: 104, nombre: 'Luis Prado', email: 'luis@ejemplo.com', plan: PRO.nombre, concepto: PRO.nombre, monto: PRO.precioUsd, montoUsd: PRO.precioUsd,
    tipo: 'suscripcion', altaCapa: PRO.capa, creadoPor: 'planes:pro', createdAt: '2026-11-05T19:00:00Z', link: '/pagar/tok-ejemplo-104',
  }),
  // Las mensualidades cobradas desde la ficha del CRM (un link suelto): la rechazada de Taller Mecánico Ruta 9 (15 de octubre),
  // la de noviembre de Estudio Norte (con su recibo) y la de octubre de Viajes Horizonte (disputada).
  cobro({
    id: 105, nombre: PERSONAS_EJEMPLO[taller.ws].nombre, email: PERSONAS_EJEMPLO[taller.ws].email, concepto: 'Mensualidad de octubre',
    estado: 'fallido', motivo: 'La tarjeta no tenía fondos.', createdAt: '2026-10-15T12:00:00Z', link: '/pagar/tok-ejemplo-105',
  }),
  cobro({
    id: 106, nombre: PERSONAS_EJEMPLO[estudioNorte.ws].nombre, email: PERSONAS_EJEMPLO[estudioNorte.ws].email, concepto: 'Mensualidad de noviembre',
    monto: PRO.precioUsd, montoUsd: PRO.precioUsd, estado: 'pagado', createdAt: '2026-10-30T12:00:00Z', pagadoAt: '2026-11-01T15:19:00Z',
  }),
  cobro({
    id: 107, nombre: PERSONAS_EJEMPLO[viajes.ws].nombre, email: PERSONAS_EJEMPLO[viajes.ws].email, concepto: 'Mensualidad de octubre',
    monto: PRO.precioUsd, montoUsd: PRO.precioUsd, estado: 'pagado', motivo: DISPUTA_VIAJES, createdAt: '2026-10-01T12:00:00Z', pagadoAt: '2026-10-02T09:30:00Z',
  }),
]

// ── Los pedidos (Orders): los pagos de ./negocios.ts ───────────────────────────────────────────────────────────────────────

/** El cobro de la pasarela que asentó cada pago (el recibo se ata por él). */
const COBRO_DEL_PAGO: Record<string, number> = { [`pg-${estudioNorte.ws}-2026-11-01`]: 106, [`pg-${viajes.ws}-2026-10-02`]: 107 }
/** Los que entraron SÓLO por la pasarela (sin un pago del CRM que los nombre): en lo cobrado son `c:<cobro>`. */
const SOLO_PASARELA: Record<string, number> = { [`pg-${floristeria.ws}-2026-11-02`]: 101 }

/**
 * El id de cada pago de ./negocios.ts en lo cobrado (`p:<n>` del CRM o `c:<cobro>` de la pasarela), y el de su pedido en Sales
 * (`p-<n>`, `c-<cobro>`). Exportado para que la ficha de un negocio lleve a SU pedido (`/admin/sales/<pedido>`).
 */
export const ID_EN_LO_COBRADO: Record<string, string> = Object.fromEntries(
  PAGOS_EJEMPLO.map((p, i) => [p.id, SOLO_PASARELA[p.id] != null ? `c:${SOLO_PASARELA[p.id]}` : `p:${1001 + i}`]),
)
export const PEDIDO_DE_PAGO: Record<string, string> = Object.fromEntries(Object.entries(ID_EN_LO_COBRADO).map(([k, v]) => [k, v.replace(':', '-')]))

const ENTRADAS: EntradaVenta[] = PAGOS_EJEMPLO.filter((p) => p.fecha <= HOY_EJEMPLO).map((p) => ({
  id: ID_EN_LO_COBRADO[p.id], fecha: p.fecha, usd: p.usd, medio: p.medio, recurrente: p.recurrente, nombre: p.nombre, cliente: p.cliente,
  concepto: p.concepto, cobroId: COBRO_DEL_PAGO[p.id] ?? SOLO_PASARELA[p.id] ?? null,
}))

const reciboNorte: ReciboVenta = {
  id: 7, numero: 12, estado: 'emitido', origen: 'pasarela', aNombre: estudioNorte.nombre, destinoWs: estudioNorte.ws, cobroId: 106,
  emitidoAt: '2026-11-01T15:20:00Z', fechaPago: '2026-11-01T15:19:00Z',
  lineas: [{ concepto: PRO.nombre, mes: 'noviembre 2026', monto: PRO.precioUsd, moneda: 'USD' }],
  totalDetalle: PRO.precioUsd, monedaDetalle: 'USD', totales: [{ moneda: 'USD', monto: PRO.precioUsd }], impuesto: null,
  correoEstado: 'enviado', correoA: [PERSONAS_EJEMPLO[estudioNorte.ws].email], correoError: null, waEstado: 'enviado', waError: null, soloCorreo: false,
  devueltoAt: null, devueltoMonto: null, disputa: null, anuladoAt: null,
  pagos: [{ id: 70, medio: 'stripe', referencia: 'pi_ejemplo_123', fecha: '2026-11-01T15:19:00Z', monto: PRO.precioUsd, moneda: 'USD', montoUsd: PRO.precioUsd, de: null, comprobante: false, anulado: false }],
  historial: [{ at: '2026-11-01T15:20:00Z', que: 'Emitido por el pago pi_ejemplo_123' }],
}

/** Un pago cargado a mano («Cargar pago», por Binance) que después se devolvió: entra y sale (Finance › Income), no suma en Orders. */
const reciboBrujula: ReciboVenta = {
  id: 8, numero: 13, estado: 'devuelto', origen: 'manual', aNombre: agencia.nombre, destinoWs: agencia.ws, cobroId: null,
  emitidoAt: '2026-10-12T15:00:00Z', fechaPago: '2026-10-12T14:00:00Z',
  lineas: [{ concepto: 'Puesta en marcha', mes: null, monto: 300, moneda: 'USDT' }],
  totalDetalle: 300, monedaDetalle: 'USDT', totales: [{ moneda: 'USDT', monto: 300 }], impuesto: null,
  correoEstado: 'enviado', correoA: [PERSONAS_EJEMPLO[agencia.ws].email], correoError: null, waEstado: 'en_app', waError: null, soloCorreo: false,
  devueltoAt: '2026-10-20T13:30:00Z', devueltoMonto: null, disputa: null, anuladoAt: null,
  pagos: [{ id: 80, medio: 'binance', referencia: '123456789012345678', fecha: '2026-10-12T14:00:00Z', monto: 300, moneda: 'USDT', montoUsd: 300, de: PERSONAS_EJEMPLO[agencia.ws].nombre, comprobante: true, anulado: false }],
  historial: [
    { at: '2026-10-12T15:00:00Z', que: 'Cargado a mano', quien: 'Super admin' },
    { at: '2026-10-20T13:30:00Z', que: 'Marcado devuelto por Super admin', quien: 'Super admin' },
  ],
}

export const RECIBOS_EJEMPLO: ReciboVenta[] = [reciboNorte, reciboBrujula]

const CLIENTES = new Map<string, ClienteVenta>([
  ...Object.values(NEGOCIOS).map((n): [string, ClienteVenta] => [`ws:${n.ws}`, { clave: `ws:${n.ws}`, nombre: n.nombre, ws: n.ws, leadId: LEAD[n.ws] ?? null, email: null }]),
  [LEAD_SIN_CUENTA.clave, { clave: LEAD_SIN_CUENTA.clave, nombre: LEAD_SIN_CUENTA.nombre, ws: null, leadId: LEAD_SIN_CUENTA.leadId, email: null }],
])
const NOMBRE_DE_WS = new Map<number, string>(Object.values(NEGOCIOS).map((n) => [n.ws, n.nombre]))

/** Orders: cada pago de ./negocios.ts con su recibo, y el recibo cargado a mano (el más nuevo primero). */
export const PEDIDOS_EJEMPLO: Pedido[] = pedidosDe({ entradas: ENTRADAS, recibos: RECIBOS_EJEMPLO, clientes: CLIENTES, nombreDeWs: NOMBRE_DE_WS })

export const CHECKOUTS_EJEMPLO: CheckoutVenta[] = checkoutsDe(COBROS_EJEMPLO)

export const DISPUTAS_EJEMPLO: DisputaVenta[] = disputasDe({ cobros: COBROS_EJEMPLO, recibos: RECIBOS_EJEMPLO, pedidos: PEDIDOS_EJEMPLO })

// ── Las suscripciones (Subscriptions) ──────────────────────────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0')
type MesDelPlan = { mes: string; precio: number; cortado?: boolean }
type MesDeHistoria = SuscripcionDeLead['suscripcion']['historia']['meses'][number]

/**
 * La historia mes a mes de un negocio (la forma de lib/suscripcion-meses.ts), con SUS pagos de ./negocios.ts: un mes con un pago
 * es «Pagado» (el de pesos, sin su valor en dólares, suma 0); sin pago, «Vencido» si ya venció y «Próximo» si no. El cambio sale
 * del precio contra el mes anterior.
 */
function historiaDe(n: NegocioEjemplo, dia: number, meses: readonly MesDelPlan[]): SuscripcionDeLead['suscripcion'] {
  const suyos = PAGOS_EJEMPLO.filter((p) => p.ws === n.ws && p.recurrente)
  const filas: MesDeHistoria[] = []
  let antes: number | null = null
  for (const m of meses) {
    const vence = `${m.mes}-${pad(dia)}`
    const pagos: PagoEjemplo[] = suyos.filter((p) => p.fecha.startsWith(m.mes))
    const pagado = pagos.reduce((s, p) => s + (p.usd ?? 0), 0)
    const estado: EstadoMesVenta = m.cortado ? 'cortado' : pagos.length ? 'pagado' : vence <= HOY_EJEMPLO ? 'vencido' : 'proximo'
    const cambio: CambioMesVenta | null = m.cortado ? 'se-corto' : antes == null ? 'empezo' : m.precio > antes ? 'subio' : m.precio < antes ? 'bajo' : null
    filas.push({
      mes: m.mes, vence, esperadoUsd: m.cortado ? null : m.precio, pagadoUsd: pagado, faltaUsd: estado === 'pagado' || m.cortado ? 0 : m.precio,
      estado, cambio, antesUsd: cambio === 'subio' || cambio === 'bajo' || cambio === 'se-corto' ? antes : null,
      pagos: pagos.map((p) => ({ id: Number(ID_EN_LO_COBRADO[p.id].slice(2)) })),
    })
    if (!m.cortado) antes = m.precio
  }
  const vencidos = filas.filter((f) => f.estado === 'vencido')
  const cortada = filas.find((f) => f.estado === 'cortado')
  const pendiente = filas.find((f) => f.estado !== 'pagado' && f.estado !== 'cortado') ?? null
  const proxima = filas.find((f) => f.estado !== 'cortado' && f.vence > HOY_EJEMPLO) ?? null
  return {
    estado: cortada ? 'cancelada' : 'activa',
    fuente: 'manual',
    mensualidadUsd: cortada ? null : meses[meses.length - 1].precio,
    mensualidadInferida: false,
    meses: null,
    finPlazo: null,
    proximaRenovacion: cortada ? null : proxima?.vence ?? null,
    renovacionFallida: null,
    proximoMes: cortada || !pendiente ? null : { mes: pendiente.mes, vence: pendiente.vence, faltaUsd: pendiente.faltaUsd, vencido: pendiente.vence <= HOY_EJEMPLO },
    historia: {
      meses: filas, diaDeCobro: dia, cortadaDesde: cortada?.mes ?? null, terminada: false,
      deudaUsd: vencidos.reduce((s, f) => s + (f.faltaUsd ?? 0), 0), mesesSinPagar: vencidos.length, mesesParciales: 0,
      totalPagadoUsd: filas.reduce((s, f) => s + f.pagadoUsd, 0),
    },
  }
}

const lead = (n: NegocioEjemplo, dia: number, meses: readonly MesDelPlan[]): SuscripcionDeLead => {
  const primero = PAGOS_EJEMPLO.find((p) => p.ws === n.ws)
  return {
    leadId: LEAD[n.ws], nombre: n.nombre, email: PERSONAS_EJEMPLO[n.ws].email, clienteWs: n.ws, estadoLead: 'ganado', fechaCierre: primero?.fecha ?? null,
    cobradoUsd: pagadoPor(`ws:${n.ws}`).total, suscripcion: historiaDe(n, dia, meses),
    conceptos: PAGOS_EJEMPLO.filter((p) => p.ws === n.ws).map((p) => p.concepto), cobroIds: [],
  }
}

const E = ESENCIAL.precioUsd
const P = PRO.precioUsd
/** Los meses de `desde` a `hasta` (YYYY-MM), con el precio de cada uno; `cortadoEn`, el mes en que se cortó. */
const plan = (desde: string, hasta: string, precio: (mes: string) => number, cortadoEn?: string): MesDelPlan[] => {
  const out: MesDelPlan[] = []
  const [y0, m0] = desde.split('-').map(Number)
  for (let i = 0; ; i++) {
    const d = new Date(Date.UTC(y0, m0 - 1 + i, 1))
    const mes = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`
    if (mes > hasta) break
    out.push({ mes, precio: precio(mes), cortado: mes === cortadoEn })
  }
  return out
}

/**
 * Las suscripciones a mano (una por negocio que paga por mes, con su historia), y la de la pasarela de Floristería Pétalo (su
 * link de «Vender un plan», el cobro 101). Estudio Norte pasó de Esencial a Pro en septiembre; Gimnasio Fuerza Sur se cortó en
 * octubre; Panadería La Espiga, Taller Mecánico Ruta 9 y Viajes Horizonte deben su último mes.
 */
const LEADS: SuscripcionDeLead[] = [
  lead(estudioNorte, 1, plan('2026-07', '2026-12', (m) => (m < '2026-09' ? E : P))),
  lead(panaderia, 2, plan('2026-06', '2026-12', () => E)),
  lead(clinica, 1, plan('2026-08', '2026-12', () => P)),
  lead(optica, 5, plan('2026-09', '2026-12', () => E)),
  lead(gimnasio, 28, plan('2026-09', '2026-10', () => E, '2026-10')),
  lead(taller, 15, plan('2026-09', '2026-11', () => E)),
  lead(viajes, 2, plan('2026-08', '2026-12', () => P)),
]

/**
 * Las filas de «Por cobrar» del Overview (./resumen.ts), con la forma de `vistaDeIngresos().porCobrar`: la columna «Próximo cobro»
 * de Subscriptions las muestra TAL CUAL (`conPorCobrar`), así su total es el de la tarjeta.
 */
export const POR_COBRAR_EJEMPLO = resumenEjemplo.porCobrar.ok
  ? resumenEjemplo.porCobrar.datos.filas.map((f) => ({ cliente: f.ws != null ? `ws:${f.ws}` : f.id.split(':').slice(0, 2).join(':'), fecha: f.fecha, usd: f.centavos / 100, atrasado: f.atrasado }))
  : []

export const SUSCRIPCIONES_EJEMPLO: SuscripcionVenta[] = conPorCobrar(
  suscripcionesDe({ leads: LEADS, cobros: COBROS_EJEMPLO, nombreDeWs: NOMBRE_DE_WS, hoy: HOY_EJEMPLO }),
  POR_COBRAR_EJEMPLO,
).suscripciones
