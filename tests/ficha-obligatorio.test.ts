// =============================================================================
// «Obligatorio» en la barra de cada bloque: decide qué entra en «datos sin marcar»
// =============================================================================
// Feedback de Martín del 16/10/2026 (punto 4.6 del CRM): «"Avisos de datos sin marcar" no debería ser una sección con
// botones de "on-off" si hoy en día clickeo en cada bloque ahí debería haber una opción de "Obligatorio" y que eso sea
// lo que hace ese dato que ingrese a "datos sin marcar"». La barra del bloque (app/crm/lead-view/ficha/Armador.tsx)
// prende o apaga el aviso (`op: 'aviso'`, por funnel) de los datos que el bloque dibuja (`cubreDe`).
//
// Correr: node --import tsx --test tests/ficha-obligatorio.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (16/10/2026, base 2/0): sin sacar la asistencia (NO_IGNORABLES) → 1 / 1; mandar el aviso de
// TODOS los datos y no sólo de los que cambian → 1 / 1; la ficha sin pasarle `avisaDe` al armador → 1 / 1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '');
const armador = leer('app/crm/lead-view/ficha/Armador.tsx');
const ficha = leer('app/crm/lead-view/ficha/FichaPorBloques.tsx');

test('la barra del bloque: «Obligatorio» mira los datos que el bloque dibuja, sin la asistencia, y los mueve juntos', () => {
  assert.match(armador, /const cubre = avisaDe \? cubreDe\(b\.def, b\.reglas\)\.filter\(\(p\) => !NO_IGNORABLES\.has\(p\)\) : \[\];/);
  assert.match(armador, /const obligatorio = cubre\.length > 0 && cubre\.every\(\(p\) => avisaDe!\(p\)\);/);
  assert.match(armador, /for \(const p of cubre\) if \(avisaDe!\(p\) === obligatorio\) onCambio\(\{ op: 'aviso', paso: p, avisa: !obligatorio \}\);/);
});

test('la ficha le dice al armador qué avisa en este funnel (la misma lectura que la barra lateral)', () => {
  assert.match(ficha, /avisaDe=\{\(p\) => efectiva\.avisos\.find\(\(a\) => a\.id === p\)\?\.avisa \?\? true\}/);
});
