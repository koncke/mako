// =============================================================================
// Admin › Customers: los negocios de prueba no cuentan como clientes (F21, CU1 del recorrido visual del 30/10/2026)
// =============================================================================
// Correr: node --import tsx --test tests/clientes-sin-pruebas.test.ts
//
// El recorrido visual del 30/10 (docs/recorrido-visual-30-10.md, CU1): «Las cuentas de prueba (…, Cliente de Diseño, Cliente de
// Prueba) cuentan como clientes». `vistaDeClientes` (lib/clientes-plataforma.ts) arma la fila de TODOS los negocios y aparta los
// que no son clientes (`NO_SON_CLIENTES`: `WS_PRUEBAS` y la cuenta de revisión de las tiendas) ANTES de contar. Lo que busca un
// negocio (la ficha, «Editar persona», el DEBUG) los sigue encontrando en `pruebas`.
//
// ⚠️ PROBADO ROMPIÉNDOLO (18/11/2026). Base: 4 pass / 0 fail. Cada rotura, restaurada después:
//   · `apartarLosQueNoSonClientes` deja todo en `clientes` (sin mirar el set)                  → 3/1 (apartar)
//   · `clientesEnRiesgo` sin el `fuera.has(i.ws)` del bucle de los ingresos                      → 3/1 (riesgo)
//   · `vistaDeAtRisk` sin pasar `fuera` (el cuarto argumento)                                    → 3/1 (riesgo)
//   · `NO_SON_CLIENTES` sin `WS_REVISION`                                                         → 3/1 (cableado)
//   · un cambio sin efecto (renombrar `fuera` a `noSon` adentro de vistaDeAtRisk)                → 4/0

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { apartarLosQueNoSonClientes, kpisDeClientes, paraMirar } from '../lib/clientes-plataforma-reglas'
import { clientesEnRiesgo, vistaDeAtRisk } from '../app/admin/_polar/datos/clientes'
import { WS_PRUEBA, WS_DISENO, WS_PRUEBAS } from '../lib/auth-session'
import { WS_REVISION } from '../lib/cuenta-revision-reglas'
import type { FilaCliente } from '../lib/clientes-plataforma'
import type { ClienteResumen } from '../lib/admin-ingresos-reglas'

const RAIZ = fileURLToPath(new URL('..', import.meta.url))
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n')
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')

// El mismo set que lib/clientes-plataforma.ts (que es server-only y no se importa): el test de cableado de abajo fija que sea éste.
const NO_SON = new Set<number>([...WS_PRUEBAS, WS_REVISION])

const AHORA = Date.parse('2026-11-18T12:00:00Z')

type Fila = Pick<FilaCliente, 'ws' | 'nombre' | 'creado' | 'capa' | 'estado' | 'motivoRiesgo' | 'sinEntrar' | 'mrrUsd' | 'sinDolares' | 'planAManoTxt' | 'segmentos' | 'riesgo' | 'prueba' | 'pagoPendiente' | 'regaloPorTerminar' | 'onboardingHecho'>
const fila = (ws: number, nombre: string, extra: Partial<Fila> = {}): Fila => ({
  ws, nombre, creado: '2026-11-10T00:00:00Z', capa: 'completo', estado: 'activo', motivoRiesgo: null, sinEntrar: 1, mrrUsd: 0,
  sinDolares: 0, planAManoTxt: null, segmentos: ['cliente'], riesgo: false, prueba: false, pagoPendiente: false,
  regaloPorTerminar: null, onboardingHecho: true, ...extra,
})

test('apartar: los de prueba y la cuenta de revisión salen de los clientes, en el orden de siempre', () => {
  const todas = [
    fila(12, 'Estudio Norte'),
    fila(WS_PRUEBA, 'Cliente de Prueba'),
    fila(15, 'Óptica Clara'),
    fila(WS_DISENO, 'Cliente de Diseño'),
    fila(WS_REVISION, 'Revisión de las tiendas'),
  ]
  const { clientes, pruebas } = apartarLosQueNoSonClientes(todas, NO_SON)
  assert.deepEqual(clientes.map((f) => f.ws), [12, 15], 'sólo los clientes de verdad')
  assert.deepEqual(pruebas.map((f) => f.ws), [WS_PRUEBA, WS_DISENO, WS_REVISION], 'los de prueba, aparte y sin perder ninguno')
  // Los números de arriba, contados sobre los clientes: los tres de prueba eran «nuevos en 30 días» y «activos».
  const k = kpisDeClientes(clientes, AHORA)
  assert.equal(k.activos, 2)
  assert.equal(k.nuevos30, 2)
  assert.equal(kpisDeClientes(todas, AHORA).nuevos30, 5, 'con las pruebas adentro, el número se inflaba (lo que pasaba antes)')
  // «Para mirar» tampoco los ve (todos son «nuevos»).
  assert.deepEqual(paraMirar(clientes, AHORA).map((i) => i.ws).sort(), [12, 15])
})

test('riesgo: un negocio de prueba no entra ni por su fila ni por sus ingresos', () => {
  const filas = [fila(12, 'Estudio Norte', { motivoRiesgo: 'sin-uso' }), fila(WS_PRUEBA, 'Cliente de Prueba', { motivoRiesgo: 'sin-uso' })]
  const ingreso = (ws: number, nombre: string): ClienteResumen => ({
    clave: `ws:${ws}`, ws, leadId: null, nombre, estado: 'atrasado', mrr: 47, diasAtraso: 3,
    total: 47, sinDolares: 0, pagos: 1, primerPago: '2026-10-01', ultimoPago: '2026-10-01', proximo: '2026-11-01',
  })
  const ingresos = [ingreso(12, 'Estudio Norte'), ingreso(WS_PRUEBA, 'Cliente de Prueba')]
  const fuera = new Set([WS_PRUEBA])
  assert.deepEqual(clientesEnRiesgo(filas, ingresos, 100, fuera).map((c) => c.ws), [12], 'el de prueba no está ni por su atraso ni por su uso')
  assert.deepEqual(clientesEnRiesgo(filas, ingresos).map((c) => c.ws).sort(), [12, WS_PRUEBA], 'sin el set, entra (la ficha de UN negocio lo usa así)')
  // La vista de At Risk recibe las pruebas aparte (como las devuelve vistaDeClientes) y no las muestra.
  const v = vistaDeAtRisk(
    { ok: true, datos: { filas: [filas[0]], pruebas: [{ ws: WS_PRUEBA, nombre: 'Cliente de Prueba' }] }, avisos: [] },
    { ok: true, datos: { entradas: [], clientes: ingresos }, avisos: [] },
  )
  assert.deepEqual(v.atRisk?.map((c) => c.ws), [12], 'el atrasado de prueba no se cuela por los ingresos')
})

test('cableado: vistaDeClientes aparta con WS_PRUEBAS y la cuenta de revisión, antes de contar', () => {
  const src = sinComentarios(leer('lib/clientes-plataforma.ts'))
  assert.match(src, /NO_SON_CLIENTES: ReadonlySet<number> = new Set<number>\(\[\.\.\.WS_PRUEBAS, WS_REVISION\]\)/, 'el set es WS_PRUEBAS + WS_REVISION')
  const apartar = src.indexOf('apartarLosQueNoSonClientes(todas, NO_SON_CLIENTES)')
  assert.ok(apartar > 0, 'se aparta sobre todas las filas')
  assert.ok(apartar < src.indexOf('kpis: kpisDeClientes(filas, ahoraMs)'), 'antes de los números')
  assert.ok(apartar < src.indexOf('paraMirar: paraMirar(filas, ahoraMs)'), 'antes de «Para mirar»')
})

test('lo que busca un negocio lo sigue encontrando: la ficha, «Editar persona» y el DEBUG miran también las pruebas', () => {
  const ficha = sinComentarios(leer('app/admin/_polar/datos/cliente-server.ts'))
  assert.match(ficha, /clientes\.datos\.pruebas\.find\(\(f\) => f\.ws === ws\)/, 'la ficha de un negocio de prueba se sigue abriendo con su fila')
  assert.match(ficha, /\[\.\.\.clientes\.datos\.filas, \.\.\.clientes\.datos\.pruebas\]/, '«Editar persona» puede mudar a alguien al Cliente de Prueba')
  const debug = sinComentarios(leer('lib/api-mako/areas/operaciones.run.ts'))
  assert.match(debug, /const todas = \[\.\.\.v\.filas, \.\.\.v\.pruebas\]/, 'el DEBUG encuentra al Cliente de Prueba')
})
