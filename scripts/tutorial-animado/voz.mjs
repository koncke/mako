// TTS (eleven_v4 + Martín's professional clone, the rule in LA-CONFIG.json "_para_texto_sin_video") and forced alignment.
//   node voz.mjs tts <texto.txt> <salida.mp3>
//   node voz.mjs alinear <audio.mp3> <texto.txt> <salida.json>
// The key is read from the repo's .env.local and never printed.
import { readFileSync, writeFileSync } from 'node:fs';
const env = readFileSync('C:/Users/marti/OneDrive/Escritorio/dashboard-marketing-main/dashboard-marketing/.env.local', 'utf8');
const KEY = (env.match(/^\s*ELEVENLABS_API_KEY\s*=\s*(.+?)\s*$/m) || [])[1]?.replace(/^["']|["']$/g, '');
if (!KEY) { console.log('falta ELEVENLABS_API_KEY'); process.exit(2); }
const CFG = JSON.parse(readFileSync('C:/dev/reel-mentores/voz/LA-CONFIG.json', 'utf8'))._para_texto_sin_video;
const [modo, a, b, c] = process.argv.slice(2);

if (modo === 'tts') {
  const text = readFileSync(a, 'utf8').trim();
  const body = { text, model_id: CFG.model_id };
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${CFG.voz}?output_format=mp3_44100_192`, {
    method: 'POST', headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' }, body: JSON.stringify(body) });
  if (!r.ok) { console.log('FALLÓ', r.status, (await r.text()).slice(0, 300)); process.exit(1); }
  writeFileSync(b, Buffer.from(await r.arrayBuffer()));
  console.log('OK', b, '| modelo', CFG.model_id, '| voz', CFG.voz, '| caracteres', text.length, '| cobrados:', r.headers.get('character-cost') || r.headers.get('x-character-count') || '?');
} else if (modo === 'alinear') {
  const fd = new FormData();
  fd.append('file', new Blob([readFileSync(a)], { type: 'audio/mpeg' }), 'a.mp3');
  fd.append('text', readFileSync(b, 'utf8').trim());
  const r = await fetch('https://api.elevenlabs.io/v1/forced-alignment', { method: 'POST', headers: { 'xi-api-key': KEY }, body: fd });
  if (!r.ok) { console.log('FALLÓ', r.status, (await r.text()).slice(0, 300)); process.exit(1); }
  const j = await r.json();
  writeFileSync(c, JSON.stringify(j));
  console.log('OK', c, '| palabras', (j.words || []).length, '|', (j.words || []).map((w) => `${w.text}@${w.start.toFixed(2)}`).join(' '));
}
