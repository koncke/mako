// =============================================================================
// Admin: Ctrl K / ⌘K abre la búsqueda de Polar (OmniSearch) y NO la de la barra de MaKo (revisión del 6/11/2026), con el DOM
// =============================================================================
// En /admin hay dos buscadores con el mismo atajo: el de la barra de MaKo (app/_components/BuscadorNav.tsx, en `window`) y el de
// Polar (app/admin/_polar/web/Layout/Dashboard/DashboardSidebar.tsx, en `document`, que corre antes y marca el evento con
// preventDefault; BuscadorNav lo respeta). Polar comparaba `e.key === 'k'`: con Bloq Mayús o Shift llega «K», Polar no lo
// tomaba y abría la de MaKo. Acá se montan LOS DOS componentes de verdad (jsdom + react-dom) y se aprieta el atajo.
// La pista «Ctrl K» de la barra de MaKo se esconde en Admin por CSS (polar.css): tests/admin-polar-arreglos-4.test.ts, el 9.
//
// ⚠️ Toca globales (window, document, self…): corre en su proceso (scripts/tests-afectados.mjs, PELIGRO_COMPARTIR).
//
// Correr: node --import tsx --test tests/admin-polar-atajo-k.test.ts
//
// PROBADO ROMPIÉNDOLO (6/11/2026): base 1/0. DashboardSidebar otra vez con `e.key === 'k'` → 0/1 («K» abría la de MaKo);
// sin el `e.preventDefault()` de DashboardSidebar → 0/1 (se abrían las dos).
// =============================================================================

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

// jsdom viene en node_modules (lo trae otra dependencia) sin sus tipos: se carga con su forma mínima, como en
// tests/bloques-venta-landing.test.ts, para que el tsc entero no pida @types/jsdom.
const { JSDOM } = createRequire(import.meta.url)('jsdom') as {
  JSDOM: new (html: string, o: { url: string }) => { window: Window & typeof globalThis & { close(): void } }
}

test('Ctrl K y Ctrl Shift K en Admin abren la búsqueda de Polar, y la de la barra de MaKo no', async () => {
  const dom = new JSDOM('<!doctype html><html><body><div id="r"></div></body></html>', { url: 'http://localhost/admin' })
  const w = dom.window
  const antes = { window: globalThis.window, document: globalThis.document, self: globalThis.self, navigator: globalThis.navigator }
  globalThis.window = w
  globalThis.document = w.document
  globalThis.self = w
  Object.defineProperty(globalThis, 'navigator', { value: w.navigator, configurable: true })
  globalThis.HTMLElement = w.HTMLElement
  globalThis.Node = w.Node
  globalThis.getComputedStyle = w.getComputedStyle.bind(w)
  globalThis.requestAnimationFrame = ((f: FrameRequestCallback) => setTimeout(() => f(0), 0)) as unknown as typeof requestAnimationFrame
  globalThis.cancelAnimationFrame = ((id: number) => clearTimeout(id)) as unknown as typeof cancelAnimationFrame
  globalThis.requestIdleCallback = ((f: () => void) => setTimeout(f, 0)) as unknown as typeof requestIdleCallback
  globalThis.cancelIdleCallback = ((id: number) => clearTimeout(id)) as unknown as typeof cancelIdleCallback
  const nadaObserva = class { observe() {} unobserve() {} disconnect() {} }
  globalThis.IntersectionObserver = nadaObserva as unknown as typeof IntersectionObserver
  globalThis.ResizeObserver = nadaObserva as unknown as typeof ResizeObserver
  const sinMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })
  w.matchMedia = sinMedia as unknown as typeof matchMedia
  globalThis.matchMedia = w.matchMedia
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

  const { createElement, act } = await import('react')
  const { createRoot } = await import('react-dom/client')
  const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime')
  const { PathnameContext, SearchParamsContext } = await import('next/dist/shared/lib/hooks-client-context.shared-runtime')
  const { SidebarProvider } = await import('../app/admin/_polar/ui/sidebar')
  const { DashboardSidebar } = await import('../app/admin/_polar/web/Layout/Dashboard/DashboardSidebar')
  const { BuscadorNav } = await import('../app/_components/BuscadorNav')

  const nada = () => {}
  const router = { back: nada, forward: nada, refresh: nada, push: nada, replace: nada, prefetch: nada }
  let polarAbierta = false
  let makoAbrio = 0
  const raiz = createRoot(w.document.getElementById('r')!)
  try {
    await act(async () => {
      raiz.render(createElement(AppRouterContext.Provider, { value: router },
        createElement(PathnameContext.Provider, { value: '/admin' },
          createElement(SearchParamsContext.Provider, { value: new URLSearchParams('') },
            createElement('div', null,
              // La barra de MaKo (plegada, como se ve en Admin) y la barra de Admin, montadas juntas como en /admin.
              createElement(BuscadorNav, { destinos: [], abierta: false, onAbrir: () => { makoAbrio += 1 } }),
              createElement(SidebarProvider, null,
                createElement(DashboardSidebar, { search: ({ open }: { open: boolean }) => { polarAbierta = open; return null } })))))))
    })
    for (const tecla of [{ key: 'k', shiftKey: false }, { key: 'K', shiftKey: true }]) {
      polarAbierta = false
      makoAbrio = 0
      await act(async () => {
        w.document.dispatchEvent(new w.KeyboardEvent('keydown', { ...tecla, ctrlKey: true, bubbles: true, cancelable: true }))
      })
      assert.equal(polarAbierta, true, `Ctrl ${tecla.key}: se abre la búsqueda de Admin (Polar)`)
      assert.equal(makoAbrio, 0, `Ctrl ${tecla.key}: la de la barra de MaKo no se abre`)
    }
  } finally {
    await act(async () => raiz.unmount())
    dom.window.close()
    globalThis.window = antes.window
    globalThis.document = antes.document
    globalThis.self = antes.self
    Object.defineProperty(globalThis, 'navigator', { value: antes.navigator, configurable: true })
  }
})
