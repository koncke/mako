// =============================================================================
// Los atajos del chat del Video, apagados (y diciendo por qué) mientras falte la app de escritorio (11/11/2026)
// =============================================================================
// Probado en producción el 11/11/2026 (docs/pruebas/video-produccion-11-11.md): sin la app de escritorio de MaKo, el chat
// no deja escribir (la regla de Martín del 25/10: app/_chat/useAppDeEscritorio.tsx), pero los atajos («Borra los
// silencios», «Quita las muletillas»…) seguían prendidos: al tocarlos, `enviar` cortaba adentro y no pasaba NADA, sin una
// palabra. Ahora se apagan con la misma frase que la caja. La pregunta de MaKo («¿Lo van a ver sin sonido?») NO se apaga:
// corre los subtítulos en el navegador, sin la IA.
//
// PROBADO ROMPIÉNDOLO (11/11/2026, cada uno dio rojo y se volvió atrás):
//   · `atajoApagado = hilo.corriendo` (sin la app): rojo;
//   · la fila de abajo sin `disabled={atajoApagado}`: rojo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const chat = readFileSync(new URL('../app/video-editor/_opencut/chat/PanelChat.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('sin la app de escritorio, los atajos se apagan y dicen por qué', () => {
  assert.match(chat, /const atajoApagado = hilo\.corriendo \|\| appEscritorio\.bloqueada;/);
  assert.match(chat, /const porQueApagado = appEscritorio\.bloqueada \? appEscritorio\.bloqueo\?\.frase : undefined;/);
  const botones = chat.match(/onClick=\{\(\) => sugerir\(s\)\}[^>]*>/g) ?? [];
  assert.equal(botones.length, 2, 'hay dos filas de atajos: la del chat vacío y la de debajo del hilo');
  for (const b of botones) {
    assert.match(b, /disabled=\{atajoApagado\}/, 'un atajo que no hace nada al tocarlo');
    assert.match(b, /title=\{porQueApagado\}/);
  }
});

test('la pregunta de MaKo sigue andando sin la app: los subtítulos corren en el navegador', () => {
  assert.match(chat, /<AperturaMako estado=\{estadoApertura\} quien=\{QUIEN\} acciones=\{\{ subtitulos: ponerSubtitulos \}\} \/>/);
  const poner = chat.slice(chat.indexOf('const ponerSubtitulos = () => {'), chat.indexOf('const atajoApagado'));
  assert.doesNotMatch(poner, /appEscritorio/, 'los subtítulos no dependen de la app de escritorio');
});
