// =============================================================================
// Hijo de tests/image-movil-guiado.test.ts — NO es un test
// =============================================================================
// Dibuja la pantalla REAL de Image en el teléfono (app/m/image-editor/page.tsx) y su envoltorio REAL (./EjemplosM.tsx) en un DOM
// (jsdom). Van de mentira lo que no se puede correr en node: las lecturas del server (la sesión, los ejemplos, las miniaturas, lo
// que el guiado sabe del negocio), la grilla (ExplorarCarruseles arrastra acciones de servidor; acá anota qué recibe) y las piezas
// del guiado (cada una deja una marca). Corre con --experimental-test-module-mocks y le imprime el JSON al test.
// =============================================================================

import { mock } from 'node:test';
import * as modulo from 'node:module';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const url = (r: string) => pathToFileURL(join(__dirname, '..', r)).href;

// El CSS, vacío (node no lo carga).
type Loader = (u: string, ctx: unknown, next: (u: string, c: unknown) => unknown) => unknown;
(modulo as unknown as { registerHooks: (h: { load: Loader }) => void }).registerHooks({
  load(u, ctx, next) {
    if (/\.css($|\?)/.test(u)) return { format: 'commonjs', source: '', shortCircuit: true };
    return next(u, ctx);
  },
});

// El DOM, ANTES de cargar react-dom.
type Ventana = Window & typeof globalThis;
const { JSDOM } = createRequire(__filename)('jsdom') as { JSDOM: new (h: string, o: { url: string }) => { window: Ventana } };
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://hola-mako.com/m/image-editor' });
const g = globalThis as unknown as Record<string, unknown>;
for (const k of ['window', 'self', 'document', 'HTMLElement', 'Node', 'Element', 'MouseEvent', 'Event', 'MutationObserver', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame']) {
  g[k] = (dom.window as unknown as Record<string, unknown>)[k];
}
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true, writable: true });
g.IS_REACT_ACT_ENVIRONMENT = true;

type Recibido = { telefono: boolean; conReplicar: boolean; onReplicar?: (c: unknown) => void };
let ultimaGrilla: Recibido | null = null;

async function main() {
  const { createElement } = await import('react');
  const e = createElement;
  // La grilla: anota qué le pasa la pantalla. Sin `onReplicar`, el «Editar» real arma la versión en el acto (EditarCarrusel).
  mock.module(url('app/image-editor/carruseles/ExplorarCarruseles.tsx'), {
    namedExports: {
      ExplorarCarruseles: (p: { telefono?: boolean; onReplicar?: (c: unknown) => void }) => {
        ultimaGrilla = { telefono: !!p.telefono, conReplicar: typeof p.onReplicar === 'function', onReplicar: p.onReplicar };
        return e('i', { 'data-grilla': p.telefono ? 'telefono' : 'computadora' });
      },
    },
  });
  // Las piezas del guiado de la computadora: cada una deja su marca.
  mock.module(url('app/image-editor/carruseles/ReplicarGuiado.tsx'), {
    namedExports: {
      BASE_SIN_DATOS: { ofertas: null, fotos: { cara: false, look: false }, kit: false },
      useGuiado: (c: { id: number } | null, base: unknown) => (c ? { c, base } : null),
      ChatReplica: ({ g: gu, volver }: { g: { c: { id: number } }; volver: unknown }) => e('section', { 'data-chat-replica': gu.c.id }, volver as never),
      ReplicarGuiado: ({ g: gu }: { g: { c: { id: number } } }) => e('div', { 'data-original': gu.c.id }),
    },
  });
  // El server: la sesión, los ejemplos y lo que el guiado sabe del negocio.
  const BASE = { ofertas: [{ id: 7, nombre: 'Mentoría', principal: true }], fotos: { cara: true, look: false }, kit: true };
  mock.module(url('lib/movil-guard.ts'), { namedExports: { requireMovil: async () => ({ ws: 3 }) } });
  mock.module(url('lib/carruseles/explorar-servidor.ts'), {
    namedExports: { leerExplorador: async () => ({ ok: true, carruseles: [], guardados: [], busquedas: [], paso: null, frase: null, accion: null, ejemplos: null, avisoBiblioteca: null, anuncios: [] }) },
  });
  mock.module(url('lib/thumbnails/servidor.ts'), { namedExports: { leerThumbnails: async () => ({ ok: true, thumbnails: [], guardados: [], sinTablas: false }) } });
  mock.module(url('app/image-editor/guiado-base.ts'), { namedExports: { baseDelGuiado: async () => BASE } });
  mock.module(url('lib/marca/kits-server.ts'), { namedExports: { kitParaUsar: async () => null } });
  mock.module(url('lib/image-editor/server.ts'), { namedExports: { listarDisenos: async () => ({ ok: true, disenos: [] }) } });
  mock.module(url('lib/carruseles/marca.ts'), { namedExports: { nombreDelNegocio: async () => 'Negocio' } });
  mock.module(url('app/m/_ui/index.ts'), {
    namedExports: { PantallaM: ({ children }: { children: unknown }) => e('main', null, children as never), ErrorM: ({ frase }: { frase: string }) => e('p', { 'data-error': '' }, frase) },
  });
  mock.module(url('app/m/image-editor/InicioImagenM.tsx'), { namedExports: { InicioImagenM: () => e('i', { 'data-inicio': '' }) } });

  const React = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { createRoot } = await import('react-dom/client');

  // 1 · La pantalla del teléfono, como la arma el server.
  const { default: Pagina } = await import('../app/m/image-editor/page');
  const el = await (Pagina as unknown as (p: { searchParams: Promise<Record<string, string>> }) => Promise<unknown>)({ searchParams: Promise.resolve({}) });
  const html = renderToStaticMarkup(el as never);
  const pagina = { html: html.slice(0, 400), grilla: ultimaGrilla ? { telefono: ultimaGrilla.telefono, conReplicar: ultimaGrilla.conReplicar } : null };

  // 2 · El envoltorio montado: «Editar» (lo que la grilla llama con `onReplicar`) y «←».
  const { EjemplosM } = await import('../app/m/image-editor/EjemplosM');
  const cont = dom.window.document.createElement('div');
  dom.window.document.body.appendChild(cont);
  const root = createRoot(cont);
  ultimaGrilla = null;
  await React.act(async () => { root.render(e(EjemplosM as never, { base: BASE, datos: {} } as never)); });
  const antes = { grilla: !!cont.querySelector('[data-grilla="telefono"]'), chat: !!cont.querySelector('[data-chat-replica]') };
  const onReplicar = (ultimaGrilla as Recibido | null)?.onReplicar;
  let tras: { grilla: boolean; chat: string | null; original: string | null; chatAntesQueOriginal: boolean; volver: boolean } | null = null;
  let alVolver: { grilla: boolean; chat: boolean } | null = null;
  if (onReplicar) {
    await React.act(async () => { onReplicar({ id: -42, laminas: 6 }); });
    const chat = cont.querySelector('[data-chat-replica]');
    const original = cont.querySelector('[data-original]');
    const volver = cont.querySelector('button[aria-label="Volver a los ejemplos"]') as HTMLButtonElement | null;
    tras = {
      grilla: !!cont.querySelector('[data-grilla]'),
      chat: chat?.getAttribute('data-chat-replica') ?? null,
      original: original?.getAttribute('data-original') ?? null,
      chatAntesQueOriginal: !!(chat && original && chat.compareDocumentPosition(original) & dom.window.Node.DOCUMENT_POSITION_FOLLOWING),
      volver: !!volver,
    };
    if (volver) {
      await React.act(async () => { volver.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
      alVolver = { grilla: !!cont.querySelector('[data-grilla="telefono"]'), chat: !!cont.querySelector('[data-chat-replica]') };
    }
  }
  await React.act(async () => root.unmount());
  process.stdout.write(`@@R@@${JSON.stringify({ pagina, antes, conReplicar: !!onReplicar, tras, alVolver })}`);
  process.exit(0);
}

void main().catch((err) => { console.error(err); process.exit(1); });
