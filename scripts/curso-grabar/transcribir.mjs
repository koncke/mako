// Transcribe un audio con ElevenLabs scribe (la clave sale de .env.local y nunca se imprime).
//   node transcribir.mjs <audio> <salida.json> [--modelo scribe_v1]
// Sube un mp3 mono de 64 kb/s (alcanza para voz) y guarda el texto y los tiempos por palabra.
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const [audio, salida] = args;
const modelo = args.includes('--modelo') ? args[args.indexOf('--modelo') + 1] : 'scribe_v1';
const env = readFileSync('C:/Users/marti/OneDrive/Escritorio/dashboard-marketing-main/dashboard-marketing/.env.local', 'utf8');
const KEY = (env.match(/^ELEVENLABS_API_KEY=(.+)$/m) || [])[1]?.trim().replace(/^["']|["']$/g, '');
if (!KEY) { console.log('FALLÓ sin ELEVENLABS_API_KEY'); process.exit(2); }
const T = mkdtempSync(join(tmpdir(), 'tx-'));
const mp3 = join(T, 'a.mp3');
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', audio, '-vn', '-ac', '1', '-ar', '22050', '-c:a', 'libmp3lame', '-b:a', '64k', mp3]);
const fd = new FormData();
fd.append('file', new Blob([readFileSync(mp3)], { type: 'audio/mpeg' }), 'a.mp3');
fd.append('model_id', modelo);
fd.append('language_code', 'spa');
fd.append('timestamps_granularity', 'word');
fd.append('tag_audio_events', 'false');
const t0 = Date.now();
const r = await fetch('https://api.elevenlabs.io/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': KEY }, body: fd });
rmSync(T, { recursive: true, force: true });
if (!r.ok) { console.log('FALLÓ', r.status, (await r.text()).slice(0, 300)); process.exit(2); }
const j = await r.json();
const w = (j.words || []).filter((x) => x.type === 'word').map((x) => ({ t: x.text, a: +x.start.toFixed(3), b: +x.end.toFixed(3) }));
writeFileSync(salida, JSON.stringify({ modelo, texto: (j.text || '').trim(), palabras: w }, null, 1));
console.log('OK', salida, '·', w.length, 'palabras ·', Math.round((Date.now() - t0) / 1000), 's');
