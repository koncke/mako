// =============================================================================
// De qué lección habla un evento de Whop
// =============================================================================
// El webhook trae un id pelado y hay que sacarlo bien: un id equivocado marca
// completado el bloque de OTRA clase, y eso no se nota nunca — ni en un log ni
// en la pantalla.
//
// ⚠️ EL CASO QUE LO MOTIVÓ. El filtro decía `startsWith('less')` porque yo asumí
// el prefijo. El real es `lesn_`. Resultado: un payload perfectamente válido,
// firmado, del workspace correcto, contestaba «sin id de lección» — y con 200,
// así que Whop lo daba por entregado. Se descubrió mandando un evento real a
// producción con un id sacado del mapa (`lesn_NxR3LfLTx5zpH`); ningún test de
// datos inventados lo habría encontrado, porque los inventé con el prefijo
// equivocado.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leccionDelEvento, PREFIJO_LECCION } from '../lib/whop-evento';

const ID_REAL = 'lesn_NxR3LfLTx5zpH'; // sacado de la cuenta real, no inventado

test('el prefijo real de una lección es lesn_, no less_', () => {
  assert.equal(PREFIJO_LECCION, 'lesn_');
  assert.ok(ID_REAL.startsWith(PREFIJO_LECCION));
});

test('lo saca de course_lesson_id, que es como viene el evento del curso', () => {
  assert.equal(leccionDelEvento({ data: { course_lesson_id: ID_REAL } }), ID_REAL);
});

test('también de lesson_id y del objeto anidado', () => {
  assert.equal(leccionDelEvento({ data: { lesson_id: ID_REAL } }), ID_REAL);
  assert.equal(leccionDelEvento({ data: { course_lesson: { id: ID_REAL } } }), ID_REAL);
});

test('una clave explícita se toma TAL CUAL, sin adivinar el prefijo', () => {
  // Es la lección aprendida: si el campo se llama `course_lesson_id`, es el id de
  // la lección. Filtrarlo por una corazonada sobre el prefijo fue el bug.
  assert.equal(leccionDelEvento({ data: { course_lesson_id: 'loquesea_123' } }), 'loquesea_123');
});

test('un `id` pelado SÍ se filtra: en un evento de interacción es el id de la interacción', () => {
  assert.equal(leccionDelEvento({ data: { id: 'clin_algo' } }), null);
  assert.equal(leccionDelEvento({ data: { id: ID_REAL } }), ID_REAL);
});

test('las claves explícitas ganan sobre el id suelto', () => {
  assert.equal(leccionDelEvento({ data: { id: 'lesn_otra', course_lesson_id: ID_REAL } }), ID_REAL);
});

test('null antes que inventar', () => {
  assert.equal(leccionDelEvento({}), null);
  assert.equal(leccionDelEvento({ data: {} }), null);
  assert.equal(leccionDelEvento({ data: { course_lesson_id: '' } }), null);
  assert.equal(leccionDelEvento({ data: { course_lesson_id: '   ' } }), null);
  assert.equal(leccionDelEvento({ data: { course_lesson_id: 42 as unknown as string } }), null);
  assert.equal(leccionDelEvento({ data: { course_lesson: {} } }), null);
});
