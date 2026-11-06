// =============================================================================
// Admin › Customers › <negocio> (la ficha de Polar: Overview, Usage, Members; Events es Analytics › Events filtrado por el negocio):
// las funciones puras que arman sus props (app/admin/_polar/datos/cliente.ts, y el Timeline de app/admin/_polar/datos/eventos.ts)
// y que cada página pase por la puerta del super admin antes de leer.
// =============================================================================
// Correr: node --import tsx --test tests/admin-polar-cliente.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (6/11/2026). Base: 16 pass / 0 fail. Cada rotura, restaurada después (y la base otra vez 16/0):
//   · `cifrasDelRango` sin el `p.fecha >= desde` (lo pagado antes del rango sumaba)                       → 15/1 (Metrics)
//   · `pedidosDelNegocio` sin el `cliente?.ws === ws` (los pedidos de otro negocio)                       → 15/1 (Orders)
//   · `usoDelNegocio`: la IA también en las series del gráfico (pantallas + llamadas apiladas)          → 15/1 (Usage)
//   · `miembrosDe` sin el `u.rol === 'usuario'` (el equipo de MaKo salía como persona del negocio)      → 14/2 (Members, contacto)
//   · `cambiosDelNegocio` aceptando cualquier capa (`superadmin` pasaba como plan)                       → 15/1 (Editar)
//   · usage/page.tsx: una lectura (`void leerUso(0)`) antes de `exigirSuperAdmin()`                       → 15/1 (puerta)
//   · un `import MetricChartBox` en CustomerMetricsOverview (un gráfico de ingresos en Customers)        → 15/1 (sin gráfico)
//   · un cambio sin efecto (renombrar la variable local `llamadas` de `usoDelNegocio`)                   → 16/0 (sigue verde)
// Desde que Events dejó de ser una página de la ficha (6/11/2026, como Polar). Base: 17 / 0; cada rotura, sola y restaurada:
//   · `rutaDeEventosDelNegocio` con `range: 'last3Months'` en vez de 'allTime'                           → 16/1 (Events)
//   · la subnav vuelve a llevar «Events» a `/admin/customers/<ws>/events`                                → 16/1 (Events)
//   · el «Ver todos» del Timeline (CustomerOverview) vuelve a la ruta vieja                              → 16/1 (Events)
//   · `timelineDelNegocio` sin el filtro del negocio (`negocios: null`: eventos de todos)                → 16/1 (Timeline)
//   · `timelineDelNegocio` sólo con los 20 de «Todos» (se pierden los de «Sistema» más viejos)          → 16/1 (Timeline)
//   · events/page.tsx valida el negocio (lee) antes de `exigirSuperAdmin()`                             → 16/1 (redirige)
//   · un cambio sin efecto (renombrar la local `delNegocio` de `timelineDelNegocio`)                     → 17/0 (sigue verde)
// Los arreglos de la revisión del Cerebro (6/11/2026: 18, 20, 22, 25, 27, 30, 39, 41). Base: 28 / 0; cada rotura, sola y restaurada
// de memoria (la base otra vez 28/0), da 27/1:
//   · `estadoDeLaCabecera` dice «Activo» aunque no se sepa si debe; la cabecera vuelve a «Negocio #n»          (27, cabecera)
//   · «Leads» sin el último; el último ingreso que no se leyó, dicho «Nunca»                                     (27, Activity)
//   · la sección vuelve a «Datos»                                                                                (39)
//   · Subscriptions sin «Debe»                                                                                   (27)
//   · Usage sin el selector del rango; Usage vuelve a «Medidor»                                                 (30, 27)
//   · `avisoDelCambioDePlan` mira `enviado === false` a secas; `enOrden` sin los pasos (sólo la última)         (18)
//   · «Ir a Customers» sin `refresh`; la cabecera de un negocio eliminado con el menú                           (20)
//   · «Suspender» sin confirmación                                                                              (22)
//   · un negocio que no existe cuenta como negocio; el alta en la plataforma con negocio; la mudanza después
//     del rol; «Agregar persona» escondido cuando no hay nadie                                                  (25)
//   · y un cambio sin efecto (renombrar la local `cuantos` de `textoDeLeads`)                                   → 28/0

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
import * as modulo from 'node:module'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { PathnameContext, SearchParamsContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime'
import {
  avisoDelCambioDePlan,
  confirmacionDeEstado,
  consecuenciaDeAlta,
  cuerpoDeAlta,
  estadoDeLaCabecera,
  miembrosDePlataforma,
  TEXTO_ELIMINAR_PERSONA,
  textoDeLeads,
  textoDeSesiones,
  ultimoIngresoDe,
  type UsuarioParaMiembro,
  cambioDeEstado,
  cambioDeEstadoNegocio,
  cambiosDelMiembro,
  cambiosDelNegocio,
  cifrasDelRango,
  contactoDe,
  cubetaDe,
  inicioDeActividad,
  miembrosDe,
  opcionesDePlanAMano,
  pedidosDelNegocio,
  PLANES_ASIGNABLES,
  resumenDeBorrado,
  rutaDeEventosDelNegocio,
  rutaDePedido,
  rutaDeSuscripcion,
  SIN_CAMBIO,
  suscripcionesDelNegocio,
  usoDelNegocio,
  wsDeId,
} from '../app/admin/_polar/datos/cliente'
import {
  LIMITE_TIMELINE,
  segmentosDeTimeline,
  timelineDelNegocio,
  type EventoAdmin,
} from '../app/admin/_polar/datos/eventos'
import { CustomerTimeline } from '../app/admin/_polar/web/Customer/CustomerTimeline'
import { clientesEnRiesgo } from '../app/admin/_polar/datos/clientes'
import { tipoDePersona } from '../app/admin/_polar/datos/personas'
import { enOrden, irALaLista, type ResultadoAccion } from '../app/admin/_polar/web/Customer/CustomerPage/acciones'
import { TooltipProvider } from '../app/admin/_polar/orbit/components/Tooltip'
import type { ClienteVenta, Pedido, SuscripcionVenta } from '../app/admin/_polar/datos/ventas'
import {
  ALTA_EJEMPLO,
  CABECERA_EJEMPLO,
  COMPUTADORAS_EJEMPLO,
  CONEXIONES_EJEMPLO,
  EVENTOS_EJEMPLO,
  HOY_EJEMPLO,
  SUSCRIPCIONES_EJEMPLO,
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

test('Events: no es una página de la ficha, es Analytics › Events filtrado por el negocio, desde siempre (como Polar)', () => {
  assert.equal(rutaDeEventosDelNegocio(42), '/admin/analytics/events?customerIds=42&range=allTime', 'el `buildCustomerEventsPath` de Polar')
  const q = new URL(rutaDeEventosDelNegocio(7), 'https://x').searchParams
  assert.deepEqual([...q.entries()], [['customerIds', '7'], ['range', 'allTime']])
  // La subnav: «Events» es el link externo de Polar (sin la query del rango de las métricas).
  const subnav = sinComentarios(leer('app/admin/_polar/web/Customer/CustomerPage/CustomerSubnav.tsx'))
  assert.match(subnav, /\{\s*label: 'Events',\s*href: rutaDeEventosDelNegocio\(ws\),\s*external: true,\s*\}/, 'Events lleva a Analytics › Events')
  assert.match(subnav, /<Link href=\{external \? href : `\$\{href\}\$\{query\}`\}>/, 'sin la query de las métricas')
  // El «Ver todos» del Timeline, a la misma pantalla (dibujado, no leído).
  const html = renderToStaticMarkup(createElement(TooltipProvider, null, createElement(CustomerTimeline, { eventos: EVENTOS_EJEMPLO, viewAllHref: rutaDeEventosDelNegocio(WS_EJEMPLO) })))
  assert.ok(html.includes(`href="${rutaDeEventosDelNegocio(WS_EJEMPLO).replace(/&/g, '&amp;')}"`), '«Ver todos los eventos» lleva a Analytics › Events del negocio')
  assert.match(sinComentarios(leer('app/admin/_polar/web/Customer/CustomerPage/CustomerOverview.tsx')), /viewAllHref=\{rutaDeEventosDelNegocio\(negocio\.ws\)\}/)
  // Ninguna lista de eventos propia de la ficha: ni la vista, ni su lector, ni un link a la ruta vieja.
  const archivos = execSync("git ls-files -co --exclude-standard 'app/admin/_polar/**' 'app/admin/(polar)/**'", { cwd: RAIZ, encoding: 'utf8' }).split('\n').filter((f) => /\.(ts|tsx)$/.test(f))
  for (const f of ['CustomerEventsView.tsx', 'EventSelect.tsx', 'CustomerPage/EventRow.tsx']) assert.ok(!archivos.some((a) => a.endsWith(f)), `${f} volvió`)
  for (const f of archivos) {
    const src = sinComentarios(leer(f))
    assert.doesNotMatch(src, /rutaDeFicha\([^)]*'events'\)|customers\/\$\{[^}]+\}\/events/, `${f}: un link a la lista vieja de eventos de la ficha`)
  }
  assert.doesNotMatch(sinComentarios(leer('app/admin/_polar/datos/cliente-server.ts')), /export const leerEventos|from\('actividad_acciones'\)|from\('tickets'\)/, 'la ficha no lee sus eventos aparte')
})

test('Timeline: los últimos eventos del negocio, de la misma lista que Analytics › Events', () => {
  assert.ok(EVENTOS_EJEMPLO.length > 0)
  const otro = EVENTOS_EJEMPLO.filter((e) => e.label === 'Se creó la cuenta')
  assert.equal(otro.length, 1, 'el alta de ESTE negocio, no la del de al lado')
  assert.ok(!EVENTOS_EJEMPLO.some((e) => e.id === 'pago:p-40'), 'un pago de otro negocio no entra')
  assert.ok(EVENTOS_EJEMPLO.every((e, i) => i === 0 || EVENTOS_EJEMPLO[i - 1].timestamp >= e.timestamp), 'el más nuevo primero')
  const pago = EVENTOS_EJEMPLO.find((e) => e.id === 'pago:p-31')!
  assert.deepEqual([pago.label, pago.resumen, pago.href, pago.source, pago.importancia], ['Pago recibido', 'US$ 238 · Transferencia', '/admin/sales/p-31', 'system', 'high'])
  const subio = EVENTOS_EJEMPLO.find((e) => e.nombre === 'suscripcion' && e.label === 'Subió lo que paga por mes')!
  assert.deepEqual([subio.resumen, subio.importancia], ['US$ 238 por mes', 'medium'])
  const fallo = EVENTOS_EJEMPLO.find((e) => e.nombre === 'mako' && e.negativo)!
  assert.deepEqual([fallo.label, fallo.resumen, fallo.source], ['Mandar un email (falló)', 'En la app · No salió', 'user'])
  assert.ok(!('campos' in pago) && !('texto' in pago), 'al navegador va sólo lo que dibuja el Timeline')

  // Viajan los 20 más recientes de cada vista («Sistema» y «Todos»), no la lista entera.
  const muchos: EventoAdmin[] = Array.from({ length: 30 }, (_, i) => ({
    id: `mako:${i}`, nombre: i % 3 === 0 ? 'error' : 'mako', label: String(i), timestamp: new Date(Date.UTC(2026, 9, 30 - i)).toISOString(),
    negocios: [{ ws: 5, nombre: 'X' }], persona: null, monto: null, veces: null, falla: false, negativo: false, importancia: 'medium',
    resumen: null, href: null, campos: [], secciones: [], texto: '',
  }))
  const t = timelineDelNegocio(muchos, 5)
  assert.equal(t.filter((e) => e.source === 'system').length, 10, 'todos los de sistema (son 10, entre los 30)')
  assert.equal(t.slice(0, LIMITE_TIMELINE).length, LIMITE_TIMELINE, 'y los 20 más recientes de todos')
  assert.equal(t.length, 20 + 3, 'los 20 más nuevos y los de sistema que quedaban afuera')
  assert.deepEqual(timelineDelNegocio(muchos, 6), [], 'nada de otro negocio')
})

test('Timeline: lo de importancia baja seguido va plegado, como Polar', () => {
  const e = (id: string, importancia: 'high' | 'medium' | 'low') => ({ id, importancia })
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
  // El día viaja como texto (YYYY-MM-DD): el gráfico lo lee como medianoche local (punto 5; tests/admin-polar-zona.test.ts).
  const dia5 = u.serie.find((p) => p.timestamp === '2026-11-05')
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
  assert.equal(cubetaDe('2026-11-04', 'week'), '2026-11-02', 'la semana empieza el lunes')
  assert.equal(cubetaDe('2026-11-04', 'month'), '2026-11-01')
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
  'app/admin/(polar)/customers/[id]/members/page.tsx',
]
const EVENTOS_VIEJA = 'app/admin/(polar)/customers/[id]/events/page.tsx'

test('cada página de la ficha: dinámica y con la puerta del super admin como PRIMERA sentencia (también el título)', () => {
  for (const p of PAGINAS) {
    const src = sinComentarios(leer(p))
    assert.match(src, /export const dynamic = 'force-dynamic'/, `${p}: dinámica`)
    assert.match(src, /export default async function \w*\([^)]*\)[^{]*\{\s*await exigirSuperAdmin\(\)/, `${p}: exigirSuperAdmin() antes de leer`)
    assert.match(src, /export async function generateMetadata\([^)]*\)[^{]*\{\s*await exigirSuperAdmin\(\)/, `${p}: el título (el nombre del negocio) también`)
    assert.doesNotMatch(src, /searchParams|[?&]ws=/, `${p}: el negocio va en el path, nunca en ?ws=`)
  }
})

test('la ruta vieja de Events de la ficha redirige a Analytics › Events del negocio, después de la puerta y de validar el id', () => {
  const src = sinComentarios(leer(EVENTOS_VIEJA))
  assert.match(src, /export const dynamic = 'force-dynamic'/)
  const cuerpo = src.slice(src.indexOf('export default async function'))
  const puerta = cuerpo.indexOf('await exigirSuperAdmin()')
  const valida = cuerpo.indexOf('await negocioONotFound(params.id)')
  const va = cuerpo.indexOf('redirect(rutaDeEventosDelNegocio(ws), RedirectType.replace)')
  assert.match(cuerpo, /^export default async function \w*\([^)]*\)[^{]*\{\s*await exigirSuperAdmin\(\)/, 'la puerta es la primera sentencia')
  assert.ok(puerta > 0 && valida > puerta && va > valida, 'puerta → el negocio existe (404 si no) → redirige')
  assert.doesNotMatch(src, /CustomerPageShell|leerEventos|searchParams|[?&]ws=/, 'ya no dibuja nada ni lee eventos')
})

const AREA = [
  ...PAGINAS,
  EVENTOS_VIEJA,
  'app/admin/_polar/web/Customer/CustomerPage/CustomerPageShell.tsx',
  'app/admin/_polar/web/Customer/CustomerPage/CustomerHeader.tsx',
  'app/admin/_polar/web/Customer/CustomerPage/CustomerOverview.tsx',
  'app/admin/_polar/web/Customer/CustomerPage/CustomerMetricsOverview.tsx',
  'app/admin/_polar/web/Customer/CustomerPage/CustomerDetailsSection.tsx',
  'app/admin/_polar/web/Customer/CustomerPage/CustomerUsageView.tsx',
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

// ── Los arreglos de la revisión del Cerebro (docs/admin/revision-cerebro-6-11.md): 18, 20, 22, 25, 27, 30, 39 y 41 ───────────

// Las piezas que importan una server action ('use server' → lib/auth, con `server-only`) se dibujan con la condición de
// react-server: ahí `server-only` es un módulo vacío (el molde de tests/general-meta-muestra.test.ts). Las que usan el router
// de Next, adentro de sus contextos.
type CtxHook = { conditions?: string[] }
type Resolver = (spec: string, ctx: CtxHook, next: (spec: string, ctx: CtxHook) => unknown) => unknown
const { registerHooks } = modulo as unknown as { registerHooks: (h: { resolve: Resolver }) => void }
registerHooks({
  resolve(spec, ctx, next) {
    if (spec === 'server-only') return next(spec, { ...ctx, conditions: [...(ctx.conditions ?? []), 'react-server'] })
    return next(spec, ctx)
  },
})
const nada = () => {}
const ROUTER = { back: nada, forward: nada, refresh: nada, push: nada, replace: nada, prefetch: nada }
const conRouter = (el: ReturnType<typeof createElement>, pathname = '/admin/customers/42') =>
  createElement(AppRouterContext.Provider, { value: ROUTER as never },
    createElement(PathnameContext.Provider, { value: pathname },
      createElement(SearchParamsContext.Provider, { value: new URLSearchParams() as never },
        createElement(TooltipProvider, null, el))))
const dibujar = (el: ReturnType<typeof createElement>) => renderToStaticMarkup(conRouter(el))

test('27 · la cabecera dice el plan y cómo está en palabras (el texto de At Risk), no «Negocio #n»', async () => {
  assert.deepEqual(estadoDeLaCabecera('MaKo Pro', 'activo', { texto: 'Atrasado 4 días', grave: true }), { estadoTxt: 'MaKo Pro · Atrasado 4 días', grave: true })
  assert.deepEqual(estadoDeLaCabecera('MaKo Pro', 'activo', undefined), { estadoTxt: 'MaKo Pro · Activo', grave: false })
  assert.deepEqual(estadoDeLaCabecera('MaKo Pro', 'pausado', null), { estadoTxt: 'MaKo Pro · Pausado', grave: false })
  assert.deepEqual(estadoDeLaCabecera('MaKo Pro', 'activo', null), { estadoTxt: 'MaKo Pro', grave: false }, 'sin saber si debe, no dice «Activo»')
  // El texto es el mismo de At Risk (clientesEnRiesgo), con su motivo más grave.
  const riesgo = clientesEnRiesgo(
    [{ ws: 42, nombre: 'Estudio Norte', capa: 'agencia', estado: 'activo', motivoRiesgo: null, sinEntrar: 3, mrrUsd: 238, planAManoTxt: null, segmentos: ['cliente'] }],
    [{ clave: 'ws:42', ws: 42, nombre: 'Estudio Norte', estado: 'atrasado', mrr: 238, diasAtraso: 4 }],
  )[0]
  assert.equal(estadoDeLaCabecera('MaKo Pro', 'activo', riesgo).estadoTxt, 'MaKo Pro · Atrasado 4 días')
  const { CustomerPageShell } = await import('../app/admin/_polar/web/Customer/CustomerPage/CustomerPageShell')
  const html = dibujar(createElement(CustomerPageShell, { negocio: { ...CABECERA_EJEMPLO, ...estadoDeLaCabecera('MaKo Pro', 'activo', riesgo) } }, null))
  assert.ok(html.includes('MaKo Pro · Atrasado 4 días'))
  assert.ok(!html.includes(`Negocio #${WS_EJEMPLO}`), 'el número va sólo en la fila ID')
})

test('27 · Details › Activity: último ingreso, leads (cuántos y el último) y sesiones del agente; «no se pudo leer» no es un cero', async () => {
  assert.equal(textoDeLeads({ total: 48, diasDelUltimo: 2 }), '48 leads · el último hace 2 días')
  assert.equal(textoDeLeads({ total: 1, diasDelUltimo: 0 }), '1 lead · el último hoy')
  assert.equal(textoDeLeads({ total: 0, diasDelUltimo: null }), 'Sin leads')
  assert.equal(textoDeLeads(null), null)
  assert.equal(textoDeSesiones(0), 'Ninguna en 30 días')
  assert.equal(textoDeSesiones(6), '6 en 30 días')
  assert.equal(textoDeSesiones(null), null)
  assert.equal(ultimoIngresoDe(MIEMBROS_EJEMPLO), '2026-11-05T14:20:00Z', 'el más reciente de su equipo')
  assert.equal(ultimoIngresoDe([]), null)
  const { CustomerDetailsSection } = await import('../app/admin/_polar/web/Customer/CustomerPage/CustomerDetailsSection')
  const props = { negocio: CABECERA_EJEMPLO, alta: ALTA_EJEMPLO, conexiones: CONEXIONES_EJEMPLO, computadoras: COMPUTADORAS_EJEMPLO }
  const html = dibujar(createElement(CustomerDetailsSection, props))
  for (const t of ['Activity', 'Último ingreso', '48 leads · el último hace 2 días', '6 en 30 días']) assert.ok(html.includes(t), `falta «${t}»`)
  const sinLeer = dibujar(createElement(CustomerDetailsSection, { ...props, alta: { ...ALTA_EJEMPLO, actividad: { ultimoIngreso: 'no-leida', leads: null, sesionesAgente: null } } }))
  assert.ok(sinLeer.includes('No se pudo leer') && sinLeer.includes('No se pudieron leer'))
  assert.ok(!sinLeer.includes('Sin leads') && !sinLeer.includes('Ninguna en 30 días'), 'lo que no se leyó no se dice como un cero')
})

test('39 · la ficha nombra sus secciones en inglés, como Polar (Details, Onboarding, Integrations, Timeline)', async () => {
  const { CustomerDetailsSection } = await import('../app/admin/_polar/web/Customer/CustomerPage/CustomerDetailsSection')
  const html = dibujar(createElement(CustomerDetailsSection, { negocio: CABECERA_EJEMPLO, alta: ALTA_EJEMPLO, conexiones: CONEXIONES_EJEMPLO, computadoras: COMPUTADORAS_EJEMPLO }))
  const titulos = [...html.matchAll(/<h3[^>]*>([^<]+)<\/h3>/g)].map((m) => m[1])
  assert.deepEqual(titulos, ['Details', 'Activity', 'Onboarding', 'Integrations'])
  assert.ok(html.includes('Estado del alta'), 'el renglón del onboarding')
  const timeline = renderToStaticMarkup(createElement(TooltipProvider, null, createElement(CustomerTimeline, { eventos: EVENTOS_EJEMPLO, viewAllHref: '/x' })))
  assert.ok(timeline.includes('>Timeline<') && !timeline.includes('Línea de tiempo'))
})

test('27 · Subscriptions: cuándo le toca pagar («Próxima») y lo que debe («Debe»)', async () => {
  const { CustomerSubscriptionsTable } = await import('../app/admin/_polar/web/Customer/CustomerPage/CustomerSubscriptionsTable')
  const debe = { ...SUSCRIPCIONES_EJEMPLO[0], id: 'l-8', estado: 'past_due' as const, deudaUsd: 476 }
  const html = dibujar(createElement(CustomerSubscriptionsTable, { suscripciones: [SUSCRIPCIONES_EJEMPLO[0], debe], hoy: HOY_EJEMPLO }))
  assert.ok(html.includes('Próxima') && html.includes('Debe'))
  assert.ok(html.includes('4 dic'), 'la próxima, sin el año de hoy')
  assert.ok(html.includes('476'), 'lo que debe')
})

test('27, 30 y 41 · Usage: «Dónde» y «Uso», el rango a la vista (también sin uso) y los textos sin criterios internos', async () => {
  const { CustomerUsageView } = await import('../app/admin/_polar/web/Customer/CustomerPage/CustomerUsageView')
  const html = dibujar(createElement(CustomerUsageView, USO_EJEMPLO))
  assert.ok(html.includes('Dónde') && html.includes('>Uso<'), 'los encabezados')
  assert.ok(!html.includes('Medidor') && !html.includes('Consumido'))
  assert.ok(html.includes('>30d<') && html.includes('>12m<'), 'el selector del rango')
  const vacio = dibujar(createElement(CustomerUsageView, { ...USO_EJEMPLO, filas: [], ia: [] }))
  assert.ok(vacio.includes('Sin uso en estos días') && vacio.includes('>30d<'), 'el rango también en el vacío')
  assert.ok(html.includes('No incluye Claude con la clave de MaKo.') && !html.includes('las pague quien las pague'), 'la nota de la IA')
  const sinMedir = dibujar(createElement(CustomerUsageView, { ...USO_EJEMPLO, medido: false, filas: [], ia: [] }))
  assert.ok(sinMedir.includes('Sin esa medición no se sabe qué tabs abre.') && !sinMedir.includes('en esta base'))
})

test('18 · «Editar negocio»: el aviso del mail del cambio de plan se mira en la respuesta de `capa`, aunque después corra `plan_a_mano`', async () => {
  const capa = { action: 'capa' as const, id: 42, capa: 'completo' as const }
  const mano = { action: 'plan_a_mano' as const, id: 42, dias: 30 }
  const respuestas = new Map<string, ResultadoAccion>([
    ['capa', { ok: true, datos: { aviso: { enviado: false, a: 'ana@ejemplo.com', error: 'el correo de MaKo todavía no está configurado' } } }],
    ['plan_a_mano', { ok: true, datos: {} }],
  ])
  const r = await enOrden([capa, mano], async (a) => respuestas.get(a.action)!)
  assert.equal(r.ok, true)
  assert.deepEqual(r.pasos.map((p) => p.accion.action), ['capa', 'plan_a_mano'], 'cada paso con su respuesta')
  const aviso = avisoDelCambioDePlan(r.pasos)
  assert.ok(aviso, 'el plan_a_mano de después ya no tapa el aviso')
  assert.equal(aviso!.titulo, 'El plan cambió, pero el mail no salió: el correo de MaKo todavía no está configurado')
  assert.equal(aviso!.texto, 'Avísale tú a ana@ejemplo.com.')
  // Salió, o no hay nadie adentro: no hay nada que avisar (el modal se cierra).
  const con = (aviso: unknown) => avisoDelCambioDePlan([{ accion: capa, resultado: { ok: true, datos: { aviso } } }])
  assert.equal(con({ enviado: true, a: 'ana@ejemplo.com' }), null)
  assert.equal(con({ enviado: false, a: '' }), null, '«no hay nadie adentro» no es una falla')
  assert.equal(con(null), null, 'el plan no cambió')
  // Reventó antes de saber a quién: SÍ es una falla (la ruta lo devuelve sin `a`).
  assert.equal(con({ enviado: false, error: 'Resend no contestó' })?.titulo, 'El plan cambió, pero el mail no salió: Resend no contestó')
  // Y si algo de después falla, el corte sigue y lo que corrió conserva su respuesta.
  const corta = await enOrden([capa, mano], async (a) => (a.action === 'capa' ? respuestas.get('capa')! : { ok: false, error: 'no' }))
  assert.equal(corta.ok, false)
  assert.ok(avisoDelCambioDePlan(corta.pasos), 'el plan ya cambió: el aviso del mail sale igual')
})

test('20 · eliminado el negocio: sin el menú, y «Ir a Customers» vuelve a dibujar la lista y ⌘K (push + refresh)', async () => {
  const llamadas: string[] = []
  irALaLista({ push: (h) => llamadas.push(`push ${h}`), refresh: () => llamadas.push('refresh') })
  assert.deepEqual(llamadas, ['push /admin/customers', 'refresh'])
  const { CustomerHeader, NegocioEliminado } = await import('../app/admin/_polar/web/Customer/CustomerPage/CustomerHeader')
  const borrado = dibujar(createElement(NegocioEliminado, { resumen: 'Se eliminó Estudio Norte: 3 filas en 1 tabla, 1 persona.', onIr: nada }))
  assert.ok(borrado.includes('Ir a Customers') && borrado.includes('Negocio eliminado'))
  assert.ok(!borrado.includes('Acciones del negocio'), 'sin el menú de acciones')
  // La cabecera de un negocio vivo sí lo tiene.
  assert.ok(dibujar(createElement(CustomerHeader, { negocio: CABECERA_EJEMPLO })).includes('Acciones del negocio'))
})

test('22 · «Suspender» y «Eliminar» piden confirmación y dicen que se apagan sus tokens; «Reactivar» va directo', () => {
  const c = confirmacionDeEstado({ estado: 'activo' })
  assert.equal(c?.texto, 'Deja de entrar y se apagan los tokens de API que creó. Reactivarla no los devuelve.')
  assert.ok(confirmacionDeEstado({ estado: 'invitado' }), 'un invitado también se suspende con confirmación')
  assert.equal(confirmacionDeEstado({ estado: 'suspendido' }), null)
  assert.match(TEXTO_ELIMINAR_PERSONA, /tokens de API/)
  assert.match(TEXTO_ELIMINAR_PERSONA, /No se puede deshacer/)
})

test('25 · Settings › Members: las personas de la plataforma, nunca las de un negocio (y entre las dos listas, todas)', () => {
  const usuarios: UsuarioParaMiembro[] = [
    ...USUARIOS_EJEMPLO,
    { id: 106, email: 'eva@ejemplo.com', nombre: 'Eva', rol: 'usuario', estado: 'activo', ultimo_login: null, created_at: '2026-02-01T12:00:00Z', workspace_id: 9, rol_ws: 'closer', invitacion_enviada_at: null },
    { id: 107, email: 'suelto@ejemplo.com', nombre: 'Suelto', rol: 'usuario', estado: 'invitado', ultimo_login: null, created_at: '2026-03-01T12:00:00Z', workspace_id: null, rol_ws: null, invitacion_enviada_at: null },
    { id: 108, email: 'huerfano@ejemplo.com', nombre: 'Huérfano', rol: 'usuario', estado: 'activo', ultimo_login: null, created_at: '2026-04-01T12:00:00Z', workspace_id: 77, rol_ws: 'admin', invitacion_enviada_at: null },
  ]
  const clientes = new Set([WS_EJEMPLO, 43])
  const plataforma = miembrosDePlataforma(usuarios, 9, clientes)
  assert.deepEqual(plataforma.map((m) => [m.id, m.tipo]), [[105, 'admin'], [106, 'equipo'], [107, 'sin-negocio'], [108, 'sin-negocio']])
  // Nadie dos veces y nadie sin lugar: las de los negocios (sus fichas) más las de la plataforma son todas.
  const deNegocios = [...clientes].flatMap((ws) => miembrosDe(usuarios, ws).map((m) => m.id))
  assert.deepEqual([...deNegocios, ...plataforma.map((m) => m.id)].sort(), usuarios.map((u) => u.id).sort())
  assert.equal(tipoDePersona({ rol: 'admin', workspace_id: WS_EJEMPLO }, 9, clientes), 'admin', 'un admin de MaKo con un negocio puesto no es de ese negocio')
  assert.equal(tipoDePersona({ rol: 'usuario', workspace_id: WS_EJEMPLO }, 9, clientes), null)
})

test('25 · «Agregar persona» y mudarla de negocio mandan los mismos cuerpos que la grilla vieja', () => {
  assert.deepEqual(cuerpoDeAlta({ ws: 42 }, { nombre: ' Ana ', email: ' ana@ejemplo.com ', rol: null }), {
    action: 'crear', email: 'ana@ejemplo.com', nombre: 'Ana', rol: 'usuario', workspace_id: 42, rol_ws: 'admin',
  }, 'en un negocio: una persona de ese negocio, admin por defecto')
  assert.deepEqual(cuerpoDeAlta({ ws: 42 }, { nombre: '', email: 'bo@ejemplo.com', rol: 'setter' }), {
    action: 'crear', email: 'bo@ejemplo.com', nombre: '', rol: 'usuario', workspace_id: 42, rol_ws: 'setter',
  })
  assert.deepEqual(cuerpoDeAlta('plataforma', { nombre: 'Eva', email: 'eva@ejemplo.com' }), { action: 'crear', email: 'eva@ejemplo.com', nombre: 'Eva', rol: 'admin' },
    'en la plataforma: un admin de MaKo, sin negocio')
  assert.equal(cuerpoDeAlta({ ws: 42 }, { nombre: 'X', email: 'no-es-un-email' }), null)
  assert.match(consecuenciaDeAlta('plataforma'), /ve todos los negocios/)
  // Editar persona: el nombre, la mudanza (el «Asignar a cliente…» de la grilla) y el rol en el negocio nuevo, en ese orden.
  const m = { ...MIEMBROS_EJEMPLO[1] }
  assert.deepEqual(cambiosDelMiembro(m, { nombre: 'Bruno D.', rol: 'admin', ws: 43 }), [
    { action: 'nombre', id: 102, nombre: 'Bruno D.' }, { action: 'workspace', id: 102, workspace_id: 43 }, { action: 'rolws', id: 102, rol_ws: 'admin' },
  ])
  assert.deepEqual(cambiosDelMiembro(m, { nombre: m.nombre, rol: m.rol, ws: WS_EJEMPLO }), [], 'el mismo negocio no es una mudanza')
})

test('25 · Members dibuja «Agregar persona» (también sin nadie) y, en Settings, la columna «Tipo» en vez de «Rol» y «Alta»', async () => {
  const { MembersSection } = await import('../app/admin/_polar/web/Customer/CustomerPage/MembersSection')
  const vacio = { titulo: 'Sin personas', texto: 'Nadie puede entrar.' }
  const ficha = dibujar(createElement(MembersSection, { miembros: MIEMBROS_EJEMPLO, destino: { ws: WS_EJEMPLO }, vacio }))
  assert.ok(ficha.includes('Agregar persona') && ficha.includes('>Rol<') && ficha.includes('>Alta<'))
  const sinNadie = dibujar(createElement(MembersSection, { miembros: [], destino: { ws: WS_EJEMPLO }, vacio }))
  assert.ok(sinNadie.includes('Sin personas') && sinNadie.includes('Agregar persona'), 'a un negocio sin nadie se le puede sumar alguien')
  const deMaKo = miembrosDePlataforma(USUARIOS_EJEMPLO, 9, new Set([WS_EJEMPLO, 43]))
  const settings = dibujar(createElement(MembersSection, { miembros: deMaKo, destino: 'plataforma', vacio, sinTitulo: true }))
  assert.ok(settings.includes('>Tipo<') && settings.includes('Admin de MaKo'))
  assert.ok(!settings.includes('>Rol<') && !settings.includes('>Alta<') && !settings.includes('>Members<'), 'sin las columnas de un negocio ni el título repetido')
})
