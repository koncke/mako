// =============================================================================
// Admin › Customers (el porte de Polar): las funciones puras que arman la lista, el crecimiento, Top Customers, At Risk y
// Cost Drivers (app/admin/_polar/datos/clientes.ts), y que cada página del área pase por la puerta del super admin.
// =============================================================================
// Correr: node --import tsx --test tests/admin-polar-clientes.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (6/11/2026). Base: 10 pass / 0 fail. Cada rotura, restaurada después (y la base otra vez 10/0):
//   · `clientesEnRiesgo`: el `<` de la prioridad dado vuelta (gana el motivo menos grave)           → 9/1 (prioridad)
//   · `clientesEnRiesgo`: sin la condición de «Dejó de pagar» (`f.estado === 'activo' && !plan…`)  → 9/1 (cortado)
//   · `costosPorCliente`: sin el `if (!atribuible) return …` (el corte de Claude se mostraba)        → 9/1 (atribuible)
//   · `topClientes`: el rango sin el `p.fecha > hasta`                                              → 9/1 (rango)
//   · `crecimientoDeClientes`: sin contar los de antes del primer período en el total               → 9/1 (crecimiento)
//   · `vistaDeAtRisk`: sin el corte por la lectura de ingresos (daba «Nada en riesgo»)               → 9/1 (no pude leer)
//   · cost-drivers/page.tsx: una lectura (`void leerCostos(…)`) antes de `exigirSuperAdmin()`        → 9/1 (puerta)
//   · un `import … from '@/app/admin/_polar/datos/metricas'` (metricasDeIngresos) en CustomersOverview → 9/1 (sin ingresos)
//   · y un cambio sin efecto (renombrar la función local `poner` de clientesEnRiesgo)              → 10/0

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  clientesEnRiesgo,
  costosPorCliente,
  crecimientoDeClientes,
  datosDeTop,
  filasDeExportacion,
  filtrarClientes,
  filtroDeParam,
  listaDeClientes,
  ordenDeParam,
  primerAlta,
  topClientes,
  vistaDeAtRisk,
  vistaDeCostos,
  vistaDeTop,
  WS_VALIDO,
} from '../app/admin/_polar/datos/clientes'
import { AT_RISK_EJEMPLO, COSTOS_EJEMPLO, LISTA_EJEMPLO, OVERVIEW_EJEMPLO, TOP_EJEMPLO } from '../app/admin/_polar/datos/ejemplo/clientes'
import { armarCsv } from '../lib/csv-celda'
import type { FilaCliente } from '../lib/clientes-plataforma'

const RAIZ = fileURLToPath(new URL('..', import.meta.url))
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n')
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')

type Fila = Pick<FilaCliente, 'ws' | 'nombre' | 'creado' | 'capa' | 'estado' | 'motivoRiesgo' | 'sinEntrar' | 'mrrUsd' | 'planAManoTxt' | 'segmentos'>
const fila = (ws: number, nombre: string, creado: string, extra: Partial<Fila> = {}): Fila => ({
  ws, nombre, creado, capa: 'completo', estado: 'activo', motivoRiesgo: null, sinEntrar: 1, mrrUsd: 0, planAManoTxt: null, segmentos: ['cliente'],
  ...extra,
})

test('la lista: buscar sin tildes, filtrar activos e inactivos y ordenar como Polar', () => {
  const lista = listaDeClientes([
    fila(3, 'Óptica Visión Clara', '2026-09-01T12:00:00Z'),
    fila(7, 'Estudio Norte', '2026-04-12T15:00:00Z'),
    fila(9, 'Gimnasio Fuerza Sur', '2026-10-01T12:00:00Z', { estado: 'pausado' }),
  ])
  assert.equal(lista[0].plan.length > 0, true, 'cada negocio lleva el nombre de su plan (para el CSV)')
  const ws = (l: { ws: number }[]) => l.map((c) => c.ws)
  assert.deepEqual(ws(filtrarClientes(lista, { query: 'optica', sorting: '-created_at', filter: 'all' })), [3], 'busca sin tildes')
  assert.deepEqual(ws(filtrarClientes(lista, { query: '7', sorting: '-created_at', filter: 'all' })), [7], 'y por el número exacto del negocio')
  assert.deepEqual(ws(filtrarClientes(lista, { query: '', sorting: '-created_at', filter: 'all' })), [9, 3, 7], 'los más nuevos primero por default')
  assert.deepEqual(ws(filtrarClientes(lista, { query: null, sorting: 'created_at', filter: 'all' })), [7, 3, 9])
  assert.deepEqual(ws(filtrarClientes(lista, { query: null, sorting: 'name', filter: 'all' })), [7, 9, 3])
  assert.deepEqual(ws(filtrarClientes(lista, { query: null, sorting: '-name', filter: 'all' })), [3, 9, 7])
  assert.deepEqual(ws(filtrarClientes(lista, { query: null, sorting: '-created_at', filter: 'active' })), [3, 7])
  assert.deepEqual(ws(filtrarClientes(lista, { query: null, sorting: '-created_at', filter: 'inactive' })), [9])
  assert.equal(ordenDeParam('email'), '-created_at', 'un orden que MaKo no tiene (el email de Polar) cae al default')
  assert.equal(ordenDeParam('name'), 'name')
  assert.equal(filtroDeParam('cualquiera'), 'all')
  assert.equal(filtroDeParam('inactive'), 'inactive')
  assert.ok(WS_VALIDO.test('21') && !WS_VALIDO.test('0') && !WS_VALIDO.test('2a'))
})

test('el CSV de la lista: sin personas ni plata, y armado por lib/csv-celda (una fórmula no se ejecuta)', () => {
  const lista = listaDeClientes([fila(5, '=HYPERLINK("x")', '2026-01-02T00:00:00Z')])
  const filas = filasDeExportacion(lista)
  assert.deepEqual(filas[0], ['ID', 'Nombre', 'Plan', 'Estado', 'Creado'])
  assert.deepEqual(filas[1].slice(0, 1), [5])
  assert.equal(filas[1][4], '2026-01-02')
  const csv = armarCsv(filas)
  assert.ok(csv.includes(`'=HYPERLINK`), 'el nombre que arranca con = sale con el apóstrofo de csv-celda')
})

test('el crecimiento: los nuevos de cada período y el total, contando los de antes del primero', () => {
  const creados = ['2026-01-15T12:00:00', '2026-03-02T12:00:00', '2026-03-20T12:00:00', 'no es una fecha', '2026-05-01T12:00:00']
  const p = crecimientoDeClientes(creados, new Date(2026, 2, 10), new Date(2026, 4, 20), 'month')
  assert.deepEqual(p.map((x) => [x.timestamp.getMonth(), x.new_customers, x.total_customers]), [
    [2, 2, 3],
    [3, 0, 3],
    [4, 1, 4],
  ], 'marzo: 2 nuevos y 3 en total (el de enero ya estaba)')
  const dias = crecimientoDeClientes([], new Date(2026, 10, 1), new Date(2026, 10, 5, 23), 'day')
  assert.equal(dias.length, 5, 'un período por día, sin negocios igual')
  assert.equal(primerAlta(creados, 0), new Date('2026-01-15T12:00:00').toISOString())
  assert.equal(primerAlta([], 1_000), new Date(1_000).toISOString(), 'sin altas, All Time arranca ahora')
})

test('Top Customers: lo pagado en el rango, el que más primero; sin dólares o sin dueño no se cuenta', () => {
  const datos = datosDeTop({
    clientes: [
      { clave: 'ws:2', ws: 2, nombre: 'Estudio Norte', leadId: null, total: 0, sinDolares: 0, pagos: 0, primerPago: null, ultimoPago: null, mrr: 0, estado: 'al-dia', proximo: null, diasAtraso: null },
    ],
    entradas: [
      { fecha: '2026-10-01', usd: 100, medio: null, recurrente: true, nombre: 'Estudio Norte', cliente: 'ws:2' },
      { fecha: '2026-11-01', usd: 100, medio: null, recurrente: true, nombre: 'Estudio Norte', cliente: 'ws:2' },
      { fecha: '2026-10-20', usd: 300, medio: null, recurrente: false, nombre: 'Clínica Sonríe', cliente: 'ws:4' },
      { fecha: '2026-10-21', usd: 50, medio: null, recurrente: false, nombre: 'Ana Gómez', cliente: 'lead:9' },
      { fecha: '2026-10-22', usd: null, medio: null, recurrente: false, nombre: 'Sin dólares', cliente: 'ws:5' },
      { fecha: '2026-10-23', usd: 999, medio: null, recurrente: false, nombre: 'Sin dueño' },
    ],
  })
  assert.equal(datos.pagos.length, 4, 'el pago sin dólares y el sin clave quedan afuera')
  const todo = topClientes(datos, null, null)
  assert.deepEqual(todo.map((c) => [c.clave, c.ws, c.pagos, c.totalCentavos]), [
    ['ws:4', 4, 1, 30_000],
    ['ws:2', 2, 2, 20_000],
    ['lead:9', null, 1, 5_000],
  ], 'el ws sale de la clave; un lead sin cuenta no tiene ficha')
  const octubre = topClientes(datos, '2026-10-01', '2026-10-31')
  assert.deepEqual(octubre.map((c) => [c.clave, c.pagos]), [['ws:4', 1], ['ws:2', 1], ['lead:9', 1]], 'el pago de noviembre no entra en octubre')
  assert.deepEqual(topClientes(datos, '2026-11-02', null), [], 'un período sin pagos: la lista vacía')
  assert.equal(topClientes(datos, null, null, 1).length, 1)
  const vista = vistaDeTop({ ok: true, datos: { entradas: [{ fecha: '2026-03-04', usd: 10, medio: null, recurrente: false, nombre: 'X', cliente: 'ws:2' }], clientes: [] }, avisos: [] }, 0)
  assert.equal(vista.desde, new Date('2026-03-04T00:00:00').toISOString(), 'sin las altas, «All Time» arranca en el primer pago')
  assert.equal(vistaDeTop({ ok: false, error: 'caído' }, 0).datos, null, 'sin la lectura: «no pude leer», no una lista vacía')
})

test('At Risk: un renglón por negocio con su motivo más grave, y «Dejó de pagar» sólo si sigue activo sin plan a mano', () => {
  const filas = [
    fila(1, 'Estudio Norte', '2026-01-01T00:00:00Z', { motivoRiesgo: 'sin-uso', sinEntrar: 19, mrrUsd: 470 }),
    fila(2, 'Taller Ruta 9', '2026-01-01T00:00:00Z', { motivoRiesgo: 'cobro', mrrUsd: 970 }),
    fila(3, 'Gimnasio Sur', '2026-01-01T00:00:00Z', { estado: 'pausado', motivoRiesgo: 'pausado' }),
    fila(4, 'Floristería Pétalo', '2026-01-01T00:00:00Z'),
    fila(5, 'Óptica Clara', '2026-01-01T00:00:00Z', { planAManoTxt: 'Gratis hasta el 1 de mayo de 2027' }),
    fila(6, 'Panadería Espiga', '2026-01-01T00:00:00Z', { motivoRiesgo: 'sin-uso', sinEntrar: null }),
  ]
  const ingresos = [
    { clave: 'ws:1', ws: 1, nombre: 'Estudio Norte', estado: 'atrasado' as const, mrr: 470, diasAtraso: 4 },
    { clave: 'ws:4', ws: 4, nombre: 'Floristería Pétalo', estado: 'cortado' as const, mrr: 0, diasAtraso: null },
    { clave: 'ws:5', ws: 5, nombre: 'Óptica Clara', estado: 'cortado' as const, mrr: 0, diasAtraso: null },
    { clave: 'ws:3', ws: 3, nombre: 'Gimnasio Sur', estado: 'cortado' as const, mrr: 0, diasAtraso: null },
    { clave: 'lead:8', ws: null, nombre: 'Ana Gómez', estado: 'atrasado' as const, mrr: 100, diasAtraso: 0 },
  ]
  const r = clientesEnRiesgo(filas, ingresos)
  assert.deepEqual(r.map((c) => [c.clave, c.motivo, c.texto, c.grave]), [
    ['ws:1', 'atrasado', 'Atrasado 4 días', true],
    ['lead:8', 'atrasado', 'Vence hoy', true],
    ['ws:2', 'cobro', 'Cobro fallido', true],
    ['ws:3', 'pausado', 'Pausado', false],
    ['ws:4', 'cortado', 'Dejó de pagar', false],
    ['ws:6', 'sin-uso', 'Nadie entró nunca', false],
  ], 'el atrasado le gana a «sin uso»; el pausado a «dejó de pagar»; el de plan a mano no sale')
  assert.equal(r.find((c) => c.clave === 'ws:2')?.montoCentavos, 97_000)
  assert.equal(r.find((c) => c.clave === 'ws:4')?.montoCentavos, null, 'el que dejó de pagar no tiene un monto que afirmar')
  assert.equal(r.find((c) => c.clave === 'lead:8')?.plan, null)
  assert.ok((r.find((c) => c.clave === 'ws:1')?.plan ?? '').length > 0)
  assert.equal(clientesEnRiesgo(filas, ingresos, 2).length, 2)
})

test('At Risk sin la lectura de los ingresos es «no pude leer», nunca «Nada en riesgo»', () => {
  const v = vistaDeAtRisk({ ok: true, datos: { filas: [] }, avisos: ['los onboardings: caído'] }, { ok: false, error: 'base caída' })
  assert.equal(v.atRisk, null)
  assert.equal(v.error, 'base caída')
  const ok = vistaDeAtRisk({ ok: true, datos: { filas: [] }, avisos: ['los onboardings: caído'] }, { ok: true, datos: { entradas: [], clientes: [] }, avisos: ['los cobros de la pasarela: x'] })
  assert.deepEqual(ok.atRisk, [])
  assert.deepEqual(ok.avisos, ['los onboardings: caído', 'los cobros de la pasarela: x'], 'lo que no se leyó viaja a la pantalla')
})

test('Cost Drivers: el corte por negocio sólo si es atribuible, con su parte del gasto total', () => {
  const corte = (clave: string, costUsd: number, atribuible = true) => ({ clave, llamadas: 10, tokens: 100, costUsd, atribuible })
  const nombres = new Map([[2, 'Estudio Norte'], [4, 'Clínica Sonríe'], [6, 'Sin gasto']])
  const v = costosPorCliente({ periodo: '2026-11', costUsd: 4, porWorkspace: [corte('2', 1), corte('4', 2), corte('9', 1), corte('6', 0)] }, nombres)
  assert.equal(v.atribuible, true)
  assert.deepEqual(v.clientes.map((c) => [c.ws, c.share, c.costoCentavos]), [[4, 0.5, 200], [2, 0.25, 100]],
    'la plataforma (9) cuenta en el total y no es un negocio de la lista; el que no gastó no sale')
  const no = costosPorCliente({ periodo: '2026-11', costUsd: 4, porWorkspace: [corte('1', 4, false)] }, nombres)
  assert.deepEqual(no, { periodo: '2026-11', atribuible: false, clientes: [] }, 'el gasto de Claude anotado todo en un workspace no se muestra')
  const caido = vistaDeCostos({ ok: true, datos: { filas: [] }, avisos: [] }, { ok: false, error: 'x' }, '2026-11')
  assert.equal(caido.costos, null)
  assert.equal(caido.mesDeCostos, 'nov 2026')
})

test('los ejemplos se arman con las funciones de verdad y no nombran a nadie real', () => {
  assert.equal(LISTA_EJEMPLO.length, 9, 'los nueve negocios de app/admin/_polar/datos/ejemplo/negocios.ts')
  assert.equal(OVERVIEW_EJEMPLO.creados.length, 9)
  assert.ok((OVERVIEW_EJEMPLO.atRisk ?? []).length <= 5)
  assert.ok((TOP_EJEMPLO.datos?.pagos.length ?? 0) > 0)
  assert.ok((AT_RISK_EJEMPLO.atRisk ?? []).some((c) => c.motivo === 'atrasado'))
  assert.equal(COSTOS_EJEMPLO.costos?.clientes.length, 3)
  const fuente = leer('app/admin/_polar/datos/ejemplo/clientes.ts')
  for (const real of ['Mauricio', 'Leila', 'Florencia', 'Leandro', 'Código Inmobiliario', 'Brigitte']) {
    assert.ok(!fuente.includes(real), `el ejemplo no nombra a ${real}`)
  }
})

const PAGINAS = [
  'app/admin/(polar)/customers/layout.tsx',
  'app/admin/(polar)/customers/page.tsx',
  'app/admin/(polar)/customers/top/page.tsx',
  'app/admin/(polar)/customers/at-risk/page.tsx',
  'app/admin/(polar)/customers/cost-drivers/page.tsx',
]

test('cada página de Customers: dinámica y con la puerta del super admin como PRIMERA sentencia', () => {
  for (const p of PAGINAS) {
    const src = sinComentarios(leer(p))
    assert.match(src, /export const dynamic = 'force-dynamic'/, `${p}: dinámica`)
    assert.match(src, /export default async function \w*\([^)]*\)[^{]*\{\s*await exigirSuperAdmin\(\)/, `${p}: exigirSuperAdmin() antes de leer`)
  }
})

const AREA = [
  ...PAGINAS,
  'app/admin/(polar)/customers/top/TopCustomersPage.tsx',
  'app/admin/(polar)/customers/at-risk/AtRiskPage.tsx',
  'app/admin/(polar)/customers/cost-drivers/CostDriversPage.tsx',
  'app/admin/_polar/web/Customer/CustomerListSidebar.tsx',
  'app/admin/_polar/web/Customer/CustomersOverview.tsx',
  'app/admin/_polar/web/Customer/CustomerGrowthChart.tsx',
  'app/admin/_polar/web/Customer/TopCustomersList.tsx',
  'app/admin/_polar/web/Customer/AtRiskList.tsx',
  'app/admin/_polar/web/Customer/TopCostCustomersList.tsx',
  'app/admin/_polar/web/Customer/CreateCustomerModal.tsx',
  'app/admin/_polar/datos/clientes.ts',
]

test('Customers no importa las pantallas viejas ni el gráfico de ingresos (Martín: nada de ingreso mensual en Customers)', () => {
  const VIEJAS = /from ['"]@\/app\/(?:admin\/(?:_studio|usuarios|ingresos|cobros\/_components|cobros\/recibo|actividad|errores|AdminView)|customers\/)/
  const INGRESOS = /from ['"][^'"]*(?:datos\/metricas|Metrics\/MetricChartBox|Metrics\/MiniMetricChartBox)['"]|metricasDeIngresos/
  for (const p of AREA) {
    const src = sinComentarios(leer(p))
    assert.doesNotMatch(src, VIEJAS, `${p}: no importa una pantalla vieja`)
    if (p !== 'app/admin/_polar/datos/clientes.ts') assert.doesNotMatch(src, INGRESOS, `${p}: no dibuja ingresos`)
  }
})
