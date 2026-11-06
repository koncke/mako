// =============================================================================
// Admin › Products, Finance › Income y Settings (el porte de Polar): las funciones puras que arman el catálogo de planes,
// los links de «Vender un plan», el libro de lo que entró y su CSV, y los ajustes de cobros
// (app/admin/_polar/datos/productos.ts, finanzas.ts, ajustes.ts), y que cada página del área pase por la puerta del super
// admin antes de leer.
// =============================================================================
// Correr: node --import tsx --test tests/admin-polar-productos.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (6/11/2026): ver la tabla del pie del archivo.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  esDeVenderUnPlan,
  filtrarLinksPorProducto,
  filtrarProductos,
  leerMostrar,
  leerOrden,
  leerOrdenLinks,
  leerProductIds,
  linkDeVenta,
  linksDeVenta,
  montoSugerido,
  ordenarLinks,
  productoDeCapa,
  productoDePlan,
  sePuedeAnular,
  type CobroDeVenta,
  type ProductoMako,
} from '../app/admin/_polar/datos/productos'
import { celdasDeExportacion, medioDeIngreso, movimientosDe, ordenarIngresos, paginar, tipoDeIngreso, type PedidoParaIngreso } from '../app/admin/_polar/datos/finanzas'
import { emisorConCambios, mismoEmisor, numeroLocal, numeroSimple, problemaDelPerfil, type Emisor } from '../app/admin/_polar/datos/ajustes'
import { getSettingsSection } from '../app/admin/_polar/web/Settings/settingsSections'
import { CHECKOUT_LINKS_EJEMPLO, COBROS_EJEMPLO, INGRESOS_EJEMPLO, PRODUCTOS_EJEMPLO } from '../app/admin/_polar/datos/ejemplo/productos'
import { PEDIDOS_EJEMPLO } from '../app/admin/_polar/datos/ejemplo/ventas'
import { PLANES_MAKO_DEFAULT, type PlanMako } from '../lib/planes-mako'
import { armarCsv } from '../lib/csv-celda'

const RAIZ = fileURLToPath(new URL('..', import.meta.url))
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n')
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

const plan = (p: Partial<PlanMako> & Pick<PlanMako, 'id' | 'nombre'>): PlanMako => ({
  capa: 'completo', precioUsd: 47, preciosLocales: {}, resumen: '', incluye: [], activo: true, ...p,
})

// ─── Catalogue ──────────────────────────────────────────────────────────────

test('el catálogo: buscar sin tildes, activos / archivados / todos, ordenar, y los archivados al final', () => {
  const productos = [
    productoDePlan(plan({ id: 'pro', nombre: 'MaKo Pro', capa: 'agencia', precioUsd: 97 })),
    productoDePlan(plan({ id: 'esencial', nombre: 'MaKo Esencial', precioUsd: 47 })),
    productoDePlan(plan({ id: 'continuidad', nombre: 'Continuidad del Acelerador', capa: 'agencia', precioUsd: 297, activo: false })),
  ]
  assert.deepEqual(filtrarProductos(productos).map((p) => p.id), ['esencial', 'pro'], 'por defecto, los activos de la A a la Z')
  assert.deepEqual(filtrarProductos(productos, { show: 'archived' }).map((p) => p.id), ['continuidad'])
  assert.deepEqual(filtrarProductos(productos, { show: 'all', sorting: 'name' }).map((p) => p.id), ['esencial', 'pro', 'continuidad'], 'el archivado va al final aunque su nombre vaya primero')
  assert.deepEqual(filtrarProductos(productos, { sorting: '-price_amount' }).map((p) => p.id), ['pro', 'esencial'])
  assert.deepEqual(filtrarProductos(productos, { sorting: 'price_amount' }).map((p) => p.id), ['esencial', 'pro'])
  assert.deepEqual(filtrarProductos(productos, { query: 'ÉSEN', show: 'all' }).map((p) => p.id), ['esencial'], 'sin mayúsculas ni tildes')
  assert.equal(leerMostrar('cualquiera'), 'active')
  assert.equal(leerOrden('-created_at'), 'name', '«Newest / Oldest» no existen: un plan no tiene fecha')
})

test('un plan como producto: el descuento de retención y el anual sólo si existen', () => {
  const p = productoDePlan(plan({ id: 'pro', nombre: 'MaKo Pro', precioAnualUsd: 970, retencion: { descuento: { pct: 50, meses: 2 }, bajarA: 'esencial' } }))
  assert.deepEqual(p.descuento, { pct: 50, meses: 2 })
  assert.equal(p.precioAnualUsd, 970)
  const q = productoDePlan(plan({ id: 'x', nombre: 'X', retencion: { pausa: { meses: 1 } } }))
  assert.equal(q.descuento, null, 'pausar no es un descuento')
  assert.equal(q.precioAnualUsd, null)
  // Los de fábrica: todos se convierten, y sus precios locales no se comparten por referencia. (Lo que un plan «incluye» ya no
  // viaja: los Benefits de Polar se sacaron, revisión del 6/11/2026.)
  const todos = PLANES_MAKO_DEFAULT.map(productoDePlan)
  assert.equal(todos.length, PLANES_MAKO_DEFAULT.length)
  todos[0].preciosLocales.XXX = 1
  assert.equal(PLANES_MAKO_DEFAULT[0].preciosLocales.XXX, undefined)
  assert.ok(todos.every((p) => !('incluye' in p)), 'un producto no lleva los beneficios')
})

// ─── Checkout Links ─────────────────────────────────────────────────────────

const cobro = (c: Partial<CobroDeVenta> & Pick<CobroDeVenta, 'id'>): CobroDeVenta => ({
  nombre: 'Ana Gómez', email: 'ana@ejemplo.com', alta_capa: 'completo', monto: 47, moneda: 'USD', monto_usd: 47, tipo: 'suscripcion',
  proveedor: 'stripe', estado: 'pendiente', created_at: '2026-11-04T15:00:00Z', pagado_at: null, creado_por: 'Super admin',
  alta_ws: null, alta_estado: null, url: 'https://hola-mako.com/pagar/t', alta_ws_nombre: null, ...c,
})

test('Checkout Links: sólo los de «Vender un plan», nunca los del checkout público ni los cobros sin plan', () => {
  assert.equal(esDeVenderUnPlan(cobro({ id: 1 })), true)
  assert.equal(esDeVenderUnPlan(cobro({ id: 2, creado_por: 'planes:esencial' })), false, 'el checkout de /planes')
  assert.equal(esDeVenderUnPlan(cobro({ id: 3, creado_por: 'planes:esencial:prueba' })), false)
  assert.equal(esDeVenderUnPlan(cobro({ id: 4, alta_capa: null })), false, 'un cobro sin plan (una cuota de una ficha)')
  assert.equal(esDeVenderUnPlan(cobro({ id: 5, creado_por: null })), true, 'sin autor anotado, igual es un link armado a mano')
  assert.deepEqual(CHECKOUT_LINKS_EJEMPLO.links.map((l) => l.id).sort(), [101, 102, 103], 'el ejemplo deja afuera el cobro 104 (de /planes)')
})

test('el plan de un link: el único con esa capa, o el nombre de la capa si dos la comparten', () => {
  const productos = PLANES_MAKO_DEFAULT.map(productoDePlan)
  assert.equal(productoDeCapa('completo', productos), 'MaKo Esencial')
  assert.equal(productoDeCapa('agencia', productos), 'Agencia', 'Pro y Continuidad comparten la capa: no se elige uno a ciegas')
  const l = linkDeVenta(cobro({ id: 9, alta_capa: 'agencia' }), productos)
  assert.equal(l.producto, 'Agencia')
})

test('un link: la URL sólo mientras se puede pagar, la etiqueta cae al email, y se anula sólo sin pagar', () => {
  const productos = PRODUCTOS_EJEMPLO
  const pagado = linkDeVenta(cobro({ id: 1, estado: 'pagado' }), productos)
  assert.equal(pagado.url, null, 'un link pagado ya no sirve: no se ofrece para copiar')
  assert.equal(sePuedeAnular(pagado), false)
  const rechazado = linkDeVenta(cobro({ id: 2, estado: 'fallido' }), productos)
  assert.equal(rechazado.url, 'https://hola-mako.com/pagar/t')
  assert.equal(sePuedeAnular(rechazado), true)
  assert.equal(linkDeVenta(cobro({ id: 3, nombre: '  ' }), productos).etiqueta, 'ana@ejemplo.com')
  assert.equal(linkDeVenta(cobro({ id: 4, nombre: null, email: null }), productos).etiqueta, 'Sin nombre')
  const conCuenta = linkDeVenta(cobro({ id: 5, alta_ws: 77, alta_ws_nombre: 'Estudio Norte' }), productos)
  assert.deepEqual(conCuenta.cuenta, { ws: 77, nombre: 'Estudio Norte' })
})

test('la barra: el orden por etiqueta y el filtro por plan (por su capa)', () => {
  const productos = PLANES_MAKO_DEFAULT.map(productoDePlan)
  const links = linksDeVenta(
    [cobro({ id: 1, nombre: 'Beto' }), cobro({ id: 2, nombre: 'ana', alta_capa: 'agencia' }), cobro({ id: 3, nombre: 'Carla' })],
    productos,
  )
  assert.deepEqual(ordenarLinks(links, 'label').map((l) => l.id), [2, 1, 3], 'de la A a la Z, sin mirar mayúsculas')
  assert.deepEqual(ordenarLinks(links, '-label').map((l) => l.id), [3, 1, 2])
  assert.deepEqual(filtrarLinksPorProducto(links, ['esencial'], productos).map((l) => l.id), [1, 3])
  assert.deepEqual(filtrarLinksPorProducto(links, ['pro'], productos).map((l) => l.id), [2])
  assert.deepEqual(filtrarLinksPorProducto(links, [], productos).length, 3, 'sin filtro, todos')
  assert.deepEqual(leerProductIds('pro, esencial,'), ['pro', 'esencial'])
  assert.deepEqual(leerProductIds(['pro']), ['pro'])
  assert.equal(leerOrdenLinks('-label'), '-label')
  assert.equal(leerOrdenLinks('otra'), 'label')
})

test('el monto que se propone: el precio del plan en la moneda del link, nunca con una tasa inventada', () => {
  const esencial = PRODUCTOS_EJEMPLO.find((p) => p.id === 'esencial') as ProductoMako
  assert.equal(montoSugerido(esencial, 'USD'), 47)
  assert.equal(montoSugerido(esencial, 'ARS'), 56000)
  assert.equal(montoSugerido(esencial, 'MXN'), null, 'sin precio en esa moneda, nada')
  assert.equal(montoSugerido(esencial, null), null, 'Mercado Pago sin moneda leída')
  assert.equal(montoSugerido(null, 'USD'), null)
})

// ─── Finance › Income ───────────────────────────────────────────────────────

// Pedidos de Orders (la forma de `pedidosDe`), con lo que el libro necesita: uno pagado, uno con «=» en el nombre, uno sin su valor
// en dólares, uno devuelto entero (con su recibo, sin el monto devuelto), uno con una devolución parcial en la moneda del recibo,
// uno anulado y uno en USDT sin su valor en dólares.
const pedido = (p: Partial<PedidoParaIngreso> & Pick<PedidoParaIngreso, 'id' | 'fecha'>): PedidoParaIngreso => ({
  cliente: { clave: 'ws:42', nombre: 'Estudio Norte', ws: 42, leadId: 7, email: null }, concepto: null, medio: 'stripe', recurrente: true,
  usd: 97, estado: 'paid', recibo: null, ...p,
})
const reciboDe = (r: Partial<NonNullable<PedidoParaIngreso['recibo']>>): NonNullable<PedidoParaIngreso['recibo']> => ({
  devueltoAt: null, devueltoMonto: null, monedaDetalle: 'USD',
  pagos: [{ id: 1, medio: 'binance', referencia: '1', fecha: '2026-10-12T14:00:00Z', monto: 300, moneda: 'USDT', montoUsd: null, de: null, comprobante: false, anulado: false }],
  ...r,
})
const pedidos: PedidoParaIngreso[] = [
  pedido({ id: 'p-1', fecha: '2026-09-02', cliente: { clave: 'ws:42', nombre: 'Estudio Norte', ws: 42, leadId: 7, email: null }, usd: 47 }),
  pedido({ id: 'p-2', fecha: '2026-10-15', cliente: { clave: 'lead:9', nombre: '=HYPERLINK("x")', ws: null, leadId: 9, email: null }, usd: 300.5, medio: 'transferencia', recurrente: false }),
  pedido({ id: 'p-3', fecha: '2026-10-15', cliente: { clave: 'lead:10', nombre: 'Luis Prado', ws: null, leadId: 10, email: null }, usd: null, medio: 'transferencia', recurrente: false }),
  pedido({ id: 'c-4', fecha: '2026-10-20', usd: 97, estado: 'refunded', recibo: reciboDe({ devueltoAt: '2026-10-25T13:30:00Z' }) }),
  pedido({ id: 'c-5', fecha: '2026-10-21', usd: 97, estado: 'partially_refunded', recibo: reciboDe({ devueltoAt: '2026-10-26T10:00:00Z', devueltoMonto: 40, monedaDetalle: 'USD' }) }),
  pedido({ id: 'c-6', fecha: '2026-10-22', usd: 97, estado: 'void', recibo: reciboDe({}) }),
  pedido({ id: 'r-7', fecha: '2026-11-02', usd: null, medio: 'binance', recurrente: false, estado: 'refunded', recibo: reciboDe({ devueltoAt: '2026-11-03T09:00:00Z', monedaDetalle: 'USDT' }) }),
  pedido({ id: 'c-8', fecha: '2026-10-23', usd: 97, estado: 'partially_refunded', recibo: reciboDe({ devueltoAt: '2026-10-27T10:00:00Z' }) }),
]

test('Income es el LIBRO: lo que entró en positivo, lo devuelto en negativo el día que salió, y lo anulado no mueve plata', () => {
  const libro = movimientosDe(pedidos)
  const de = (id: string) => libro.find((m) => m.id === id)
  assert.deepEqual(libro.map((m) => [m.id, m.fecha, m.monto, m.moneda]), [
    ['p-1', '2026-09-02', 47, 'USD'],
    ['p-2', '2026-10-15', 300.5, 'USD'],
    ['p-3', '2026-10-15', null, null],
    ['c-4', '2026-10-20', 97, 'USD'],
    ['c-5', '2026-10-21', 97, 'USD'],
    ['c-8', '2026-10-23', 97, 'USD'],
    ['c-4:devolucion', '2026-10-25', -97, 'USD'],
    ['c-5:devolucion', '2026-10-26', -40, 'USD'],
    ['c-8:devolucion', '2026-10-27', null, null],
    ['r-7', '2026-11-02', 300, 'USDT'],
    ['r-7:devolucion', '2026-11-03', -300, 'USDT'],
  ], 'el más viejo primero; c-6 (anulado) no está')
  assert.equal(de('c-4:devolucion')?.tipo, 'devolucion')
  assert.equal(de('c-4:devolucion')?.pedido, 'c-4', 'cada movimiento lleva a su pedido de Orders')
  assert.equal(de('c-5:devolucion')?.monto, -40, 'una devolución parcial resta lo devuelto, no el pago entero')
  assert.equal(de('c-8:devolucion')?.monto, null, 'una devolución parcial sin su monto: no se sabe cuánto (no se inventa)')
  assert.equal(de('r-7')?.moneda, 'USDT', 'sin su valor en dólares, en la moneda que se recibió')
  assert.ok(libro.every((m) => !('estado' in m) && !('recibo' in m)), 'el estado y el recibo son del pedido (Orders), no del libro')
  assert.equal(tipoDeIngreso({ recurrente: true, tipo: 'cobro' }), 'Suscripción')
  assert.equal(tipoDeIngreso({ recurrente: false, tipo: 'cobro' }), 'Compra')
  assert.equal(tipoDeIngreso({ recurrente: true, tipo: 'devolucion' }), 'Devolución')
  assert.equal(medioDeIngreso('mercadopago'), 'Mercado Pago')
  assert.equal(medioDeIngreso('binance'), 'Binance')
  assert.equal(medioDeIngreso(null), 'Sin medio')
})

test('Income: el más nuevo primero (y a igual día, lo que entró antes de lo que salió), de a páginas', () => {
  const libro = movimientosDe(pedidos)
  assert.deepEqual(ordenarIngresos(libro).map((f) => f.id).slice(0, 3), ['r-7:devolucion', 'r-7', 'c-8:devolucion'])
  assert.deepEqual(ordenarIngresos(libro, false).map((f) => f.id).slice(0, 2), ['p-1', 'p-2'])
  const p = paginar(ordenarIngresos(libro), 1, 10)
  assert.deepEqual(p.items.map((f) => f.id), ['p-1'])
  assert.equal(p.rowCount, 11)
  assert.equal(p.pageCount, 2)
  assert.deepEqual(paginar(libro, 9, 10).items.map((f) => f.id), ['r-7:devolucion'], 'una página de más cae en la última')
  assert.equal(paginar([], 0, 50).pageCount, 1)
})

test('el CSV de Income: el rango con los dos extremos, las columnas en su orden, el pedido de cada uno, y un nombre con «=» neutralizado', () => {
  const libro = movimientosDe(pedidos)
  const celdas = celdasDeExportacion(libro, ['gross_amount', 'created_at', 'customer'], { desde: '2026-10-15', hasta: '2026-10-20' })
  assert.deepEqual(celdas[0], ['Fecha', 'De quién', 'Monto'], 'el orden es el de los grupos, no el de la selección')
  assert.deepEqual(celdas.slice(1), [
    ['2026-10-15', '=HYPERLINK("x")', 300.5],
    ['2026-10-15', 'Luis Prado', null],
    ['2026-10-20', 'Estudio Norte', 97],
  ])
  const texto = armarCsv(celdas)
  assert.match(texto, /'=HYPERLINK/, 'armarCsv le antepone el apóstrofo a lo que arranca como fórmula')
  const todas = celdasDeExportacion(libro, ['created_at', 'type', 'customer', 'method', 'order_id', 'gross_amount', 'currency'], { desde: '2026-01-01', hasta: '2026-12-31' })
  assert.deepEqual(todas[0], ['Fecha', 'Tipo', 'De quién', 'Medio', 'Pedido', 'Monto', 'Moneda'])
  assert.deepEqual(todas[1], ['2026-09-02', 'Suscripción', 'Estudio Norte', 'Stripe', 'p-1', 47, 'USD'])
  assert.deepEqual(todas[3], ['2026-10-15', 'Compra', 'Luis Prado', 'Transferencia', 'p-3', null, null], 'sin saber cuánto: monto y moneda vacíos')
  assert.deepEqual(todas[7], ['2026-10-25', 'Devolución', 'Estudio Norte', 'Stripe', 'c-4', -97, 'USD'], 'lo que salió, negativo y con su pedido')
  // El ejemplo: el libro son los pedidos de Orders (ejemplo/ventas.ts), y la devolución de Agencia Brújula entra y sale.
  assert.ok(INGRESOS_EJEMPLO.ok)
  assert.deepEqual(INGRESOS_EJEMPLO.ok && INGRESOS_EJEMPLO.filas, movimientosDe(PEDIDOS_EJEMPLO))
})

// ─── Settings ───────────────────────────────────────────────────────────────

test('Settings: los precios como los escribe una persona, y lo que no se entiende no borra nada', () => {
  assert.equal(numeroLocal('130.000'), 130000)
  assert.equal(numeroLocal('130.000,50'), 130000.5)
  assert.equal(numeroLocal('  '), null, 'vacío saca el precio')
  assert.equal(numeroLocal('ciento'), undefined, 'lo que no se entiende es otra cosa que vacío')
  assert.equal(numeroLocal('-5'), undefined)
  assert.equal(numeroSimple('47,5'), 47.5)
  assert.equal(numeroSimple('47.5'), 47.5)
  assert.equal(numeroSimple(''), null)
  assert.equal(numeroSimple('0'), undefined)
})

test('Settings: el emisor se manda ENTERO, con los cambios encima', () => {
  const base: Emisor = { nombre: 'MaKo · hola-mako.com', documento: 'CUIT 30-00000000-0', direccion: null, correo: 'hola@ejemplo.com', asunto: null, intro: null }
  const conAsunto = emisorConCambios(base, { asunto: '  Tu recibo {{numero}} ' })
  assert.equal(conAsunto.asunto, 'Tu recibo {{numero}}')
  assert.equal(conAsunto.documento, 'CUIT 30-00000000-0', 'cambiar el asunto no borra el documento')
  assert.equal(conAsunto.nombre, base.nombre)
  assert.equal(emisorConCambios(base, { nombre: '   ' }).nombre, base.nombre, 'un nombre vacío no pisa el que hay')
  assert.equal(emisorConCambios(base, { documento: '' }).documento, null, 'vaciar el documento lo saca')
  assert.equal(mismoEmisor(base, { ...base, correo: ' hola@ejemplo.com ' }), true)
  assert.equal(mismoEmisor(base, conAsunto), false)
  assert.deepEqual(problemaDelPerfil({ nombre: '', correo: '' })?.campo, 'nombre')
  assert.deepEqual(problemaDelPerfil({ nombre: 'MaKo', correo: 'no-es-un-correo' })?.campo, 'correo')
  assert.equal(problemaDelPerfil({ nombre: 'MaKo', correo: '' }), null)
})

test('Settings: sólo las secciones que MaKo llena (lo demás de Polar es un 404)', () => {
  assert.equal(getSettingsSection('payments')?.title, 'Payments')
  assert.equal(getSettingsSection('customer-notifications')?.title, 'Customer Notifications')
  assert.equal(getSettingsSection('members'), undefined)
  assert.equal(getSettingsSection('__proto__'), undefined)
  assert.equal(getSettingsSection('toString'), undefined)
})

// ─── Las puertas ────────────────────────────────────────────────────────────

function archivos(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(join(RAIZ, dir))) {
    const p = `${dir}/${n}`
    if (statSync(join(RAIZ, p)).isDirectory()) archivos(p, out)
    else if (/\.tsx?$/.test(n)) out.push(p)
  }
  return out
}

const AREA = ['app/admin/(polar)/products', 'app/admin/(polar)/finance', 'app/admin/(polar)/settings']

test('cada página (y el layout que lee) del área: force-dynamic y `exigirSuperAdmin()` ANTES de leer', () => {
  const paginas = AREA.flatMap((d) => archivos(d)).filter((p) => /\/(page|layout)\.tsx$/.test(p))
  assert.ok(paginas.length >= 9, `se encontraron ${paginas.length} páginas: el barrido no está mirando`)
  for (const p of paginas) {
    const src = sinComentarios(leer(p))
    assert.match(src, /export const dynamic = 'force-dynamic'/, `${p}: force-dynamic`)
    assert.match(src, /export default async function \w*\([^)]*\)[^{]*\{\s*await exigirSuperAdmin\(\)/, `${p}: exigirSuperAdmin() es la primera sentencia`)
    // Y generateMetadata, si lee algo, también pasa por la puerta antes.
    const meta = /export async function generateMetadata\([^)]*\)[^{]*\{([\s\S]*?)\n\}/.exec(src)?.[1] ?? ''
    if (/leer\w*\(/.test(meta)) assert.match(meta, /^\s*await exigirSuperAdmin\(\)/, `${p}: generateMetadata lee y no pasa por la puerta`)
  }
})

test('ninguna vista del navegador importa VALORES de un módulo de servidor, y Income no dibuja un gráfico', () => {
  const vistas = [...AREA.flatMap((d) => archivos(d)), ...['Products', 'CheckoutLinks', 'Transactions', 'Settings'].flatMap((d) => archivos(`app/admin/_polar/web/${d}`))]
    .filter((p) => /^'use client'/.test(leer(p)))
  assert.ok(vistas.length >= 20, `se encontraron ${vistas.length} vistas: el barrido no está mirando`)
  for (const p of vistas) {
    const src = sinComentarios(leer(p))
    for (const m of src.matchAll(/^import (?!type )[^']*?from '([^']+)'/gm)) {
      assert.doesNotMatch(m[1], /-server$|^@\/lib\/(compra-plan|cobros|recibos|admin-ingresos|vender-plan|agencia-cobro)$/, `${p} importa un valor de ${m[1]}`)
    }
  }
  const income = ['app/admin/(polar)/finance/income/IncomePage.tsx', 'app/admin/_polar/web/Transactions/TransactionsList.tsx'].map((p) => sinComentarios(leer(p))).join('\n')
  assert.doesNotMatch(income, /MetricChart|GenericChart|metricasDeIngresos|Chart\b/, 'el gráfico de ingresos vive sólo en Overview y en Analytics › Metrics')
})

// PROBADO ROMPIÉNDOLO (6/11/2026). Base: 14 pass / 0 fail. Cada rotura, restaurada después (y la base otra vez 14/0):
// (6/11/2026, revisión: Income pasó a ser el LIBRO de movimientos y se sumó su test. Base: 15/0. Cada rotura, sola:
//   · `movimientosDe` deja pasar el pedido anulado                                      → 12/3 (el libro, el orden, el CSV)
//   · el CSV de Income sin el pedido de cada movimiento (`order_id` vacío)              → 14/1 (el CSV de Income)
//   Las demás roturas de ese día, en tests/admin-polar-arreglos-3.test.ts.)
//   · `filtrarProductos` sin el «archivados al final»                                   → 13/1 (el catálogo)
//   · `esDeVenderUnPlan` sin el corte de `creado_por` «planes:»                         → 13/1 (Checkout Links)
//   · `productoDeCapa` elige el primer plan de la capa (`>= 1` en vez de `=== 1`)        → 13/1 (el plan de un link)
//   · `linkDeVenta` con la URL siempre, aunque el cobro esté pagado                       → 13/1 (un link)
//   · `enElRango` sin el día de arriba del rango (`>` en vez de `>=`)                     → 13/1 (el CSV de Income)
//   · `emisorConCambios` deja el nombre vacío                                            → 13/1 (el emisor entero)
//   · `numeroLocal` sin sacar el punto de miles                                          → 13/1 (los precios)
//   · products/page.tsx: `leerProductos()` antes de `exigirSuperAdmin()`                 → 13/1 (la puerta)
//   · ProductsPage importa un VALOR de productos-server                                  → 13/1 (vistas sin servidor)
//   · IncomePage importa MetricChartBox                                                  → 13/1 (sin gráfico en Income)
//   · y un cambio sin efecto (renombrar la función local `plano` de productos.ts)        → 14/0
