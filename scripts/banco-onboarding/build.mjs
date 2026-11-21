// EL BANCO DEL ONBOARDING (21/11/2026): los componentes REALES del onboarding V2, el motor de los tutoriales y la barra del administrador,
// compilados con esbuild, con datos inventados, sin base y sin sesión (el Cerebro: «NO se usan las cookies, la sesión ni la contraseña de
// Martín, ni de nadie, en un navegador automático»). Las llamadas a /api las contesta la página (entrada.tsx → `window.fetch`).
// Uso: node scripts/banco-onboarding/build.mjs && node scripts/banco-onboarding/probar.mjs   (o servir.cjs → http://127.0.0.1:4591)
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const AQUI = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const WT = path.resolve(AQUI, '..', '..').split(String.fromCharCode(92)).join('/');
const require = createRequire(WT + '/package.json');
const esbuild = require('esbuild');

const stubs = {
  'next/navigation': `export const useRouter = () => ({ push(){}, replace(){}, refresh(){}, back(){}, prefetch(){} }); export const usePathname = () => window.__bancoRuta || '/onboarding'; export const useSearchParams = () => new URLSearchParams(window.location.search); export const useParams = () => ({}); export const redirect = () => {}; export const notFound = () => {};`,
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
      return { contents: nombres.map((n) => `export const ${n} = async () => ({ ok: true });`).join('\n'), loader: 'js' };
    });
    b.onResolve({ filter: /^(node:.*|fs|fs\/promises|path|crypto|stream|net|tls|dns|os|zlib|http|https|url|util|events|buffer|child_process|perf_hooks|async_hooks|assert)$/ }, (a) => ({ path: a.path, namespace: 'nodo' }));
    b.onLoad({ filter: /.*/, namespace: 'nodo' }, () => ({ contents: vacio, loader: 'js' }));
  },
};

fs.mkdirSync(path.join(AQUI, 'salida'), { recursive: true });
await esbuild.build({
  entryPoints: [path.join(AQUI, 'entrada.tsx')], bundle: true, outdir: path.join(AQUI, 'salida'), format: 'esm', platform: 'browser', jsx: 'automatic',
  target: 'es2022', tsconfig: WT + '/tsconfig.json', nodePaths: [WT + '/node_modules'],
  define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}', global: 'globalThis' },
  loader: { '.module.css': 'local-css', '.css': 'css', '.woff2': 'dataurl', '.png': 'dataurl', '.svg': 'dataurl', '.jpg': 'dataurl' },
  plugins: [plugin], logLevel: 'error', logLimit: 20,
});

// Las variables de la casa (colores, claro y oscuro) y los estilos de la caja: de app/globals.css y app/_ui/ui.css, sin Tailwind.
let g = fs.readFileSync(WT + '/app/globals.css', 'utf8');
g = g.replace(/^@import .*$/gm, '').replace(/@theme inline \{[\s\S]*?\n\}\n/g, '').replace(/@custom-variant .*$/gm, '').replace(/@plugin .*$/gm, '');
const ui = fs.readFileSync(WT + '/app/_ui/ui.css', 'utf8').replace(/^@import .*$/gm, '');
fs.writeFileSync(path.join(AQUI, 'salida', 'casa.css'), g + '\n' + ui);

// Un video de prueba CON sonido (la regla de «un video a la vez» mira sólo los que suenan; el navegador corre con el audio apagado).
const video = path.join(AQUI, 'salida', 'prueba.webm');
if (!fs.existsSync(video)) {
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=320x180:rate=15', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000',
    '-t', '20', '-c:v', 'libvpx', '-b:v', '200k', '-c:a', 'libopus', video]);
}
const poster = path.join(AQUI, 'salida', 'poster.jpg');
if (!fs.existsSync(poster)) execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=640x360', '-frames:v', '1', poster]);
console.log('banco listo: scripts/banco-onboarding/salida');
