// =============================================================================
// Que MaKo acuse recibo: reacciones a stickers, emojis y peticiones
// =============================================================================
// Pedido del dueño (25/8/2026), en dos partes:
//   1. «Que SIEMPRE reaccione con risa o corazón a los stickers, emojis o gifs.
//      Corazón si amerita, como un sticker de gracias, y risa para todo el resto».
//   2. «Que también reaccione con un Like pulgar arriba a todas las peticiones,
//      para afirmar que la recibió».
//
// Hasta hoy un sticker caía en el skip de «sin texto ni audio ni adjunto» y MaKo
// no hacía NADA — indistinguible de estar caída, que es la sensación que este
// cliente ya tuvo tres veces esta semana.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reaccionPara, esSoloEmoji, EMOJI_RISA, EMOJI_CORAZON, EMOJI_RECIBIDO } from '../lib/reaccion-emoji';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8');

test('Corazón cuando amerita: agradecer, celebrar, querer', () => {
  for (const p of ['❤️', '🙏', '🥰', '😍', '👏', '🎉', 'gracias!', 'muchas gracias', 'sos un crack', 'GRACIAS MaKo']) {
    assert.equal(reaccionPara(p), EMOJI_CORAZON, p);
  }
});

test('Risa para todo el resto, y para lo que no se sabe', () => {
  for (const p of ['😂', '🤣', '😎', '🔥', '👀', '', null, undefined]) {
    assert.equal(reaccionPara(p), EMOJI_RISA, String(p));
  }
});

test('⚠️ Reírse de un «gracias» queda como burla', () => {
  // Es el único error caro de esta feature: el default es risa, así que la lista
  // del corazón se mira PRIMERO.
  assert.notEqual(reaccionPara('gracias!'), EMOJI_RISA);
  assert.notEqual(reaccionPara('🙏'), EMOJI_RISA);
});

test('«Solo emoji» es solo emoji, no un mensaje con emojis', () => {
  assert.ok(esSoloEmoji('😂'));
  assert.ok(esSoloEmoji('😂😂😂'));
  assert.ok(esSoloEmoji(' ❤️ '));
  // Con palabras es un MENSAJE: se contesta, no se reacciona y listo.
  assert.ok(!esSoloEmoji('jaja 😂'));
  assert.ok(!esSoloEmoji('dale 👍 lo miro'));
  assert.ok(!esSoloEmoji(''));
  // Y un párrafo largo lleno de emojis tampoco es un emoji suelto.
  assert.ok(!esSoloEmoji('🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉'));
});

test('La reacción va ANTES del skip que se comía los stickers', () => {
  const src = leer('../lib/mako-doer-in.ts');
  const iReaccion = src.indexOf('reaccionarMensaje(jid, data.key, reaccionPara(pista))');
  const iSkip = src.indexOf("skip: 'sin texto ni audio ni adjunto'");
  assert.ok(iReaccion > 0, 'se perdió la reacción a stickers');
  assert.ok(iReaccion < iSkip,
    'la reacción quedó DESPUÉS del skip: el sticker vuelve a morir sin que MaKo haga nada');
});

test('El 👍 acusa recibo de toda petición', () => {
  const src = leer('../lib/mako-doer-in.ts');
  assert.match(src, /reaccionarMensaje\(jid, data\.key, EMOJI_RECIBIDO\)/,
    'se perdió el acuse de recibo');
  assert.equal(EMOJI_RECIBIDO, '👍');
  // Best-effort: fallar en el acuse no puede costar la respuesta.
  assert.match(src, /void reaccionarMensaje\(jid, data\.key, EMOJI_RECIBIDO\)\.catch/,
    'el acuse dejó de ser best-effort: una reacción caída frenaría el turno');
});

test('Detecta sticker, gif y emoji suelto', () => {
  const src = leer('../lib/mako-doer-in.ts');
  assert.match(src, /stickerMessage/, 'no detecta stickers');
  assert.match(src, /gifPlayback/, 'no detecta gifs');
  assert.match(src, /esSoloEmoji\(texto\)/, 'no detecta emojis sueltos');
});
