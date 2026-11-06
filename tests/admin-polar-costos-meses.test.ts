// =============================================================================
// Los meses con gasto de IA no se leen recorriendo `anthropic_usage` entera (6/11/2026, punto 33 de la revisión del Cerebro)
// =============================================================================
// `resumenDelPeriodo` llamaba siempre a `mesesConDatos`, que paginaba la tabla de uso de IA ENTERA de a 1000 filas sólo para
// saber qué meses hay: en cada entrada a Customers (que no usa esos meses) y dos veces en Analytics › Costs. Crecía con cada
// llamada a la IA. Lo que fija este archivo, con las funciones REALES de lib/costos-ia.ts contra un PostgREST de mentira
// (tests/_costos-ia-meses-hijo.ts, en un node con `--conditions=react-server`), 300 filas en agosto, septiembre y noviembre:
//   1. `resumenDelPeriodo(mes)` lee sólo las filas de ese mes, en un pedido, y no trae los meses (Customers no los usa);
//   2. con `{ conMeses: true }` los trae, y `mesesConDatos` los encuentra pidiendo UNA fila por mes (no la tabla entera);
//   3. «no pude leer» no es «sin meses» cuando se pide estricto (Costs lo avisa); sin estricto, devuelve `[]` y lo anota.
// (No hace falta una función SQL ni una migración: alcanza con el índice de `created_at` que ya existe, mig 0043.)
//
// Correr: node --import tsx --test tests/admin-polar-costos-meses.test.ts
//
// Probado rompiéndolo el 6/11/2026 (base 3/0; restaurado de memoria). Cada rotura, sola:
//   · `resumenDeVentana` vuelve a pedir los meses siempre (`mesesDisponibles: await mesesConDatos()`) → 2/1 (1)
//   · `mesesConDatos` vuelve a leer la tabla entera (`leerTodo` de `created_at`)                       → 2/1 (2)
//   · `mesesConDatos` sin la pregunta por mes (todos los meses desde el primero, con o sin filas)       → 2/1 (2)
//   · `mesesConDatos` traga el error también con `estricto`                                            → 2/1 (3)
//   · un cambio sin efecto (renombrar la local `ola` de `mesesConDatos`)                               → 3/0
// =============================================================================

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = fileURLToPath(new URL('..', import.meta.url))

type Salida = {
  total: number
  resumen: { pedidos: number; filas: number; filasLeidas: number; meses: string[] }
  conMeses: { pedidos: number; filas: number; meses: string[] }
  meses: { pedidos: number; filas: number; valor: string[] }
  caidos: string[]
  estricto: string | null
  red: string[]
}

let cache: Salida | null = null
const salida = (): Salida => {
  if (!cache) {
    cache = JSON.parse(execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', '--no-warnings', join(RAIZ, 'tests/_costos-ia-meses-hijo.ts')], {
      cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120_000,
    })) as Salida
  }
  return cache
}

test('1. el gasto de un mes lee sólo ese mes, en un pedido, y no recorre la tabla para saber los meses', () => {
  const s = salida()
  assert.deepEqual(s.red, [], 'nada sale a la red')
  assert.equal(s.total, 300)
  assert.equal(s.resumen.filasLeidas, 80, 'las filas de noviembre')
  assert.equal(s.resumen.pedidos, 1, 'un solo pedido a la tabla de uso')
  assert.equal(s.resumen.filas, 80, 'y no vuelve ninguna fila de otro mes')
  assert.deepEqual(s.resumen.meses, [], 'los meses no se piden si nadie los pidió')
})

test('2. los meses con datos salen de una fila por mes, no de la tabla entera', () => {
  const s = salida()
  assert.deepEqual(s.meses.valor, ['2026-11', '2026-09', '2026-08'], 'el más nuevo primero, y octubre (sin filas) no está')
  assert.ok(s.meses.filas <= 5, `una fila para saber dónde arranca y una por mes con datos (volvieron ${s.meses.filas} de ${s.total})`)
  assert.ok(s.meses.pedidos <= 5, 'un pedido por mes, de agosto a noviembre, más el primero')
  assert.deepEqual(s.conMeses.meses, ['2026-11', '2026-09', '2026-08'], 'con { conMeses: true } el resumen los trae')
  assert.equal(s.conMeses.filas, 80 + s.meses.filas, 'y cuestan lo mismo que pedirlos aparte')
})

test('3. «no pude leer los meses»: estricto tira (Costs lo avisa); si no, `[]`', () => {
  const s = salida()
  assert.deepEqual(s.caidos, [])
  assert.match(s.estricto ?? '', /no contestó/, 'el error llega a quien lo pidió estricto')
})
