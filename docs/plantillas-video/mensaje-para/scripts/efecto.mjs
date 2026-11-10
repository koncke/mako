// Genera UN efecto de sonido con ElevenLabs Sound Effects (POST /v1/sound-generation). La clave sale de .env.local.
//   node efecto.mjs <salida.mp3> <segundos> "<descripción en inglés>"
import { readFileSync, writeFileSync } from 'node:fs';
const [salida, seg, texto] = process.argv.slice(2);
const env = readFileSync('C:/Users/marti/OneDrive/Escritorio/dashboard-marketing-main/dashboard-marketing/.env.local', 'utf8');
const KEY = (env.match(/^ELEVENLABS_API_KEY=(.+)$/m) || [])[1]?.trim().replace(/^["']|["']$/g, '');
const r = await fetch('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_192', {
  method: 'POST', headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
  body: JSON.stringify({ text: texto, duration_seconds: +seg, prompt_influence: 0.5 }),
});
if (!r.ok) { console.log('FALLÓ', r.status, (await r.text()).slice(0, 300)); process.exitCode = 2; }
else { writeFileSync(salida, Buffer.from(await r.arrayBuffer())); console.log('ok', salida.split('/').pop()); }
