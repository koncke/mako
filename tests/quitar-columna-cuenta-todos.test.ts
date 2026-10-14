// =============================================================================
// Quitar una columna del tablero pregunta si tiene leads, AUNQUE el filtro los esconda
// =============================================================================
// Estaba en docs/relevo/crm.md («Lo que quedó sin hacer», 12/10/2026): `quitarColumna`
// (app/crm/CrmBoard.tsx) contaba sobre `filtered`, lo que deja ver el filtro. Con un filtro
// puesto, una columna con leads escondidos daba 0 y se borraba sin el «¿seguro?».
//
// Correr: npx tsx --test tests/quitar-columna-cuenta-todos.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (13/10/2026): volver a contar sobre `filtered` → 0 pases / 1 fallo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync('app/crm/CrmBoard.tsx', 'utf8').replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '');

test('quitarColumna cuenta TODOS los leads de la columna, no los filtrados', () => {
  const i = src.indexOf('const quitarColumna = async (c: Stage) => {');
  assert.ok(i > 0, 'no encontré quitarColumna');
  const f = src.slice(i, i + 400);
  assert.match(f, /const cuantos = leads\.filter\(\(l\) => effStage\(l\) === c\.key\)\.length;/);
  assert.doesNotMatch(f, /filtered\.filter/, 'con un filtro puesto, una columna con leads escondidos se borra sin preguntar');
  assert.match(f, /if \(cuantos > 0\) \{ setBorrarEtapa/);
});
