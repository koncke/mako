// =============================================================================
// Admin › Sales (Orders, Subscriptions, Checkouts, Disputes): las funciones puras que arman sus props
// (app/admin/_polar/datos/ventas.ts), y que cada página pase por la puerta del super admin antes de leer.
// =============================================================================
// Correr: node --import tsx --test tests/admin-polar-ventas.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (6/11/2026), con el arnés que restaura de memoria. Base: 11 pass / 0 fail. Cada rotura, sola:
//   · `pedidosDe` sin atar el recibo por el cobro (`reciboDeCobro.get`)                          → 8/3 (1, 3, 7)
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
  type CobroVenta, type EntradaVenta, type ReciboVenta, type SuscripcionDeLead,
} from '../app/admin/_polar/datos/ventas'
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
    { id: 'c:310', fecha: '2026-10-30', usd: 97, medio: 'mercadopago', recurrente: false, nombre: 'Agencia Faro', cliente: 'ws:52', concepto: 'Lugar', cobroId: 310 },
  ]
  const recibos = [
    recibo({ id: 7, cobroId: 301 }),
    recibo({ id: 8, cobroId: 310, estado: 'devuelto', devueltoAt: '2026-11-02T00:00:00Z' }),
    recibo({ id: 9, cobroId: null, origen: 'manual', destinoWs: 52, aNombre: 'Agencia Faro SRL', fechaPago: '2026-11-04T12:00:00Z', pagos: [{ id: 2, medio: 'binance', referencia: '1', fecha: '2026-11-04T12:00:00Z', monto: 200, moneda: 'USDT', montoUsd: 200, de: null, comprobante: true, anulado: false }] }),
  ]
  const pedidos = pedidosDe({ entradas, recibos, clientes, nombreDeWs })
  assert.deepEqual(pedidos.map((p) => p.id), ['p-501', 'r-9', 'c-310', 'p-488'], 'el más nuevo primero; el recibo suelto es r-<id>')
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
  const p = pedidosDe({ entradas: [{ id: 'c:1', fecha: '2026-11-01', usd: 97, medio: 'stripe', recurrente: false, nombre: 'X', cobroId: 1 }], recibos: [recibo({ cobroId: 1, estado: 'devuelto' })], clientes, nombreDeWs })
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
  // (6/11/2026: el ejemplo del Pro pasó de US$ 297 a US$ 97, su precio en lib/planes-mako.ts: el orden por monto cambió.)
  assert.deepEqual(ord.map((p) => p.id), ['r-8', 'p-488', 'p-501'])
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
