// La RÉPLICA: ¿la plantilla de la app, con los datos del ejemplo, da el mismo video que la galería?
// Arma el MP4 en Chromium con el MISMO código que usa la pantalla (banco.ts → app/ai-avatar/cubos/mp4.ts), sin `next dev`:
// sirve public/ como archivos y le pasa los tiempos y la voz de la galería. Después saca cuadros de los dos MP4 con ffmpeg y
// los compara (diferencia media por píxel y % de píxeles que cambian más de 24/255), con una hoja lado a lado para MIRAR.
//
//   node scripts/avatar-cubos/replica.mjs <formato> <carpeta-salida> [segundos=todo] [t1,t2,...]
//   (desde el worktree; el navegador va por la fila de C:/dev/artefactos-animaciones/tools/turno.mjs)
// Necesita: el Chromium de C:/dev/playwright-medidor, ffmpeg en el PATH, Python con PIL y la galería en C:/dev/artefactos-animaciones.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';

const require = createRequire('C:/dev/playwright-medidor/package.json');
const { chromium } = require('playwright');
const GALERIA = 'C:/dev/artefactos-animaciones/';
const PUBLICO = resolve('public');
const [id = 'punch-captions', salida = 'replica-' + id, segS, tsS] = process.argv.slice(2);
await mkdir(salida, { recursive: true });

// el banco, empaquetado como lo haría la app
const b = await build({ entryPoints: ['scripts/avatar-cubos/banco.ts'], bundle: true, format: 'iife', write: false, platform: 'browser', target: 'chrome120', alias: { '@': resolve('.') } });
const BANCO_JS = b.outputFiles[0].text;
const tiemposJs = await readFile(join(GALERIA, 'reels', `t-${id}.js`), 'utf8');
const TIEMPOS = JSON.parse(tiemposJs.replace(/^window\.TIEMPOS\s*=\s*/, '').replace(/;\s*$/, ''));

const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4' };
const srv = createServer(async (q, r) => {
  const p = decodeURIComponent(new URL(q.url, 'http://x').pathname);
  try {
    if (p === '/__banco/') { r.writeHead(200, { 'content-type': TIPOS['.html'] }); r.end('<!doctype html><meta charset="utf-8"><body style="margin:0"><script src="/__banco/banco.js"></script>'); return; }
    if (p === '/__banco/banco.js') { r.writeHead(200, { 'content-type': TIPOS['.js'] }); r.end(BANCO_JS); return; }
    if (p === '/__banco/voz.mp3') { r.writeHead(200, { 'content-type': TIPOS['.mp3'] }); r.end(await readFile(join(GALERIA, 'reels', `voz-${id}.mp3`))); return; }
    const f = join(PUBLICO, p); r.writeHead(200, { 'content-type': TIPOS[extname(p)] || 'application/octet-stream' }); r.end(await readFile(f));
  } catch { r.writeHead(404); r.end(); }
}).listen(8798);

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 2000 } });
page.on('pageerror', (e) => console.log('error de página:', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('consola:', m.text().slice(0, 300)); });
await page.goto('http://localhost:8798/__banco/');
const r = await page.evaluate((o) => window.BANCO(o), { id, tiempos: TIEMPOS, voz: '/__banco/voz.mp3', segundos: segS ? +segS : undefined });
await browser.close(); srv.close();
const app = join(salida, 'app.mp4');
await writeFile(app, Buffer.from(r.mp4, 'base64'));
console.log('MP4 de la app:', app, '·', JSON.stringify(r.ms));

// cuadros de los dos MP4 en los mismos segundos
const dur = segS ? +segS : TIEMPOS.anchors.end;
const ts = tsS ? tsS.split(',').map(Number) : [0.5, 1.5, 3, 4.5, 6, 7.5, 9, 10.5, 12, 13.5].filter((t) => t < dur - 0.05);
for (const t of ts) {
  for (const [nombre, mp4] of [['ref', join(GALERIA, 'mp4', `${id}.mp4`)], ['fo', app]]) {
    spawnSync('ffmpeg', ['-y', '-v', 'error', '-ss', String(t), '-i', mp4, '-frames:v', '1', join(salida, `${nombre}-${t}.png`)], { stdio: 'inherit' });
  }
}
const c = spawnSync('python', ['-I', resolve('scripts/avatar-cubos/comparar.py'), salida], { encoding: 'utf8' });
console.log(c.stdout || c.stderr);
