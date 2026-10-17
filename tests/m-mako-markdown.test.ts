// =============================================================================
// El chat de MaKo del teléfono dibuja el MISMO markdown que escritorio (17/10/2026)
// =============================================================================
// El Second Brain del teléfono (app/m/mako/ChatMako.tsx) dibujaba sólo las **negritas** con una función propia:
// las listas de MaKo salían como «- uno - dos» en texto corrido (docs/hallazgos-mobile.md, «SIN HACER» del
// Second Brain). Escritorio (app/_chat/HiloMako.tsx) usa <Markdown>. Ahora los dos usan el mismo.
//
// Probado rompiéndolo (17/10/2026): volviendo a `conNegritas(t)` en la burbuja de MaKo, 1 pasa / 1 falla.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Markdown } from '../app/_components/Markdown';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');

test('la burbuja de MaKo del teléfono va por <Markdown>, como escritorio', () => {
  const src = leer('app/m/mako/ChatMako.tsx');
  assert.match(src, /tuyo \? t : <Markdown text=\{t\} \/>/, 'lo que dice MaKo se dibuja con <Markdown>; lo tuyo, tal cual');
  assert.doesNotMatch(src, /conNegritas\(/, 'una segunda regla de markdown se desvía de escritorio');
  assert.match(leer('app/_chat/HiloMako.tsx'), /<Markdown text=\{x\.texto\} \/>/, 'escritorio sigue usando el mismo componente');
});

test('una lista de MaKo es una lista, no texto con guiones', () => {
  const html = renderToStaticMarkup(createElement(Markdown, { text: 'Hoy:\n- Llamar a Ana\n- Mandar la propuesta\n\n**Listo**' }));
  assert.equal((html.match(/<li/g) ?? []).length, 2);
  assert.match(html, /<strong[^>]*>Listo<\/strong>/);
  assert.doesNotMatch(html, /- Llamar/);
});
