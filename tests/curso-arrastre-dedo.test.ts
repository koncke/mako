// =============================================================================
// Reordenar un curso CON EL DEDO (18/11/2026, F113 (5) de los pendientes del 17/11)
// =============================================================================
// El arrastre del curso (app/_cursos/arrastre-curso.ts) era HTML5 drag-and-drop, que con un dedo no dispara: en un teléfono o
// una tablet los módulos y las clases no se podían reordenar. `tocar` arma el MISMO gesto por pointer events, con el molde del
// Plan (app/plan/board/arrastre-tactil.ts): mantener quieto, mover, soltar. Lo que decide dónde cae y qué pasa al soltar es lo
// mismo que el del mouse (`destinoEn`, `soltarEn`).
//
// Se EJECUTA el hook de verdad en React sobre jsdom, con los pointer events que manda un teléfono. jsdom no mide nada: los
// rectángulos y `elementFromPoint` se ponen a mano, como los dibujaría el curso.
//
// Probado rompiéndolo (18/11/2026), base 7/0:
//   · `tocar` que no arma nada (el dedo no hace nada, como antes) ...................... 4 fallan
//   · el dedo arma sin esperar quieto (se roba el scroll de la página, y el toque corto) 3 fallan
//   · sin tragar el `click` después de soltar (abre el módulo que se acaba de soltar) .. 3 fallan
//   · sin frenar el `contextmenu` con el gesto armado (abre el «…» en medio) ........... 2 fallan
//   · el curso sin `onPointerDown` en las clases ....................................... 1 falla
// ⚠️ Sin verificar con un dedo en un teléfono de verdad (la nube no lo abre): falta mirarlo en uno.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type Ventana = Window & typeof globalThis;
const { JSDOM } = createRequire(import.meta.url)('jsdom') as { JSDOM: new (h: string, o: { url: string; pretendToBeVisual?: boolean }) => { window: Ventana } };
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://hola-mako.com/customer-success', pretendToBeVisual: true });
const g = globalThis as unknown as Record<string, unknown>;
for (const k of ['window', 'self', 'document', 'HTMLElement', 'Node', 'Element', 'MouseEvent', 'Event', 'MutationObserver', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame']) {
  g[k] = (dom.window as unknown as Record<string, unknown>)[k];
}
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true, writable: true });
g.IS_REACT_ACT_ENVIRONMENT = true;

/** Dónde dibujaría el curso cada cosa (en la ventana): tres módulos en fila, sus clases abajo y la barra a la derecha. */
const CAJAS: Record<string, { x: number; y: number; w: number; h: number }> = {
  rail: { x: 0, y: 0, w: 600, h: 200 }, 'm-a': { x: 0, y: 0, w: 180, h: 180 }, 'm-b': { x: 200, y: 0, w: 180, h: 180 }, 'm-c': { x: 400, y: 0, w: 180, h: 180 },
  grilla: { x: 0, y: 300, w: 600, h: 200 }, 'c-1': { x: 0, y: 300, w: 180, h: 180 }, 'c-2': { x: 200, y: 300, w: 180, h: 180 },
  barra: { x: 700, y: 0, w: 200, h: 300 }, 'b-a': { x: 700, y: 0, w: 200, h: 36 }, 'b-b': { x: 700, y: 50, w: 200, h: 36 }, 'b-c': { x: 700, y: 100, w: 200, h: 36 },
};
const rect = (id: string) => {
  const c = CAJAS[id] ?? { x: 0, y: 0, w: 0, h: 0 };
  return { left: c.x, top: c.y, right: c.x + c.w, bottom: c.y + c.h, width: c.w, height: c.h, x: c.x, y: c.y, toJSON: () => ({}) } as DOMRect;
};
dom.window.HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) { return rect(this.id); };
// Lo de más adentro primero: la tarjeta antes que su zona (como `elementFromPoint` de un navegador).
(dom.window.document as unknown as { elementFromPoint: (x: number, y: number) => Element | null }).elementFromPoint = (x, y) => {
  const orden = ['m-a', 'm-b', 'm-c', 'c-1', 'c-2', 'b-a', 'b-b', 'b-c', 'rail', 'grilla', 'barra'];
  for (const id of orden) {
    const r = rect(id);
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return dom.window.document.getElementById(id);
  }
  return dom.window.document.body;
};

type Llamadas = { orden: string[][]; llevar: [number, string, number | null][]; clics: string[]; menus: string[] };

async function montar() {
  const React = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { useArrastreCurso } = await import('../app/_cursos/arrastre-curso');
  const ll: Llamadas = { orden: [], llevar: [], clics: [], menus: [] };
  const h = React.createElement;
  function Banco() {
    const arr = useArrastreCurso({
      modulos: ['a', 'b', 'c'],
      clasesDe: (k) => (k === 'a' ? [1, 2] : []),
      recibeClases: () => true,
      onOrdenarModulos: (keys) => { ll.orden.push(keys); },
      onLlevarClase: (id, k, antes) => { ll.llevar.push([id, k, antes]); },
    });
    const tarjeta = (id: string, mano: Parameters<typeof arr.tocar>[1], arrId: string) => h('div', {
      key: id, id, 'data-arr': arrId,
      onPointerDown: (e: React.PointerEvent<HTMLElement>) => arr.tocar(e, mano),
      onClick: () => { ll.clics.push(id); },
      onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); ll.menus.push(id); },
    }, id);
    return h('div', { className: 'ugc' },
      h('div', { id: 'rail', ...arr.zona('rail') }, ['a', 'b', 'c'].map((k) => tarjeta(`m-${k}`, { tipo: 'modulo', key: k }, k))),
      h('div', { id: 'grilla', ...arr.zona('grilla') }, [1, 2].map((n) => tarjeta(`c-${n}`, { tipo: 'clase', id: n, moduloKey: 'a' }, String(n)))),
      h('div', { id: 'barra', ...arr.zona('barra') }, ['a', 'b', 'c'].map((k) => h('div', { key: k, id: `b-${k}`, 'data-arr-modulo': k }, k))),
    );
  }
  const cont = dom.window.document.createElement('div');
  dom.window.document.body.appendChild(cont);
  const root = createRoot(cont);
  await React.act(async () => { root.render(h(Banco)); });
  return { ll, desmontar: () => React.act(async () => root.unmount()) };
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function puntero(tipo: string, en: EventTarget, x: number, y: number, pointerType = 'touch') {
  const React = await import('react');
  await React.act(async () => {
    // jsdom no trae PointerEvent: es un MouseEvent con lo que lee el hook (y React) de un puntero.
    const e = new dom.window.MouseEvent(tipo, { bubbles: true, cancelable: true, clientX: x, clientY: y });
    for (const [k, v] of Object.entries({ pointerId: 7, pointerType, isPrimary: true })) Object.defineProperty(e, k, { value: v });
    en.dispatchEvent(e);
  });
}
const el = (id: string) => dom.window.document.getElementById(id)!;
/** Mantener quieto lo que arma el gesto (`MS_ARMAR` = 300 ms) y un poco más. */
const quieto = async () => { const React = await import('react'); await React.act(async () => { await esperar(340); }); };

test('con el dedo: mantener, llevar y soltar un módulo lo reordena (el mismo resultado que el mouse)', async () => {
  const { ll, desmontar } = await montar();
  await puntero('pointerdown', el('m-a'), 90, 90);
  await quieto();
  await puntero('pointermove', dom.window, 300, 90);
  await puntero('pointermove', dom.window, 560, 90);
  await puntero('pointerup', dom.window, 560, 90);
  assert.deepEqual(ll.orden, [['b', 'c', 'a']]);
  await desmontar();
});

test('el click que el navegador inventa después de soltar no abre la tarjeta; uno de verdad, después, sí', async () => {
  const { ll, desmontar } = await montar();
  await puntero('pointerdown', el('m-a'), 90, 90);
  await quieto();
  await puntero('pointermove', dom.window, 560, 90);
  await puntero('pointerup', dom.window, 560, 90);
  el('m-a').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.deepEqual(ll.clics, [], 'se abría el módulo que se acababa de soltar');
  el('m-b').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.deepEqual(ll.clics, ['m-b']);
  await desmontar();
});

test('un dedo que se mueve antes de quedarse quieto es un scroll: no arrastra nada', async () => {
  const { ll, desmontar } = await montar();
  await puntero('pointerdown', el('m-a'), 90, 90);
  const React = await import('react');
  await React.act(async () => { await esperar(120); });   // menos que lo que arma el gesto
  await puntero('pointermove', dom.window, 90, 130);   // 40 px: scrolleaba la página
  await quieto();
  await puntero('pointermove', dom.window, 560, 90);
  await puntero('pointerup', dom.window, 560, 90);
  assert.deepEqual(ll.orden, []);
  await desmontar();
});

test('con el gesto armado no se abre el «…» (el contextmenu de mantener apretado), y un toque corto sigue siendo un clic', async () => {
  const { ll, desmontar } = await montar();
  await puntero('pointerdown', el('m-b'), 290, 90);
  await quieto();
  el('m-b').dispatchEvent(new dom.window.MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
  assert.deepEqual(ll.menus, [], 'Android abre el menú a los ~500 ms de mantener apretado');
  await puntero('pointercancel', dom.window, 290, 90);
  assert.deepEqual(ll.orden, [], 'cancelado no mueve nada');
  // Un toque corto (sin esperar) no arma nada y deja pasar el clic.
  await puntero('pointerdown', el('m-c'), 490, 90);
  await puntero('pointerup', dom.window, 490, 90);
  el('m-c').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.deepEqual(ll.clics, ['m-c']);
  await desmontar();
});

test('una clase llevada con el dedo a la barra se MUDA a ese módulo (la misma rama que con el mouse)', async () => {
  const { ll, desmontar } = await montar();
  await puntero('pointerdown', el('c-1'), 90, 390);
  await quieto();
  await puntero('pointermove', dom.window, 800, 68);
  await puntero('pointerup', dom.window, 800, 68);
  assert.deepEqual(ll.llevar, [[1, 'b', null]]);
  assert.deepEqual(ll.orden, [], 'una clase nunca toca el orden de los módulos');
  await desmontar();
});

test('el mouse no pasa por el dedo (sigue con su HTML5 drag-and-drop)', async () => {
  const { ll, desmontar } = await montar();
  await puntero('pointerdown', el('m-a'), 90, 90, 'mouse');
  await quieto();
  await puntero('pointermove', dom.window, 560, 90, 'mouse');
  await puntero('pointerup', dom.window, 560, 90, 'mouse');
  assert.deepEqual(ll.orden, []);
  await desmontar();
});

test('el curso le da el dedo a lo que arrastra en sus tres zonas (los módulos del índice y de la barra, y las clases)', () => {
  const src = readFileSync(join(import.meta.dirname, '../app/_cursos/CursoUgc.tsx'), 'utf8').replace(/\r\n/g, '\n');
  assert.equal((src.match(/onPointerDown=\{movible \? \(e\) => arr\.tocar\(e, \{ tipo: 'modulo', key: m\.key \}\) : undefined\}/g) ?? []).length, 1, 'la barra');
  assert.equal((src.match(/onPointerDown=\{arrastra \? \(e\) => arr\.tocar\(e, \{ tipo: 'modulo', key: m\.key \}\) : undefined\}/g) ?? []).length, 1, 'el índice');
  assert.equal((src.match(/onPointerDown=\{arrastra \? \(e\) => arr\.tocar\(e, \{ tipo: 'clase', id: c\.id, moduloKey: c\.moduloKey \}\) : undefined\}/g) ?? []).length, 1, 'las clases');
});
