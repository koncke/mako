// =============================================================================
// Admin › Sales (Orders, Subscriptions, Checkouts, Disputes): las funciones puras que arman sus props
// (app/admin/_polar/datos/ventas.ts), y que cada página pase por la puerta del super admin antes de leer.
// =============================================================================
// Correr: node --import tsx --test tests/admin-polar-ventas.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (6/11/2026), con el arnés que restaura de memoria. Base: 11 pass / 0 fail. Cada rotura, sola:
//   · `pedidosDe` sin atar el recibo por el cobro (`reciboDeCobro.get`; desde el 6/11, `recibosDeCobro`) → 8/3 (1, 3, 7)
//   · `estadoDePedido` deja un recibo devuelto como «paid»                                      → 9/2 (1, 3)
//   · `totalesDePedidos` suma lo devuelto                                                        → 10/1 (3)
//   · `rangoDe('lastMonth')` toma el mes de hoy                                                  → 9/2 (2, 5)
//   · `suscripcionesDe` lista al prospecto (sin el filtro de ganado o con pagos)                → 10/1 (4)
//   · `suscripcionesDe` repite el cobro de la pasarela de un lead que ya está                   → 10/1 (4)
//   · `checkoutsDe` deja pasar un cobro pagado (Polar: «succeeded»)                              → 10/1 (6)
//   · `estadoDeDisputa` lee mal «descontó la plata» (lo da abierta)                             → 10/1 (7)
//   · checkouts/page.tsx lee (`vistaCheckouts`) antes de `exigirSuperAdmin()`                    → 10/1 (9)
//   · una vista ('use client') importa un VALOR de ventas-server                                 → 10/1 (10)
//   · un cambio sin efecto (renombrar la variable local `usados` de `pedidosDe`)                 → 11/0 (sigue verde)
// El 12 (el aviso de Cargar pago cuando lo recibido no es lo del recibo), sumado el 6/11/2026. Base: 12/0. Cada rotura, sola, 11/1
// (y renombrar la variable local `dif` de `avisoDeDiferencia` sigue en 12/0):
//   · `avisoDeDiferencia` compara contra el primer pago y no contra la suma de los de la misma moneda
//   · `avisoDeDiferencia` avisa con monedas distintas (calcula sin `diferencia`, que nunca pone una tasa)
//   · el aviso dice «De más» cuando falta plata (el signo dado vuelta)
//   · el modal no lo dibuja (`aviso &&` sacado de CargarPagoModal.tsx)

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  checkoutsDe, disputasDe, estadoDeDisputa, filtrarCheckouts, filtrarPedidos, filtrarSuscripciones, ordenar, paginar, pedidoCargarPago,
  pedidosDe, problemaCargarPago, rangoDe, razonDeDisputa, suscripcionesDe, totalesDePedidos, formCargarPagoInicial, COMPARADORES_PEDIDO, avisoDeDiferencia,
  conElPrecioDelPlan, devolucionDelPedido, diaDelRecibo, hechoDeLaUrl, motivoDePedido, pagosSinReciboDe, primeroLasAtrasadas, suscripcionDelPedido,
  textoDeSinSumar,
  type CobroVenta, type EntradaVenta, type ReciboVenta, type SuscripcionDeLead, type SuscripcionVenta,
} from '../app/admin/_polar/datos/ventas'
import {
  AVISO_SIN_CRM, claveDelCobro, conceptoDelPagoDeRecibo, leadDeLaCuenta, metodoDelMedio, planParaElCrm, problemaDeLosElegidos, type CobroDelRecibo,
} from '../lib/recibos-reglas'
import { eventosDePedidos } from '../app/admin/_polar/datos/eventos'
import { mensualidadDelNegocio } from '../app/admin/_polar/datos/cliente'
import { OrderDetails } from '../app/admin/_polar/web/Orders/OrderDetails'
import { DataTable } from '../app/admin/_polar/orbit'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { COBROS_EJEMPLO, CHECKOUTS_EJEMPLO, DISPUTAS_EJEMPLO, PEDIDOS_EJEMPLO, SUSCRIPCIONES_EJEMPLO } from '../app/admin/_polar/datos/ejemplo/ventas'
import { textoContracargo } from '../lib/cobros-reglas'
import { formatoMonto } from '../lib/pasarela-moneda'

const RAIZ = fileURLToPath(new URL('..', import.meta.url))
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n')
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')

const recibo = (over: Partial<ReciboVenta>): ReciboVenta => ({
  id: 1, numero: 1, estado: 'emitido', origen: 'pasarela', aNombre: 'Estudio Norte', destinoWs: 41, cobroId: null, emitidoAt: '2026-11-05T15:00:00Z',
  fechaPago: '2026-11-05T15:00:00Z', lineas: [{ concepto: 'MaKo Pro', mes: null, monto: 297, moneda: 'USD' }], totalDetalle: 297, monedaDetalle: 'USD',
  totales: [{ moneda: 'USD', monto: 297 }], impuesto: null, correoEstado: 'enviado', correoA: [], correoError: null, waEstado: 'no_va', waError: null,
  soloCorreo: true, devueltoAt: null, devueltoMonto: null, disputa: null, anuladoAt: null,
  pagos: [{ id: 1, medio: 'stripe', referencia: 'pi_1', fecha: '2026-11-05T15:00:00Z', monto: 297, moneda: 'USD', montoUsd: 297, de: null, comprobante: false, anulado: false }],
  historial: [], ...over,
})

const cobro = (over: Partial<CobroVenta>): CobroVenta => ({
  id: 1, nombre: 'Ana Gómez', email: 'ana@ejemplo.com', plan: 'MaKo Pro', concepto: 'MaKo Pro', monto: 297, moneda: 'USD', montoUsd: 297, tipo: 'unico',
  modo: 'real', proveedor: 'stripe', estado: 'pagado', motivo: null, altaEstado: null, altaWs: null, altaWsNombre: null, altaCapa: null, creadoPor: null,
  createdAt: '2026-11-01T10:00:00Z',
  pagadoAt: '2026-11-01T10:05:00Z', link: null, suscripcionViva: false, ...over,
})

const clientes = new Map([
  ['ws:41', { clave: 'ws:41', nombre: 'Estudio Norte', ws: 41, leadId: 900 }],
  ['lead:901', { clave: 'lead:901', nombre: 'Taller Sur', ws: null, leadId: 901 }],
])
const nombreDeWs = new Map([[41, 'Estudio Norte'], [52, 'Agencia Faro']])

test('1 · un pedido es cada pago que entró con su recibo (por el cobro), y el recibo suelto es su propio pedido', () => {
  const entradas: EntradaVenta[] = [
    { id: 'p:501', fecha: '2026-11-05', usd: 297, medio: 'stripe', recurrente: true, nombre: 'Estudio Norte', cliente: 'ws:41', concepto: 'MaKo Pro', cobroId: 301 },
    { id: 'p:488', fecha: '2026-10-21', usd: 146, medio: 'transferencia', recurrente: true, nombre: 'Taller Sur', cliente: 'lead:901', concepto: null, cobroId: null },
  ]
  // El cobro 310 se devolvió: ya no está en lo cobrado (pasa a `reembolsado` y su pago a `pagado: false`), así que su pedido sale
  // de `cobros`, no de las entradas (punto 3 de la revisión del 6/11/2026: el test tenía la entrada, que el flujo real no produce).
  const cobros = [cobro({ id: 310, estado: 'reembolsado', proveedor: 'mercadopago', proveedorPagoId: '9310', montoUsd: 97, plan: 'Lugar', altaWs: 52, altaWsNombre: 'Agencia Faro', pagadoAt: '2026-10-30T15:00:00Z' })]
  const recibos = [
    recibo({ id: 7, cobroId: 301 }),
    recibo({ id: 8, cobroId: 310, estado: 'devuelto', devueltoAt: '2026-11-02T00:00:00Z', pagos: [{ id: 3, medio: 'mercadopago', referencia: '9310', fecha: '2026-10-30T15:00:00Z', monto: 97, moneda: 'USD', montoUsd: 97, de: null, comprobante: false, anulado: false }] }),
    recibo({ id: 9, cobroId: null, origen: 'manual', destinoWs: 52, aNombre: 'Agencia Faro SRL', fechaPago: '2026-11-04T12:00:00Z', pagos: [{ id: 2, medio: 'binance', referencia: '1', fecha: '2026-11-04T12:00:00Z', monto: 200, moneda: 'USDT', montoUsd: 200, de: null, comprobante: true, anulado: false }] }),
  ]
  const pedidos = pedidosDe({ entradas, recibos, clientes, nombreDeWs, cobros })
  assert.deepEqual(pedidos.map((p) => p.id), ['p-501', 'r-9', 'c-310', 'p-488'], 'el más nuevo primero; el recibo suelto es r-<id>')
  assert.equal(pedidos.find((p) => p.id === 'c-310')?.recibo?.id, 8, 'el cobro devuelto lleva su recibo (no sale como r-8)')
  assert.equal(pedidos[0].recibo?.id, 7, 'el pago de la pasarela lleva SU recibo')
  assert.equal(pedidos.find((p) => p.id === 'c-310')?.estado, 'refunded', 'el estado sale del recibo')
  assert.equal(pedidos.find((p) => p.id === 'p-488')?.recibo, null, 'un pago del CRM sin recibo')
  assert.equal(pedidos.find((p) => p.id === 'p-488')?.estado, 'paid')
  const suelto = pedidos.find((p) => p.id === 'r-9')
  assert.equal(suelto?.cliente?.nombre, 'Agencia Faro', 'el nombre de la cuenta, no el del recibo')
  assert.equal(suelto?.usd, 200)
  assert.equal(suelto?.origen, 'recibo')
  assert.equal(pedidos.filter((p) => p.recibo?.id === 7).length, 1, 'un recibo atado no sale dos veces')
})

test('2 · los intervalos de Polar en días del negocio', () => {
  assert.deepEqual(rangoDe('today', '2026-11-06'), { desde: '2026-11-06', hasta: '2026-11-06' })
  assert.deepEqual(rangoDe('thisMonth', '2026-11-06'), { desde: '2026-11-01', hasta: '2026-11-30' })
  assert.deepEqual(rangoDe('lastMonth', '2026-11-06'), { desde: '2026-10-01', hasta: '2026-10-31' })
  assert.deepEqual(rangoDe('lastMonth', '2026-01-15'), { desde: '2025-12-01', hasta: '2025-12-31' }, 'cruza el año')
  assert.deepEqual(rangoDe('last3Months', '2026-11-06'), { desde: '2026-08-06', hasta: '2026-11-06' })
  assert.deepEqual(rangoDe('thisWeek', '2026-11-06'), { desde: '2026-11-01', hasta: '2026-11-07' }, 'la semana arranca el domingo')
  assert.equal(rangoDe('allTime', '2026-11-06'), null)
  const filtrados = filtrarPedidos(PEDIDOS_EJEMPLO, { estado: null, intervalo: 'lastMonth' }, '2026-11-06')
  assert.deepEqual(filtrados.map((p) => p.id), ['p-488'])
})

test('3 · las cajas de Orders: lo devuelto y lo anulado no suman; lo que no tiene dólares se cuenta aparte', () => {
  const base = PEDIDOS_EJEMPLO[0]
  const t = totalesDePedidos([
    { ...base, id: 'p-1', usd: 100, estado: 'paid' },
    { ...base, id: 'p-2', usd: 50, estado: 'partially_refunded' },
    { ...base, id: 'p-3', usd: 999, estado: 'refunded' },
    { ...base, id: 'p-4', usd: 999, estado: 'void' },
    { ...base, id: 'p-5', usd: null, estado: 'paid' },
  ])
  assert.equal(t.orders, 5)
  assert.equal(t.revenue, 15000, 'en centavos, como Polar')
  assert.equal(t.averageOrderValue, 7500)
  assert.equal(t.sinDolares, 1)
  // Un recibo devuelto deja el pedido devuelto (y fuera de lo que entró).
  // (Con la entrada ausente, que es lo que produce el flujo real: el cobro devuelto llega por `cobros`, punto 3.)
  const p = pedidosDe({ entradas: [], recibos: [recibo({ cobroId: 1, estado: 'devuelto' })], clientes, nombreDeWs, cobros: [cobro({ id: 1, estado: 'reembolsado', proveedorPagoId: 'pi_1', montoUsd: 97 })] })
  assert.deepEqual(p.map((x) => [x.id, x.estado, x.recibo?.id]), [['c-1', 'refunded', 1]])
  assert.equal(totalesDePedidos(p).revenue, 0)
})

test('4 · las suscripciones: los clientes (ganados o que pagaron), sin repetir la de la pasarela de un lead', () => {
  const sus = (over: Partial<SuscripcionDeLead['suscripcion']> = {}): SuscripcionDeLead['suscripcion'] => ({
    estado: 'activa', fuente: 'manual', mensualidadUsd: 426, mensualidadInferida: false, meses: null, finPlazo: null, proximaRenovacion: '2026-12-05',
    renovacionFallida: null, proximoMes: { mes: '2026-12', vence: '2026-12-05', faltaUsd: 426, vencido: false },
    historia: { meses: [{ mes: '2026-11', vence: '2026-11-05', esperadoUsd: 238, pagadoUsd: 238, faltaUsd: 0, estado: 'pagado', cambio: 'subio', antesUsd: 146, pagos: [{ id: 500 }, { id: 501 }] }], diaDeCobro: 5, cortadaDesde: null, terminada: false, deudaUsd: 0, mesesSinPagar: 0, mesesParciales: 0, totalPagadoUsd: 676 },
    ...over,
  })
  const lead = (over: Partial<SuscripcionDeLead>): SuscripcionDeLead => ({
    leadId: 900, nombre: 'Estudio Norte', email: null, clienteWs: 41, estadoLead: 'ganado', fechaCierre: '2026-08-05', cobradoUsd: 676, suscripcion: sus(),
    conceptos: ['Mensualidad'], cobroIds: [], ...over,
  })
  const lista = suscripcionesDe({
    leads: [
      lead({}),
      lead({ leadId: 902, nombre: 'Prospecto', clienteWs: null, estadoLead: 'abierto', cobradoUsd: 0 }),
      lead({ leadId: 903, nombre: 'Taller Sur', clienteWs: null, estadoLead: 'perdido', cobradoUsd: 146, suscripcion: sus({ estado: 'cancelada', historia: { ...sus().historia, cortadaDesde: '2026-10' } }) }),
      lead({ leadId: 904, nombre: 'Agencia Faro', clienteWs: 52, suscripcion: sus({ historia: { ...sus().historia, mesesSinPagar: 2, deudaUsd: 476 } }) }),
      lead({ leadId: 905, nombre: 'Estudio Este', clienteWs: null, suscripcion: sus({ fuente: 'pasarela' }), cobroIds: [301] }),
    ],
    cobros: [cobro({ id: 301, tipo: 'suscripcion', suscripcionViva: true }), cobro({ id: 302, tipo: 'suscripcion', suscripcionViva: true, altaWs: 60, altaWsNombre: 'Estudio Sol' }), cobro({ id: 303, tipo: 'suscripcion', estado: 'pendiente' })],
    nombreDeWs,
    hoy: '2026-11-06',
  })
  assert.deepEqual(lista.map((s) => s.id), ['l-900', 'l-903', 'l-904', 'l-905', 'c-302'], 'sin el prospecto, sin el cobro 301 (es del lead 905) ni el pendiente')
  const norte = lista[0]
  assert.equal(norte.estado, 'active')
  assert.equal(norte.renovacion, '2026-12-05')
  assert.deepEqual(norte.historia[0].pedidos, ['p-500', 'p-501'], 'cada mes con los pedidos de sus pagos')
  assert.equal(lista.find((s) => s.id === 'l-903')?.estado, 'canceled')
  assert.equal(lista.find((s) => s.id === 'l-903')?.termino, '2026-10')
  assert.equal(lista.find((s) => s.id === 'l-903')?.renovacion, null, 'cortada: sin próxima')
  assert.equal(lista.find((s) => s.id === 'l-904')?.estado, 'past_due', 'a mano con meses vencidos sin pagar: atrasada')
  assert.equal(lista.find((s) => s.id === 'l-905')?.cobroParaCortar, 301, 'la de la pasarela se corta con su cobro')
  assert.equal(lista.find((s) => s.id === 'c-302')?.renovacion, null, 'la pasarela no le dice a MaKo cuándo cobra: no se inventa')
  assert.equal(lista.find((s) => s.id === 'c-302')?.cliente.nombre, 'Estudio Sol')
})

test('5 · el filtro de Subscriptions arranca en Activa, y por la fecha en que empezó', () => {
  assert.deepEqual(filtrarSuscripciones(SUSCRIPCIONES_EJEMPLO, { estado: 'active', intervalo: 'allTime' }, '2026-11-06').length, 2)
  assert.deepEqual(filtrarSuscripciones(SUSCRIPCIONES_EJEMPLO, { estado: 'any', intervalo: 'lastMonth' }, '2026-11-06').map((s) => s.id), ['c-301'])
  assert.deepEqual(filtrarSuscripciones(SUSCRIPCIONES_EJEMPLO, { estado: 'canceled', intervalo: 'allTime' }, '2026-11-06'), [])
})

test('6 · Checkouts: sólo lo que NO se pagó; el filtro por email', () => {
  const lista = checkoutsDe([
    cobro({ id: 1, estado: 'pagado' }), cobro({ id: 2, estado: 'pendiente', createdAt: '2026-11-03T00:00:00Z' }), cobro({ id: 3, estado: 'fallido', email: 'marta@ejemplo.com', createdAt: '2026-11-02T00:00:00Z' }),
    cobro({ id: 4, estado: 'anulado', createdAt: '2026-11-01T00:00:00Z' }), cobro({ id: 5, estado: 'reembolsado' }),
  ])
  assert.deepEqual(lista.map((c) => [c.id, c.estado]), [[2, 'open'], [3, 'failed'], [4, 'expired']])
  assert.deepEqual(filtrarCheckouts(lista, { estado: null, consulta: 'MARTA' }).map((c) => c.id), [3])
  assert.deepEqual(filtrarCheckouts(CHECKOUTS_EJEMPLO, { estado: 'open', consulta: '' }).map((c) => c.id), [302])
})

test('7 · Disputes: los contracargos que escribió lib/cobros-reglas.ts, leídos de su texto', () => {
  const abierto = textoContracargo({ pasarela: 'stripe', fase: 'abierto', razon: 'fraudulent' })
  const salio = textoContracargo({ pasarela: 'stripe', fase: 'plata_salio', razon: 'duplicate' })
  const volvio = textoContracargo({ pasarela: 'mercadopago', fase: 'plata_volvio' })
  assert.equal(estadoDeDisputa(abierto), 'abierta')
  assert.equal(estadoDeDisputa(salio), 'plata_afuera')
  assert.equal(estadoDeDisputa(volvio), 'plata_volvio')
  assert.equal(estadoDeDisputa(textoContracargo({ pasarela: 'stripe', fase: 'cerrado', estado: 'won' })), 'ganada')
  assert.equal(estadoDeDisputa(textoContracargo({ pasarela: 'stripe', fase: 'cerrado', estado: 'lost' })), 'perdida')
  assert.equal(estadoDeDisputa(textoContracargo({ pasarela: 'mercadopago', fase: 'mp', estado: 'in_process' })), 'en_revision')
  assert.equal(razonDeDisputa(abierto), 'dice que no reconoce la compra')
  const pedidos = pedidosDe({ entradas: [{ id: 'c:40', fecha: '2026-11-01', usd: 97, medio: 'stripe', recurrente: false, nombre: 'X', cobroId: 40 }], recibos: [recibo({ id: 4, cobroId: 40, disputa: abierto })], clientes, nombreDeWs })
  const disputas = disputasDe({ cobros: [cobro({ id: 40, motivo: abierto }), cobro({ id: 41, motivo: 'La tarjeta no tenía fondos.' })], recibos: pedidos.flatMap((p) => (p.recibo ? [p.recibo] : [])), pedidos })
  assert.deepEqual(disputas.map((d) => [d.id, d.pedido, d.estado]), [['c-40', 'c-40', 'abierta']], 'el cobro y su recibo son UNA disputa; un rechazo no es un contracargo')
  assert.equal(DISPUTAS_EJEMPLO[0].estado, estadoDeDisputa(DISPUTAS_EJEMPLO[0].texto))
})

test('8 · Cargar pago: lo que falta se dice antes, y el pedido va con su formulario', () => {
  const f = formCargarPagoInicial('2026-11-06')
  assert.equal(problemaCargarPago(f, false), 'Elige la cuenta.')
  const lleno = { ...f, cuenta: '41', aNombre: 'Estudio Norte', lineas: [{ concepto: 'Mensualidad', mes: '', monto: '200' }], pagos: [{ ...f.pagos[0], referencia: '123', monto: '200' }] }
  assert.match(String(problemaCargarPago(lleno, false)), /Order ID/, 'Binance: los 18 dígitos')
  const binance = { ...lleno, pagos: [{ ...lleno.pagos[0], referencia: '123456789012345678' }] }
  assert.equal(problemaCargarPago(binance, false), null)
  assert.equal(problemaCargarPago(binance, true), 'Espera a que termine de subir el comprobante.')
  const pedido = pedidoCargarPago(binance, 'form-1', true)
  assert.equal(pedido.destinoWs, 41)
  assert.deepEqual(pedido.lineas, [{ concepto: 'Mensualidad', mes: null, monto: 200, moneda: 'USD' }])
  assert.equal(pedido.pagos[0].fecha, '2026-11-06T12:00')
  // El orden y la página, en memoria.
  const ord = ordenar(PEDIDOS_EJEMPLO, { id: 'net_amount', desc: true }, COMPARADORES_PEDIDO)
  assert.deepEqual(ord.map((p) => p.id), ['p-501', 'r-8', 'p-488'])
  assert.deepEqual(paginar(ord, 5, 2), { filas: [ord[2]], total: 3, paginas: 2, pagina: 1 }, 'una página de más cae en la última')
  assert.ok(COBROS_EJEMPLO.length > 0)
})

// ── Las puertas ──────────────────────────────────────────────────────────────────────────────────────────────────────

const SALES = 'app/admin/(polar)/sales'
function archivos(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(join(RAIZ, dir))) {
    const p = `${dir}/${n}`
    if (statSync(join(RAIZ, p)).isDirectory()) archivos(p, out)
    else if (/\.tsx?$/.test(n)) out.push(p)
  }
  return out
}

test('9 · cada página de Sales pregunta por el super admin ANTES de leer, y es dinámica', () => {
  const paginas = archivos(SALES).filter((f) => f.endsWith('/page.tsx'))
  assert.ok(paginas.length >= 7, `las siete páginas (${paginas.length})`)
  for (const f of paginas) {
    const src = sinComentarios(leer(f))
    const puerta = src.indexOf('await exigirSuperAdmin()')
    assert.ok(puerta > 0, `${f}: llama a exigirSuperAdmin()`)
    const lectura = src.search(/await vista\w*\(/)
    assert.ok(lectura > puerta, `${f}: la puerta va ANTES de leer`)
    assert.match(src, /export const dynamic = 'force-dynamic'/, `${f}: dinámica`)
  }
})

test('10 · ninguna vista del navegador importa un VALOR de un módulo del server (sólo `import type`)', () => {
  const vistas = [
    ...archivos(SALES).filter((f) => !f.endsWith('/page.tsx')),
    ...['Orders', 'Subscriptions', 'Checkouts', 'Disputes'].flatMap((d) => archivos(`app/admin/_polar/web/${d}`)),
  ]
  assert.ok(vistas.length > 20)
  for (const f of vistas) {
    const src = sinComentarios(leer(f))
    for (const m of src.matchAll(/^import\s+(type\s+)?[^;]*?from\s+'([^']+)'/gm)) {
      const esTipo = !!m[1]
      const modulo = m[2]
      if (/ventas-server|lib\/admin-ingresos'|lib\/recibos'|lib\/cobros'|\/guarda'/.test(modulo)) assert.ok(esTipo, `${f}: importa un valor de ${modulo}`)
    }
    if (/^'use client'/.test(leer(f))) assert.doesNotMatch(src, /^import 'server-only'/m, `${f}: un componente del navegador no es server-only`)
  }
})

test('11 · ningún dato de un cliente real en los ejemplos, y el gráfico de ingresos no vive en Sales', () => {
  const ejemplo = leer('app/admin/_polar/datos/ejemplo/ventas.ts')
  for (const real of ['Mauricio', 'Leila', 'Florencia', 'Leandro', 'Código Inmobiliario', 'Brigitte']) assert.doesNotMatch(ejemplo, new RegExp(real), `sin «${real}»`)
  for (const f of archivos(SALES)) assert.doesNotMatch(sinComentarios(leer(f)), /(?<!Mini)MetricChartBox\b|GenericChart|metricasDeIngresos/, `${f}: el gráfico de ingresos es de Overview y Analytics`)
})

test('12 · Cargar pago avisa si lo recibido no es lo del recibo, como la pantalla de antes (sólo en la misma moneda)', () => {
  const f = { ...formCargarPagoInicial('2026-11-06'), moneda: 'USDT' }
  const con = (lineas: string[], pagos: Array<[string, string]>) => ({
    ...f,
    lineas: lineas.map((monto) => ({ concepto: 'Mensualidad', mes: '', monto })),
    pagos: pagos.map(([monto, moneda]) => ({ ...f.pagos[0], monto, moneda })),
  })
  const fin = '. No queda como saldo: anótalo en la nota.'
  assert.equal(avisoDeDiferencia(con(['144'], [['146', 'USDT']])), `De más: ${formatoMonto(2, 'USDT')}${fin}`)
  assert.equal(avisoDeDiferencia(con(['144'], [['140', 'USDT']])), `De menos: ${formatoMonto(4, 'USDT')}${fin}`)
  assert.equal(avisoDeDiferencia(con(['100', '44'], [['100', 'USDT'], ['46', 'USDT']])), `De más: ${formatoMonto(2, 'USDT')}${fin}`, 'suma los renglones y los pagos de la misma moneda')
  assert.equal(avisoDeDiferencia(con(['143,5'], [['146', 'USDT']])), `De más: ${formatoMonto(2.5, 'USDT')}${fin}`, 'la coma decimal')
  assert.equal(avisoDeDiferencia(con(['144'], [['144', 'USDT']])), null, 'si coincide, nada')
  assert.equal(avisoDeDiferencia(con(['144'], [['146', 'USD']])), null, 'en otra moneda no se compara (nunca se pone una tasa)')
  assert.equal(avisoDeDiferencia(con(['144'], [['100', 'USDT'], ['46', 'USD']])), null, 'con dos monedas, no se compara')
  assert.equal(avisoDeDiferencia(con([''], [['146', 'USDT']])), null, 'sin detalle no hay contra qué comparar')
  assert.equal(avisoDeDiferencia(con(['144'], [['', 'USDT']])), null, 'sin nada recibido todavía, no se compara')
  const modal = sinComentarios(leer('app/admin/_polar/web/Orders/CargarPagoModal.tsx'))
  assert.match(modal, /const aviso = avisoDeDiferencia\(f\)/, 'el modal no calcula el aviso')
  assert.match(modal, /\{aviso && <Alert variant="warning" title="Diferencia" description=\{aviso\} \/>\}/, 'el modal no dibuja el aviso')
})

// =============================================================================
// 13-21 · La revisión del Cerebro del 6/11/2026 (docs/admin/revision-cerebro-6-11.md): la plata de Sales
// =============================================================================
// 13 (punto 1): «Devolver el pago» sólo en el pago que devuelve la pasarela (el PRIMERO del cobro), con el monto del pedido; una
//    renovación del mismo cobro no lleva el botón y dice dónde se devuelve. Un cobro y dos pagos.
// 14 (punto 2): cada pago lleva SU recibo (por `medio + referencia`), y uno viejo sin su id sólo se ata por el cobro si ese cobro
//    tiene un recibo. Tres pagos y tres recibos: tres pedidos y 891.
// 15 (punto 3): un cobro devuelto es `c-<id>` (con su recibo, «Pago único» y no «Cargado a mano»), aunque no esté en lo cobrado; y
//    el resultado viaja en la URL.
// 16 (punto 4): un recibo de «Cargar pago» se ata a su pago del CRM por `recibo_pagos.pago_id`; el que no quedó atado no suma (en
//    Orders ni en Events) y se dice debajo de las cajas; el formulario ofrece primero los pagos del CRM sin recibo; y lo que decide
//    qué registrar en el CRM (lib/recibos-reglas.ts) junta dos órdenes del mismo mes en UN pago.
// 17 (punto 6): el día de un recibo es el de su zona.
// 18 (puntos 8 y 10): «Activa» incluye a las atrasadas, primero; una suscripción con deuda es «Atrasada»; y la caja de la ficha
//    lee la mensualidad.
// 19 (punto 17): «Usar el precio de un plan» deja el recibo en dólares.
// 20 (punto 19): el enlace «Suscripción» de un pedido sale de la suscripción que lo tiene, o no hay enlace.
// 21 (puntos 24, 26 y 42): una disputa sin pedido no se puede abrir; el libro de Finance › Income abre cada pedido; y el aviso
//    viejo de Orders (`web/Orders/Aviso.tsx`) ya no existe.
// Probado rompiéndolo el 6/11/2026 (base, con 13-21 puestos: 21/0; el arnés restaura de memoria). Cada rotura, sola:
//   · `devolucionDelPedido` ofrece «Devolver el pago» en cualquier pago del cobro (sin comparar los ids)      → 20/1 (13)
//   · `devolucionDelPedido` con el monto del cobro y no el del pedido                                         → 20/1 (13)
//   · `pedidosDe` ata por el cobro aunque el pago tenga su id (la regla de antes)                             → 20/1 (14)
//   · `pedidosDe` ata por el cobro un pago viejo aunque el cobro tenga varios recibos                         → 20/1 (14)
//   · `pedidosDe` sin los cobros devueltos (`cobros`)                                                          → 18/3 (1, 3, 15)
//   · `motivoDePedido` dice «Cargado a mano» por no tener un pago (`origen === 'recibo'`)                      → 19/2 (15, 16)
//   · `pedidosDe` sin `recibo_pagos.pago_id`                                                                   → 20/1 (16)
//   · `totalesDePedidos` suma el recibo a mano sin atar                                                       → 20/1 (16)
//   · `eventosDePedidos` sin saltear lo que no suma                                                           → 20/1 (16)
//   · `planParaElCrm` registra sólo el último cobro (no junta los del mes en una mensualidad)                 → 20/1 (16)
//   · `problemaDeLosElegidos` deja pasar el mismo pago del CRM para dos cobros                                → 20/1 (16)
//   · `diaDelRecibo` con el día en UTC                                                                         → 20/1 (17)
//   · `filtrarSuscripciones` compara exacto en «Activa» (las atrasadas afuera)                                 → 20/1 (18)
//   · `suscripcionesDe` sin la deuda en «Atrasada» (sólo meses sin pagar)                                      → 20/1 (18)
//   · `conElPrecioDelPlan` sin `moneda: 'USD'`                                                                  → 20/1 (19)
//   · `suscripcionDelPedido` toma la primera de a mano y no la que lista el pedido                            → 20/1 (20)
//   · DataTable sin `isRowClickable` (toda fila con la mano)                                                   → 20/1 (21)
//   · un cambio sin efecto (renombrar la variable local `vistos` de `pedidosDe`)                               → 21/0

const pagoDeRecibo = (over: Partial<ReciboVenta['pagos'][number]>): ReciboVenta['pagos'][number] =>
  ({ id: 1, medio: 'stripe', referencia: 'pi_1', fecha: '2026-11-05T15:00:00Z', monto: 297, moneda: 'USD', montoUsd: 297, de: null, comprobante: false, anulado: false, ...over })

test('13 · Devolver el pago: sólo en el primer pago del cobro y por el monto del pedido; una renovación dice dónde se devuelve', () => {
  // Un cobro de suscripción con dos pagos: septiembre (el primero, el que devuelve la pasarela) y noviembre (una renovación).
  const elCobro = cobro({ id: 301, tipo: 'suscripcion', estado: 'pagado', proveedorPagoId: 'pi_sep', montoUsd: 297 })
  const pedidos = pedidosDe({
    entradas: [
      { id: 'p:601', fecha: '2026-09-05', usd: 146, medio: 'stripe', recurrente: true, nombre: 'Estudio Norte', cliente: 'ws:41', cobroId: 301, proveedor: 'stripe', proveedorPagoId: 'pi_sep' },
      { id: 'p:602', fecha: '2026-11-05', usd: 297, medio: 'stripe', recurrente: true, nombre: 'Estudio Norte', cliente: 'ws:41', cobroId: 301, proveedor: 'stripe', proveedorPagoId: 'pi_nov' },
    ],
    recibos: [], clientes, nombreDeWs, cobros: [elCobro],
  })
  const sep = pedidos.find((p) => p.id === 'p-601')!
  const nov = pedidos.find((p) => p.id === 'p-602')!
  assert.deepEqual(devolucionDelPedido(sep, elCobro), { tipo: 'pasarela', usd: 146 }, 'el primero: el botón, con el monto del pedido (146), no el del cobro (297)')
  assert.deepEqual(devolucionDelPedido(nov, elCobro), {
    tipo: 'en-la-pasarela', texto: 'Una renovación se devuelve desde el panel de la pasarela; MaKo la registra sola con el aviso.',
  }, 'noviembre no ofrece devolver septiembre')
  assert.equal(devolucionDelPedido({ ...sep, proveedorPagoId: null }, elCobro)?.tipo, 'en-la-pasarela', 'sin el id del pago no se sabe cuál es: sin botón')
  assert.equal(devolucionDelPedido(sep, { ...elCobro, estado: 'reembolsado' })?.tipo, 'en-la-pasarela', 'con el cobro ya devuelto, la renovación tampoco')
  assert.equal(devolucionDelPedido({ ...sep, estado: 'refunded' }, elCobro), null, 'lo devuelto no se vuelve a devolver')
  assert.equal(devolucionDelPedido(sep, { ...elCobro, modo: 'prueba' }), null, 'un cobro de prueba no se devuelve desde acá')
  // Un recibo de «Cargar pago», sin cobro: «Marcar devuelto».
  assert.deepEqual(devolucionDelPedido({ estado: 'paid', proveedorPagoId: null, usd: 200, recibo: { origen: 'manual', estado: 'emitido' } }, null), { tipo: 'a-mano' })
})

test('14 · tres pagos de un cobro y sus tres recibos: cada pedido con el suyo, y Orders suma 891 (no 1.485)', () => {
  const entradas: EntradaVenta[] = ['a', 'b', 'c'].map((k, i) => (
    { id: `p:${701 + i}`, fecha: `2026-${String(9 + i).padStart(2, '0')}-05`, usd: 297, medio: 'stripe', recurrente: true, nombre: 'Estudio Norte', cliente: 'ws:41', cobroId: 301, proveedor: 'stripe', proveedorPagoId: `pi_${k}` }
  ))
  const recibos = ['a', 'b', 'c'].map((k, i) => recibo({ id: 11 + i, numero: 11 + i, cobroId: 301, pagos: [pagoDeRecibo({ id: 20 + i, referencia: `pi_${k}` })] }))
  const pedidos = pedidosDe({ entradas, recibos, clientes, nombreDeWs })
  assert.deepEqual(pedidos.map((p) => [p.id, p.recibo?.id]), [['p-703', 13], ['p-702', 12], ['p-701', 11]], 'cada mes con SU recibo, y ningún r-')
  assert.equal(totalesDePedidos(pedidos).revenue, 89100, 'US$ 891 en centavos')
  // Si se devuelve el último mes, sólo ése figura devuelto.
  const conDevuelto = pedidosDe({ entradas, recibos: recibos.map((r) => (r.id === 13 ? { ...r, estado: 'devuelto' as const } : r)), clientes, nombreDeWs })
  assert.deepEqual(conDevuelto.map((p) => [p.id, p.estado]), [['p-703', 'refunded'], ['p-702', 'paid'], ['p-701', 'paid']])
  assert.equal(totalesDePedidos(conDevuelto).revenue, 59400)
  // Un pago viejo sin su id: por el cobro sólo si el cobro tiene UN recibo.
  const viejo: EntradaVenta = { id: 'p:690', fecha: '2026-08-05', usd: 297, medio: 'stripe', recurrente: true, nombre: 'Estudio Norte', cliente: 'ws:41', cobroId: 330 }
  const unoSolo = pedidosDe({ entradas: [viejo], recibos: [recibo({ id: 30, cobroId: 330, pagos: [pagoDeRecibo({ referencia: 'pi_viejo' })] })], clientes, nombreDeWs })
  assert.deepEqual(unoSolo.map((p) => [p.id, p.recibo?.id]), [['p-690', 30]], 'con un recibo en su cobro, ése')
  const dos = pedidosDe({
    entradas: [viejo],
    recibos: [recibo({ id: 31, cobroId: 330, pagos: [pagoDeRecibo({ referencia: 'pi_x' })] }), recibo({ id: 32, cobroId: 330, pagos: [pagoDeRecibo({ referencia: 'pi_y' })] })],
    clientes, nombreDeWs,
  })
  assert.equal(dos.find((p) => p.id === 'p-690')?.recibo, null, 'con dos recibos en su cobro, ninguno: cada uno es de otro mes')
})

test('15 · un cobro devuelto es c-<id>: con su recibo, «Pago único» (no «Cargado a mano»), y su día en la zona', () => {
  const devuelto = cobro({ id: 320, estado: 'reembolsado', proveedor: 'stripe', proveedorPagoId: 'pi_320', montoUsd: 97, altaWs: 41, altaWsNombre: 'Estudio Norte', pagadoAt: '2026-11-01T01:00:00Z' })
  const conRecibo = pedidosDe({ entradas: [], recibos: [recibo({ id: 40, cobroId: 320, estado: 'devuelto', pagos: [pagoDeRecibo({ referencia: 'pi_320', montoUsd: 97 })] })], clientes, nombreDeWs, cobros: [devuelto] })
  assert.deepEqual(conRecibo.map((p) => [p.id, p.estado, p.recibo?.id, p.origen]), [['c-320', 'refunded', 40, 'pasarela']], 'el pedido sigue, con su recibo y no como r-')
  assert.equal(motivoDePedido(conRecibo[0]), 'Pago único', 'salió por la pasarela: no se cargó a mano')
  assert.equal(totalesDePedidos(conRecibo).revenue, 0, 'devuelto: no suma')
  const sinRecibo = pedidosDe({ entradas: [], recibos: [], clientes, nombreDeWs, cobros: [devuelto], zona: 'America/Argentina/Buenos_Aires' })
  assert.deepEqual(sinRecibo.map((p) => [p.id, p.fecha, p.usd, p.cliente?.nombre]), [['c-320', '2026-10-31', 97, 'Estudio Norte']], 'sin recibo también queda, con el día de Argentina')
  // Si el cobro todavía está en lo cobrado (la entrada c:), no sale dos veces.
  const conEntrada = pedidosDe({ entradas: [{ id: 'c:320', fecha: '2026-11-01', usd: 97, medio: 'stripe', recurrente: false, nombre: 'Estudio Norte', cobroId: 320 }], recibos: [], clientes, nombreDeWs, cobros: [devuelto] })
  assert.deepEqual(conEntrada.map((p) => p.id), ['c-320'])
  // Un recibo de «Cargar pago» sí es «Cargado a mano», aunque ya esté atado a su pago del CRM (`origen: 'crm'`).
  assert.equal(motivoDePedido({ recurrente: true, recibo: { origen: 'manual' } }), 'Cargado a mano')
  // El resultado de la devolución viaja en la URL (`?hecho=`): texto plano, recortado.
  assert.equal(hechoDeLaUrl('  Reembolso   hecho:  US$ 97. '), 'Reembolso hecho: US$ 97.')
  assert.equal(hechoDeLaUrl(['a']), null)
  assert.equal(hechoDeLaUrl(''), null)
  assert.equal(hechoDeLaUrl('x'.repeat(400))?.length, 300)
})

test('16 · Cargar pago: el recibo atado a su pago del CRM suma una vez; el que no se ató no suma (y se dice); dos órdenes del mes son UN pago', () => {
  const aMano = (id: number, pagoId: number | null, montoUsd: number) => recibo({
    id, numero: id, origen: 'manual', destinoWs: 41, cobroId: null, fechaPago: '2026-11-05T15:00:00Z',
    pagos: [pagoDeRecibo({ id: 50 + id, medio: 'binance', referencia: `12345678901234567${id % 10}`, monto: montoUsd, moneda: 'USDT', montoUsd, pagoId })],
  })
  const entradas: EntradaVenta[] = [
    { id: 'p:801', fecha: '2026-11-05', usd: 238, medio: 'binance', recurrente: true, nombre: 'Estudio Norte', cliente: 'ws:41', cobroId: null },
    { id: 'p:802', fecha: '2026-11-03', usd: 146, medio: 'transferencia', recurrente: true, nombre: 'Estudio Norte', cliente: 'ws:41', cobroId: null },
  ]
  const recibos = [aMano(1, 801, 238), aMano(2, null, 200)]
  const pedidos = pedidosDe({ entradas, recibos, clientes, nombreDeWs })
  assert.deepEqual(pedidos.map((p) => [p.id, p.recibo?.id ?? null, p.suma ?? true]), [['r-2', 2, false], ['p-801', 1, true], ['p-802', null, true]], 'el atado va con su pago; el suelto no suma')
  assert.equal(motivoDePedido(pedidos.find((p) => p.id === 'p-801')!), 'Cargado a mano')
  const t = totalesDePedidos(pedidos)
  assert.equal(t.revenue, 38400, 'suma 238 + 146, una vez cada uno: el recibo suelto no')
  assert.deepEqual(t.aManoSinSumar, { recibos: 1, usd: 200 })
  assert.equal(textoDeSinSumar(t.aManoSinSumar), '1 recibo cargado a mano no suma en Ingresos: US$ 200')
  assert.equal(textoDeSinSumar({ recibos: 2, usd: 300.5 }), '2 recibos cargados a mano no suman en Ingresos: US$ 300,50')
  assert.equal(textoDeSinSumar({ recibos: 0, usd: 0 }), null)
  assert.deepEqual(eventosDePedidos(pedidos).filter((e) => e.label === 'Pago recibido').map((e) => e.id), ['pago:p-801', 'pago:p-802'], 'Events tampoco cuenta el suelto')
  // El formulario ofrece primero los pagos del CRM de la cuenta que no tienen recibo.
  assert.deepEqual(pagosSinReciboDe(pedidos).map((p) => [p.pagoId, p.ws, p.usd]), [[802, 41, 146]])

  // Lo que se registra en el CRM: dos órdenes de noviembre (94 + 144) son UNA mensualidad de 238 con la fecha de la última.
  const cobros: CobroDelRecibo[] = [
    { id: 1, medio: 'binance', referencia: '123456789012345678', fecha: '2026-11-04T12:00:00Z', monto_usd: 94, anulado: false, pago_id: null },
    { id: 2, medio: 'binance', referencia: '123456789012345679', fecha: '2026-11-05T12:00:00Z', monto_usd: 144, anulado: false, pago_id: null },
    { id: 3, medio: 'binance', referencia: '123456789012345670', fecha: '2026-11-05T12:00:00Z', monto_usd: 10, anulado: true, pago_id: null },
    { id: 4, medio: 'binance', referencia: '123456789012345671', fecha: '2026-11-05T12:00:00Z', monto_usd: 10, anulado: false, pago_id: 77 },
  ]
  assert.deepEqual(planParaElCrm(cobros, new Map()), { atar: [], registrar: { ids: [1, 2], usd: 238, fecha: '2026-11-05T12:00:00Z' } }, 'un pago de 238; el anulado y el ya atado, nada')
  const atar = new Map([[claveDelCobro('binance', '1234-5678-9012-3456-78'), 802]])
  assert.deepEqual(planParaElCrm(cobros, atar), { atar: [{ id: 1, pagoId: 802 }], registrar: { ids: [2], usd: 144, fecha: '2026-11-05T12:00:00Z' } }, 'el que se eligió, a su pago; el resto, a uno nuevo')
  assert.equal(planParaElCrm([{ ...cobros[0], monto_usd: null }], new Map()).registrar?.usd, null, 'sin dólares no se registra (nunca una tasa)')
  assert.deepEqual(planParaElCrm([cobros[3]], new Map()), { atar: [], registrar: null }, 'un reintento: lo atado no se registra dos veces')
  // El mismo pago del CRM elegido para dos cobros se frena antes de emitir (un recibo emitido gasta su número).
  assert.equal(problemaDeLosElegidos([802, 802]), 'Elegiste el mismo pago del CRM para dos cobros.')
  assert.equal(problemaDeLosElegidos([0]), 'Ese pago del CRM no existe.')
  assert.equal(problemaDeLosElegidos([801, 802]), null)
  // La ficha de la cuenta: la única, o la única ganada.
  assert.deepEqual(leadDeLaCuenta([{ id: 9, estado_lead: 'abierto', venta_tipo: 'suscripcion' }]), { ok: true, id: 9, suscripcion: true })
  assert.deepEqual(leadDeLaCuenta([{ id: 9, estado_lead: 'perdido', venta_tipo: null }, { id: 10, estado_lead: 'ganado', venta_tipo: 'unico' }]), { ok: true, id: 10, suscripcion: false })
  assert.deepEqual(leadDeLaCuenta([{ id: 9, estado_lead: 'ganado', venta_tipo: null }, { id: 10, estado_lead: 'ganado', venta_tipo: null }]), { ok: false, motivo: 'varias' })
  assert.deepEqual(leadDeLaCuenta([]), { ok: false, motivo: 'sin-ficha' })
  assert.match(AVISO_SIN_CRM['sin-ficha'], /no suma en Ingresos/)
  // El pago del CRM lleva el número del recibo (un reintento lo encuentra) y su método.
  assert.equal(conceptoDelPagoDeRecibo(3, [{ concepto: 'Mensualidad' }, { concepto: ' ' }]), 'Recibo N.º 0003: Mensualidad')
  assert.deepEqual(['binance', 'stripe', 'transferencia', 'efectivo', 'otro'].map(metodoDelMedio), ['cripto', 'tarjeta', 'transferencia', 'efectivo', 'otro'])
})

test('17 · el día de un recibo es el de su zona: el 31/10 a las 22:00 de Argentina es octubre', () => {
  assert.equal(diaDelRecibo('2026-11-01T01:00:00Z', 'America/Argentina/Buenos_Aires'), '2026-10-31')
  const pedidos = pedidosDe({ entradas: [], recibos: [recibo({ id: 60, origen: 'pasarela', fechaPago: '2026-11-01T01:00:00Z', diaPago: diaDelRecibo('2026-11-01T01:00:00Z', 'America/Argentina/Buenos_Aires') })], clientes, nombreDeWs })
  assert.equal(pedidos[0].fecha, '2026-10-31', 'Orders lo pone en octubre, como su PDF')
  assert.deepEqual(filtrarPedidos(pedidos, { estado: null, intervalo: 'thisMonth' }, '2026-11-06'), [], 'y no entra en el filtro de noviembre')
})

test('18 · Subscriptions: «Activa» incluye a las atrasadas, primero; con deuda es «Atrasada»; la ficha lee la mensualidad', () => {
  const sus = (id: string, estado: SuscripcionVenta['estado'], over: Partial<SuscripcionVenta> = {}): SuscripcionVenta => ({ ...SUSCRIPCIONES_EJEMPLO[0], id, estado, ...over })
  const lista = [sus('l-1', 'active'), sus('l-2', 'past_due', { deudaUsd: 100 }), sus('l-3', 'canceled'), sus('l-4', 'past_due')]
  const activas = filtrarSuscripciones(lista, { estado: 'active', intervalo: 'allTime' }, '2026-11-06')
  assert.deepEqual(activas.map((s) => s.id), ['l-1', 'l-2', 'l-4'], 'las que deben, adentro')
  assert.deepEqual(primeroLasAtrasadas(activas).map((s) => s.id), ['l-2', 'l-4', 'l-1'], 'y primero, sin cambiar el orden adentro de cada grupo')
  assert.deepEqual(filtrarSuscripciones(lista, { estado: 'past_due', intervalo: 'allTime' }, '2026-11-06').map((s) => s.id), ['l-2', 'l-4'], '«Atrasada» sigue aparte')
  // Quien pagó una parte de un mes vencido (deuda, sin un mes entero sin pagar) es «Atrasada».
  const parcial = suscripcionesDe({
    leads: [{
      leadId: 910, nombre: 'Estudio Norte', email: null, clienteWs: 41, estadoLead: 'ganado', fechaCierre: '2026-08-05', cobradoUsd: 338, conceptos: [], cobroIds: [],
      suscripcion: {
        estado: 'activa', fuente: 'manual', mensualidadUsd: 238, mensualidadInferida: false, meses: null, finPlazo: null, proximaRenovacion: '2026-12-01', renovacionFallida: null,
        proximoMes: { mes: '2026-11', vence: '2026-11-01', faltaUsd: 138, vencido: true },
        historia: { meses: [], diaDeCobro: 1, cortadaDesde: null, terminada: false, deudaUsd: 138, mesesSinPagar: 0, mesesParciales: 1, totalPagadoUsd: 338 },
      },
    }],
    cobros: [], nombreDeWs, hoy: '2026-11-06',
  })
  assert.deepEqual(parcial.map((s) => [s.estado, s.mensualidadUsd, s.deudaUsd]), [['past_due', 238, 138]])
  // «Lo que paga por mes» de la ficha: la mensualidad de sus vivas (activas y atrasadas), no lo último que pagó.
  assert.equal(mensualidadDelNegocio(parcial), 238)
  assert.equal(mensualidadDelNegocio([{ estado: 'canceled', mensualidadUsd: null }]), null, 'sin ninguna viva, manda lo cobrado')
})

test('19 · «Usar el precio de un plan» deja el recibo en dólares', () => {
  const f = { ...formCargarPagoInicial('2026-11-06'), moneda: 'ARS', lineas: [{ concepto: '', mes: '2026-11', monto: '' }, { concepto: 'Extra', mes: '', monto: '5' }] }
  const con = conElPrecioDelPlan(f, { nombre: 'MaKo Pro', precioUsd: 97 })
  assert.equal(con.moneda, 'USD', 'no «ARS 97»')
  assert.deepEqual(con.lineas, [{ concepto: 'MaKo Pro', mes: '2026-11', monto: '97' }, { concepto: 'Extra', mes: '', monto: '5' }])
  assert.equal(pedidoCargarPago({ ...con, cuenta: '41', aNombre: 'X' }, 'f', false).lineas[0].moneda, 'USD')
  // El pago del CRM que se eligió atar viaja con su id; sin elegir, null (se registra uno).
  const conPago = { ...con, cuenta: '41', aNombre: 'X', pagos: [{ ...con.pagos[0], pagoCrm: '802' }, { ...con.pagos[0], pagoCrm: '' }] }
  assert.deepEqual(pedidoCargarPago(conPago, 'f', false).pagos.map((p) => p.pago_crm), [802, null])
})

test('20 · el enlace «Suscripción» de un pedido: la del cobro, o la que lo lista en su historia; si no, sin enlace', () => {
  const subs = [
    { id: 'c-301', cobroIds: [301], historia: [] },
    { id: 'l-905', cobroIds: [340], historia: [] },
    { id: 'l-900', cobroIds: [], historia: [{ ...SUSCRIPCIONES_EJEMPLO[0].historia[0], pedidos: ['p-500', 'p-501'] }] },
  ]
  assert.equal(suscripcionDelPedido({ id: 'c-301', cobroId: 301 }, subs), '/admin/sales/subscriptions/c-301')
  assert.equal(suscripcionDelPedido({ id: 'p-700', cobroId: 340 }, subs), '/admin/sales/subscriptions/l-905', 'la del lead que tiene ese cobro')
  assert.equal(suscripcionDelPedido({ id: 'p-501', cobroId: null }, subs), '/admin/sales/subscriptions/l-900', 'a mano: la que lista el pedido')
  assert.equal(suscripcionDelPedido({ id: 'p-999', cobroId: null }, subs), null, 'ninguna: sin enlace (no un l-<lead> a ciegas)')
  // El detalle dibuja el enlace sólo con la ruta.
  const conRuta = renderToStaticMarkup(createElement(OrderDetails, { order: PEDIDOS_EJEMPLO[0], suscripcion: '/admin/sales/subscriptions/l-900' }))
  assert.match(conRuta, /href="\/admin\/sales\/subscriptions\/l-900/)
  const sinRuta = renderToStaticMarkup(createElement(OrderDetails, { order: PEDIDOS_EJEMPLO[0], suscripcion: null }))
  assert.doesNotMatch(sinRuta, /href="\/admin\/sales\/subscriptions\//, 'sin la ruta, sin enlace')
})

test('21 · una disputa sin pedido no se abre; Finance › Income abre cada pedido; y el aviso viejo de Orders ya no existe', () => {
  const filas = [{ id: 'd-1', pedido: 'c-40' as string | null }, { id: 'd-2', pedido: null }]
  const html = renderToStaticMarkup(createElement(DataTable<typeof filas[number]>, {
    columns: [{ accessorKey: 'id', header: 'Id' }], data: filas, isLoading: false, getRowId: (r) => r.id,
    onRowClick: () => {}, isRowClickable: (row) => row.original.pedido != null,
  }))
  assert.equal((html.match(/<tr[^>]*cursor-pointer/g) ?? []).length, 1, 'sólo la que tiene pedido lleva la mano')
  const todas = renderToStaticMarkup(createElement(DataTable<typeof filas[number]>, { columns: [{ accessorKey: 'id', header: 'Id' }], data: filas, isLoading: false, onRowClick: () => {} }))
  assert.equal((todas.match(/<tr[^>]*cursor-pointer/g) ?? []).length, 2, 'sin la regla, todas (lo de Polar)')
  // El aviso de Orders se borró: todo «No pude leer» va con el Alert de Orbit (punto 42).
  assert.throws(() => statSync(join(RAIZ, 'app/admin/_polar/web/Orders/Aviso.tsx')), /ENOENT/)
})
