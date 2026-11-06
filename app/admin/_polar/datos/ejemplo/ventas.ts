// =============================================================================
// Admin › Sales — datos de EJEMPLO (ficticios) para capturar cada vista sin la base
// =============================================================================
// Nada de acá es de un cliente real (AGENTS.md): negocios, personas y montos inventados. Cada objeto se TIPA con el tipo de su
// vista (`const x: T`), así el próximo campo obligatorio rompe el tsc acá y no la captura. Lo usa tests/admin-polar-ventas.test.ts.
// El MISMO negocio con el MISMO número en todos los ejemplos de Admin: «Estudio Norte» es el ws 42 (la ficha, ejemplo/cliente.ts)
// y «Taller Sur» el 43; y un plan cuesta lo que dice PLANES_MAKO_DEFAULT (lib/planes-mako.ts): el Pro, US$ 97.

import type {
  CheckoutVenta, CobroVenta, DisputaVenta, Pedido, ReciboVenta, SuscripcionVenta,
} from '../ventas'

export const HOY_EJEMPLO = '2026-11-06'

const reciboNorte: ReciboVenta = {
  id: 7, numero: 12, estado: 'emitido', origen: 'pasarela', aNombre: 'Estudio Norte', destinoWs: 42, cobroId: 301,
  emitidoAt: '2026-11-05T15:20:00Z', fechaPago: '2026-11-05T15:19:00Z',
  lineas: [{ concepto: 'MaKo Pro (renovación)', mes: 'noviembre 2026', monto: 97, moneda: 'USD' }],
  totalDetalle: 97, monedaDetalle: 'USD', totales: [{ moneda: 'USD', monto: 97 }], impuesto: null,
  correoEstado: 'enviado', correoA: ['ana@ejemplo.com'], correoError: null, waEstado: 'enviado', waError: null, soloCorreo: false,
  devueltoAt: null, devueltoMonto: null, disputa: null, anuladoAt: null,
  pagos: [{ id: 70, medio: 'stripe', referencia: 'pi_ejemplo_123', fecha: '2026-11-05T15:19:00Z', monto: 97, moneda: 'USD', montoUsd: 97, de: null, comprobante: false, anulado: false }],
  historial: [{ at: '2026-11-05T15:20:00Z', que: 'Emitido por el pago pi_ejemplo_123' }],
}

const reciboAMano: ReciboVenta = {
  id: 8, numero: 13, estado: 'emitido', origen: 'manual', aNombre: 'Agencia Faro', destinoWs: 52, cobroId: null,
  emitidoAt: '2026-11-04T12:30:00Z', fechaPago: '2026-11-04T12:00:00Z',
  lineas: [{ concepto: 'Mensualidad de noviembre', mes: 'noviembre', monto: 200, moneda: 'USDT' }],
  totalDetalle: 200, monedaDetalle: 'USDT', totales: [{ moneda: 'USDT', monto: 200 }], impuesto: null,
  correoEstado: 'fallo', correoA: ['equipo@faro.example'], correoError: 'El correo rebotó', waEstado: 'en_app', waError: null, soloCorreo: false,
  devueltoAt: null, devueltoMonto: null, disputa: null, anuladoAt: null,
  pagos: [{ id: 80, medio: 'binance', referencia: '123456789012345678', fecha: '2026-11-04T12:00:00Z', monto: 200, moneda: 'USDT', montoUsd: 200, de: 'Luis Pérez', comprobante: true, anulado: false }],
  historial: [{ at: '2026-11-04T12:30:00Z', que: 'Cargado a mano', quien: 'Super admin' }],
}

export const PEDIDOS_EJEMPLO: Pedido[] = [
  {
    id: 'p-501', fecha: '2026-11-05', cliente: { clave: 'ws:42', nombre: 'Estudio Norte', ws: 42, leadId: 900, email: null },
    concepto: 'MaKo Pro (renovación)', medio: 'stripe', recurrente: true, usd: 97, estado: 'paid', recibo: reciboNorte, cobroId: 301, origen: 'crm',
  },
  {
    id: 'r-8', fecha: '2026-11-04', cliente: { clave: 'ws:52', nombre: 'Agencia Faro', ws: 52, leadId: null, email: null },
    concepto: 'Mensualidad de noviembre', medio: 'binance', recurrente: false, usd: 200, estado: 'paid', recibo: reciboAMano, cobroId: null, origen: 'recibo',
  },
  {
    id: 'p-488', fecha: '2026-10-21', cliente: { clave: 'ws:43', nombre: 'Taller Sur', ws: 43, leadId: 901, email: null },
    concepto: null, medio: 'transferencia', recurrente: true, usd: 146, estado: 'paid', recibo: null, cobroId: null, origen: 'crm',
  },
]

export const COBROS_EJEMPLO: CobroVenta[] = [
  {
    id: 301, nombre: 'Ana Gómez', email: 'ana@ejemplo.com', plan: 'MaKo Pro', concepto: 'MaKo Pro', monto: 97, moneda: 'USD', montoUsd: 97,
    tipo: 'suscripcion', modo: 'real', proveedor: 'stripe', estado: 'pagado', motivo: null, altaEstado: 'hecha', altaWs: 42, altaWsNombre: 'Estudio Norte',
    altaCapa: 'agencia', creadoPor: 'planes:pro', createdAt: '2026-10-05T10:00:00Z', pagadoAt: '2026-10-05T10:05:00Z', link: null, suscripcionViva: true,
  },
  {
    id: 302, nombre: 'Carlos Ruiz', email: 'carlos@ejemplo.com', plan: 'MaKo Esencial', concepto: 'MaKo Esencial', monto: 47, moneda: 'USD', montoUsd: 47,
    tipo: 'suscripcion', modo: 'real', proveedor: 'mercadopago', estado: 'pendiente', motivo: null, altaEstado: null, altaWs: null, altaWsNombre: null,
    altaCapa: 'completo', creadoPor: 'planes:esencial', createdAt: '2026-11-03T18:00:00Z', pagadoAt: null, link: '/pagar/ejemplo', suscripcionViva: false,
  },
]

export const SUSCRIPCIONES_EJEMPLO: SuscripcionVenta[] = [
  {
    id: 'l-900', fuente: 'manual', cliente: { clave: 'ws:42', nombre: 'Estudio Norte', ws: 42, leadId: 900, email: 'ana@ejemplo.com' },
    estado: 'active', empezo: '2026-08-05', renovacion: '2026-12-05', terminaEl: null, termino: null, producto: 'Mensualidad MaKo',
    mensualidadUsd: 426, mensualidadEstimada: false, diaDeCobro: 5, meses: null, deudaUsd: 0, mesesSinPagar: 0, mesesParciales: 0, pagadoUsd: 676,
    proximo: { mes: '2026-12', vence: '2026-12-05', faltaUsd: 426, vencido: false },
    historia: [
      { mes: '2026-08', vence: '2026-08-05', esperadoUsd: 146, pagadoUsd: 146, faltaUsd: 0, estado: 'pagado', cambio: 'empezo', antesUsd: null, pedidos: ['p-470'] },
      { mes: '2026-11', vence: '2026-11-05', esperadoUsd: 238, pagadoUsd: 238, faltaUsd: 0, estado: 'pagado', cambio: 'subio', antesUsd: 146, pedidos: ['p-500', 'p-501'] },
      { mes: '2026-12', vence: '2026-12-05', esperadoUsd: 426, pagadoUsd: 0, faltaUsd: 426, estado: 'proximo', cambio: 'subio', antesUsd: 238, pedidos: [] },
    ],
    renovacionFallida: null, cobroParaCortar: null,
  },
  {
    id: 'c-301', fuente: 'pasarela', cliente: { clave: 'ws:42', nombre: 'Estudio Norte', ws: 42, leadId: null, email: 'ana@ejemplo.com' },
    estado: 'active', empezo: '2026-10-05', renovacion: null, terminaEl: null, termino: null, producto: 'MaKo Pro',
    mensualidadUsd: 97, mensualidadEstimada: false, diaDeCobro: null, meses: null, deudaUsd: 0, mesesSinPagar: 0, mesesParciales: 0, pagadoUsd: 97,
    proximo: null, historia: [], renovacionFallida: null, cobroParaCortar: 301,
  },
]

export const CHECKOUTS_EJEMPLO: CheckoutVenta[] = [
  { id: 302, estado: 'open', createdAt: '2026-11-03T18:00:00Z', nombre: 'Carlos Ruiz', email: 'carlos@ejemplo.com', producto: 'MaKo Esencial', monto: 47, moneda: 'USD', montoUsd: 47, tipo: 'suscripcion', modo: 'real', proveedor: 'mercadopago', motivo: null, link: '/pagar/ejemplo' },
  { id: 299, estado: 'failed', createdAt: '2026-11-01T09:00:00Z', nombre: 'Marta Díaz', email: 'marta@ejemplo.com', producto: 'MaKo Pro', monto: 97, moneda: 'USD', montoUsd: 97, tipo: 'unico', modo: 'real', proveedor: 'stripe', motivo: 'La tarjeta no tenía fondos.', link: '/pagar/ejemplo-2' },
]

export const DISPUTAS_EJEMPLO: DisputaVenta[] = [
  { id: 'c-290', pedido: 'c-290', cliente: 'Estudio Oeste', estado: 'abierta', razon: 'dice que no reconoce la compra', texto: 'El cliente disputó este cargo con su banco (dice que no reconoce la compra): Stripe abrió una disputa.', usd: 97, proveedor: 'stripe' },
]
