// El hito que evita repetirle a un lead un trabajo que ya se hizo.
//
// El caso que protege, con las palabras del dueño: la reactivación despierta a
// alguien que hace meses YA se cualificó; encadenar a «Cualificación» sin mirar
// esto le hace repetir preguntas que ya contestó, y el lead lo lee como que
// nadie le prestó atención.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hitoYaHecho } from '../lib/setting-estrategia';

test('cualificar: ya calificado → el hito está hecho', () => {
  assert.equal(hitoYaHecho('cualificar', { calificado: true }), true);
});

test('cualificar: DESCALIFICADO también es un hito hecho', () => {
  // «No califica» es una respuesta, no un hueco. Volver a cualificarlo sería
  // no haber escuchado la primera vez.
  assert.equal(hitoYaHecho('cualificar', { calificado: false }), true);
});

test('cualificar: sin dato todavía no está hecho', () => {
  assert.equal(hitoYaHecho('cualificar', { calificado: null }), false);
  assert.equal(hitoYaHecho('cualificar', {}), false);
});

test('agendar: cualquiera de las tres marcas de reunión cuenta', () => {
  assert.equal(hitoYaHecho('agendar', { fecha_junta_1: '2026-08-10' }), true);
  assert.equal(hitoYaHecho('agendar', { junta_1_at: '2026-08-10T10:00:00Z' }), true);
  assert.equal(hitoYaHecho('agendar', { fecha_agenda: '2026-08-10' }), true);
  assert.equal(hitoYaHecho('agendar', {}), false);
});

test('confirmar_pago: pagó o cerró', () => {
  assert.equal(hitoYaHecho('confirmar_pago', { fecha_primer_pago: '2026-08-01' }), true);
  assert.equal(hitoYaHecho('confirmar_pago', { cerro: true }), true);
  assert.equal(hitoYaHecho('confirmar_pago', { cerro: false }), false);
});

test('los objetivos sin dato en el CRM devuelven null, no false', () => {
  // null = "no se puede saber". Es distinto de "no está hecho", y quien
  // encadena solo saltea con `=== true`: ante la duda se corre la secuencia,
  // porque perderse una es peor que repetirla.
  assert.equal(hitoYaHecho('reactivar', { calificado: true }), null);
  assert.equal(hitoYaHecho('preparar', {}), null);
  assert.equal(hitoYaHecho('lo que el dueño escribió con Otro', {}), null);
});
