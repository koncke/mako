// =============================================================================
// Lo REENVIADO es de otra persona (29/10/2026, el grupo de SuperAdmin: «Che Tincho…» era la consulta de un cliente)
// =============================================================================
// Lo que fija este archivo:
//   1. `esReenviado` (lib/doer-reenvio.ts) lee la marca de WhatsApp donde viene en el payload REAL (`mako_doer_buffer` 340 y 341: el
//      audio y la imagen que reenvió Martín traían `isForwarded` y `forwardingScore` arriba Y adentro del mensaje);
//   2. la marca va delante y una sola vez;
//   3. el cableado: el mensaje suelto y los dos lotes (el de la entrada y el del cron) la ponen. Por la entrada real, el turno que
//      corre con el texto reenviado lo lee: tests/grupo-leandro-2910.test.ts, escena `reenvio`.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { conElReenvio, esReenviado, MARCA_REENVIADO } from '../lib/doer-reenvio';

const leer = (r: string) => readFileSync(join(__dirname, '..', r), 'utf8').replace(/\r\n/g, '\n');

test('1. la marca de WhatsApp, donde viene', () => {
  // El audio reenviado (buffer 340), recortado: la marca arriba y adentro del audioMessage.
  assert.equal(esReenviado({ message: { audioMessage: { seconds: 41, contextInfo: { isForwarded: true, forwardingScore: 1 } } }, contextInfo: { isForwarded: true, forwardingScore: 1 } } as never), true);
  // Sólo adentro (la imagen, buffer 341), sólo arriba, o sólo el puntaje.
  assert.equal(esReenviado({ message: { imageMessage: { contextInfo: { isForwarded: true } } } }), true);
  assert.equal(esReenviado({ message: { conversation: 'Che Tincho' }, contextInfo: { forwardingScore: 2 } }), true);
  assert.equal(esReenviado({ message: { extendedTextMessage: { text: 'x', contextInfo: { forwardingScore: 1 } } } }), true);
  // Lo que no es un reenvío.
  assert.equal(esReenviado({ message: { conversation: 'hola' } }), false);
  assert.equal(esReenviado({ message: { conversation: 'hola' }, contextInfo: { isForwarded: false, forwardingScore: 0, stanzaId: 'X' } }), false, 'una cita no es un reenvío');
  assert.equal(esReenviado(null), false);
});

test('2. la marca va delante, una sola vez', () => {
  const t = conElReenvio('Che Tincho, le doy a conectar Facebook y no me hace nada');
  assert.ok(t.startsWith(MARCA_REENVIADO));
  assert.match(MARCA_REENVIADO, /OTRA persona.*no de quien te lo reenvía/);
  assert.equal(conElReenvio(t), t);
});

test('3. el cableado: el suelto y los dos lotes', () => {
  const doer = leer('lib/mako-doer-in.ts');
  assert.match(doer, /if \(texto && esReenviado\(data\)\) texto = conElReenvio\(texto\);/, 'el mensaje suelto');
  assert.equal(doer.split('if (t && esReenviado(p)) t = conElReenvio(t);').length - 1, 2, 'uno de los lotes no marca lo reenviado');
});
