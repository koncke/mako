// =============================================================================
// Datos de EJEMPLO de Admin › Products (Catalogue y Checkout Links), Finance › Income y Settings, para capturas y pruebas
// de las vistas de app/admin/(polar)/products, …/finance y …/settings.
// =============================================================================
// FICTICIOS: ninguna persona, negocio ni monto es de un cliente real. Se arman con las mismas funciones puras que usa el
// server (app/admin/_polar/datos/productos.ts y finanzas.ts), así lo que se ve es lo que la página dibujaría con esos datos.
// Los planes salen de los de fábrica (lib/planes-mako.ts), con un precio en pesos inventado para el de Mercado Pago.

import { PLANES_MAKO_DEFAULT } from '@/lib/planes-mako'
import type { Entrada } from '@/lib/admin-ingresos-reglas'
import { linksDeVenta, productoDePlan, type CobroDeVenta, type DatosCheckoutLinks, type ProductoMako } from '../productos'
import { filasDeIngresos, type DatosIngresos } from '../finanzas'
import type { DatosGeneral, DatosNotificaciones, DatosPagos, Emisor } from '../ajustes'

/** Los planes de fábrica, con Esencial y Pro a precio en pesos argentinos (inventado). */
export const PRODUCTOS_EJEMPLO: ProductoMako[] = PLANES_MAKO_DEFAULT.map((p) =>
  productoDePlan({ ...p, preciosLocales: p.id === 'esencial' ? { ARS: 56000 } : p.id === 'pro' ? { ARS: 115000 } : {} }),
)

const cobro = (c: Partial<CobroDeVenta> & Pick<CobroDeVenta, 'id' | 'nombre' | 'email'>): CobroDeVenta => ({
  alta_capa: 'completo',
  monto: 47,
  moneda: 'USD',
  monto_usd: 47,
  tipo: 'suscripcion',
  proveedor: 'stripe',
  estado: 'pendiente',
  created_at: '2026-11-04T15:20:00Z',
  pagado_at: null,
  creado_por: 'Super admin',
  alta_ws: null,
  alta_estado: null,
  url: null,
  alta_ws_nombre: null,
  ...c,
})

/** Cobros de la plataforma: tres de «Vender un plan» y uno del checkout público de /planes (que NO es un link). */
export const COBROS_EJEMPLO: CobroDeVenta[] = [
  cobro({ id: 101, nombre: 'Ana Gómez', email: 'ana@ejemplo.com', url: 'https://hola-mako.com/pagar/tok-ejemplo-1' }),
  cobro({
    id: 102, nombre: 'Estudio Norte', email: 'hola@estudionorte.example', alta_capa: 'agencia', monto: 97, monto_usd: 97, estado: 'pagado',
    pagado_at: '2026-11-02T13:05:00Z', created_at: '2026-11-01T10:00:00Z', alta_ws: 9001, alta_estado: 'hecha', alta_ws_nombre: 'Estudio Norte',
  }),
  cobro({
    id: 103, nombre: 'Luis Prado', email: 'luis@ejemplo.com', proveedor: 'mercadopago', moneda: 'ARS', monto: 56000, monto_usd: null,
    estado: 'fallido', url: 'https://hola-mako.com/pagar/tok-ejemplo-3',
  }),
  cobro({ id: 104, nombre: 'Marta Ruiz', email: 'marta@ejemplo.com', creado_por: 'planes:esencial', estado: 'pagado', pagado_at: '2026-10-30T09:00:00Z' }),
]

export const CHECKOUT_LINKS_EJEMPLO: DatosCheckoutLinks = {
  productos: PRODUCTOS_EJEMPLO,
  links: linksDeVenta(COBROS_EJEMPLO, PRODUCTOS_EJEMPLO),
  pasarelas: ['stripe', 'mercadopago'],
  monedaMp: 'ARS',
  truncado: false,
  avisos: [],
}

/** Lo que entró, del más viejo al más nuevo (la forma de `entradasDe`). */
export const ENTRADAS_EJEMPLO: Entrada[] = [
  { fecha: '2026-09-02', usd: 47, medio: 'stripe', recurrente: true, nombre: 'Ana Gómez' },
  { fecha: '2026-10-02', usd: 47, medio: 'stripe', recurrente: true, nombre: 'Ana Gómez' },
  { fecha: '2026-10-15', usd: 300, medio: 'transferencia', recurrente: false, nombre: 'Estudio Norte' },
  { fecha: '2026-10-21', usd: null, medio: 'binance', recurrente: false, nombre: 'Luis Prado' },
  { fecha: '2026-11-02', usd: 97, medio: 'mercadopago', recurrente: true, nombre: 'Estudio Norte' },
]

export const INGRESOS_EJEMPLO: DatosIngresos = { ok: true, filas: filasDeIngresos(ENTRADAS_EJEMPLO), hoy: '2026-11-06', avisos: [] }

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
