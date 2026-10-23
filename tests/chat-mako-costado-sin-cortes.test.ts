// =============================================================================
// El chat de MaKo al costado del lienzo, sin cortes arriba ni abajo (23/10/2026)
// =============================================================================
// Martín, sobre /automations?sec=289 en producción a 1920 de ancho: «mirá cómo se corta el diseño del chat de MaKo al
// costado, con la criatura de MaKo y la topbar de ese chat cortado... Y abajo el lugar donde se escribe todo muy pegado al
// piso». Medido en producción (1540×732): el panel flotante medía 732 desde top 16 (bottom 748, 16 px fuera de la ventana)
// porque se llamaba `data-sidebar` y app/globals.css le pone `height: 100dvh !important` a todo `aside[data-sidebar]` (es
// la regla de la barra de la APP); y la cabecera del chat salía 4 px por encima del panel con su margen negativo.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('el panel flotante de Automations no se llama como la barra de la app (si no, la regla global le da el alto de la ventana)', () => {
  const css = leer('app/globals.css');
  assert.match(css, /aside\[data-sidebar\] \{ height: 100dvh !important; \}/, 'la regla global cambió: revisá si este test sigue midiendo lo mismo');
  const panel = leer('app/automations/SimuladorWhatsApp.tsx');
  assert.match(panel, /<aside aria-label=\{verLista \? 'Tus automatizaciones' : 'Chat con MaKo'\} data-panel-automations=\{verLista \? 'lista' : 'chat'\} style=\{\{\n\s+position: 'absolute', left: LISTA_HUECO, top: LISTA_HUECO, bottom: LISTA_HUECO,/);
  assert.doesNotMatch(panel, /<aside[^>]*data-sidebar/, 'el panel volvió a llamarse data-sidebar: la regla global lo estira 16 px por debajo de la ventana');
});

test('la cabecera del chat de MaKo tiene su relleno: sin margen negativo que la saque del panel ni la meta debajo del hilo', () => {
  const chat = leer('app/automations/ChatMako.tsx');
  const cab = /\n {2}cabecera: \{([^}]*)\},/.exec(chat)?.[1] ?? '';
  assert.ok(cab, 'no encontré el estilo de la cabecera');
  assert.doesNotMatch(cab, /margin: '-/, 'volvió el margen negativo: la cabecera sale por encima del panel');
  assert.match(cab, /padding: '10px 12px 8px', flex: 'none'/);
});
