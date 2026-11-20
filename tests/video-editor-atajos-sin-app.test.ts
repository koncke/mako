// =============================================================================
// Los atajos del chat del Video: apagados sólo mientras MaKo trabaja (11/11/2026; sin la app de escritorio, desde el 20/11/2026)
// =============================================================================
// El 11/11/2026 (docs/pruebas/video-produccion-11-11.md), sin la app de escritorio el chat no dejaba escribir y los atajos
// («Borra los silencios», «Quita las muletillas»…) seguían prendidos sin hacer nada: se apagaron con la frase de la caja. El
// 20/11/2026 ningún chat pide la app de escritorio (tests/app-de-escritorio-primero.test.ts): los atajos andan, y se apagan sólo
// mientras MaKo trabaja. La regla que queda de aquel día: un atajo que no puede hacer nada al tocarlo, está apagado.
//
// PROBADO ROMPIÉNDOLO (11/11/2026, cada uno dio rojo y se volvió atrás):
//   · la fila de abajo sin `disabled={atajoApagado}`: rojo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const chat = readFileSync(new URL('../app/video-editor/_opencut/chat/PanelChat.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('los atajos se apagan mientras MaKo trabaja, y no por la app de escritorio', () => {
  assert.match(chat, /const atajoApagado = hilo\.corriendo;/);
  assert.doesNotMatch(chat, /appEscritorio|porQueApagado/, 'ningún chat pide la app de escritorio');
  const botones = chat.match(/onClick=\{\(\) => sugerir\(s\)\}[^>]*>/g) ?? [];
  assert.equal(botones.length, 2, 'hay dos filas de atajos: la del chat vacío y la de debajo del hilo');
  for (const b of botones) assert.match(b, /disabled=\{atajoApagado\}/, 'un atajo que no hace nada al tocarlo');
});

test('la pregunta de MaKo anda siempre: los subtítulos corren en el navegador', () => {
  assert.match(chat, /<AperturaMako estado=\{estadoApertura\} quien=\{QUIEN\} acciones=\{\{ subtitulos: ponerSubtitulos \}\} \/>/);
});
