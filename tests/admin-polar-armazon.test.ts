// =============================================================================
// Admin (la copia de Polar): el armazón — la carga, la búsqueda ⌘K, la URL sin ir al server y las señales de copiar
// =============================================================================
// Los puntos 23, 24 (copiar), 31 y 32 de docs/admin/revision-cerebro-6-11.md, EJECUTADOS:
//   23. el índice de ⌘K viaja con `error` y no se cambia por listas vacías (y la plataforma no entra cuando su lectura falla);
//       ⌘K dice «No pude leer los negocios», nunca «No hay resultados»;
//   24. «Copiado» sólo cuando el portapapeles dijo que sí, y «No pude copiar» cuando no (CopyToClipboardInput y `useCopiar`);
//   31. Admin tiene loading.tsx, así que las páginas que redirigen lo hacen en el layout ANTES del loader: `redireccionDeLaCarga`
//       (app/admin/(polar)/layout-reglas.ts) decide ruta por ruta lo mismo que cada página, y el layout
//       (app/admin/(polar)/layout.tsx) lo aplica sólo en la carga del documento. La barra ya no precarga todo;
//   32. un filtro, un orden, una página o el rango de la ficha cambian la URL con history.replaceState (`cambiarQuery`), sin
//       `router.replace`: las filas ya están en el navegador.
//
// ⚠️ CORRE EN UN DOM (jsdom, que viene en node_modules sin sus tipos; como tests/bloques-venta-landing.test.ts): los hooks y los
//    componentes se MONTAN con react-dom y se tocan. Toca globales (window, document, navigator): va en su proceso solo.
//
// Correr: node --import tsx --test tests/admin-polar-armazon.test.ts
// PROBADO ROMPIÉNDOLO: ver la tabla del pie.
// =============================================================================

import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = fileURLToPath(new URL('..', import.meta.url))
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n')
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

// ─── El DOM, ANTES de cargar react-dom (decide al cargarse si hay DOM) ──────

type Ventana = Window & typeof globalThis
const { JSDOM } = createRequire(import.meta.url)('jsdom') as {
  JSDOM: new (html: string, o: { url: string; pretendToBeVisual?: boolean }) => { window: Ventana }
}
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://hola-mako.com/admin/sales?status=paid&page=3', pretendToBeVisual: true })
const g = globalThis as unknown as Record<string, unknown>
for (const k of ['window', 'self', 'document', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'Node', 'Element', 'MouseEvent', 'KeyboardEvent', 'PointerEvent', 'FocusEvent', 'CustomEvent', 'Event', 'MutationObserver', 'DOMRect', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame']) {
  g[k] = (dom.window as unknown as Record<string, unknown>)[k]
}
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true, writable: true })
g.IS_REACT_ACT_ENVIRONMENT = true
// Los menús de Radix miden su ancla con ResizeObserver, que jsdom no trae: uno que no mide nada alcanza para abrirlos.
g.ResizeObserver = (dom.window as unknown as Record<string, unknown>).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }

/** El portapapeles de mentira: `ok` decide si `writeText` cumple o rechaza, y anota lo que se le pidió. */
function portapapeles(ok: boolean) {
  const pedidos: string[] = []
  const p = { writeText: (t: string) => { pedidos.push(t); return ok ? Promise.resolve() : Promise.reject(new Error('NotAllowedError')) } }
  Object.defineProperty(dom.window.navigator, 'clipboard', { value: p, configurable: true })
  return pedidos
}

async function montar(el: unknown) {
  const React = await import('react')
  const { createRoot } = await import('react-dom/client')
  const cont = dom.window.document.createElement('div')
  dom.window.document.body.appendChild(cont)
  const root = createRoot(cont)
  await React.act(async () => { root.render(el as never) })
  return { cont, desmontar: () => React.act(async () => root.unmount()) }
}

async function clic(el: Element) {
  const React = await import('react')
  await React.act(async () => {
    el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    await new Promise((r) => setTimeout(r, 0))
  })
}

// ─── 23. El índice de ⌘K ────────────────────────────────────────────────────

const WS = [
  { id: 9, nombre: 'MaKo', capa: 'superadmin', estado: 'activo' },
  { id: 21, nombre: 'Estudio Norte', capa: 'completo', estado: 'activo' },
  { id: 22, nombre: 'Taller Sur', capa: 'completo', estado: 'pausado' },
]
const USUARIOS = [
  { id: 1, nombre: 'Ana Ruiz', email: 'ana@ejemplo.com', workspace_id: 21 },
  { id: 2, nombre: 'Equipo MaKo', email: 'equipo@ejemplo.com', workspace_id: 9 },
]

test('23 · el índice: se arma sin el negocio de la plataforma, y si falla una lectura de QUIÉN entra viaja vacío y con su error', async () => {
  const { leerIndice, buscar } = await import('../app/admin/_polar/datos/busqueda-tipos')
  const plan = (c: string) => (c === 'completo' ? 'MaKo Esencial' : c)
  const lecturas = {
    workspaces: async () => WS, usuarios: async () => USUARIOS, plataforma: async () => 9, deAgencia: async () => new Map<number, number>(),
  }
  const ok = await leerIndice(lecturas, plan)
  assert.equal(ok.error, null)
  assert.deepEqual(ok.negocios.map((n) => n.ws), [21, 22], 'la plataforma no entra')
  // Sus personas SÍ entran desde el punto 25: llevan a Settings › Members, no a la ficha de un negocio.
  assert.deepEqual(ok.personas.map((p) => [p.id, p.ws]), [[1, 21], [2, null]], 'el equipo de MaKo, sin negocio (lleva a Settings › Members)')
  assert.deepEqual(buscar(ok, 'norte').negocios.map((n) => n.ws), [21])
  // La plataforma no se adivina: con su lectura caída, antes entraba como un cliente (y llevaba a una ficha 404).
  const sinPlataforma = await leerIndice({ ...lecturas, plataforma: async () => { throw new Error('workspaces: timeout') } }, plan)
  assert.deepEqual(sinPlataforma, { negocios: [], personas: [], error: 'workspaces: timeout' })
  for (const caida of ['workspaces', 'usuarios'] as const) {
    const r = await leerIndice({ ...lecturas, [caida]: async () => { throw new Error(`${caida}: no contestó`) } }, plan)
    assert.equal(r.error, `${caida}: no contestó`, `${caida} caída: el índice lo dice`)
    assert.equal(r.negocios.length + r.personas.length, 0)
  }
  // Las carteras sólo agregan «De <agencia>»: si fallan, el índice sale entero y sin error.
  const sinCarteras = await leerIndice({ ...lecturas, deAgencia: async () => { throw new Error('carteras') } }, plan)
  assert.equal(sinCarteras.error, null)
  assert.equal(sinCarteras.negocios.length, 2)
})

test('23 · ⌘K con el índice caído dice «No pude leer los negocios» (con Reportar a Soporte), nunca «No hay resultados»', async () => {
  const React = await import('react')
  const { AvisoDelIndice, textoSinResultados } = await import('../app/admin/_polar/web/Search/OmniSearch')
  const { TITULO_SIN_INDICE, indiceSinLeer } = await import('../app/admin/_polar/datos/busqueda-tipos')
  const caido = indiceSinLeer(new Error('usuarios: timeout'))
  const { cont, desmontar } = await montar(React.createElement(AvisoDelIndice, { indice: caido }))
  assert.match(cont.textContent ?? '', new RegExp(TITULO_SIN_INDICE))
  assert.match(cont.textContent ?? '', /usuarios: timeout/)
  assert.match(cont.textContent ?? '', /Reportar a Soporte/)
  await desmontar()
  const sano = await montar(React.createElement(AvisoDelIndice, { indice: { error: null } }))
  assert.equal(sano.cont.textContent, '', 'sin error no hay aviso')
  await sano.desmontar()
  assert.equal(textoSinResultados('norte', caido), null, 'con el índice caído no se dice «no hay resultados»')
  assert.equal(textoSinResultados(' norte ', { error: null }), 'No hay resultados para «norte»')
  // Y nadie vuelve a tapar el error con listas vacías: el layout y la portada usan el índice tal cual.
  for (const f of ['app/admin/(polar)/layout.tsx', 'app/admin/(polar)/page.tsx']) {
    assert.doesNotMatch(sinComentarios(leer(f)), /indiceDeBusqueda\(\)\.catch/, `${f} vuelve a cambiar el error por listas vacías`)
  }
})

// ─── 24. Copiar ─────────────────────────────────────────────────────────────

test('24 · copiarTexto contesta lo que dijo el portapapeles, y sin portapapeles es un fallo', async () => {
  const { copiarTexto, rotuloDeCopia } = await import('../app/admin/_polar/atoms/CopyToClipboardInput')
  assert.equal(await copiarTexto('x', { writeText: () => Promise.resolve() }), 'copiado')
  assert.equal(await copiarTexto('x', { writeText: () => Promise.reject(new Error('NotAllowedError')) }), 'fallo')
  assert.equal(await copiarTexto('x', null), 'fallo', 'un navegador sin la API no copia: no es un éxito callado')
  assert.equal(rotuloDeCopia(null, 'Copiar el ID del plan'), 'Copiar el ID del plan')
  assert.equal(rotuloDeCopia('copiado', 'Copiar el ID del plan'), 'Copiado')
  assert.equal(rotuloDeCopia('fallo', 'Copiar el ID del plan'), 'No pude copiar')
})

test('24 · el campo del link de pago marca «Copiado» SÓLO si se copió, y «No pude copiar» si no', async () => {
  const React = await import('react')
  const { default: CopyToClipboardInput } = await import('../app/admin/_polar/atoms/CopyToClipboardInput')
  let avisos = 0
  // Falla: sin tilde, con el rótulo de la falla, y sin avisar «se copió».
  const pedidos = portapapeles(false)
  const malo = await montar(React.createElement(CopyToClipboardInput, { value: 'https://hola-mako.com/pagar/t1', onCopy: () => avisos++ }))
  await clic(malo.cont.querySelector('button') as Element)
  assert.deepEqual(pedidos, ['https://hola-mako.com/pagar/t1'])
  assert.match(malo.cont.querySelector('button')?.textContent ?? '', /No pude copiar/)
  assert.equal(malo.cont.querySelector('button svg'), null, 'el tilde no sale si el portapapeles dijo que no')
  assert.equal(avisos, 0)
  await malo.desmontar()
  // Cumple: el tilde, y `onCopy`.
  portapapeles(true)
  const bueno = await montar(React.createElement(CopyToClipboardInput, { value: 'https://hola-mako.com/pagar/t2', onCopy: () => avisos++ }))
  assert.match(bueno.cont.querySelector('button')?.textContent ?? '', /Copiar/)
  await clic(bueno.cont.querySelector('button') as Element)
  assert.ok(bueno.cont.querySelector('button svg'), 'con el portapapeles al día, el tilde')
  assert.match(bueno.cont.textContent ?? '', /Copiado/, 'el lector de pantalla oye «Copiado»')
  assert.equal(avisos, 1)
  await bueno.desmontar()
})

test('24 · `useCopiar` (los menús del plan y la barra de links): el estado sale de la respuesta del portapapeles', async () => {
  const React = await import('react')
  const { useCopiar, rotuloDeCopia } = await import('../app/admin/_polar/atoms/CopyToClipboardInput')
  // El mismo uso que ProductListItem y ProductPage: un botón cuyo rótulo es `rotuloDeCopia(estado, …)`.
  function Fila() {
    const [estado, copiar] = useCopiar()
    return React.createElement('button', { onClick: () => void copiar('pro') }, rotuloDeCopia(estado, 'Copiar el ID del plan'))
  }
  for (const [ok, rotulo] of [[false, 'No pude copiar'], [true, 'Copiado']] as const) {
    const pedidos = portapapeles(ok)
    const m = await montar(React.createElement(Fila))
    await clic(m.cont.querySelector('button') as Element)
    assert.deepEqual(pedidos, ['pro'])
    assert.equal(m.cont.textContent, rotulo)
    await m.desmontar()
  }
  // Los tres lugares usan la señal (y nadie vuelve a tragarse el error del portapapeles).
  for (const f of ['app/admin/_polar/web/Products/ProductListItem.tsx', 'app/admin/_polar/web/Products/ProductPage/ProductPage.tsx', 'app/admin/_polar/web/CheckoutLinks/CheckoutLinkListSidebar.tsx']) {
    const src = sinComentarios(leer(f))
    assert.match(src, /useCopiar\(\)|copiarTexto\(/, `${f} no usa la señal de copiar`)
    assert.doesNotMatch(src, /navigator\.clipboard/, `${f} vuelve a copiar por su cuenta`)
  }
})

// ─── 21 y 24 en los componentes de Products: «Vender» y la señal de «Copiar el ID» ─

/** Abre el menú de un botón (Radix lo abre con Enter) y devuelve sus filas. */
async function abrirMenu(boton: Element) {
  const React = await import('react')
  await React.act(async () => {
    boton.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await new Promise((r) => setTimeout(r, 10))
  })
  return () => [...dom.window.document.querySelectorAll('[role="menuitem"]')] as HTMLElement[]
}
const fila = (filas: () => HTMLElement[], texto: RegExp) => filas().find((e) => texto.test(e.textContent ?? '')) as HTMLElement

test('21 y 24 · la ficha de un plan: «Vender» abre el formulario nuevo con el plan, y «Copiar el ID» dice si se copió', async () => {
  const React = await import('react')
  const { ProductPage } = await import('../app/admin/_polar/web/Products/ProductPage/ProductPage')
  const { PRODUCTOS_EJEMPLO } = await import('../app/admin/_polar/datos/ejemplo/productos')
  const { rutaParaVender } = await import('../app/admin/_polar/datos/productos')
  const pro = PRODUCTOS_EJEMPLO.find((p) => p.id === 'pro')
  assert.ok(pro)
  for (const [ok, rotulo] of [[false, 'No pude copiar'], [true, 'Copiado']] as const) {
    const pedidos = portapapeles(ok)
    const m = await conRouter(React.createElement(ProductPage, { product: pro }), '', '/admin/products/pro')
    // Debajo del precio, el enlace a donde viven los precios en Mercado Pago.
    assert.equal(m.cont.querySelector('a[href="/admin/settings/payments"]')?.textContent, 'Precios en Mercado Pago: Settings › Payments')
    const filas = await abrirMenu(m.cont.querySelector('button[aria-label="Más opciones"]') as Element)
    assert.deepEqual(filas().map((e) => e.textContent), ['Vender', 'Copiar el ID del plan'])
    await clic(fila(filas, /Copiar/))
    assert.deepEqual(pedidos, ['pro'])
    assert.equal(fila(filas, new RegExp(rotulo))?.textContent, rotulo, 'el menú queda abierto y dice lo que pasó')
    await clic(fila(filas, /Vender/))
    assert.deepEqual(m.llamadas, [`push ${rutaParaVender('pro')}`])
    await m.desmontar()
  }
})

test('21 y 24 · la fila del catálogo: «Vender» (el botón y el menú, que se ve en una pantalla chica) y «Copiar el ID» con su señal', async () => {
  const React = await import('react')
  const { ProductListItem } = await import('../app/admin/_polar/web/Products/ProductListItem')
  const { PRODUCTOS_EJEMPLO } = await import('../app/admin/_polar/datos/ejemplo/productos')
  const { rutaParaVender } = await import('../app/admin/_polar/datos/productos')
  const esencial = PRODUCTOS_EJEMPLO.find((p) => p.id === 'esencial')
  assert.ok(esencial)
  const pedidos = portapapeles(false)
  const m = await conRouter(React.createElement(ProductListItem, { product: esencial }), '', '/admin/products')
  const boton = [...m.cont.querySelectorAll('button')].find((b) => b.textContent === 'Vender')
  assert.ok(boton, 'el botón dice «Vender», no «Compartir»')
  await clic(boton)
  const filas = await abrirMenu(m.cont.querySelector('button[aria-label="Más opciones de MaKo Esencial"]') as Element)
  assert.deepEqual(filas().map((e) => e.textContent), ['Vender', 'Copiar el ID del plan'])
  await clic(fila(filas, /Vender/))
  // El botón y la fila del menú van al mismo lugar, y ninguno abre la ficha del plan (la fila entera es un link).
  assert.deepEqual(m.llamadas, [`push ${rutaParaVender('esencial')}`, `push ${rutaParaVender('esencial')}`])
  const filas2 = await abrirMenu(m.cont.querySelector('button[aria-label="Más opciones de MaKo Esencial"]') as Element)
  await clic(fila(filas2, /Copiar/))
  assert.deepEqual(pedidos, ['esencial'])
  assert.ok(fila(filas2, /No pude copiar/), 'si el portapapeles dijo que no, la fila lo dice')
  await m.desmontar()
})

// ─── 32. La URL sin ir al server ────────────────────────────────────────────

async function conRouter(hijo: unknown, search: string, pathname: string) {
  const React = await import('react')
  const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime')
  const { SearchParamsContext, PathnameContext } = await import('next/dist/shared/lib/hooks-client-context.shared-runtime')
  const llamadas: string[] = []
  const anotar = (m: string) => (...a: unknown[]) => { llamadas.push(`${m} ${String(a[0] ?? '')}`) }
  const router = { push: anotar('push'), replace: anotar('replace'), refresh: anotar('refresh'), prefetch: anotar('prefetch'), back: anotar('back'), forward: anotar('forward'), hmrRefresh: anotar('hmrRefresh') }
  dom.window.history.replaceState(null, '', `${pathname}${search}`)
  const el = React.createElement(
    AppRouterContext.Provider, { value: router as never },
    React.createElement(SearchParamsContext.Provider, { value: new URLSearchParams(search) },
      React.createElement(PathnameContext.Provider, { value: pathname }, hijo as never)),
  )
  const m = await montar(el)
  return { ...m, llamadas }
}

test('32 · Sales: un filtro, un orden o una página cambian la URL con replaceState y NO llaman al router', async () => {
  const React = await import('react')
  const { useDataTableQueryState } = await import('../app/admin/_polar/web/Orders/useDataTableQueryState')
  let estado: ReturnType<typeof useDataTableQueryState> | null = null
  function Tabla() {
    estado = useDataTableQueryState({ defaultPageSize: 20 })
    return null
  }
  const m = await conRouter(React.createElement(Tabla), '?status=paid&page=3', '/admin/sales')
  const s = estado as unknown as ReturnType<typeof useDataTableQueryState>
  s.setParams({ status: 'refunded', page: null })
  assert.equal(dom.window.location.search, '?status=refunded')
  s.setPagination({ pageIndex: 1, pageSize: 50 })
  assert.equal(dom.window.location.search, '?status=refunded&page=2&limit=50')
  s.setSorting([{ id: 'amount', desc: true }])
  assert.equal(dom.window.location.search, '?status=refunded&limit=50&sorting=-amount', 'el orden vuelve a la página 1')
  assert.equal(dom.window.location.pathname, '/admin/sales')
  assert.deepEqual(m.llamadas, [], 'nada va al server: las filas ya están en el navegador')
  await m.desmontar()
})

test('32 · el rango de la ficha cambia la URL sin releer la ficha', async () => {
  const React = await import('react')
  const { useCustomerMetricsParams } = await import('../app/admin/_polar/web/Customer/CustomerPage/useCustomerMetricsParams')
  let rango: ReturnType<typeof useCustomerMetricsParams> | null = null
  function Ficha() {
    rango = useCustomerMetricsParams('2026-01-15T10:00:00Z')
    return null
  }
  const m = await conRouter(React.createElement(Ficha), '?ws=9', '/admin/customers/21')
  ;(rango as unknown as ReturnType<typeof useCustomerMetricsParams>).setRange(new Date(2026, 9, 1), new Date(2026, 9, 31), 'week')
  const q = new URLSearchParams(dom.window.location.search)
  assert.equal(q.get('startDate'), '2026-10-01')
  assert.equal(q.get('endDate'), '2026-10-31')
  assert.equal(q.get('interval'), 'week')
  assert.equal(q.get('ws'), '9', 'lo demás de la URL queda')
  assert.equal(dom.window.location.pathname, '/admin/customers/21')
  assert.deepEqual(m.llamadas, [], 'el rango se recorta en el navegador: no va al server')
  await m.desmontar()
})

test('32 · la barra de Checkout Links ordena y limpia `create_checkout_link` sin ir al server', () => {
  // La barra no se puede montar acá (su formulario importa las server actions de los cobros): se fija que use `cambiarQuery`,
  // que es lo que ejecutan los dos tests de arriba.
  const src = sinComentarios(leer('app/admin/_polar/web/CheckoutLinks/CheckoutLinkListSidebar.tsx'))
  assert.match(src, /const setSorting = \(v: 'label' \| '-label'\) => cambiarQuery\(\{ sorting: v === 'label' \? null : v \}\)/)
  assert.match(src, /showCreateCheckoutLinkModal\(\)\n\s*cambiarQuery\(\{ create_checkout_link: null \}\)/)
  assert.doesNotMatch(src, /router\.replace\(/)
})

// ─── 31. La carga: el layout redirige antes del loader ──────────────────────

test('31 · `redireccionDeLaCarga` decide en cada ruta lo mismo que su página', async () => {
  const { redireccionDeLaCarga, correccionDeMetricas } = await import('../app/admin/(polar)/layout-reglas')
  const { tiposDeUrl } = await import('../app/admin/_polar/datos/eventos')
  const ir = (destino: string, reemplazar: boolean, conWs?: boolean) => ({ tipo: 'ir', destino, reemplazar, ...(conWs ? { conWs } : {}) })
  // Overview: los links viejos.
  assert.deepEqual(redireccionDeLaCarga('/admin', { tab: 'billing' }), ir('/admin/sales', false))
  assert.deepEqual(redireccionDeLaCarga('/admin', { tab: 'customers', cliente: '21' }), ir('/admin/customers/21', false))
  assert.equal(redireccionDeLaCarga('/admin', {}), null, 'la portada sin link viejo se dibuja')
  assert.equal(redireccionDeLaCarga('/admin', { tab: 'cualquiera' }), null)
  // Finance y Analytics: siempre.
  assert.deepEqual(redireccionDeLaCarga('/admin/finance', {}), ir('/admin/finance/income', false, true))
  assert.equal(redireccionDeLaCarga('/admin/finance/income', {}), null)
  assert.deepEqual(redireccionDeLaCarga('/admin/analytics', { start_date: '2026-01-01', x: ['1', '2'] }), ir('/admin/analytics/metrics?start_date=2026-01-01&x=1&x=2', true))
  assert.deepEqual(redireccionDeLaCarga('/admin/analytics', {}), ir('/admin/analytics/metrics', true))
  // Events: el `?tipo=` de antes, desde siempre; sin él, nada.
  assert.deepEqual(redireccionDeLaCarga('/admin/analytics/events', { tipo: 'agente', customerIds: '21' }), ir('/admin/analytics/events?customerIds=21&eventTypes=agente&range=allTime', true))
  const errores = encodeURIComponent((tiposDeUrl('error') ?? []).join(','))
  assert.ok(errores, 'el alias «error» existe')
  assert.deepEqual(redireccionDeLaCarga('/admin/analytics/events', { tipo: 'error', range: 'today' }), ir(`/admin/analytics/events?range=today&eventTypes=${errores}`, true), 'con su rango, no se le pone «desde siempre»')
  assert.deepEqual(redireccionDeLaCarga('/admin/analytics/events', { tipo: 'nada' }), ir('/admin/analytics/events', true), 'un tipo que no existe se saca igual')
  assert.equal(redireccionDeLaCarga('/admin/analytics/events', { range: 'today' }), null)
  // Costs: un `?mes=` que no es un mes.
  assert.deepEqual(redireccionDeLaCarga('/admin/analytics/costs', { mes: '2026-13' }), ir('/admin/analytics/costs', true))
  assert.equal(redireccionDeLaCarga('/admin/analytics/costs', { mes: '2026-10' }), null)
  assert.equal(redireccionDeLaCarga('/admin/analytics/costs', {}), null)
  // Metrics: lo seguro sin leer; con un inicio, pide el primer mes; un inicio válido sin nada más se deja a la página.
  assert.deepEqual(redireccionDeLaCarga('/admin/analytics/metrics', { interval: 'month', end_date: '2026-10-31' }), ir('/admin/analytics/metrics?end_date=2026-10-31', true))
  assert.deepEqual(redireccionDeLaCarga('/admin/analytics/metrics', { end_date: 'ayer' }), ir('/admin/analytics/metrics', true))
  assert.deepEqual(redireccionDeLaCarga('/admin/analytics/metrics', { start_date: 'ayer' }), { tipo: 'metricas' })
  assert.deepEqual(redireccionDeLaCarga('/admin/analytics/metrics', { start_date: '2026-01-01', product_id: 'pro' }), { tipo: 'metricas' })
  assert.equal(redireccionDeLaCarga('/admin/analytics/metrics', { start_date: '2026-01-01', end_date: '2026-10-31' }), null)
  assert.equal(correccionDeMetricas({ start_date: 'ayer', end_date: '2026-10-31' }, '2025-11-01'), '/admin/analytics/metrics?start_date=2025-11-01&end_date=2026-10-31')
  assert.equal(correccionDeMetricas({ start_date: '2020-01-01' }, '2025-11-01'), '/admin/analytics/metrics?start_date=2025-11-01', 'con el primer mes, un inicio anterior se corrige como en la página')
  assert.equal(correccionDeMetricas({ start_date: '2026-01-01' }, '2025-11-01'), null)
  // La vieja Events de la ficha, y un checkout que puede ser un link de «Vender un plan».
  assert.deepEqual(redireccionDeLaCarga('/admin/customers/21/events', {}), { tipo: 'eventos-del-negocio', ws: 21 })
  assert.equal(redireccionDeLaCarga('/admin/customers/abc/events', {}), null, 'un id que no es un negocio: la página da 404')
  assert.equal(redireccionDeLaCarga('/admin/customers/21', {}), null)
  assert.deepEqual(redireccionDeLaCarga('/admin/sales/checkouts/104', {}), { tipo: 'link-de-venta', id: 104 })
  assert.equal(redireccionDeLaCarga('/admin/sales/checkouts/0', {}), null)
  assert.equal(redireccionDeLaCarga('/admin/sales/checkouts', {}), null)
  // Un pago devuelto (punto 3): su `p-` lleva al `c-` del cobro, y sólo un `p-` con número.
  assert.deepEqual(redireccionDeLaCarga('/admin/sales/p-961', {}), { tipo: 'pago-devuelto', pago: 961 })
  assert.equal(redireccionDeLaCarga('/admin/sales/c-961', {}), null, 'un cobro se dibuja')
  assert.equal(redireccionDeLaCarga('/admin/sales/p-0', {}), null)
  assert.equal(redireccionDeLaCarga('/admin/sales/p-961/x', {}), null)
  // Lo demás no es de este layout, y sin la ruta del proxy no se adivina.
  for (const r of ['/admin/sales', '/admin/products/checkout-links', '/admin/settings/payments', '/admin/customers']) assert.equal(redireccionDeLaCarga(r, {}), null, r)
  assert.equal(redireccionDeLaCarga(null, { tab: 'billing' }), null)
})

test('31 · el layout de Admin redirige SÓLO en la carga, antes de leer el índice, y la barra ya no precarga todo', () => {
  const lay = sinComentarios(leer('app/admin/(polar)/layout.tsx'))
  // Lo que pide tests/redirige-antes-del-loader.test.ts (DECIDEN_POR_RUTA) y tests/redirige-navegando.test.ts: un layout que
  // redirige debajo de sí mismo pregunta si es una navegación (el redirect quedaría guardado en su nodo).
  assert.match(lay, /if \(await esNavegacionDelCliente\(\)\) return null\n\s*const \{ ruta, query \} = await pedidoActual\(\)\n\s*const r = redireccionDeLaCarga\(ruta, query\)/)
  assert.match(lay, /await exigirSuperAdmin\(\)\n\s*const salto = await destinoDeLaCarga\(\)\n\s*if \(salto\) redirect\(/, 'la puerta primero, el salto antes de leer el índice')
  assert.ok(lay.indexOf('redirect(') < lay.indexOf('await indiceDeBusqueda()'))
  // La barra (NavList): sin `prefetch={true}`, se precarga sólo hasta el loading.tsx.
  assert.doesNotMatch(sinComentarios(leer('app/admin/_polar/web/Layout/Dashboard/NavList.tsx')), /prefetch=\{true\}/)
})

// PROBADO ROMPIÉNDOLO (6/11/2026; el arnés restaura de memoria). Base: 12 pass / 0 fail. Cada rotura, sola:
//   · un cambio sin efecto (renombrar la función local `uno` de layout-reglas.ts)                     → 12/0
//   · 31 (sumado al integrar la plata): `redireccionDeLaCarga` sin la regla del pago devuelto (`p-` → `c-`) → 11/1 (31, las rutas)
//   · 23: `leerIndice` adivina la plataforma (`leer.plataforma().catch(() => null)`)                  → 11/1 (el índice)
//   · 23: `leerIndice` sin su catch (el error sube)                                                    → 11/1 (el índice)
//   · 23: ⌘K dice «No hay resultados» con el índice caído                                             → 11/1 (⌘K)
//   · 23: el aviso de ⌘K sin «No pude leer los negocios»                                               → 11/1 (⌘K)
//   · 23: el layout vuelve a cambiar el error por listas vacías (`.catch(…)`)                         → 11/1 (⌘K)
//   · 24: `copiarTexto` no espera a `writeText` (el «Copiado» antes del `.then`)                       → 7/5 (los tres de copiar y los dos de Products)
//   · 24: CopyToClipboardInput avisa `onCopy` aunque no se copió                                       → 11/1 (el campo del link)
//   · 24: la ficha del plan cierra el menú al copiar (sin `onSelect` que lo deje abierto)              → 11/1 (la ficha)
//   · 24: la fila del catálogo vuelve a «Copiar el ID» sin señal                                       → 11/1 (la fila)
//   · 21: el botón de la fila vuelve a «Compartir» al primer link                                      → 11/1 (la fila)
//   · 21: la ficha sin «Vender» en el menú                                                             → 10/2 (la ficha y la fila)
//   · 32: Sales vuelve a `router.replace`                                                              → 11/1 (Sales)
//   · 32: el rango de la ficha vuelve a `router.replace`                                               → 11/1 (la ficha)
//   · 32: la barra de links ordena con `router.replace`                                                → 11/1 (Checkout Links)
//   · 31: Finance sin `rutaConWs` · Events se queda con el `?tipo=` · Metrics sin el `'leer'`          → 11/1 cada una (las rutas)
//   · 31: el layout redirige también navegando (sin `esNavegacionDelCliente`)                          → 11/1 (el layout)
//   · 31: NavList vuelve a `prefetch={true}`                                                           → 11/1 (el layout)
