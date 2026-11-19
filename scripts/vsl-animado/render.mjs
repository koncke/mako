// Fotos y MP4 del VSL (1920×1080), varias secciones en UN solo turno del navegador (la fila de la PC es larga: pedir un
// turno por sección dejaba pasar a todos los demás entre una y otra).
//   node render.mjs fotos "<sec>=t1,t2;<sec>=t1,t2" <salida-dir>   → <salida-dir>/<sec>/<sec>-<t>.jpg
//   node render.mjs video "<sec>,<sec>" <salida-dir> [fps=30]        → <salida-dir>/<sec>.mp4, cada una con su voz
// Siempre por el turno de la PC: node C:/dev/artefactos-animaciones/tools/turno.mjs node render.mjs …
// Sin servidor: Playwright sirve C:/dev/vsl-video como http://vsl.local/. Cada cuadro sale de window.__seek(t) y espera
// a que carguen las imágenes del cuadro (las grabaciones de la app cambian de archivo en cada cuadro): window.__esperar().
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
const require = createRequire('C:/dev/playwright-medidor/package.json');
const { chromium } = require('playwright');

const [modo, spec, out, arg] = process.argv.slice(2);
const GNOM = (process.env.GUION || 'guion.json').replace(/\.json$/, '');
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', (e) => console.log('error de página:', e.message));
page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') console.log('consola:', m.text()); });
await page.route('http://vsl.local/**', (route) => {
  const p = decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\/+/, '');
  route.fulfill({ path: 'C:/dev/vsl-video/' + p }).catch(() => route.fulfill({ status: 404, body: '' }));
});
const cargar = async (sec) => {
  await page.goto(`http://vsl.local/vsl.html?sec=${sec}&g=${GNOM}&cap&t=0`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
  return JSON.parse(readFileSync(`C:/dev/vsl-video/trabajo/${sec}/tiempos.json`, 'utf8')).anchors.end;
};
// UN seek por cuadro (como series/tools/render-gl.mjs de la galería): el Martín en cubos se dibuja dentro de __seek con
// preserveDrawingBuffer, así que un segundo seek sólo duplicaba el render 3D. Lo que sí hay que esperar son las imágenes.
const foto = async (t, path, q = 92) => {
  await page.evaluate((x) => window.__seek(x), t);
  await page.evaluate(() => window.__esperar());
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.screenshot({ path, type: 'jpeg', quality: q });
};
const t0 = Date.now(); const seg = () => ((Date.now() - t0) / 1000).toFixed(0) + ' s';
if (modo === 'fotos') {
  for (const parte of spec.split(';').filter(Boolean)) {
    const [sec, ts] = parte.split('='); const dur = await cargar(sec); const dir = join(out, sec);
    rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
    for (const t of ts.split(',').map(Number)) await foto(Math.min(t, dur - 0.01), join(dir, `${sec}-${t.toFixed(2)}.jpg`), 85);
    console.log(`fotos de ${sec} listas (${seg()})`);
  }
} else {
  const fps = +(arg || 30);
  for (const sec of spec.split(',').filter(Boolean)) {
    const dur = await cargar(sec); const n = Math.round(dur * fps);
    const tmp = join(out, '_cuadros_' + sec); rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true });
    for (let i = 0; i < n; i++) {
      await foto(i / fps, join(tmp, String(i).padStart(5, '0') + '.jpg'));
      if (i % 300 === 0) console.log(`${sec}: cuadro ${i}/${n} · ${seg()}`);
    }
    const voz = `C:/dev/vsl-video/trabajo/${sec}/voz.mp3`; const mp4 = join(out, sec + '.mp4');
    const r = spawnSync('ffmpeg', ['-y', '-v', 'error', '-framerate', String(fps), '-i', join(tmp, '%05d.jpg'), '-i', voz,
      '-filter_complex', '[1:a]apad[a]', '-map', '0:v', '-map', '[a]', '-c:a', 'aac', '-b:a', '192k', '-ar', '44100',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(fps), '-t', String(n / fps), mp4], { stdio: 'inherit' });
    if (r.status === 0) { rmSync(tmp, { recursive: true, force: true }); console.log(`LISTO ${mp4}: ${n} cuadros (${seg()})`); }
    else console.log('ffmpeg falló; los cuadros quedan en', tmp);
  }
}
await browser.close();
