// =============================================================================
// Admin (la copia de Polar): los arreglos de Analytics, Sales, Products, Finance y Settings del 6/11/2026, EJECUTADOS
// =============================================================================
// Lo que salió mirando las capturas con datos de ejemplo (docs/admin/polar/*.png) contra el panel real de Polar
// (docs/admin/referencia-polar/). Cada test corre las funciones puras (o dibuja la pieza) con datos armados:
//   1. el filtro de fechas de Orders y Subscriptions dice el rango (el DateRangePicker de Polar, con su calendario): la fecha
//      elegida va en la URL (`range` o `from`/`to`) y filtra igual en las dos;
//   2. un rango de fechas en español se escribe en el orden del español («1–6 nov 2026», no «1 nov – 6, 2026»), y el de la
//      píldora de Events dice el año;
//   3. la hora de un evento tiene UN formato («06 nov, 14:20:00»; un pago, que sólo tiene su día, «04 nov»);
//   4. Analytics › Costs: el nombre para personas de cada función (el del catálogo de modelos), la plata en centavos («< US$ 0,01»
//      para lo que no llega) y el último gráfico estira su fila (nada de media fila vacía);
//   5. Settings › Customer Notifications: los datos del correo con su nombre y un ejemplo legible, sin llaves;
//   6. Products: la ficha de un plan sin «Beneficios» (revisión del 6/11/2026: Benefits se saca), con sus descuentos;
//   7. Checkout Links: el índice salta al primer link DESPUÉS de hidratar (no tira `redirect()` mientras dibuja);
//   8. el detalle de un pedido nombra al cliente por su negocio, con UN link a su ficha (el de Polar) y sin «Entrar»;
//   9. los ejemplos: «Estudio Norte» es el ws 42 en todos, y cada plan cuesta lo de PLANES_MAKO_DEFAULT (por mes o por año).
//   (3, 5, 6 y 8 cambiaron el 6/11/2026 con la revisión: la hora sin segundos, el correo de ejemplo con el pago de noviembre de
//   Estudio Norte, la ficha de un plan sin «Beneficios» y un solo link a la ficha del cliente. Base: 9/0; rompiendo, cada uno 8/1:
//   la hora vuelve a «:00» → (3); ProductOverview vuelve a dibujar «Beneficios» → (6); vuelve el link «Cuenta» → (8).)
//
// Probado rompiéndolo el 6/11/2026 (base: 9/0). Cada rotura, sola, deja 8/1 (el test que se nombra):
//   · `fechaDeParams` ignora `from`/`to` (vuelve siempre al intervalo)                                → 8/1 (1)
//   · `filtrarPedidos` vuelve a leer sólo `f.intervalo` (`rangoDe` en vez de `rangoDeFecha`)            → 8/1 (1)
//   · `formatearIntervalo` sin la rama del español (la cuenta de Polar tal cual)                       → 8/1 (2)
//   · `formatTimeRange` por días sin el año (`hideCurrentYear: true`)                                    → 8/1 (2)
//   · `horaDelEvento` con `toLocaleString('es-AR', …)` como antes                                       → 8/1 (3)
//   · `plataDeCosto` sin el «< US$ 0,01»                                                                 → 8/1 (4)
//   · `claseDeAncho` sin el estirón del último                                                            → 8/1 (4)
//   · `vistaPreviaDelCorreo` devuelve la plantilla sin los datos                                         → 8/1 (5)
//   · ProductOverview vuelve a dibujar ProductBenefits (6/11/2026)                                        → 8/1 (6)
//   · MasterDetailIndex vuelve a llamar a `redirect()`                                                    → 8/1 (7)
//   · OrderCustomerContext vuelve a «Workspace <n>», o al segundo link «Cuenta», o a «Entrar»             → 8/1 (8)
//   · el ejemplo del Pro vuelve a US$ 297                                                                 → 8/1 (9)
// =============================================================================

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  fechaDeParams, filtrarPedidos, filtrarSuscripciones, intervalosConRango, paramsDeFecha, primerDia, rangoDeFecha,
} from '../app/admin/_polar/datos/ventas'
import { formatearIntervalo } from '../app/admin/_polar/atoms/intervalo'
import { formatTimeRange } from '../app/admin/_polar/web/Events/EventsHistogramControls'
import { horaDelEvento } from '../app/admin/_polar/web/Events/hora'
import { armarCostos, nombresDeFeatures, plataDeCosto } from '../app/admin/_polar/datos/costos'
import { formatCurrency } from '../app/admin/_polar/lib/currency'
import { claseDeAncho } from '../app/admin/_polar/web/Metrics/dashboards/reparto'
import { CATALOGO_MODELOS } from '../lib/model-catalogo'
import { DATOS_DE_LA_FRASE, DATOS_DEL_ASUNTO, conDato, vistaPreviaDelCorreo } from '../app/admin/_polar/datos/ajustes'
import { ProductOverview } from '../app/admin/_polar/web/Products/ProductPage/ProductOverview'
import { productoDePlan } from '../app/admin/_polar/datos/productos'
import { rutaDelCliente } from '../app/admin/_polar/web/Orders/OrderCustomerContext'
import { destinoDelIndice } from '../app/admin/_polar/web/CheckoutLinks/MasterDetailIndex'
import { textoDelCambio } from '../app/admin/_polar/web/Subscriptions/SubscriptionOrdersSection'
import { PLANES_MAKO_DEFAULT } from '../lib/planes-mako'
import { COBROS_EJEMPLO as COBROS_VENTAS, PEDIDOS_EJEMPLO, SUSCRIPCIONES_EJEMPLO, CHECKOUTS_EJEMPLO } from '../app/admin/_polar/datos/ejemplo/ventas'
import { COBROS_EJEMPLO as COBROS_PRODUCTOS } from '../app/admin/_polar/datos/ejemplo/productos'
import { COSTOS_EJEMPLO, EVENTOS_EJEMPLO, INGRESOS_EJEMPLO } from '../app/admin/_polar/datos/ejemplo/analytics'
import { WS_EJEMPLO } from '../app/admin/_polar/datos/ejemplo/cliente'

const RAIZ = fileURLToPath(new URL('..', import.meta.url))
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n')
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
const HOY = '2026-11-06'

test('1 · el filtro de fechas de Sales: un intervalo o un rango a mano, en la URL, y filtra igual en Orders y Subscriptions', () => {
  // Lo que dice la URL.
  assert.deepEqual(fechaDeParams(null, null, null), { intervalo: 'allTime' }, 'sin nada, desde siempre')
  assert.deepEqual(fechaDeParams('lastMonth', null, null), { intervalo: 'lastMonth' })
  assert.deepEqual(fechaDeParams('cualquiera', null, null), { intervalo: 'allTime' }, 'un intervalo que no existe no filtra')
  assert.deepEqual(fechaDeParams(null, '2026-10-01', '2026-10-25'), { desde: '2026-10-01', hasta: '2026-10-25' }, 'el rango del calendario')
  assert.deepEqual(fechaDeParams('thisMonth', '2026-10-25', '2026-10-01'), { desde: '2026-10-01', hasta: '2026-10-25' }, 'dado vuelta se ordena, y gana sobre el intervalo')
  assert.deepEqual(fechaDeParams('thisMonth', '2026-13-01', '2026-10-01'), { intervalo: 'thisMonth' }, 'una fecha rota no es un rango')
  // Lo que se escribe: un intervalo borra el rango y al revés.
  assert.deepEqual(paramsDeFecha({ intervalo: 'allTime' }), { range: null, from: null, to: null })
  assert.deepEqual(paramsDeFecha({ intervalo: 'today' }), { range: 'today', from: null, to: null })
  assert.deepEqual(paramsDeFecha({ desde: '2026-10-01', hasta: '2026-10-25' }), { range: null, from: '2026-10-01', to: '2026-10-25' })
  // Ida y vuelta por la URL.
  for (const f of [{ intervalo: 'last3Months' as const }, { desde: '2026-09-02', hasta: '2026-11-04' }]) {
    const p = paramsDeFecha(f)
    assert.deepEqual(fechaDeParams(p.range, p.from, p.to), f)
  }
  assert.deepEqual(rangoDeFecha({ intervalo: 'thisMonth' }, HOY), { desde: '2026-11-01', hasta: '2026-11-30' })
  assert.deepEqual(rangoDeFecha({ desde: '2026-10-20', hasta: '2026-10-22' }, HOY), { desde: '2026-10-20', hasta: '2026-10-22' })

  // Lo que se dibuja: cada intervalo con su rango en días del negocio, «Desde siempre» desde el primer día con datos.
  assert.equal(primerDia(PEDIDOS_EJEMPLO.map((p) => p.fecha), HOY), '2026-06-02', 'el primer pago de los ejemplos (ejemplo/negocios.ts)')
  assert.equal(primerDia([], HOY), HOY, 'sin datos, hoy')
  assert.equal(primerDia([null, 'basura', '2026-12-01'], HOY), HOY, 'lo que no es una fecha (o es futuro) no corre el piso')
  const intervalos = intervalosConRango(HOY, '2026-06-02')
  assert.deepEqual(intervalos.find((i) => i.slug === 'allTime'), { slug: 'allTime', label: 'Desde siempre', desde: '2026-06-02', hasta: HOY })
  assert.deepEqual(intervalos.find((i) => i.slug === 'thisMonth'), { slug: 'thisMonth', label: 'Este mes', desde: '2026-11-01', hasta: '2026-11-30' })

  // Y filtra: un rango a mano en Orders y en Subscriptions (por la fecha en que empezó).
  assert.deepEqual(filtrarPedidos(PEDIDOS_EJEMPLO, { estado: null, desde: '2026-11-01', hasta: '2026-11-02' }, HOY).map((p) => p.id), ['c-101', 'p-1022', 'p-1021'])
  assert.deepEqual(filtrarPedidos(PEDIDOS_EJEMPLO, { estado: null, intervalo: 'lastMonth' }, HOY).map((p) => p.fecha.slice(0, 7)), Array(7).fill('2026-10'), 'el intervalo sigue andando')
  assert.deepEqual(filtrarSuscripciones(SUSCRIPCIONES_EJEMPLO, { estado: 'any', desde: '2026-08-01', hasta: '2026-08-31' }, HOY).map((s) => s.id), ['l-9', 'l-14'])

  // El selector es el DateRangePicker de Polar (no un Select con el texto partido por `line-clamp`).
  const select = sinComentarios(leer('app/admin/_polar/web/Orders/DateRangeSelect.tsx'))
  assert.match(select, /<DateRangePicker\b/, 'el selector de Polar')
  assert.doesNotMatch(select, /SelectTrigger/, 'nada del Select de antes')
})

test('2 · un rango de fechas en español, en el orden del español; y la píldora de Events con el año', () => {
  const ahora = new Date(2026, 10, 6)
  const f = (a: Date, b: Date, hide = false) => formatearIntervalo(a, b, { locale: 'es', hideCurrentYear: hide, ahora })
  assert.equal(f(new Date(2026, 10, 1), new Date(2026, 10, 6)), '1–6 nov 2026', 'el mismo mes (Costs decía «1 nov – 6, 2026»)')
  assert.equal(f(new Date(2026, 10, 1), new Date(2026, 10, 6), true), '1–6 nov', 'sin el año del año en curso')
  assert.equal(f(new Date(2026, 9, 5), new Date(2026, 10, 5)), '5 oct – 5 nov 2026')
  assert.equal(f(new Date(2025, 11, 5), new Date(2026, 0, 5), true), '5 dic 2025 – 5 ene 2026', 'dos años: los dos siempre')
  assert.equal(f(new Date(2026, 10, 6), new Date(2026, 10, 6)), '6 nov 2026', 'un solo día')
  assert.equal(
    formatearIntervalo(new Date(2026, 10, 1), new Date(2026, 10, 6), { locale: 'en-US', hideCurrentYear: false, ahora }),
    'Nov 1 – 6, 2026',
    'en inglés, la cuenta de Polar tal cual',
  )
  // La píldora del histograma: por días, con el año; por horas, el año sólo si no es el de hoy.
  assert.equal(formatTimeRange({ from: new Date(2026, 7, 6), to: new Date(2026, 10, 7) }, false, ahora), '6 ago – 6 nov 2026')
  assert.equal(formatTimeRange({ from: new Date(2026, 10, 1), to: new Date(2026, 10, 7) }, false, ahora), '1–6 nov 2026')
  assert.match(formatTimeRange({ from: new Date(2026, 10, 6, 14), to: new Date(2026, 10, 6, 15) }, true, ahora), /^6 nov, 14:00–15:00$/)
  assert.match(formatTimeRange({ from: new Date(2025, 10, 6, 14), to: new Date(2025, 10, 6, 15) }, true, ahora), /^6 nov 2025, 14:00–15:00$/)
})

test('3 · la hora de un evento: UN formato, en una línea (y sin los segundos, revisión del 6/11/2026)', () => {
  assert.equal(horaDelEvento('2026-11-06T14:20:00Z', false, 'UTC'), '06 nov, 14:20')
  assert.equal(horaDelEvento('2026-11-04T00:00:00Z', true), '04 nov', 'un pago: su día, sin la hora que no tiene (y en UTC, como se guardó)')
  assert.equal(horaDelEvento('2026-11-04T23:30:00Z', true, 'America/Mexico_City'), '04 nov', 'el día de un pago no se corre con la zona')
  assert.equal(horaDelEvento('no es una fecha'), '—')
  // Los dos con la misma forma «DD mes»: lo que tiene hora sólo le suma «, HH:MM».
  const conHora = horaDelEvento('2026-10-20T13:30:45Z', false, 'UTC')
  const soloDia = horaDelEvento('2026-10-12T00:00:00Z', true)
  assert.match(conHora, /^\d{2} [a-z]+, \d{2}:\d{2}$/, 'sin los segundos (aunque el instante los tenga)')
  assert.match(soloDia, /^\d{2} [a-z]+$/)
  assert.doesNotMatch(conHora + soloDia, /-|de /, 'nada de «06-nov» ni «04 de nov de 2026»')
})

test('4 · Analytics › Costs: el nombre de cada función, la plata en centavos y ninguna media fila vacía', () => {
  const nombre = nombresDeFeatures(CATALOGO_MODELOS)
  assert.equal(nombre('mako-doer-in'), 'MaKo en WhatsApp (Hola MaKo)', 'el label de /modelos-ia')
  assert.equal(nombre('plan-fathom'), 'Extraer tareas de una reunión (Fathom)')
  assert.equal(nombre('lead_insights'), 'Insight 360 del lead')
  assert.equal(nombre('una-feature-sin-catalogo'), 'una-feature-sin-catalogo', 'lo que no está en el catálogo, tal cual (no se inventa)')
  assert.deepEqual(COSTOS_EJEMPLO.porFeature.map((f) => f.label), ['MaKo en WhatsApp (Hola MaKo)', 'Extraer tareas de una reunión (Fathom)', 'Análisis de llamadas de venta', 'Insight 360 del lead'])
  assert.ok(COSTOS_EJEMPLO.cambios.every((f) => !/^[a-z_-]+$/.test(f.label)), 'los cambios, con el mismo nombre')
  const sinNombres = armarCostos({ periodo: '2026-11', actual: { ...vacio(), porFeature: [{ clave: 'x-y', llamadas: 1, tokens: 1, costUsd: 1 }] }, previo: null, hoy: new Date(), avisos: [] })
  assert.equal(sinNombres.porFeature[0].label, 'x-y', 'sin el catálogo, la clave')

  const fmt = (c: number, m: string) => formatCurrency('accounting', 'es-AR')(c, m)
  assert.match(plataDeCosto(2.9286, fmt), /^US\$\s?0,03$/, 'Polar decía «US$ 0,029286»: en centavos')
  assert.equal(plataDeCosto(0.4, fmt), `< ${fmt(1, 'usd')}`, 'lo que no llega a un centavo')
  assert.equal(plataDeCosto(5.3333, fmt), fmt(5.3333, 'usd'))
  assert.match(plataDeCosto(5.3333, fmt), /0,05$/, 'dos decimales')
  assert.equal(plataDeCosto(0, fmt), fmt(0, 'usd'), 'el cero es cero, no «< US$ 0,01»')
  assert.equal(plataDeCosto(410, fmt), fmt(410, 'usd'))

  // El reparto de la grilla de MetricGroup: con dos gráficos el segundo estira su fila; con los cinco de Polar, como Polar.
  assert.equal(claseDeAncho(0, 2, true), 'lg:col-span-2')
  assert.equal(claseDeAncho(1, 2, true), 'lg:col-span-2 2xl:col-span-1', 'el acumulado ya no queda solo con media fila vacía')
  assert.equal(claseDeAncho(1, 2, false), '', 'sin pedirlo, la grilla de Polar')
  assert.equal(claseDeAncho(4, 5, true), '', 'con cinco las filas ya están llenas')
  assert.equal(claseDeAncho(2, 3, true), '2xl:col-span-3')
  assert.equal(claseDeAncho(3, 4, true), 'lg:col-span-2 2xl:col-span-2')
  assert.equal(claseDeAncho(0, 1, true), 'lg:col-span-2 2xl:col-span-3')
  assert.match(sinComentarios(leer('app/admin/(polar)/analytics/costs/CostsPage.tsx')), /<MetricGroup[\s\S]*?completarFila[\s\S]*?\/>/, 'Costs lo pide')
})

function vacio() {
  return {
    periodo: '2026-11', desde: null, hasta: null, filas: 0, llamadas: 0, tokens: 0, costUsd: 0,
    porFeature: [], porProveedor: [], porModelo: [], porDia: [], porWorkspace: [], mesesDisponibles: [],
    delNegocio: { llamadas: 0, costUsd: 0 }, delCredito: { llamadas: 0, costUsd: 0 },
  }
}

test('5 · Customer Notifications: los datos del correo con su nombre, y un ejemplo legible', () => {
  const deSiempre = vistaPreviaDelCorreo('', '')
  assert.equal(deSiempre.asunto, 'Tu recibo de MaKo N.º 0012', 'el texto de siempre, con un pago de ejemplo')
  assert.equal(deSiempre.intro, 'Recibimos tu pago de US$ 97 por MaKo Pro, el 1 nov 2026, por Stripe.', 'el pago de noviembre de Estudio Norte de los ejemplos')
  const escrito = vistaPreviaDelCorreo(conDato('Gracias', '{{nombre}}'), conDato('Llegó', '{{monto}}'))
  assert.deepEqual(escrito, { asunto: 'Gracias Estudio Norte', intro: 'Llegó US$ 97' }, 'lo que se escribió, con los datos puestos')
  assert.equal(conDato('', '{{numero}}'), '{{numero}}')
  assert.equal(conDato('Recibo ', '{{numero}}'), 'Recibo {{numero}}', 'no duplica el espacio')
  for (const d of [...DATOS_DEL_ASUNTO, ...DATOS_DE_LA_FRASE]) {
    assert.doesNotMatch(d.rotulo, /[{}]/, 'un rótulo no lleva llaves')
    assert.notEqual(vistaPreviaDelCorreo(d.marca, '').asunto, d.marca, `${d.marca} se reemplaza de verdad`)
  }
  // En la pantalla, ninguna llave a la vista: ni en los rótulos ni en los ejemplos.
  const pantalla = sinComentarios(leer('app/admin/_polar/web/Settings/OrganizationCustomerEmailSettings.tsx'))
  assert.doesNotMatch(pantalla, /\{\{/, 'sin «{{numero}}» en un rótulo o un placeholder')
})

test('6 · Products: la ficha de un plan no dibuja «Beneficios» (Benefits se saca), sí sus descuentos; un archivado, nada', () => {
  const pro = productoDePlan(PLANES_MAKO_DEFAULT.find((p) => p.id === 'pro')!)
  const html = renderToStaticMarkup(createElement(ProductOverview, { product: pro }))
  assert.match(html, /Descuentos/, 'los descuentos, como en Polar')
  assert.doesNotMatch(html, /Beneficios/, 'sin la sección de beneficios')
  for (const b of PLANES_MAKO_DEFAULT.find((p) => p.id === 'pro')!.incluye) assert.ok(!html.includes(b.replace(/&/g, '&amp;')), `«${b}» no se dibuja`)
  assert.equal(renderToStaticMarkup(createElement(ProductOverview, { product: { ...pro, activo: false } })), '', 'un archivado no tiene descuentos (Polar tampoco)')
})

test('7 · Checkout Links: el índice salta después de hidratar, nunca tirando `redirect()` mientras dibuja', () => {
  assert.equal(destinoDelIndice('/admin/products/checkout-links/101', false), '/admin/products/checkout-links/101', 'en la computadora, al primer link')
  assert.equal(destinoDelIndice('/admin/products/checkout-links/101', true), null, 'en el teléfono, la lista')
  const src = sinComentarios(leer('app/admin/_polar/web/CheckoutLinks/MasterDetailIndex.tsx'))
  assert.doesNotMatch(src, /\bredirect\(/, 'un redirect en el render tira durante la hidratación y React vuelve a dibujar el árbol (con los <script> del layout)')
  assert.match(src, /useEffect\(/)
  // Las ayudas del formulario, de UN tamaño (el `text-xs` de Polar).
  const form = leer('app/admin/_polar/web/CheckoutLinks/CheckoutLinkForm.tsx')
  const ayudas = [...form.matchAll(/<FormDescription([^>]*)>/g)].map((m) => m[1])
  assert.ok(ayudas.length >= 4)
  for (const a of ayudas) assert.match(a, /className="text-xs"/, 'cada ayuda en text-xs')
})

test('8 · el detalle de un pedido: la cuenta por su negocio, y lo que cambió un mes en un renglón', () => {
  const ctx = sinComentarios(leer('app/admin/_polar/web/Orders/OrderCustomerContext.tsx'))
  assert.doesNotMatch(ctx, /Workspace \$\{/, 'nada de «Workspace 41»')
  // Revisión del 6/11/2026: UN link a su ficha («Ver el cliente», el «View Customer» de Polar), no dos; y sin «Entrar» (está en la ficha).
  assert.equal(ctx.match(/<Link\b/g)?.length, 1, 'un solo link en la tarjeta del cliente')
  assert.match(ctx, /<Link href=\{ruta\}/, 'el de «Ver el cliente» (`rutaDelCliente`)')
  assert.doesNotMatch(ctx, /\/inicio\?ws=|Abrir su MaKo/, 'sin «Entrar: Abrir su MaKo»')
  assert.match(ctx, /<DetailRow label="Nombre" value=\{customer\.nombre/, 'su nombre, como el «Name» de Polar')
  assert.equal(rutaDelCliente({ clave: 'ws:42', nombre: 'Estudio Norte', ws: 42, leadId: 7, email: null }, 9), '/admin/customers/42')
  assert.match(textoDelCambio({ cambio: 'subio', antesUsd: 238, esperadoUsd: 426 }), /^Subió \(de US\$\s?238\)$/)
  assert.equal(textoDelCambio({ cambio: null, antesUsd: null, esperadoUsd: 100 }), '')
  assert.match(textoDelCambio({ cambio: 'empezo', antesUsd: null, esperadoUsd: 146 }), /^Empezó$/)
})

test('9 · los ejemplos: «Estudio Norte» es el ws 42 en todos, y el Pro cuesta lo de PLANES_MAKO_DEFAULT', () => {
  assert.equal(WS_EJEMPLO, 42)
  const wsDeNorte = new Set<number | null>()
  for (const p of PEDIDOS_EJEMPLO) if (p.cliente?.nombre === 'Estudio Norte') wsDeNorte.add(p.cliente.ws)
  for (const s of SUSCRIPCIONES_EJEMPLO) if (s.cliente.nombre === 'Estudio Norte') wsDeNorte.add(s.cliente.ws)
  for (const c of COBROS_VENTAS) if (c.altaWsNombre === 'Estudio Norte') wsDeNorte.add(c.altaWs)
  for (const c of COBROS_PRODUCTOS) if (c.alta_ws_nombre === 'Estudio Norte') wsDeNorte.add(c.alta_ws)
  for (const c of INGRESOS_EJEMPLO.clientes) if (c.nombre === 'Estudio Norte') wsDeNorte.add(c.ws)
  for (const e of EVENTOS_EJEMPLO.eventos) for (const n of e.negocios) if (n.nombre === 'Estudio Norte') wsDeNorte.add(n.ws)
  assert.deepEqual([...wsDeNorte], [42], 'el mismo número en Sales, Products y Analytics')

  const pro = PLANES_MAKO_DEFAULT.find((p) => p.id === 'pro')!.precioUsd
  const esencial = PLANES_MAKO_DEFAULT.find((p) => p.id === 'esencial')!.precioUsd
  const anual = (id: string) => PLANES_MAKO_DEFAULT.find((p) => p.id === id)!.precioAnualUsd
  const precio = (plan: string | null | undefined) =>
    /MaKo Pro/.test(plan ?? '') ? (/un año/.test(plan ?? '') ? anual('pro') : pro) : /MaKo Esencial/.test(plan ?? '') ? (/un año/.test(plan ?? '') ? anual('esencial') : esencial) : null
  for (const p of PEDIDOS_EJEMPLO) if (precio(p.concepto) != null) assert.equal(p.usd, precio(p.concepto), `${p.id}: ${p.concepto}`)
  for (const c of COBROS_VENTAS) if (precio(c.plan) != null && c.moneda === 'USD') assert.equal(c.montoUsd, precio(c.plan), `cobro ${c.id}: ${c.plan}`)
  for (const c of CHECKOUTS_EJEMPLO) if (precio(c.producto) != null) assert.equal(c.montoUsd, precio(c.producto), `checkout ${c.id}`)
  for (const s of SUSCRIPCIONES_EJEMPLO) if (precio(s.producto) != null) assert.equal(s.mensualidadUsd, precio(s.producto), `suscripción ${s.id}`)
})
