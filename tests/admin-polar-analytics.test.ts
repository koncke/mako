// =============================================================================
// Admin › Analytics (Metrics, Events y Costs): las cuentas que arman cada vista, EJECUTADAS (6/11/2026)
// =============================================================================
// La pantalla es la de Polar (app/admin/(polar)/analytics, app/admin/_polar/web/Metrics|Events); los números salen de las
// funciones puras de app/admin/_polar/datos/{metricas,eventos,costos}.ts. Lo que fija:
//   1. Metrics: las suscripciones activas de cada mes son los clientes con MRR al cierre (lo mismo que `mrrPorClienteEn` de
//      las reglas de ingresos), las nuevas y las cortadas salen de los movimientos, y los pagos de `entradas`;
//   2. sin `entradas` ni `movimientos`, esas métricas NO salen (no se dibujan en cero);
//   3. el rango recorta meses enteros y rehace los totales con la regla de cada métrica (suma, último, promedio);
//   4. los rangos mensuales no ofrecen un rango que arranca antes del primer mes leído;
//   5. Events: `?tipo=error` abre crashes y reportes, `?tipo=agente` las sesiones del agente; cada pago lleva a su negocio
//      por la clave (no por el nombre); lo que un lector deja afuera por su tope se dice; los filtros, el conteo por tipo y
//      las barras del histograma;
//   6. Costs: la parte de cada feature y su cambio contra el mes anterior, «Changes» vacío sin mes anterior, el gasto por día
//      con su acumulado, y SIN el corte por negocio (vive en Customers › Cost Drivers: un dato, un lugar; 6/11/2026);
//   7. el CSV de las métricas va en dólares y por el armador de la app;
//   8. cada page.tsx de Analytics pregunta `exigirSuperAdmin()` ANTES de leer, y Events traduce `?tipo=`.
//
// Probado rompiéndolo el 6/11/2026 (base: 8 pasan / 0 fallan; el arnés restaura de memoria). Cada rotura, sola:
//   · `clientesConSuscripcionAl` cuenta a todo cliente con un movimiento (sin `despues > 0`)        → 6/2 (1, 7)
//   · `metricasDeIngresos` pone las de suscripciones aunque no haya `movimientos`                  → 7/1 (2)
//   · `totalesDe` suma también los `stock` (el MRR, el acumulado) en vez de tomar el último         → 5/3 (1, 3, 6)
//   · `rangosMensuales` sin el filtro de `minDate` (ofrece «El año pasado» a medias)               → 7/1 (4)
//   · `ALIAS_TIPO.error` sin 'reporte' (los reportes quedan fuera del link viejo de Errors)        → 7/1 (5)
//   · `eventosDePagos` busca el negocio por el nombre del cliente en vez de su clave               → 7/1 (5)
//   · `armarEventos` sin el corte de las acciones de MaKo al llegar al tope                         → 7/1 (5)
//   · `filtrarEventos` filtra por el primer negocio de un error y no por cualquiera                → 7/1 (5)
//   · `conteoPorTipo` lista también los tipos sin ningún evento                                     → 7/1 (5)
//   · `armarCostos` vuelve a armar `porNegocio` (el «By Customer» de Costs, que vive en Cost Drivers) → 7/1 (6)
//   · `cambiosDe` compara contra cero sin mes anterior                                              → 7/1 (6)
//   · `filasCsvDeMetricas` deja la plata en centavos                                                → 7/1 (7)
//   · events/page.tsx lee (`void leerEventos()`) antes de `exigirSuperAdmin()`                      → 7/1 (8)
// =============================================================================

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  calcularIngresos, mrrPorClienteEn, periodosDe, tramosDe,
  type ClienteIngreso, type PagoIngreso,
} from '../lib/admin-ingresos-reglas'
import { metricasDeIngresos, propsDeMetricas, rangosMensuales, recortarMetricas } from '../app/admin/_polar/datos/metricas'
import {
  armarEventos, conteoPorTipo, cortesVisibles, cubetas, filtrarEventos, MAX_BARRAS, tiposDeUrl, type EntradasEventos,
} from '../app/admin/_polar/datos/eventos'
import { armarCostos, cambiosDe, diasDelMes, filasDe, mesAnterior, metricasDeCostos } from '../app/admin/_polar/datos/costos'
import { filasCsvDeMetricas, gruposConDatos } from '../app/admin/_polar/web/utils/metrics'
import type { ResumenPeriodo } from '../lib/costos-ia'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n')
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')

// ── Un universo de pagos ficticio (AGENTS.md: nada de datos reales en tests/) ─────────────────────────────────────────
const HOY = '2026-11-06'
let n = 0
const pago = (cliente: string, fecha: string, usd: number | null, recurrente = true): PagoIngreso => ({
  id: `p:${++n}`, cliente, suscripcion: recurrente ? `sub:${cliente}` : null, fecha, usd, medio: 'transferencia', concepto: null,
})
const QUIEN = new Map<string, ClienteIngreso>([
  ['ws:1', { clave: 'ws:1', nombre: 'Estudio Norte', ws: 1, leadId: 1 }],
  ['ws:2', { clave: 'ws:2', nombre: 'Panadería Sol', ws: 2, leadId: 2 }],
  ['ws:3', { clave: 'ws:3', nombre: 'Estudio Norte', ws: 3, leadId: 3 }], // se llama igual que el 1, a propósito
  ['lead:9', { clave: 'lead:9', nombre: 'Ana Gómez', ws: null, leadId: 9 }],
])
const PAGOS: PagoIngreso[] = [
  // ws:1 paga de marzo a noviembre.
  ...['2026-03-05', '2026-04-05', '2026-05-05', '2026-06-05', '2026-07-05', '2026-08-05', '2026-09-05', '2026-10-05', '2026-11-05'].map((f) => pago('ws:1', f, 100)),
  // ws:2 paga mayo y junio, y se corta (vence el 10/07, pasa la gracia).
  pago('ws:2', '2026-05-10', 50), pago('ws:2', '2026-06-10', 50),
  // ws:3 entra en septiembre.
  pago('ws:3', '2026-09-20', 200), pago('ws:3', '2026-10-20', 200),
  // Un pago único de alguien sin cuenta, y uno sin dólares.
  pago('lead:9', '2026-08-15', 300, false),
  pago('ws:1', '2026-08-20', null, false),
]
const ING = calcularIngresos(PAGOS, QUIEN, HOY)

test('1. Metrics: suscripciones activas = clientes con MRR al cierre del mes; nuevas, cortadas y pagos de verdad', () => {
  const data = metricasDeIngresos(ING.meses, ING)
  const tramos = tramosDe(periodosDe(PAGOS, HOY), HOY)
  for (const [i, m] of ING.meses.entries()) {
    const [y, mm] = m.mes.split('-').map(Number)
    const fin = m.enCurso ? HOY : new Date(Date.UTC(y, mm, 0)).toISOString().slice(0, 10)
    assert.equal(data.periods[i].active_subscriptions, mrrPorClienteEn(tramos, fin).size, `activas de ${m.mes}`)
  }
  const de = (mes: string) => data.periods[ING.meses.findIndex((m) => m.mes === mes)]
  assert.equal(de('2026-06').active_subscriptions, 2)
  assert.equal(de('2026-09').new_subscriptions, 1, 'ws:3 empieza en septiembre')
  assert.equal(de('2026-07').churned_subscriptions, 1, 'ws:2 se corta el 10/07')
  assert.equal(de('2026-08').orders, 2, 'agosto: la mensualidad y el pago único (el sin dólares no cuenta)')
  assert.equal(de('2026-08').one_time_products, 1)
  assert.equal(de('2026-08').one_time_products_revenue, 30_000)
  assert.equal(de('2026-10').average_revenue_per_user, 15_000, 'octubre: (100 + 200) / 2 clientes')
  assert.equal(data.totals.active_subscriptions, 2, 'el total de un stock es el último mes')
  assert.equal(data.totals.cumulative_revenue, Math.round(ING.cobradoTotal * 100))
})

test('2. sin `entradas` ni `movimientos`, las métricas que salen de ellos no aparecen (no van en cero)', () => {
  const data = metricasDeIngresos(ING.meses, { cobradoTotal: ING.cobradoTotal })
  for (const slug of ['orders', 'active_subscriptions', 'new_subscriptions', 'average_revenue_per_user'] as const) {
    assert.equal(data.metrics[slug], undefined, `${slug} no se midió`)
    assert.equal(data.periods[0][slug], undefined)
  }
  assert.ok(data.metrics.monthly_recurring_revenue, 'el MRR sí')
  const grupos = gruposConDatos(data.metrics).map((g) => g.slug)
  assert.deepEqual(grupos, ['revenue', 'subscriptions'], 'Orders, Cancellations y Unit Economics no se dibujan vacíos')
  assert.deepEqual(gruposConDatos(metricasDeIngresos(ING.meses, ING).metrics).map((g) => g.slug), ['revenue', 'orders', 'subscriptions', 'cancellations', 'unit-economics'])
})

test('3. el rango recorta meses enteros y rehace los totales con la regla de cada métrica', () => {
  const data = metricasDeIngresos(ING.meses, ING)
  const r = recortarMetricas(data, new Date(2026, 5, 15), new Date(2026, 7, 2)) // 15/06 → 02/08: junio, julio, agosto
  assert.deepEqual(r.periods.map((p) => p.timestamp.getMonth() + 1), [6, 7, 8])
  assert.equal(r.totals.revenue, r.periods.reduce((s, p) => s + (p.revenue ?? 0), 0), 'un flujo se suma')
  assert.equal(r.totals.monthly_recurring_revenue, r.periods[2].monthly_recurring_revenue, 'un stock es el último')
  assert.equal(r.totals.cumulative_revenue, r.periods[2].cumulative_revenue, 'lo acumulado, al final del rango')
  const pagos = r.periods.reduce((s, p) => s + (p.orders ?? 0), 0)
  assert.equal(r.totals.average_order_value, Math.round((r.totals.revenue ?? 0) / pagos), 'el promedio se rehace con las sumas')
})

test('4. los rangos mensuales: el primero son todos los meses leídos, y no se ofrece uno que arranca antes', () => {
  const props = propsDeMetricas({ ...ING, avisos: ['x'] })
  assert.equal(props.earliestDateISOString, `${ING.meses[0].mes}-01`)
  assert.deepEqual(props.avisos, ['x'])
  const min = new Date(2025, 11, 1)
  const rangos = rangosMensuales(min, new Date(2026, 10, 6), 12)
  assert.equal(rangos[0].label, 'Últimos 12 meses')
  assert.ok(!rangos.some((r) => r.slug === 'lastYear'), '2025 arranca antes del primer mes leído')
  assert.ok(!rangos.some((r) => ['today', 'yesterday', 'thisWeek'].includes(r.slug)), 'nada más corto que un mes')
  assert.ok(rangos.every((r, i) => i === 0 || r.value[0] >= min))
})

// ── Events ──────────────────────────────────────────────────────────────────────────────────────────────────────────
const AHORA = new Date('2026-11-06T15:00:00.000Z')
const entradasEventos = (tope = 100): EntradasEventos => ({
  ingresos: { entradas: ING.entradas, clientes: ING.clientes },
  actividad: {
    acciones: [
      { creado: '2026-11-06T10:00:00.000Z', usuario: 7, ws: 1, operacion: 'crear_lead', titulo: 'Crear lead', area: 'crm', canal: 'app', tipo: 'accion', ok: true },
      { creado: '2026-11-05T10:00:00.000Z', usuario: null, ws: 2, operacion: 'enviar_email', titulo: 'Mandar un email', area: 'email', canal: 'app', tipo: 'accion', ok: false },
    ],
    nombres: { 1: 'Estudio Norte', 2: 'Panadería Sol', 3: 'Estudio Norte' },
    personas: [{ id: 7, nombre: 'Laura Pérez', email: 'laura@ejemplo.com', ws: 1, negocio: 'Estudio Norte', creado: '2026-01-01', ultimoLogin: null, rol: 'admin', estado: 'activo' }],
    medido: true,
  },
  errores: {
    errores: [{
      id: 5, titulo: 'Falló el guardado', origen: 'navegador', veces: 3, primeraVez: '2026-11-01T10:00:00.000Z', ultimaVez: '2026-11-04T10:00:00.000Z',
      ruta: '/plan', mensaje: 'x', stack: 'a\nb', navegador: null, negocios: [2, 3], personas: 2, ticketId: null, ticketEstado: null, ticketResueltoAt: null,
    }],
    hayMas: false,
    reportes: [{ id: 9, titulo: 'No baja el CSV', tipo: 'bug', estado: 'abierto', prioridad: 'media', canal: 'app', creado: '2026-11-03T10:00:00.000Z', quien: 'Ana Gómez', negocio: 'Panadería Sol', ws: 2 }],
    nombres: { 2: 'Panadería Sol', 3: 'Estudio Norte' },
  },
  agente: {
    sesiones: [{
      id: 4, workspace_id: 3, sesion_id: 's-4', empezo_en: '2026-11-02T10:00:00.000Z', termino_en: null,
      acta: { titulo: 'Armar una secuencia' }, turnos: Array.from({ length: 8 }, (_, i) => ({ ts: '', texto: `mensaje ${i}` })), redacciones: 0, created_at: '2026-11-02T10:00:00.000Z',
    }],
    nombres: { 3: 'Estudio Norte' },
  },
  avisos: [],
  ahora: AHORA,
  topes: { acciones: tope, reportes: 40, sesiones: 200 },
})

test('5. Events: el link viejo, el negocio de cada evento, lo que quedó afuera y los filtros', () => {
  assert.deepEqual(tiposDeUrl('error'), ['error', 'reporte'], '?tipo=error abre los crashes Y los reportes')
  assert.deepEqual(tiposDeUrl('agente'), ['agente'])
  assert.deepEqual(tiposDeUrl(['agente', 'pago']), ['pago', 'agente'])
  assert.equal(tiposDeUrl('cualquiera'), null)

  const v = armarEventos(entradasEventos())
  const pagosWs3 = v.eventos.filter((e) => e.nombre === 'pago' && e.negocios.some((x) => x.ws === 3))
  assert.equal(pagosWs3.length, 2, 'los pagos de ws:3 van a ws:3, aunque se llame igual que ws:1')
  const unico = v.eventos.find((e) => e.nombre === 'pago' && e.monto === 30_000)!
  assert.deepEqual(unico.negocios, [], 'un pago de alguien sin cuenta no lleva a ningún negocio')
  assert.equal(unico.persona, 'Ana Gómez')
  assert.ok(v.eventos.filter((e) => e.nombre === 'pago').every((e) => e.soloDia), 'un pago no tiene hora')
  const sesion = v.eventos.find((e) => e.nombre === 'agente')!
  assert.equal(sesion.secciones.find((s) => s.titulo === 'Mensajes del cliente')!.lineas.at(-1), 'y 2 mensajes más')
  assert.deepEqual(v.cortes, [], 'ningún lector llegó a su tope')
  assert.deepEqual(v.negocios.map((x) => x.nombre), ['Estudio Norte', 'Estudio Norte', 'Panadería Sol'], 'el filtro de negocios, por nombre')

  const conTope = armarEventos(entradasEventos(2))
  assert.deepEqual(conTope.cortes.map((c) => [c.nombre, c.desde]), [['mako', '2026-11-05T10:00:00.000Z']], 'llegó al tope: antes del 05/11 faltan acciones')
  assert.equal(cortesVisibles(conTope.cortes, new Date('2026-11-06T00:00:00Z')).length, 0)
  assert.equal(cortesVisibles(conTope.cortes, new Date('2026-10-01T00:00:00Z')).length, 1)
  assert.match(armarEventos({ ...entradasEventos(), actividad: { ...entradasEventos().actividad!, medido: false } }).avisos.join(), /todavía no se mide/)

  const rango = { desde: new Date('2026-11-01T00:00:00Z'), hasta: AHORA }
  const delWs3 = filtrarEventos(v.eventos, { ...rango, negocios: [3] })
  assert.ok(delWs3.some((e) => e.nombre === 'error'), 'un error que le pasó a ws:2 y ws:3 aparece filtrando por ws:3')
  assert.deepEqual(filtrarEventos(v.eventos, { ...rango, nombres: tiposDeUrl('error') }).map((e) => e.id), ['error:5', 'reporte:9'])
  assert.deepEqual(filtrarEventos(v.eventos, { ...rango, query: 'GUARDADO' }).map((e) => e.id), ['error:5'], 'buscar no mira mayúsculas')
  assert.deepEqual(filtrarEventos(v.eventos, { ...rango, query: 'panaderia' }).map((e) => e.nombre).sort(), ['error', 'mako', 'reporte'], 'ni tildes')
  assert.equal(filtrarEventos(v.eventos, { ...rango, query: 'gu' }).length, filtrarEventos(v.eventos, rango).length, 'con menos de 3 letras no filtra')
  const asc = filtrarEventos(v.eventos, { ...rango, orden: 'timestamp' })
  assert.ok(asc.every((e, i) => i === 0 || asc[i - 1].timestamp <= e.timestamp))

  const tipos = conteoPorTipo(v.eventos, rango)
  assert.ok(tipos.every((t) => t.occurrences > 0))
  assert.deepEqual(conteoPorTipo(v.eventos, { ...rango, negocios: [2] }).map((t) => t.name), ['mako', 'error', 'reporte'], 'sólo los tipos que tienen algún evento')
  assert.equal(tipos.reduce((s, t) => s + t.occurrences, 0), filtrarEventos(v.eventos, rango).length, 'cuenta todos los tipos, no sólo los elegidos')

  const barras = cubetas(v.eventos, new Date('2026-08-01T00:00:00Z'), AHORA)
  assert.ok(barras.length > 0 && barras.length <= MAX_BARRAS)
  assert.equal(barras.reduce((s, b) => s + b.count, 0), filtrarEventos(v.eventos, { desde: new Date('2026-08-01T00:00:00Z'), hasta: AHORA }).length)
})

// ── Costs ───────────────────────────────────────────────────────────────────────────────────────────────────────────
const corte = (clave: string, llamadas: number, costUsd: number) => ({ clave, llamadas, tokens: 0, costUsd })
const resumen = (porFeature: ReturnType<typeof corte>[], atribuible: boolean, porDia: ReturnType<typeof corte>[] = []): ResumenPeriodo => ({
  periodo: '2026-11', desde: null, hasta: null, filas: 0, llamadas: 0, tokens: 0, costUsd: 0,
  porFeature, porProveedor: [], porModelo: [], porDia,
  porWorkspace: [{ ...corte('2', 3, 1), atribuible }, { ...corte('1', 5, 3), atribuible }],
  mesesDisponibles: ['2026-11', '2026-10'], delNegocio: { llamadas: 0, costUsd: 0 }, delCredito: { llamadas: 0, costUsd: 0 },
})

test('6. Costs: la parte de cada feature, el cambio contra el mes anterior, el corte por negocio sólo si es real', () => {
  assert.equal(mesAnterior('2026-01'), '2025-12')
  const filas = filasDe([corte('a', 10, 3), corte('b', 5, 1), corte('c', 2, 0)], [corte('a', 8, 2)])
  assert.deepEqual(filas.map((f) => f.clave), ['a', 'b'], 'lo que no gastó no se lista')
  assert.equal(filas[0].share, 0.75)
  assert.equal(filas[0].costo, 300)
  assert.equal(filas[0].pct, 50)
  assert.equal(filas[1].pct, null, 'sin gasto antes, no hay porcentaje')
  assert.equal(filas[0].promedio, 30)
  assert.deepEqual(cambiosDe([corte('a', 1, 3)], null), [], 'sin mes anterior, ningún cambio')
  assert.deepEqual(cambiosDe([corte('a', 1, 3), corte('b', 1, 1)], [corte('a', 1, 3)]).map((f) => f.clave), ['b'])


  assert.equal(diasDelMes('2026-11', AHORA).length, 6, 'el mes en curso, hasta hoy')
  assert.equal(diasDelMes('2026-02', AHORA).length, 28)
  const m = metricasDeCostos([corte('2026-11-02', 1, 0.5), corte('2026-11-05', 1, 0.25)], '2026-11', AHORA)
  assert.deepEqual(m.periods.map((p) => p.costs), [0, 50, 0, 0, 25, 0])
  assert.deepEqual(m.periods.map((p) => p.cumulative_costs), [0, 50, 50, 50, 75, 75])
  assert.equal(m.totals.costs, 75)
  assert.equal(m.totals.cumulative_costs, 75)

  const v = armarCostos({ periodo: '2026-11', actual: resumen([corte('a', 1, 1)], true), previo: null, hoy: AHORA, avisos: ['x'] })
  assert.equal('porNegocio' in v, false, 'el gasto por negocio vive en Customers › Cost Drivers, no en Costs')
  assert.equal(v.previo, null)
  assert.deepEqual(v.cambios, [])
  assert.deepEqual(v.meses, ['2026-11', '2026-10'])
})

test('7. el CSV de las métricas: una fila por período, la plata en dólares, por el armador de la app', () => {
  const data = metricasDeIngresos(ING.meses, ING)
  const filas = filasCsvDeMetricas(data, ['revenue', 'active_subscriptions'])
  assert.deepEqual(filas[0], ['Fecha', 'Ingresos', 'Suscripciones activas'], 'los encabezados, en español')
  const oct = filas.find((f) => f[0] === '2026-10-01')!
  assert.deepEqual(oct.slice(1), [300, 2])
  assert.match(sinComentarios(leer('app/admin/_polar/web/utils/metrics.ts')), /from '@\/lib\/csv-celda'/)
  assert.doesNotMatch(sinComentarios(leer('app/admin/_polar/web/Metrics/MetricChartBox.tsx')), /\.join\(','\)/, 'el CSV de un gráfico no se arma a mano')
})

const paginas = (dir: string): string[] =>
  readdirSync(join(RAIZ, dir)).flatMap((f) => {
    const p = join(dir, f)
    return statSync(join(RAIZ, p)).isDirectory() ? paginas(p) : f === 'page.tsx' ? [p] : []
  })

test('8. cada page.tsx de Analytics pregunta exigirSuperAdmin() antes de leer, y Events traduce ?tipo=', () => {
  const lista = paginas('app/admin/(polar)/analytics')
  assert.deepEqual(lista.map((p) => relative('app/admin/(polar)/analytics', p)).sort(), ['costs/page.tsx', 'events/page.tsx', 'metrics/page.tsx', 'page.tsx'])
  for (const p of lista) {
    const src = sinComentarios(leer(p))
    assert.match(src, /export const dynamic = 'force-dynamic'/, `${p}: dinámica`)
    assert.match(src, /export default async function \w*\([^)]*\)[^{]*\{\s*await exigirSuperAdmin\(\)/, `${p}: exigirSuperAdmin() antes de leer`)
  }
  assert.match(sinComentarios(leer('app/admin/(polar)/analytics/layout.tsx')), /\{\s*await exigirSuperAdmin\(\)/)
  const ev = sinComentarios(leer('app/admin/(polar)/analytics/events/page.tsx'))
  assert.match(ev, /tiposDeUrl\(searchParams\.tipo\)/, 'el ?tipo= de los links viejos se traduce')
  assert.ok(ev.indexOf('tiposDeUrl(') > -1 && ev.indexOf('tiposDeUrl(') < ev.indexOf('leerEventos('), 'y se traduce antes de leer')
})
