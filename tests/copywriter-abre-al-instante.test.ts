// =============================================================================
// Copywriting: ningún clic espera al server antes de cambiar la pantalla (14/11/2026)
// =============================================================================
// Martín, 14/11/2026: «Debería abrirme automáticamente y de última ponerle el loader de MaKo, pero no que yo le clique y que no
// haga nada». Medido en producción (ws 9): «Replicar» y una plantilla creaban la página (~1,2 s) y recién después navegaban
// (0,5–1 s más), con la portada quieta; abrir un guion, 1,06 s quieta. Ahora la capa con el loader de la casa
// (app/copywriter/AlInstante.tsx) va en el clic y el trabajo sigue detrás.
//
// Lo que esto fija:
//   1. qué links abren otra pantalla de Copywriting (`abreOtraPantallaDeCopy`);
//   2. DIBUJA la portada de outliers de verdad (jsdom) con un server que NUNCA contesta y toca «Replicar»: el loader tiene que
//      estar ya, con el pedido al server en vuelo y sin haber navegado; lo mismo con una plantilla. Si el server dice que no, la
//      capa se va y queda el aviso con «Reportar a Soporte»;
//   3. el orden en lo que no se dibuja acá (Copywriter de escritorio y el teléfono): la capa ANTES del primer `await`, y los links
//      vigilados en cada pantalla.
//
// Verificado rompiéndolo (14/11/2026): con `capa.empezar` después de `await pedirReplicar` (la portada quieta hasta que el
// server crea la página, como antes) caen 2a, 2c y 3.
//
// Correr: node --import tsx --test tests/copywriter-abre-al-instante.test.ts
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as modulo from 'node:module';
import { readFileSync } from 'node:fs';
import { abreOtraPantallaDeCopy } from '../app/copywriter/al-instante';

const leer = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

// El CSS de la pantalla, vacío (como tests/carruseles-imagen-rota.test.ts): node no carga .css.
type Loader = (url: string, ctx: unknown, next: (u: string, c: unknown) => unknown) => unknown;
const { registerHooks } = modulo as unknown as { registerHooks: (h: { load: Loader }) => void };
registerHooks({
  load(url, ctx, next) {
    if (/\.css($|\?)/.test(url)) return { format: 'commonjs', source: '', shortCircuit: true };
    return next(url, ctx);
  },
});

// ─── 1 · Qué cuenta como «otra pantalla» ────────────────────────────────────────────────────────────────────────────────

test('1 · un link a otra pantalla de Copywriting pone la capa; uno a la misma, a otra tab o a otro sitio, no', () => {
  const aqui = 'https://hola-mako.com/copywriter?ws=9';
  const si = [
    '/copywriter/gyevqbe4mkd?ws=9', // una página de la lista
    '/copywriter?ws=9&nueva=1', // «Crear desde cero»
    '/copywriter?ver=guiones&ws=9', // «Mis guiones»
    'https://hola-mako.com/m/copywriter/abc123?mako=1', // el teléfono
  ];
  for (const d of si) assert.equal(abreOtraPantallaDeCopy(d, aqui), true, d);
  const no = [
    '/copywriter?ws=9', // la misma
    '/copywriter?ws=9#arriba', // la misma, con ancla
    '/competitor-spy?ws=9', // otra tab
    'https://otra.com/copywriter/x', // otro sitio
    '/copywriter/a/b', // no es una pantalla de la tab
  ];
  for (const d of no) assert.equal(abreOtraPantallaDeCopy(d, aqui), false, d);
  // La query cuenta ordenada: `?nueva=1&ws=9` es la misma pantalla que `?ws=9&nueva=1`.
  assert.equal(abreOtraPantallaDeCopy('/copywriter?nueva=1&ws=9', 'https://hola-mako.com/copywriter?ws=9&nueva=1'), false);
  assert.equal(abreOtraPantallaDeCopy('/copywriter/x1?ws=9', 'https://hola-mako.com/copywriter/x1/?ws=9'), false, 'la barra final no es otra pantalla');
});

// ─── 2 · La portada de verdad, con un server que no contesta ─────────────────────────────────────────────────────────────

type Ventana = Window & typeof globalThis;
const { JSDOM } = createRequire(import.meta.url)('jsdom') as {
  JSDOM: new (html: string, o: { url: string; pretendToBeVisual?: boolean }) => { window: Ventana };
};
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://hola-mako.com/copywriter?ws=9', pretendToBeVisual: true });
const g = globalThis as unknown as Record<string, unknown>;
for (const k of ['window', 'self', 'document', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'HTMLAnchorElement', 'HTMLImageElement', 'Node', 'Element', 'MouseEvent', 'KeyboardEvent', 'PointerEvent', 'FocusEvent', 'CustomEvent', 'Event', 'MutationObserver', 'DOMRect', 'getComputedStyle', 'sessionStorage', 'localStorage', 'requestAnimationFrame', 'cancelAnimationFrame']) {
  g[k] = (dom.window as unknown as Record<string, unknown>)[k];
}
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true, writable: true });
g.IS_REACT_ACT_ENVIRONMENT = true;
g.ResizeObserver = (dom.window as unknown as Record<string, unknown>).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
g.IntersectionObserver = (dom.window as unknown as Record<string, unknown>).IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
(dom.window as unknown as Record<string, unknown>).matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

/** El server: cada pedido queda anotado y contesta cuando el test lo dice (o nunca). */
const pedidos: { cuerpo: Record<string, unknown>; contestar: (r: unknown) => void }[] = [];
g.fetch = (_url: string, init?: { body?: string }) => new Promise((resolve) => {
  const cuerpo = (() => { try { return JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>; } catch { return {}; } })();
  pedidos.push({ cuerpo, contestar: (r) => resolve({ ok: true, status: 200, json: async () => r, text: async () => JSON.stringify(r) }) });
});

const REEL = {
  id: 'spy:1115', fuente: 'spy', formato: 'reel',
  creador: { nombre: 'Alex Hormozi', usuario: 'hormozi', foto: null, competidorId: 1 },
  url: 'https://www.instagram.com/reel/x/', miniatura: null, gancho: 'Cobrar mejor no es suerte, es sistema.', texto: 'Cobrar mejor no es suerte, es sistema. Y se arma así.',
  deDonde: 'pie', multiplo: null, vistas: 120000, megusta: 4000, comentarios: 80, publicada: '2026-11-01T12:00:00.000Z',
};
const PLANTILLA = { id: 'reel-pas', nombre: 'Reel PAS', formato: '9 / 16', grupo: 'Reels', ayuda: 'Problema, agitación, solución', rotulo: '🎬 Reel', insignia: '🎬 Reel', extracto: 'El error que todos cometen', chips: ['Gancho', 'Problema'] };

async function portada(onPlantilla: () => Promise<string | null>) {
  const React = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime');
  const { OutliersCopy } = await import('../app/copywriter/OutliersCopy');
  const navegado: string[] = [];
  const router = { push: (h: string) => { navegado.push(h); }, replace: (h: string) => { navegado.push(h); }, prefetch: () => {}, back: () => {}, forward: () => {}, refresh: () => {} };
  const doc = dom.window.document;
  const cont = doc.createElement('div');
  doc.body.appendChild(cont);
  const root = createRoot(cont);
  await React.act(async () => {
    root.render(React.createElement(AppRouterContext.Provider, { value: router as never },
      React.createElement(OutliersCopy as never, { portada: { outliers: [REEL], caidas: [] }, plantillas: [PLANTILLA], onPlantilla })));
  });
  const boton = (texto: string) => [...doc.querySelectorAll('button')].find((b) => (b.textContent ?? '').trim() === texto || b.getAttribute('aria-label') === texto) as HTMLButtonElement | undefined;
  return {
    navegado,
    boton,
    /** El loader de la casa: `role="status"` con «Cargando …» (app/_ui/CargandoMako.tsx). */
    cargando: () => doc.querySelector('[data-abriendo] [role="status"][aria-busy="true"]')?.getAttribute('aria-label') ?? null,
    alerta: () => doc.querySelector('[role="alert"]')?.textContent ?? null,
    tocar: async (b: HTMLElement) => { await React.act(async () => { b.click(); }); },
    act: React.act,
    cerrar: async () => { await React.act(async () => root.unmount()); cont.remove(); doc.body.innerHTML = ''; pedidos.length = 0; },
  };
}

test('2a · «Replicar»: el loader está en el clic, con el server todavía creando la página y sin haber navegado', async () => {
  const v = await portada(async () => null);
  try {
    const replicar = v.boton('Replicar');
    assert.ok(replicar, 'la tarjeta tiene «Replicar»');
    assert.equal(v.cargando(), null, 'antes del clic no hay capa');
    await v.tocar(replicar!);
    assert.equal(pedidos.length, 1, 'el pedido salió');
    assert.equal(pedidos[0].cuerpo.accion, 'replicar');
    assert.equal(v.navegado.length, 0, 'todavía no navegó: el server no contestó');
    assert.equal(v.cargando(), 'Cargando la página nueva', 'el loader tiene que estar YA, no cuando el server conteste');
    // El server contesta: navega, y la capa queda hasta que llegue la otra pantalla.
    await v.act(async () => { pedidos[0].contestar({ ok: true, paginas: [], pagina: { id: 'gnueva123' }, doc: {} }); });
    assert.deepEqual(v.navegado, ['/copywriter/gnueva123']);
    assert.equal(v.cargando(), 'Cargando la página nueva', 'la capa sigue mientras Next trae la página');
  } finally { await v.cerrar(); }
});

test('2b · una plantilla: el loader está en el clic, mientras se crea', async () => {
  let soltar: (e: string | null) => void = () => {};
  const v = await portada(() => new Promise((r) => { soltar = r; }));
  try {
    const tarjeta = v.boton('Usar la plantilla Reel PAS');
    assert.ok(tarjeta, 'la fila de plantillas está');
    await v.tocar(tarjeta!);
    assert.equal(v.cargando(), 'Cargando la página nueva');
    // Si crear falla, la capa se va y queda el aviso con «Reportar a Soporte».
    await v.act(async () => { soltar('No se pudo crear la página: la base no contestó'); });
    assert.equal(v.cargando(), null, 'con el error, la capa se va');
    const alerta = v.alerta() ?? '';
    assert.ok(alerta.includes('No se pudo crear la página'), `el aviso dice qué pasó: «${alerta}»`);
    assert.ok(alerta.includes('Reportar a Soporte'), 'el aviso lleva «Reportar a Soporte»');
  } finally { await v.cerrar(); }
});

test('2c · «Replicar» que falla: la capa se va y queda el aviso con «Reportar a Soporte»', async () => {
  const v = await portada(async () => null);
  try {
    await v.tocar(v.boton('Replicar')!);
    assert.equal(v.cargando(), 'Cargando la página nueva');
    await v.act(async () => { pedidos[0].contestar({ ok: false, error: 'Ese original ya no está.' }); });
    assert.equal(v.cargando(), null);
    assert.equal(v.navegado.length, 0);
    const alerta = v.alerta() ?? '';
    assert.ok(alerta.includes('No se pudo replicar') && alerta.includes('Reportar a Soporte'), `«${alerta}»`);
  } finally { await v.cerrar(); }
});

// ─── 3 · Lo que no se dibuja acá: el orden en el código ──────────────────────────────────────────────────────────────────

/** El cuerpo de `const nombre = …` hasta la llave que lo cierra (la primera con dos espacios de sangría). */
function cuerpo(src: string, nombre: string): string {
  const i = src.indexOf(`const ${nombre} = `);
  assert.ok(i >= 0, `no encontré «const ${nombre}»`);
  const fin = src.indexOf('\n  }', i);
  return src.slice(i, fin > i ? fin : undefined);
}

test('3 · escritorio y teléfono: la capa va ANTES del primer `await`, y cada pantalla vigila sus links', () => {
  const copy = leer('app/copywriter/Copywriter.tsx');
  const crear = cuerpo(copy, 'crear');
  assert.ok(crear.indexOf("empezar('la página nueva')") >= 0 && crear.indexOf("empezar('la página nueva')") < crear.indexOf('await pedirCrear('),
    'Copywriter.crear: la capa antes de esperar a que el server cree la página');
  const usar = cuerpo(copy, 'usarPlantilla');
  assert.ok(usar.indexOf('empezar(') >= 0 && usar.indexOf('empezar(') < usar.indexOf('await propias.usar('), 'una plantilla propia también');
  const abrir = cuerpo(copy, 'abrir');
  assert.ok(abrir.indexOf('empezar(') >= 0 && abrir.indexOf('empezar(') < abrir.indexOf('router.push('), 'abrir otra página: la capa antes de navegar');
  assert.match(copy, /useAlInstante\(\{ links: true/, 'Copywriter vigila los links de su lista');
  assert.match(copy, /alInstante=\{alInstante\}/, 'la portada usa la capa de Copywriter (una sola, en el centro)');

  const outliers = leer('app/copywriter/OutliersCopy.tsx');
  const replicar = cuerpo(outliers, 'replicar');
  assert.ok(replicar.indexOf('capa.empezar(') >= 0 && replicar.indexOf('capa.empezar(') < replicar.indexOf('await pedirReplicar('), 'OutliersCopy.replicar');

  const lista = leer('app/m/copywriter/ListaGuionesM.tsx');
  const crearM = cuerpo(lista, 'crear');
  assert.ok(crearM.indexOf('capa.empezar(') >= 0 && crearM.indexOf('capa.empezar(') < crearM.indexOf('await pedirCrear('), 'el teléfono: crear');
  for (const p of ['app/m/copywriter/ListaGuionesM.tsx', 'app/m/copywriter/GuionM.tsx']) {
    const src = leer(p);
    assert.match(src, /useAlInstante\(\{ links: true \}\)/, `${p}: vigila los links (la lista, «‹ Guiones»)`);
    assert.match(src, /<CapaAbriendo que=\{capa\.abriendo\} fija/, `${p}: dibuja la capa`);
  }
  // En el teléfono la portada vigila los links ella (no hay Copywriter arriba).
  assert.match(outliers, /useAlInstante\(\{ links: !deAfuera && telefono \}\)/);
});
