// =============================================================================
// Admin › Overview (la portada copiada del dashboard de Polar) y su búsqueda ⌘K: las funciones puras, EJECUTADAS
// =============================================================================
// Lo que se prueba: los links viejos (/admin?tab=…) van a su sección nueva; los rangos que MaKo puede contestar; los widgets
// (Revenue, Activity, Top Customers, At Risk) se arman con lo que leen las lecturas de MaKo; lo que espera a Martín (los
// banners); el índice y la búsqueda; los datos de ejemplo no nombran a nadie real; y la página pregunta por el super admin
// ANTES de leer nada.
//
// Correr: node --import tsx --test tests/admin-polar-resumen.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (6/11/2026), base 14/0 (pasan/fallan):
//   · `agents` → '/admin/analytics/events' (sin ?tipo=agente)            → 13/1 (links viejos)
//   · `rangosDisponibles` ofreciendo «Todo» siempre                       → 13/1 (rangos)
//   · las lecturas de MaKo listadas en Activity (sin el filtro `tipo !== 'accion'`) → 13/1 (actividad)
//   · `buscar` sin `normalizar` (mayúsculas y acentos)                    → 13/1 (búsqueda)
//   · `armarIndice` sin sacar la plataforma (y sus personas)              → 13/1 (índice)
//   · `await exigirSuperAdmin()` movido debajo de `destinoDeTabViejo`     → 13/1 (la guarda)
//   · `filasDeRiesgo` sin el orden por motivo                             → 13/1 (at risk)
// Y un cambio sin efecto (renombrar la variable local `destino` de la página) la deja en 14/0.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import type { MesIngresos } from '../lib/admin-ingresos-reglas'
import {
  actividadReciente, barrasDeIngresos, destinoDeTabViejo, diaRelativo, filasDeRiesgo, hrefDeMes, mesesDelRango,
  metricasRecordadas, motivoDeRiesgoTxt, pedidosDeAgencias, pedidosDeBaja, pedidosDeIngreso, rangosDisponibles,
  tiempoRelativo, tituloDeAgencias, tituloDeBajas, tituloDeIngreso, topClientes, LIMITE_METRICAS_OVERVIEW,
} from '../app/admin/_polar/datos/resumen'
import { armarIndice, buscar, TOPE_POR_CLASE } from '../app/admin/_polar/datos/busqueda-tipos'
import { indiceEjemplo, resumenEjemplo } from '../app/admin/_polar/datos/ejemplo/resumen'
import { realesEn } from './_reales'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n')
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')

const mes = (m: string, cobrado: number, enCurso = false): MesIngresos => ({ mes: m, cobrado, mrr: cobrado, nuevo: 0, vuelve: 0, sube: 0, baja: 0, corte: 0, enCurso })
const DOCE = ['2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11']
  .map((m, i) => mes(m, i * 100, m === '2026-11'))

test('links viejos: cada /admin?tab=… va a su sección nueva, y lo demás se queda en Overview', () => {
  assert.equal(destinoDeTabViejo({}), null, 'sin ?tab= es Overview')
  assert.equal(destinoDeTabViejo({ tab: 'nada' }), null, 'un ?tab= desconocido no redirige')
  assert.equal(destinoDeTabViejo({ tab: 'revenue' }), '/admin/analytics/metrics')
  assert.equal(destinoDeTabViejo({ tab: 'users' }), '/admin/customers')
  assert.equal(destinoDeTabViejo({ tab: 'customers' }), '/admin/customers')
  assert.equal(destinoDeTabViejo({ tab: 'customers', cliente: '21' }), '/admin/customers/21')
  assert.equal(destinoDeTabViejo({ tab: 'customers', cliente: '0' }), '/admin/customers', 'un id que no es válido se cae')
  assert.equal(destinoDeTabViejo({ tab: 'customers', cliente: '21/../9' }), '/admin/customers', 'nada que no sea un número')
  assert.equal(destinoDeTabViejo({ tab: 'accounts' }), '/admin/customers')
  assert.equal(destinoDeTabViejo({ tab: 'accounts', cuenta: '7' }), '/admin/customers/7')
  assert.equal(destinoDeTabViejo({ tab: 'accounts', cliente: '7' }), '/admin/customers', '`accounts` lee `cuenta`, no `cliente`')
  assert.equal(destinoDeTabViejo({ tab: 'billing' }), '/admin/sales')
  assert.equal(destinoDeTabViejo({ tab: 'activity' }), '/admin/analytics/events')
  assert.equal(destinoDeTabViejo({ tab: 'agents' }), '/admin/analytics/events?tipo=agente')
  assert.equal(destinoDeTabViejo({ tab: 'errors' }), '/admin/analytics/events?tipo=error')
  assert.equal(destinoDeTabViejo({ tab: ['billing', 'revenue'] }), '/admin/sales', 'un parámetro repetido toma el primero')
})

test('rangos: «Todo» sólo si el primer pago entra en los meses leídos, y nunca 30d ni Today (MaKo mide por mes)', () => {
  assert.deepEqual(rangosDisponibles({ meses: DOCE, primerPago: '2026-05-04' }), ['all_time', '12m', '3m'])
  assert.deepEqual(rangosDisponibles({ meses: DOCE, primerPago: '2024-01-10' }), ['12m', '3m'], 'con pagos de antes, «Todo» sería «12m» con otro nombre')
  assert.deepEqual(rangosDisponibles({ meses: DOCE, primerPago: null }), ['12m', '3m'])
  assert.deepEqual(mesesDelRango({ meses: DOCE, primerPago: '2026-05-04' }, 'all_time').map((m) => m.mes)[0], '2026-05')
  assert.equal(mesesDelRango({ meses: DOCE, primerPago: null }, '3m').length, 3)
  assert.equal(mesesDelRango({ meses: DOCE, primerPago: null }, '12m').length, 12)
  assert.deepEqual(mesesDelRango({ meses: DOCE, primerPago: null }, '3m').map((m) => m.mes), ['2026-09', '2026-10', '2026-11'])
})

test('Revenue: los últimos cinco meses en centavos, el link de cada mes a Metrics y su fin topado en hoy', () => {
  const barras = barrasDeIngresos({ meses: DOCE, hoy: '2026-11-06' })
  assert.equal(barras.length, 5)
  assert.deepEqual(barras.map((b) => b.mes), ['2026-07', '2026-08', '2026-09', '2026-10', '2026-11'])
  assert.equal(barras[4].centavos, 110000, 'US$ 1.100 son 110.000 centavos')
  assert.equal(barras[4].enCurso, true)
  assert.equal(hrefDeMes('2026-11', '2026-11-06'), '/admin/analytics/metrics?start_date=2026-11-01&end_date=2026-11-06')
  assert.equal(hrefDeMes('2026-02', '2026-11-06'), '/admin/analytics/metrics?start_date=2026-02-01&end_date=2026-02-28')
})

test('Top Customers: los que más pagaron, sin los que no pagaron nada, y qué parte del total cobrado son', () => {
  const t = topClientes([
    { clave: 'ws:1', nombre: 'B', ws: 1, pagos: 2, total: 100 },
    { clave: 'ws:2', nombre: 'A', ws: 2, pagos: 9, total: 300 },
    { clave: 'lead:3', nombre: 'C', ws: null, pagos: 1, total: 0 },
    { clave: 'ws:4', nombre: 'D', ws: 4, pagos: 1, total: 100 },
  ], 1000, 2)
  assert.deepEqual(t.filas.map((f) => f.clave), ['ws:2', 'ws:1'], 'ordenados por lo pagado; a igual monto, por nombre')
  assert.equal(t.filas[0].totalCentavos, 30000)
  assert.equal(t.parte, 40, '(300 + 100) de 1000')
  assert.equal(topClientes([], 0).parte, null, 'sin nada cobrado no hay porcentaje (ni un 0% inventado)')
})

test('At Risk: el más grave primero (pausado, cobro, sin uso), con su motivo en palabras', () => {
  const r = filasDeRiesgo([
    { ws: 1, nombre: 'Uno', plan: 'Pro', riesgo: true, motivoRiesgo: 'sin-uso', sinEntrar: 20, mrrUsd: 900 },
    { ws: 2, nombre: 'Dos', plan: 'Pro', riesgo: true, motivoRiesgo: 'cobro', sinEntrar: 1, mrrUsd: 100 },
    { ws: 3, nombre: 'Tres', plan: 'Pro', riesgo: true, motivoRiesgo: 'pausado', sinEntrar: null, mrrUsd: 0 },
    { ws: 4, nombre: 'Cuatro', plan: 'Pro', riesgo: false, motivoRiesgo: null, sinEntrar: 0, mrrUsd: 500 },
  ])
  assert.equal(r.total, 3)
  assert.deepEqual(r.filas.map((f) => f.ws), [3, 2, 1])
  assert.deepEqual(r.filas.map((f) => f.motivo), ['Pausado', 'Cobro fallido', 'Sin entrar · hace 20 días'])
  assert.equal(motivoDeRiesgoTxt('sin-uso', null), 'Nadie entró nunca')
  assert.equal(r.filas[2].mrrCentavos, 90000)
})

test('Activity: pagos y acciones de MaKo, el día más nuevo primero; las lecturas cuentan para «hoy» y no se listan', () => {
  const ahoraMs = Date.parse('2026-11-06T18:00:00Z')
  const a = actividadReciente({
    hoy: '2026-11-06', ahoraMs,
    entradas: [{ fecha: '2026-11-06' }, { fecha: '2026-11-05' }],
    pagos: [
      { id: 'p:2', fecha: '2026-11-06', usd: 470, nombre: 'Estudio Norte', cliente: 'ws:21', recurrente: true },
      { id: 'p:1', fecha: '2026-11-04', usd: null, nombre: 'Ana Gómez', cliente: 'lead:5', recurrente: false },
    ],
    acciones: [
      { creado: '2026-11-06T17:30:00Z', dia: '2026-11-06', ws: 22, titulo: 'Mover un lead', tipo: 'accion', ok: true },
      { creado: '2026-11-06T17:00:00Z', dia: '2026-11-06', ws: 22, titulo: 'Ver leads', tipo: 'lectura', ok: true },
      { creado: '2026-11-05T12:00:00Z', dia: '2026-11-05', ws: null, titulo: 'Crear tarea', tipo: 'accion', ok: false },
    ],
    nombres: { 22: 'Panadería' },
    usdTxt: (c) => `US$ ${c / 100}`,
  })
  assert.deepEqual(a.filas.map((f) => f.titulo), ['Pago de una mensualidad', 'Mover un lead', 'Crear tarea', 'Pago'])
  assert.equal(a.hoy, 3, 'un pago de hoy y dos acciones de hoy (la lectura también cuenta)')
  assert.equal(a.hoyMas, false)
  assert.equal(a.filas[0].href, '/admin/customers/21')
  assert.equal(a.filas[0].detalle, 'Estudio Norte · US$ 470')
  assert.equal(a.filas[1].cuando, 'hace 30 min')
  assert.equal(a.filas[2].detalle, 'no salió', 'una acción que falló lo dice')
  assert.equal(a.filas[3].href, null, 'un lead sin cuenta de MaKo no tiene ficha en Customers')
  assert.equal(a.filas[3].cuando, 'hace 2 d')
  const llenas = Array.from({ length: 100 }, (_, i) => ({ creado: `2026-11-06T1${i % 10}:00:00Z`, dia: '2026-11-06', ws: 1, titulo: 'x', tipo: 'lectura', ok: true }))
  const b = actividadReciente({ hoy: '2026-11-06', ahoraMs, entradas: [], pagos: [], acciones: llenas, nombres: {}, usdTxt: String })
  assert.equal(b.hoyMas, true, 'las 100 leídas son de hoy: puede haber más')
  assert.equal(b.filas.length, 0)
})

test('tiempo relativo: como el `formatRelativeTime` de Polar, en español', () => {
  const ahora = Date.parse('2026-11-06T18:00:00Z')
  assert.equal(tiempoRelativo('2026-11-06T17:59:40Z', ahora), 'ahora')
  assert.equal(tiempoRelativo('2026-11-06T15:00:00Z', ahora), 'hace 3 h')
  assert.equal(tiempoRelativo('2026-11-03T18:00:00Z', ahora), 'hace 3 d')
  assert.equal(tiempoRelativo('2026-10-01T18:00:00Z', ahora), '1 oct')
  assert.equal(tiempoRelativo('no es una fecha', ahora), '—')
  assert.equal(diaRelativo('2026-11-06', '2026-11-06'), 'hoy')
  assert.equal(diaRelativo('2026-11-05', '2026-11-06'), 'ayer')
  assert.equal(diaRelativo('2026-10-05', '2026-11-06'), '5 oct')
})

test('lo que espera: los títulos dicen cuántos, y sin nada no hay banner', () => {
  assert.equal(tituloDeIngreso(0), null)
  assert.equal(tituloDeIngreso(1), 'Una persona quiere entrar a MaKo')
  assert.equal(tituloDeIngreso(3), '3 personas quieren entrar a MaKo')
  assert.equal(tituloDeAgencias(0), null)
  assert.equal(tituloDeAgencias(2), '2 pedidos de agencias esperan tu firma')
  assert.equal(tituloDeBajas(0), null)
  assert.equal(tituloDeBajas(1), 'Una persona pidió eliminar su cuenta')
})

test('lo que espera: los pedidos de ingreso, de las agencias y de baja, con lo que se puede hacer con cada uno', () => {
  const [p] = pedidosDeIngreso([{ id: 1, email: 'ana@ejemplo.com', nombre: 'Ana', origen: 'google', correo_verificado: true, detalle: null, whatsapp: null, intentos: 2 }])
  assert.equal(p.detalle, 'Intentó entrar con Google · Correo verificado por Google · 2 intentos')
  const ag = pedidosDeAgencias([{ agencia_ws: 5, cliente_ws: 6 }], [{ id: 9, agencia_ws: 5, cliente_ws: 77, email: 'x@ejemplo.com', rol_ws: 'closer' }], { 5: 'Agencia', 6: 'Cliente' })
  assert.deepEqual(ag.carteras[0], { agenciaWs: 5, clienteWs: 6, agencia: 'Agencia', cliente: 'Cliente' })
  assert.equal(ag.altas[0].cliente, 'Workspace 77', 'sin el nombre, el número (no se inventa uno)')
  assert.equal(ag.altas[0].rol, 'Closer')
  const ahora = Date.parse('2026-11-06T12:00:00Z')
  const [persona, negocio, prueba] = pedidosDeBaja([
    { id: 1, alcance: 'persona', email: 'p@ejemplo.com', negocio: null, negocio_id: 4, prueba: false, vence_at: '2026-11-01T12:00:00Z', notas: null },
    { id: 2, alcance: 'negocio', email: 'd@ejemplo.com', negocio: 'Estudio', negocio_id: 8, prueba: false, vence_at: '2026-11-20T12:00:00Z', notas: 'Se borró, pero quedó un archivo' },
    { id: 3, alcance: 'persona', email: 't@ejemplo.com', negocio: null, negocio_id: 4, prueba: true, vence_at: '2026-11-20T12:00:00Z', notas: null },
  ], ahora)
  assert.equal(persona.vencido, true)
  assert.match(persona.plazo, /^Se pasó del plazo/)
  assert.equal(persona.puedeEliminar, true)
  assert.equal(persona.negocioWs, null, 'a una persona no se la borra desde la ficha del negocio')
  assert.equal(negocio.titulo, 'El negocio entero: Estudio')
  assert.equal(negocio.negocioWs, 8)
  assert.equal(negocio.puedeEliminar, false, 'el negocio entero no se borra desde esta lista')
  assert.equal(negocio.puedeTerminar, true)
  assert.match(negocio.plazo, /^d@ejemplo\.com · Hasta el /)
  assert.equal(prueba.puedeEliminar, false)
  assert.equal(prueba.titulo, 't@ejemplo.com · de prueba')
})

test('Metrics de Overview: lo recordado vale si existe, sin repetir y hasta el límite', () => {
  assert.deepEqual(metricasRecordadas('["revenue","revenue","nada","orders"]'), ['revenue', 'orders'])
  assert.equal(metricasRecordadas('["nada"]'), null)
  assert.equal(metricasRecordadas('no es json'), null)
  assert.equal(metricasRecordadas('{"revenue":1}'), null)
  const muchas = JSON.stringify(['revenue', 'cumulative_revenue', 'orders', 'new_mrr', 'churned_mrr', 'expansion_mrr', 'new_subscriptions'])
  assert.equal(metricasRecordadas(muchas)?.length, LIMITE_METRICAS_OVERVIEW)
})

test('índice: los negocios y sus personas, sin la plataforma ni quien no tiene negocio', () => {
  const ind = armarIndice({
    workspaces: [
      { id: 9, nombre: 'MaKo', capa: 'superadmin', estado: 'activo' },
      { id: 21, nombre: 'Estudio Norte', capa: 'completo', estado: 'activo' },
      { id: 22, nombre: 'Panadería', capa: 'esencial', estado: 'pausado' },
    ],
    usuarios: [
      { id: 1, nombre: 'Equipo', email: 'e@ejemplo.com', workspace_id: 9 },
      { id: 2, nombre: 'Ana Gómez', email: 'ana@ejemplo.com', workspace_id: 21 },
      { id: 3, nombre: 'Global', email: 'g@ejemplo.com', workspace_id: null },
    ],
    plataforma: 9,
    plan: (c) => c.toUpperCase(),
  })
  assert.deepEqual(ind.negocios.map((n) => n.ws), [21, 22])
  assert.equal(ind.negocios[1].detalle, 'ESENCIAL · Pausado')
  assert.deepEqual(ind.personas.map((p) => p.id), [2])
  assert.equal(ind.personas[0].negocio, 'Estudio Norte')
  assert.deepEqual(Object.keys(ind.personas[0]).sort(), ['email', 'id', 'negocio', 'nombre', 'tipo', 'ws'], 'viaja sólo lo que se muestra')
})

test('búsqueda: sin acentos ni mayúsculas, primero lo que EMPIEZA con lo escrito, y hasta cinco de cada clase', () => {
  const r = buscar(indiceEjemplo, 'GOMEZ')
  assert.deepEqual(r.personas.map((p) => p.nombre), ['Ana Gómez'])
  const porNegocio = buscar(indiceEjemplo, 'estudio')
  assert.deepEqual(porNegocio.negocios.map((n) => n.nombre), ['Estudio Norte'])
  assert.deepEqual(porNegocio.personas.map((p) => p.nombre), ['Ana Gómez'], 'una persona también se encuentra por su negocio')
  assert.equal(buscar(indiceEjemplo, '   ').negocios.length, 0, 'sin texto no hay resultados')
  const muchos = armarIndice({
    workspaces: Array.from({ length: 9 }, (_, i) => ({ id: i + 1, nombre: i === 8 ? 'Norte' : `Gran Norte ${i}`, capa: 'completo', estado: 'activo' })),
    usuarios: [], plataforma: null, plan: String,
  })
  const n = buscar(muchos, 'norte')
  assert.equal(n.negocios.length, TOPE_POR_CLASE)
  assert.equal(n.negocios[0].nombre, 'Norte', 'el que empieza con lo escrito va primero')
})

test('los datos de ejemplo se arman y no nombran a nadie real', () => {
  assert.equal(resumenEjemplo.ingresos.ok, true)
  assert.equal(resumenEjemplo.actividad.ok && resumenEjemplo.actividad.datos.filas.length > 0, true)
  assert.deepEqual(realesEn(JSON.stringify(resumenEjemplo)), [])
  assert.deepEqual(realesEn(JSON.stringify(indiceEjemplo)), [])
})

test('la portada pregunta por el super admin ANTES de leer nada, y redirige los links viejos antes de leer', () => {
  const src = sinComentarios(leer('app/admin/(polar)/page.tsx'))
  assert.match(src, /export const dynamic = 'force-dynamic'/)
  const guarda = src.indexOf('await exigirSuperAdmin()')
  assert.ok(guarda > 0, 'la página llama a exigirSuperAdmin()')
  const firma = src.slice(src.indexOf('export default async function'))
  // El cuerpo arranca después de la firma (`}) {`): las llaves de antes son del tipo de las props.
  const primera = firma.slice(firma.indexOf(') {') + 3).trim().split('\n')[0].trim()
  assert.equal(primera, 'await exigirSuperAdmin()', 'es la primera sentencia de la página')
  for (const lectura of ['props.searchParams', 'destinoDeTabViejo(', 'leerResumenDeAdmin(', 'indiceDeBusqueda(']) {
    const i = src.indexOf(lectura, src.indexOf('export default'))
    assert.ok(i > guarda, `${lectura} va después de la guarda`)
  }
  assert.ok(src.indexOf('redirect(destino)') < src.indexOf('leerResumenDeAdmin('), 'el link viejo redirige antes de leer los datos')
  assert.doesNotMatch(src, /searchParams[^\n]*\bws\b/, 'no lee ?ws= de la URL')
})
