// =============================================================================
// Mientras MaKo contesta, sólo los tres puntitos de «está escribiendo» (18/10/2026)
// =============================================================================
// Martín, probando el onboarding en el ws 3: «En lugar de "Revisando tu respuesta", sólo debería aparecer la animación de
// los ... como que está escribiendo». La burbuja de espera de ChatOffer (la usan el onboarding y la tab Offer) era
// «Revisando · tu respuesta…» con puntos de texto. Ahora son tres puntos que laten, sin texto, con el mismo movimiento que
// «Trabajando…» del Ops Center, y quietos con movimiento reducido.
//
// ROTURAS (18/10/2026, arnés romper-escribiendo.js del scratchpad; base 2 / 0): vuelve el rótulo «Revisando» → 1 / 1 · sin
// la regla de movimiento reducido → 1 / 1 · los puntos sin animación → 1 / 1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('la burbuja de espera son tres puntos, sin texto', () => {
  const chat = sinComentarios(leer('app/offer/ChatOffer.tsx'));
  const i = chat.indexOf('if (h.id === ID_ESCRIBIENDO) {');
  assert.ok(i > 0, 'no encuentro la burbuja de espera');
  const burbuja = chat.slice(i, chat.indexOf('\n    }\n', i));
  assert.match(burbuja, /<span role="status" aria-label="MaKo está escribiendo" className="of-escribiendo"><i \/><i \/><i \/><\/span>/);
  assert.doesNotMatch(burbuja, /GRAMATICA|fuente|Revisando|of-puntos/, 'volvió el texto «Revisando · tu respuesta…»');
});

test('los puntos laten, y quietos con movimiento reducido', () => {
  const css = leer('app/offer/estilos.ts');
  assert.match(css, /\.of-escribiendo i \{[^}]*animation: of-escribe 1\.2s ease-in-out infinite;/);
  assert.match(css, /@keyframes of-escribe \{/);
  const reducido = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce) {'));
  assert.match(reducido.slice(0, reducido.indexOf('\n}')), /\.of-escribiendo i \{ animation: none; opacity: \.6; \}/);
});
