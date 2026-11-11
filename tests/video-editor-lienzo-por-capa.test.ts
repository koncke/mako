// =============================================================================
// Un lienzo por textura que se redibuja, en vez de uno nuevo por cada cuadro de video (11/11/2026)
// =============================================================================
// Medido el 11/11/2026 (docs/editor-video/memoria-del-editor.md §4, banco scripts/banco-memoria-editor/): el compositor
// copiaba cada cuadro de video a un OffscreenCanvas NUEVO antes de subirlo al WASM. En 4K eran 1 GB/s de lienzos tirados
// y el pico de la GPU pasaba de +529 a +762 MB. Fija compositor/lienzo-de-subida.ts y que wasm-compositor.ts le pase el
// lienzo del cuadro anterior de esa textura.
//
// PROBADO ROMPIÉNDOLO (11/11/2026, cada uno dio rojo y se volvió atrás):
//   · `new OffscreenCanvas` siempre (sin mirar `previo`): rojo el de reusar;
//   · reusar sin mirar el tamaño: rojo el del tamaño;
//   · en el compositor, `previo: undefined`: rojo el del cableado;
//   · guardar siempre `lienzo: subida` (también uno ajeno): rojo el del cableado.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (ruta: string) => readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

// Un OffscreenCanvas de mentira: cuenta cuántos se crean y qué se dibuja en cada uno.
let creados = 0;
class LienzoFalso {
  dibujos: unknown[] = [];
  constructor(public width: number, public height: number) {
    creados++;
  }
  getContext() {
    return { clearRect: () => {}, drawImage: (s: unknown) => this.dibujos.push(s) };
  }
}
const g = globalThis as { OffscreenCanvas?: unknown };
let original: unknown;
before(() => {
  original = g.OffscreenCanvas;
  g.OffscreenCanvas = LienzoFalso;
});
after(() => {
  g.OffscreenCanvas = original;
});

const cargar = () => import('../app/video-editor/_opencut/services/renderer/compositor/lienzo-de-subida');
const cuadro = (n: number) => ({ cuadro: n }) as unknown as CanvasImageSource;

test('cuadro a cuadro, la misma textura redibuja SU lienzo: uno solo para todo el clip', async () => {
  const { lienzoDeSubida } = await cargar();
  creados = 0;
  let previo: OffscreenCanvas | undefined;
  for (let n = 0; n < 30; n++) {
    const l = lienzoDeSubida({ source: cuadro(n), width: 1080, height: 1920, previo, label: 'x' });
    if (previo) assert.equal(l, previo, `el cuadro ${n} creó otro lienzo`);
    previo = l;
  }
  assert.equal(creados, 1);
  assert.equal((previo as unknown as LienzoFalso).dibujos.length, 30, 'cada cuadro se dibuja en el lienzo');
});

test('si cambia el tamaño (otro clip, otra salida), el lienzo es nuevo', async () => {
  const { lienzoDeSubida } = await cargar();
  const a = lienzoDeSubida({ source: cuadro(1), width: 1080, height: 1920, label: 'x' });
  const b = lienzoDeSubida({ source: cuadro(2), width: 540, height: 960, previo: a, label: 'x' });
  assert.notEqual(a, b);
  assert.equal(b.width, 540);
  assert.equal(b.height, 960);
});

test('un OffscreenCanvas ajeno (el recorte, los efectos) se sube tal cual, sin copiarlo', async () => {
  const { lienzoDeSubida } = await cargar();
  creados = 0;
  const ajeno = new LienzoFalso(100, 100) as unknown as OffscreenCanvas;
  creados = 0;
  assert.equal(lienzoDeSubida({ source: ajeno, width: 100, height: 100, label: 'x' }), ajeno);
  assert.equal(creados, 0);
  assert.equal((ajeno as unknown as LienzoFalso).dibujos.length, 0);
});

test('el cableado: el compositor pasa el lienzo del cuadro anterior y guarda sólo el propio', () => {
  const c = leer('app/video-editor/_opencut/services/renderer/compositor/wasm-compositor.ts');
  const sync = c.slice(c.indexOf('private syncExternalTexture'), c.indexOf('private syncRenderedTexture'));
  assert.match(sync, /lienzoDeSubida\(\{[\s\S]*?previo: previous\?\.kind === "external" \? previous\.lienzo : undefined,/);
  assert.match(sync, /source: subida,/);
  assert.match(sync, /lienzo: subida !== texture\.source \? subida : undefined,/);
  assert.doesNotMatch(sync, /new OffscreenCanvas/);
  assert.doesNotMatch(c, /function ensureOffscreenCanvas/, 'volvió la copia nueva por cuadro');
});
