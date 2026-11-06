// =============================================================================
// tests/recorrido-chats — CH2 del recorrido visual del 30/10/2026 (docs/recorrido-visual-30-10.md)
// =============================================================================
// En /chats sin elegir una conversación había dos paneles vacíos diciendo lo mismo («Elige un chat de la lista.» y «Elige un
// chat.»), y el filtro «Etapa» caía solo a un segundo renglón en los 340 px de la lista.
//   · el panel del contacto no se dibuja sin chat (el centro ya lo dice);
//   · los filtros van en UN renglón, que se corre de costado adentro de su caja si no entran (sin recortar el nombre del
//     funnel o la etapa que eligió el negocio). Visto en un banco: docs/recorrido-visual/chats-ch2-*.png.
//
// Probado rompiéndolo (6/11/2026), base 3 pasan / 0 fallan:
//   · el panel otra vez con «Elige un chat.» (sin `|| !chat`) .. 1 falla
//   · los filtros otra vez con `flex-wrap: wrap` ............... 1 falla
//   · la fila sin `overflow-x: auto` (se saldría de la lista) .. 1 falla
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PanelContacto } from '../app/chats/PanelContacto';

const RAIZ = join(import.meta.dirname, '..');
const CSS = readFileSync(join(RAIZ, 'app/chats/chats.css'), 'utf8').replace(/\r\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '');

/** Todas las declaraciones de las reglas cuyo selector es exactamente `sel`, juntas. */
const decl = (sel: string) => [...CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) => m[1].trim() === sel).map((m) => m[2]).join(';');

test('sin chat elegido, el panel del contacto no se dibuja (aunque haya quedado abierto)', () => {
  const props = {
    ws: 3, chat: null, abierto: true, pestana: 'contacto' as const, onPestana: () => {}, onCerrar: () => {},
    etapas: [], equipo: [], version: 0, onAbrirFicha: () => {}, onCambio: () => {},
  };
  const html = renderToStaticMarkup(createElement(PanelContacto, props as never));
  assert.equal(html, '', 'sin chat dibuja un segundo vacío');
});

test('los filtros de la lista van en un renglón', () => {
  const d = decl('.rio .rio-filtros');
  assert.ok(d, 'no encontré la regla de los filtros');
  assert.doesNotMatch(d, /flex-wrap:\s*wrap/, 'los filtros vuelven a bajar de renglón');
  assert.match(d, /flex-wrap:\s*nowrap/);
});

test('si no entran, la fila se corre de costado adentro de su caja (y los chips no se achican)', () => {
  assert.match(decl('.rio .rio-filtros'), /overflow-x:\s*auto/, 'sin scroll, la fila se sale de los 340 px de la lista');
  assert.match(decl('.rio .rio-filtros > *'), /flex:\s*none/, 'un chip que se achica recorta el nombre del funnel o la etapa');
});
