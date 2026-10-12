// Las iniciales del avatar de MaKo Mobile salen sólo de LETRAS (app/m/_ui/formato.ts, `inicialesM`).
// Medido el 12/10/2026 al verificar /m a 390 px: «Dev (local)» dibujaba «D(» en el avatar de Today y de More.
// Probado rompiéndolo: sin el `replace` de lo que no es letra, falla 1 (las dos con paréntesis) y pasan 2.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inicialesM } from '../app/m/_ui/formato';

test('lo que no es letra no llega al avatar', () => {
  assert.equal(inicialesM('Dev (local)'), 'DL');
  assert.equal(inicialesM('Juan (ventas)'), 'JV');
});

test('primera y última palabra, con acentos', () => {
  assert.equal(inicialesM('Ana María Pérez'), 'AP');
  assert.equal(inicialesM('Sofía'), 'SO');
  assert.equal(inicialesM('Ñandú Ólafsson'), 'ÑÓ');
});

test('sin nombre, la inicial del email; sin nada, un punto', () => {
  assert.equal(inicialesM('', 'martin@hola-mako.com'), 'M');
  assert.equal(inicialesM(null), '·');
});
