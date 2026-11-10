// Una imagen de carrusel que no carga NO se dibuja: nunca el ícono roto con el texto alternativo (10/11/2026).
//
// Martín, con la grilla de «Encuentra tu siguiente OUTLIER»: carruseles «con la imagen rota, con el ícono y el texto
// alternativo a la vista» (@reynardlowell «Comment NATURE…», @growithalex «I paired eight fonts…»). Eran portadas guardadas
// con la URL del CDN de Instagram, que contesta 403 mucho antes de su `oe` (docs/hallazgos-carruseles.md). Las que Instagram
// ya no sirve no se pueden bajar, así que la pantalla tiene que aguantarlas: app/image-editor/carruseles/imagenes-vivas.ts.
//
// Esto DIBUJA el carrusel abierto de verdad (./CarruselAbierto.tsx) en un DOM (jsdom, como tests/admin-polar-armazon.test.ts),
// le tira el evento `error` a la imagen como haría el navegador con un 403, y mira qué queda:
//   1. la lámina rota se saca: se ve la siguiente y el contador cuenta sólo las que se ven;
//   2. si se rompen todas, el respaldo de «sin portada» (el gancho escrito), sin ninguna <img>;
//   3. una portada sola que no carga, igual;
//   4. `sinRotas` conserva el orden y no toca la lista si no hay rotas.
//
// Verificado rompiéndolo: sin el `onError` del visor caen 1, 2 y 3; con `sinRotas` devolviendo la lista entera, 1, 2, 3 y 4.
//
// Correr: node --import tsx --test tests/carruseles-imagen-rota.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as modulo from 'node:module';

// El CSS de la pantalla, vacío (como tests/offer-hilo-unico.test.ts): node no carga .css.
type Loader = (url: string, ctx: unknown, next: (u: string, c: unknown) => unknown) => unknown;
const { registerHooks } = modulo as unknown as { registerHooks: (h: { load: Loader }) => void };
registerHooks({
  load(url, ctx, next) {
    if (/\.css($|\?)/.test(url)) return { format: 'commonjs', source: '', shortCircuit: true };
    return next(url, ctx);
  },
});

// ─── El DOM, ANTES de cargar react-dom (decide al cargarse si hay DOM) ──────
type Ventana = Window & typeof globalThis;
const { JSDOM } = createRequire(import.meta.url)('jsdom') as {
  JSDOM: new (html: string, o: { url: string; pretendToBeVisual?: boolean }) => { window: Ventana };
};
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://hola-mako.com/image-editor', pretendToBeVisual: true });
const g = globalThis as unknown as Record<string, unknown>;
for (const k of ['window', 'self', 'document', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'HTMLImageElement', 'Node', 'Element', 'MouseEvent', 'KeyboardEvent', 'PointerEvent', 'FocusEvent', 'CustomEvent', 'Event', 'MutationObserver', 'DOMRect', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame']) {
  g[k] = (dom.window as unknown as Record<string, unknown>)[k];
}
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true, writable: true });
g.IS_REACT_ACT_ENVIRONMENT = true;
g.ResizeObserver = (dom.window as unknown as Record<string, unknown>).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
// El visor mira si es un celular: jsdom no trae matchMedia.
(dom.window as unknown as Record<string, unknown>).matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

const IG = (n: string) => `https://instagram.fsyd10-1.fna.fbcdn.net/v/t51.82787-15/${n}.jpg?oe=6912ABCD`;
const GANCHO = 'Comment NATURE and I will send you the guide';

function carrusel(o: { miniatura: string | null; laminas?: string[] }) {
  return {
    id: -1, competidorId: -1, origen: 'biblioteca', creador: { nombre: 'Reynard', usuario: 'reynardlowell', foto: null },
    url: 'https://www.instagram.com/p/X/', miniatura: o.miniatura, texto: GANCHO, gancho: GANCHO, tipoGancho: null, cierre: null,
    formato: '', medio: 'carrusel', laminas: o.laminas?.length ?? 6, megusta: 10, comentarios: 2, publicada: null, traida: null,
    outlier: null, laminasImagenes: o.laminas,
  };
}

async function abrir(c: ReturnType<typeof carrusel>) {
  const React = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { CarruselAbierto } = await import('../app/image-editor/carruseles/CarruselAbierto');
  const cont = dom.window.document.createElement('div');
  dom.window.document.body.appendChild(cont);
  const root = createRoot(cont);
  const nada = () => {};
  await React.act(async () => {
    root.render(React.createElement(CarruselAbierto as never, {
      c, guardado: false, nParecidos: 0, creadoresParecidos: [], onGuardar: nada, onEditar: nada, onParecidos: nada, onCreador: nada, onCerrar: nada, telefono: false,
    }));
  });
  const doc = dom.window.document;
  return {
    img: () => doc.querySelector('img:not([alt=""])') as HTMLImageElement | null,
    cuenta: () => [...doc.querySelectorAll('[aria-live="polite"]')].map((e) => e.textContent?.trim()).find((t) => t && /\d+ \/ \d+/.test(t)) ?? null,
    texto: () => doc.body.textContent ?? '',
    /** Lo que hace el navegador cuando la imagen contesta 403. */
    romper: async (img: HTMLImageElement) => { await React.act(async () => { img.dispatchEvent(new dom.window.Event('error')); }); },
    cerrar: async () => { await React.act(async () => root.unmount()); cont.remove(); doc.body.innerHTML = ''; },
  };
}

test('1 · la lámina que no carga se saca: se ve la siguiente y el contador cuenta sólo las que se ven', async () => {
  const v = await abrir(carrusel({ miniatura: IG('portada'), laminas: [IG('l1'), IG('l2'), IG('l3')] }));
  try {
    assert.equal(v.img()?.getAttribute('src'), IG('l1'));
    assert.equal(v.cuenta(), '1 / 3');
    await v.romper(v.img()!);
    assert.equal(v.img()?.getAttribute('src'), IG('l2'), 'la rota se tenía que sacar y mostrar la siguiente');
    assert.equal(v.cuenta(), '1 / 2');
  } finally { await v.cerrar(); }
});

test('2 · si se rompen todas, el respaldo de «sin portada» con el gancho: ninguna <img> con el ícono roto', async () => {
  const v = await abrir(carrusel({ miniatura: IG('portada'), laminas: [IG('a'), IG('b')] }));
  try {
    await v.romper(v.img()!);
    await v.romper(v.img()!);
    assert.equal(v.img()?.getAttribute('src') ?? null, null, 'quedó una <img> rota a la vista');
    assert.match(v.texto(), /Comment NATURE/);
  } finally { await v.cerrar(); }
});

test('3 · una portada sola (sin láminas guardadas) que no carga: el respaldo, nunca el texto alternativo', async () => {
  const v = await abrir(carrusel({ miniatura: IG('sola') }));
  try {
    const img = v.img();
    assert.ok(img, 'la portada se dibuja mientras no falle');
    await v.romper(img!);
    assert.equal(v.img()?.getAttribute('src') ?? null, null, 'quedó la portada rota a la vista');
    assert.match(v.texto(), /Comment NATURE/);
  } finally { await v.cerrar(); }
});

test('4 · sinRotas: conserva el orden, saca sólo las rotas y no comparte la lista', async () => {
  const { sinRotas } = await import('../app/image-editor/carruseles/imagenes-vivas');
  const xs = ['a', 'b', 'c'];
  assert.deepEqual(sinRotas(xs, new Set(['b'])), ['a', 'c']);
  assert.deepEqual(sinRotas(xs, new Set()), ['a', 'b', 'c']);
  assert.notEqual(sinRotas(xs, new Set()), xs, 'una copia: quien la recibe puede cambiarla');
  assert.deepEqual(sinRotas(xs, new Set(['a', 'b', 'c'])), []);
});
