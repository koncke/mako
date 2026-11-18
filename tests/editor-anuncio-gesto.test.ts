// =============================================================================
// «Ajusta los cortes»: reordenar con el teclado, y un clic que sólo selecciona no le borra el deshacer a nadie (F167, 18/11/2026)
// =============================================================================
// Se DIBUJA el editor de verdad (app/video-generator/EditorAnuncio.tsx) en un DOM (jsdom, como
// tests/carruseles-imagen-rota.test.ts), y se le hace lo que hace la persona:
//   1. Tab hasta un bloque y → : el bloque se corre un lugar, el foco lo sigue, y «Deshacer» lo vuelve;
//   2. ← sobre el hermano de una toma partida NO cruza (el tope de `moverTramo`), y no deja una entrada muda;
//   3. con la pila de deshacer LLENA (30), un clic que sólo selecciona no tira la entrada más vieja: se deshacen las 30 y se
//      vuelve al plan de partida. Antes apilaba en el `pointerdown` y la 31 empujaba afuera a la primera;
//   4. arrastrar un borde de verdad sí deja UNA entrada (el gesto entero), y Deshacer lo vuelve.
//
// Correr: node --import tsx --test tests/editor-anuncio-gesto.test.ts
//
// PROBADO ROMPIÉNDOLO (18/11/2026): base 4/0 →
//   · el `onKeyDown` del bloque sacado → 2/2 (caen el 1 y el 3: sin flechas no hay con qué llenar la pila);
//   · apilar otra vez en el `pointerdown` del bloque (`apilar(planRef.current)` en vez de guardar el gesto) → 3/1 (cae el 3);
//   · el `soltar` sin apilar el gesto → 3/1 (cae el 4).
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as modulo from 'node:module';
import type { Plan } from '../app/video-generator/plan-montaje';

type Loader = (url: string, ctx: unknown, next: (u: string, c: unknown) => unknown) => unknown;
const { registerHooks } = modulo as unknown as { registerHooks: (h: { load: Loader }) => void };
registerHooks({
  load(url, ctx, next) {
    if (/\.css($|\?)/.test(url)) return { format: 'commonjs', source: '', shortCircuit: true };
    return next(url, ctx);
  },
});

// ─── El DOM, ANTES de cargar react-dom ──────────────────────────────────────
type Ventana = Window & typeof globalThis;
const { JSDOM } = createRequire(import.meta.url)('jsdom') as {
  JSDOM: new (html: string, o: { url: string; pretendToBeVisual?: boolean }) => { window: Ventana };
};
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://hola-mako.com/video-generator', pretendToBeVisual: true });
const w = dom.window as unknown as Record<string, unknown>;
const g = globalThis as unknown as Record<string, unknown>;
for (const k of ['window', 'self', 'document', 'HTMLElement', 'HTMLButtonElement', 'HTMLDivElement', 'HTMLInputElement', 'HTMLVideoElement', 'Node', 'Element', 'MouseEvent', 'KeyboardEvent', 'FocusEvent', 'CustomEvent', 'Event', 'MutationObserver', 'DOMRect', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame']) {
  g[k] = w[k];
}
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true, writable: true });
g.IS_REACT_ACT_ENVIRONMENT = true;
g.ResizeObserver = w.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
// jsdom no reproduce video: se calla (la previsión no es lo que se prueba acá).
const media = (w.HTMLMediaElement as { prototype: Record<string, unknown> }).prototype;
media.pause = () => {};
media.play = () => Promise.resolve();
Object.defineProperty(media, 'currentTime', { configurable: true, get: () => 0, set: () => {} });
// La escala de la tira sale del ancho de la caja: jsdom mide 0 y sin escala no hay arrastre.
Object.defineProperty((w.HTMLElement as { prototype: object }).prototype, 'clientWidth', { configurable: true, get: () => 600 });

/** Cuatro tomas; la 1 partida en dos (la 1a y la 1b), que es el caso que `moverTramo` frena. */
const PLAN: Plan = {
  total: 21,
  segs: [
    { toma: 1, ini: 0, fin: 3 },
    { toma: 1, ini: 4, fin: 7 },
    { toma: 2, ini: 0, fin: 5 },
    { toma: 3, ini: 0, fin: 5 },
    { toma: 4, ini: 0, fin: 5 },
  ],
};

async function abrir() {
  const React = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { EditorAnuncio } = await import('../app/video-generator/EditorAnuncio');
  const doc = dom.window.document;
  const cont = doc.createElement('div');
  doc.body.appendChild(cont);
  const root = createRoot(cont);
  const nada = () => {};
  await React.act(async () => {
    root.render(React.createElement(EditorAnuncio, {
      clips: ['https://x/1.mp4', 'https://x/2.mp4', 'https://x/3.mp4', 'https://x/4.mp4'],
      segundosPorToma: [10, 10, 10, 10], plan: PLAN, musica: null, onAplicar: nada, onCerrar: nada,
    }));
  });
  const bloques = () => [...doc.querySelectorAll<HTMLElement>('[aria-label^="Toma "]')];
  const tomaDe = (el: Element | null) => Number(/^Toma (\d+)/.exec(el?.getAttribute('aria-label') ?? '')?.[1] ?? NaN);
  const deshacerBtn = () => doc.querySelector<HTMLButtonElement>('button[title="Deshacer (Ctrl+Z)"]')!;
  const act = (f: () => void) => React.act(async () => { f(); });
  return {
    /** El orden de las tomas en la tira, como se lee. */
    orden: () => bloques().map(tomaDe),
    enfocada: () => bloques().indexOf(doc.activeElement as HTMLElement),
    enfocar: (i: number) => act(() => { bloques()[i]!.focus(); }),
    tecla: (i: number, key: string) => act(() => {
      bloques()[i]!.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    }),
    /** Un clic que sólo selecciona: el dedo baja sobre el bloque y sube sin moverse. */
    clic: async (i: number) => {
      await act(() => { bloques()[i]!.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, clientX: 5 })); });
      await act(() => { dom.window.dispatchEvent(new dom.window.MouseEvent('pointerup', { bubbles: true })); });
    },
    /** Arrastra el borde FINAL del bloque i `dx` píxeles. */
    arrastrarBorde: async (i: number, dx: number) => {
      const borde = bloques()[i]!.querySelector<HTMLElement>('[title="Recortar el final"]')!;
      await act(() => { borde.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, clientX: 100 })); });
      await act(() => { dom.window.dispatchEvent(new dom.window.MouseEvent('pointermove', { bubbles: true, clientX: 100 + dx })); });
      await act(() => { dom.window.dispatchEvent(new dom.window.MouseEvent('pointerup', { bubbles: true })); });
    },
    puedeDeshacer: () => !deshacerBtn().disabled,
    deshacer: () => act(() => { deshacerBtn().click(); }),
    /** El largo del anuncio, como lo dice la pantalla («0:13 / 0:21» → «0:21»). */
    largo: () => /\/\s*(\d+:\d{2})/.exec(doc.body.textContent ?? '')?.[1] ?? null,
    cerrar: async () => { await React.act(async () => root.unmount()); cont.remove(); doc.body.innerHTML = ''; },
  };
}

test('1 · con el foco en un bloque, → lo corre un lugar, el foco lo sigue, y Deshacer lo vuelve', async () => {
  const v = await abrir();
  try {
    assert.deepEqual(v.orden(), [1, 1, 2, 3, 4]);
    assert.equal(v.puedeDeshacer(), false, 'al abrir no hay nada que deshacer');
    await v.enfocar(2);
    await v.tecla(2, 'ArrowRight');
    assert.deepEqual(v.orden(), [1, 1, 3, 2, 4], 'la toma 2 pasó después de la 3');
    assert.equal(v.enfocada(), 3, 'el foco sigue al bloque a su lugar nuevo');
    await v.tecla(3, 'ArrowRight');
    assert.deepEqual(v.orden(), [1, 1, 3, 4, 2]);
    await v.deshacer();
    await v.deshacer();
    assert.deepEqual(v.orden(), [1, 1, 2, 3, 4], 'cada tecla es un paso de deshacer');
    assert.equal(v.puedeDeshacer(), false);
  } finally { await v.cerrar(); }
});

test('2 · ← sobre el segundo pedazo de una toma partida no la cruza, y no deja una entrada muda', async () => {
  const v = await abrir();
  try {
    await v.enfocar(1);
    await v.tecla(1, 'ArrowLeft');
    assert.deepEqual(v.orden(), [1, 1, 2, 3, 4], 'el pedazo se frena contra su hermano (un plan al revés el server lo rechaza)');
    assert.equal(v.puedeDeshacer(), false, 'un paso que no cambió nada no se apila');
    // Una tecla que no es una flecha no hace nada.
    await v.tecla(1, 'Enter');
    assert.deepEqual(v.orden(), [1, 1, 2, 3, 4]);
  } finally { await v.cerrar(); }
});

test('3 · con la pila llena, un clic que sólo selecciona no tira la entrada más vieja: se deshacen las 30', async () => {
  const v = await abrir();
  try {
    // 30 pasos de verdad: la toma 4 va y viene entre los dos últimos lugares.
    for (let k = 0; k < 30; k++) {
      const i = v.orden().lastIndexOf(4);
      await v.enfocar(i);
      await v.tecla(i, i === 4 ? 'ArrowLeft' : 'ArrowRight');
    }
    assert.deepEqual(v.orden(), [1, 1, 2, 3, 4], 'un número par de pasos la deja donde estaba');
    // El clic: baja y sube sin moverse. Antes apilaba al bajar (la 31) y la primera entrada se caía.
    await v.clic(2);
    assert.deepEqual(v.orden(), [1, 1, 2, 3, 4], 'el clic no movió nada');
    let n = 0;
    while (v.puedeDeshacer() && n < 40) { await v.deshacer(); n++; }
    assert.equal(n, 30, 'las 30 entradas siguen ahí: el clic no se llevó la primera');
    assert.deepEqual(v.orden(), [1, 1, 2, 3, 4], 'y se vuelve al plan de partida');
  } finally { await v.cerrar(); }
});

test('4 · arrastrar un borde de verdad deja UNA entrada, y Deshacer vuelve el corte', async () => {
  const v = await abrir();
  try {
    assert.equal(v.largo(), '0:21');
    // 50 px con la tira de 600 px para 21 s son 1,75 s más de la toma 2.
    await v.arrastrarBorde(2, 50);
    assert.equal(v.largo(), '0:23', 'el borde se estiró y el largo lo dice');
    assert.equal(v.puedeDeshacer(), true, 'el borde se movió: el gesto se apila al soltar');
    await v.deshacer();
    assert.equal(v.puedeDeshacer(), false, 'UNA entrada por gesto, no una por paso');
    assert.equal(v.largo(), '0:21', 'y el corte volvió a como estaba');
  } finally { await v.cerrar(); }
});
