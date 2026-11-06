// =============================================================================
// Datos de EJEMPLO de Admin › Products (Catalogue y Checkout Links), Finance › Income y Settings, para capturas y pruebas
// de las vistas de app/admin/(polar)/products, …/finance y …/settings.
// =============================================================================
// FICTICIOS: ninguna persona, negocio ni monto es de un cliente real. Se arman con las mismas funciones puras que usa el
// server (app/admin/_polar/datos/productos.ts y finanzas.ts), así lo que se ve es lo que la página dibujaría con esos datos.
// Los planes salen de los de fábrica (lib/planes-mako.ts), con un precio en pesos inventado para el de Mercado Pago. Los cobros y
// los pedidos son los de Sales (./ventas.ts, sobre los negocios y los pagos de ./negocios.ts): el link de «Vender un plan» con que
// entró Floristería Pétalo es el MISMO cobro que su pago en Orders, y el libro de Income son los pedidos de Orders.

import { PLANES_MAKO_DEFAULT } from '@/lib/planes-mako'
import { linksDeVenta, productoDePlan, type CobroDeVenta, type DatosCheckoutLinks, type ProductoMako } from '../productos'
import { movimientosDe, type DatosIngresos } from '../finanzas'
import type { DatosGeneral, DatosNotificaciones, DatosPagos, Emisor } from '../ajustes'
import { COBROS_EJEMPLO as COBROS_DE_SALES, HOY_EJEMPLO, PEDIDOS_EJEMPLO } from './ventas'

/** Los planes de fábrica, con Esencial y Pro a precio en pesos argentinos (inventado). */
export const PRODUCTOS_EJEMPLO: ProductoMako[] = PLANES_MAKO_DEFAULT.map((p) =>
  productoDePlan({ ...p, preciosLocales: p.id === 'esencial' ? { ARS: 56000 } : p.id === 'pro' ? { ARS: 115000 } : {} }),
)

/**
 * Los cobros de la plataforma como los lee Products (`listarCobros`, con `creado_por` y la URL armada): los MISMOS de Sales. Son
 * links de «Vender un plan» los tres que armó una persona (101, 102 y 103); el de /planes (104) y los de una ficha no.
 */
export const COBROS_EJEMPLO: CobroDeVenta[] = COBROS_DE_SALES.map((c) => ({
  id: c.id, nombre: c.nombre, email: c.email, alta_capa: c.altaCapa, monto: c.monto, moneda: c.moneda, monto_usd: c.montoUsd, tipo: c.tipo,
  proveedor: c.proveedor === 'mercadopago' ? 'mercadopago' : 'stripe', estado: c.estado, created_at: c.createdAt, pagado_at: c.pagadoAt,
  creado_por: c.creadoPor, alta_ws: c.altaWs, alta_estado: c.altaEstado,
  url: c.link ? `https://hola-mako.com${c.link}` : null, alta_ws_nombre: c.altaWsNombre,
}))

export const CHECKOUT_LINKS_EJEMPLO: DatosCheckoutLinks = {
  productos: PRODUCTOS_EJEMPLO,
  links: linksDeVenta(COBROS_EJEMPLO, PRODUCTOS_EJEMPLO),
  pasarelas: ['stripe', 'mercadopago'],
  monedaMp: 'ARS',
  truncado: false,
  avisos: [],
}

/** Finance › Income: el libro de los pedidos de Orders (lo que entró, y lo que salió: la devolución de Agencia Brújula). */
export const INGRESOS_EJEMPLO: DatosIngresos = { ok: true, filas: movimientosDe(PEDIDOS_EJEMPLO), hoy: HOY_EJEMPLO, avisos: [] }

const EMISOR_EJEMPLO: Emisor = {
  nombre: 'MaKo · hola-mako.com',
  documento: 'CUIT 30-00000000-0',
  direccion: 'Calle Falsa 123, Ciudad de Ejemplo',
  correo: 'recibos@ejemplo.com',
  asunto: null,
  intro: null,
}

export const GENERAL_EJEMPLO: DatosGeneral = { ok: true, emisor: EMISOR_EJEMPLO }

export const PAGOS_EJEMPLO: DatosPagos = {
  locales: {
    moneda: 'ARS',
    planes: PRODUCTOS_EJEMPLO.map((p) => ({ id: p.id, nombre: p.nombre, precioUsd: p.precioUsd, local: p.preciosLocales.ARS ?? null, activo: p.activo })),
  },
  errorLocales: null,
  precioAgencia: { usd: 47, mp: { moneda: 'ARS', monto: 56000 } },
  errorAgencia: null,
  conMercadoPago: true,
}

export const NOTIFICACIONES_EJEMPLO: DatosNotificaciones = { ok: true, emisor: EMISOR_EJEMPLO, waSolo: true }
