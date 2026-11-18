// =============================================================================
// El «antes» de un montaje se dice ESTIMADO, como lo dice la API (F166 (c), 18/11/2026)
// =============================================================================
// El «antes» es la suma de lo que se le pidió a Flow por toma, no una medición; la API ya lo devolvía como
// `segundos_antes_estimados` y la pantalla lo dibujaba igual que el «después», que sí sale del archivo montado
// (app/video-generator/montaje-duraciones.tsx). Se dibuja la pieza REAL y se mira lo que lee la persona.
//
// Correr: node --import tsx --test tests/video-montaje-duraciones.test.ts
//
// PROBADO ROMPIÉNDOLO (18/11/2026): base 1/0 → con el «(estimado)» sacado de DuracionesMontaje, 0/1; con el «(estimado)»
// movido al lado del «después», 0/1.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DuracionesMontaje, reloj } from '@/app/video-generator/montaje-duraciones';

/** Lo que se lee, sin etiquetas. */
const texto = (html: string) => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

test('«De 1:10 (estimado) a 0:38»: el de antes rotulado, el de después (el medido) sin rótulo', () => {
  const html = renderToStaticMarkup(createElement(DuracionesMontaje, { antes: 70.04, despues: 38.4 }));
  assert.equal(texto(html), 'De 1:10 (estimado) a 0:38');
  // Y el rótulo va pegado al de ANTES: el de después es el único que se midió.
  assert.match(html, /<strong>1:10<\/strong>\s*<span[^>]*>\(estimado\)<\/span>\s*a <strong>0:38<\/strong>/);
  assert.equal(reloj(59.6), '1:00', 'el reloj redondea al segundo');
});
