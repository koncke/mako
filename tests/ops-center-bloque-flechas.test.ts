// =============================================================================
// El bloque de decisiones con las flechas solas y sin la ayuda debajo (22/10/2026, feedback 6 de Martín)
// =============================================================================
// Martín, con capturas: «chau "‹ Anterior" y "Siguiente ›" como texto, alcanza con las flechas. Sin pregunta antes o después, la
// flecha no está o está apagada. Fuera "Elige con 1 a 4 · con ésta salen todas"».
//   1. con varias, ‹ y › solas (con su rótulo para quien no ve), apagadas en las puntas;
//   2. sin «Elige con…», «con ésta salen todas» ni «↑↓ para moverte»; el pie sólo con el error o el botón.
//
// Correr: node --import tsx --test tests/ops-center-bloque-flechas.test.ts
// PROBADO ROMPIÉNDOLO (base 2/0), ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BloqueDePreguntas } from '../app/admin/operaciones/PreguntasDelChat';
import type { PreguntaChat } from '../lib/centro-preguntas-chat';

const q = (id: string, origen?: 'ask') => ({
  id, local: 'local_22222222-2222-4222-8222-222222222222', pregunta: `¿Pregunta ${id.slice(0, 4)}?`, contexto: null,
  opciones: [{ titulo: 'Uno', detalle: null }, { titulo: 'Dos', detalle: null }, { titulo: 'Tres', detalle: null }], recomendada: 0, varias: false,
  at: '2026-10-22T16:01:00Z', respuesta: null, ...(origen ? { origen } : {}),
}) as unknown as PreguntaChat;

test('1. con varias, ‹ y › solas, con su rótulo, y apagadas en las puntas', () => {
  const html = renderToStaticMarkup(createElement(BloqueDePreguntas, {
    chat: 'local_x', delChat: [q('aaaaaaaa-1111-4222-8333-444444444444'), q('cccccccc-1111-4222-8333-444444444444')], onResponder: async () => null,
  }));
  const flechas = [...html.matchAll(/<button type="button" class="co-chip co-preg__flechita"([^>]*)>([^<]*)<\/button>/g)].map((m) => [m[2], /disabled=""/.test(m[1]), /aria-label="([^"]+)"/.exec(m[1])?.[1]]);
  assert.deepEqual(flechas, [['‹', true, 'Anterior'], ['›', false, 'Siguiente']], 'en la primera, la de atrás apagada');
  assert.doesNotMatch(html, /‹ Anterior|Siguiente ›/, 'sin el texto');
  assert.match(html, />1 de 2</);
});

test('2. sin la ayuda debajo; el pie, sólo con el error o el botón', () => {
  const una = renderToStaticMarkup(createElement(BloqueDePreguntas, { chat: 'local_x', delChat: [q('aaaaaaaa-1111-4222-8333-444444444444')], onResponder: async () => null }));
  const dos = renderToStaticMarkup(createElement(BloqueDePreguntas, {
    chat: 'local_x', delChat: [q('aaaaaaaa-1111-4222-8333-444444444444'), q('cccccccc-1111-4222-8333-444444444444')], onResponder: async () => null,
  }));
  for (const html of [una, dos]) {
    assert.doesNotMatch(html, /Elige con|Elige una o varias|salen todas|para moverte|co-preg__ayuda/);
    assert.doesNotMatch(html, /class="co-preg__pie/, 'sin error ni botón, no hay pie');
  }
  assert.match(una, /¿Pregunta aaaa\?/, 'la pregunta sí se ve');
  // Con varias opciones a la vez, el pie lleva su botón, y nada más.
  const varias = { ...q('dddddddd-1111-4222-8333-444444444444'), varias: true } as PreguntaChat;
  const conBoton = renderToStaticMarkup(createElement(BloqueDePreguntas, { chat: 'local_x', delChat: [varias], onResponder: async () => null }));
  assert.match(conBoton, /<div class="co-preg__pie co-preg__pie--chat"><button type="button" class="co-chip co-chip--primario" disabled="">Responder<\/button><\/div>/);
});

// PROBADO ROMPIÉNDOLO (22/10/2026, base 2/0):
//   · vuelve «‹ Anterior»                               → 1/1 (1)
//   · la de atrás no se apaga en la primera              → 1/1 (1)
//   · vuelve «Elige con 1 a 4»                          → 1/1 (2)
//   · el pie vacío vuelve                                → 1/1 (2)
