// =============================================================================
// Hijo de tests/image-movil-propias.test.ts — NO es un test
// =============================================================================
// Monta la pantalla REAL de «Crear desde cero» de Image en el teléfono (app/m/image-editor/InicioImagenM.tsx) con el hook REAL de
// las plantillas propias (app/creaciones/usePlantillasPropias.ts) en un DOM (jsdom). Van de mentira lo que no se puede correr en
// node: las acciones del servidor (las plantillas del negocio y de la comunidad, usarlas, crear un diseño de MaKo), el router,
// las piezas del shell del teléfono (la hoja, la sección, el botón flotante) y las miniaturas. Corre con
// --experimental-test-module-mocks y le imprime el JSON al test.
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
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://hola-mako.com/image-editor?ver=crear' });
const g = globalThis as unknown as Record<string, unknown>;
for (const k of ['window', 'self', 'document', 'HTMLElement', 'Node', 'Element', 'MouseEvent', 'Event', 'MutationObserver', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame']) {
  g[k] = (dom.window as unknown as Record<string, unknown>)[k];
}
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true, writable: true });
g.IS_REACT_ACT_ENVIRONMENT = true;

// Dos creaciones inventadas: una del negocio (sólo suya) y una de la comunidad.
const CREACION = { descripcion: '', tipo: 'formato_imagen', definicion: null, workspace_origen: 0, publicada_at: null, actualizada_at: null };
const MIAS = [{ ...CREACION, id: 41, titulo: 'Mi anuncio de oferta', autor: 'Tu negocio', estado: 'privada', estrellas: 0, usos: 0 }];
const COMUNIDAD = [{ ...CREACION, id: 77, titulo: 'Carrusel de testimonios', autor: 'Agencia Ejemplo', estado: 'publica', estrellas: 12, usos: 3 }];

const llamadas = { tipos: [] as string[], usadas: [] as number[], creadas: [] as string[], push: [] as string[] };

async function main() {
  const { createElement: e } = await import('react');
  mock.module(url('app/creaciones/actions.ts'), {
    namedExports: {
      plantillasDelTipoAction: async (tipo: string) => { llamadas.tipos.push(tipo); return { mias: MIAS, comunidad: COMUNIDAD }; },
      usarCreacionAction: async (id: number) => { llamadas.usadas.push(id); return { ruta: `/image-editor/nuevo-${id}`, nombre: 'x', aviso: null }; },
    },
  });
  mock.module(url('app/image-editor/actions.ts'), {
    namedExports: { crearDisenoNuevoAction: async (id: string) => { llamadas.creadas.push(id); return { ok: true, id: 'd1' }; } },
  });
  mock.module(url('app/m/image-editor/actions.ts'), { namedExports: { borrarDisenoMAction: async () => ({ ok: true }) } });
  // El módulo lo carga tsx como CommonJS: node le cuelga los nombrados al `defaultExport` sólo si es un OBJETO, así que el Link va
  // adentro, como `default` con `__esModule` (lo que lee el `import Link from` compilado).
  const link = {
    __esModule: true,
    default: ({ href, children, ...rest }: { href: string; children?: unknown }) => e('a', { href, ...rest }, children as never),
    useRouter: () => ({ push: (r: string) => { llamadas.push.push(r); }, replace: () => {}, refresh: () => {} }),
    useWs: () => 3,
  };
  mock.module(url('app/_ui/Link.tsx'), { defaultExport: link, namedExports: link });
  type ConHijos = { children?: unknown };
  mock.module(url('app/m/_ui/index.ts'), {
    namedExports: {
      SheetM: ({ abierto, titulo, children }: ConHijos & { abierto: boolean; titulo: string }) => (abierto ? e('div', { 'data-hoja': titulo }, children as never) : null),
      SeccionM: ({ titulo, children }: ConHijos & { titulo: unknown }) => e('section', { 'data-seccion': String(titulo ?? '') }, children as never),
      PieM: ({ children }: ConHijos) => e('div', null, children as never),
      VacioM: ({ frase }: { frase: string }) => e('p', null, frase),
      useConexion: () => ({ enLinea: true }),
      useToastM: () => () => {},
    },
  });
  mock.module(url('app/m/_ui/BotonFlotanteM.tsx'), {
    namedExports: {
      BotonFlotanteM: ({ etiqueta, onClick }: { etiqueta: string; onClick: () => void }) => e('button', { type: 'button', 'aria-label': etiqueta, onClick }),
      HuecoFlotanteM: () => null,
    },
  });
  mock.module(url('app/image-editor/carruseles/MiniaturaCarrusel.tsx'), { namedExports: { MiniaturaCarrusel: () => e('i', { 'data-mini': 'carrusel' }) } });
  mock.module(url('app/image-editor/MiniaturaDiseno.tsx'), { namedExports: { MiniaturaTarjetaDiseno: () => e('i', { 'data-mini': 'real' }) } });
  mock.module(url('app/m/_creacion/escritor.tsx'), { namedExports: { ErrorLineaM: ({ children }: ConHijos) => e('p', { role: 'alert' }, children as never) } });

  const React = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { InicioImagenM } = await import('../app/m/image-editor/InicioImagenM');
  const doc = dom.window.document;
  const cont = doc.createElement('div');
  doc.body.appendChild(cont);
  const root = createRoot(cont);
  const tocar = async (el: Element | null) => {
    if (!el) return false;
    await React.act(async () => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    return true;
  };

  await React.act(async () => { root.render(e(InicioImagenM as never, { disenos: [], negocio: 'Negocio' } as never)); });
  const abrio = await tocar(cont.querySelector('button[aria-label="Nuevo diseño"]'));
  const hoja = cont.querySelector('[data-hoja]');
  // Las secciones de la hoja, en orden, con los nombres de sus tarjetas (los números: un dato, nunca un nodo).
  const secciones = [...(hoja?.querySelectorAll('section[data-seccion]') ?? [])].map((s) => ({
    titulo: s.getAttribute('data-seccion'),
    tarjetas: [...s.querySelectorAll('.m-image-editor-plantilla__nombre')].map((n) => n.textContent ?? '').slice(0, 3),
    rotulos: [...s.querySelectorAll('.m-image-editor-plantilla__rotulo')].map((n) => n.textContent ?? '').slice(0, 3),
  }));
  const tarjetaMia = hoja?.querySelector('button[aria-label="Usar la plantilla Mi anuncio de oferta"]') ?? null;
  const usoMia = await tocar(tarjetaMia);
  await React.act(async () => { await new Promise((r) => setTimeout(r, 10)); });
  await React.act(async () => root.unmount());
  process.stdout.write(`@@R@@${JSON.stringify({ abrio, hayHoja: hoja != null, secciones, usoMia, llamadas })}`);
  process.exit(0);
}

void main().catch((err) => { console.error(err); process.exit(1); });
