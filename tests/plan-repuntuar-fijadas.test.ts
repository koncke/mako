// =============================================================================
// «Re-puntuar todo» (la re-puntuación completa del Perro) no le pasa por encima a lo fijado a mano (17/10/2026)
// =============================================================================
// docs/relevo/plan-perro-guardian.md → «Lo que sigue en la cola»: «`puntuarPlan` también curva con `curveTaskScores` y no
// pasa por `respetarFijadas`». Era el error que `recurvarPlanOwner` tuvo hasta el 14/10 (240 de 513 arrastres se
// deshacían), en el otro camino: la fijada recibía el número de su puesto y la vecina que un arrastre había corrido volvía
// a quedar encima. La regla vive en `curvaSinPisarFijadas` (app/plan/board/lugar-al-soltar.ts, pura).
//
// ⚠️ PROBADO ROMPIÉNDOLO (17/10/2026), una rotura por vez y vuelta atrás:
//   1. `curvaSinPisarFijadas` que devuelve la curva tal cual ......................... 1 fallo
//   2. `puntuarPlan` sin filtrar las fijadas de la salida ............................ 1 fallo
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { curvaSinPisarFijadas } from '../app/plan/board/lugar-al-soltar';

test('una fijada no recibe número, y la de abajo no la cruza por un reparto de un punto', () => {
  // Hoy: A fijada en 60 (arriba), B en 59 justo abajo. El reparto del modelo le daría 61 a B y 58 a A.
  const tareas = [
    { id: 'A', num: 1, scoreActual: 60, fijada: true },
    { id: 'B', num: 2, scoreActual: 59 },
    { id: 'C', num: 3, scoreActual: 30 },
  ];
  const out = curvaSinPisarFijadas(tareas, { A: 58, B: 61, C: 40 });
  assert.equal(out.A, undefined, 'la fijada no se escribe');
  assert.ok(out.B <= 60, `B quedó encima de la fijada (${out.B}): un punto de reparto no es un juicio`);
  assert.equal(out.C, 40, 'la que está lejos recibe su número');
});

test('un juicio de verdad (3 puntos o más del otro lado) sí cruza; sin fijadas, la curva de siempre', () => {
  const tareas = [{ id: 'A', num: 1, scoreActual: 60, fijada: true }, { id: 'B', num: 2, scoreActual: 59 }];
  assert.equal(curvaSinPisarFijadas(tareas, { A: 50, B: 70 }).B, 70, 'el Perro la puso 10 puntos arriba: cruza');
  const libres = [{ id: 'A', scoreActual: 60 }, { id: 'B', scoreActual: 59 }];
  assert.deepEqual(curvaSinPisarFijadas(libres, { A: 58, B: 61 }), { A: 58, B: 61 });
});

test('«Re-puntuar todo» usa la regla y deja las fijadas afuera de lo que devuelve', () => {
  const src = readFileSync(join(__dirname, '..', 'lib', 'mako-guardian.ts'), 'utf8');
  const cuerpo = src.slice(src.indexOf('export async function puntuarPlan'), src.indexOf('GUARDIAN_NUEVAS_JSON_SHAPE'));
  assert.match(cuerpo, /curvaSinPisarFijadas\(tareas, curveTaskScores\(/);
  assert.match(cuerpo, /tareasCurvadas\.filter\(\(t\) => !fijadas\.has\(t\.id\)\)/);
});
