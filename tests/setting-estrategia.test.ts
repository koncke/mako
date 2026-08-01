import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEstrategia } from '../lib/setting-estrategia';

test('estrategia: null/basura/objetivo inválido → null', () => {
  assert.equal(parseEstrategia(null), null);
  assert.equal(parseEstrategia('x'), null);
  assert.equal(parseEstrategia([]), null);
  assert.equal(parseEstrategia({ objetivo: 'inventado' }), null);
});

test('estrategia: shape completa pasa y normaliza', () => {
  const e = parseEstrategia({
    objetivo: 'reactivar', gancho: '  guía PDF ', preguntas: ['¿Facturás +100k?', 42, '  '],
    lead_magnet_id: '7', notas: null, probada_at: null,
  });
  assert.equal(e?.objetivo, 'reactivar');
  assert.equal(e?.gancho, 'guía PDF');
  assert.deepEqual(e?.preguntas, ['¿Facturás +100k?']); // no-strings y vacíos afuera
  assert.equal(e?.lead_magnet_id, '7');                  // id del Entregable (string, tolera número)
});

test('estrategia: parciales rellenan defaults (modo = asistido)', () => {
  const e = parseEstrategia({ objetivo: 'agendar' });
  assert.deepEqual(e, { objetivo: 'agendar', gancho: null, lead_magnet_id: null, preguntas: [], modo: 'asistido', notas: null, probada_at: null });
});

test('estrategia: modo automatico se respeta, basura cae a asistido', () => {
  assert.equal(parseEstrategia({ objetivo: 'agendar', modo: 'automatico' })?.modo, 'automatico');
  assert.equal(parseEstrategia({ objetivo: 'agendar', modo: 'lo-que-sea' })?.modo, 'asistido');
});
