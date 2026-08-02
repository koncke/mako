import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEstrategia } from '../lib/setting-estrategia';

test('estrategia: null/basura/sin objetivo → null', () => {
  assert.equal(parseEstrategia(null), null);
  assert.equal(parseEstrategia('x'), null);
  assert.equal(parseEstrategia([]), null);
  assert.equal(parseEstrategia({ gancho: 'algo' }), null);
  assert.equal(parseEstrategia({ objetivo: '   ' }), null);
});

test('estrategia: un objetivo ESCRITO por el dueño no anula el resto', () => {
  // Antes cualquier objetivo fuera del catálogo devolvía null y se perdía la
  // estrategia entera, así que la opción "Otro" del wizard era irrepresentable.
  const e = parseEstrategia({ objetivo: 'Que vuelva a abrir el chat', gancho: 'audio corto' });
  assert.equal(e?.objetivo, 'Que vuelva a abrir el chat');
  assert.equal(e?.gancho, 'audio corto');
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

test('estrategia: parciales rellenan defaults (modo = asistido, criterio vacío)', () => {
  const e = parseEstrategia({ objetivo: 'agendar' });
  assert.deepEqual(e, {
    objetivo: 'agendar', gancho: null, lead_magnet_id: null, usa_lead_magnet: false, preguntas: [],
    criterio: { califica: [], descalifica: [] }, escenarios: [],
    desenlace: { logrado: 'respondio', logradoEtapa: null, falloDias: 0, falloEtapa: null },
    modo: 'asistido', notas: null, probada_at: null,
  });
});

/**
 * `parseEstrategia` corre en el POST ANTES de guardar y reconstruye el objeto
 * campo por campo: un campo que el parser no nombre se pierde EN SILENCIO en el
 * viaje de ida. Ya pasó al sumar campos en dos tandas; este test hace que la
 * próxima vez falle acá y no en producción.
 */
test('estrategia: el round-trip no pierde ningún campo', () => {
  const completa = {
    objetivo: 'reactivar', gancho: 'Guía de 5 pasos', lead_magnet_id: 'lm-7', usa_lead_magnet: true,
    preguntas: ['¿Cuántas personas tienes en el equipo?'],
    criterio: { califica: ['más de 5 empleados'], descalifica: ['todavía no factura'] },
    escenarios: [{ titulo: 'Pregunta el precio', cuando: 'pide el precio de una', comoResponder: 'devolver una pregunta antes de la cifra' }],
    desenlace: { logrado: 'agendo', logradoEtapa: 'agenda', falloDias: 14, falloEtapa: 'reactivacion' },
    modo: 'automatico', notas: 'nota', probada_at: '2026-08-02T10:00:00.000Z',
  };
  const ida = parseEstrategia(completa);
  assert.deepEqual(ida, completa);
  assert.deepEqual(parseEstrategia(ida), ida); // y es idempotente
});

test('desenlace: basura cae a defaults sin romper', () => {
  const e = parseEstrategia({ objetivo: 'agendar', desenlace: { logrado: 'inventado', falloDias: -5, logradoEtapa: '   ' } });
  assert.equal(e?.desenlace.logrado, 'respondio');
  assert.equal(e?.desenlace.falloDias, 0);
  assert.equal(e?.desenlace.logradoEtapa, null);
});

test('usa_lead_magnet: una secuencia vieja CON lead magnet se lee como que lo usa', () => {
  assert.equal(parseEstrategia({ objetivo: 'reactivar', lead_magnet_id: 'lm-3' })?.usa_lead_magnet, true);
  assert.equal(parseEstrategia({ objetivo: 'reactivar' })?.usa_lead_magnet, false);
});

test('criterio: filtra basura y conserva las reglas reales', () => {
  const e = parseEstrategia({ objetivo: 'cualificar', criterio: { califica: ['Tiene equipo', 42, '  '], descalifica: ['Recién arranca'] } });
  assert.deepEqual(e?.criterio, { califica: ['Tiene equipo'], descalifica: ['Recién arranca'] });
  // Criterio inválido → listas vacías, nunca rompe.
  assert.deepEqual(parseEstrategia({ objetivo: 'cualificar', criterio: 'nada' })?.criterio, { califica: [], descalifica: [] });
});

test('estrategia: modo automatico se respeta, basura cae a asistido', () => {
  assert.equal(parseEstrategia({ objetivo: 'agendar', modo: 'automatico' })?.modo, 'automatico');
  assert.equal(parseEstrategia({ objetivo: 'agendar', modo: 'lo-que-sea' })?.modo, 'asistido');
});
