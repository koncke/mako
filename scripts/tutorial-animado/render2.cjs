// Frame-by-frame render of <dir>/tutorial.html (window.renderFrame(t)) with headless Chromium → ffmpeg, then voice + music.
//   node render2.cjs <dir> <salida.mp4>            → the whole video
//   node render2.cjs <dir> - "700,4700,9000"       → only those frames, as <dir>/cuadro-<t>.png (to LOOK before rendering)
// Music: C:/dev/reel-mentores/montaje/musica-eleven.mp3 (ElevenLabs Music, commercial license of the plan), low under the voice:
// the July VSL chain (85 Hz -5 dB, 2.6 kHz -3 dB) and -14.8 dB, which puts it near -30 LUFS against the voice at -14.
const { chromium } = require('C:/dev/playwright-medidor/node_modules/playwright-core');
const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const [DIR, SALIDA, SOLO_ARG] = process.argv.slice(2);
const FPS = 30;
const MUSICA = 'C:/dev/reel-mentores/montaje/musica-eleven.mp3';
const SOLO = SOLO_ARG ? SOLO_ARG.split(',').map(Number) : null;

(async () => {
  const t0 = Date.now();
  const b = await chromium.launch({ args: ['--allow-file-access-from-files', '--mute-audio', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });   // the GPU: the character (WebGL) is 35 ms a frame there, 210 in software
  const p = await (await b.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  await p.goto('file:///' + path.resolve(DIR, 'tutorial.html').split(path.sep).join('/'));
  await p.evaluate(async () => { await document.fonts.ready; await document.fonts.load("800 120px 'Geist'"); await window.assetsReady; });
  if (!(await p.evaluate(() => document.fonts.check("800 120px 'Geist'")))) errores.push('Geist no cargó');
  if (errores.length) { console.log('ERRORES:', errores.join(' | ')); }
  const cuadro = (t) => p.evaluate((tt) => { window.renderFrame(tt); return document.getElementById('c').toDataURL('image/png').split(',')[1]; }, t);
  if (SOLO) {
    for (const t of SOLO) fs.writeFileSync(path.join(DIR, `cuadro-${t}.png`), Buffer.from(await cuadro(t), 'base64'));
    // the covered-letters rule, measured on every big screen (engine3.js → medirTapado)
    const tapado = [];
    for (const t of SOLO) { const m = await p.evaluate((tt) => (window.medirTapado ? window.medirTapado(tt) : null), t); if (m) tapado.push(m); }
    fs.writeFileSync(path.join(DIR, 'tapado.json'), JSON.stringify(tapado, null, 1));
    for (const m of tapado) console.log(m.ok ? 'tapado ok:' : '⚠️ TAPA DE MÁS:', m.texto.slice(0, 40), m.palabras.map((w) => `${w.palabra} ${Math.round(w.visible * 100)}% desde ${Math.round(w.tapadoDesde * 100)}%`).join(', '));
    await b.close(); console.log('cuadros:', SOLO.join(', ')); return;
  }
  const DUR = await p.evaluate(() => window.DUR);
  const N = Math.ceil(DUR / 1000 * FPS);
  const mudo = path.join(DIR, 'mudo.mp4');
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-crf', '20', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-r', String(FPS), mudo], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let i = 0; i < N; i++) {
    const buf = Buffer.from(await cuadro(i * 1000 / FPS), 'base64');
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  await b.close();
  const dur = (N / FPS).toFixed(3), fin = Math.max(0, N / FPS - 1.2).toFixed(3);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', mudo, '-i', path.join(DIR, 'voz.mp3'), '-stream_loop', '-1', '-i', MUSICA,
    '-filter_complex',
    `[1:a]loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[v];` +
    `[2:a]atrim=0:${dur},asetpts=PTS-STARTPTS,equalizer=f=85:width_type=q:w=0.9:g=-5,equalizer=f=2600:width_type=q:w=1.2:g=-3,` +
    `volume=-14.8dB,afade=t=in:d=0.5,afade=t=out:st=${fin}:d=1.2,aresample=48000[m];` +
    `[v][m]amix=inputs=2:normalize=0:duration=longest,alimiter=limit=0.95:level=disabled,atrim=0:${dur}[a]`,
    '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', dur, '-movflags', '+faststart', SALIDA]);
  console.log(`listo ${path.basename(SALIDA)} · ${N} cuadros · ${dur} s · ${((Date.now() - t0) / 1000).toFixed(0)} s de render`);
})();
