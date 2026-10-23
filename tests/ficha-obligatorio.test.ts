// =============================================================================
// «Obligatorio» en la barra de cada bloque: decide qué entra en «datos sin marcar», DATO POR DATO
// =============================================================================
// Feedback de Martín del 16/10/2026 (punto 4.6 del CRM): «"Avisos de datos sin marcar" no debería ser una sección con
// botones de "on-off" si hoy en día clickeo en cada bloque ahí debería haber una opción de "Obligatorio" y que eso sea
// lo que hace ese dato que ingrese a "datos sin marcar"». La barra del bloque (app/crm/lead-view/ficha/Armador.tsx)
// prende o apaga el aviso (`op: 'aviso'`, por funnel) de los datos que el bloque dibuja (`cubreDe`).
//
// ⚠️ REESCRITO EL 23/10/2026. Hasta ahí un toque movía TODOS los datos del bloque juntos (`cubre.every(...)`), y la
// empresa era obligatoria por venir en el contacto con el teléfono. Martín: «en todos me dice "empresa obligatorio"
// porque está dentro de un bloque que tiene 3 datos, y no se puede personalizar... me obligas a hacer obligatorio un
// dato que no quería que lo fuera». Ahora: un dato, su botón; varios, «Obligatorio ▾» uno por uno; y un bloque que elige
// sus datos, «Datos ▾» (qué va adentro y qué se pide).
//
// Correr: node --import tsx --test tests/ficha-obligatorio.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (23/10/2026, base 3/0): volver a mandar el aviso de TODOS los datos del bloque juntos → 2 / 1;
// `cubreDe` sin el puesto (el contacto sin la empresa la seguía ofreciendo) → 2 / 1; la ficha sin pasarle `avisaDe` al
// armador → 2 / 1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '');
const armador = leer('app/crm/lead-view/ficha/Armador.tsx');
const ficha = leer('app/crm/lead-view/ficha/FichaPorBloques.tsx');

test('la barra del bloque: los datos que el bloque PUESTO dibuja (sin lo que su hoja puso aparte), sin la asistencia', () => {
  assert.match(armador, /const cubreTodo = avisaDe \? cubreDe\(b\.def, b\.reglas, \{ puesto: b\.puesto, hermanos \}\) : \[\];/);
  assert.match(armador, /const cubre = cubreTodo\.filter\(\(p\) => !NO_IGNORABLES\.has\(p\)\);/);
});

test('«Obligatorio» es de UN dato: ningún toque manda el aviso de varios a la vez', () => {
  // Un solo dato: su botón. Varios: el menú, con un renglón por dato. El contacto y el setter: «Datos ▾».
  assert.match(armador, /const pedir = \(p: StepId, avisa: boolean\) => onCambio\(\{ op: 'aviso', paso: p, avisa \}\);/);
  assert.match(armador, /onClick=\{\(\) => pedir\(unSolo, !avisaDe!\(unSolo\)\)\}/);
  assert.match(armador, /\{cubre\.map\(\(p\) => \(\s*<button key=\{p\}[^]*?onClick=\{\(\) => pedir\(p, !avisaDe!\(p\)\)\}/);
  assert.match(armador, /onClick=\{\(\) => pedir\(t\.aviso!, !ob\)\}/);
  // Nada recorre una lista mandando avisos: eso era «todos juntos».
  assert.doesNotMatch(armador, /for \(const p of cubre\)[^\n]*op: 'aviso'/);
  assert.doesNotMatch(armador, /cubre\.every\(/);
});

test('la ficha le dice al armador qué avisa en este funnel (la misma lectura que la barra lateral)', () => {
  assert.match(ficha, /avisaDe=\{\(p\) => efectiva\.avisos\.find\(\(a\) => a\.id === p\)\?\.avisa \?\? true\}/);
});
