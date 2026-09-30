// =============================================================================
// El toggle «Avanzado» del tablero del cliente (#53)
// =============================================================================
// EL PEDIDO, del 31/08/2026: «una vista SIMPLE por default (3 tareas + experimentos) con
// el kanban completo detrás de un toggle Avanzado». Un cliente que entra a su plan tiene
// que aterrizar en lo que hay que hacer hoy, no en un tablero de 200 tarjetas y cuatro
// columnas. La mitad de arriba ya estaba —Prioridades es una lista corta que cura el
// Perro y nunca queda muda—; faltaba el toggle, así que el kanban era una pestaña más,
// siempre visible.
//
// ⚠️ PROBADO ROMPIÉNDOLO, tres veces (30/09/2026):
//   1. Sacando `|| actual === id` (la vista actual se esconde igual): falla 1 de 5, y es
//      la que importa — deja a alguien parado en el kanban sin la pestaña para volver.
//   2. Devolviendo siempre true: falla 1 de 5. Es el estado anterior, o sea la feature
//      sin hacer, y el test lo tiene que ver. (Falla UNA porque node:test cuenta tests y
//      no aserciones: las cuatro de «en SIMPLE se esconde …» viven en el mismo test.)
//   3. Metiendo 'prioridades' en SOLO_AVANZADO: falla 1 de 5. Esconder la vista donde el
//      cliente aterriza es dejarlo mirando una pantalla vacía en modo simple.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SOLO_AVANZADO, vistaVisible } from '../app/plan/board/types';

test('en SIMPLE se esconde el tablero completo y queda con qué trabajar', () => {
  assert.equal(vistaVisible('tareas', false, 'prioridades'), false, 'el kanban sigue a la vista');
  assert.equal(vistaVisible('proyectos', false, 'prioridades'), false);
  assert.equal(vistaVisible('prioridades', false, 'prioridades'), true, 'se escondió la vista donde el cliente aterriza');
  assert.equal(vistaVisible('recurrentes', false, 'prioridades'), true);
});

test('EL QUE IMPORTA: la vista en la que estás NUNCA se esconde', () => {
  // Un link compartido (`?vista=tareas`) es una DECISIÓN y le gana a la preferencia
  // guardada. Y aunque no lo fuera: esconderle la pestaña a quien YA está parado ahí
  // deja una pantalla sin ningún control para salir de ella.
  assert.equal(vistaVisible('tareas', false, 'tareas'), true, 'el kanban abierto se quedó sin su pestaña');
  assert.equal(vistaVisible('proyectos', false, 'proyectos'), true);
});

test('en AVANZADO están las cuatro', () => {
  for (const v of ['prioridades', 'tareas', 'proyectos', 'recurrentes']) {
    assert.equal(vistaVisible(v, true, 'prioridades'), true, `«${v}» no se ve en avanzado`);
  }
});

test('una vista que no está en la lista (la vistaExtra) se ve siempre', () => {
  // `vistaExtra` es un slot: hoy es «Equipo» en la ficha de un cliente. Lo que monta el
  // board decide si va; el toggle no tiene por qué saber qué es ni esconderlo.
  assert.equal(vistaVisible('equipo', false, 'prioridades'), true);
});

test('el tablero del CLIENTE lo pide y el del DUEÑO no', () => {
  // ⚠️ Es una PROP, no algo deducido del `scope`. «Es el tablero de un cliente» y
  // «arranca simple» son dos hechos distintos, y el día que uno valga sin el otro
  // deducirlo miente. Misma regla que `embebido`, que ya se pagó una vez acá.
  const todo = readFileSync(resolve(import.meta.dirname, '../app/plan/TodoBoard.tsx'), 'utf8');
  const plan = readFileSync(resolve(import.meta.dirname, '../app/plan/PlanBoard.tsx'), 'utf8');
  assert.match(todo, /<BoardShell[^>]*simplePorDefecto/, 'el tablero del cliente no arranca simple');
  assert.doesNotMatch(plan, /<BoardShell[^>]*simplePorDefecto/, 'al super admin le escondieron el kanban, que es donde vive');
  assert.deepEqual([...SOLO_AVANZADO], ['tareas', 'proyectos']);
});
