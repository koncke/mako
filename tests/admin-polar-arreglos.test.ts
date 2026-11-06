// =============================================================================
// Admin (la copia de Polar): los arreglos de integración del 6/11/2026, EJECUTADOS
// =============================================================================
// Martín rechazó dos versiones por tener lo mismo en varios lugares («tres lugares para configurar mi perfil», «usuarios en tres
// lugares», «ingreso mensual en Customers»). Lo que fija este archivo, después de juntar los seis portes:
//   1. UN formulario de alta: el «Create Customer» de Customers (`CreateCustomerModal`), que el aviso «Quieren entrar» abre con lo
//      del pedido puesto (`inicialDeAlta`) y que manda el cuerpo de `cuerpoDeAlta`; el aviso ya no tiene su propio formulario;
//   2. un cobro de «Vender un plan» vive en Products › Checkout Links y NO en Sales › Checkouts (la regla es UNA,
//      `esDeVenderUnPlan`), y lo demás sin pagar, en Checkouts; las dos listas no comparten ningún cobro;
//   3. Analytics › Costs sin «By Customer»: el gasto por negocio vive en Customers › Cost Drivers;
//   4. un cliente de una agencia no va en la lista de Customers por defecto ni cuenta en su crecimiento (28/09/2026): se ve con
//      el filtro «De agencias» (decisión del Cerebro, 6/11/2026), y la búsqueda ⌘K lo encuentra diciendo de qué agencia es;
//   5. los textos de las piezas de Polar en español (lo que no es un nombre de la barra);
//   6. el `Alert` de Orbit con «Reportar a Soporte» cuando es un error (`danger`) o lo pide (`soporte`), y no dos veces;
//   8. las lecturas que se repiten en un pedido van con `cache` de React.
//   (El 7, el próximo pago de cada cliente desde su historia, está en tests/admin-ingresos.test.ts, el 11.)
//
// Probado rompiéndolo el 6/11/2026 (base: 7/0; el arnés restaura de memoria). Cada rotura, sola, deja 6/1 (el test que se nombra):
//   · `inicialDeAlta` deja un plan por defecto que no está entre las opciones                      → 6/1 (1)
//   · `cuerpoDeAlta` manda `adminNombre: ''` cuando no se escribió                                 → 6/1 (1)
//   · EsperaBanners vuelve a mandar a /api/admin/workspaces por su cuenta                          → 6/1 (1)
//   · `checkoutsDe` sin el corte de `esDeVenderUnPlan` (el link sale en las dos listas)            → 6/1 (2)
//   · CostsPage vuelve a dibujar `porNegocio`                                                       → 6/1 (3)
//   · `filtrarClientes` sin el corte de los de agencia (`deAgencia`)                               → 6/1 (4)
//   · `vistaDeOverview` cuenta el crecimiento con los clientes de agencia                           → 6/1 (4)
//   · `armarIndice` sin el «De <agencia>»                                                           → 6/1 (4)
//   · la tabla de Orbit vuelve a decir «No Results»                                                 → 6/1 (5)
//   · el `Alert` no lleva el botón por default en `danger` (`soporte ?? false`)                     → 6/1 (6)
//   · un aviso vuelve a poner su `<ReportarASoporte>` adentro de la descripción de un `Alert`       → 6/1 (6)
//   · `vistaDeIngresos` sin `cache` (llamada directa al cálculo)                                     → 6/1 (8)
//   · AdminShell sin el `<LazyMotion>` (el 9 se sumó después: base 8/0 → 7/1)                         → 7/1 (9)
// =============================================================================

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { cuerpoDeAlta, inicialDeAlta, type OpcionesAlta } from '../app/admin/_polar/datos/alta'
import { esDeVenderUnPlan } from '../app/admin/_polar/datos/checkout-link'
import { checkoutsDe, type CobroVenta } from '../app/admin/_polar/datos/ventas'
import { linksDeVenta, type CobroDeVenta } from '../app/admin/_polar/datos/productos'
import { esClienteDeMaKo, filtrarClientes, listaDeClientes, vistaDeOverview, type Lectura } from '../app/admin/_polar/datos/clientes'
import { armarIndice, buscar } from '../app/admin/_polar/datos/busqueda-tipos'
import { CHART_RANGES, METRIC_GROUPS } from '../app/admin/_polar/web/utils/metrics'
import { METRICAS } from '../app/admin/_polar/datos/metricas'
import { textoDeAviso } from '../app/admin/_polar/orbit/components/alert-texto'
import { Alert } from '../app/admin/_polar/orbit/components/Alert'
import type { FilaCliente } from '../lib/clientes-plataforma'
import type { ClienteResumen, Entrada } from '../lib/admin-ingresos-reglas'

const RAIZ = fileURLToPath(new URL('..', import.meta.url))
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n')
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
/** Los .ts/.tsx de la Admin nueva (los que están en git y los nuevos). */
const archivosAdmin = (): string[] =>
  execSync("git ls-files -co --exclude-standard 'app/admin/_polar/**' 'app/admin/(polar)/**'", { cwd: RAIZ, encoding: 'utf8' })
    .split('\n').filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes('/datos/ejemplo/'))

// ── 1. Un formulario de alta ─────────────────────────────────────────────────────────────────────────────────────

test('1 · un solo formulario de alta: el de Customers, que el aviso «Quieren entrar» abre con lo del pedido', () => {
  const opciones: OpcionesAlta = {
    planes: [{ id: 'completo', nombre: 'MaKo Esencial', descripcion: 'x', aviso: null }, { id: 'agencia', nombre: 'MaKo Pro', descripcion: 'y', aviso: null }],
    planPorDefecto: 'agencia',
  }
  assert.deepEqual(inicialDeAlta(opciones), { nombre: '', email: '', adminNombre: '', plan: 'agencia' }, 'el «+» de Customers: vacío');
  assert.deepEqual(inicialDeAlta(opciones, { email: 'ana@ejemplo.com', nombre: 'Ana Gómez' }), { nombre: 'Ana Gómez', email: 'ana@ejemplo.com', adminNombre: 'Ana Gómez', plan: 'agencia' })
  assert.deepEqual(inicialDeAlta(opciones, { email: 'luis@ejemplo.com', nombre: null }), { nombre: 'luis', email: 'luis@ejemplo.com', adminNombre: '', plan: 'agencia' }, 'sin nombre, lo de antes de la @')
  assert.equal(inicialDeAlta({ ...opciones, planPorDefecto: 'superadmin' }).plan, 'completo', 'un plan que no se ofrece no viene elegido')

  assert.deepEqual(cuerpoDeAlta({ nombre: '  Estudio   Norte ', email: ' ana@ejemplo.com ', adminNombre: '  ', plan: 'completo' }),
    { action: 'crear', nombre: 'Estudio Norte', capa: 'completo', adminEmail: 'ana@ejemplo.com' }, 'sin nombre del admin, no se manda')
  assert.equal(cuerpoDeAlta({ nombre: 'X', email: 'a@b.co', adminNombre: ' Ana  Gómez ', plan: 'agencia' }).adminNombre, 'Ana Gómez')

  // Quién da de alta: sólo el formulario de Customers. El aviso lo abre (y ya no tiene su propio POST).
  const altas = archivosAdmin().filter((f) => /\/api\/admin\/workspaces/.test(sinComentarios(leer(f))) && /cuerpoDeAlta|'crear'/.test(sinComentarios(leer(f))))
  assert.deepEqual(altas, ['app/admin/_polar/web/Customer/CreateCustomerModal.tsx'], 'un solo lugar que da de alta un negocio')
  const banners = sinComentarios(leer('app/admin/_polar/web/DashboardOverview/EsperaBanners.tsx'))
  assert.doesNotMatch(banners, /\/api\/admin\/workspaces/, 'el aviso no da de alta por su cuenta')
  assert.match(banners, /<CreateCustomerModal[\s\S]{0,200}pedido=\{alta\}/, 'el aviso abre EL formulario con el pedido')
  assert.match(sinComentarios(leer('app/admin/(polar)/customers/layout.tsx')), /opciones=\{opcionesDeAlta\(\)\}/, 'el «+» de Customers recibe los planes')
})

// ── 2. Checkout Links y Checkouts ────────────────────────────────────────────────────────────────────────────────

test('2 · un cobro de «Vender un plan» vive en Checkout Links y no en Checkouts: las dos listas no comparten ninguno', () => {
  const crudo = (id: number, alta_capa: string | null, creado_por: string | null, estado: CobroVenta['estado'] = 'pendiente') => ({ id, alta_capa, creado_por, estado })
  const filas = [
    crudo(1, 'agencia', 'Super admin'), // Vender un plan
    crudo(2, 'completo', 'planes:esencial'), // compró desde /planes
    crudo(3, null, null), // una renovación / un lugar de agencia / una cuota
    crudo(4, 'completo', null), // Vender un plan sin autor anotado
    crudo(5, 'completo', 'planes:esencial', 'pagado'), // pagado: ya es un pedido
  ]
  const venta = (c: (typeof filas)[number]): CobroVenta => ({
    id: c.id, nombre: 'Ana Gómez', email: 'ana@ejemplo.com', plan: null, concepto: 'MaKo', monto: 47, moneda: 'USD', montoUsd: 47, tipo: 'suscripcion',
    modo: 'real', proveedor: 'stripe', estado: c.estado, motivo: null, altaEstado: null, altaWs: null, altaWsNombre: null, altaCapa: c.alta_capa,
    creadoPor: c.creado_por, createdAt: `2026-11-0${c.id}T10:00:00Z`, pagadoAt: null, link: null, suscripcionViva: false,
  })
  const deVenta = (c: (typeof filas)[number]): CobroDeVenta => ({
    id: c.id, nombre: 'Ana Gómez', email: 'ana@ejemplo.com', alta_capa: c.alta_capa, monto: 47, moneda: 'USD', monto_usd: 47, tipo: 'suscripcion',
    proveedor: 'stripe', estado: c.estado, created_at: '2026-11-04T15:00:00Z', pagado_at: null, creado_por: c.creado_por, alta_ws: null,
    alta_estado: null, url: null, alta_ws_nombre: null,
  })
  const checkouts = checkoutsDe(filas.map(venta)).map((c) => c.id).sort()
  const links = linksDeVenta(filas.map(deVenta), []).map((l) => l.id).sort()
  assert.deepEqual(checkouts, [2, 3], 'Checkouts: lo de /planes y lo que no armó «Vender un plan» (sin lo pagado)')
  assert.deepEqual(links, [1, 4], 'Checkout Links: los de «Vender un plan»')
  assert.deepEqual(checkouts.filter((id) => links.includes(id)), [], 'ningún cobro en las dos')
  assert.equal(esDeVenderUnPlan({ alta_capa: 'completo', creado_por: 'planes:x' }), false)

  // El detalle de un checkout que en realidad es un link lleva a SU lugar.
  const detalle = sinComentarios(leer('app/admin/(polar)/sales/checkouts/[id]/page.tsx'))
  assert.match(detalle, /linksDeVenta\.includes\(Number\(id\)\)\) redirect\(rutaDeCheckoutLink\(Number\(id\)\)\)/)
  assert.ok(detalle.indexOf('await exigirSuperAdmin()') < detalle.indexOf('vistaCheckouts()'), 'la puerta antes de leer')
})

// ── 3. Costs sin «By Customer» ───────────────────────────────────────────────────────────────────────────────────

test('3 · Analytics › Costs no dibuja el gasto por negocio: vive en Customers › Cost Drivers', () => {
  const costs = sinComentarios(leer('app/admin/(polar)/analytics/costs/CostsPage.tsx'))
  assert.doesNotMatch(costs, /porNegocio|By Customer/, 'sin la lista por negocio')
  assert.doesNotMatch(sinComentarios(leer('app/admin/_polar/datos/costos-server.ts')), /listarWorkspaces/, 'ni la lectura de los nombres que sólo servía para eso')
  assert.match(sinComentarios(leer('app/admin/(polar)/customers/cost-drivers/CostDriversPage.tsx')), /costos\?\.clientes/, 'Cost Drivers sigue siendo el lugar')
})

// ── 4. Los clientes de una agencia ───────────────────────────────────────────────────────────────────────────────

type Fila = Pick<FilaCliente, 'ws' | 'nombre' | 'creado' | 'capa' | 'estado' | 'motivoRiesgo' | 'sinEntrar' | 'mrrUsd' | 'planAManoTxt' | 'segmentos'>
const fila = (ws: number, nombre: string, segmentos: Fila['segmentos'], creado = '2026-10-01T12:00:00Z'): Fila => ({
  ws, nombre, creado, capa: 'completo', estado: 'activo', motivoRiesgo: null, sinEntrar: 1, mrrUsd: 0, planAManoTxt: null, segmentos,
})

test('4 · un cliente de una agencia no es un cliente de MaKo: no va en «Todos» ni en el crecimiento, sí en «De agencias», y la búsqueda dice de quién es', () => {
  const filas = [fila(21, 'Estudio Norte', ['cliente']), fila(27, 'Agencia Faro', ['agency']), fila(30, 'Consultorio Arce', ['de-agencia'], '2026-10-20T12:00:00Z')]
  assert.equal(esClienteDeMaKo({ segmentos: ['de-agencia'] }), false)
  assert.equal(esClienteDeMaKo({ segmentos: ['agency', 'partner'] }), true, 'una agencia sí es un cliente de MaKo')
  const lista = listaDeClientes(filas)
  const de = (filter: 'all' | 'active' | 'inactive' | 'agency') => filtrarClientes(lista, { query: null, sorting: '-created_at', filter }).map((c) => c.ws)
  assert.deepEqual(de('all'), [21, 27], 'la lista sin el cliente de la agencia')
  assert.deepEqual(de('active'), [21, 27], 'ni con los filtros de siempre')
  // «De agencias» (decisión del Cerebro, 6/11/2026): el lugar de la lista para los clientes de una agencia.
  assert.deepEqual(de('agency'), [30], 'con «De agencias», sólo el de la agencia')
  assert.equal(lista.find((c) => c.ws === 30)?.deAgencia, true)

  const vacio = <T,>(datos: T): Lectura<T> => ({ ok: true, datos, avisos: [] })
  const ingresos = vacio<{ entradas: Entrada[]; clientes: ClienteResumen[] }>({ entradas: [], clientes: [] })
  const costos = vacio({ periodo: '2026-11', antes: null, despues: { costUsd: 0, porWorkspace: [] }, plataforma: 9 })
  const o = vistaDeOverview(vacio({ filas }), ingresos, costos, '2026-11', Date.parse('2026-11-06T12:00:00Z'))
  assert.equal(o.creados.length, 2, 'el crecimiento cuenta los negocios de la lista')

  const indice = armarIndice({
    workspaces: [
      { id: 9, nombre: 'MaKo', capa: 'superadmin', estado: 'activo' },
      { id: 27, nombre: 'Agencia Faro', capa: 'agencia', estado: 'activo' },
      { id: 30, nombre: 'Consultorio Arce', capa: 'completo', estado: 'pausado' },
    ],
    usuarios: [],
    plataforma: 9,
    plan: (c) => (c === 'agencia' ? 'MaKo Pro' : 'MaKo Esencial'),
    deAgencia: new Map([[30, 27]]),
  })
  assert.deepEqual(buscar(indice, 'arce').negocios.map((n) => n.detalle), ['De Agencia Faro · MaKo Esencial · Pausado'], 'se encuentra, y dice de qué agencia es')
  assert.deepEqual(buscar(indice, 'faro').negocios.map((n) => n.detalle), ['MaKo Pro'])
})

// ── 5. Los textos en español ─────────────────────────────────────────────────────────────────────────────────────

test('5 · lo que dibujan las piezas de Polar, en español (lo que no es un nombre de la barra)', () => {
  const PROHIBIDOS = [
    'No Results', 'Rows per page', 'Viewing the only record', 'Go to first page', 'Select all rows', 'Toggle Sidebar', 'Pick a date',
    'Select a value', 'No results found', 'Please enter', 'Previous Period', 'Current Period', 'Share Chart', 'Back to Dashboard',
    'All Time', 'Loading...', 'Invalid date', 'aria-label="Dismiss"', 'aria-label="Search"', '>Close<', "'Confirm'", '>Cancel<',
  ]
  const hallados: string[] = []
  for (const f of archivosAdmin()) {
    const s = sinComentarios(leer(f))
    for (const p of PROHIBIDOS) if (s.includes(p)) hallados.push(`${f}: ${p}`)
  }
  assert.deepEqual(hallados, [], 'textos en inglés que quedaron')
  // El rango completo se llama «Todo» en todos lados, como en Overview (punto 43, revisión del 6/11/2026).
  assert.deepEqual(Object.values(CHART_RANGES), ['Todo', '12m', '3m', '30d', 'Hoy'])
  assert.deepEqual(METRIC_GROUPS.map((g) => g.slug), ['revenue', 'orders', 'subscriptions', 'cancellations', 'unit-economics'], 'los slugs, los de Polar')
  const enIngles = Object.values(METRICAS).map((m) => m.display_name).filter((n) => /\b(Revenue|Orders?|Subscriptions?|Average|Churned|Costs?|Cumulative|New|Active)\b/.test(n))
  assert.deepEqual(enIngles, [], 'los nombres de las métricas, en español')
})

// ── 6. «Reportar a Soporte» ──────────────────────────────────────────────────────────────────────────────────────

test('6 · el `Alert` de Orbit trae «Reportar a Soporte» si es un error, una sola vez', () => {
  assert.equal(textoDeAviso('No pude leer X', 'la base   no contestó'), 'No pude leer X: la base no contestó')
  assert.equal(textoDeAviso('No pude leer X', undefined), 'No pude leer X')
  assert.equal(textoDeAviso('T', createElement('span', null, 'uno ', createElement('b', null, 'dos'))), 'T: uno dos', 'el texto adentro de los elementos')

  const html = (p: Parameters<typeof Alert>[0]) => renderToStaticMarkup(createElement(Alert, p))
  assert.match(html({ variant: 'danger', title: 'No pude leer X', description: 'falló' }), /Reportar a Soporte/, 'un error lo trae solo')
  assert.doesNotMatch(html({ variant: 'info', title: 'Hola' }), /Reportar a Soporte/)
  assert.match(html({ variant: 'warning', soporte: true, title: 'No pude leer todo' }), /Reportar a Soporte/, 'un «no pude leer» lo pide')
  assert.doesNotMatch(html({ variant: 'danger', soporte: false, title: 'Una urgencia' }), /Reportar a Soporte/)
  assert.equal(html({ variant: 'danger', title: 'X', description: 'y' }).match(/Reportar a Soporte/g)?.length, 1, 'una vez')

  // Nadie le vuelve a poner el botón a mano adentro de la descripción de un `Alert` (saldrían dos).
  const dobles = archivosAdmin().filter((f) => /<Alert\b[^>]*description=\{[\s\S]{0,300}?<ReportarASoporte/.test(sinComentarios(leer(f))))
  assert.deepEqual(dobles, [], 'un Alert con su propio <ReportarASoporte> adentro')
})

// ── 8. Una lectura por pedido ────────────────────────────────────────────────────────────────────────────────────

test('8 · las lecturas que se repiten en un pedido van con `cache` de React (una por pedido)', () => {
  const ingresos = sinComentarios(leer('lib/admin-ingresos.ts'))
  assert.match(ingresos, /const vistaDelMinuto = cache\(/, 'vistaDeIngresos: la leen la lista de negocios, Sales y la ficha')
  assert.match(ingresos, /export async function vistaDeIngresos\(ahora: Date = new Date\(\)\): Promise<VistaIngresos> \{\s*return vistaDelMinuto\(/, 'la misma firma, por el cache')
  assert.match(ingresos, /export const suscripcionesDeLaPlataforma = cache\(/)
  const ventas = sinComentarios(leer('app/admin/_polar/datos/ventas-server.ts'))
  assert.match(ventas, /const leerCobros = cache\(\(\) => cobrosDeMakoAction\(\)\)/)
  assert.doesNotMatch(ventas.replace(/const leerCobros = cache\(\(\) => cobrosDeMakoAction\(\)\)/, ''), /cobrosDeMakoAction\(\)/, 'nadie lee los cobros por fuera del cache')
  const clientes = sinComentarios(leer('app/admin/_polar/datos/clientes-server.ts'))
  assert.match(clientes, /export const leerClientes = cache\(/)
  assert.match(clientes, /export const leerIngresos = cache\(/)
})

// ── 9. El LazyMotion de la raíz ──────────────────────────────────────────────────────────────────────────────────

test('9 · la raíz de Admin monta el LazyMotion de Polar: sin él, los `m.div` se quedan en opacity 0 y Admin sale en blanco', () => {
  // Medido el 6/11/2026 con las capturas: sin el proveedor, la barra de Polar y el contenido de TODAS las páginas quedaban
  // invisibles, sin un error. El SSR dibuja igual el estado inicial con o sin proveedor, así que no se puede medir renderizando:
  // se fija la estructura. Polar lo monta en clients/apps/web/src/app/providers.tsx (`PolarMotionProvider`).
  const usanM = archivosAdmin().filter((f) => /import \{[^}]*\bm\b[^}]*\} from 'motion\/react'/.test(leer(f)))
  assert.ok(usanM.length > 0, 'ningún archivo usa `m` de motion: este test ya no cuida nada')
  const shell = sinComentarios(leer('app/admin/_polar/AdminShell.tsx'))
  assert.match(shell, /import \{ domAnimation, LazyMotion \} from 'motion\/react'/)
  assert.match(shell, /return \(\s*<LazyMotion features=\{domAnimation\}>\s*<DashboardLayout[\s\S]*<\/DashboardLayout>\s*<\/LazyMotion>\s*\)/, 'el LazyMotion envuelve todo el layout')
  // Y el layout de Admin monta ESE shell (no otro sin el proveedor).
  assert.match(sinComentarios(leer('app/admin/(polar)/layout.tsx')), /<AdminShell indice=\{indice\}>\{children\}<\/AdminShell>/)
})
