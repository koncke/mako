// =============================================================================
// Admin (la copia de Polar): lo que encontró el revisor independiente en Analytics, Sales, Products, Finance y Settings
// (6/11/2026), EJECUTADO. Cada test corre las funciones puras (o dibuja la pieza) con datos armados o con los ejemplos:
//   1. Finance › Income es el LIBRO de movimientos de Polar, no la lista de pedidos: lo que entró y lo que salió, cada uno con su
//      pedido de Sales; con los ejemplos, el libro suma lo que el Overview dice que entró (la devolución entra y sale);
//   2. los ejemplos son UN universo: Analytics › Metrics da los mismos ingresos y el mismo MRR que el Overview para el mismo rango,
//      sus cambios de MRR cuentan la historia de los meses del Overview, y Sales, Events y Costs hablan de los mismos negocios y
//      personas;
//   3. Analytics › Costs tiene el margen bruto, con la función de la tarjeta de Overview (`margenPorcentaje`, no una copia);
//   4. Settings › General se titula «Datos del recibo»;
//   5. Sales › Subscriptions: la columna «Próximo cobro» son las filas de «Por cobrar» del Overview, y suma lo mismo;
//   6. los menores: un solo link a la ficha en el detalle de un pedido, el checkout sin su número suelto, Events sin segundos,
//      «Registrada a mano», y la ficha de un plan sin «Beneficios».
//
// Correr: node --import tsx --test tests/admin-polar-arreglos-3.test.ts
//
// PROBADO ROMPIÉNDOLO (6/11/2026), con un arnés que restaura de memoria. Base: 13 pass / 0 fail. Cada rotura, sola:
//   · `movimientosDe` deja pasar el pedido anulado                                                     → 12/1 (1)
//   · `movimientosDe` resta el pago entero en una devolución parcial (sin mirar `devueltoMonto`)        → 12/1 (1)
//   · la devolución sale el día del pago y no el de la devolución                                     → 12/1 (1)
//   · a igual día, lo que salió antes de lo que entró (`ordenarIngresos` con los pesos dados vuelta)     → 12/1 (1)
//   · TransactionMeta sin el link a su pedido                                                          → 12/1 (2)
//   · el «Exportar» de Income vuelve a «Bajar»                                                          → 12/1 (2)
//   · Metrics vuelve a sus propios montos (los meses del Overview con otro «cobrado»)                   → 12/1 (3)
//   · un movimiento de ejemplo de más (Óptica sube a Pro en octubre)                                     → 12/1 (4)
//   · Costs dice otro gasto que Cost Drivers para Clínica Dental Sonríe                                  → 12/1 (5)
//   · Orders nombra a Agencia Brújula «Agencia Faro» (un negocio que no es de los ejemplos)             → 10/3 (1, 5, 12)
//   · `metricasDeCostos` no rehace el margen del MES (queda el `null` de `totalesDe`)                    → 12/1 (6)
//   · un mes sin filas de gasto da 100% (`gastoMedido` siempre true)                                     → 12/1 (6)
//   · Costs sin `entradas` igual dibuja el margen (`metricasDeCostosConDatos` sin el filtro)             → 12/1 (6)
//   · Settings vuelve a «Perfil»                                                                          → 12/1 (7)
//   · `conPorCobrar` pone la fila en TODAS las suscripciones del cliente (se cuenta dos veces)           → 12/1 (8)
//   · la columna vuelve a «Próxima» con sólo la renovación                                              → 12/1 (9)
//   · OrderCustomerContext vuelve a tener «Entrar: Abrir su MaKo»                                       → 12/1 (10)
//   · el checkout vuelve a mostrar su número suelto                                                      → 12/1 (10)
//   · `horaDelEvento` vuelve a los segundos                                                               → 12/1 (11)
//   · la suscripción vuelve a «A mano»                                                                    → 12/1 (11)
//   · una persona de ejemplo con otro negocio («Ana Gómez» en la panadería)                             → 12/1 (12)
//   · un negocio de ejemplo que no es de ejemplo/negocios.ts («Panadería Sol»)                         → 12/1 (12)
//   · una suscripción de ejemplo cuyo «pagó en total» no es la suma de sus meses                         → 12/1 (13)
//   · y un cambio sin efecto (renombrar la variable local `entro` de `movimientosDe`)                    → 13/0 (sigue verde)
// =============================================================================

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { movimientosDe, totalPorMoneda, type PedidoParaIngreso } from '../app/admin/_polar/datos/finanzas'
import { conPorCobrar, fechaDelProximoCobro, filasCsvSuscripciones, ROTULO_FUENTE_SUSCRIPCION, totalPorCobrar, type SuscripcionVenta } from '../app/admin/_polar/datos/ventas'
import { finDeMes, inicioDeMes, metricasDeIngresos, recortarMetricas } from '../app/admin/_polar/datos/metricas'
import { metricasDeCostos, metricasDeCostosConDatos } from '../app/admin/_polar/datos/costos'
import { aCentavos, margenBruto, margenPorcentaje, mesesDelRango, rangosDisponibles } from '../app/admin/_polar/datos/resumen'
import { horaDelEvento } from '../app/admin/_polar/web/Events/hora'
import TransactionMeta from '../app/admin/_polar/web/Transactions/TransactionMeta'
import { TooltipProvider } from '../app/admin/_polar/orbit'
import { IncomePageHeader } from '../app/admin/(polar)/finance/income/IncomePageHeader'
import { SubscriptionDetailsGrid } from '../app/admin/_polar/web/Subscriptions/SubscriptionDetailsGrid'
import { ingresosEjemplo, resumenEjemplo } from '../app/admin/_polar/datos/ejemplo/resumen'
import { COSTOS_EJEMPLO as COST_DRIVERS_EJEMPLO } from '../app/admin/_polar/datos/ejemplo/clientes'
import { NEGOCIOS, PAGOS_EJEMPLO, pagadoPor } from '../app/admin/_polar/datos/ejemplo/negocios'
import { COBROS_EJEMPLO, PEDIDOS_EJEMPLO, PERSONAS_EJEMPLO, POR_COBRAR_EJEMPLO, SUSCRIPCIONES_EJEMPLO } from '../app/admin/_polar/datos/ejemplo/ventas'
import { INGRESOS_EJEMPLO as LIBRO_EJEMPLO } from '../app/admin/_polar/datos/ejemplo/productos'
import { COSTOS_EJEMPLO, EVENTOS_EJEMPLO, GASTO_NOVIEMBRE, GASTO_OCTUBRE, METRICAS_EJEMPLO, MOVIMIENTOS_EJEMPLO } from '../app/admin/_polar/datos/ejemplo/analytics'

const RAIZ = fileURLToPath(new URL('..', import.meta.url))
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n')
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
const HOY = '2026-11-06'

// ── 1. Finance › Income: el libro ──────────────────────────────────────────────────────────────────────────────────────────

test('1 · Income: un movimiento por cada cosa que movió plata (lo anulado no), lo devuelto en negativo el día que salió', () => {
  const base: PedidoParaIngreso = {
    id: 'p-1', fecha: '2026-10-01', cliente: { clave: 'ws:42', nombre: 'Estudio Norte', ws: 42, leadId: 7, email: null }, concepto: 'Mensualidad',
    medio: 'stripe', recurrente: true, usd: 97, estado: 'paid', recibo: null,
  }
  const recibo = (r: Partial<NonNullable<PedidoParaIngreso['recibo']>>): NonNullable<PedidoParaIngreso['recibo']> => ({ devueltoAt: null, devueltoMonto: null, monedaDetalle: 'USD', pagos: [], ...r })
  const libro = movimientosDe([
    base,
    { ...base, id: 'c-2', fecha: '2026-10-02', estado: 'void', recibo: recibo({}) },
    { ...base, id: 'c-3', fecha: '2026-10-03', estado: 'partially_refunded', recibo: recibo({ devueltoAt: '2026-10-09T12:00:00Z', devueltoMonto: 30 }) },
    { ...base, id: 'c-4', fecha: '2026-10-04', estado: 'refunded', recibo: recibo({ devueltoAt: '2026-10-08T12:00:00Z' }) },
    { ...base, id: 'p-5', fecha: '2026-10-08', usd: 47 },
  ])
  assert.deepEqual(libro.map((m) => [m.id, m.tipo, m.fecha, m.monto]), [
    ['p-1', 'cobro', '2026-10-01', 97],
    ['c-3', 'cobro', '2026-10-03', 97],
    ['c-4', 'cobro', '2026-10-04', 97],
    ['p-5', 'cobro', '2026-10-08', 47],
    ['c-4:devolucion', 'devolucion', '2026-10-08', -97],
    ['c-3:devolucion', 'devolucion', '2026-10-09', -30],
  ], 'el anulado (c-2) no movió plata; cada devolución, el día que salió y por lo que salió; a igual día, lo que entró primero')
  assert.ok(libro.every((m) => m.pedido === m.id.replace(':devolucion', '')), 'cada movimiento lleva a SU pedido')
  assert.deepEqual(totalPorMoneda(libro), { USD: 97 + 97 + 97 + 47 - 97 - 30 })

  // Con los ejemplos: el libro son los pedidos de Orders; entra y sale la devolución de Agencia Brújula, y lo que queda es lo que
  // el Overview dice que entró. Cada movimiento nombra un pedido que existe en Orders.
  assert.ok(LIBRO_EJEMPLO.ok)
  const filas = LIBRO_EJEMPLO.ok ? LIBRO_EJEMPLO.filas : []
  assert.deepEqual(totalPorMoneda(filas), { USD: ingresosEjemplo.cobradoTotal })
  const pedidos = new Set(PEDIDOS_EJEMPLO.map((p) => p.id))
  assert.ok(filas.every((m) => pedidos.has(m.pedido)))
  assert.deepEqual(filas.filter((m) => m.tipo === 'devolucion').map((m) => [m.nombre, m.fecha, m.monto]), [['Agencia Brújula', '2026-10-20', -300]])
})

test('2 · Income: la descripción lleva al pedido (el «Order» de Polar), y el botón se llama «Exportar» como en Orders', () => {
  const m = movimientosDe(PEDIDOS_EJEMPLO).find((x) => x.tipo === 'devolucion')!
  // Admin lo tiene en su raíz (el SidebarProvider de DashboardLayout trae el TooltipProvider de Polar); acá se monta a mano.
  const html = renderToStaticMarkup(createElement(TooltipProvider, null, createElement(TransactionMeta, { transaction: m })))
  assert.match(html, /Devolución/)
  assert.match(html, new RegExp(`href="/admin/sales/${m.pedido}"`), 'el link a su pedido')
  const header = renderToStaticMarkup(createElement(IncomePageHeader, { filas: [m], hoy: HOY }))
  assert.match(header, />Exportar</)
  assert.doesNotMatch(header, /Bajar/)
  // Sin lo que es del pedido: ni su estado ni su recibo ni sus acciones.
  const lista = sinComentarios(leer('app/admin/_polar/web/Transactions/TransactionsList.tsx'))
  assert.doesNotMatch(lista, /recibo|ROTULO_ESTADO_PEDIDO|OrderStatus|estado/i)
})

// ── 2. Un universo de ejemplos ────────────────────────────────────────────────────────────────────────────────────────────

test('3 · Analytics › Metrics da los mismos ingresos y el mismo MRR que el Overview, para cada rango del Overview', () => {
  const rangos = rangosDisponibles(ingresosEjemplo)
  assert.ok(rangos.includes('12m') && rangos.includes('3m'))
  for (const r of rangos) {
    const meses = mesesDelRango(ingresosEjemplo, r)
    const overview = metricasDeIngresos(meses, ingresosEjemplo).totals
    const metrics = recortarMetricas(METRICAS_EJEMPLO.data, inicioDeMes(meses[0].mes), finDeMes(meses[meses.length - 1].mes)).totals
    assert.equal(metrics.revenue, overview.revenue, `${r}: los ingresos`)
    assert.equal(metrics.monthly_recurring_revenue, overview.monthly_recurring_revenue, `${r}: el MRR`)
  }
  // El rango del revisor: «1 dic 2025 – 1 nov 2026».
  const r = recortarMetricas(METRICAS_EJEMPLO.data, new Date(2025, 11, 1), new Date(2026, 10, 1))
  assert.equal(r.totals.revenue, aCentavos(ingresosEjemplo.meses.reduce((s, m) => s + m.cobrado, 0)))
  assert.equal(r.totals.monthly_recurring_revenue, aCentavos(ingresosEjemplo.meses.at(-1)!.mrr))
})

test('4 · los cambios de MRR de ejemplo cuentan la historia de los meses del Overview', () => {
  for (const m of ingresosEjemplo.meses) {
    const delMes = MOVIMIENTOS_EJEMPLO.filter((x) => x.fecha.startsWith(m.mes))
    const suma = (tipo: string) => delMes.filter((x) => x.tipo === tipo).reduce((s, x) => s + Math.abs(x.delta), 0)
    assert.deepEqual([suma('nuevo'), suma('sube'), suma('baja'), suma('corte'), suma('vuelve')], [m.nuevo, m.sube, m.baja, m.corte, m.vuelve], `${m.mes}: los movimientos`)
    // Lo que paga cada uno al cierre del mes (su último movimiento) suma el MRR del mes.
    const fin = `${m.mes}-31`
    const ultimo = new Map<string, number>()
    for (const x of [...MOVIMIENTOS_EJEMPLO].sort((a, b) => a.fecha.localeCompare(b.fecha))) if (x.fecha <= fin) ultimo.set(x.cliente, x.despues)
    assert.equal([...ultimo.values()].reduce((s, v) => s + v, 0), m.mrr, `${m.mes}: el MRR`)
  }
  assert.equal(METRICAS_EJEMPLO.data.totals.active_subscriptions, 7, 'las siete suscripciones vivas de noviembre')
})

test('5 · Sales, Events y Costs hablan de los negocios de ejemplo/negocios.ts, con su número', () => {
  const ws = new Map<string, number>(Object.values(NEGOCIOS).map((n) => [n.nombre, n.ws]))
  for (const p of PEDIDOS_EJEMPLO) if (p.cliente?.ws != null) assert.equal(ws.get(p.cliente.nombre), p.cliente.ws, `${p.id}: ${p.cliente.nombre}`)
  for (const s of SUSCRIPCIONES_EJEMPLO) assert.equal(ws.get(s.cliente.nombre), s.cliente.ws, `${s.id}: ${s.cliente.nombre}`)
  for (const e of EVENTOS_EJEMPLO.eventos) for (const n of e.negocios) assert.equal(ws.get(n.nombre), n.ws, `${e.id}: ${n.nombre}`)
  // Orders suma lo mismo que el Overview (la devolución de Agencia Brújula no suma), y cada pago de ejemplo es un pedido.
  const pagados = PEDIDOS_EJEMPLO.filter((p) => p.estado === 'paid')
  assert.equal(pagados.reduce((s, p) => s + (p.usd ?? 0), 0), ingresosEjemplo.cobradoTotal)
  assert.equal(pagados.length, PAGOS_EJEMPLO.length)
  // Costs: noviembre suma lo mismo que Customers › Cost Drivers (lo que reparte por negocio, con su parte del total).
  const drivers = COST_DRIVERS_EJEMPLO.costos!.clientes
  const totalDrivers = drivers[0].costoCentavos / drivers[0].share
  assert.ok(Math.abs(totalDrivers - aCentavos(GASTO_NOVIEMBRE.costUsd)) < 0.001)
  assert.equal(COSTOS_EJEMPLO.metricas.totals.costs, aCentavos(GASTO_NOVIEMBRE.costUsd))
  for (const d of drivers) {
    const corte = GASTO_NOVIEMBRE.porWorkspace.find((c) => Number(c.clave) === d.ws)
    assert.ok(corte && Math.abs(corte.costUsd * 100 - d.costoCentavos) < 0.001, `${d.nombre}: lo mismo en Costs y en Cost Drivers`)
  }
})

// ── 3. Costs: el margen bruto ─────────────────────────────────────────────────────────────────────────────────────────────

test('6 · Analytics › Costs: el margen bruto, con la misma cuenta que la tarjeta «Margen bruto» de Overview', () => {
  const hoy = new Date(`${HOY}T15:00:00Z`)
  // Octubre: lo que dice Costs es lo que dice la barra de octubre de la tarjeta de Overview (a la que lleva «Ver todo»).
  const octubre = metricasDeCostos(GASTO_OCTUBRE.porDia, '2026-10', hoy, ingresosEjemplo.entradas)
  const tarjeta = margenBruto({ hoy: HOY, meses: ingresosEjemplo.meses, entradas: ingresosEjemplo.entradas, gastoPorDia: GASTO_OCTUBRE.porDia })
  const barra = tarjeta.meses.find((m) => m.mes === '2026-10')!.margen
  assert.ok(barra != null)
  assert.equal(Math.round((octubre.totals.gross_margin_percentage ?? NaN) * 100), barra)
  // Noviembre (el ejemplo de la pantalla): lo que entró en noviembre contra US$ 4,20.
  const cobradoNov = ingresosEjemplo.entradas.filter((e) => e.fecha.startsWith('2026-11')).reduce((s, e) => s + (e.usd ?? 0), 0)
  assert.equal(Math.round((COSTOS_EJEMPLO.metricas.totals.gross_margin_percentage ?? NaN) * 100), margenPorcentaje(aCentavos(cobradoNov), aCentavos(GASTO_NOVIEMBRE.costUsd)))
  assert.equal(COSTOS_EJEMPLO.metricas.totals.gross_margin, aCentavos(cobradoNov) - aCentavos(GASTO_NOVIEMBRE.costUsd))
  assert.deepEqual(metricasDeCostosConDatos(COSTOS_EJEMPLO.metricas), ['costs', 'cumulative_costs', 'gross_margin', 'gross_margin_percentage'])
  // Un mes SIN filas de gasto no tiene margen (no es un 100% inventado); sin lo que entró, el margen no se dibuja.
  const sinGasto = metricasDeCostos([], '2026-09', hoy, ingresosEjemplo.entradas)
  assert.equal(sinGasto.totals.gross_margin_percentage, null)
  assert.ok(sinGasto.periods.every((p) => p.gross_margin_percentage == null))
  const sinIngresos = metricasDeCostos(GASTO_NOVIEMBRE.porDia, '2026-11', hoy, null)
  assert.deepEqual(metricasDeCostosConDatos(sinIngresos), ['costs', 'cumulative_costs'])
  // La función es la de Overview, importada (no una copia).
  const costos = sinComentarios(leer('app/admin/_polar/datos/costos.ts'))
  assert.match(costos, /import \{[^}]*margenPorcentaje[^}]*\} from '\.\/resumen'/)
  assert.doesNotMatch(costos, /function margenPorcentaje/)
})

// ── 4. Settings ───────────────────────────────────────────────────────────────────────────────────────────────────────────

test('7 · Settings › General se titula «Datos del recibo» (el perfil de la persona vive en la barra de MaKo)', () => {
  const src = sinComentarios(leer('app/admin/_polar/web/Settings/OrganizationProfileSettings.tsx'))
  assert.match(src, /<SettingsGroup title="Datos del recibo"/)
  assert.doesNotMatch(src, /title="Perfil"/)
})

// ── 5. Subscriptions: el próximo cobro ───────────────────────────────────────────────────────────────────────────────────

const sub = (id: string, clave: string, estado: SuscripcionVenta['estado']): SuscripcionVenta => ({
  id, fuente: 'manual', cliente: { clave, nombre: clave, ws: null, leadId: null, email: null }, estado, empezo: '2026-08-01', renovacion: '2026-12-01',
  terminaEl: null, termino: null, producto: null, mensualidadUsd: 47, mensualidadEstimada: false, diaDeCobro: 1, meses: null, deudaUsd: 0,
  mesesSinPagar: 0, mesesParciales: 0, pagadoUsd: 0, proximo: null, historia: [], renovacionFallida: null, cobroParaCortar: null,
})

test('8 · `conPorCobrar`: cada fila de «Por cobrar» va UNA vez, a la suscripción viva de su cliente, sin recalcular nada', () => {
  const r = conPorCobrar(
    [sub('l-1', 'ws:1', 'canceled'), sub('l-2', 'ws:1', 'active'), sub('l-3', 'ws:2', 'canceled'), sub('l-4', 'ws:3', 'past_due')],
    [
      { cliente: 'ws:1', fecha: '2026-12-01', usd: 97, atrasado: false },
      { cliente: 'ws:2', fecha: '2026-11-02', usd: 47, atrasado: true },
      { cliente: 'ws:3', fecha: '2026-10-15', usd: 47, atrasado: true },
      { cliente: 'ws:3', fecha: '2026-11-15', usd: 47, atrasado: false },
      { cliente: 'ws:9', fecha: '2026-11-20', usd: 10, atrasado: false },
    ],
  )
  const de = (id: string) => r.suscripciones.find((s) => s.id === id)!.porCobrar
  assert.deepEqual(de('l-1'), [], 'la cortada no, si el cliente tiene otra viva')
  assert.deepEqual(de('l-2'), [{ fecha: '2026-12-01', usd: 97, atrasado: false }])
  assert.deepEqual(de('l-3'), [{ fecha: '2026-11-02', usd: 47, atrasado: true }], 'sin otra viva, a la que tiene')
  assert.equal(de('l-4')?.length, 2, 'lo atrasado y lo que sigue, los dos')
  assert.equal(r.sinSuscripcion, 1, 'la fila de un cliente sin suscripción no se pierde en silencio')
  assert.equal(totalPorCobrar(r.suscripciones), 97 + 47 + 47 + 47)
  assert.equal(fechaDelProximoCobro(r.suscripciones.find((s) => s.id === 'l-4')!), '2026-10-15', 'ordena por el primero que espera')
  assert.equal(fechaDelProximoCobro(r.suscripciones.find((s) => s.id === 'l-1')!), '2026-12-01', 'sin cobros, por la renovación')
})

test('9 · Subscriptions: la columna «Próximo cobro» suma lo mismo que la tarjeta «Por cobrar» del Overview', () => {
  assert.ok(resumenEjemplo.porCobrar.ok)
  const tarjeta = resumenEjemplo.porCobrar.ok ? resumenEjemplo.porCobrar.datos.totalCentavos : NaN
  assert.equal(aCentavos(totalPorCobrar(SUSCRIPCIONES_EJEMPLO)), tarjeta)
  assert.equal(SUSCRIPCIONES_EJEMPLO.reduce((s, x) => s + (x.porCobrar?.length ?? 0), 0), POR_COBRAR_EJEMPLO.length, 'cada fila una vez')
  // Y la suscripción dice lo mismo que la fila: Taller Mecánico Ruta 9 venció el 15 de octubre y debe su Esencial.
  const taller = SUSCRIPCIONES_EJEMPLO.find((s) => s.cliente.ws === NEGOCIOS.taller.ws)!
  assert.deepEqual(taller.porCobrar, [{ fecha: '2026-10-15', usd: 47, atrasado: true }])
  assert.equal(taller.proximo?.vence, '2026-10-15')
  const pagina = sinComentarios(leer('app/admin/(polar)/sales/subscriptions/SubscriptionsPage.tsx'))
  assert.match(pagina, /title="Próximo cobro"/)
  assert.match(pagina, /original\.porCobrar\?\.length/, 'las filas de «Por cobrar», no una cuenta propia')
  assert.deepEqual(filasCsvSuscripciones([taller])[0].slice(3, 5), ['Próximo cobro', 'Por cobrar (USD)'])
  assert.deepEqual(filasCsvSuscripciones([taller])[1].slice(3, 5), ['2026-10-15', 47])
})

// ── 6. Los menores ────────────────────────────────────────────────────────────────────────────────────────────────────────

test('10 · el detalle de un pedido: un solo link a la ficha (el de Polar), sin «Entrar»; el checkout sin su número suelto', () => {
  const ctx = sinComentarios(leer('app/admin/_polar/web/Orders/OrderCustomerContext.tsx'))
  assert.equal(ctx.match(/<Link\b/g)?.length, 1)
  assert.doesNotMatch(ctx, /\/inicio\?ws=|Abrir su MaKo|label="Entrar"/)
  const checkout = sinComentarios(leer('app/admin/(polar)/sales/checkouts/[id]/CheckoutsPage.tsx'))
  assert.doesNotMatch(checkout, /\{checkout\.id\}/, 'el número del cobro no se dibuja suelto')
})

test('11 · Events sin los segundos, y la suscripción «Registrada a mano» (no se confunde con el «Plan a mano»)', () => {
  assert.equal(horaDelEvento('2026-11-06T14:20:59Z', false, 'UTC'), '06 nov, 14:20')
  assert.equal(ROTULO_FUENTE_SUSCRIPCION.manual, 'Registrada a mano')
  const html = renderToStaticMarkup(createElement(SubscriptionDetailsGrid, { subscription: SUSCRIPCIONES_EJEMPLO[0], hoy: HOY }))
  assert.match(html, /Cómo se cobra/)
  assert.match(html, /Registrada a mano/)
  assert.doesNotMatch(html, />A mano</)
  assert.equal(filasCsvSuscripciones([SUSCRIPCIONES_EJEMPLO[0]])[1].at(-1), 'Registrada a mano')
})

test('12 · los ejemplos: cada persona es una (con su negocio) y ningún negocio inventado aparte de ejemplo/negocios.ts', () => {
  // Una persona, un correo y un negocio: «Ana Gómez» es la de Estudio Norte en los cobros, los reportes y lo que hizo MaKo.
  const porNombre = new Map<string, Set<string>>()
  const anotar = (nombre: string | null | undefined, quien: string) => {
    if (!nombre) return
    porNombre.set(nombre, (porNombre.get(nombre) ?? new Set()).add(quien))
  }
  const deEmail = new Map(Object.entries(PERSONAS_EJEMPLO).map(([ws, p]) => [p.email, Number(ws)]))
  for (const c of COBROS_EJEMPLO) anotar(c.nombre, c.email ?? '')
  for (const [ws, p] of Object.entries(PERSONAS_EJEMPLO)) anotar(p.nombre, p.email)
  for (const [nombre, correos] of porNombre) assert.equal(correos.size, 1, `«${nombre}» es UNA persona (${[...correos].join(', ')})`)
  for (const e of EVENTOS_EJEMPLO.eventos) {
    if (e.nombre !== 'reporte' || !e.persona) continue
    const ws = Object.entries(PERSONAS_EJEMPLO).find(([, p]) => p.nombre === e.persona)?.[0]
    if (ws) assert.deepEqual(e.negocios.map((n) => n.ws), [Number(ws)], `${e.persona} reporta desde su negocio`)
  }
  assert.equal(deEmail.get('ana@ejemplo.com'), NEGOCIOS.estudioNorte.ws)
  // Los negocios de los ejemplos de esta área son los de ejemplo/negocios.ts (los de antes no vuelven).
  const fuentes = ['ventas', 'productos', 'analytics'].map((f) => leer(`app/admin/_polar/datos/ejemplo/${f}.ts`)).join('\n')
  for (const viejo of ['Panadería Sol', 'Clínica Arce', 'Agencia Faro', 'Taller Sur', 'Estudio Oeste', 'Estudio Este', 'Estudio Sol']) {
    assert.doesNotMatch(fuentes, new RegExp(viejo), `«${viejo}» no es un negocio de los ejemplos`)
  }
})

test('13 · una suscripción de ejemplo: lo que «pagó en total» es la suma de sus meses y lo que dicen los pagos de ejemplo', () => {
  for (const s of SUSCRIPCIONES_EJEMPLO) {
    if (s.fuente !== 'manual') continue
    assert.equal(s.historia.reduce((t, m) => t + m.pagadoUsd, 0), s.pagadoUsd, `${s.cliente.nombre}: los meses suman lo pagado`)
    assert.equal(s.pagadoUsd, pagadoPor(s.cliente.clave ?? '').total, `${s.cliente.nombre}: lo mismo que sus pagos`)
    if (s.mensualidadUsd != null) assert.equal(s.mensualidadUsd, s.historia.at(-1)?.esperadoUsd, `${s.cliente.nombre}: la mensualidad es la del último mes`)
  }
  // Estudio Norte: US$ 97 por mes en la ficha, en Subscriptions y en el Overview (no US$ 426).
  const norte = SUSCRIPCIONES_EJEMPLO.filter((s) => s.cliente.ws === NEGOCIOS.estudioNorte.ws)
  assert.equal(norte.length, 1, 'una suscripción, no dos')
  assert.equal(norte[0].mensualidadUsd, 97)
})
