// =============================================================================
// tests/recorrido-plan-api — P2 y AP1 del recorrido visual del 30/10/2026 (docs/recorrido-visual-30-10.md)
// =============================================================================
//   P2 · la tarjeta del Objetivo Principal (Plan › Prioridades) se estira al alto de las tres tareas de al lado y quedaban
//        ~200 px vacíos: ahí va la razón del Perro (por qué es el norte), cortada en cinco renglones y entera en el title.
//        En la grilla de Proyectos la tarjeta no cambia.
//   AP1 · el índice de la API (y el permiso de un token) decía «Chatbot y secuencias», el nombre viejo de Automations.
//
// Probado rompiéndolo (6/11/2026), base 4 pasan / 0 fallan:
//   · ObjetivoCard sin `conRazon` ......................... 1 falla (P2)
//   · la razón también en la grilla (sin mirar conRazon) .. 1 falla (P2)
//   · la razón sin cortar en cinco renglones .............. 1 falla (P2)
//   · el título del área otra vez «Chatbot y secuencias» .. 1 falla (AP1)
//   · la ayuda de /api-mako otra vez con el nombre viejo ... 1 falla (AP1)
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RazonObjetivo } from '../app/plan/board/RazonObjetivo';
import { AREA_INFO } from '../lib/api-mako/tipos';

const RAIZ = join(import.meta.dirname, '..');
const RAZON = 'Es lo que destraba la venta de este trimestre: sin la oferta escrita no hay landing ni anuncios.';
// BoardShell no se puede importar en un test (arrastra un módulo de servidor): la razón es su pieza suelta, y quién la
// monta se mira en el fuente, sin comentarios.
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const SHELL = sinComentarios(readFileSync(join(RAIZ, 'app/plan/board/BoardShell.tsx'), 'utf8'));

test('P2: la razón del Perro se dibuja cortada en cinco renglones, entera en el title', () => {
  const html = renderToStaticMarkup(createElement(RazonObjetivo, { razon: RAZON }));
  assert.match(html, /data-razon-objetivo="true"/, 'la razón no se dibuja');
  assert.ok(html.includes(`title="${RAZON}"`), 'la razón entera no va en el title');
  assert.match(html, /-webkit-line-clamp:5/, 'la razón no se corta en cinco renglones');
});

test('P2: la pide SÓLO la tarjeta del Objetivo Principal (en la grilla la tarjeta no cambia)', () => {
  const objetivo = /function ObjetivoCard[\s\S]*?\n\}/.exec(SHELL)?.[0] ?? '';
  assert.match(objetivo, /<ProyectoCardTile [^>]*\bconRazon\b/, 'ObjetivoCard no pide la razón');
  assert.match(SHELL, /\{conRazon && !verDetalle && l\.scoreRazon && <RazonObjetivo razon=\{l\.scoreRazon\} \/>\}/, 'la razón no depende de conRazon');
  assert.equal((SHELL.match(/<ProyectoCardTile [^>]*\bconRazon\b/g) ?? []).length, 1, 'otra tarjeta además del objetivo pide la razón');
});

test('AP1: el área de Automations se llama Automations en el índice de la API y en el permiso de un token', () => {
  assert.equal(AREA_INFO.chatbot.titulo, AREA_INFO.chatbot.tab, 'el título del área no es el nombre de la tab');
  for (const [area, info] of Object.entries(AREA_INFO)) assert.doesNotMatch(info.titulo, /chatbot/i, `«${info.titulo}» (${area}) nombra la tab vieja`);
});

test('AP1: la ayuda de /api-mako no nombra el área con el nombre viejo', () => {
  const art = readFileSync(join(RAIZ, 'app/api-mako/Articulos.tsx'), 'utf8');
  assert.doesNotMatch(art, /Chatbot y secuencias/);
});
