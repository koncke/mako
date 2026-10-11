// =============================================================================
// El lienzo se arrastra también con el botón del MEDIO (app/_components/Lienzo.tsx)
// =============================================================================
// Martín, 10/10/2026 (novena tanda): «También debería poder arrastrar el lienzo si mantengo apretado la tuerca de
// scroll del ratón». El derecho ya paneaba y el izquierdo hace el lazo.
//
// Se fija la forma, leyendo el fuente (un gesto con captura de puntero no se puede ejecutar en node):
//   · el `pointerdown` del botón 1 arma un PANEO, captura el puntero y sale ANTES del `if (e.button !== 0) return`;
//   · el `pointerup` de ese gesto sale ANTES del lazo y del «clic quieto» (que cerraba el panel abierto);
//   · la caja frena el auto-scroll del navegador en `mousedown` y el `auxclick`.
//
// PROBADO ROMPIÉNDOLO (10/10/2026, base en verde: 0 fallos, 3 pases; restaurado de memoria):
//   R1  sin la rama del botón 1 en el pointerdown          → 1 fallo
//   R2  el pointerup del medio sigue de largo               → 1 fallo
//   R3  sin el preventDefault del mousedown                 → 1 fallo

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SRC = readFileSync(new URL('../app/_components/Lienzo.tsx', import.meta.url), 'utf8')
  .replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '');

function bloque(desde: string, hasta: string): string {
  const i = SRC.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde}»`);
  const j = SRC.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no encontré «${hasta}»`);
  return SRC.slice(i, j);
}

test('el pointerdown del botón del medio arma un paneo y sale antes del filtro del izquierdo', () => {
  const down = bloque('function onPointerDown', 'function onPointerMove');
  const iMedio = down.indexOf('if (e.button === 1) {');
  const iSoloIzq = down.indexOf('if (e.button !== 0) return;');
  assert.ok(iMedio > 0 && iMedio < iSoloIzq, 'el botón del medio no tiene su rama antes del filtro');
  const rama = down.slice(iMedio, iSoloIzq);
  assert.match(rama, /modo: 'pan'/);
  assert.match(rama, /medio: true/);
  assert.match(rama, /setPointerCapture/);
  assert.match(rama, /return;/);
});

test('al soltar, el del medio sale antes del lazo y del clic quieto (no cierra el panel)', () => {
  const up = bloque('function onPointerUp', "if (g.arrastrandoNodo && g.nodo) soltarArrastre");
  const iMedio = up.indexOf('if (g.medio) {');
  assert.ok(iMedio > 0, 'el pointerup no distingue el botón del medio');
  assert.ok(iMedio < up.indexOf("if (g.modo === 'lazo')"), 'el del medio llega al lazo');
  assert.ok(iMedio < up.indexOf('onSeleccion('), 'el del medio llega al clic quieto');
});

test('la caja frena el auto-scroll del navegador con el botón del medio', () => {
  assert.match(SRC, /onMouseDown=\{\(e\) => \{ if \(e\.button === 1\) e\.preventDefault\(\); \}\}/);
  assert.match(SRC, /onAuxClick=\{\(e\) => \{ if \(e\.button === 1\) e\.preventDefault\(\); \}\}/);
});
