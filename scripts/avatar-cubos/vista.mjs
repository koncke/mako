// La PANTALLA del personaje en cubos, de verdad y sin `next dev` (que traba la PC): esbuild empaqueta el componente real
// (app/ai-avatar/cubos/EstudioCubos.tsx) con las server actions falsas (./acciones-falsas.ts), el CSS de la app sale de
// globals.css con Tailwind, y Chromium lo maneja como una persona: mira el personaje, pasa a «Video», pide el guion, aprieta
// «Crear video» y «Descargar MP4». El MP4 que baja se compara cuadro por cuadro con el de la galería, y quedan capturas a
// 1440 y 375 para MIRAR.
//
//   node scripts/avatar-cubos/vista.mjs <carpeta-salida> [formato=punch-captions] [--sin-mp4]
//   (desde el worktree; el navegador va por la fila de C:/dev/artefactos-animaciones/tools/turno.mjs)
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';

const RAIZ = resolve('.');
const requerir = createRequire(join(RAIZ, 'package.json'));
const { chromium } = createRequire('C:/dev/playwright-medidor/package.json')('playwright');
const GALERIA = 'C:/dev/artefactos-animaciones/';
const args = process.argv.slice(2);
const [salida = 'vista-cubos', id = 'punch-captions'] = args.filter((a) => !a.startsWith('--'));
const conMp4 = !args.includes('--sin-mp4');
await mkdir(salida, { recursive: true });

// 1. el componente real, con las actions falsas
const b = await build({
  entryPoints: ['scripts/avatar-cubos/vista-entrada.tsx'], bundle: true, format: 'iife', write: false, outdir: 'x', platform: 'browser',
  target: 'chrome120', jsx: 'automatic', alias: { '@': RAIZ }, define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'error',
  plugins: [{ name: 'acciones-falsas', setup(bb) {
    bb.onResolve({ filter: /^\.\/actions$/ }, (a) => (a.importer.replace(/\\/g, '/').endsWith('app/ai-avatar/cubos/EstudioCubos.tsx') ? { path: resolve('scripts/avatar-cubos/acciones-falsas.ts') } : undefined));
  } }],
});
const JS = b.outputFiles.find((f) => f.path.endsWith('.js')).text;
const CSS_COMP = b.outputFiles.find((f) => f.path.endsWith('.css'))?.text ?? '';
// 2. el CSS de la app (los tokens de claro y oscuro)
const postcss = requerir('postcss'), tailwind = requerir('@tailwindcss/postcss');
const g = join(RAIZ, 'app/globals.css');
const CSS_APP = (await postcss([tailwind({ base: RAIZ })]).process(readFileSync(g, 'utf8'), { from: g })).css;
const tiempos = {};
for (const f of ['punch-captions', 'karaoke-subs']) tiempos[f] = JSON.parse(readFileSync(join(GALERIA, 'reels', `t-${f}.js`), 'utf8').replace(/^window\.TIEMPOS\s*=\s*/, '').replace(/;\s*$/, ''));
const PAGINA = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Personaje en cubos</title><style>${CSS_APP}\n${CSS_COMP}</style></head><body style="margin:0"><div id="raiz"></div>
<script>window.__TIEMPOS_EJEMPLO = ${JSON.stringify(tiempos)};</script><script src="/__vista/app.js"></script></body></html>`;

const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.mp3': 'audio/mpeg', '.jpg': 'image/jpeg' };
const srv = createServer(async (q, r) => {
  const p = decodeURIComponent(new URL(q.url, 'http://x').pathname);
  try {
    if (p === '/') { r.writeHead(200, { 'content-type': TIPOS['.html'] }); r.end(PAGINA); return; }
    if (p === '/__vista/app.js') { r.writeHead(200, { 'content-type': TIPOS['.js'] }); r.end(JS); return; }
    const voz = /^\/__vista\/voz-([a-z-]+)\.mp3$/.exec(p);
    if (voz) { r.writeHead(200, { 'content-type': TIPOS['.mp3'] }); r.end(await readFile(join(GALERIA, 'reels', `voz-${voz[1]}.mp3`))); return; }
    r.writeHead(200, { 'content-type': TIPOS[extname(p)] || 'application/octet-stream' }); r.end(await readFile(join(RAIZ, 'public', p)));
  } catch { r.writeHead(404); r.end(); }
}).listen(8797);

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('error de página:', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('consola:', m.text().slice(0, 300)); });
const foto = async (n) => { await page.waitForTimeout(2500); await page.screenshot({ path: join(salida, n) }); console.log('captura', n); };
const t0 = Date.now();
await page.goto('http://localhost:8797/');
await page.waitForSelector('.cb-titulo');
await foto('01-personaje-1440.png');
await page.getByRole('tab', { name: 'Video' }).click();
await page.locator('.cb-formato', { hasText: id === 'karaoke-subs' ? 'Subtítulos karaoke' : 'Palabras gigantes' }).click();
await page.getByPlaceholder('Idea del video en una línea').fill('Por qué la oferta importa más que el precio');
await page.getByRole('button', { name: 'Que lo escriba MaKo' }).click();
await page.waitForFunction(() => document.querySelector('.cb-guion')?.value.length > 20);
await foto('02-video-1440.png');
await page.getByRole('button', { name: 'Crear video' }).click();
await page.getByRole('button', { name: 'Descargar MP4' }).waitFor({ timeout: 60_000 });
await page.waitForFunction(() => !document.querySelector('.cb-acciones .cb-crear')?.disabled, null, { timeout: 60_000 });
await foto('03-creado-1440.png');
if (conMp4) {
  const bajada = page.waitForEvent('download', { timeout: 20 * 60_000 });
  await page.getByRole('button', { name: 'Descargar MP4' }).click();
  await page.waitForTimeout(8000);
  await page.screenshot({ path: join(salida, '04-armando-1440.png') });
  const d = await bajada;
  await d.saveAs(join(salida, 'app.mp4'));
  console.log('MP4 de la pantalla en', ((Date.now() - t0) / 1000).toFixed(0), 's');
}
// el personaje cambiado (lo que hace «Armar con mi foto», a mano)
await page.getByRole('tab', { name: 'Tu personaje' }).click();
for (const n of ['Media', 'Negro', 'Corto', 'Azul', 'Lentes', 'Barba']) await page.getByRole('button', { name: n, exact: true }).first().click();
await foto('05-personaje-cambiado-1440.png');
await page.setViewportSize({ width: 375, height: 812 });
await foto('06-telefono-375.png');
await browser.close(); srv.close();

if (conMp4) {
  const ts = [0.5, 2, 4, 6, 8, 10, 12, 13.5];
  for (const t of ts) for (const [n, mp4] of [['ref', join(GALERIA, 'mp4', `${id}.mp4`)], ['fo', join(salida, 'app.mp4')]]) {
    spawnSync('ffmpeg', ['-y', '-v', 'error', '-ss', String(t), '-i', mp4, '-frames:v', '1', join(salida, `${n}-${t}.png`)], { stdio: 'inherit' });
  }
  const c = spawnSync('python', ['-I', resolve('scripts/avatar-cubos/comparar.py'), salida], { encoding: 'utf8' });
  console.log(c.stdout || c.stderr);
}
await writeFile(join(salida, 'listo.txt'), 'ok');
