// =============================================================================
// Admin › Sales — lo que lee el server para Orders, Subscriptions, Checkouts y Disputes (6/11/2026)
// =============================================================================
// Las lecturas son las de siempre (no hay una máquina aparte): lo cobrado (`vistaDeIngresos`, lib/admin-ingresos.ts), el libro de
// recibos (`recibosAction`) y los cobros de la plataforma (`cobrosDeMakoAction`, app/admin/cobros/), y las suscripciones mes a mes
// (`suscripcionesDeLaPlataforma`, la misma cuenta que la ficha). Las cuentas, puras, en ./ventas.ts.
//
// ⚠️ CRUZA NEGOCIOS: sólo el super admin. Cada page.tsx llama a `exigirSuperAdmin()` ANTES de esto, y las acciones vuelven a
//    preguntar `getSesionAdmin()` (lo fija tests/admin-polar-ventas.test.ts).
// ⚠️ Una lectura que falla no tumba la página: lo que no se pudo leer viaja en `avisos` y la pantalla lo dice.

import 'server-only'
import { cache } from 'react'
import { suscripcionesDeLaPlataforma, vistaDeIngresos } from '@/lib/admin-ingresos'
import { listarWorkspaces, wsSuperAdmin } from '@/lib/workspace'
import { zonaDelNegocio } from '@/lib/timezone'
import { hoyEnTz } from '@/lib/date-utils'
import type { ReciboListado } from '@/lib/recibos'
import type { EstadoRecibo } from '@/lib/recibos-reglas'
import { cobrosDeMakoAction, type CobroMako } from '@/app/admin/cobros/actions'
import { recibosAction } from '@/app/admin/cobros/recibos-actions'
import {
  checkoutsDe, disputasDe, pedidosDe, suscripcionesDe,
  type CheckoutVenta, type ClienteVenta, type CobroVenta, type DisputaVenta, type Pedido, type ReciboVenta, type SuscripcionDeLead, type SuscripcionVenta,
} from './ventas'
import { esDeVenderUnPlan } from './checkout-link'

const mensaje = (e: unknown) => (e instanceof Error ? e.message : String(e))

// Una lectura por pedido (`cache` de React): en la ficha de un negocio, Orders y Subscriptions leen los mismos cobros, y Disputes
// lee lo de Orders. Las dos acciones vuelven a preguntar `getSesionAdmin()` adentro.
const leerCobros = cache(() => cobrosDeMakoAction())
const leerRecibos = cache(() => recibosAction())

/** Un recibo del libro, sin lo que no hace falta en el navegador (ni las rutas de los archivos). */
export function reciboDeListado(r: ReciboListado): ReciboVenta {
  return {
    id: r.id, numero: r.numero, estado: r.estado as EstadoRecibo, origen: r.origen, aNombre: r.a_nombre, destinoWs: r.destino_ws, cobroId: r.cobro_id,
    emitidoAt: r.emitido_at, fechaPago: r.fecha_pago, lineas: r.lineas.map((l) => ({ concepto: l.concepto, mes: l.mes ?? null, monto: l.monto, moneda: l.moneda })),
    totalDetalle: r.total_detalle, monedaDetalle: r.moneda_detalle, totales: r.totales_recibido, impuesto: r.impuesto,
    correoEstado: r.correo_estado, correoA: r.correo_a ?? [], correoError: r.correo_error, waEstado: r.wa_estado, waError: r.wa_error, soloCorreo: r.solo_correo,
    devueltoAt: r.devuelto_at, devueltoMonto: r.devuelto_monto, disputa: r.disputa_texto, anuladoAt: r.anulado_at,
    pagos: r.pagos.map((p) => ({
      id: p.id, medio: p.medio, referencia: p.referencia, fecha: p.fecha, monto: p.monto, moneda: p.moneda, montoUsd: p.monto_usd, de: p.de,
      comprobante: !!p.comprobante_path, anulado: p.anulado,
    })),
    historial: r.historial,
  }
}

export function cobroDeMako(c: CobroMako): CobroVenta {
  return {
    id: c.id, nombre: c.nombre, email: c.email, plan: c.plan, concepto: c.concepto, monto: c.monto, moneda: c.moneda, montoUsd: c.monto_usd,
    tipo: c.tipo, modo: c.modo, proveedor: c.proveedor, estado: c.estado, motivo: c.motivo, altaEstado: c.alta_estado, altaWs: c.alta_ws,
    altaWsNombre: c.alta_ws_nombre, altaCapa: c.alta_capa, creadoPor: c.creado_por, createdAt: c.created_at, pagadoAt: c.pagado_at,
    link: c.link, suscripcionViva: c.suscripcionViva,
  }
}

/** El libro de recibos: listo, sin la migración, o no se pudo leer. */
export type EstadoLibro = { estado: 'listo' } | { estado: 'falta-migracion' } | { estado: 'error'; error: string }

export type DatosCargarPago = {
  cuentas: Array<{ id: number; nombre: string }>
  planes: Array<{ nombre: string; precioUsd: number }>
}

async function hoyDeLaPlataforma(plataforma: number): Promise<string> {
  const tz = await zonaDelNegocio(plataforma).catch(() => 'UTC')
  return hoyEnTz(tz)
}

// ── Orders ───────────────────────────────────────────────────────────────────────────────────────────────────────────

export type VistaOrders = {
  hoy: string
  pedidos: Pedido[]
  avisos: string[]
  libro: EstadoLibro
  /** Lo que pide «Cargar pago» (las cuentas y los planes), o null si el libro no está. */
  cargarPago: DatosCargarPago | null
  /** Las cobros de la plataforma (para el detalle: devolver, atar a su cuenta). */
  cobros: CobroVenta[]
  plataforma: number | null
}

export async function vistaOrders(): Promise<VistaOrders> {
  const avisos: string[] = []
  const [plataforma, vista, recibos, cobros] = await Promise.all([
    wsSuperAdmin().catch(() => null),
    vistaDeIngresos().catch((e) => { avisos.push(`lo cobrado: ${mensaje(e)}`); return null }),
    leerRecibos().catch((e) => ({ ok: false as const, error: mensaje(e) })),
    leerCobros().catch((e) => ({ ok: false as const, error: mensaje(e) })),
  ])
  if (vista) avisos.push(...vista.avisos.map((a) => `lo cobrado: ${a}`))
  const libro: EstadoLibro = !recibos.ok ? { estado: 'error', error: recibos.error } : recibos.faltaLaMigracion ? { estado: 'falta-migracion' } : { estado: 'listo' }
  if (!recibos.ok) avisos.push(`los recibos: ${recibos.error}`)
  else if (recibos.alTope) avisos.push('los recibos: se ven los 200 más nuevos')
  if (!cobros.ok) avisos.push(`los cobros de la pasarela: ${cobros.error}`)
  const lista = recibos.ok ? recibos.recibos.map(reciboDeListado) : []
  const clientes = new Map<string, ClienteVenta>((vista?.clientes ?? []).map((c) => [c.clave, { clave: c.clave, nombre: c.nombre, ws: c.ws, leadId: c.leadId, email: null }]))
  const nombreDeWs = new Map<number, string>((recibos.ok ? recibos.cuentas : []).map((c) => [c.id, c.nombre]))
  return {
    hoy: vista?.hoy ?? (plataforma != null ? await hoyDeLaPlataforma(plataforma) : hoyEnTz('UTC')),
    pedidos: pedidosDe({ entradas: vista?.entradas ?? [], recibos: lista, clientes, nombreDeWs }),
    avisos,
    libro,
    cargarPago: recibos.ok && !recibos.faltaLaMigracion ? { cuentas: recibos.cuentas, planes: recibos.planes } : null,
    cobros: cobros.ok ? cobros.cobros.map(cobroDeMako) : [],
    plataforma,
  }
}

// ── Subscriptions ────────────────────────────────────────────────────────────────────────────────────────────────────

export type VistaSuscripciones = { hoy: string; suscripciones: SuscripcionVenta[]; avisos: string[]; plataforma: number | null }

export async function vistaSuscripciones(): Promise<VistaSuscripciones> {
  const avisos: string[] = []
  const plataforma = await wsSuperAdmin().catch((e) => { avisos.push(`la plataforma: ${mensaje(e)}`); return null })
  if (plataforma == null) return { hoy: hoyEnTz('UTC'), suscripciones: [], avisos, plataforma }
  const hoy = await hoyDeLaPlataforma(plataforma)
  const [subs, cobros, wss] = await Promise.all([
    suscripcionesDeLaPlataforma(plataforma, hoy),
    leerCobros().catch((e) => ({ ok: false as const, error: mensaje(e) })),
    listarWorkspaces().catch((e) => { avisos.push(`los nombres de los negocios: ${mensaje(e)}`); return [] }),
  ])
  avisos.push(...subs.avisos)
  if (!cobros.ok) avisos.push(`los cobros de la pasarela: ${cobros.error}`)
  const leads: SuscripcionDeLead[] = subs.lista.map((s) => ({
    leadId: s.leadId, nombre: s.nombre, email: s.email, clienteWs: s.clienteWs, estadoLead: s.estadoLead, fechaCierre: s.fechaCierre,
    cobradoUsd: s.cobrado.cobradoUsd,
    suscripcion: {
      estado: s.cobrado.suscripcion.estado, fuente: s.cobrado.suscripcion.fuente, mensualidadUsd: s.cobrado.suscripcion.mensualidadUsd,
      mensualidadInferida: s.cobrado.suscripcion.mensualidadInferida, meses: s.cobrado.suscripcion.meses, finPlazo: s.cobrado.suscripcion.finPlazo,
      proximaRenovacion: s.cobrado.suscripcion.proximaRenovacion, renovacionFallida: s.cobrado.suscripcion.renovacionFallida,
      proximoMes: s.cobrado.suscripcion.proximoMes,
      historia: {
        meses: s.cobrado.suscripcion.historia.meses.map((m) => ({
          mes: m.mes, vence: m.vence, esperadoUsd: m.esperadoUsd, pagadoUsd: m.pagadoUsd, faltaUsd: m.faltaUsd, estado: m.estado, cambio: m.cambio,
          antesUsd: m.antesUsd, pagos: m.pagos.map((p) => ({ id: p.id })),
        })),
        diaDeCobro: s.cobrado.suscripcion.historia.diaDeCobro, cortadaDesde: s.cobrado.suscripcion.historia.cortadaDesde,
        terminada: s.cobrado.suscripcion.historia.terminada, deudaUsd: s.cobrado.suscripcion.historia.deudaUsd,
        mesesSinPagar: s.cobrado.suscripcion.historia.mesesSinPagar, mesesParciales: s.cobrado.suscripcion.historia.mesesParciales,
        totalPagadoUsd: s.cobrado.suscripcion.historia.totalPagadoUsd,
      },
    },
    conceptos: s.pagos.filter((p) => p.pagado && p.concepto).sort((a, b) => String(a.fecha_pago ?? '').localeCompare(String(b.fecha_pago ?? ''))).map((p) => String(p.concepto)),
    cobroIds: s.cobroIds,
  }))
  return {
    hoy,
    suscripciones: suscripcionesDe({ leads, cobros: cobros.ok ? cobros.cobros.map(cobroDeMako) : [], nombreDeWs: new Map(wss.map((w) => [w.id, w.nombre])), hoy }),
    avisos,
    plataforma,
  }
}

// ── Checkouts ────────────────────────────────────────────────────────────────────────────────────────────────────────

export type VistaCheckouts = {
  checkouts: CheckoutVenta[]
  avisos: string[]
  truncado: boolean
  /** Los ids de los links de «Vender un plan»: no son checkouts, viven en Products › Checkout Links (./checkout-link.ts). */
  linksDeVenta: number[]
}

export async function vistaCheckouts(): Promise<VistaCheckouts> {
  const cobros = await leerCobros().catch((e) => ({ ok: false as const, error: mensaje(e) }))
  if (!cobros.ok) return { checkouts: [], avisos: [`los cobros de la pasarela: ${cobros.error}`], truncado: false, linksDeVenta: [] }
  const filas = cobros.cobros.map(cobroDeMako)
  return {
    checkouts: checkoutsDe(filas),
    avisos: cobros.truncado ? ['los cobros: se ven los 200 más nuevos'] : [],
    truncado: cobros.truncado,
    linksDeVenta: filas.filter((c) => esDeVenderUnPlan({ alta_capa: c.altaCapa, creado_por: c.creadoPor })).map((c) => c.id),
  }
}

// ── Disputes ─────────────────────────────────────────────────────────────────────────────────────────────────────────

export type VistaDisputas = { disputas: DisputaVenta[]; avisos: string[] }

export async function vistaDisputas(): Promise<VistaDisputas> {
  const o = await vistaOrders()
  const recibos = o.pedidos.flatMap((p) => (p.recibo ? [p.recibo] : []))
  return { disputas: disputasDe({ cobros: o.cobros, recibos, pedidos: o.pedidos }), avisos: o.avisos }
}
