// =============================================================================
// La repesca: rechazar un proyecto nuevo no puede dejar la tarea sin lugar
// =============================================================================
// El contexto completo está en tests/plan-proyectos-catalogo.ts. Acá se cubre la
// aritmética, que es la parte que falla en silencio: la segunda pasada ve un SUB-LOTE y
// devuelve índices 0..n-1 que no son los del lote original. Un mapeo mal hecho no
// rompe, no loguea y no se ve — solo manda la tarea equivocada al proyecto equivocado.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { huerfanasDeRuteo, remapearRepesca } from '../lib/ruteo-repesca';

test('EL CASO REAL: el `asign` que nombraba al proyecto rechazado deja huérfana la tarea', () => {
  // Las dos tareas del 12/8. El modelo asignó las dos, pero la segunda apuntaba a
  // «Feature: Funnel de Venta», que la barrera de «una sola tarea» rechazó — así que
  // esa asignación no sobrevivió al filtro de destinos válidos y no llegó acá.
  const huerfanas = huerfanasDeRuteo(2, { asign: [{ i: 0 }], nuevos: [] });
  assert.deepEqual(huerfanas, [1]);
});

test('las tareas de un proyecto nuevo APROBADO no son huérfanas', () => {
  // Cuentan las dos formas de tener destino. Mirando solo `asign`, estas tres se
  // rutearían de nuevo a un lugar de la lista y vaciarían el proyecto recién aprobado —
  // que es el bug que ya se había arreglado una vez y que esto protege.
  const huerfanas = huerfanasDeRuteo(4, { asign: [{ i: 3 }], nuevos: [{ tareas: [0, 1, 2] }] });
  assert.deepEqual(huerfanas, []);
});

test('sin huérfanas no hay segunda pasada (y por lo tanto no hay gasto)', () => {
  assert.deepEqual(huerfanasDeRuteo(3, { asign: [{ i: 0 }, { i: 1 }, { i: 2 }] }), []);
  assert.deepEqual(huerfanasDeRuteo(0, { asign: [] }), []);
});

test('el ruteo entero caído: TODAS quedan huérfanas, ninguna se pierde en el conteo', () => {
  assert.deepEqual(huerfanasDeRuteo(5, { asign: [] }), [0, 1, 2, 3, 4]);
});

test('EL OFF-BY-ONE: los índices del sub-lote vuelven a los del lote entero', () => {
  // El sub-lote es [tarea 3, tarea 7]. La repesca contesta sobre 0 y 1. Sin remapear,
  // «0 → Feature: CRM» le pondría CRM a la tarea 0 del lote original, que ni siquiera
  // estaba huérfana y ya tenía su proyecto.
  const huerfanas = [3, 7];
  const out = remapearRepesca([{ i: 0, destino: 'Feature: CRM' }, { i: 1, destino: 'Feature: Plan' }], huerfanas);
  assert.deepEqual(out, [{ i: 3, destino: 'Feature: CRM' }, { i: 7, destino: 'Feature: Plan' }]);
});

test('un índice fuera del sub-lote se DESCARTA: una asignación de más es peor que una de menos', () => {
  // El modelo devuelve a veces un índice que no existe. Apuntaría a una tarea que nadie
  // pidió rutear, y esa tarea ya tiene proyecto: la pisaría sin dejar rastro.
  const out = remapearRepesca([{ i: 0, destino: 'A' }, { i: 5, destino: 'B' }, { i: -1, destino: 'C' }], [2]);
  assert.deepEqual(out, [{ i: 2, destino: 'A' }]);
});

test('la repesca vacía no rompe nada', () => {
  assert.deepEqual(remapearRepesca([], [1, 2]), []);
  assert.deepEqual(remapearRepesca([{ i: 0, destino: 'A' }], []), []);
});

test('remapear no muta lo que recibe', () => {
  // El caller concatena el resultado con el `asign` de la primera pasada; si esto
  // mutara, el mismo objeto quedaría con dos índices distintos según quién lo lea.
  const original = [{ i: 0, destino: 'A' }];
  remapearRepesca(original, [9]);
  assert.deepEqual(original, [{ i: 0, destino: 'A' }]);
});
