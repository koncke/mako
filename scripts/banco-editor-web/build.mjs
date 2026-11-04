// El banco del editor web: el EditorLanding REAL compilado con esbuild, fetch simulado y sin base.
// Uso: node scripts/banco-editor-web/build.mjs && node scripts/banco-editor-web/server.cjs → http://127.0.0.1:4577
// (`/?corto=1`, `/?publicada=1`, `/?doc=<archivo sin .json en esta carpeta>`; `/foto`: las fotos del chat por el cargador del motor).
// `/landing?doc=<json>`: la landing de venta real, sin base y sin cargar el video (landing.tsx, extraer-landing.mjs, capturar.mjs).
// Detalle: docs/hallazgos-editor-landing.md, «El feedback del 24/10» y «Los valores de Tilvo».
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const AQUI_0 = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const WT = path.resolve(AQUI_0, '..', '..').replace(/\\/g, '/');
const require = createRequire(WT + '/package.json');
const esbuild = require('esbuild');
const AQUI = AQUI_0;

const stubs = {
  'next/navigation': `
    export const useRouter = () => ({ push(u){ window.__nav.push(u); }, replace(u){ window.__nav.push(u); }, refresh(){}, back(){}, prefetch(){} });
    export const usePathname = () => window.location.pathname;
    export const useSearchParams = () => new URLSearchParams(window.location.search);
    export const useParams = () => ({});
    export const notFound = () => { throw new Error('notFound'); };
    export const redirect = (u) => { window.__nav.push(u); };`,
  'next/link': `import React from 'react'; export default React.forwardRef(function L({ href, prefetch, ...p }, r) { return React.createElement('a', { ...p, ref: r, href: String(href), onClick: (e) => { p.onClick?.(e); if (!e.defaultPrevented) { e.preventDefault(); window.__nav.push(String(href)); } } }); });`,
  'next/image': `import React from 'react'; export default function I({ src, alt, fill, priority, ...p }) { return React.createElement('img', { src: typeof src === 'string' ? src : src?.src, alt, ...p }); }`,
  'next/dynamic': `import React from 'react'; export default function d(f) { const L = React.lazy(() => f().then((m) => (m && m.default ? m : { default: m }))); return function D(p) { return React.createElement(React.Suspense, { fallback: null }, React.createElement(L, p)); }; }`,
  'next/script': `export default function S() { return null; }`,
  'next/headers': `const f = function () {}; module.exports = new Proxy(f, { get: (_, k) => (k === '__esModule' ? false : f) });`,
  'next/cache': `const f = function () {}; module.exports = new Proxy(f, { get: (_, k) => (k === '__esModule' ? false : f) });`,
  'server-only': ``,
  'client-only': ``,
};

const plugin = {
  name: 'banco',
  setup(b) {
    b.onResolve({ filter: /^(next\/(navigation|link|image|dynamic|script|headers|cache)|server-only|client-only)(\.js)?$/ }, (a) => ({ path: a.path.replace(/\.js$/, ''), namespace: 'stub' }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, (a) => ({ contents: stubs[a.path], loader: 'js', resolveDir: WT }));
    // Lo que el navegador no puede correr: una acción de server se vuelve una función que dice que no se llamó.
    b.onLoad({ filter: /\.tsx?$/ }, async (a) => {
      const src = fs.readFileSync(a.path, 'utf8');
      if (!/^\s*['"]use server['"]/m.test(src)) return null;
      const nombres = [...src.matchAll(/export\s+(?:async\s+)?(?:function|const)\s+(\w+)/g)].map((m) => m[1]);
      return { contents: nombres.map((n) => `export const ${n} = async () => ({ ok: false, error: 'banco' });`).join('\n'), loader: 'js' };
    });
    // El CSS con Tailwind no pasa por esbuild: la hoja se compila aparte si hace falta.
    b.onResolve({ filter: /globals\.css$/ }, (a) => ({ path: a.path, namespace: 'vacio' }));
    b.onLoad({ filter: /.*/, namespace: 'vacio' }, () => ({ contents: '', loader: 'css' }));
    // El fuente que trae lib de server por una ruta de tipos: lo que importe `pg` o `fs` queda vacío.
    b.onResolve({ filter: /^(node:.*|fs|fs\/promises|dns\/promises|path|crypto|stream|net|tls|dns|os|zlib|http|https|url|util|events|buffer|child_process|perf_hooks|async_hooks|string_decoder|querystring|assert|tty)$/ }, (a) => ({ path: a.path, namespace: 'nodo' }));
    b.onLoad({ filter: /.*/, namespace: 'nodo' }, () => ({ contents: 'const f = function () {}; module.exports = new Proxy(f, { get: (_, k) => (k === "__esModule" ? false : k === "AsyncLocalStorage" ? class { getStore() {} run(_, g) { return g(); } } : f) });', loader: 'js' }));
  },
};

const r = await esbuild.build({
  entryPoints: [path.join(AQUI, 'entrada.tsx'), path.join(AQUI, 'foto.ts'), path.join(AQUI, 'landing.tsx')],
  bundle: true,
  outdir: path.join(AQUI, 'salida'),
  format: 'esm',
  splitting: true,
  platform: 'browser',
  jsx: 'automatic',
  sourcemap: false,
  target: 'es2022',
  tsconfig: WT + '/tsconfig.json',
  nodePaths: [WT + '/node_modules'],
  define: { 'process.env.NODE_ENV': '"production"', 'process.env.NEXT_PUBLIC_SUPABASE_URL': '""', 'process.env.NEXT_PUBLIC_APP_URL': '"http://127.0.0.1:4577"', 'process.env': '{}', global: 'globalThis' },
  loader: { '.woff': 'dataurl', '.woff2': 'dataurl', '.png': 'dataurl', '.svg': 'dataurl', '.wasm': 'file', '.jpg': 'dataurl' },
  plugins: [plugin],
  logLevel: 'error',
  logLimit: 20,
}).catch((e) => { console.error(String(e.message).slice(0, 4000)); process.exit(1); });
console.log('listo', r.errors.length, 'errores', r.warnings.length, 'avisos');
