// Genera UNA pista instrumental con ElevenLabs Music (licencia comercial del plan), para el fondo del reel.
//   node musica.mjs <salida.mp3> <segundos> "<prompt>"
import { readFileSync, writeFileSync } from 'node:fs';
const [salida, seg, prompt] = process.argv.slice(2);
const env = readFileSync('C:/Users/marti/OneDrive/Escritorio/dashboard-marketing-main/dashboard-marketing/.env.local', 'utf8');
const KEY = (env.match(/^ELEVENLABS_API_KEY=(.+)$/m) || [])[1]?.trim().replace(/^["']|["']$/g, '');
const t0 = Date.now();
const r = await fetch('https://api.elevenlabs.io/v1/music?output_format=mp3_44100_192', {
  method: 'POST', headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
  body: JSON.stringify({ prompt, music_length_ms: Math.round(+seg * 1000), model_id: 'music_v1', force_instrumental: true }),
});
if (!r.ok) { console.log('FALLÓ', r.status, (await r.text()).slice(0, 400)); process.exitCode = 2; }
else { writeFileSync(salida, Buffer.from(await r.arrayBuffer())); console.log('ok', salida, ((Date.now() - t0) / 1000).toFixed(1), 's', r.headers.get('character-cost') || r.headers.get('x-character-count') || ''); }
