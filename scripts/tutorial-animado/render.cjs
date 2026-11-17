// Frame-by-frame render of tutorial.html (window.renderFrame(t)) with headless Chromium, piped to ffmpeg, then the voice on top.
// Same idea as the July VSL (cdp-render-b.js + assemble.sh), with Playwright instead of a raw CDP client.
//   node render.cjs [fps] [solo-cuadros: "0,1500,4800"]
const { chromium } = require('C:/dev/playwright-medidor/node_modules/playwright-core');
const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const DIR = __dirname;
const FPS = +(process.argv[2] || 30);
const SOLO = process.argv[3] ? process.argv[3].split(',').map(Number) : null;

(async () => {
  const t0 = Date.now();
  const b = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  const p = await (await b.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
  p.on('pageerror', (e) => console.log('pageerror', e.message));
  await p.goto('file:///' + path.join(DIR, 'tutorial.html').split(path.sep).join('/'));
  await p.evaluate(async () => { await document.fonts.ready; await document.fonts.load("800 120px 'Geist'"); await window.assetsReady; });
  const fuente = await p.evaluate(() => document.fonts.check("800 120px 'Geist'"));
  console.log('Geist cargada:', fuente);
  const cuadro = (t) => p.evaluate((tt) => { window.renderFrame(tt); return document.getElementById('c').toDataURL('image/png').split(',')[1]; }, t);
  if (SOLO) {
    for (const t of SOLO) fs.writeFileSync(path.join(DIR, `cuadro-${t}.png`), Buffer.from(await cuadro(t), 'base64'));
    await b.close(); console.log('cuadros:', SOLO.join(', ')); return;
  }
  const DUR = await p.evaluate(() => window.DUR);
  const N = Math.ceil(DUR / 1000 * FPS);
  const mudo = path.join(DIR, 'mudo.mp4');
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-r', String(FPS), mudo], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let i = 0; i < N; i++) {
    const buf = Buffer.from(await cuadro(i * 1000 / FPS), 'base64');
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  await b.close();
  console.log(`cuadros: ${N} a ${FPS} fps · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  // the voice: loudnorm like LA-CONFIG ("ElevenLabs entrega a -27 dB de media y suena bajito"), nothing else in the mix
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', mudo, '-i', path.join(DIR, 'voz.mp3'),
    '-filter_complex', '[1:a]loudnorm=I=-14:TP=-1:LRA=11,aresample=48000[a]', '-map', '0:v', '-map', '[a]',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', path.join(DIR, 'tutorial-second-brain.mp4')]);
  console.log('listo:', path.join(DIR, 'tutorial-second-brain.mp4'), `· total ${((Date.now() - t0) / 1000).toFixed(1)} s`);
})();
