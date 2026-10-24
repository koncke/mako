// =============================================================================
// La casilla de una tarjeta del CRM no ocupa lugar hasta el hover
// =============================================================================
// «Los nombres no deben estar desplazados por default, solo cuando paso el cursor se
// debe desplazar» (05/10/2026). Medido en Chromium y WebKit con la regla real de
// globals.css: el nombre queda a 0 px en reposo y a 23 px con hover o marcada.
//
// Las dos formas en que esto se rompe NO dan error: dejan el nombre corrido por defecto,
// que se ve como un detalle de diseño y no como un bug.
//   · Un `width` en el style INLINE de la casilla le gana a la clase y la deja siempre
//     ancha — con la opacidad funcionando, que es como se ve arreglado sin estarlo.
//   · Sin `margin-left: 0`, el margen que el navegador le pone a todo checkbox deja el
//     nombre corrido 4 px en Chromium y 2 px en WebKit. Eso lo encontró la medición.
//
// PROBADO ROMPIÉNDOLO: con `width: 15` devuelto al style inline, falla el primero; con el
// `margin-left: 0` borrado del CSS, falla el segundo. Sano, 2/2.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('la casilla de la tarjeta no lleva ancho en su style inline', () => {
  const src = readFileSync('app/crm/CrmBoard.tsx', 'utf8');
  const i = src.indexOf('className="mk-sel-tarjeta"');
  assert.notEqual(i, -1, 'no encuentro la casilla de la tarjeta');
  // El style de ESA casilla: el primer `style={{` después de la clase, hasta su cierre.
  const ini = src.indexOf('style={{', i);
  const fin = src.indexOf('}}', ini);
  const estilo = src.slice(ini, fin);
  assert.doesNotMatch(estilo, /\bwidth\s*:/, 'un width inline le gana a .mk-sel-tarjeta y deja el nombre corrido');
});

test('la regla arranca en ancho cero y resetea el margen del navegador', () => {
  const css = readFileSync('app/globals.css', 'utf8');
  const ini = css.indexOf('.mk-sel-tarjeta {');
  assert.notEqual(ini, -1, 'no encuentro .mk-sel-tarjeta en globals.css');
  const bloque = css.slice(ini, css.indexOf('}', ini)).replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(bloque, /width:\s*0;/);
  assert.match(bloque, /margin-left:\s*0;/, 'sin esto el margen del checkbox corre el nombre 2-4 px');
  // Y el margen que cancela el gap de la fila: sin él queda una sangría fantasma. Desde el 24/10/2026 sigue la separación
  // REAL de la fila (--tk-gap: 12 en la tarjeta del CRM, 9 en la compacta): el -8 fijo dejaba 4 px (o 1) corridos en reposo
  // (Martín, 05/10: «Los nombres no deben estar desplazados por default»). Sin la variable (el Plan), 8.
  assert.match(bloque, /margin-right:\s*calc\(-1 \* var\(--tk-gap, 8px\)\);/);
  const tk = readFileSync('app/_ui/TarjetaKanban.tsx', 'utf8');
  assert.match(tk, /\.tk-fila \{ display: flex; align-items: center; --tk-gap: 12px; gap: var\(--tk-gap\);/, 'la fila no declara su separación');
  assert.match(tk, /\.tk--compacta \.tk-fila \{ --tk-gap: 9px; \}/);
});
