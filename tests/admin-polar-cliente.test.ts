// =============================================================================
// Admin › Customers › <negocio> (la ficha de Polar: Overview, Usage, Events, Members): las funciones puras que arman sus props
// (app/admin/_polar/datos/cliente.ts) y que cada página pase por la puerta del super admin antes de leer.
// =============================================================================
// Correr: node --import tsx --test tests/admin-polar-cliente.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (6/11/2026). Base: 16 pass / 0 fail. Cada rotura, restaurada después (y la base otra vez 16/0):
//   · `cifrasDelRango` sin el `p.fecha >= desde` (lo pagado antes del rango sumaba)                       → 15/1 (Metrics)
//   · `pedidosDelNegocio` sin el `cliente?.ws === ws` (los pedidos de otro negocio)                       → 15/1 (Orders)
//   · `eventosDelNegocio`: todo pedido como «Pago recibido» (lo devuelto no se marcaba)                  → 15/1 (Events)
//   · `usoDelNegocio`: la IA también en las series del gráfico (pantallas + llamadas apiladas)          → 15/1 (Usage)
//   · `miembrosDe` sin el `u.rol === 'usuario'` (el equipo de MaKo salía como persona del negocio)      → 14/2 (Members, contacto)
//   · `cambiosDelNegocio` aceptando cualquier capa (`superadmin` pasaba como plan)                       → 15/1 (Editar)
//   · usage/page.tsx: una lectura (`void leerUso(0)`) antes de `exigirSuperAdmin()`                       → 15/1 (puerta)
//   · un `import MetricChartBox` en CustomerMetricsOverview (un gráfico de ingresos en Customers)        → 15/1 (sin gráfico)
//   · un cambio sin efecto (renombrar la variable local `llamadas` de `usoDelNegocio`)                   → 16/0 (sigue verde)

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  cambioDeEstado,
  cambioDeEstadoNegocio,
  cambiosDelMiembro,
  cambiosDelNegocio,
  cifrasDelRango,
  contactoDe,
  cubetaDe,
  eventosDelNegocio,
  filtrarEventos,
  inicioDeActividad,
  miembrosDe,
  nombresDeEventos,
  opcionesDePlanAMano,
  pedidosDelNegocio,
  PLANES_ASIGNABLES,
  resumenDeBorrado,
  rutaDePedido,
  rutaDeSuscripcion,
  segmentosDeTimeline,
  SIN_CAMBIO,
  suscripcionesDelNegocio,
  usoDelNegocio,
  wsDeId,
  type EventoNegocio,
} from '../app/admin/_polar/datos/cliente'
import type { ClienteVenta, Pedido, SuscripcionVenta } from '../app/admin/_polar/datos/ventas'
import {
  CABECERA_EJEMPLO,
  EVENTOS_EJEMPLO,
  MIEMBROS_EJEMPLO,
  OVERVIEW_EJEMPLO,
  PEDIDOS_EJEMPLO,
  USO_EJEMPLO,
  USUARIOS_EJEMPLO,
  WS_EJEMPLO,
} from '../app/admin/_polar/datos/ejemplo/cliente'

const RAIZ = fileURLToPath(new URL('..', import.meta.url))
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n')
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')

const cliente = (ws: number | null): ClienteVenta => ({ clave: ws != null ? `ws:${ws}` : 'lead:1', nombre: `Negocio ${ws}`, ws, leadId: null, email: null })
const pedido = (id: string, ws: number | null, fecha: string, usd: number | null, estado: Pedido['estado'] = 'paid'): Pedido => ({
  id, fecha, cliente: cliente(ws), concepto: null, medio: 'transferencia', recurrente: false, usd, estado, recibo: null, cobroId: null, origen: 'crm',
})

test('el id del path: un número de negocio, nunca otra cosa', () => {
  assert.equal(wsDeId('42'), 42)
  for (const malo of ['0', '-3', '4.5', '1e3', 'abc', '', '42 ', '01', '1234567890123']) assert.equal(wsDeId(malo), null, `«${malo}» no es un id`)
  assert.equal(wsDeId(undefined), null)
})

test('Overview › Metrics: lo pagado y los pagos del rango, sin lo devuelto ni lo que no tiene dólares; el MRR aparte', () => {
  const pedidos = [
    pedido('p-1', 7, '2026-10-01', 100),
    pedido('p-2', 7, '2026-10-15', 50, 'refunded'),
    pedido('p-3', 7, '2026-10-20', null),
    pedido('p-4', 7, '2026-09-30', 999),
    pedido('p-5', 7, '2026-11-01', 7),
  ]
  const c = cifrasDelRango(pedidos, 238, '2026-10-01', '2026-10-31')
  assert.equal(c.revenue, 10000, 'sólo lo pagado en el rango (centavos): lo devuelto y lo sin dólares no suman')
  assert.equal(c.orders, 3, 'los pedidos del rango, los dos bordes incluidos')
  assert.equal(c.sinDolares, 1)
  assert.equal(c.mrr, 23800, 'lo que paga por mes no depende del rango')
})

test('Overview › Orders y Subscriptions: sólo los de ESTE negocio (los de Sales), con el link a su detalle', () => {
  const pedidos = pedidosDelNegocio([pedido('p-1', 7, '2026-10-01', 1), pedido('p-2', 8, '2026-10-02', 1), pedido('p-3', null, '2026-10-03', 1), pedido('p-4', 7, '2026-10-05', 1)], 7)
  assert.deepEqual(pedidos.map((p) => p.id), ['p-4', 'p-1'], 'del negocio, el más nuevo primero')
  assert.equal(rutaDePedido(pedidos[0]), '/admin/sales/p-4')
  const sub = (id: string, ws: number, estado: SuscripcionVenta['estado'], empezo: string): SuscripcionVenta => ({
    id, fuente: 'manual', cliente: cliente(ws), estado, empezo, renovacion: null, terminaEl: null, termino: null, producto: null, mensualidadUsd: 100,
    mensualidadEstimada: false, diaDeCobro: null, meses: null, deudaUsd: 0, mesesSinPagar: 0, mesesParciales: 0, pagadoUsd: 0, proximo: null,
    historia: [], renovacionFallida: null, cobroParaCortar: null,
  })
  const subs = suscripcionesDelNegocio([sub('l-1', 7, 'canceled', '2026-01-01'), sub('l-2', 8, 'active', '2026-02-01'), sub('l-3', 7, 'active', '2026-03-01'), sub('l-4', 7, 'past_due', '2026-04-01')], 7)
  assert.deepEqual(subs.map((s) => s.id), ['l-4', 'l-3', 'l-1'], 'las vivas primero (atrasada, activa) y sin las de otro negocio')
  assert.equal(rutaDeSuscripcion(subs[0]), '/admin/sales/subscriptions/l-4')
})

test('Events: un evento por hecho, el más nuevo primero, con lo malo marcado y el link del pago', () => {
  const ev = eventosDelNegocio({
    ws: 7, creado: '2026-07-01T12:00:00Z',
    pedidos: [pedido('p-1', 7, '2026-10-01', 100), pedido('p-2', 7, '2026-10-02', 50, 'refunded')],
    movimientos: [{ fecha: '2026-10-03', tipo: 'corte', delta: -200, antes: 200, despues: 0 }],
    acciones: [{ creado: '2026-10-04T10:00:00Z', titulo: 'Crear un lead', operacion: 'crear_lead', canal: 'whatsapp', ok: false }],
    errores: [{ id: 3, titulo: 'Se rompió', origen: 'navegador', veces: 2, ultimaVez: '2026-10-05T10:00:00Z', ruta: null, estado: 'Nuevo' }],
    reportes: [{ id: 9, titulo: '', tipo: 'bug', estado: 'nuevo', creado: '2026-10-06T10:00:00Z' }],
  })
  assert.deepEqual(ev.map((e) => e.name), ['ticket.created', 'error.app', 'mako.action', 'subscription.canceled', 'order.refunded', 'order.paid', 'customer.created'])
  const porNombre = (n: string) => ev.find((e) => e.name === n) as EventoNegocio
  assert.equal(porNombre('order.paid').href, '/admin/sales/p-1', 'el pago lleva a su detalle en Sales')
  assert.equal(porNombre('order.paid').negativo, false)
  assert.equal(porNombre('order.refunded').negativo, true, 'un pago devuelto es malo')
  assert.equal(porNombre('mako.action').negativo, true, 'lo que MaKo no pudo hacer es malo')
  assert.equal(porNombre('mako.action').source, 'user')
  assert.equal(porNombre('subscription.canceled').resumen, 'Pagaba US$ 200 por mes')
  assert.equal(porNombre('ticket.created').label, 'Reporte a soporte', 'un reporte sin título dice qué es')
})

test('Events: el filtro por nombre y por rango, y los nombres que se ofrecen son sólo los que hay', () => {
  const nombres = nombresDeEventos(EVENTOS_EJEMPLO).map((n) => n.name)
  assert.ok(!nombres.includes('order.refunded'), 'no se ofrece un nombre sin eventos')
  assert.ok(nombres.includes('order.paid') && nombres.includes('mako.action'))
  const pagos = filtrarEventos(EVENTOS_EJEMPLO, { nombres: ['order.paid'] })
  assert.ok(pagos.length > 0 && pagos.every((e) => e.name === 'order.paid'))
  const nov = filtrarEventos(EVENTOS_EJEMPLO, { desde: '2026-11-01', hasta: '2026-11-30' })
  assert.ok(nov.length > 0 && nov.every((e) => e.timestamp.slice(0, 10) >= '2026-11-01'), 'el rango mira el día (también de un ISO con hora)')
  assert.equal(filtrarEventos(EVENTOS_EJEMPLO, {}).length, EVENTOS_EJEMPLO.length, 'sin filtro, todos')
})

test('Timeline: lo de importancia baja seguido va plegado, como Polar', () => {
  const e = (id: string, importancia: EventoNegocio['importancia']): EventoNegocio => ({
    id, timestamp: '2026-10-01', name: 'mako.action', label: id, source: 'user', importancia, resumen: null, negativo: false, href: null, detalle: [],
  })
  const s = segmentosDeTimeline([e('a', 'high'), e('b', 'low'), e('c', 'low'), e('d', 'medium'), e('f', 'low')])
  assert.deepEqual(s.map((x) => (x.type === 'event' ? x.evento.id : `fold:${x.eventos.map((y) => y.id).join('')}`)), ['a', 'fold:bc', 'd', 'fold:f'])
})

test('Usage: las tabs que usa con sus pantallas, acciones y personas; la IA aparte y fuera del gráfico; y las que no usa', () => {
  const u = usoDelNegocio(USO_EJEMPLO.filas, USO_EJEMPLO.tabs, USO_EJEMPLO.ia, '2026-11-01', '2026-11-30', 'day')
  assert.deepEqual(u.medidores.map((m) => m.key), ['crm', 'plan', 'ia'], 'lo más usado primero y la IA al final')
  const crm = u.medidores[0]
  assert.equal(crm.consumido, 24)
  assert.equal(crm.acciones, 8)
  assert.equal(crm.personas, 2)
  assert.equal(crm.ultimo, '2026-11-05')
  const ia = u.medidores.find((m) => m.key === 'ia')
  assert.equal(ia?.consumido, 65)
  assert.equal(ia?.unidad, 'llamadas')
  assert.equal(ia?.costoUsd, 0.2)
  assert.ok(!u.series.some((s) => s.key === 'ia'), 'la IA no va en el gráfico (otra unidad)')
  assert.deepEqual(u.sinUso.map((t) => t.key), ['automations'], 'lo que nadie abrió')
  const dia5 = u.serie.find((p) => p.timestamp === '2026-11-05T00:00:00.000Z')
  assert.equal(dia5?.crm, 12, 'el punto del gráfico suma las pantallas del día de todas las personas')
  const fuera = usoDelNegocio(USO_EJEMPLO.filas, USO_EJEMPLO.tabs, USO_EJEMPLO.ia, '2026-10-01', '2026-10-31', 'day')
  assert.equal(fuera.medidores.length, 0, 'fuera del rango no hay uso')
  assert.equal(fuera.sinUso.length, 3)
})

test('Usage: dos keys que se dibujan igual son UNA tab, y el gráfico se agrupa por el intervalo', () => {
  const tabs = [{ key: 'mako', label: 'Ops Center', keys: ['mako', 'second-brain'] }]
  const u = usoDelNegocio([
    { dia: '2026-11-02', usuario: 1, tab: 'mako', pantallas: 1, acciones: 0 },
    { dia: '2026-11-04', usuario: 2, tab: 'second-brain', pantallas: 2, acciones: 0 },
  ], tabs, [], '2026-11-01', '2026-11-30', 'week')
  assert.equal(u.medidores.length, 1)
  assert.equal(u.medidores[0].consumido, 3)
  assert.equal(u.serie.length, 1, 'los dos días caen en la misma semana')
  assert.equal(cubetaDe('2026-11-04', 'week'), '2026-11-02T00:00:00.000Z', 'la semana empieza el lunes')
  assert.equal(cubetaDe('2026-11-04', 'month'), '2026-11-01T00:00:00.000Z')
})

test('Members: sólo las personas del negocio (no las de otro, ni el equipo de MaKo), en el orden de alta', () => {
  assert.deepEqual(MIEMBROS_EJEMPLO.map((m) => m.id), [101, 102, 103])
  assert.equal(MIEMBROS_EJEMPLO[2].estado, 'invitado')
  assert.equal(MIEMBROS_EJEMPLO[2].accesoEnviado, null, 'se sabe que nunca se le mandó el acceso')
  assert.equal(MIEMBROS_EJEMPLO[0].mfa, true)
  assert.equal(miembrosDe(USUARIOS_EJEMPLO, 43).length, 1)
  assert.equal(contactoDe(MIEMBROS_EJEMPLO), 'ana@ejemplo.com', 'el contacto es su admin activo')
  assert.equal(contactoDe(miembrosDe(USUARIOS_EJEMPLO, 99)), null)
})

test('Members: lo que se le pide a /api/admin/usuarios', () => {
  const m = MIEMBROS_EJEMPLO[1]
  assert.deepEqual(cambiosDelMiembro(m, { nombre: '  Bruno Díaz ', rol: 'closer' }), [], 'sin cambios, nada')
  assert.deepEqual(cambiosDelMiembro(m, { nombre: 'Bruno D.', rol: 'admin' }), [
    { action: 'nombre', id: 102, nombre: 'Bruno D.' }, { action: 'rolws', id: 102, rol_ws: 'admin' },
  ])
  assert.deepEqual(cambiosDelMiembro(m, { nombre: '', rol: null }), [], 'un nombre vacío no borra el nombre')
  assert.deepEqual(cambioDeEstado({ id: 1, estado: 'activo' }), { action: 'estado', id: 1, estado: 'suspendido' })
  assert.deepEqual(cambioDeEstado({ id: 1, estado: 'invitado' }), { action: 'estado', id: 1, estado: 'suspendido' })
  assert.deepEqual(cambioDeEstado({ id: 1, estado: 'suspendido' }), { action: 'estado', id: 1, estado: 'activo' })
})

test('Editar el negocio: sólo lo que cambió, nunca el plan de la plataforma, y el plan a mano se elige', () => {
  const n = CABECERA_EJEMPLO
  assert.deepEqual(cambiosDelNegocio(n, { nombre: n.nombre, capa: n.capa, planAMano: SIN_CAMBIO }), [], 'sin cambios, nada')
  assert.deepEqual(cambiosDelNegocio(n, { nombre: 'Estudio Sur', capa: 'completo', planAMano: '30' }), [
    { action: 'nombre', id: WS_EJEMPLO, nombre: 'Estudio Sur' }, { action: 'capa', id: WS_EJEMPLO, capa: 'completo' }, { action: 'plan_a_mano', id: WS_EJEMPLO, dias: 30 },
  ])
  assert.deepEqual(cambiosDelNegocio(n, { nombre: n.nombre, capa: 'superadmin', planAMano: '0' }), [{ action: 'plan_a_mano', id: WS_EJEMPLO, dias: 0 }], 'superadmin no es un plan')
  assert.deepEqual(cambiosDelNegocio(n, { nombre: n.nombre, capa: n.capa, planAMano: '45' }), [], 'unos días que no se dan, no')
  assert.ok(!PLANES_ASIGNABLES.some((p) => p.capa === 'superadmin'))
  assert.ok(!opcionesDePlanAMano(false).some((o) => o.value === '0'), 'quitar sólo si tiene uno')
  assert.ok(opcionesDePlanAMano(true).some((o) => o.value === '0'))
  assert.ok(opcionesDePlanAMano(true).every((o) => o.value !== ''), 'un select de radix no acepta un valor vacío')
  assert.deepEqual(cambioDeEstadoNegocio({ ws: 5, estado: 'activo' }), { action: 'estado', id: 5, estado: 'pausado' })
  assert.deepEqual(cambioDeEstadoNegocio({ ws: 5, estado: 'pausado' }), { action: 'estado', id: 5, estado: 'activo' })
})

test('Eliminar: se dice lo que se llevó', () => {
  assert.equal(
    resumenDeBorrado('Estudio Norte', { borrado: { leads: 10, pagos: 2 }, usuarios: 1, leadsDesligados: 1, avisos: ['La línea ya estaba cortada.'] }),
    'Se eliminó Estudio Norte: 12 filas en 2 tablas, 1 persona y 1 lead de tu CRM que quedaron sin cuenta. La línea ya estaba cortada.',
  )
  assert.equal(resumenDeBorrado('X', {}), 'Se eliminó X: 0 filas en 0 tablas, 0 personas.')
})

test('El rango: «All Time» arranca en el alta, o en el primer pago si fue antes', () => {
  assert.equal(inicioDeActividad('2026-07-01T12:00:00Z', PEDIDOS_EJEMPLO), '2026-07-01')
  assert.equal(inicioDeActividad('2026-07-01T12:00:00Z', [{ fecha: '2026-05-03' }]), '2026-05-03')
  assert.equal(inicioDeActividad('2026-07-01T12:00:00Z', []), '2026-07-01')
})

test('Los datos de ejemplo arman las vistas (y son ficticios)', () => {
  assert.equal(OVERVIEW_EJEMPLO.pedidos.length, 5)
  const txt = JSON.stringify({ OVERVIEW_EJEMPLO, USO_EJEMPLO, MIEMBROS_EJEMPLO })
  for (const real of ['Mauricio', 'Leila', 'Florencia', 'Leandro', 'Código Inmobiliario', 'Brigitte']) assert.ok(!txt.includes(real), `sin «${real}»`)
})

const PAGINAS = [
  'app/admin/(polar)/customers/[id]/page.tsx',
  'app/admin/(polar)/customers/[id]/usage/page.tsx',
  'app/admin/(polar)/customers/[id]/events/page.tsx',
  'app/admin/(polar)/customers/[id]/members/page.tsx',
]

test('cada página de la ficha: dinámica y con la puerta del super admin como PRIMERA sentencia (también el título)', () => {
  for (const p of PAGINAS) {
    const src = sinComentarios(leer(p))
    assert.match(src, /export const dynamic = 'force-dynamic'/, `${p}: dinámica`)
    assert.match(src, /export default async function \w*\([^)]*\)[^{]*\{\s*await exigirSuperAdmin\(\)/, `${p}: exigirSuperAdmin() antes de leer`)
    assert.match(src, /export async function generateMetadata\([^)]*\)[^{]*\{\s*await exigirSuperAdmin\(\)/, `${p}: el título (el nombre del negocio) también`)
    assert.doesNotMatch(src, /searchParams|[?&]ws=/, `${p}: el negocio va en el path, nunca en ?ws=`)
  }
})

const AREA = [
  ...PAGINAS,
  'app/admin/_polar/web/Customer/CustomerPage/CustomerPageShell.tsx',
  'app/admin/_polar/web/Customer/CustomerPage/CustomerHeader.tsx',
  'app/admin/_polar/web/Customer/CustomerPage/CustomerOverview.tsx',
  'app/admin/_polar/web/Customer/CustomerPage/CustomerMetricsOverview.tsx',
  'app/admin/_polar/web/Customer/CustomerPage/CustomerDetailsSection.tsx',
  'app/admin/_polar/web/Customer/CustomerPage/CustomerUsageView.tsx',
  'app/admin/_polar/web/Customer/CustomerPage/CustomerEventsView.tsx',
  'app/admin/_polar/web/Customer/CustomerPage/MembersSection.tsx',
  'app/admin/_polar/web/Customer/CustomerTimeline.tsx',
  'app/admin/_polar/web/Customer/EditCustomerModal.tsx',
  'app/admin/_polar/web/Customer/EditMemberModal.tsx',
  'app/admin/_polar/datos/cliente.ts',
  'app/admin/_polar/datos/cliente-server.ts',
]
const VIEJAS = /from '@\/app\/admin\/(_studio|usuarios|ingresos|cobros\/_components|cobros\/recibo|actividad|errores|AdminView)|from '@\/app\/customers\//
const GRAFICO_DE_INGRESOS = /\/MetricChartBox'|\/MetricChart'|\/GenericChart'|\bMetricGroup\b|metricasDeIngresos/

test('la ficha no monta pantallas viejas, y en Customers no hay gráfico de ingresos (sólo las cifras)', () => {
  for (const p of AREA) {
    const src = sinComentarios(leer(p))
    assert.doesNotMatch(src, VIEJAS, `${p}: no importa una pantalla vieja`)
    assert.doesNotMatch(src, GRAFICO_DE_INGRESOS, `${p}: no dibuja un gráfico de ingresos`)
  }
})
