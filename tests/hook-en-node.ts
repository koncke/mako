// =============================================================================
// Correr un hook REAL de la app en node, sin navegador (28/10/2026)
// =============================================================================
// El molde salió del arnés con que el Cerebro reprodujo los defectos de Soporte (C:/dev/revisiones/2810-ticketera-046d9e028.md):
// esbuild arma el archivo del hook con sus imports de verdad, salvo los que el test cambia (`vecinos`), y React es uno de
// mentira: los estados viven en `rt.hooks`, `dibujar()` vuelve a llamar al hook como un render y corre después los efectos
// cuyas dependencias cambiaron. `useSyncExternalStore` lee el almacén en cada dibujo. No es un test: lo importan los tests.
// =============================================================================

import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

export type RuntimeHooks = { hooks: unknown[]; idx: number; efectos: Array<() => void> };

/** React de mentira: lee su estado de `globalThis.__hookEnNode`. */
const REACT = `
  const rt = () => globalThis.__hookEnNode;
  export function useState(init) { const r = rt(); const i = r.idx++; if (!(i in r.hooks)) r.hooks[i] = typeof init === 'function' ? init() : init;
    return [r.hooks[i], (v) => { r.hooks[i] = typeof v === 'function' ? v(r.hooks[i]) : v; }]; }
  export function useRef(init) { const r = rt(); const i = r.idx++; if (!(i in r.hooks)) r.hooks[i] = { current: init }; return r.hooks[i]; }
  export const useCallback = (fn) => fn;
  export const useMemo = (fn) => fn();
  export const useSyncExternalStore = (suscribir, leer) => leer();
  export function useEffect(fn, deps) { const r = rt(); const i = r.idx++; const antes = r.hooks[i];
    if (!antes || !deps || deps.some((d, k) => !Object.is(d, antes.deps[k]))) r.efectos.push(() => { antes?.limpiar?.(); r.hooks[i] = { deps, limpiar: fn() }; }); }
`;

/**
 * Arma `entrada` (ruta desde la raíz del repo) con sus imports reales salvo `vecinos` (el especificador tal cual se importa →
 * el código que lo reemplaza) y devuelve el módulo.
 */
export async function armarHook(raiz: string, entrada: string, vecinos: Record<string, string> = {}): Promise<Record<string, unknown>> {
  const { build } = createRequire(join(raiz, 'package.json'))('esbuild') as typeof import('esbuild');
  const todos: Record<string, string> = { react: REACT, ...vecinos };
  const r = await build({
    entryPoints: [join(raiz, entrada)], bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent',
    plugins: [{ name: 'vecinos', setup(b) {
      for (const spec of Object.keys(todos)) {
        const filtro = new RegExp(`^${spec.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}$`);
        b.onResolve({ filter: filtro }, () => ({ path: spec, namespace: 'vecino' }));
      }
      b.onLoad({ filter: /.*/, namespace: 'vecino' }, (a) => ({ contents: todos[a.path], loader: 'js' }));
      b.onResolve({ filter: /^@\// }, (a) => ({ path: ['.ts', '.tsx'].map((x) => join(raiz, `${a.path.slice(2)}${x}`)).find((x) => existsSync(x)) ?? join(raiz, `${a.path.slice(2)}.ts`) }));
    } }],
  });
  return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString('base64')}`);
}

/** Un dibujador nuevo (estado de cero) para `hook`: cada llamada es un render, y después corren sus efectos. `desmontar`
 *  corre las limpiezas de los efectos, como React al sacar el componente (28/10/2026: salir del chat nuevo a mitad de algo). */
export function dibujador<P, S>(hook: (p: P) => S): { dibujar: (p: P) => S; desmontar: () => void } {
  const rt: RuntimeHooks = { hooks: [], idx: 0, efectos: [] };
  return {
    dibujar: (p: P) => {
      (globalThis as unknown as { __hookEnNode: RuntimeHooks }).__hookEnNode = rt;
      rt.idx = 0;
      const s = hook(p);
      const ef = rt.efectos; rt.efectos = [];
      for (const f of ef) f();
      return s;
    },
    desmontar: () => {
      for (const h of rt.hooks) {
        const e = h as { deps?: unknown; limpiar?: unknown } | null;
        if (e && typeof e === 'object' && 'deps' in e && typeof e.limpiar === 'function') (e.limpiar as () => void)();
      }
    },
  };
}
