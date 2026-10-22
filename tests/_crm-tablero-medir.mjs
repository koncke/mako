// =============================================================================
// Medir el tablero de /crm con N tarjetas: arma tests/_crm-tablero-arnes.tsx con esbuild y lo corre en un Chrome sin ventana
// =============================================================================
// NO es un test. Uso:  node tests/_crm-tablero-medir.mjs 300 1050   (cada número, una corrida; ?chips/?ae por variable)
// Imprime, por N: el tiempo hasta el primer pintado, el de un clic y el de tildar una tarjeta, y las tareas largas.
//   · Las acciones del server ('use server') se cambian por funciones que devuelven { ok: false }: no hay base.
//   · next/navigation, next/link y next/dynamic, por lo mínimo que el tablero usa.
//   · React en PRODUCCIÓN (como en hola-mako.com): en desarrollo todo pesa el doble y mide otra cosa.
//   · Chrome dedicado, con su perfil y --mute-audio, sin ventana (AGENTS.md y la memoria «verificar en navegador»).
// =============================================================================

import { build } from 'esbuild';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const NS = (process.argv.slice(2).length ? process.argv.slice(2) : ['300', '1050']).map(Number);
const SALIDA = mkdtempSync(join(tmpdir(), 'crm-tablero-'));

const USE_SERVER = /^(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*['"]use server['"]/;
const STUBS = {
  'next/navigation': `export const useRouter = () => ({ push() {}, replace() {}, refresh() {}, back() {}, prefetch() {} });
    export const usePathname = () => '/crm'; export const useSearchParams = () => new URLSearchParams(location.search);
    export const useParams = () => ({}); export const redirect = () => {}; export const notFound = () => {};`,
  'next/link': `import { createElement } from 'react'; export default function Link({ href, children, prefetch, ...p }) { return createElement('a', { href: String(href), ...p }, children); }`,
  'next/dynamic': `export default function dynamic() { return function Nada() { return null; }; }`,
  'server-only': ``,
};

// Lo que sólo existe en el server (módulos de Node, SDKs, next/server…) y alguna lib compartida importa arriba: un
// módulo CommonJS vacío (un Proxy que devuelve todo lo que se le pida), así los `import { x }` no fallan al armar. Los
// que esbuild no resuelve se suman solos (`noResueltos`), una vuelta por vez.
const VACIO = `const h = { get: (t, k) => (k === '__esModule' ? false : k === Symbol.toPrimitive ? () => '' : P), apply: () => P, construct: () => P };
  const P = new Proxy(function () {}, h); module.exports = P;`;
const SERVER = new Set(['next/server', 'next/headers', 'next/cache', 'web-push', 'openai', 'stripe', 'postgres', 'pg', 'resend', 'agent-base', 'https-proxy-agent', 'googleapis', '@opentelemetry/api']);
const esServer = (p) => SERVER.has(p) || [...SERVER].some((s) => p.startsWith(`${s}/`)) || /^(node:)?(fs|path|os|crypto|http|https|net|tls|stream|zlib|url|util|events|child_process|dns|buffer|querystring|worker_threads|perf_hooks|async_hooks|module|vm|assert|string_decoder|readline|process|timers|constants|http2|punycode|diagnostics_channel)(\/.*)?$/.test(p) || /^@supabase\//.test(p) || /^@anthropic-ai\//.test(p) || /^@google-cloud\//.test(p);

const plugin = {
  name: 'arnes-crm',
  setup(b) {
    b.onResolve({ filter: /^(next\/navigation|next\/link|next\/dynamic|server-only)$/ }, (a) => ({ path: a.path, namespace: 'stub' }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, (a) => ({ contents: STUBS[a.path], loader: 'jsx', resolveDir: RAIZ }));
    // ESM con los nombres que pide QUIEN lo importa (un CJS no sirve: esbuild copia sólo las propiedades propias del
    // Proxy, y `new AsyncLocalStorage()` daba «is not a constructor» al cargar).
    b.onResolve({ filter: /^[^./]/ }, (a) => (esServer(a.path) ? { path: `${a.path}|${a.importer}`, namespace: 'vacio' } : undefined));
    b.onLoad({ filter: /.*/, namespace: 'vacio' }, (a) => {
      const [mod, quien] = a.path.split('|');
      let src = ''; try { src = readFileSync(quien, 'utf8'); } catch { /* sin fuente: sólo el default */ }
      const esc = mod.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
      const nombres = new Set();
      for (const m of src.matchAll(new RegExp(`import\\s+(?:type\\s+)?(?:[\\w$]+\\s*,\\s*)?\\{([^}]*)\\}\\s*from\\s*['"]${esc}['"]`, 'g'))) {
        for (const p of m[1].split(',')) { const n = p.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim(); if (/^[\w$]+$/.test(n) && n !== 'default') nombres.add(n); }
      }
      for (const m of src.matchAll(new RegExp(`export\\s*\\{([^}]*)\\}\\s*from\\s*['"]${esc}['"]`, 'g'))) {
        for (const p of m[1].split(',')) { const n = p.trim().split(/\s+as\s+/)[0].trim(); if (/^[\w$]+$/.test(n) && n !== 'default') nombres.add(n); }
      }
      const proxy = `const h = { get: (t, k) => (k === 'then' ? undefined : k === Symbol.toPrimitive ? () => '' : P), apply: () => P, construct: () => P };
        const P = new Proxy(function () {}, h);`;
      return { contents: `${proxy}\nexport default P;\n${[...nombres].map((n) => `export const ${n} = P;`).join('\n')}`, loader: 'js' };
    });
    // Una acción del server: las mismas exportaciones, sin cuerpo.
    b.onLoad({ filter: /\.(ts|tsx)$/ }, (a) => {
      const src = readFileSync(a.path, 'utf8');
      if (!USE_SERVER.test(src)) return undefined;
      const nombres = [...src.matchAll(/^export\s+(?:async\s+)?function\s+(\w+)/gm)].map((m) => m[1]);
      return { contents: nombres.map((n) => `export async function ${n}() { return { ok: false, error: 'arnés' }; }`).join('\n'), loader: 'ts' };
    });
  },
};

for (let vuelta = 0; ; vuelta++) {
  try {
    await build({
      entryPoints: [join(RAIZ, 'tests/_crm-tablero-arnes.tsx')],
      bundle: true, format: 'iife', platform: 'browser', target: 'chrome120', minify: process.env.ARNES_MIN !== '0',
      outfile: join(SALIDA, 'arnes.js'), jsx: 'automatic', tsconfig: join(RAIZ, 'tsconfig.json'),
      loader: { '.css': 'empty', '.svg': 'dataurl', '.png': 'dataurl' },
      define: { 'process.env.NODE_ENV': '"production"' },
      banner: { js: 'var process = { env: { NODE_ENV: "production" } };' },
      plugins: [plugin], logLevel: 'silent',
    });
    break;
  } catch (e) {
    const noResueltos = [...new Set((e.errors ?? []).map((x) => /Could not resolve "([^"]+)"/.exec(x.text)?.[1]).filter(Boolean))];
    if (!noResueltos.length || vuelta > 8) { console.error((e.errors ?? []).slice(0, 8).map((x) => `${x.location?.file}: ${x.text}`).join('\n')); process.exit(1); }
    for (const m of noResueltos) SERVER.add(m.startsWith('@') ? m.split('/').slice(0, 2).join('/') : m.split('/')[0]);
  }
}
writeFileSync(join(SALIDA, 'arnes.html'), `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>tablero</title>
<style>html,body{margin:0;height:100%}body{background:#f6f7f9;color:#12151b;font-family:system-ui}</style></head>
<body><div style="display:flex;min-height:100vh"><aside data-sidebar style="width:68px;flex:none;background:#1e2230"></aside><div id="raiz" style="flex:1;min-width:0;display:flex"></div></div>
<script src="arnes.js"></script></body></html>`);

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
if (!CHROME) { console.error('no encontré chrome.exe'); process.exit(1); }
const PUERTO = 9344;
const perfil = mkdtempSync(join(tmpdir(), 'crm-tablero-cdp-'));
const chrome = spawn(CHROME, [`--remote-debugging-port=${PUERTO}`, `--user-data-dir=${perfil}`, '--headless=new', '--mute-audio',
  '--no-first-run', '--no-default-browser-check', '--window-size=1568,900', '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' });
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  let url = null;
  for (let i = 0; i < 60 && !url; i++) {
    try { url = (await (await fetch(`http://127.0.0.1:${PUERTO}/json/list`)).json()).find((x) => x.type === 'page')?.webSocketDebuggerUrl; } catch { /* todavía no */ }
    if (!url) await dormir(250);
  }
  const ws = new WebSocket(url);
  await new Promise((r) => { ws.onopen = r; });
  let id = 0; const pend = new Map();
  const errores = [];
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); return; }
    // Lo que la página tira al cargar: sin esto, un error de arranque se lee como «tarda» (no escribe nunca la medida).
    if (d.method === 'Runtime.exceptionThrown') errores.push(d.params.exceptionDetails?.exception?.description ?? d.params.exceptionDetails?.text);
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errores.push(d.params.args.map((a) => a.value ?? a.description).join(' '));
  };
  const cdp = (method, params = {}) => new Promise((res, rej) => { const n = ++id; pend.set(n, (d) => (d.error ? rej(new Error(d.error.message)) : res(d.result))); ws.send(JSON.stringify({ id: n, method, params })); });
  await cdp('Page.enable'); await cdp('Runtime.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1568, height: 900, deviceScaleFactor: 1, mobile: false });
  for (const n of NS) {
    const extra = process.env.ARNES_QS ? `&${process.env.ARNES_QS}` : '';
    await cdp('Page.navigate', { url: `${pathToFileURL(join(SALIDA, 'arnes.html')).href}?n=${n}${extra}` });
    errores.length = 0;
    let m = null; const t0 = Date.now();
    while (!m && Date.now() - t0 < Number(process.env.ARNES_TOPE_MS ?? 300_000)) {
      await dormir(500);
      if (errores.length && Date.now() - t0 > 3000) break;
      const r = await cdp('Runtime.evaluate', { expression: 'JSON.stringify(window.__medida ?? null)', returnByValue: true, timeout: 20_000 }).catch(() => null);
      m = r?.result?.value ? JSON.parse(r.result.value) : null;
    }
    console.log(JSON.stringify(m ?? { n, error: errores.length ? errores.slice(0, 3).map((x) => String(x).slice(0, 400)) : `no terminó en ${Math.round((Date.now() - t0) / 1000)} s` }));
  }
  ws.close();
} finally {
  chrome.kill();
  await dormir(500);
  try { rmSync(perfil, { recursive: true, force: true }); } catch { /* Chrome todavía suelta archivos */ }
}
