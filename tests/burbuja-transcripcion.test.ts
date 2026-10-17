// =============================================================================
// La transcripción de un audio se lee entera en el hilo (17/10/2026)
// =============================================================================
// docs/relevo/offer.md: «la transcripción cortada a 140 caracteres (`BurbujaHilo`, compartido)». En el chat de Offer
// (y en los hilos de MaKo) lo que el dueño dictó quedaba en 140 letras y un «…», sin forma de leer el resto. En el
// hilo ahora hay «Ver todo»; en la tarjeta del lienzo (`compacta`) sigue el recorte (ahí un clic abre el editor).
//
// PROBADO ROMPIÉNDOLO (17/10/2026): sin el botón, 1 fallo; con el botón también en la compacta, 1 fallo; el tope del
// hilo en 90, 1 fallo. Base: 2 / 0.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BurbujaHilo, TOPE_TRANSCRIPCION } from '../app/whatsapp/_shared/BurbujaHilo';

const LARGA = 'Vendo un programa de 12 semanas para dueños de negocios chicos que quieren dejar de hacer todo ellos. '.repeat(4).trim();

test('en el hilo, una transcripción larga se corta con «Ver todo»; una corta, entera y sin botón', () => {
  assert.ok(LARGA.length > TOPE_TRANSCRIPCION.hilo);
  const html = renderToStaticMarkup(createElement(BurbujaHilo, { contenido: { audio: { url: 'https://x/a.mp3', transcript: LARGA } } }));
  assert.match(html, />Ver todo<\/button>/);
  assert.match(html, /aria-expanded="false"/);
  assert.ok(html.includes(LARGA.slice(0, TOPE_TRANSCRIPCION.hilo)), 'el principio se ve');
  assert.ok(!html.includes(LARGA), 'cerrada, no la entera');
  const corta = renderToStaticMarkup(createElement(BurbujaHilo, { contenido: { audio: { url: 'https://x/a.mp3', transcript: 'Te cuento rápido' } } }));
  assert.match(corta, /Dice: «Te cuento rápido»/);
  assert.doesNotMatch(corta, /Ver todo/);
});

test('en la tarjeta del lienzo (compacta) sigue el recorte, sin botón', () => {
  const html = renderToStaticMarkup(createElement(BurbujaHilo, { compacta: true, contenido: { audio: { url: 'https://x/a.mp3', transcript: LARGA } } }));
  assert.doesNotMatch(html, /Ver todo/);
  assert.ok(html.includes(`${LARGA.slice(0, TOPE_TRANSCRIPCION.compacta)}…`));
  assert.equal(TOPE_TRANSCRIPCION.hilo, 140);
});
