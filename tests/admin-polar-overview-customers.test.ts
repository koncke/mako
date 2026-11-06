// =============================================================================
// Admin (la copia de Polar) › Overview y Customers: los arreglos de la revisión del Cerebro del 6/11/2026, EJECUTADOS
// =============================================================================
// docs/admin/revision-cerebro-6-11.md, los puntos de las tarjetas de la portada, lo que espera arriba y las listas de Customers.
// Lo que fija este archivo (los links viejos del 34 y la tarjeta At Risk del 7, además, en tests/admin-polar-resumen.test.ts):
//   7.  At Risk es UNA cuenta: la tarjeta dibuja la lista de la página, con los atrasados, y sin los clientes de una agencia
//       (sacados en los dos bucles de `clientesEnRiesgo`: un atrasado entra por los ingresos);
//   8.  «Ver todo» de Por cobrar va a las suscripciones atrasadas cuando hay algo atrasado;
//   12 y 39. las tarjetas en inglés: Revenue, Activity, AI margin (con «sólo resta la IA por API»); «Por cobrar» queda;
//   24. una fila de quien pagó sin cuenta de MaKo abre su ficha del CRM (`rutaDeQuienPaga`), y una sin nada que abrir no es
//       clicable (`isRowClickable` en la tabla de Orbit);
//   28 y 38. lo que espera es UNA lista chica, una fila por espera, con el contracargo primero; lo que no se pudo leer va en
//       el aviso de lectura («Puede faltar algo», 42); en Mercado Pago cuenta sólo el texto «está en revisión»;
//   29. Top Customers arranca desde siempre, como la tarjeta que lleva ahí;
//   35. la lista de negocios dice el plan y si está pausado (la misma frase de ⌘K); el filtro es «Pausados»;
//   36. las tres columnas de Customers › Overview dependen del lugar que queda (`auto-fit`, 210 px), el subtítulo de cada
//       lista va debajo del título y el vacío con `fill` usa el relleno `xl`;
//   41. el modal de «Quieren entrar» no repite el aviso.
//
// Correr: node --import tsx --test tests/admin-polar-overview-customers.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (6/11/2026), base 10/0. El arnés guarda el original en memoria, rompe UN archivo, corre este test y lo
// reescribe desde la memoria. Cada rotura, sola, deja 9/1 (el test que se nombra):
//   · `clientesEnRiesgo` sin el corte de agencia en el bucle de los ingresos                         → 9/1 (7)
//   · `clientesEnRiesgo` sin el corte de agencia en el bucle de las filas                            → 9/1 (7)
//   · CustomerRiskWidget con el estado en `muted` en vez de su color                                  → 9/1 (7)
//   · `hrefDePorCobrar` siempre a /admin/sales/subscriptions                                         → 9/1 (8)
//   · GrossMarginWidget otra vez «Margen bruto»                                                       → 9/1 (12 y 39)
//   · `rutaDeQuienPaga` sin la rama del CRM (sólo `ws`)                                              → 9/1 (24)
//   · DataTable sin `isRowClickable` (todas las filas con la mano)                                    → 9/1 (24)
//   · `disputasPorResponder` contando todo `en_revision`                                              → 9/1 (28)
//   · EsperaBanners con la fila de las bajas antes que la del contracargo                             → 9/1 (38)
//   · `RANGO_INICIAL_TOP` en '30d'                                                                    → 9/1 (29)
//   · el filtro otra vez «Inactivos»                                                                  → 9/1 (35)
//   · la lista sin «Pausado» en la segunda línea (`pausado: false`)                                   → 9/1 (35)
//   · `COLUMNAS_OVERVIEW` con 240 px de mínimo                                                        → 9/1 (36)
//   · el modal de «Quieren entrar» con su frase de vuelta                                             → 9/1 (41)
// Y un cambio sin efecto (renombrar la `filas` local de EsperaBanners) la deja en 10/0.
// =============================================================================

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AppRouterContext, type AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { PathnameContext, SearchParamsContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime'
import {
  ROTULO_FILTRO,
  clientesEnRiesgo,
  datosDeTop,
  listaDeClientes,
  rutaDeQuienPaga,
  topClientes,
  vistaDeAtRisk,
} from '../app/admin/_polar/datos/clientes'
import {
  disputasPorResponder,
  faltasDeEspera,
  filasDeEspera,
  hrefDePorCobrar,
  porCobrarResumen,
  riesgoDeOverview,
  type Esperan,
} from '../app/admin/_polar/datos/resumen'
import { armarIndice, detalleDeNegocio } from '../app/admin/_polar/datos/busqueda-tipos'
import { resumenEjemplo } from '../app/admin/_polar/datos/ejemplo/resumen'
import { textoContracargo } from '../lib/cobros-reglas'
import type { FilaCliente } from '../lib/clientes-plataforma'
import { CustomerRiskWidget } from '../app/admin/_polar/web/Widgets/CustomerRiskWidget'
import { AccountWidget } from '../app/admin/_polar/web/Widgets/AccountWidget'
import RevenueWidget from '../app/admin/_polar/web/Widgets/RevenueWidget'
import { ActivityWidget } from '../app/admin/_polar/web/Widgets/ActivityWidget'
import { GrossMarginWidget } from '../app/admin/_polar/web/Widgets/GrossMarginWidget'
import { TopCustomersWidget } from '../app/admin/_polar/web/Widgets/TopCustomersWidget'
import { EsperaBanners } from '../app/admin/_polar/web/DashboardOverview/EsperaBanners'
import { DataTable } from '../app/admin/_polar/orbit/components/datatable/DataTable'
import { ToplistHeader } from '../app/admin/_polar/web/Customer/Toplist'
import { EmptyState } from '../app/admin/_polar/web/Shared/EmptyState'
import { COLUMNAS_OVERVIEW, CustomersOverview } from '../app/admin/_polar/web/Customer/CustomersOverview'
import { CustomerListSidebar } from '../app/admin/_polar/web/Customer/CustomerListSidebar'
import { RANGO_INICIAL_TOP, TopCustomersPage } from '../app/admin/(polar)/customers/top/TopCustomersPage'
import { AtRiskPage } from '../app/admin/(polar)/customers/at-risk/AtRiskPage'
import { OVERVIEW_EJEMPLO, TOP_EJEMPLO } from '../app/admin/_polar/datos/ejemplo/clientes'
import { CHART_RANGES } from '../app/admin/_polar/web/utils/metrics'

const nada = () => {}
const router: AppRouterInstance = { back: nada, forward: nada, refresh: nada, push: nada, replace: nada, prefetch: nada }
/** Lo dibuja como el server, con el router y la URL de Next (los piden los links y la tabla). */
const html = (el: ReactElement, pathname = '/admin') =>
  renderToStaticMarkup(
    createElement(AppRouterContext.Provider, { value: router },
      createElement(PathnameContext.Provider, { value: pathname },
        createElement(SearchParamsContext.Provider, { value: new URLSearchParams() as never }, el))),
  )

type Fila = Pick<FilaCliente, 'ws' | 'nombre' | 'creado' | 'capa' | 'estado' | 'motivoRiesgo' | 'sinEntrar' | 'mrrUsd' | 'planAManoTxt' | 'segmentos'>
const fila = (ws: number, nombre: string, extra: Partial<Fila> = {}): Fila => ({
  ws, nombre, creado: '2026-10-01T12:00:00Z', capa: 'completo', estado: 'activo', motivoRiesgo: null, sinEntrar: 1, mrrUsd: 0,
  planAManoTxt: null, segmentos: ['cliente'], ...extra,
})
const ingreso = (clave: string, ws: number | null, nombre: string, estado: 'atrasado' | 'al-dia' | 'cortado', extra: { mrr?: number; diasAtraso?: number | null; leadId?: number | null } = {}) => ({
  clave, ws, nombre, estado, mrr: extra.mrr ?? 470, diasAtraso: extra.diasAtraso ?? null, leadId: extra.leadId ?? null,
})

// ── 7. At Risk ───────────────────────────────────────────────────────────────────────────────────────────────────

test('7 · At Risk es una cuenta: con los atrasados, sin los clientes de una agencia, y la tarjeta dice lo mismo que la página', () => {
  const filas = [
    fila(21, 'Estudio Norte'),
    fila(22, 'Panadería', { motivoRiesgo: 'cobro', mrrUsd: 470 }),
    // Un cliente de una agencia: pausado y atrasado. No está en la lista de Customers, así que tampoco en riesgo.
    fila(30, 'Consultorio Arce', { estado: 'pausado', motivoRiesgo: 'pausado', segmentos: ['de-agencia'] }),
    fila(31, 'Óptica Clara', { segmentos: ['de-agencia'] }),
  ]
  const ingresos = [
    ingreso('ws:21', 21, 'Estudio Norte', 'atrasado', { diasAtraso: 4 }),
    ingreso('ws:31', 31, 'Óptica Clara', 'atrasado', { diasAtraso: 9 }),
  ]
  const enRiesgo = clientesEnRiesgo(filas, ingresos)
  assert.deepEqual(enRiesgo.map((c) => c.clave), ['ws:21', 'ws:22'], 'el atrasado entra; los dos de agencia no (ni por las filas ni por los ingresos)')

  const vista = vistaDeAtRisk({ ok: true, datos: { filas }, avisos: [] }, { ok: true, datos: { entradas: [], clientes: ingresos.map((i) => ({ ...i, total: 0, sinDolares: 0, pagos: 0, primerPago: null, ultimoPago: null, proximo: null })) }, avisos: [] })
  const tarjeta = riesgoDeOverview(vista, 9)
  assert.ok(tarjeta.ok)
  assert.equal(tarjeta.datos.total, vista.atRisk?.length, 'el número grande es el largo de la lista de la página')

  const dibujada = html(createElement(CustomerRiskWidget, { riesgo: tarjeta }))
  assert.match(dibujada, />2</, 'el titular: dos en riesgo')
  assert.match(dibujada, /Atrasado 4 días/, 'el atrasado que Por cobrar pinta en rojo, también acá')
  assert.match(dibujada, /href="\/admin\/customers\/at-risk"/)
  // El estado en su color, como en la página: rojo lo grave.
  assert.match(dibujada, /class="[^"]*\bpl-c-danger\b[^"]*">Atrasado 4 días</, 'un atrasado va en rojo')

  // Sin nadie, el vacío de la tarjeta es el de la página; sin la lectura, «no pude leer».
  const vacia = html(createElement(CustomerRiskWidget, { riesgo: riesgoDeOverview({ atRisk: [], error: null }, 9) }))
  const pagina = html(createElement(AtRiskPage, { atRisk: [], error: null, avisos: [], paraMirar: null, plataforma: 9 }), '/admin/customers/at-risk')
  for (const frase of ['Nada en riesgo', 'Ningún pago atrasado, cobro fallido ni negocio sin uso.']) {
    assert.ok(vacia.includes(frase) && pagina.includes(frase), `«${frase}» en la tarjeta y en la página`)
  }
  const caida = html(createElement(CustomerRiskWidget, { riesgo: riesgoDeOverview({ atRisk: null, error: 'base caída' }, 9) }))
  assert.match(caida, /No pude leer los negocios en riesgo/)
  assert.doesNotMatch(caida, /Nada en riesgo/)
})

// ── 8. Por cobrar › Ver todo ─────────────────────────────────────────────────────────────────────────────────────

test('8 · «Ver todo» de Por cobrar lleva a las suscripciones atrasadas cuando hay algo atrasado', () => {
  const conAtraso = porCobrarResumen([{ cliente: 'ws:25', fecha: '2026-11-02', usd: 470, atrasado: true }], [], '2026-11-06')
  const alDia = porCobrarResumen([{ cliente: 'ws:25', fecha: '2026-11-20', usd: 470, atrasado: false }], [], '2026-11-06')
  assert.equal(hrefDePorCobrar(conAtraso), '/admin/sales/subscriptions?status=past_due')
  assert.equal(hrefDePorCobrar(alDia), '/admin/sales/subscriptions')
  assert.equal(hrefDePorCobrar(null), '/admin/sales/subscriptions', 'sin la lectura, la lista entera')
  const tarjeta = html(createElement(AccountWidget, { porCobrar: { ok: true, datos: conAtraso } }))
  assert.match(tarjeta, /href="\/admin\/sales\/subscriptions\?status=past_due"/, 'la tarjeta usa ese link')
})

// ── 12 y 39. Los nombres de las tarjetas ───────────────────────────────────────────────────────────────────────

test('12 y 39 · las tarjetas en inglés: Revenue, Activity y AI margin, que dice qué resta', () => {
  const titulos = [
    html(createElement(RevenueWidget, { ingresos: resumenEjemplo.ingresos })),
    html(createElement(ActivityWidget, { actividad: resumenEjemplo.actividad })),
    html(createElement(GrossMarginWidget, { margen: resumenEjemplo.margen })),
  ].join('\n')
  for (const t of ['Revenue', 'Activity', 'AI margin', 'Últimos 30 días · sólo resta la IA por API']) assert.ok(titulos.includes(t), `falta «${t}»`)
  for (const t of ['Ingresos', 'Actividad', 'Margen bruto']) assert.ok(!titulos.includes(`>${t}<`), `queda «${t}» como título`)
  assert.match(html(createElement(AccountWidget, { porCobrar: resumenEjemplo.porCobrar })), />Por cobrar</, '«Por cobrar» queda')
})

// ── 24. Las filas sin cuenta de MaKo ───────────────────────────────────────────────────────────────────────────

test('24 · quien pagó sin cuenta de MaKo abre su ficha del CRM, y una fila sin nada que abrir no es clicable', () => {
  assert.equal(rutaDeQuienPaga({ ws: 21, leadId: 5 }, 9), '/admin/customers/21', 'con cuenta, su ficha en Customers')
  assert.equal(rutaDeQuienPaga({ ws: null, leadId: 5 }, 9), '/crm/5?ws=9', 'sin cuenta, su ficha del CRM de la plataforma')
  assert.equal(rutaDeQuienPaga({ ws: null, leadId: 5 }, null), null, 'sin saber cuál es la plataforma, nada')
  assert.equal(rutaDeQuienPaga({ ws: null, leadId: null }, 9), null)

  // El `leadId` viaja: Top Customers (la página), Por cobrar y At Risk.
  const datos = datosDeTop({
    clientes: [{ clave: 'lead:310', ws: null, leadId: 310, nombre: 'Ana Gómez', total: 0, sinDolares: 0, pagos: 0, primerPago: null, ultimoPago: null, mrr: 0, estado: 'al-dia', proximo: null, diasAtraso: null }],
    entradas: [
      { fecha: '2026-11-01', usd: 100, medio: 'stripe', recurrente: false, nombre: 'Ana Gómez', cliente: 'lead:310' },
      { fecha: '2026-11-02', usd: 50, medio: 'stripe', recurrente: false, nombre: 'Luis Paz', cliente: 'lead:77' },
    ],
  })
  assert.deepEqual(topClientes(datos, null, null).map((c) => [c.clave, c.leadId]), [['lead:310', 310], ['lead:77', 77]], 'también el que no está entre los clientes (por su clave)')
  assert.equal(porCobrarResumen([{ cliente: 'lead:310', fecha: '2026-11-25', usd: 500, atrasado: false }], [], '2026-11-06', 9).filas[0].href, '/crm/310?ws=9')
  assert.equal(clientesEnRiesgo([], [ingreso('lead:8', null, 'Ana Gómez', 'atrasado', { leadId: 8 })])[0].leadId, 8)

  // La tarjeta Top Customers de la portada: el lead del ejemplo (lead:310, plataforma 9) lleva a su ficha del CRM.
  assert.match(html(createElement(TopCustomersWidget, { top: resumenEjemplo.top })), /href="\/crm\/310\?ws=9"/)

  // La tabla de Orbit: la mano y el clic sólo donde hay algo que abrir.
  type F = { id: string; ruta: string | null }
  const tabla = html(createElement(DataTable<F>, {
    columns: [{ id: 'id', header: 'ID', cell: ({ row }) => row.original.id }],
    data: [{ id: 'a', ruta: '/x' }, { id: 'b', ruta: null }],
    isLoading: false,
    getRowId: (f) => f.id,
    onRowClick: nada,
    isRowClickable: (row) => row.original.ruta != null,
  }))
  assert.equal((tabla.match(/cursor-pointer/g) ?? []).length, 1, 'una sola fila con la mano')
  const sinRegla = html(createElement(DataTable<F>, {
    columns: [{ id: 'id', header: 'ID', cell: ({ row }) => row.original.id }],
    data: [{ id: 'a', ruta: '/x' }, { id: 'b', ruta: null }],
    isLoading: false,
    onRowClick: nada,
  }))
  assert.equal((sinRegla.match(/cursor-pointer/g) ?? []).length, 2, 'sin la regla, como en Polar: todas las que tienen onRowClick')
})

// ── 28 y 38. Lo que espera ───────────────────────────────────────────────────────────────────────────────────────

const esperanDe = (cambios: Partial<Esperan> = {}): Esperan => ({ ...resumenEjemplo.esperan, ...cambios })

test('28 · un contracargo cuenta mientras pide algo; de Mercado Pago, sólo el que está en revisión', () => {
  const mp = (estado: string | null) => textoContracargo({ pasarela: 'mercadopago', fase: 'mp', estado })
  const d = (estado: Parameters<typeof disputasPorResponder>[0][number]['estado'], texto = '') => ({ estado, texto })
  assert.equal(disputasPorResponder([
    d('abierta', 'El cliente disputó este cargo con su banco: Stripe abrió una disputa.'),
    d('plata_afuera', 'Stripe descontó la plata por la disputa: el pago queda como no cobrado mientras se resuelve.'),
    d('en_revision', mp('in_process')),
  ]), 3)
  assert.equal(disputasPorResponder([
    d('en_revision', mp('settled')),
    d('en_revision', mp(null)),
    d('ganada'), d('perdida'), d('cerrada'), d('plata_volvio'),
  ]), 0, 'un Mercado Pago ya resuelto y lo cerrado no avisan: el aviso tiene que poder irse')
})

test('38 · lo que espera es UNA lista, una fila por espera y el contracargo primero; lo no leído va en el aviso de lectura', () => {
  const todo = esperanDe({ disputas: { ok: true, datos: { porResponder: 1 } } })
  const filas = filasDeEspera(todo)
  assert.deepEqual(filas.map((f) => f.clave), ['disputas', 'bajas', 'agencias', 'ingreso'])
  assert.equal(filas[0].titulo, 'Un cliente disputó un cargo')
  assert.equal(filas[0].peligro, true)

  const dibujada = html(createElement(EsperaBanners, { esperan: todo, avisos: [] }))
  const pos = ['Un cliente disputó un cargo', 'Una persona pidió eliminar su cuenta', 'esperan tu firma', 'personas quieren entrar a MaKo'].map((t) => dibujada.indexOf(t))
  assert.ok(pos.every((p) => p > 0), 'las cuatro filas')
  assert.deepEqual([...pos].sort((a, b) => a - b), pos, 'en ese orden')
  assert.equal((dibujada.match(/<button/g) ?? []).length, 4, 'una fila, un botón: nada más')
  assert.doesNotMatch(dibujada, /Pidieron entrar y todavía|Le dijimos una fecha|Una agencia quiere entrar/, 'sin la frase de cada aviso')
  assert.match(dibujada, /rounded-2xl/, 'la `List size="small"` de Orbit')

  // Una baja vencida: el dato pasa al título y va en rojo.
  const vencida = esperanDe({
    disputas: { ok: true, datos: { porResponder: 0 } },
    bajas: { ok: true, datos: { bajas: [{ id: 1, titulo: 'p@ejemplo.com', plazo: 'Se pasó del plazo', vencido: true, notas: null, negocioWs: null, puedeEliminar: true, puedeTerminar: false }] } },
  })
  const fb = filasDeEspera(vencida).find((f) => f.clave === 'bajas')
  assert.equal(fb?.titulo, 'Una persona pidió eliminar su cuenta · 1 vencida')
  assert.equal(fb?.peligro, true)

  // Lo que no se pudo leer: en el aviso «Puede faltar algo», nunca como «no hay nadie».
  const caida = esperanDe({ disputas: { ok: false, error: 'timeout' }, ingreso: { ok: false, error: 'caída' } })
  assert.deepEqual(faltasDeEspera(caida), ['las disputas: timeout', 'quién quiere entrar: caída'])
  const conAviso = html(createElement(EsperaBanners, { esperan: caida, avisos: ['los cobros de la pasarela: x', 'los cobros de la pasarela: x.'] }))
  assert.match(conAviso, /Puede faltar algo/)
  assert.match(conAviso, /No pude leer las disputas: timeout; quién quiere entrar: caída; los cobros de la pasarela: x\./, 'sin repetir')

  // Sin nada esperando ni nada sin leer, la caja no ocupa lugar.
  const vacio: Esperan = esperanDe({
    disputas: { ok: true, datos: { porResponder: 0 } },
    ingreso: { ok: true, datos: { pedidos: [], hayMas: false } },
    agencias: { carteras: [], altas: [] },
    bajas: { ok: true, datos: { bajas: [] } },
  })
  assert.deepEqual(filasDeEspera(vacio), [])
  assert.match(html(createElement(EsperaBanners, { esperan: vacio, avisos: [] })), /^<div class="[^"]*\bhidden\b/)
})

// ── 29. Top Customers ────────────────────────────────────────────────────────────────────────────────────────────

test('29 · Top Customers arranca desde siempre, como la tarjeta «del total cobrado» que lleva ahí', () => {
  assert.equal(RANGO_INICIAL_TOP, 'all_time')
  // El rango elegido del selector de Polar es el botón blanco (`bg-white`): el de «Desde siempre» (su rótulo, el que tenga).
  const pagina = html(createElement(TopCustomersPage, { ...TOP_EJEMPLO, plataforma: 9 }), '/admin/customers/top')
  const elegido = /<button[^>]*\bbg-white\b[^>]*>([^<]+)<\/button>/.exec(pagina)?.[1]
  assert.equal(elegido, CHART_RANGES.all_time, 'la página abre en el rango de la tarjeta')
})

// ── 35. La lista de negocios ─────────────────────────────────────────────────────────────────────────────────────

test('35 · cada negocio de la lista dice su plan y si está pausado, con la misma frase de ⌘K; el filtro es «Pausados»', () => {
  assert.equal(ROTULO_FILTRO.inactive, 'Pausados')
  assert.deepEqual(Object.values(ROTULO_FILTRO), ['Todos', 'Activos', 'Pausados', 'De agencias'])
  const lista = listaDeClientes([
    { ...fila(21, 'Estudio Norte'), agencia: null },
    { ...fila(22, 'Panadería', { estado: 'pausado' }), agencia: null },
    { ...fila(30, 'Consultorio Arce', { estado: 'pausado', segmentos: ['de-agencia'] }), agencia: 'Agencia Faro' },
  ])
  const linea = lista.map((c) => detalleDeNegocio({ plan: c.plan, pausado: !c.activo, deAgencia: c.deAgencia, agencia: c.agencia }))
  assert.ok(linea[0].length > 0 && !linea[0].includes('Pausado'), `«${linea[0]}»: el plan, sin «Pausado»`)
  assert.match(linea[1], / · Pausado$/)
  assert.match(linea[2], /^De Agencia Faro · .+ · Pausado$/, 'el de agencia: de quién es, su plan y si está pausado')

  // La misma frase que la búsqueda ⌘K.
  const indice = armarIndice({
    workspaces: [{ id: 22, nombre: 'Panadería', capa: 'completo', estado: 'pausado' }, { id: 27, nombre: 'Agencia Faro', capa: 'agencia', estado: 'activo' }, { id: 30, nombre: 'Consultorio Arce', capa: 'completo', estado: 'pausado' }],
    usuarios: [], plataforma: null, plan: () => lista[1].plan, deAgencia: new Map([[30, 27]]),
  })
  assert.equal(indice.negocios.find((n) => n.ws === 22)?.detalle, linea[1])
  assert.equal(indice.negocios.find((n) => n.ws === 30)?.detalle, linea[2])

  // Y la lista la dibuja, debajo del nombre (donde Polar ponía el email).
  const opciones = { planes: [], planPorDefecto: 'completo' }
  const dibujada = html(createElement(CustomerListSidebar, { customers: lista, opciones }), '/admin/customers')
  const segunda = (nombre: string) => new RegExp(`>${nombre}</div><div class="[^"]*text-xs[^"]*">([^<]+)</div>`).exec(dibujada)?.[1]
  assert.equal(segunda('Estudio Norte'), linea[0])
  assert.equal(segunda('Panadería'), linea[1], 'el pausado se distingue del activo')
})

// ── 36. Las columnas de Customers › Overview ─────────────────────────────────────────────────────────────────────

test('36 · las columnas de Customers › Overview: tantas como entren (210 px), el subtítulo debajo y el vacío con menos relleno', () => {
  assert.equal(COLUMNAS_OVERVIEW, 'repeat(auto-fit, minmax(210px, 1fr))')
  // Cuántas columnas pone `auto-fit` en un contenedor, con la separación `3xl` (48 px) de la grilla.
  const columnas = (ancho: number, minimo: number, gap = 48) => Math.max(1, Math.floor((ancho + gap) / (minimo + gap)))
  const minimo = Number(/minmax\((\d+)px/.exec(COLUMNAS_OVERVIEW)?.[1])
  // A 1536 con la barra de MaKo plegada cada columna medía 248 (la revisión): el contenedor, 3 × 248 + 2 × 48 = 840. A 1440,
  // 96 menos: 744.
  assert.equal(columnas(744, minimo), 3, 'a 1440 con la barra plegada siguen siendo tres')
  assert.equal(columnas(744, 240), 2, 'con 240 se caían a dos (por eso 210)')
  assert.equal(columnas(3 * 160 + 96, minimo), 2, 'con la barra fija, dos: ninguna queda en 107 px')

  assert.match(html(createElement(CustomersOverview, OVERVIEW_EJEMPLO), '/admin/customers'), /grid-template-columns:repeat\(auto-fit, minmax\(210px, 1fr\)\)/, 'la grilla de las tres listas usa esa regla')
  const cabecera = html(createElement(ToplistHeader, { title: 'At Risk', caption: 'Atrasados, pausados y sin uso' }))
  assert.match(cabecera, /flex-direction:column|flex-col/, 'el subtítulo debajo del título')
  const conFill = html(createElement(EmptyState, { icon: null, title: 'Nada', description: 'Nada todavía.', fill: true }))
  const sinFill = html(createElement(EmptyState, { icon: null, title: 'Nada', description: 'Nada todavía.' }))
  assert.match(conFill, /padding:24px|p-xl|padding-xl/, 'con `fill`, el relleno `xl`')
  assert.match(sinFill, /padding:48px|p-3xl|padding-3xl/, 'sin `fill`, el de Polar')
})

// ── 41. El modal de «Quieren entrar» ─────────────────────────────────────────────────────────────────────────────

test('41 · el modal de «Quieren entrar» no repite lo que dice la fila', async () => {
  // jsdom viene en node_modules (lo trae otra dependencia) sin sus tipos: se carga con su forma mínima (como
  // tests/bloques-venta-landing.test.ts), para que el tsc entero no lo pida.
  const { JSDOM } = createRequire(import.meta.url)('jsdom') as {
    JSDOM: new (html: string, o: { url: string; pretendToBeVisual: boolean }) => { window: Window & typeof globalThis }
  }
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://hola-mako.com/admin', pretendToBeVisual: true })
  const g = globalThis as unknown as Record<string, unknown>
  const antes = { window: g.window, document: g.document, navigator: g.navigator, IS_REACT_ACT_ENVIRONMENT: g.IS_REACT_ACT_ENVIRONMENT }
  Object.assign(g, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true })
  Object.defineProperty(g, 'navigator', { value: dom.window.navigator, configurable: true })
  for (const k of ['HTMLElement', 'Element', 'Node', 'MutationObserver', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame']) {
    if (!(k in g)) g[k] = (dom.window as unknown as Record<string, unknown>)[k]
  }
  try {
    const { createRoot } = await import('react-dom/client')
    const { act } = await import('react')
    const raiz = dom.window.document.createElement('div')
    dom.window.document.body.appendChild(raiz)
    const root = createRoot(raiz)
    await act(async () => {
      root.render(
        createElement(AppRouterContext.Provider, { value: router },
          createElement(PathnameContext.Provider, { value: '/admin' },
            createElement(SearchParamsContext.Provider, { value: new URLSearchParams() as never },
              createElement(EsperaBanners, { esperan: esperanDe(), avisos: [] })))),
      )
    })
    const boton = [...dom.window.document.querySelectorAll('button')].find((b) => b.textContent === 'Ver los pedidos')
    assert.ok(boton, 'la fila de «Quieren entrar» tiene su botón')
    await act(async () => { boton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) })
    const texto = dom.window.document.body.textContent ?? ''
    assert.match(texto, /Quieren entrar/, 'el modal se abrió')
    assert.match(texto, /ana@ejemplo\.com/, 'con los pedidos')
    assert.doesNotMatch(texto, /Quien pidió entrar a MaKo y todavía no tiene cuenta/, 'sin la frase que repetía el aviso')
    await act(async () => root.unmount())
  } finally {
    Object.assign(g, { window: antes.window, document: antes.document, IS_REACT_ACT_ENVIRONMENT: antes.IS_REACT_ACT_ENVIRONMENT })
    Object.defineProperty(g, 'navigator', { value: antes.navigator, configurable: true })
    dom.window.close()
  }
})
