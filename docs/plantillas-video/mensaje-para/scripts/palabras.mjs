// Tiempos de cada palabra de un clip (ElevenLabs scribe_v1), para los subtítulos del montaje.
//   node palabras.mjs <clip.mp4> <salida.json>
// La clave sale de .env.local y nunca se imprime.
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [clip, salida] = process.argv.slice(2);
const env = readFileSync('C:/Users/marti/OneDrive/Escritorio/dashboard-marketing-main/dashboard-marketing/.env.local', 'utf8');
const KEY = (env.match(/^ELEVENLABS_API_KEY=(.+)$/m) || [])[1]?.trim().replace(/^["']|["']$/g, '');
const T = mkdtempSync(join(tmpdir(), 'pal-'));
const mp3 = join(T, 'a.mp3');
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', clip, '-vn', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '128k', mp3]);
const fd = new FormData();
fd.append('file', new Blob([readFileSync(mp3)], { type: 'audio/mpeg' }), 'a.mp3');
fd.append('model_id', 'scribe_v1');
fd.append('language_code', 'spa');
fd.append('timestamps_granularity', 'word');
const r = await fetch('https://api.elevenlabs.io/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': KEY }, body: fd });
rmSync(T, { recursive: true, force: true });
if (!r.ok) { console.log('FALLÓ', r.status, (await r.text()).slice(0, 200)); process.exitCode = 2; }
else {
  const j = await r.json();
  const w = (j.words || []).filter((x) => x.type === 'word').map((x) => ({ t: x.text, a: +x.start.toFixed(3), b: +x.end.toFixed(3) }));
  writeFileSync(salida, JSON.stringify({ texto: j.text?.trim(), palabras: w }, null, 1));
  console.log(salida.split('/').pop(), '·', w.length, 'palabras ·', w.map((x) => `${x.t}@${x.a}`).join(' '));
}
