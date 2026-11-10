// Transcribe el audio de un clip y lo compara con el guion: palabras repetidas, faltantes o cambiadas,
// y cuánto dura el habla. Regla de Martín (9/11/2026): «repitió una palabra, eso no debería pasar.
// También te tienes que fijar eso.» Se corre ANTES de entregar cada clip.
//   node chequear-guion.mjs <clip.mp4> "<guion exacto>"
// Usa ElevenLabs speech-to-text (scribe_v1); la clave sale de .env.local y nunca se imprime.
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [clip, guion] = process.argv.slice(2);
if (!clip || !guion) { console.log('uso: node chequear-guion.mjs <clip.mp4> "<guion>"'); process.exit(2); }
const env = readFileSync('C:/Users/marti/OneDrive/Escritorio/dashboard-marketing-main/dashboard-marketing/.env.local', 'utf8');
const KEY = (env.match(/^ELEVENLABS_API_KEY=(.+)$/m) || [])[1]?.trim().replace(/^["']|["']$/g, '');
if (!KEY) { console.log('falta ELEVENLABS_API_KEY'); process.exit(2); }

const T = mkdtempSync(join(tmpdir(), 'guion-'));
const mp3 = join(T, 'a.mp3');
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', clip, '-vn', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '128k', mp3]);
const fd = new FormData();
fd.append('file', new Blob([readFileSync(mp3)], { type: 'audio/mpeg' }), 'a.mp3');
fd.append('model_id', 'scribe_v1');
fd.append('language_code', 'spa');
fd.append('timestamps_granularity', 'word');
const r = await fetch('https://api.elevenlabs.io/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': KEY }, body: fd });
rmSync(T, { recursive: true, force: true });
if (!r.ok) { console.log('FALLÓ la transcripción', r.status, (await r.text()).slice(0, 200)); process.exit(2); }
const j = await r.json();

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9ñ ]/g, ' ').split(/\s+/).filter(Boolean);
const esperado = norm(guion);
const palabras = (j.words || []).filter((w) => w.type === 'word');
const oido = norm(palabras.map((w) => w.text).join(' '));

// Alineación por distancia de edición (palabra a palabra) para nombrar cada diferencia.
const n = esperado.length, m = oido.length;
const D = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, k) => (i === 0 ? k : k === 0 ? i : 0)));
for (let i = 1; i <= n; i++) for (let k = 1; k <= m; k++)
  D[i][k] = Math.min(D[i - 1][k] + 1, D[i][k - 1] + 1, D[i - 1][k - 1] + (esperado[i - 1] === oido[k - 1] ? 0 : 1));
const dif = [];
for (let i = n, k = m; i > 0 || k > 0;) {
  if (i > 0 && k > 0 && esperado[i - 1] === oido[k - 1] && D[i][k] === D[i - 1][k - 1]) { i--; k--; continue; }
  if (i > 0 && k > 0 && D[i][k] === D[i - 1][k - 1] + 1) { dif.unshift(`cambiada: «${esperado[i - 1]}» → «${oido[k - 1]}»`); i--; k--; continue; }
  if (k > 0 && D[i][k] === D[i][k - 1] + 1) {
    const w = oido[k - 1];
    const cerca = esperado.slice(Math.max(0, i - 3), i + 2).some((e) => e === w || e.startsWith(w) || w.startsWith(e));
    dif.unshift(`${cerca ? 'REPETIDA' : 'de más'}: «${w}»`); k--; continue;
  }
  dif.unshift(`falta: «${esperado[i - 1]}»`); i--;
}
const ini = palabras[0]?.start ?? 0, fin = palabras.at(-1)?.end ?? 0;
console.log(`guion: ${n} palabras · oído: ${m} palabras · habla de ${ini.toFixed(2)} s a ${fin.toFixed(2)} s (${(fin - ini).toFixed(2)} s, ${(m / Math.max(fin - ini, 0.1)).toFixed(2)} palabras/s)`);
console.log(`transcripción: «${j.text?.trim()}»`);
if (dif.length === 0) console.log('✅ dice exactamente el guion');
else { console.log('⚠️ diferencias:\n  - ' + dif.join('\n  - ')); process.exitCode = 1; }
