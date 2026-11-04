// =============================================================================
// probar-grabadora-navegador — la grabadora de llamadas con AUDIO DE VERDAD, en Chromium (04/11/2026)
// =============================================================================
// Corre el código REAL de app/_components/grabar/grabadora.ts en un Chromium con un micrófono falso que suena desde un archivo
// (una voz sintetizada con ffmpeg/flite), y mide lo que sube a /api/crm/llamadas-grabadas (interceptado: no hay servidor ni base).
//
//   1. sólo el micrófono: partes enteras (cada una abre sola: cabecera EBML), una tras otra, que juntas duran lo grabado, con
//      voz adentro (no silencio), y el «terminar» con el número de partes y la duración;
//   2. el micrófono MÁS la pestaña de la llamada: la pestaña se simula con un tono de 1 kHz (getDisplayMedia de mentira), y el
//      audio grabado tiene que traer el tono Y la voz — es lo que prueba que la mezcla no sale muda.
//
// Las partes se acortan a 4 s (el archivo de reglas se reescribe SÓLO en el bundle de la prueba): con 3 min, la prueba tardaría.
//
// Lo que NO prueba: la transcripción ni el análisis (piden la IA de un negocio), ni un teléfono ni Safari de verdad.
//
// Correr: node scripts/probar-grabadora-navegador.mjs        (pide ffmpeg y el Chromium de Playwright)
// =============================================================================

import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Playwright viene instalado en la máquina (no en el repo): se pide con `require`, que mira NODE_PATH.
const { chromium } = createRequire(import.meta.url)('playwright');
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = mkdtempSync(join(tmpdir(), 'grabadora-'));
const SEG_PARTE = 4;

// ── La voz ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
const VOZ = join(DIR, 'voz.wav');
execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i',
  "flite=text='Hello, this is a test call. We are talking about the offer, the price and the next meeting. Can we talk on Thursday? Yes, Thursday at ten works for me.':voice=slt",
  '-ar', '48000', '-ac', '1', VOZ]);

// ── El código real, en un bundle para el navegador ──────────────────────────────────────────────────────────────────────
const bundle = await build({
  entryPoints: [join(RAIZ, 'app/_components/grabar/grabadora.ts')],
  bundle: true, write: false, format: 'iife', globalName: 'Grabadora', platform: 'browser', target: 'es2020',
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [{
    name: 'alias-y-partes-cortas',
    setup(b) {
      b.onResolve({ filter: /^@\// }, (a) => ({ path: join(RAIZ, a.path.slice(2) + (a.path.endsWith('.ts') ? '' : '.ts')) }));
      b.onLoad({ filter: /grabar-llamada-reglas\.ts$/ }, (a) => ({
        loader: 'ts',
        contents: readFileSync(a.path, 'utf8').replace(/export const SEGUNDOS_POR_PARTE = \d+;/, `export const SEGUNDOS_POR_PARTE = ${SEG_PARTE};`),
      }));
    },
  }],
});
const JS = bundle.outputFiles[0].text;

// ── El multipart, a mano (lo que manda el navegador de verdad) ──────────────────────────────────────────────────────────
function partesDelMultipart(buf, tipo) {
  const borde = Buffer.from('--' + /boundary=([^;]+)/.exec(tipo)[1]);
  const out = {};
  let i = buf.indexOf(borde);
  while (i >= 0) {
    const j = buf.indexOf(borde, i + borde.length);
    if (j < 0) break;
    const trozo = buf.subarray(i + borde.length + 2, j - 2);
    const fin = trozo.indexOf('\r\n\r\n');
    const cab = trozo.subarray(0, fin).toString();
    const nombre = /name="([^"]+)"/.exec(cab)?.[1];
    if (nombre) out[nombre] = trozo.subarray(fin + 4);
    i = j;
  }
  return out;
}

const ffprobeDur = (f) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim());
/** El volumen medio (dB) de un archivo, filtrado a una banda (ffmpeg lo escribe en stderr). */
function dbMedio(f, filtro) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', f, '-af', `${filtro},volumedetect`, '-f', 'null', '-'], { encoding: 'utf8' });
  const m = /mean_volume: (-?[\d.]+) dB/.exec(r.stderr ?? '');
  return m ? Number(m[1]) : null;
}

async function correr({ conPestana, segundos }) {
  const navegador = await chromium.launch({
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${VOZ}`],
  });
  const pagina = await navegador.newPage();
  const subidas = [];
  let terminar = null;
  await pagina.route('http://localhost/**', async (ruta) => {
    const req = ruta.request();
    const url = new URL(req.url());
    if (url.pathname === '/') return ruta.fulfill({ contentType: 'text/html', body: `<!doctype html><meta charset="utf-8"><button id="b">grabar</button><script>${JS}</script>` });
    if (url.pathname === '/api/crm/llamadas-grabadas' && req.method() === 'POST') {
      const tipo = req.headers()['content-type'] ?? '';
      if (tipo.startsWith('multipart/form-data')) {
        const p = partesDelMultipart(req.postDataBuffer(), tipo);
        subidas.push({ n: Number(p.n.toString()), inicio: Number(p.inicio.toString()), segundos: Number(p.segundos.toString()), audio: p.audio });
        return ruta.fulfill({ contentType: 'application/json', body: '{"ok":true}' });
      }
      const b = JSON.parse(req.postData() ?? '{}');
      if (b.accion === 'empezar') return ruta.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, id: '3f2b8c1e-9a4d-4c6b-8e2f-0a1b2c3d4e5f', fuente: b.fuente, mime: b.mime }) });
      if (b.accion === 'terminar') { terminar = b; return ruta.fulfill({ contentType: 'application/json', body: '{"ok":true}' }); }
      return ruta.fulfill({ contentType: 'application/json', body: '{"ok":true}' });
    }
    return ruta.fulfill({ status: 404, body: '' });
  });
  await pagina.goto('http://localhost/');
  if (conPestana) {
    // La pestaña de la llamada: un tono de 1 kHz (con un video que la grabadora apaga, como el de Chrome).
    await pagina.evaluate(() => {
      Object.defineProperty(navigator, 'userAgentData', { value: { brands: [] }, configurable: true });
      navigator.mediaDevices.getDisplayMedia = async () => {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator(); osc.frequency.value = 1000;
        const g = ctx.createGain(); g.gain.value = 0.3;
        const dest = ctx.createMediaStreamDestination();
        osc.connect(g).connect(dest); osc.start();
        const lienzo = document.createElement('canvas');
        const video = lienzo.captureStream(1).getVideoTracks();
        return new MediaStream([...dest.stream.getAudioTracks(), ...video]);
      };
    });
  }
  // El toque: empezar va adentro del clic (la pestaña y el AudioContext lo necesitan).
  await pagina.evaluate((conPestana) => {
    window.__estado = [];
    document.getElementById('b').onclick = () => { void Grabadora.empezar({ leadId: 41, leadNombre: 'Prueba', origen: 'ficha', conPestana }); };
  }, conPestana);
  await pagina.click('#b');
  await pagina.waitForTimeout(segundos * 1000);
  await pagina.evaluate(() => Grabadora.cortar());
  await pagina.waitForTimeout(500);
  await navegador.close();
  return { subidas: subidas.sort((a, b) => a.n - b.n), terminar };
}

const fallas = [];
const afirmar = (ok, que) => { console.log(`${ok ? '✓' : '✗'} ${que}`); if (!ok) fallas.push(que); };

for (const caso of [{ conPestana: false, segundos: 11 }, { conPestana: true, segundos: 9 }]) {
  console.log(`\n── ${caso.conPestana ? 'micrófono + pestaña (tono de 1 kHz)' : 'sólo el micrófono'}, ${caso.segundos} s ──`);
  const { subidas, terminar } = await correr(caso);
  const esperadas = Math.ceil(caso.segundos / SEG_PARTE);
  afirmar(subidas.length === esperadas, `${subidas.length} partes subidas (se esperaban ${esperadas})`);
  afirmar(subidas.every((s, i) => s.n === i), 'numeradas desde 0, sin huecos');
  afirmar(terminar?.partes === subidas.length, `«terminar» con partes=${terminar?.partes}`);
  afirmar(Math.abs((terminar?.duracion ?? 0) - caso.segundos) <= 1, `«terminar» con duracion=${terminar?.duracion} s`);
  let total = 0;
  const archivos = [];
  for (const s of subidas) {
    const f = join(DIR, `${caso.conPestana ? 'mix' : 'mic'}-${s.n}.webm`);
    writeFileSync(f, s.audio);
    archivos.push(f);
    const ebml = s.audio[0] === 0x1a && s.audio[1] === 0x45 && s.audio[2] === 0xdf && s.audio[3] === 0xa3;
    afirmar(ebml, `parte ${s.n}: abre sola (cabecera EBML), ${s.audio.length} bytes, empieza en ${s.inicio} s`);
    // Un webm de MediaRecorder no trae la duración en la cabecera: se mide decodificándolo.
    const dec = join(DIR, `${caso.conPestana ? 'mix' : 'mic'}-${s.n}.wav`);
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', f, dec]);
    const d = ffprobeDur(dec);
    total += d;
    afirmar(d > 0.5, `parte ${s.n}: se decodifica (${d.toFixed(2)} s de audio)`);
  }
  afirmar(Math.abs(total - caso.segundos) <= 1.5, `las partes suman ${total.toFixed(2)} s de ${caso.segundos} grabados`);
  const junto = join(DIR, `${caso.conPestana ? 'mix' : 'mic'}-junto.wav`);
  writeFileSync(join(DIR, 'lista.txt'), archivos.map((f) => `file '${f.replace(/\.webm$/, '.wav')}'`).join('\n'));
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', join(DIR, 'lista.txt'), junto]);
  const voz = dbMedio(junto, 'bandpass=f=300:width_type=h:w=400');
  afirmar(voz != null && voz > -55, `hay voz (banda de la voz: ${voz} dB)`);
  if (caso.conPestana) {
    const tono = dbMedio(junto, 'bandpass=f=1000:width_type=h:w=40');
    afirmar(tono != null && tono > -40, `hay pestaña (el tono de 1 kHz: ${tono} dB): la mezcla no salió muda`);
  }
}

console.log(`\nArchivos en ${DIR}`);
if (fallas.length) { console.error(`\n${fallas.length} falla(s)`); process.exit(1); }
console.log('\nVERDE: la grabadora graba, parte y sube audio de verdad.');
