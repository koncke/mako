// =============================================================================
// Las notas del lead, como los chats de MaKo: emojis y dictado
// =============================================================================
// Pedido de Martín (12/10/2026, tercer feedback del CRM, punto 3): «las notas como los chats de
// MaKo» — adjuntar archivos e imágenes, emojis, y el micrófono que transcribe en vez de mandar
// audio. El micrófono ya estaba (12/10, `BotonDictar`); los emojis se suman el 13/10, con el MISMO
// panel y la misma inserción en el cursor que el composer de WhatsApp. Los ADJUNTOS quedan como el
// paso siguiente (docs/relevo/crm.md): piden dónde guardar el archivo, que una nota hoy no tiene.
//
// Correr: npx tsx --test tests/notas-como-chat.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (13/10/2026): sacar el botón de emojis → 1 / 1; poner el emoji al final
// en vez de en el cursor → 1 / 1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync('app/crm/lead-view/NotasCard.tsx', 'utf8').replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '');

test('la caja de la nota tiene emojis (el panel de WhatsApp) y el micrófono', () => {
  assert.match(src, /<EmojiPicker onPick=\{ponerEmoji\}/);
  assert.match(src, /<PopoverWA ancla=\{btnEmoji\}/);
  assert.match(src, /<BotonDictar titulo="Dictar la nota"/, 'el micrófono que transcribe tiene que seguir');
});

test('el emoji va donde está el cursor y no pasa el tope de la nota', () => {
  const f = src.slice(src.indexOf('const ponerEmoji'), src.indexOf('const ponerEmoji') + 300);
  assert.match(f, /insertarEnCursor\(texto, el\?\.selectionStart, el\?\.selectionEnd, em\)/);
  assert.match(f, /if \(r\.valor\.length > TOPE_NOTA\) return;/);
});
