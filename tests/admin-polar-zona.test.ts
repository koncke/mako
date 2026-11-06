// =============================================================================
// Admin › Analytics y Usage de la ficha: un server en UTC y un navegador en Argentina dibujan el MISMO mes (6/11/2026)
// =============================================================================
// Punto 5 de la revisión del Cerebro (docs/admin/revision-cerebro-6-11.md): las fechas se armaban en el server (UTC) y se
// dibujaban en el navegador (Argentina). 1/11 00:00 UTC es el 31/10 a las 21:00 de Argentina: el último mes de Metrics decía
// «oct 2026», «Este mes» quedaba vacío, el CSV salía con 2026-10-31, y en Costs y en Usage cada día salía con la fecha
// anterior. En local no se veía: server y navegador compartían la zona. Lo que fija este archivo, con DOS procesos de verdad
// (tests/_admin-polar-zona-hijo.ts): uno con TZ=UTC arma lo que cada página le pasa a su vista, y otro con
// TZ=America/Argentina/Buenos_Aires lo recibe (con cada `Date` como el instante que viaja por React) y hace lo del navegador.
//   1. lo que viaja del server no lleva ningún `Date` (meses y días como texto);
//   2. Metrics: el último mes es «nov 2026», el primero de los 12 está, «Este mes» trae noviembre con su plata y el CSV dice
//      2026-11-01; y la página de verdad (MetricsPage, dibujada en Argentina) dice el período de cada gráfico sin correrse, los
//      grupos en inglés (punto 39), «Puede faltar algo» (punto 42) y la grilla sin la tercera columna (punto 40);
//   3. Costs: cada día con su fecha (del «01 nov» al «06 nov», hoy), el gasto del 1 en el 1, el mes de las comparaciones del 1
//      al 30 de noviembre, y la pantalla con lo cobrado y el «AI margin» (punto 12), las secciones en inglés (punto 39) y
//      «Puede faltar algo» (punto 42);
//   4. Usage: cada punto del gráfico con su día; y Events (dibujado) dice «Puede faltar algo» (punto 42).
// (El `process.env.TZ` de un test no se cambia en caliente: por eso son procesos aparte.)
//
// Correr: node --import tsx --test tests/admin-polar-zona.test.ts
//
// Probado rompiéndolo el 6/11/2026 (base 4/0; restaurado de memoria). Cada rotura, sola:
//   · `vistaDeMetricas` vuelve a pasar los períodos armados (`data: metricasDeIngresos(…)` en lo que viaja) → 3/1 (1)
//   · `inicioDeMes` arma el mes con `Date.UTC` (la medianoche UTC del server)                             → 2/2 (2, 3)
//   · `metricasDeCostos` arma cada día con `Date.UTC`                                                       → 3/1 (3)
//   · `rangoDelMes` desde el ISO UTC del mes (`new Date('2026-11-01T00:00:00Z')`)                           → 3/1 (3)
//   · `cubetaDe` vuelve a devolver la medianoche UTC en ISO (`d.toISOString()`)                            → 3/1 (4)
//   · `fechaDeEje` lee el día con `new Date(value)`                                                         → 3/1 (4)
//   · CostsPage vuelve a titular «Desglose»                                                                 → 3/1 (3)
//   · MetricsPage vuelve a «No pude leer todo: los números pueden quedarse cortos»                          → 3/1 (2)
//   · CostsPage vuelve a «No pude leer todo»                                                                → 3/1 (3)
//   · MetricGroup vuelve a `2xl:grid-cols-3`                                                                → 3/1 (2)
//   · EventsPage vuelve a «No pude leer todo: pueden faltar eventos»                                        → 3/1 (4)
// Y un cambio sin efecto (renombrar la local `periodos` del hijo) la deja en 4/0.
// (Lo de la pestaña LLM de Costs, «By Model» y «By Vendor», no se dibuja sin abrirla: Radix no monta una pestaña cerrada.)
// =============================================================================

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = fileURLToPath(new URL('..', import.meta.url))
const HIJO = join(RAIZ, 'tests/_admin-polar-zona-hijo.ts')

const correr = (modo: 'server' | 'navegador', tz: string, entrada?: string): string =>
  execFileSync(process.execPath, ['--import', 'tsx', '--no-warnings', HIJO, modo], {
    cwd: RAIZ,
    env: { ...process.env, TZ: tz },
    input: entrada,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    timeout: 120_000,
  })

type DelServer = { fechas: number; zona: string; payload: string }
type DelNavegador = {
  zona: string
  metricas: { primero: string; ultimo: string; meses: number; esteMes: string[]; revenueEsteMes: number | null; csvUltimo: string; html: string }
  costos: { dias: string[]; gastoDel1: number; desde: number[]; hasta: number[]; html: string }
  uso: string[]
  eventos: string
}

let server: DelServer | null = null
let navegador: DelNavegador | null = null
const lados = () => {
  if (!server) server = JSON.parse(correr('server', 'UTC')) as DelServer
  if (!navegador) navegador = JSON.parse(correr('navegador', 'America/Argentina/Buenos_Aires', server.payload)) as DelNavegador
  return { server, navegador }
}

test('1. lo que el server le pasa a la vista (Metrics, Costs, Usage) no lleva ningún Date', () => {
  const { server, navegador } = lados()
  assert.equal(server.zona, 'UTC', 'el server corre en UTC (como en producción)')
  assert.match(navegador.zona, /Buenos_Aires/, 'y el navegador en Argentina')
  assert.equal(server.fechas, 0, 'meses y días viajan como texto: un Date armado en UTC se dibuja corrido en Argentina')
})

test('2. Metrics: noviembre se dibuja «nov», «Este mes» trae noviembre y el CSV dice 2026-11-01', () => {
  const { metricas } = lados().navegador
  assert.equal(metricas.meses, 12)
  assert.equal(metricas.ultimo, 'nov 2026', 'el último mes es el en curso')
  assert.equal(metricas.primero, 'dic 2025', 'el primero de los 12 sigue estando')
  assert.deepEqual(metricas.esteMes, ['nov 2026'], '«Este mes» no queda vacío ni trae octubre')
  assert.equal(metricas.revenueEsteMes, 10_300, 'y su plata es la de noviembre (US$ 103)')
  assert.equal(metricas.csvUltimo, '2026-11-01', 'el CSV con el primer día del mes, no el 31/10')
  // La página de verdad (MetricsPage), dibujada en Argentina con lo que le pasó el server: arma sus fechas ella.
  assert.match(metricas.html, /dic 2025\s–\s1 nov 2026/, 'cada gráfico dice su período del primer mes al último, sin correrse')
  assert.doesNotMatch(metricas.html, /\b(30|31) (nov 2025|oct 2026)/, 'ningún borde cae el día anterior')
  for (const grupo of ['Revenue', 'Orders', 'Subscriptions', 'Cancellations', 'Unit Economics']) {
    assert.ok(metricas.html.includes(`>${grupo}</h2>`), `el grupo «${grupo}», en inglés como en Polar (punto 39)`)
  }
  assert.ok(metricas.html.includes('Puede faltar algo') && metricas.html.includes('Reportar a Soporte'), 'lo que no se pudo leer, con el título de siempre (punto 42)')
  assert.ok(!metricas.html.includes('2xl:grid-cols-3'), 'la grilla no pasa a tres columnas (punto 40)')
})

test('3. Costs: cada día con su fecha, las comparaciones de noviembre y la pantalla con «AI margin» y las secciones en inglés', () => {
  const { costos } = lados().navegador
  assert.deepEqual(costos.dias, ['01 nov', '02 nov', '03 nov', '04 nov', '05 nov', '06 nov'], 'del 1 a hoy, cada uno en su día')
  assert.equal(costos.gastoDel1, 25, 'el gasto del 1 (US$ 0,25) cae en el 1')
  assert.deepEqual(costos.desde, [2026, 11, 1], 'el mes de las comparaciones arranca el 1 de noviembre')
  assert.deepEqual(costos.hasta, [2026, 11, 30], 'y termina el 30')
  const h = costos.html
  assert.ok(h.includes('AI margin') && h.includes('99%'), 'el margen del mes: (103 − 0,75) / 103')
  assert.match(h, /US\$\s103,00/, 'lo cobrado del mes')
  assert.ok(h.includes('sólo resta la IA por API'), 'y lo que el margen no resta')
  assert.ok(!h.includes('Gross margin') && !h.includes('Margen bruto'), 'no se llama margen bruto')
  for (const titulo of ['Breakdown', 'Changes']) assert.ok(h.includes(titulo), `la sección «${titulo}», como en Polar`)
  for (const viejo of ['Desglose', 'Cambios']) assert.ok(!h.includes(`>${viejo}<`), `sin «${viejo}»`)
  assert.ok(h.includes('Puede faltar algo') && h.includes('Reportar a Soporte'), 'lo que no se pudo leer, con el título de siempre (punto 42)')
})

test('4. Usage: cada punto del gráfico con su día; y Events avisa lo que no leyó con el título de siempre', () => {
  assert.deepEqual(lados().navegador.uso, ['01 nov', '05 nov'])
  const ev = lados().navegador.eventos
  assert.ok(ev.includes('Puede faltar algo') && ev.includes('Reportar a Soporte'), 'Events: «Puede faltar algo» (punto 42)')
})
