// =============================================================================
// El panel de la estrella de MaKo en cada tab FLOTA, con el marco del Dashboard (25/10/2026, punto 12 de Martín)
// =============================================================================
// Martín (24/10, punto 12): «no me gusta que MaKo sea un cuadrado, cuando ya lo venimos haciendo tipo bloque flotante con
// cuadros un poco redondeados... Unifica ese diseño». El CRM lo hizo en su ficha (61f3ec828); éste es el panel COMPARTIDO de
// todas las tabs (`.ch-tab-panel`, app/_chat/chat.css), que seguía de borde a borde. Esto fija:
//   1. el marco es el de `.an` (app/dashboard/PanelAnalista.tsx): 12 px de aire, bordes de 14, el filete y LA MISMA sombra;
//   2. en el teléfono, a pantalla completa, como `.an`, y la tab sin correrse (MEDIDO en un teléfono emulado: corrida, la
//      página scrolleaba de costado y el panel medía 630 px en una pantalla de 390);
//   3. la tab le deja el panel MÁS su aire (si no, el contenido queda 12 px debajo del panel).
//
// PROBADO ROMPIÉNDOLO (25/10/2026, base 3/0): la sombra vieja → 1 rojo (1); sin el bloque del teléfono → 1 rojo (2); la tab
// corriéndose en el teléfono → 1 rojo (2); la tab dejándole sólo el ancho del panel → 1 rojo (3).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');
const leer = (p: string) => readFileSync(join(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');
/** Las declaraciones de la PRIMERA regla `sel {…}` del texto, como mapa propiedad → valor. */
function regla(css: string, sel: string): Map<string, string> {
  const i = css.indexOf(`${sel} {`);
  assert.ok(i >= 0, `no está la regla ${sel}`);
  const cuerpo = css.slice(css.indexOf('{', i) + 1, css.indexOf('}', i)).replace(/\/\*[\s\S]*?\*\//g, '');
  return new Map(cuerpo.split(';').map((d) => d.trim()).filter(Boolean).map((d) => [d.slice(0, d.indexOf(':')).trim(), d.slice(d.indexOf(':') + 1).trim()]));
}

const chat = leer('app/_chat/chat.css');
const an = regla(leer('app/dashboard/PanelAnalista.tsx'), '.an');
const panel = regla(chat, '.ch-tab-panel');

test('1. el marco es el del panel de MaKo del Dashboard: aire de 12, bordes de 14, el filete y la misma sombra', () => {
  for (const p of ['border', 'border-radius', 'box-shadow', 'background']) assert.equal(panel.get(p), an.get(p), `${p} distinto del Dashboard`);
  assert.equal(panel.get('top'), 'calc(var(--barra-agencia, 0px) + 12px)');
  assert.equal(panel.get('bottom'), an.get('bottom'));
  assert.equal(panel.get('margin-left'), '12px', 'el aire con la barra');
  assert.equal(panel.get('overflow'), 'hidden', 'sin esto, la cabecera tapa las esquinas redondeadas');
  assert.equal(panel.get('border-right'), undefined, 'la raya de borde a borde volvió');
});

test('2. en el teléfono, a pantalla completa, como el del Dashboard, y la tab sin correrse', () => {
  const m = /@media \(max-width: 760px\) \{\s*html \{ --ancho-panel-mako: 0px !important; \}\s*\.ch-tab-panel \{([^}]*)\}/.exec(chat);
  assert.ok(m, 'falta el bloque del teléfono, o la tab se corre (la página scrollea de costado y el panel se estira con ella)');
  assert.match(m[1], /left: 0 !important;/, 'el `left` en línea (el borde de la barra) le ganaría');
  for (const d of ['bottom: 0;', 'margin: 0;', 'border: none;', 'border-radius: 0;', 'box-shadow: none;']) assert.ok(m[1].includes(d), `falta «${d}»`);
});

test('3. la tab le deja el panel MÁS su aire a los dos lados', () => {
  const t = leer('app/_chat/MakoEnLaTab.tsx');
  const num = (n: string) => Number(new RegExp(`const ${n} = (\\d+);`).exec(t)?.[1]);
  assert.equal(num('ANCHO_PANEL'), 440);
  assert.match(panel.get('width') ?? '', /^min\(440px, /, 'el ancho del CSS y ANCHO_PANEL no coinciden');
  assert.equal(`${num('AIRE_PANEL')}px`, panel.get('margin-left'), 'el aire del CSS y AIRE_PANEL no coinciden');
  assert.match(t, /const LUGAR_PANEL = ANCHO_PANEL \+ 2 \* AIRE_PANEL;/);
  assert.match(t, /raiz\.setProperty\('--ancho-panel-mako', abierto \? `\$\{LUGAR_PANEL\}px` : '0px'\);/);
});
