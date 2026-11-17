// Genera TTS con ElevenLabs. Lee la key del .env.local (no la imprime).
// Uso: node eleven-gen.js <texto.txt> <salida.mp3> [stability] [similarity] [style]
const fs = require('fs'), https = require('https');
const ENV = 'C:/Users/marti/OneDrive/Escritorio/dashboard-marketing-main/dashboard-marketing/.env.local';
const VOICE = 'id7LQ3n0ft94moeTT1ER';
const [, , TXT, OUT, stab, sim, sty, spd] = process.argv;

let KEY = process.env.ELEVENLABS_API_KEY || '';
if (!KEY) { try { const m = fs.readFileSync(ENV, 'utf8').match(/^\s*ELEVENLABS_API_KEY\s*=\s*(.+?)\s*$/m); KEY = m ? m[1].replace(/^["']|["']$/g, '') : ''; } catch (e) {} }
if (!KEY) { console.error('sin ELEVENLABS_API_KEY (ni env ni .env.local)'); process.exit(1); }

const text = fs.readFileSync(TXT, 'utf8');
const body = JSON.stringify({
  text,
  model_id: 'eleven_multilingual_v2',
  voice_settings: {
    stability: stab ? +stab : 0.35,
    similarity_boost: sim ? +sim : 0.85,
    style: sty ? +sty : 0.5,
    use_speaker_boost: true,
    speed: spd ? +spd : 1.08,
  },
});
console.log('chars (incl. tags):', text.length, '| voice:', VOICE, '| settings:', JSON.parse(body).voice_settings);

const req = https.request({
  hostname: 'api.elevenlabs.io',
  path: `/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`,
  method: 'POST',
  headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
}, res => {
  const chunks = [];
  res.on('data', c => chunks.push(c));
  res.on('end', () => {
    const buf = Buffer.concat(chunks);
    if (res.statusCode !== 200) { console.error('ERROR HTTP', res.statusCode, buf.toString('utf8').slice(0, 600)); process.exit(1); }
    fs.writeFileSync(OUT, buf);
    console.log('OK ->', OUT, '|', (buf.length / 1024).toFixed(0) + ' KB');
  });
});
req.on('error', e => { console.error('req err', e.message); process.exit(1); });
req.write(body); req.end();
