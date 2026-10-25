// =============================================================================
// La estrella de MaKo de cada tab queda al lado de lo que SE VE de la barra (24/10/2026, f34 de la llamada con Leandro)
// =============================================================================
// Martín (59:33): «la animación del muñequito de Mako... cuando se va para abajo y se pone en su chat, y si está la sidebar
// desplegada, es como que se oculta detrás y no se entiende a dónde se fue». La copia que vuela (app/_ui/VueloDeCarga.tsx) va
// arriba de todo; lo que quedaba debajo era su DESTINO: la estrella (`.ch-tab-mako`, z 55) se ponía al lado del `<aside>` de la
// barra, que no cambia de ancho cuando su panel se despliega encima (z 60). Ahora se mide con el panel (`panelDeLaBarra`).
// Correr: node --import tsx --test tests/estrella-al-lado-de-la-barra.test.ts
// ROTURAS (24/10/2026, una por vez y restaurada; base 3 / 0): la estrella con el borde del `<aside>` (lo de antes) → 2 / 1;
// `panelDeLaBarra` devolviendo la barra → 2 / 1; el panel del Cerebro también con el borde que se ve → 2 / 1.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { panelDeLaBarra } from '../app/_chat/borde-barra';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');

test('se mide el panel de la barra (el que se despliega encima), no el <aside>', () => {
  const panel = { firstElementChild: null } as unknown as Element;
  const barra = { firstElementChild: panel } as unknown as Element;
  assert.equal(panelDeLaBarra(barra), panel);
  const sola = { firstElementChild: null } as unknown as Element;
  assert.equal(panelDeLaBarra(sola), sola, 'sin panel, la barra');
  assert.equal(panelDeLaBarra(null), null);
  // Y el panel ES el primer hijo de la barra, el que se despliega encima con su sombra.
  const sb = leer('app/_components/Sidebar.tsx');
  assert.match(sb, /<aside data-sidebar[^>]*>\n\s*<div\n\s*ref=\{panelRef\}/, 'el primer hijo de la barra ya no es su panel');
  assert.match(sb, /boxShadow: open && !fija \? /, 'el panel ya no se despliega encima');
});

test('la estrella usa el borde que se ve; el panel del Cerebro, el de la barra (como siempre)', () => {
  const t = leer('app/_chat/MakoEnLaTab.tsx');
  assert.match(t, /const medida = visible \? panelDeLaBarra\(barra\) : barra;/);
  assert.match(t, /const bordeVisible = useBordeDeLaBarra\(true\);/);
  assert.match(t, /className="ch-tab-mako" style=\{\{ left: bordeVisible \+ 16,/, 'la estrella quedaba debajo de la barra desplegada');
  assert.match(t, /<PanelDelCerebro tab=\{tab\} izquierda=\{borde\} /, 'el panel del Cerebro se correría al pasar el cursor por la barra');
});

test('la copia que vuela va por delante de la barra, y la estrella es uno de sus destinos', () => {
  const v = leer('app/_ui/VueloDeCarga.tsx');
  assert.match(v, /z-index:2147483000;/);
  assert.match(v, /'\.ch-tab-mako',/);
  // La barra va a z 60: la copia, por encima.
  assert.match(leer('app/_components/Sidebar.tsx'), /overflow: 'visible', zIndex: 60 \}\}>/);
});
