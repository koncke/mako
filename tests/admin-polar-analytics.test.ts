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
//      las barras del histograma; (5b) lo que mostraba la subpágina vieja de la ficha (el alta, los cambios de suscripción,
//      lo devuelto y lo anulado) sale con su negocio y el filtro por negocio lo encuentra; (5c) el negocio del filtro
//      (`?customerIds=`, lo que abre la ficha) se lee a fondo y el corte de todos no vale para él;
//   6. Costs: la parte de cada feature y su cambio contra el mes anterior, «Changes» vacío sin mes anterior, el gasto por día
//      con su acumulado, y SIN el corte por negocio (vive en Customers › Cost Drivers: un dato, un lugar; 6/11/2026);
//   7. el CSV de las métricas va en dólares y por el armador de la app;
//   8. cada page.tsx de Analytics pregunta `exigirSuperAdmin()` ANTES de leer, y Events traduce `?tipo=` y lee a fondo los
//      negocios de `?customerIds=`.
//   Y lo de la revisión del Cerebro del 6/11/2026 (docs/admin/revision-cerebro-6-11.md):
//   (6) Costs no le pasa ningún `Date` a la vista (punto 5; lo de la zona, en tests/admin-polar-zona.test.ts); (6b) lo cobrado
//   del mes y el «AI margin» (punto 12); 9. «N eventos hoy» cuenta pagos y acciones, las lecturas de MaKo son un tipo aparte, y
//   su «Ver todo» (`range=today`, pagos y acciones) da el mismo número (punto 13); 10. la grilla de Metrics sin celdas vacías,
//   los grupos en inglés, las métricas por defecto de Polar y «Todo» (puntos 39, 40 y 43).
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
// Desde que la ficha no tiene su lista de eventos (6/11/2026). Base: 10 / 0; cada rotura, sola y restaurada:
//   · `eventosDeAltas` sin el negocio (`negocios: []`: el filtro por negocio no encuentra su alta)   → 9/1 (5b)
//   · `eventosDeSuscripciones` sin el negocio de la clave del cliente                                → 9/1 (5b)
//   · `eventosDePedidos` también da «Pago recibido» de un pedido anulado                             → 9/1 (5b)
//   · `eventosDePedidos` pone la devolución el día del pago, no cuando se devolvió                     → 9/1 (5b)
//   · `armarEventos` suma las acciones a fondo sin sacar las de la lectura de todos (repetidas)       → 9/1 (5c)
//   · `cortesVisibles` sin el `salvo` (el corte de todos sobre un negocio leído a fondo)              → 9/1 (5c)
//   · events/page.tsx llama a `leerEventos()` sin los negocios de `?customerIds=`                     → 9/1 (8)
//   · un cambio sin efecto (renombrar las locales de `masViejoDe`)                                   → 10/0 (sigue verde)
// Con lo de la revisión del Cerebro (6/11/2026). Base 13/0; cada rotura, sola y restaurada de memoria:
//   · `actividadReciente` cuenta también las lecturas de hoy (sin `a.tipo === 'accion'`)             → 12/1 (9)
//   · `eventosDeAcciones` deja las lecturas como «mako»                                              → 12/1 (9)
//   · `TIPOS_DE_HOY` con las lecturas (el «Ver todo» da otro número)                                  → 12/1 (9)
//   · `celdaAncha` sólo con el primero ancho (queda una celda vacía)                                 → 12/1 (10)
//   · el grupo Cancellations vuelve a «Bajas»                                                        → 12/1 (10)
//   · las métricas por defecto de antes (sin Active Subscriptions ni Orders)                         → 12/1 (10)
//   · `CHART_RANGES.all_time` vuelve a «Desde siempre»                                               → 12/1 (10)
//   · `margenDelMes` sin el «sin filas no hay margen» (un 100% inventado)                            → 12/1 (6b)
//   · `cobradoDelMes` suma también los pagos sin su valor en dólares                                 → 12/1 (6b)
//   · `armarCostos` vuelve a armar el gráfico (con `Date`) en lo que viaja                            → 12/1 (6)
//   · un cambio sin efecto (renombrar la local `lecturas` del 9)                                     → 13/0
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
  armarEventos, conteoPorTipo, cortesVisibles, cubetas, filtrarEventos, MAX_BARRAS, negociosDeUrl, textoDeCorte, tiposDeUrl,
  TOPE_NEGOCIOS_A_FONDO, type EntradasEventos,
} from '../app/admin/_polar/datos/eventos'
import { pedidosDe, type ReciboVenta } from '../app/admin/_polar/datos/ventas'
import type { AccionMako } from '../lib/actividad'
import type { Reporte } from '../lib/admin-errores'
import { armarCostos, cambiosDe, cobradoDelMes, diasDelMes, filasDe, margenDelMes, mesAnterior, metricasDeCostos } from '../app/admin/_polar/datos/costos'
import { CHART_RANGES, celdaAncha, DEFAULT_OVERVIEW_METRICS, filasCsvDeMetricas, gruposConDatos, METRIC_GROUPS } from '../app/admin/_polar/web/utils/metrics'
import { EVENTOS_DE_HOY, TIPOS_DE_HOY } from '../app/admin/_polar/datos/eventos'
import { actividadReciente, ROTULO_RANGO } from '../app/admin/_polar/datos/resumen'
import type { ResumenPeriodo } from '../lib/costos-ia'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
/** Cuántos `Date` lleva un objeto (lo que viaja del server a la vista tiene que ser texto: punto 5). */
const contarFechas = (v: unknown): number =>
  v instanceof Date ? 1 : Array.isArray(v) ? v.reduce((a: number, x) => a + contarFechas(x), 0)
    : v && typeof v === 'object' ? Object.values(v).reduce((a: number, x) => a + contarFechas(x), 0) : 0
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
// Dos recibos cargados a mano, para lo que Sales marca devuelto y anulado. Desde la revisión del Cerebro del 6/11/2026 (punto 4)
// «Cargar pago» registra el pago en el CRM y lo ata a su recibo (`recibo_pagos.pago_id`): un recibo a mano SIN atar no es un
// «Pago recibido» (sería el mismo pago del CRM contado dos veces). Así que acá cada recibo va atado a su pago del CRM (`p-961`,
// `p-962`), que es lo que produce el flujo real.
const recibo = (r: Pick<ReciboVenta, 'id' | 'estado' | 'destinoWs' | 'aNombre' | 'fechaPago' | 'devueltoAt' | 'anuladoAt' | 'devueltoMonto'>): ReciboVenta => ({
  numero: r.id, origen: 'manual', cobroId: null, emitidoAt: r.fechaPago,
  lineas: [{ concepto: 'Puesta en marcha', mes: null, monto: 400, moneda: 'USD' }],
  totalDetalle: 400, monedaDetalle: 'USD', totales: [{ moneda: 'USD', monto: 400 }], impuesto: null,
  correoEstado: 'enviado', correoA: [], correoError: null, waEstado: 'en_app', waError: null, soloCorreo: false, disputa: null,
  pagos: [{ id: r.id, medio: 'transferencia', referencia: `TRF-${r.id}`, fecha: r.fechaPago, monto: 400, moneda: 'USD', montoUsd: 400, de: null, comprobante: false, anulado: false, pagoId: 900 + r.id }],
  historial: [], ...r,
})
const PEDIDOS = pedidosDe({
  entradas: [
    ...ING.entradas,
    // Los pagos del CRM de los dos recibos de abajo (lo que registró «Cargar pago»).
    { id: 'p:961', fecha: '2026-10-25', usd: 400, medio: 'transferencia', recurrente: false, nombre: 'Estudio Norte', cliente: 'ws:3' },
    { id: 'p:962', fecha: '2026-10-26', usd: 400, medio: 'transferencia', recurrente: false, nombre: 'Panadería Sol', cliente: 'ws:2' },
  ],
  recibos: [
    recibo({ id: 61, estado: 'devuelto', destinoWs: 3, aNombre: 'Estudio Norte', fechaPago: '2026-10-25T14:00:00.000Z', devueltoAt: '2026-11-02T09:30:00.000Z', anuladoAt: null, devueltoMonto: 400 }),
    recibo({ id: 62, estado: 'anulado', destinoWs: 2, aNombre: 'Panadería Sol', fechaPago: '2026-10-26T14:00:00.000Z', devueltoAt: null, anuladoAt: '2026-10-27T10:00:00.000Z', devueltoMonto: null }),
  ],
  clientes: new Map(ING.clientes.map((c) => [c.clave, { clave: c.clave, nombre: c.nombre, ws: c.ws, leadId: c.leadId }])),
  nombreDeWs: new Map([[1, 'Estudio Norte'], [2, 'Panadería Sol'], [3, 'Estudio Norte']]),
})
const entradasEventos = (tope = 100): EntradasEventos => ({
  pedidos: PEDIDOS,
  ingresos: { movimientos: ING.movimientos, clientes: ING.clientes },
  altas: [
    { ws: 1, nombre: 'Estudio Norte', creado: '2026-02-20T12:00:00.000Z' },
    { ws: 2, nombre: 'Panadería Sol', creado: '2026-05-01T12:00:00.000Z' },
    { ws: 3, nombre: 'Estudio Norte', creado: '2026-09-15T12:00:00.000Z' },
  ],
  actividad: {
    acciones: [
      { creado: '2026-11-06T10:00:00.000Z', usuario: 7, ws: 1, operacion: 'crear_lead', titulo: 'Crear lead', area: 'crm', canal: 'app', tipo: 'accion', ok: true },
      { creado: '2026-11-05T10:00:00.000Z', usuario: null, ws: 2, operacion: 'enviar_email', titulo: 'Mandar un email', area: 'email', canal: 'app', tipo: 'accion', ok: false },
    ],
    nombres: { 1: 'Estudio Norte', 2: 'Panadería Sol', 3: 'Estudio Norte' },
    personas: [{ id: 7, nombre: 'Laura Pérez', email: 'laura@ejemplo.com' }],
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
  topes: { acciones: tope, reportes: 40, sesiones: 200, accionesDeUnNegocio: 300, reportesDeUnNegocio: 100 },
})

test('5. Events: el link viejo, el negocio de cada evento, lo que quedó afuera y los filtros', () => {
  assert.deepEqual(tiposDeUrl('error'), ['error', 'reporte'], '?tipo=error abre los crashes Y los reportes')
  assert.deepEqual(tiposDeUrl('agente'), ['agente'])
  assert.deepEqual(tiposDeUrl(['agente', 'pago']), ['pago', 'agente'])
  assert.equal(tiposDeUrl('cualquiera'), null)

  const v = armarEventos(entradasEventos())
  const pagosWs3 = v.eventos.filter((e) => e.nombre === 'pago' && e.negocios.some((x) => x.ws === 3))
  assert.equal(pagosWs3.length, 3, 'los pagos de ws:3 (los dos cobrados y el del recibo que después se devolvió) van a ws:3, aunque se llame igual que ws:1')
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

test('5b. Events: lo que mostraba la ficha vieja (el alta, los cambios de suscripción, lo devuelto) sale con su negocio', () => {
  const v = armarEventos(entradasEventos())
  const delWs = (ws: number) => filtrarEventos(v.eventos, { desde: new Date(0), hasta: AHORA, negocios: [ws] })

  // El alta de cada negocio (el `customer.created` de Polar), con su negocio.
  const altas = v.eventos.filter((e) => e.nombre === 'alta')
  assert.deepEqual(altas.map((e) => [e.id, e.negocios.map((n) => n.ws)]), [['alta:1', [1]], ['alta:2', [2]], ['alta:3', [3]]])
  assert.ok(delWs(3).some((e) => e.id === 'alta:3'), 'el filtro por negocio encuentra su alta')
  assert.ok(!delWs(1).some((e) => e.id === 'alta:3'), 'y no la de otro que se llama igual')

  // Los cambios de suscripción: el negocio por la clave del cliente, y lo que dice cada uno.
  const subs3 = delWs(3).filter((e) => e.nombre === 'suscripcion')
  assert.deepEqual(subs3.map((e) => e.label), ['Empezó a pagar por mes'], 'ws:3 empezó en septiembre')
  assert.equal(subs3[0].resumen, 'US$ 200 por mes')
  const corte = delWs(2).find((e) => e.nombre === 'suscripcion' && e.label === 'Dejó de pagar por mes')
  assert.ok(corte, 'el corte de ws:2 está, con su negocio')
  assert.equal(corte.negativo, true)
  assert.equal(corte.resumen, 'Pagaba US$ 50 por mes')
  assert.equal(corte.importancia, 'high')
  assert.ok(v.eventos.filter((e) => e.nombre === 'suscripcion').every((e) => e.negocios.length === 1 && e.soloDia), 'un movimiento es de un día')

  // Lo devuelto: el pago entró (y se ve) y la devolución es otro evento, cuando se devolvió; lo anulado no entró.
  const pedido61 = delWs(3).filter((e) => e.id.endsWith(':p-961'))
  assert.deepEqual(pedido61.map((e) => [e.nombre, e.label, e.timestamp]), [
    ['devolucion', 'Pago devuelto', '2026-11-02T09:30:00.000Z'],
    ['pago', 'Pago recibido', '2026-10-25T12:00:00.000Z'],
  ])
  const devuelto = pedido61[0]
  assert.equal(devuelto.monto, -40_000, 'lo devuelto entero, en negativo')
  assert.equal(devuelto.negativo, true)
  assert.equal(devuelto.href, '/admin/sales/p-961', 'lleva a su pedido en Sales')
  assert.equal(devuelto.campos.find((c) => c.label === 'Pedido')?.href, '/admin/sales/p-961')
  const pedido62 = delWs(2).filter((e) => e.id.endsWith(':p-962'))
  assert.deepEqual(pedido62.map((e) => [e.nombre, e.label]), [['devolucion', 'Pago anulado']], 'un pago anulado no es un pago recibido')
  assert.ok(v.eventos.filter((e) => e.nombre === 'pago' && e.id.startsWith('pago:p-')).every((e) => e.href === `/admin/sales/${e.id.slice(5)}`), 'cada pago lleva a su pedido')
  assert.deepEqual(tiposDeUrl('devoluciones'), ['devolucion'])

  // Lo que no tiene cuenta no lleva negocio: no aparece en ningún filtro de negocio.
  for (const ws of [1, 2, 3]) assert.ok(!delWs(ws).some((e) => e.persona === 'Ana Gómez' && e.nombre === 'pago'), `el pago sin cuenta no es de ws:${ws}`)
})

test('5c. Events: el negocio del filtro se lee a fondo (lo que leía su ficha), y el corte de todos no vale para él', () => {
  const accion = (creado: string, ws: number, ok = true): AccionMako => ({ creado, usuario: 7, ws, operacion: 'crear_lead', titulo: 'Crear lead', area: 'crm', canal: 'app', tipo: 'accion', ok })
  const reporte = (id: number, creado: string, ws: number): Reporte => ({ id, titulo: `Reporte ${id}`, tipo: 'bug', estado: 'abierto', prioridad: 'media', canal: 'app', creado, quien: 'Ana Gómez', negocio: null, ws })
  const base = entradasEventos(2) // la lectura de todos llega a su tope de acciones (2)
  const aFondo = [{
    ws: 1,
    acciones: [accion('2026-11-06T10:00:00.000Z', 1), accion('2026-10-01T10:00:00.000Z', 1), accion('2026-09-01T10:00:00.000Z', 1, false)],
    reportes: [reporte(70, '2026-10-02T10:00:00.000Z', 1)],
  }]
  const v = armarEventos({ ...base, aFondo, topes: { ...base.topes, accionesDeUnNegocio: 3 } })
  const mako1 = filtrarEventos(v.eventos, { desde: new Date(0), hasta: AHORA, negocios: [1], nombres: ['mako'] })
  assert.equal(mako1.length, 3, 'las de ws:1 son las de su lectura a fondo, sin repetir la que también vino en la de todos')
  assert.equal(mako1.filter((e) => e.negativo).length, 1, 'la que falló es mala')
  assert.equal(new Set(v.eventos.map((e) => e.id)).size, v.eventos.length, 'un id por evento')
  assert.ok(filtrarEventos(v.eventos, { desde: new Date(0), hasta: AHORA, negocios: [2], nombres: ['mako'] }).length === 1, 'las de los otros siguen siendo las de todos')
  assert.ok(filtrarEventos(v.eventos, { desde: new Date(0), hasta: AHORA, negocios: [1], nombres: ['reporte'] }).some((e) => e.id === 'reporte:70'), 'sus reportes, a fondo')

  const todos = v.cortes.find((c) => c.nombre === 'mako' && !c.negocio)!
  assert.deepEqual(todos.salvo, [1], 'el corte de todos dice qué negocio se leyó a fondo')
  const deUno = v.cortes.find((c) => c.nombre === 'mako' && c.negocio)!
  assert.deepEqual([deUno.negocio, deUno.desde, deUno.tope], [{ ws: 1, nombre: 'Estudio Norte' }, '2026-09-01T10:00:00.000Z', 3], 'ws:1 llegó a su tope: antes del 01/09 faltan las suyas')
  const desde = new Date('2026-01-01T00:00:00Z')
  assert.deepEqual(cortesVisibles(v.cortes, desde, [1]).map((c) => c.negocio?.ws ?? 'todos'), [1], 'filtrando por ws:1: su corte, no el de todos')
  assert.deepEqual(cortesVisibles(v.cortes, desde, [1, 2]).map((c) => c.negocio?.ws ?? 'todos').sort(), [1, 'todos'], 'con otro al lado, vuelve el de todos')
  assert.deepEqual(cortesVisibles(v.cortes, desde, null).map((c) => c.negocio?.ws ?? 'todos'), ['todos'], 'sin filtro, el de todos')
  assert.equal(textoDeCorte(deUno, () => '01/09'), 'Antes del 01/09 faltan acciones de MaKo de Estudio Norte: se leen los 3 más recientes de ese negocio.')

  // Si la lectura a fondo falló, quedan las de la lectura de todos.
  const fallo = armarEventos({ ...base, aFondo: [{ ws: 1, acciones: null, reportes: null }] })
  assert.equal(filtrarEventos(fallo.eventos, { desde: new Date(0), hasta: AHORA, negocios: [1], nombres: ['mako'] }).length, 1)
  assert.deepEqual(fallo.cortes.find((c) => c.nombre === 'mako')?.salvo, [], 'y el corte de todos vale para él')

  // `?customerIds=` de la URL: ids de verdad, sin repetir y con tope.
  assert.deepEqual(negociosDeUrl('42'), [42])
  assert.deepEqual(negociosDeUrl(['3,3', ' 7 ', '0', 'x', '-1', '4.5']), [3, 7])
  assert.deepEqual(negociosDeUrl(undefined), [])
  assert.equal(negociosDeUrl(Array.from({ length: 30 }, (_, i) => String(i + 1)).join(',')).length, TOPE_NEGOCIOS_A_FONDO)
})

// ── Costs ───────────────────────────────────────────────────────────────────────────────────────────────────────────
const corte = (clave: string, llamadas: number, costUsd: number) => ({ clave, llamadas, tokens: 0, costUsd })
const resumen = (porFeature: ReturnType<typeof corte>[], porDia: ReturnType<typeof corte>[] = []): ResumenPeriodo => ({
  periodo: '2026-11', desde: null, hasta: null, filas: 0, llamadas: 0, tokens: 0, costUsd: 0,
  porFeature, porProveedor: [], porModelo: [], porDia,
  porWorkspace: [corte('2', 3, 1), corte('1', 5, 3)],
  mesesDisponibles: [], delNegocio: { llamadas: 0, costUsd: 0 }, delCredito: { llamadas: 0, costUsd: 0 },
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


  assert.equal(diasDelMes('2026-11', '2026-11-06').length, 6, 'el mes en curso, hasta hoy')
  assert.equal(diasDelMes('2026-02', '2026-11-06').length, 28)
  const m = metricasDeCostos([corte('2026-11-02', 1, 0.5), corte('2026-11-05', 1, 0.25)], '2026-11', '2026-11-06')
  assert.deepEqual(m.periods.map((p) => p.costs), [0, 50, 0, 0, 25, 0])
  assert.deepEqual(m.periods.map((p) => p.cumulative_costs), [0, 50, 50, 50, 75, 75])
  assert.equal(m.totals.costs, 75)
  assert.equal(m.totals.cumulative_costs, 75)

  const v = armarCostos({ periodo: '2026-11', actual: resumen([corte('a', 1, 1)]), previo: null, hoy: '2026-11-06', mesesConDatos: ['2026-10'], cobrado: null, avisos: ['x'] })
  assert.equal('porNegocio' in v, false, 'el gasto por negocio vive en Customers › Cost Drivers, no en Costs')
  assert.equal(v.previo, null)
  assert.deepEqual(v.cambios, [])
  assert.deepEqual(v.meses, ['2026-11', '2026-10'], 'los meses del selector, con el mirado adentro')
  assert.equal(contarFechas(v), 0, 'a la vista no viaja ningún Date (punto 5): el gráfico lo arma el navegador')
})

test('6b. Costs: lo cobrado del mes y el «AI margin» (punto 12): sólo resta la IA, y sin gasto medido no hay margen', () => {
  const entradas = [
    { fecha: '2026-10-31', usd: 500 }, { fecha: '2026-11-02', usd: 200 }, { fecha: '2026-11-05', usd: 100 }, { fecha: '2026-11-06', usd: null },
  ]
  assert.equal(cobradoDelMes(entradas, '2026-11'), 300, 'lo que entró en noviembre con su valor en dólares')
  assert.equal(cobradoDelMes(entradas, '2026-10'), 500)
  assert.deepEqual(margenDelMes(300, { costUsd: 30, filas: 12 }), { cobradoCentavos: 30_000, margen: 90 }, '(300 − 30) / 300')
  assert.deepEqual(margenDelMes(300, { costUsd: 0, filas: 0 }), { cobradoCentavos: 30_000, margen: null }, 'un mes sin ninguna fila de gasto no tiene margen (no un 100% inventado)')
  assert.deepEqual(margenDelMes(300, { costUsd: 0, filas: 4 }), { cobradoCentavos: 30_000, margen: 100 }, 'con filas en cero (IA gratis) sí: es un gasto medido de 0')
  assert.deepEqual(margenDelMes(0, { costUsd: 1, filas: 1 }), { cobradoCentavos: 0, margen: null }, 'sin cobros no hay margen')
  assert.deepEqual(margenDelMes(null, { costUsd: 1, filas: 1 }), { cobradoCentavos: null, margen: null }, 'los ingresos que no se leyeron no son un cero')
  const v = armarCostos({ periodo: '2026-11', actual: { ...resumen([corte('a', 3, 30)]), costUsd: 30, filas: 3 }, previo: null, hoy: '2026-11-06', mesesConDatos: [], cobrado: 300, avisos: [] })
  assert.deepEqual(v.margen, { cobradoCentavos: 30_000, margen: 90 }, 'armarCostos lo calcula con el gasto del mes que se mira')
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
  assert.match(ev, /leerEventos\(new Date\(\), \{ negocios: negociosDeUrl\(searchParams\.customerIds\) \}\)/, 'los negocios del filtro (lo que abre la ficha) se leen a fondo')
  assert.match(sinComentarios(leer('app/admin/(polar)/analytics/events/EventsPage.tsx')), /cortesVisibles\(vista\.cortes, listStartDate, numerosDe\(negociosClave\)\)/, 'los cortes miran el filtro de negocios')
})

test('9. «N eventos hoy» cuenta lo que se puede comprobar: pagos y acciones; su «Ver todo» da el mismo número (punto 13)', () => {
  const hoy = '2026-11-06'
  const accion = (creado: string, tipo: 'accion' | 'lectura', ws = 1): AccionMako => ({ creado, usuario: 7, ws, operacion: tipo === 'accion' ? 'crear_lead' : 'ver_leads', titulo: tipo === 'accion' ? 'Crear lead' : 'Ver leads', area: 'crm', canal: 'app', tipo, ok: true })
  const acciones = [
    accion('2026-11-06T14:00:00.000Z', 'accion'),
    accion('2026-11-06T13:00:00.000Z', 'lectura'),
    accion('2026-11-06T12:00:00.000Z', 'lectura', 2),
    accion('2026-11-05T12:00:00.000Z', 'accion'),
  ]
  const entradas = [
    { fecha: hoy, usd: 97, medio: 'transferencia', recurrente: true, nombre: 'Estudio Norte', id: 'p:1', cliente: 'ws:1' },
    { fecha: '2026-11-05', usd: 50, medio: 'transferencia', recurrente: true, nombre: 'Panadería Sol', id: 'p:2', cliente: 'ws:2' },
  ]
  const tarjeta = actividadReciente({
    hoy, ahoraMs: Date.parse('2026-11-06T18:00:00Z'), entradas, pagos: [],
    acciones: acciones.map((a) => ({ ...a, dia: a.creado.slice(0, 10) })), nombres: { 1: 'Estudio Norte', 2: 'Panadería Sol' }, usdTxt: String,
  })
  assert.equal(tarjeta.hoy, 2, 'el pago de hoy y la acción de hoy: las lecturas no cuentan')

  const v = armarEventos({
    ...entradasEventos(),
    pedidos: pedidosDe({
      entradas, recibos: [],
      clientes: new Map([['ws:1', { clave: 'ws:1', nombre: 'Estudio Norte', ws: 1, leadId: 1 }], ['ws:2', { clave: 'ws:2', nombre: 'Panadería Sol', ws: 2, leadId: 2 }]]),
      nombreDeWs: new Map([[1, 'Estudio Norte'], [2, 'Panadería Sol']]),
    }),
    ingresos: null, altas: null, errores: null, agente: null,
    actividad: { acciones, nombres: { 1: 'Estudio Norte', 2: 'Panadería Sol' }, personas: [], medido: true },
  })
  const lecturas = v.eventos.filter((e) => e.nombre === 'lectura')
  assert.equal(lecturas.length, 2, 'las lecturas de MaKo son un tipo aparte')
  assert.ok(v.eventos.filter((e) => e.nombre === 'mako').every((e) => e.label === 'Crear lead'), 'y no están entre las acciones')

  // Lo que abre el «Ver todo» de la tarjeta: Events, hoy, con sus tipos.
  const url = new URL(EVENTOS_DE_HOY, 'https://hola-mako.com')
  assert.equal(url.pathname, '/admin/analytics/events')
  assert.equal(url.searchParams.get('range'), 'today', 'el «range=today» de Polar')
  const tipos = (url.searchParams.get('eventTypes') ?? '').split(',')
  assert.deepEqual(tipos, [...TIPOS_DE_HOY])
  const delDia = filtrarEventos(v.eventos, { desde: new Date(`${hoy}T00:00:00.000Z`), hasta: new Date(`${hoy}T23:59:59.999Z`), nombres: tipos })
  assert.equal(delDia.length, tarjeta.hoy, 'el filtro da el mismo número que la tarjeta')
  assert.deepEqual(tiposDeUrl('actividad'), ['mako', 'lectura'], 'el link viejo de Activity abre las dos')
})

test('10. Metrics: la grilla no deja celdas vacías, los grupos en inglés, los defaults de Polar y «Todo» (puntos 39, 40, 43)', () => {
  // Una grilla de dos columnas: un gráfico ancho ocupa la fila; los demás, media. Ninguna fila puede quedar a medias.
  for (let total = 1; total <= 8; total++) {
    let enLaFila = 0
    for (let i = 0; i < total; i++) {
      const ancho = celdaAncha(i, total)
      if (ancho) assert.equal(enLaFila, 0, `${total} métricas: el gráfico ${i} ancho arranca una fila nueva`)
      enLaFila = ancho ? 0 : (enLaFila + 1) % 2
    }
    assert.equal(enLaFila, 0, `${total} métricas: la última fila no queda con una celda vacía`)
  }
  assert.deepEqual([0, 1, 2].map((i) => celdaAncha(i, 3)), [true, false, false], 'con tres: el primero ancho y dos al lado')
  assert.deepEqual(METRIC_GROUPS.map((g) => g.category), ['Revenue', 'Orders', 'Subscriptions', 'Cancellations', 'Unit Economics'])
  assert.deepEqual(gruposConDatos(metricasDeIngresos(ING.meses, ING).metrics).map((g) => g.title), ['Revenue', 'Orders', 'Subscriptions', 'Cancellations', 'Unit Economics'])
  assert.deepEqual(DEFAULT_OVERVIEW_METRICS, ['revenue', 'monthly_recurring_revenue', 'active_subscriptions', 'orders'], 'las de Polar que MaKo mide')
  assert.equal(CHART_RANGES.all_time, 'Todo')
  assert.equal(CHART_RANGES.all_time, ROTULO_RANGO.all_time, 'el mismo control, el mismo nombre en Customers y en Overview')
})
