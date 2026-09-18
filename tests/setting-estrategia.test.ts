import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEstrategia, dentroDeAntiguedad } from '../lib/setting-estrategia';

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
    desenlace: { logrado: 'respondio', logradoEtapa: null, logradoSecuencia: null, falloHoras: 0, falloEtapa: null, falloSecuencia: null },
    modo: 'asistido', envio_automatico: false, antiguedad_max_horas: null, notas: null, probada_at: null,
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
    desenlace: { logrado: 'agendo', logradoEtapa: 'agenda', logradoSecuencia: 'chat-agent-cualificacion', falloHoras: 72, falloEtapa: 'reactivacion', falloSecuencia: 'chat-agent-seguimiento' },
    modo: 'automatico', envio_automatico: true, antiguedad_max_horas: 48, notas: 'nota', probada_at: '2026-08-02T10:00:00.000Z',
  };
  const ida = parseEstrategia(completa);
  assert.deepEqual(ida, completa);
  assert.deepEqual(parseEstrategia(ida), ida); // y es idempotente
});

test('envio_automatico: solo un true literal lo prende', () => {
  // Decide si a un lead que no pagó le sale un mensaje solo. No se adivina: un
  // «"true"» o un 1 que llegue de un JSON mal armado no puede mandar mensajes.
  // Probado rompiéndolo: con `!!r.envio_automatico` en el parser, este test cae
  // (12 pasan / 1 falla); con `=== true`, 13/13.
  for (const v of ['true', 1, 'si', {}, null, undefined]) {
    assert.equal(parseEstrategia({ objetivo: 'agendar', envio_automatico: v })?.envio_automatico, false, String(v));
  }
  assert.equal(parseEstrategia({ objetivo: 'agendar', envio_automatico: true })?.envio_automatico, true);
  // Una secuencia guardada antes de que el campo existiera sigue como estaba.
  assert.equal(parseEstrategia({ objetivo: 'agendar' })?.envio_automatico, false);
});

test('antiguedad_max_horas: solo un número positivo es un tope', () => {
  // Un 0 o un negativo no pueden leerse como «nadie entra» ni como «entran
  // todos»: son un dato roto y vuelven a la ventana general del motor.
  // Probado rompiéndolo: con el parser aceptando cualquier `number`, cae este
  // test (14 pasan / 1 falla); como está, 15/15.
  for (const v of [0, -5, '48', NaN, Infinity, null, undefined, {}]) {
    assert.equal(parseEstrategia({ objetivo: 'agendar', antiguedad_max_horas: v })?.antiguedad_max_horas, null, String(v));
  }
  assert.equal(parseEstrategia({ objetivo: 'agendar', antiguedad_max_horas: 48 })?.antiguedad_max_horas, 48);
});

test('dentroDeAntiguedad: el tope deja afuera al acumulado, no al que acaba de llegar', () => {
  const ahoraMs = Date.parse('2026-09-17T22:00:00.000Z');
  const hace = (h: number) => new Date(ahoraMs - h * 3_600_000).toISOString();
  // El caso que lo motivó: la bienvenida de ws1 con 126 leads acumulados.
  assert.equal(dentroDeAntiguedad({ maxHoras: 48, createdAt: hace(1), ahoraMs }), true, 'recién llegado');
  assert.equal(dentroDeAntiguedad({ maxHoras: 48, createdAt: hace(48), ahoraMs }), true, 'justo en el borde');
  assert.equal(dentroDeAntiguedad({ maxHoras: 48, createdAt: hace(49), ahoraMs }), false, 'pasado el tope');
  assert.equal(dentroDeAntiguedad({ maxHoras: 48, createdAt: hace(24 * 20), ahoraMs }), false, 'de hace 20 días');
  // Sin tope propio, todos (la ventana general ya la aplicó la cohorte).
  assert.equal(dentroDeAntiguedad({ maxHoras: null, createdAt: hace(24 * 20), ahoraMs }), true);
  assert.equal(dentroDeAntiguedad({ maxHoras: null, createdAt: null, ahoraMs }), true);
  // Con tope y sin fecha legible, NO: ante la duda no se le escribe.
  // Probado rompiéndolo: devolviendo `true` sin fecha, cae este test (14/1).
  assert.equal(dentroDeAntiguedad({ maxHoras: 48, createdAt: null, ahoraMs }), false);
  assert.equal(dentroDeAntiguedad({ maxHoras: 48, createdAt: 'ayer', ahoraMs }), false);
});

test('desenlace: basura cae a defaults sin romper', () => {
  const e = parseEstrategia({ objetivo: 'agendar', desenlace: { logrado: 'inventado', falloHoras: -5, logradoEtapa: '   ' } });
  assert.equal(e?.desenlace.logrado, 'respondio');
  assert.equal(e?.desenlace.falloHoras, 0);
  assert.equal(e?.desenlace.logradoEtapa, null);
  assert.equal(e?.desenlace.logradoSecuencia, null);
});

/**
 * El campo pasó de días a horas. Una secuencia guardada ANTES trae `falloDias`
 * y no `falloHoras`: si el parser no lo convirtiera, volvería a "nunca falla" en
 * silencio y esa secuencia dejaría de cerrarse sola para siempre.
 */
test('desenlace: los días viejos se leen como horas', () => {
  const e = parseEstrategia({ objetivo: 'reactivar', desenlace: { falloDias: 14 } });
  assert.equal(e?.desenlace.falloHoras, 14 * 24);
});

test('desenlace: si vienen los dos, manda el nuevo', () => {
  const e = parseEstrategia({ objetivo: 'reactivar', desenlace: { falloDias: 30, falloHoras: 6 } });
  assert.equal(e?.desenlace.falloHoras, 6);
});

test('desenlace: el tope sigue siendo un año, ahora en horas', () => {
  const e = parseEstrategia({ objetivo: 'reactivar', desenlace: { falloHoras: 99999 } });
  assert.equal(e?.desenlace.falloHoras, 365 * 24);
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
