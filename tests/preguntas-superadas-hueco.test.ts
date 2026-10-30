// =============================================================================
// Una pregunta contestada en la app de Claude deja de verse, aunque el Runner haya estado parado (27/10/2026)
// =============================================================================
// Martín, desde el Centro (27/10 18:22): «Creo que esta pregunta era vieja, y sigue apareciendo. La respondi desde claude app, en
// ese caso ya no debe aparecer aqui en el ops center». La pregunta era el `ask` de un wrap_up del Cerebro del 26/10 («¿Reinicias
// la app de Claude para que suba el tren?»), contestada en la app el mismo día. El Runner de esa cuenta estuvo parado 27 horas, y
// al volver la vuelta subió sólo los ÚLTIMOS turnos del chat (cartero.mjs → ultimosQueEntran): la respuesta de Martín no subió
// nunca. Esto fija:
//   1. el caso: sin la respuesta de Martín, lo que el chat escribió DESPUÉS la deja atrás; su propio mensaje de cierre no;
//   2. sigue valiendo lo de antes (Martín, otro chat, una pregunta más nueva) y nada de ANTES cuenta;
//   3. las de `preguntar` no: ésas se contestan en el Ops Center o se retiran (`cartero retirar`).
//
// PROBADO ROMPIÉNDOLO (27/10/2026): ver el registro al final del archivo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MARGEN_CIERRE_WRAP_UP_MS, superarPreguntas, type PreguntaChat } from '../lib/centro-preguntas-chat';

const CEREBRO = 'local_3f1a66d3-690f-4ebc-bd98-7dcf1cf14bb8';
const pregunta = (extra: Partial<PreguntaChat> = {}): PreguntaChat => ({
  id: '0a1b2c3d-0000-4000-8000-000000000000', local: CEREBRO, pregunta: '¿Reinicias la app de Claude para que suba el tren?', contexto: null,
  opciones: [{ titulo: 'Ya la reinicié', detalle: null }, { titulo: 'Ahora no', detalle: null }], recomendada: 0, varias: false,
  at: '2026-10-26T17:40:00.000Z', respuesta: null, origen: 'wrap_up', ...extra,
});
const turno = (rol: 'yo' | 'el' | 'otro', at: string) => ({ local: CEREBRO, rol, at });

test('1. sin la respuesta de Martín (no subió), lo que el chat escribió después la deja atrás; su mensaje de cierre, no', () => {
  // La vuelta del 27/10 ~21:20: los ÚLTIMOS turnos del Cerebro, ninguno de Martín.
  const [p] = superarPreguntas([pregunta()], [turno('el', '2026-10-27T21:10:00.000Z'), turno('el', '2026-10-27T21:15:00.000Z')]);
  assert.equal(p.superada, '2026-10-27T21:10:00.000Z', 'la pregunta del 26/10 sigue en el Ops Center');
  // El mensaje de cierre del MISMO turno (segundos después del wrap_up) no la deja atrás.
  const cierre = new Date(Date.parse(pregunta().at) + 20_000).toISOString();
  assert.equal(superarPreguntas([pregunta()], [turno('el', cierre)])[0].superada, undefined, 'su propio cierre la dejó atrás');
  const justo = new Date(Date.parse(pregunta().at) + MARGEN_CIERRE_WRAP_UP_MS).toISOString();
  assert.equal(superarPreguntas([pregunta()], [turno('el', justo)])[0].superada, undefined);
});

test('2. sigue valiendo lo de antes, y nada de ANTES cuenta', () => {
  assert.equal(superarPreguntas([pregunta()], [turno('yo', '2026-10-26T17:45:00.000Z')])[0].superada, '2026-10-26T17:45:00.000Z', 'Martín en la app');
  assert.equal(superarPreguntas([pregunta()], [turno('otro', '2026-10-26T17:42:00.000Z')])[0].superada, '2026-10-26T17:42:00.000Z', 'otro chat');
  assert.equal(superarPreguntas([pregunta()], [turno('el', '2026-10-26T17:00:00.000Z'), turno('yo', '2026-10-26T17:30:00.000Z')])[0].superada, undefined, 'lo de antes');
  // Otra sesión de la cadena del mismo chat también cuenta.
  const otra = 'local_99999999-0000-4000-8000-000000000000';
  const cadena = new Map([[CEREBRO, [otra]]]);
  assert.ok(superarPreguntas([pregunta()], [{ local: otra, rol: 'el', at: '2026-10-27T21:10:00.000Z' }], cadena)[0].superada);
  // Ya contestada o ya superada, no cambia.
  const ya = pregunta({ superada: '2026-10-26T18:00:00.000Z' });
  assert.equal(superarPreguntas([ya], [turno('el', '2026-10-27T21:10:00.000Z')])[0].superada, '2026-10-26T18:00:00.000Z');
});

test('3. las de `preguntar` no: se contestan en el Ops Center, o el chat las retira', () => {
  const [p] = superarPreguntas([pregunta({ origen: undefined })], [turno('el', '2026-10-27T21:10:00.000Z')]);
  assert.equal(p.superada, undefined, 'una de preguntar se fue sola');
});

// PROBADO ROMPIÉNDOLO (27/10/2026, base 3/0): sin los turnos del chat → 1 rojo (1); sin el margen del cierre → 1 rojo (1); el
// margen contado desde el turno y no desde la pregunta (`>=`) → 1 rojo (1); los del chat también para las de preguntar → 1 rojo (3).
