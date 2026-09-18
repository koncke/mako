// =============================================================================
// Los estados del tablero del cliente: los 2 nuevos no se los come el avance
// =============================================================================
// Con la mig 0159 entraron `no_cumple` («No cumplen criterio») y `en_seguimiento`.
// La trampa estaba en `editarTarea`: derivaba el estado del avance a ciegas, así que
// tocarle el % a una tarea descartada la sacaba a «En proceso» — promoverla sin que
// nadie lo decida. Y en los lectores que preguntaban `estado !== 'hecho'`, que con
// `no_cumple` contaban lo descartado como trabajo pendiente.
//
// PROBADO ROMPIÉNDOLO (17/9): volviendo `estadoTrasProgreso` a la derivación ciega de
// antes y sacando `en_seguimiento` del CHECK de la 0159 → 3 de 7 en rojo (los dos del
// avance y el de TS vs base). Restaurado → 7 de 7.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ESTADOS, estadoTrasProgreso, estaPendiente, esEstado, NO_PENDIENTES_SQL } from '../lib/todo-estados';

test('el avance NO saca una tarea de «No cumplen criterio»', () => {
  assert.equal(estadoTrasProgreso('no_cumple', 0), 'no_cumple');
  assert.equal(estadoTrasProgreso('no_cumple', 40), 'no_cumple');
});

test('el avance NO saca una tarea de «En seguimiento»', () => {
  assert.equal(estadoTrasProgreso('en_seguimiento', 0), 'en_seguimiento');
  assert.equal(estadoTrasProgreso('en_seguimiento', 99), 'en_seguimiento');
});

test('el 100% manda desde cualquier estado: terminada es un hecho', () => {
  for (const { key } of ESTADOS) assert.equal(estadoTrasProgreso(key, 100), 'hecho', key);
});

test('los tres de siempre derivan igual que antes de la 0159', () => {
  // La tabla de verdad vieja: 100→hecho, >0→en_curso, 0→por_hacer. No puede moverse.
  for (const actual of ['por_hacer', 'en_curso', 'hecho'] as const) {
    assert.equal(estadoTrasProgreso(actual, 0), 'por_hacer', actual);
    assert.equal(estadoTrasProgreso(actual, 1), 'en_curso', actual);
    assert.equal(estadoTrasProgreso(actual, 99), 'en_curso', actual);
  }
});

test('lo descartado NO es pendiente; lo que espera a otro SÍ', () => {
  assert.equal(estaPendiente('no_cumple'), false);
  assert.equal(estaPendiente('hecho'), false);
  assert.equal(estaPendiente('en_seguimiento'), true);
  assert.equal(estaPendiente('por_hacer'), true);
  assert.equal(estaPendiente('en_curso'), true);
  // Y la versión SQL dice lo mismo que la de TS.
  const fuera = NO_PENDIENTES_SQL.replace(/[()]/g, '').split(',');
  assert.deepEqual(ESTADOS.filter((e) => !estaPendiente(e.key)).map((e) => e.key).sort(), fuera.sort());
});

test('un estado inventado no es estado', () => {
  assert.equal(esEstado('Por hacer'), false);
  assert.equal(esEstado('descartada'), false);
  assert.equal(esEstado(null), false);
});

test('la lista de TS y el CHECK de la base son el MISMO juego', () => {
  // Si se agrega un estado acá y no en la base, el insert falla en prod; si se agrega
  // allá y no acá, `estadoOk` lo pisa con 'por_hacer' al leer. Los dos son silenciosos.
  const sql = readFileSync(new URL('../supabase/migrations/0159_tareas_estados_responsable_criterio.sql', import.meta.url), 'utf8');
  const m = sql.match(/check \(estado in \(([^)]*)\)\)/);
  assert.ok(m, 'no encontré el CHECK de estado en la 0159');
  const enLaBase = m[1].split(',').map((s) => s.trim().replace(/'/g, '')).sort();
  assert.deepEqual(ESTADOS.map((e) => e.key).sort(), enLaBase);
});
