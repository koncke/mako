// =============================================================================
// Admin (la copia de Polar): lo que encontró el revisor independiente en la base, el Overview, Customers y la ficha (6/11/2026),
// EJECUTADO. Cada test corre las funciones puras o DIBUJA la pieza (renderToStaticMarkup) con datos armados o con los ejemplos:
//   1. «At Risk» es UNA lista: la tarjeta del Overview y Customers › At Risk dan el mismo total y el mismo motivo por negocio
//      (en Polar las dos llaman a `useAtRisk`); la tarjeta tenía su propia cuenta (sólo pausado, cobro fallido y sin uso);
//   2. el gasto de IA de un negocio tiene UNA regla, la de Cost Drivers (`gastoPorNegocio`): si no es atribuible, la ficha no
//      dice plata; si lo es, dice lo mismo que Cost Drivers para ese negocio y ese mes. Usage ya no suma `cost_usd`;
//   3. la ficha no dice lo que paga por mes (era «ingreso mensual en Customers»): quedan lo pagado y los pagos del rango, y
//      Costs, Profit y Profit Margin del mes sólo si el gasto es atribuible;
//   4. el color de los bordes de Polar va en `@layer base` (fuera de capa le ganaba a `border-transparent` y a todo
//      `border-<color>`): se lee polar.css con el parser de PostCSS;
//   5. las métricas por defecto del Overview son las de Polar que MaKo mide, y salen con los ejemplos;
//   7. las computadoras de la ficha sin la persona que las conectó (las personas viven en Members);
//   8. la cabecera de la ficha dice el plan, no «Negocio #42»;
//   9. la pista «Ctrl K» de la barra de MaKo no se dibuja en Admin (el atajo abre la de Polar: tests/admin-polar-atajo-k.test.ts
//      lo prueba con el DOM).
// (6, las filas de las tarjetas, está en tests/admin-polar-arreglos-clientes.test.ts, el 3, y se midió en Chrome.)
//
// Correr: node --import tsx --test tests/admin-polar-arreglos-4.test.ts
//
// PROBADO ROMPIÉNDOLO (6/11/2026), restaurando de memoria. Base: 8 pass / 0 fail. Cada rotura, sola:
//   · `riesgoDeLaTarjeta` deja afuera los atrasados (la cuenta vieja de la tarjeta)                       → 7/1 (1)
//   · resumen-server.ts arma la tarjeta sin la lectura de los ingresos (los atrasados no se ven)        → 7/1 (1)
//   · `costoDelNegocio` sin mirar si es atribuible (`gastoPorNegocio` no devuelve null)                   → 7/1 (2)
//   · cliente-server.ts vuelve a leer `cost_usd` de `anthropic_usage`                                     → 7/1 (2)
//   · CustomerMetricsOverview vuelve a dibujar «Lo que paga por mes»                                      → 7/1 (3)
//   · polar.css: la regla de los bordes otra vez fuera de `@layer base`                                    → 7/1 (4)
//   · `DEFAULT_OVERVIEW_METRICS` otra vez con `cumulative_revenue`                                         → 7/1 (5)
//   · `computadorasDeLaFicha` vuelve a pasar todo lo que recibe (la persona incluida)                     → 7/1 (7)
//   · CustomerPageShell vuelve a «Negocio #42»                                                             → 7/1 (8)
//   · polar.css sin la regla que esconde la pista «Ctrl K»                                                  → 7/1 (9)
//   · un cambio sin efecto (renombrar la local `suyo` de `costoDelNegocio`)                                → 8/0 (sigue verde)
// =============================================================================

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import postcss, { type AtRule, type Rule } from 'postcss'
import { AppRouterContext, type AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { PathnameContext, SearchParamsContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime'
import type { FilaCliente } from '../lib/clientes-plataforma'
import type { ClienteResumen } from '../lib/admin-ingresos-reglas'
import type { ResumenPeriodo } from '../lib/costos-ia'
import {
  costoDelNegocio, costosPorCliente, gastoPorNegocio, vistaDeAtRisk, LIMITE_AT_RISK, type Lectura,
} from '../app/admin/_polar/datos/clientes'
import { riesgoDeLaTarjeta, mesesDelRango } from '../app/admin/_polar/datos/resumen'
import { cifrasDeCosto, cifrasDelRango, computadorasDeLaFicha } from '../app/admin/_polar/datos/cliente'
import { metricasDeIngresos } from '../app/admin/_polar/datos/metricas'
import type { Pedido } from '../app/admin/_polar/datos/ventas'
import { DEFAULT_OVERVIEW_METRICS } from '../app/admin/_polar/web/utils/metrics'
import { formatCurrency } from '../app/admin/_polar/lib/currency'
import { formatPercentage } from '../app/admin/_polar/web/utils/formatters'
import { ingresosEjemplo, resumenEjemplo } from '../app/admin/_polar/datos/ejemplo/resumen'
import { AT_RISK_EJEMPLO, COSTOS_EJEMPLO } from '../app/admin/_polar/datos/ejemplo/clientes'
import {
  ALTA_EJEMPLO, CABECERA_EJEMPLO, COMPUTADORAS_EJEMPLO, CONEXIONES_EJEMPLO, OVERVIEW_EJEMPLO as FICHA_EJEMPLO, PEDIDOS_EJEMPLO,
  USO_EJEMPLO, WS_EJEMPLO,
} from '../app/admin/_polar/datos/ejemplo/cliente'
import { CustomerRiskWidget } from '../app/admin/_polar/web/Widgets/CustomerRiskWidget'
import { CustomerMetricsOverview } from '../app/admin/_polar/web/Customer/CustomerPage/CustomerMetricsOverview'
import { CustomerUsageView } from '../app/admin/_polar/web/Customer/CustomerPage/CustomerUsageView'
import { CustomerDetailsSection } from '../app/admin/_polar/web/Customer/CustomerPage/CustomerDetailsSection'
import { CustomerPageShell } from '../app/admin/_polar/web/Customer/CustomerPage/CustomerPageShell'
import { CostDriversPage } from '../app/admin/(polar)/customers/cost-drivers/CostDriversPage'

const RAIZ = fileURLToPath(new URL('..', import.meta.url))
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n')
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')

function dibujar(el: ReactElement, ruta = '/admin', query = ''): string {
  const nada = () => {}
  const router: AppRouterInstance = { back: nada, forward: nada, refresh: nada, push: nada, replace: nada, prefetch: nada }
  return renderToStaticMarkup(
    createElement(AppRouterContext.Provider, { value: router },
      createElement(PathnameContext.Provider, { value: ruta },
        createElement(SearchParamsContext.Provider, { value: new URLSearchParams(query) }, el))),
  )
}

// ── 1. At Risk: una lista ────────────────────────────────────────────────────────────────────────────────────────

type Fila = Pick<FilaCliente, 'ws' | 'nombre' | 'creado' | 'capa' | 'estado' | 'motivoRiesgo' | 'sinEntrar' | 'mrrUsd' | 'planAManoTxt'>
const fila = (ws: number, nombre: string, extra: Partial<Fila> = {}): Fila => ({
  ws, nombre, creado: '2026-01-01T00:00:00Z', capa: 'completo', estado: 'activo', motivoRiesgo: null, sinEntrar: 1, mrrUsd: 47, planAManoTxt: null, ...extra,
})
type Ingreso = ClienteResumen
const ingreso = (ws: number, nombre: string, extra: Partial<Ingreso> = {}): Ingreso => ({
  clave: `ws:${ws}`, ws, nombre, leadId: null, total: 47, sinDolares: 0, pagos: 1, primerPago: '2026-09-01', ultimoPago: '2026-09-01',
  mrr: 47, estado: 'al-dia', proximo: null, diasAtraso: null, ...extra,
})

test('1 · At Risk: la tarjeta del Overview y la página dan el mismo total y el mismo motivo por negocio', () => {
  // Los casos donde las dos cuentas viejas se separaban: un atrasado y uno que dejó de pagar (la tarjeta no los veía), y uno
  // con dos motivos (sin uso en la plataforma, atrasado en los pagos).
  const filas: Fila[] = [
    fila(1, 'Estudio Norte', { motivoRiesgo: 'sin-uso', sinEntrar: 19 }),
    fila(2, 'Gimnasio Sur', { estado: 'pausado', motivoRiesgo: 'pausado' }),
    fila(3, 'Taller Ruta 9', { motivoRiesgo: 'cobro' }),
    fila(4, 'Panadería Espiga'),
    fila(5, 'Óptica Clara'),
  ]
  const ingresos: Ingreso[] = [
    ingreso(1, 'Estudio Norte', { estado: 'atrasado', diasAtraso: 6 }),
    ingreso(4, 'Panadería Espiga', { estado: 'atrasado', diasAtraso: 3 }),
    ingreso(5, 'Óptica Clara', { estado: 'cortado' }),
  ]
  const lc: Lectura<{ filas: Fila[] }> = { ok: true, datos: { filas }, avisos: [] }
  const li: Lectura<{ entradas: never[]; clientes: Ingreso[] }> = { ok: true, datos: { entradas: [], clientes: ingresos }, avisos: [] }
  const pagina = vistaDeAtRisk(lc, li)
  const tarjeta = riesgoDeLaTarjeta(vistaDeAtRisk(lc, li))
  assert.ok(pagina.atRisk && tarjeta.ok)
  assert.equal(tarjeta.datos.total, pagina.atRisk.length, 'el número grande es el total de la lista de la página')
  assert.equal(tarjeta.datos.total, 5, 'atrasados y el que dejó de pagar también cuentan')
  const motivos = (l: ReadonlyArray<{ ws: number | null; motivo: string; texto: string }>) => l.map((c) => `${c.ws}:${c.motivo}:${c.texto}`)
  assert.deepEqual(motivos(tarjeta.datos.filas), motivos(pagina.atRisk), 'el mismo orden y el mismo motivo por negocio')
  assert.equal(tarjeta.datos.filas.find((c) => c.ws === 1)?.motivo, 'atrasado', 'con dos motivos, el más grave, en las dos')
  assert.equal(LIMITE_AT_RISK, 100, 'la consulta de Polar (`LIMIT = 100`), la misma para las dos')

  // Los ejemplos: la tarjeta del Overview es la lista de Customers › At Risk con los mismos datos, y dibuja su texto.
  assert.ok(resumenEjemplo.riesgo.ok && AT_RISK_EJEMPLO.atRisk)
  assert.equal(resumenEjemplo.riesgo.datos.total, AT_RISK_EJEMPLO.atRisk.length)
  assert.deepEqual(motivos(resumenEjemplo.riesgo.datos.filas), motivos(AT_RISK_EJEMPLO.atRisk))
  const html = dibujar(createElement(CustomerRiskWidget, { riesgo: resumenEjemplo.riesgo }))
  assert.match(html, new RegExp(`>${resumenEjemplo.riesgo.datos.total}</h4>`), 'el número grande')
  for (const c of resumenEjemplo.riesgo.datos.filas.slice(0, 5)) assert.ok(html.includes(`>${c.texto}</span>`), `«${c.texto}» de ${c.nombre}`)

  // El server arma la tarjeta con la MISMA función que la página (no hay otra cuenta en resumen.ts).
  const server = sinComentarios(leer('app/admin/_polar/datos/resumen-server.ts'))
  assert.match(server, /riesgo: riesgoDeLaTarjeta\(vistaDeAtRisk\(sinAvisos\(clientes\), sinAvisos\(ingresos\)\)\),/)
  assert.doesNotMatch(sinComentarios(leer('app/admin/_polar/datos/resumen.ts')), /motivoRiesgo|filasDeRiesgo/, 'resumen.ts no tiene su propia regla')
})

// ── 2 y 3. El gasto de IA de un negocio, una regla; la ficha sin lo que paga por mes ─────────────────────────────

const corte = (clave: string, llamadas: number, costUsd: number, atribuible = true) => ({ clave, llamadas, tokens: llamadas * 1000, costUsd, atribuible })
const resumenDe = (atribuible: boolean): Pick<ResumenPeriodo, 'periodo' | 'costUsd' | 'porWorkspace'> => ({
  periodo: '2026-11', costUsd: 5.5,
  porWorkspace: [corte('42', 268, 1.26, atribuible), corte('44', 412, 2.1, atribuible), corte('9', 900, 2.14, atribuible)],
})
const pedido = (id: string, fecha: string, usd: number): Pedido => ({ ...PEDIDOS_EJEMPLO[0], id, fecha, usd, estado: 'paid' })

test('2 · el gasto de IA de un negocio: la ficha dice lo mismo que Cost Drivers, y nada si no es atribuible', () => {
  const r = resumenDe(true)
  const cd = costosPorCliente(r, new Map([[42, 'Estudio Norte'], [44, 'Clínica']]))
  for (const ws of [42, 44]) {
    const ficha = costoDelNegocio(r, ws)
    assert.ok(ficha.atribuible)
    assert.equal(ficha.costoCentavos, cd.clientes.find((c) => c.ws === ws)?.costoCentavos, `el ${ws}: el mismo costo que Cost Drivers`)
  }
  assert.deepEqual(costoDelNegocio(r, 77), { periodo: '2026-11', atribuible: true, llamadas: 0, costoCentavos: 0 }, 'sin corte en un mes atribuible: no gastó')

  const no = resumenDe(false)
  assert.equal(gastoPorNegocio(no), null)
  assert.deepEqual(costoDelNegocio(no, 42), { periodo: '2026-11', atribuible: false })
  assert.deepEqual(costosPorCliente(no, new Map([[42, 'Estudio Norte']])).clientes, [], 'Cost Drivers no reparte')
  assert.equal(cifrasDeCosto([pedido('a', '2026-11-02', 97)], costoDelNegocio(no, 42)), null, 'la ficha tampoco: no hay plata que decir')

  // Lo que se dibuja: con el gasto atribuible, el costo de la ficha es el texto de Cost Drivers; sin él, ninguna de las tres.
  assert.ok(FICHA_EJEMPLO.costo?.atribuible)
  const centavos = FICHA_EJEMPLO.costo.costoCentavos
  const txt = formatCurrency('subcent')(centavos, 'usd')
  const cdHtml = dibujar(createElement(CostDriversPage, COSTOS_EJEMPLO), '/admin/customers/cost-drivers')
  assert.ok(cdHtml.includes(txt), `Cost Drivers dice ${txt} para Estudio Norte`)
  const conCosto = dibujar(createElement(CustomerMetricsOverview, { pedidos: PEDIDOS_EJEMPLO, costo: FICHA_EJEMPLO.costo, inicio: '2026-07-01' }), `/admin/customers/${WS_EJEMPLO}`)
  assert.ok(conCosto.includes(txt), 'y la ficha dice lo mismo')
  assert.match(conCosto, /Gasto de IA · nov 2026/, 'con el mes en el título: no sigue al rango')
  const sinCosto = dibujar(createElement(CustomerMetricsOverview, { pedidos: PEDIDOS_EJEMPLO, costo: costoDelNegocio(no, 42), inicio: '2026-07-01' }), `/admin/customers/${WS_EJEMPLO}`)
  assert.doesNotMatch(sinCosto, /Gasto de IA|Margen bruto|data-ficha="costos-del-mes"/, 'sin un gasto atribuible, ni Costs ni Profit')

  // Usage cuenta las llamadas y no dice plata; el server ya no lee `cost_usd`.
  const usage = dibujar(createElement(CustomerUsageView, USO_EJEMPLO), `/admin/customers/${WS_EJEMPLO}/usage`)
  assert.doesNotMatch(usage, /US\$|>Costo</, 'Usage sin plata')
  assert.match(usage, /268 llamadas|586 llamadas|694 llamadas/, 'las llamadas de la IA siguen')
  assert.doesNotMatch(sinComentarios(leer('app/admin/_polar/datos/cliente-server.ts')), /cost_usd/, 'la segunda regla (sumar cost_usd por workspace) no vuelve')
})

test('3 · la ficha: lo pagado y los pagos del rango; Costs, Profit y Profit Margin del mes; nunca lo que paga por mes', () => {
  const pedidos = [pedido('a', '2026-11-02', 97), pedido('b', '2026-10-02', 97), pedido('c', '2026-11-20', 47)]
  const c = cifrasDelRango(pedidos, '2026-11-01', '2026-11-30')
  assert.deepEqual(c, { revenue: 14400, orders: 2, sinDolares: 0 }, 'sin `mrr`')
  const delMes = cifrasDeCosto(pedidos, { periodo: '2026-11', atribuible: true, llamadas: 10, costoCentavos: 144 })
  assert.deepEqual(delMes, { periodo: '2026-11', revenue: 14400, costs: 144, profit: 14256, margen: 0.99 }, 'Profit y Profit Margin del mes')
  assert.equal(cifrasDeCosto([], { periodo: '2026-11', atribuible: true, llamadas: 1, costoCentavos: 5 })?.margen, null, 'sin pagos no hay margen')
  const html = dibujar(createElement(CustomerMetricsOverview, FICHA_EJEMPLO), `/admin/customers/${WS_EJEMPLO}`)
  assert.doesNotMatch(html, /Lo que paga por mes|MRR/, 'nada de ingreso mensual en Customers')
  assert.match(html, /Lo que pagó/)
  assert.match(html, />Pagos</)
  const margen = cifrasDeCosto(FICHA_EJEMPLO.pedidos, FICHA_EJEMPLO.costo)?.margen
  assert.ok(margen != null && html.includes(`>${formatPercentage(margen)}</h3>`), `Profit Margin como porcentaje (${margen})`)
})

// ── 4 y 9. polar.css ─────────────────────────────────────────────────────────────────────────────────────────────

test('4 · el color de los bordes de Polar va en @layer base: así pierde contra border-transparent y border-<color>', () => {
  const raiz = postcss.parse(leer('app/admin/_polar/polar.css'))
  const capa = (n: Rule): string | null => {
    for (let p = n.parent; p && p.type !== 'root'; p = p.parent) if (p.type === 'atrule' && (p as AtRule).name === 'layer') return (p as AtRule).params
    return null
  }
  const bordes: Rule[] = []
  raiz.walkRules((r) => { if (r.nodes.some((d) => d.type === 'decl' && d.prop === 'border-color')) bordes.push(r) })
  assert.ok(bordes.some((r) => /\.pl \*/.test(r.selector)), 'la regla está')
  for (const r of bordes) assert.equal(capa(r), 'base', `«${r.selector}» en @layer base`)
  // Ninguna regla fuera de capa toca a TODOS los elementos (un `*`): ésas le ganan a cualquier utilidad.
  raiz.walkRules((r) => { if (/(^|\s)\*|::(after|before|backdrop)/.test(r.selector)) assert.equal(capa(r), 'base', `«${r.selector}» fuera de capa`) })
})

test('9 · la pista «Ctrl K» de la barra de MaKo no se dibuja con Admin en pantalla (el atajo abre la búsqueda de Polar)', () => {
  const raiz = postcss.parse(leer('app/admin/_polar/polar.css'))
  let hay = false
  raiz.walkRules((r) => {
    if (r.selector === ':root:has(.pl) .mk-buscador kbd') hay = r.nodes.some((d) => d.type === 'decl' && d.prop === 'display' && d.value === 'none')
  })
  assert.ok(hay)
  // Y la pista que esconde existe donde se la busca (si la barra de MaKo cambia su marcado, este test lo dice).
  assert.match(leer('app/_components/BuscadorNav.tsx'), /<label className="mk-buscador"[\s\S]*?<kbd[^>]*>Ctrl K<\/kbd>/)
})

// ── 5. Las métricas por defecto del Overview ─────────────────────────────────────────────────────────────────────

test('5 · las métricas por defecto del Overview: las de Polar que MaKo mide, y salen con los ejemplos', () => {
  // Polar (clients/apps/web/src/utils/metrics.ts, `DEFAULT_OVERVIEW_METRICS`): revenue, monthly_recurring_revenue,
  // active_subscriptions, orders, checkouts_conversion. MaKo no mide la conversión de checkouts; el acumulado no es de Polar.
  assert.deepEqual(DEFAULT_OVERVIEW_METRICS, ['revenue', 'monthly_recurring_revenue', 'active_subscriptions', 'orders'])
  const m = metricasDeIngresos(mesesDelRango(ingresosEjemplo, '12m'), ingresosEjemplo)
  for (const slug of DEFAULT_OVERVIEW_METRICS) assert.ok(m.metrics[slug], `«${slug}» sale de lo que lee el Overview`)
  const nov = m.periods[m.periods.length - 1]
  assert.equal(nov.active_subscriptions, 7, 'noviembre: tres en Esencial y cuatro en Pro (el MRR del mes)')
  assert.equal(nov.orders, ingresosEjemplo.entradas.filter((e) => e.fecha.startsWith('2026-11') && e.usd != null).length)
})

// ── 7 y 8. La ficha: las computadoras sin la persona, la cabecera con el plan ───────────────────────────────────

test('7 · las computadoras de la ficha, sin la persona que las conectó (las personas viven en Members)', () => {
  const conPersona = [{ id: 7, nombre: 'PC del local', persona: 'Ana Gómez', sistema: 'Windows' as const, enLinea: false, conectadaAt: null }]
  const r = computadorasDeLaFicha(true, conPersona)
  assert.ok(Array.isArray(r))
  assert.ok(!('persona' in r[0]), 'la persona no viaja a la pantalla')
  const html = dibujar(createElement(CustomerDetailsSection, { negocio: CABECERA_EJEMPLO, alta: ALTA_EJEMPLO, conexiones: CONEXIONES_EJEMPLO, computadoras: COMPUTADORAS_EJEMPLO }), `/admin/customers/${WS_EJEMPLO}`)
  assert.match(html, /Laptop de Ana · Mac/)
  assert.doesNotMatch(html, /Ana Gómez/)
})

test('8 · la cabecera de la ficha dice el plan del negocio, no su número interno', () => {
  const html = dibujar(createElement(CustomerPageShell, { negocio: CABECERA_EJEMPLO }, createElement('div')), `/admin/customers/${WS_EJEMPLO}`)
  assert.match(html, />MaKo Pro</)
  assert.doesNotMatch(html, /Negocio #/)
})
