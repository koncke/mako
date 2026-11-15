// El banco del Agency Dashboard (14/11/2026): AgencyApp y AgencyM REALES compilados con esbuild, con los datos de UNA agencia
// leídos de producción por leer-prod.mts (un JSON fuera del repo). Uso: node scripts/banco-agency/build.mjs && DATOS=<json> node scripts/banco-agency/servir.cjs → http://127.0.0.1:4597
//   /?cuenta=<ws> (su ficha abierta) · /telefono (la de /m/agency) · /telefono?abrir=<ws>. Capturas: node scripts/banco-copilot/capturar.mjs <lista.json> <carpeta>
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const AQUI = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const WT = path.resolve(AQUI, '..', '..').split(String.fromCharCode(92)).join('/');
const require = createRequire(WT + '/package.json');
const esbuild = require('esbuild');

const stubs = {
  'next/navigation': `export const useRouter = () => ({ push(){}, replace(){}, refresh(){}, back(){}, prefetch(){} }); export const usePathname = () => '/agency'; export const useSearchParams = () => new URLSearchParams(window.location.search); export const useParams = () => ({});`,
  'next/link': `import React from 'react'; export default React.forwardRef(function L({ href, prefetch, ...p }, r) { return React.createElement('a', { ...p, ref: r, href: String(href), onClick: (e) => { p.onClick?.(e); e.preventDefault(); } }); });`,
  'next/image': `import React from 'react'; export default function I({ src, alt, fill, priority, ...p }) { return React.createElement('img', { src: typeof src === 'string' ? src : src?.src, alt, ...p }); }`,
  'next/dynamic': `import React from 'react'; export default function d(f) { const L = React.lazy(() => f().then((m) => (m && m.default ? m : { default: m }))); return function D(p) { return React.createElement(React.Suspense, { fallback: null }, React.createElement(L, p)); }; }`,
  'server-only': ``,
  'client-only': ``,
};
const vacio = 'const f = function () {}; module.exports = new Proxy(f, { get: (_, k) => (k === "__esModule" ? false : f) });';
const plugin = {
  name: 'banco',
  setup(b) {
    b.onResolve({ filter: /^(next\/(navigation|link|image|dynamic)|server-only|client-only)(\.js)?$/ }, (a) => ({ path: a.path.replace(/\.js$/, ''), namespace: 'stub' }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, (a) => ({ contents: stubs[a.path], loader: 'js', resolveDir: WT }));
    b.onLoad({ filter: /\.tsx?$/ }, (a) => {
      const src = fs.readFileSync(a.path, 'utf8');
      if (!/^\s*['"]use server['"]/m.test(src)) return null;
      const nombres = [...src.matchAll(/export\s+(?:async\s+)?(?:function|const)\s+(\w+)/g)].map((m) => m[1]);
      return { contents: nombres.map((n) => `export const ${n} = async () => ({ ok: true, busquedas: [] });`).join('\n'), loader: 'js' };
    });
    b.onResolve({ filter: /^(node:.*|fs|fs\/promises|path|crypto|stream|net|tls|dns|os|zlib|http|https|url|util|events|buffer|child_process|perf_hooks|async_hooks|assert)$/ }, (a) => ({ path: a.path, namespace: 'nodo' }));
    b.onLoad({ filter: /.*/, namespace: 'nodo' }, () => ({ contents: vacio, loader: 'js' }));
  },
};

await esbuild.build({
  entryPoints: [path.join(AQUI, 'entrada.tsx'), path.join(AQUI, 'telefono.tsx')], bundle: true, outdir: path.join(AQUI, 'salida'), format: 'esm', platform: 'browser', jsx: 'automatic',
  target: 'es2022', tsconfig: WT + '/tsconfig.json', nodePaths: [WT + '/node_modules'],
  define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}', global: 'globalThis' },
  loader: { '.module.css': 'local-css', '.css': 'css', '.woff2': 'dataurl', '.png': 'dataurl', '.svg': 'dataurl' },
  plugins: [plugin], logLevel: 'error', logLimit: 20,
});

// Las variables de la casa (colores, tema claro y oscuro) y los estilos de la caja (Modal): de app/globals.css y app/_ui/ui.css,
// sin Tailwind (que no pasa por esbuild).
let g = fs.readFileSync(WT + '/app/globals.css', 'utf8');
g = g.replace(/^@import .*$/gm, '').replace(/@theme inline \{[\s\S]*?\n\}\n/g, '').replace(/@custom-variant .*$/gm, '').replace(/@plugin .*$/gm, '');
const ui = fs.readFileSync(WT + '/app/_ui/ui.css', 'utf8').replace(/^@import .*$/gm, '');
const aj = fs.readFileSync(WT + '/app/_ui/ajustes.css', 'utf8').replace(/^@import .*$/gm, '');
fs.writeFileSync(path.join(AQUI, 'salida', 'casa.css'), g + '\n' + ui + '\n' + aj);
console.log('banco listo: scripts/banco-agency/salida');
