// =============================================================================
// Admin (la copia de Polar): los arreglos de la base, el Overview, Customers, la ficha de un negocio y la búsqueda (6/11/2026),
// EJECUTADOS
// =============================================================================
// Lo que salió mirando las capturas con datos de ejemplo contra el panel real de Polar (docs/admin/referencia-polar/). Cada test
// corre la función pura o DIBUJA la pieza (renderToStaticMarkup) con los datos de ejemplo y mira lo que sale:
//   1. las iniciales del Avatar con tildes y emojis («Ana Gómez» → «AG», no «AM»): `iniciales` de lib/unicode-seguro.ts;
//   2. la mono de Admin es la familia que carga app/layout.tsx («Geist Mono»), y el texto del oscuro es blanco, como Polar;
//   3. las tarjetas del Overview muestran CINCO filas de UNA línea (el nombre cede último, lo de la derecha no se parte), y
//      «Por cobrar» dice el total de TODOS y cuántos son si hay más de los que se ven;
//   4. Customers › Overview: las tres columnas las decide el ancho de la CAJA (`@container`), no la ventana;
//   5. el selector de rango de Customers entra en el teléfono («Todo», y el renglón envuelve), y las tablas de Top Customers,
//      At Risk y Cost Drivers esconden en una caja angosta la columna secundaria, nunca lo pagado, el estado ni el costo;
//   6. la ficha: Orders con la descripción en una línea (el medio no se dibuja encima del estado), Members sin columnas cortadas
//      («Sin acceso enviado» debajo del estado), Usage sin el párrafo y con un período por intervalo desde que se mide;
//   7. la búsqueda ⌘K: la lupa no toca el texto (el `px-3` que Polar recibe de @tailwindcss/forms);
//   8. los ejemplos: cada negocio con su número en Overview, Customers y la ficha (Estudio Norte, el 42), al precio de su plan.
//
// Probado rompiéndolo el 6/11/2026 (base: 8/0; cada rotura, sola, restaurada después y la base otra vez 8/0):
//   · `getInitials` vuelve a la de Polar (`replace(/[^a-zA-Z ]/g, ' ')`, primera y última palabra)          → 7/1 (1)
//   · polar.css vuelve a `--pl-font-mono: 'GeistMono', …` (sin la familia que carga el layout)              → 7/1 (2)
//   · polar.css sin el `color: #ffffff` del oscuro                                                           → 7/1 (2)
//   · `tarjetaPorCobrar` sin cortar (`visibles: r.filas`: las siete filas en la tarjeta)                     → 7/1 (3)
//   · `fila.ts` con `SECUNDARIO` igual que `PRINCIPAL` (el plan cede lo mismo que el nombre)                  → 6/2 (3 y 6: Orders lo usa)
//   · ActivityWidget sin el `style={FIJO}` del «cuándo» («hace 12 min» se parte)                             → 7/1 (3)
//   · CustomersOverview prende las tres columnas por la ventana (`xl:grid-cols-3` en vez de `@4xl:`)          → 7/1 (4)
//   · AtRiskPage sin el `hidden @lg:table-cell` del plan (el estado quedaba detrás del scroll)               → 7/1 (5)
//   · `OPCIONES_DE_RANGO` con «Desde siempre» (el rótulo de `CHART_RANGES` tal cual)                         → 7/1 (5)
//   · CustomerOrdersTable con el concepto sin cortar (sin `truncate style={PRINCIPAL}`)                      → 7/1 (6)
//   · `usoDelNegocio` sin los períodos vacíos (`periodos = []`)                                              → 7/1 (6)
//   · ui/command.tsx sin el `px-3` del input                                                                 → 7/1 (7)
//   · el ejemplo de la ficha vuelve a US$ 238 por mes                                                        → 7/1 (8)
//   · un cambio sin efecto (renombrar la local `periodos` de `usoDelNegocio`)                                → 8/0 (sigue verde)
// =============================================================================

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AppRouterContext, type AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { PathnameContext, SearchParamsContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime'
import { getInitials } from '../app/admin/_polar/orbit/components/avatar-iniciales'
import { Avatar } from '../app/admin/_polar/orbit/components/Avatar'
import { DataTable } from '../app/admin/_polar/orbit/components/datatable/DataTable'
import { CommandInput, Command } from '../app/admin/_polar/ui/command'
import { tarjetaPorCobrar, FILAS_POR_COBRAR, type PorCobrarResumen } from '../app/admin/_polar/datos/resumen'
import { cubetasDelRango, usoDelNegocio } from '../app/admin/_polar/datos/cliente'
import { resumenEjemplo, ingresosEjemplo } from '../app/admin/_polar/datos/ejemplo/resumen'
import { AT_RISK_EJEMPLO, COSTOS_EJEMPLO, LISTA_EJEMPLO, OVERVIEW_EJEMPLO as OVERVIEW_CUSTOMERS, TOP_EJEMPLO } from '../app/admin/_polar/datos/ejemplo/clientes'
import {
  MIEMBROS_EJEMPLO, OVERVIEW_EJEMPLO as FICHA_EJEMPLO, PEDIDOS_EJEMPLO, SUSCRIPCIONES_EJEMPLO, USO_EJEMPLO, WS_EJEMPLO,
} from '../app/admin/_polar/datos/ejemplo/cliente'
import { ESENCIAL, NEGOCIOS, PAGOS_EJEMPLO, PRO } from '../app/admin/_polar/datos/ejemplo/negocios'
import { AccountWidget } from '../app/admin/_polar/web/Widgets/AccountWidget'
import { ActivityWidget } from '../app/admin/_polar/web/Widgets/ActivityWidget'
import { CustomerRiskWidget } from '../app/admin/_polar/web/Widgets/CustomerRiskWidget'
import { TopCustomersWidget } from '../app/admin/_polar/web/Widgets/TopCustomersWidget'
import { VISIBLE_ROWS } from '../app/admin/_polar/web/Widgets/fila'
import { CustomersOverview } from '../app/admin/_polar/web/Customer/CustomersOverview'
import { OPCIONES_DE_RANGO } from '../app/admin/_polar/web/Customer/rangos'
import { AtRiskPage } from '../app/admin/(polar)/customers/at-risk/AtRiskPage'
import { CostDriversPage } from '../app/admin/(polar)/customers/cost-drivers/CostDriversPage'
import { TopCustomersPage } from '../app/admin/(polar)/customers/top/TopCustomersPage'
import { CustomerOrdersTable } from '../app/admin/_polar/web/Customer/CustomerPage/CustomerOrdersTable'
import { CustomerSubscriptionsTable } from '../app/admin/_polar/web/Customer/CustomerPage/CustomerSubscriptionsTable'
import { MembersSection } from '../app/admin/_polar/web/Customer/CustomerPage/MembersSection'
import { CustomerUsageView } from '../app/admin/_polar/web/Customer/CustomerPage/CustomerUsageView'

const RAIZ = fileURLToPath(new URL('..', import.meta.url))
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n')
const sinComentariosCss = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '')

/** Dibuja una pieza de Admin con el router de Next que no navega, la ruta y la query que se le pasen. */
function dibujar(el: ReactElement, ruta = '/admin', query = ''): string {
  const nada = () => {}
  const router: AppRouterInstance = { back: nada, forward: nada, refresh: nada, push: nada, replace: nada, prefetch: nada }
  return renderToStaticMarkup(
    createElement(AppRouterContext.Provider, { value: router },
      createElement(PathnameContext.Provider, { value: ruta },
        createElement(SearchParamsContext.Provider, { value: new URLSearchParams(query) }, el))),
  )
}

/** Los `<th>` de una tabla: su clase, su ancho y su texto. */
function encabezados(html: string): Array<{ clase: string; ancho: string; texto: string }> {
  return [...html.matchAll(/<th(\s[^>]*)?>([\s\S]*?)<\/th>/g)].map(([, attrs = '', adentro]) => ({
    clase: /class="([^"]*)"/.exec(attrs)?.[1] ?? '',
    ancho: /(?:^|[;"\s])width:([^;"]*)/.exec(attrs)?.[1] ?? '',
    texto: adentro.replace(/<[^>]+>/g, '').trim(),
  }))
}
const th = (html: string, texto: string) => {
  const h = encabezados(html).find((x) => x.texto === texto)
  assert.ok(h, `la columna «${texto}» está`)
  return h
}

// ── 1. Las iniciales ─────────────────────────────────────────────────────────────────────────────────────────────

test('1 · las iniciales del Avatar: con tilde, con emoji y de un email (la regla de la casa, `iniciales`)', () => {
  assert.equal(getInitials('Ana Gómez'), 'AG', 'la de Polar daba «AM»: tiraba la «G» y la «ó»')
  assert.equal(getInitials('Óptica Visión Clara'), 'ÓV', 'la de Polar daba «PC»')
  assert.equal(getInitials('🚀 Estudio Norte'), 'EN', 'un emoji no es una letra')
  assert.equal(getInitials('ana.gomez@ejemplo.com'), 'AG', 'de un email, lo de antes de la @, partido por el punto')
  assert.equal(getInitials('carla@ejemplo.com'), 'C')
  assert.equal(getInitials(''), '', 'sin nombre, nada (no un «?»)')
  assert.match(renderToStaticMarkup(createElement(Avatar, { name: 'Ana Gómez', avatar_url: null })), /<span>AG<\/span>/, 'el Avatar dibuja las de `getInitials`')
})

// ── 2. El tema ───────────────────────────────────────────────────────────────────────────────────────────────────

test('2 · la mono es la familia que carga el layout, y en oscuro el texto es blanco (el `dark:text-white` del layout de Polar)', () => {
  const css = sinComentariosCss(leer('app/admin/_polar/polar.css'))
  const mono = /--pl-font-mono:\s*'([^']+)'/.exec(css)?.[1]
  const familias = [...leer('app/layout.tsx').matchAll(/fonts\.googleapis\.com\/css2\?family=([^:&"]+)/g)].map((m) => m[1].replace(/\+/g, ' '))
  assert.ok(mono && familias.includes(mono), `la primera mono de Admin («${mono}») es una que carga app/layout.tsx (${familias.join(', ')})`)
  const oscuro = /:root\[data-tema="oscuro"\] \.pl \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? ''
  assert.match(oscuro, /(^|\n)\s*color:\s*#ffffff;/, 'el texto que no pone su color (la lista de negocios, las celdas) es blanco en oscuro')
})

// ── 3. Las tarjetas del Overview ─────────────────────────────────────────────────────────────────────────────────

test('3 · las tarjetas del Overview: cinco filas de una línea, el nombre cede último; «Por cobrar» con el total de todas', () => {
  // Por cobrar: el ejemplo tiene siete cobros; se ven cinco y el número grande es el de los siete.
  assert.ok(resumenEjemplo.porCobrar.ok)
  const pc = resumenEjemplo.porCobrar.datos
  assert.equal(pc.filas.length, 7)
  const t = tarjetaPorCobrar(pc)
  assert.equal(t.visibles.length, FILAS_POR_COBRAR)
  assert.equal(t.totalCentavos, 52900, 'el total de los siete, no de los cinco')
  assert.equal(t.cuantos, 'en 7 cobros')
  const pocos: PorCobrarResumen = { filas: pc.filas.slice(0, 3), totalCentavos: 1 }
  assert.equal(tarjetaPorCobrar(pocos).cuantos, null, 'si se ven todos, no se dice cuántos son')

  const filas = (html: string) => (html.match(/border-top-width:1px/g) ?? []).length
  const porCobrar = dibujar(createElement(AccountWidget, { porCobrar: resumenEjemplo.porCobrar }))
  assert.equal(filas(porCobrar), VISIBLE_ROWS, 'se ven cinco cobros (una sexta fila quedaba cortada a la mitad)')
  assert.match(porCobrar, /US\$\s?529/)
  assert.match(porCobrar, /en 7 cobros/)

  const widgets = [
    dibujar(createElement(TopCustomersWidget, { top: resumenEjemplo.top })),
    dibujar(createElement(CustomerRiskWidget, { riesgo: resumenEjemplo.riesgo })),
    dibujar(createElement(ActivityWidget, { actividad: resumenEjemplo.actividad })),
    porCobrar,
  ]
  for (const html of widgets) {
    assert.ok(filas(html) > 0 && filas(html) <= VISIBLE_ROWS, 'cinco filas como mucho')
    assert.ok(html.includes('flex-shrink:0;white-space:nowrap'), 'lo de la derecha (monto, cuándo, motivo) no se parte')
  }
  for (const html of [widgets[0], widgets[1], widgets[3]]) {
    assert.ok(html.includes('flex:0 1 auto'), 'el nombre cede último')
    assert.ok(html.includes('flex:0 1000 auto'), 'lo secundario (pagos, plan, fecha) cede primero')
  }
  assert.ok(widgets[2].includes('flex:0 2 auto') && widgets[2].includes('flex:0 1 auto'), 'Activity: el título cede el doble que el negocio')
  assert.match(widgets[2], /hace 12 min/, 'el «cuándo» de la acción de hace 12 minutos')
})

// ── 4. Customers › Overview ──────────────────────────────────────────────────────────────────────────────────────

test('4 · Customers › Overview: las tres columnas por el ancho de la caja, cada una sin desbordar', () => {
  const html = dibujar(createElement(CustomersOverview, OVERVIEW_CUSTOMERS), '/admin/customers')
  assert.match(html, /class="@container min-w-0"/, 'la caja que se mide')
  assert.match(html, /class="grid min-w-0 grid-cols-1 gap-12 @4xl:grid-cols-3"/, 'tres columnas recién con 896 px de caja')
  assert.doesNotMatch(html, /@media \(min-width:1280px\)\{[^}]*grid-template-columns/, 'nada por el ancho de la ventana')
  for (const titulo of ['Top Customers', 'At Risk', 'Cost Drivers']) {
    assert.match(html, new RegExp(`<h2 class="pl-t-body pl-c-default pl-wrap-nowrap" style="flex-shrink:0">${titulo}</h2>`), `«${titulo}» no se parte`)
  }
})

// ── 5. Customers en el teléfono ──────────────────────────────────────────────────────────────────────────────────

test('5 · Customers en el teléfono: el selector entra y las tablas esconden lo secundario, nunca lo que importa', () => {
  assert.deepEqual(OPCIONES_DE_RANGO.map((o) => o.label), ['Todo', '12m', '3m', '30d', 'Hoy'], '«Todo», como el selector del Overview')

  const top = dibujar(createElement(TopCustomersPage, TOP_EJEMPLO), '/admin/customers/top')
  assert.match(top, /flex-wrap:wrap/, 'el título y el selector envuelven (Polar fija el alto en 2rem)')
  assert.doesNotMatch(top, /[;"]height:2rem/, 'sin el alto fijo')
  assert.match(th(top, 'Pagos').clase, /\bhidden @md:table-cell\b/, 'Pagos se esconde en una caja angosta')
  assert.doesNotMatch(th(top, 'Pagado').clase, /\bhidden\b/, 'lo pagado se ve siempre')
  assert.equal(th(top, 'Cliente').ancho, '50%', 'el nombre toma el espacio (en porcentajes, la tabla no se corre de costado)')

  const riesgo = dibujar(createElement(AtRiskPage, AT_RISK_EJEMPLO), '/admin/customers/at-risk')
  assert.match(th(riesgo, 'Plan').clase, /\bhidden @lg:table-cell\b/)
  assert.match(th(riesgo, 'Monto').clase, /\bhidden @md:table-cell\b/)
  assert.doesNotMatch(th(riesgo, 'Estado').clase, /\bhidden\b/, 'el estado se ve siempre')

  const costos = dibujar(createElement(CostDriversPage, COSTOS_EJEMPLO), '/admin/customers/cost-drivers')
  assert.match(th(costos, 'Llamadas a la IA').clase, /\bhidden @lg:table-cell\b/)
  assert.doesNotMatch(th(costos, 'Costo').clase, /\bhidden\b/, 'el costo se ve siempre')

  for (const html of [top, riesgo, costos]) {
    const anchos = encabezados(html).map((h) => h.ancho)
    assert.ok(anchos.every((a) => a.endsWith('%')), `todas en porcentajes: ${anchos.join(', ')}`)
    assert.equal(anchos.reduce((s, a) => s + Number.parseFloat(a), 0), 100, 'y suman el ancho de la tabla')
  }
})

// ── 6. La ficha ──────────────────────────────────────────────────────────────────────────────────────────────────

test('6 · la ficha: Orders en una línea, Members sin columnas cortadas, Usage sin el párrafo y con todos los períodos', () => {
  const orders = dibujar(createElement(CustomerOrdersTable, { pedidos: PEDIDOS_EJEMPLO }), `/admin/customers/${WS_EJEMPLO}`)
  assert.doesNotMatch(orders, /display:inline-flex/, 'sin el `inline-flex` de Polar: el medio se dibujaba encima de «Pagado»')
  assert.match(orders, /<a[^>]*class="flex min-w-0 items-baseline gap-x-2"[^>]*><span class="pl-t-default pl-c-default pl-truncate" style="flex:0 1 auto;min-width:0">Mensualidad de noviembre<\/span><span class="pl-t-caption pl-c-muted pl-truncate" style="flex:0 1000 auto;min-width:0">/, 'el concepto y el medio, cortados con «…» en un renglón')
  assert.match(th(orders, 'Estado').clase, /\bhidden @md:table-cell\b/)
  assert.doesNotMatch(th(orders, 'Monto').clase, /\bhidden\b/, 'el monto se ve siempre')
  const susc = dibujar(createElement(CustomerSubscriptionsTable, { suscripciones: SUSCRIPCIONES_EJEMPLO }), `/admin/customers/${WS_EJEMPLO}`)
  assert.doesNotMatch(susc, /display:inline-flex/)

  const miembros = dibujar(createElement(MembersSection, { miembros: MIEMBROS_EJEMPLO }), `/admin/customers/${WS_EJEMPLO}/members`)
  const anchos = encabezados(miembros).map((h) => Number.parseFloat(h.ancho))
  assert.equal(anchos.reduce((s, a) => s + a, 0), 100, 'las siete columnas entran en la tabla (antes sumaban 1000 px en un panel de 745)')
  assert.match(th(miembros, 'Último ingreso').clase, /\bhidden @lg:table-cell\b/)
  assert.match(th(miembros, 'Alta').clase, /\bhidden @4xl:table-cell\b/)
  assert.match(miembros, /flex-direction:column[^"]*"><div[^>]*>Invitado<\/div><p class="pl-t-caption pl-c-muted pl-truncate"[^>]*>Sin acceso enviado<\/p>/, '«Sin acceso enviado» debajo de la insignia, en un renglón')

  // Usage: un período por intervalo desde que se mide, también los vacíos.
  assert.deepEqual(cubetasDelRango('2026-11-01', '2026-11-30', 'week').map((c) => c.slice(0, 10)), ['2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30'])
  assert.deepEqual(cubetasDelRango('2026-12-01', '2026-11-01', 'month'), [], 'un rango al revés no tiene períodos')
  const u = usoDelNegocio(USO_EJEMPLO.filas, USO_EJEMPLO.tabs, USO_EJEMPLO.ia, '2026-07-01', '2026-11-06', 'month', USO_EJEMPLO.desdeMedido)
  assert.deepEqual(u.serie.map((p) => String(p.timestamp).slice(0, 7)), ['2026-08', '2026-09', '2026-10', '2026-11'], 'agosto a noviembre (julio no se medía: no es un cero)')
  const vacio = usoDelNegocio([{ dia: '2026-11-05', usuario: 1, tab: 'crm', pantallas: 2, acciones: 0 }], USO_EJEMPLO.tabs, [], '2026-11-01', '2026-11-30', 'week')
  assert.equal(vacio.serie.length, 6)
  assert.deepEqual(vacio.serie.map((p) => p.crm), [0, 2, 0, 0, 0, 0], 'las semanas sin uso, en cero')
  assert.deepEqual(usoDelNegocio([], USO_EJEMPLO.tabs, [], '2026-11-01', '2026-11-30', 'week').serie, [], 'sin uso, sin gráfico')
  const usage = dibujar(createElement(CustomerUsageView, USO_EJEMPLO), `/admin/customers/${WS_EJEMPLO}/usage`)
  assert.doesNotMatch(usage, /La IA cuenta las llamadas|Inteligencia artificial/, 'el porqué va al código, no a la pantalla')
  assert.match(usage, /Nadie del negocio las abrió desde el/)
})

// ── 7. La búsqueda ⌘K ────────────────────────────────────────────────────────────────────────────────────────────

test('7 · la búsqueda: la lupa no toca el texto (el padding que Polar recibe de @tailwindcss/forms)', () => {
  const html = renderToStaticMarkup(createElement(Command, null, createElement(CommandInput, { placeholder: 'Buscar' })))
  const input = /<input[^>]*class="([^"]*)"/.exec(html)?.[1] ?? ''
  assert.match(input, /\bpx-3\b/)
})

// ── 8. Los ejemplos ──────────────────────────────────────────────────────────────────────────────────────────────

test('8 · los ejemplos: cada negocio con su número en Overview, Customers y la ficha, al precio de su plan', () => {
  assert.equal(WS_EJEMPLO, 42)
  assert.equal(NEGOCIOS.estudioNorte.ws, 42)
  const numeros = new Map<string, Set<number>>()
  const anotar = (nombre: string, ws: number | null | undefined) => {
    if (ws == null) return
    if (!numeros.has(nombre)) numeros.set(nombre, new Set())
    numeros.get(nombre)!.add(ws)
  }
  for (const c of LISTA_EJEMPLO) anotar(c.nombre, c.ws)
  for (const c of OVERVIEW_CUSTOMERS.atRisk ?? []) anotar(c.nombre, c.ws)
  for (const c of COSTOS_EJEMPLO.costos?.clientes ?? []) anotar(c.nombre, c.ws)
  for (const q of TOP_EJEMPLO.datos?.quien ?? []) anotar(q.nombre, q.ws)
  if (resumenEjemplo.top.ok) for (const c of resumenEjemplo.top.datos.filas) anotar(c.nombre, c.ws)
  if (resumenEjemplo.riesgo.ok) for (const c of resumenEjemplo.riesgo.datos.filas) anotar(c.nombre, c.ws)
  if (resumenEjemplo.porCobrar.ok) for (const c of resumenEjemplo.porCobrar.datos.filas) anotar(c.nombre, c.ws)
  anotar(FICHA_EJEMPLO.negocio.nombre, FICHA_EJEMPLO.negocio.ws)
  for (const p of PEDIDOS_EJEMPLO) anotar(p.cliente?.nombre ?? '', p.cliente?.ws)
  const repetidos = [...numeros].filter(([, s]) => s.size > 1).map(([n, s]) => `${n}: ${[...s].join(', ')}`)
  assert.deepEqual(repetidos, [], 'un negocio, un número')
  const porNumero = new Map<number, string>()
  for (const [nombre, s] of numeros) for (const ws of s) {
    assert.ok(!porNumero.has(ws) || porNumero.get(ws) === nombre, `el ${ws} es «${porNumero.get(ws)}» y «${nombre}»`)
    porNumero.set(ws, nombre)
  }

  const precios = new Set([ESENCIAL.precioUsd, PRO.precioUsd, ESENCIAL.precioAnualUsd, PRO.precioAnualUsd])
  for (const p of PAGOS_EJEMPLO) if (p.usd != null) assert.ok(precios.has(p.usd), `${p.id}: US$ ${p.usd} es un precio de un plan`)
  assert.equal(FICHA_EJEMPLO.mrrUsd, PRO.precioUsd, 'Estudio Norte paga lo que cuesta Pro')
  assert.equal(SUSCRIPCIONES_EJEMPLO[0].mensualidadUsd, PRO.precioUsd)
  assert.equal(ingresosEjemplo.cobradoTotal, PAGOS_EJEMPLO.reduce((s, p) => s + (p.usd ?? 0), 0), 'lo cobrado del Overview es la suma de los pagos')
  for (const m of ingresosEjemplo.meses) {
    const pagos = PAGOS_EJEMPLO.filter((p) => p.fecha.startsWith(m.mes)).reduce((s, p) => s + (p.usd ?? 0), 0)
    assert.equal(m.cobrado, pagos, `${m.mes}: lo cobrado es lo que pagaron`)
  }
  const txt = JSON.stringify({ resumenEjemplo, LISTA_EJEMPLO, FICHA_EJEMPLO, PAGOS_EJEMPLO })
  for (const real of ['Mauricio', 'Leila', 'Florencia', 'Leandro', 'Código Inmobiliario', 'Brigitte']) assert.ok(!txt.includes(real), `sin «${real}»`)
})
