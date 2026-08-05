// Los audios y los escenarios que dependen de que el negocio TENGA reuniones.
//
// El caso que esto protege: un negocio de venta directa (checkout, sin llamada)
// no tiene a quién mandarle un audio de "ya agendaste". Pedírselo igual dejaba el
// paso de los audios trabado en 1 de 3 para siempre, sin forma de avanzar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { audiosDe, AUDIOS_PASO } from '../lib/audios-paso';
import { escenariosDe } from '../lib/chat-agent-escenarios';

test('con funnel de reuniones se graban los 3 audios', () => {
  assert.equal(audiosDe(true).length, AUDIOS_PASO.length);
});

test('sin reuniones queda SOLO la bienvenida', () => {
  const claves = audiosDe(false).map((a) => a.clave);
  assert.deepEqual(claves, ['bienvenida']);
});

test('sin reuniones no queda ningún escenario que arranque de un audio de agenda', () => {
  const ids = escenariosDe(true, false).map((e) => e.id);
  assert.ok(ids.length > 0, 'tienen que quedar los de bienvenida');
  assert.ok(!ids.some((id) => id.startsWith('agenda_')), `quedaron escenarios de agenda: ${ids.join(', ')}`);
});

test('con reuniones los escenarios de agenda SÍ están', () => {
  const ids = escenariosDe(true, true).map((e) => e.id);
  assert.ok(ids.some((id) => id.startsWith('agenda_')));
});

test('el default de escenariosDe no cambia el comportamiento viejo', () => {
  // Un solo argumento tiene que seguir devolviendo lo de siempre: hay llamadores
  // que no saben del funnel y no pueden empezar a perder escenarios en silencio.
  assert.deepEqual(escenariosDe(true).map((e) => e.id), escenariosDe(true, true).map((e) => e.id));
});

test('el escenario del video sigue dependiendo del link', () => {
  assert.ok(!escenariosDe(false, true).some((e) => e.requiereVideo));
  assert.ok(escenariosDe(true, true).some((e) => e.requiereVideo));
});
