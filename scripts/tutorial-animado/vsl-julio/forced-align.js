// Forced alignment con ElevenLabs: audio + transcript -> {characters, words} con tiempos.
// Uso: node forced-align.js <audio.mp3> <texto.txt> <salida.json>
const fs = require('fs'), https = require('https');
const ENV = 'C:/Users/marti/OneDrive/Escritorio/dashboard-marketing-main/dashboard-marketing/.env.local';
const [, , AUDIO, TXT, OUT] = process.argv;
let KEY = process.env.ELEVENLABS_API_KEY || '';
if (!KEY) { try { const m = fs.readFileSync(ENV, 'utf8').match(/^\s*ELEVENLABS_API_KEY\s*=\s*(.+?)\s*$/m); KEY = m ? m[1].replace(/^["']|["']$/g, '') : ''; } catch (e) {} }
if (!KEY) { console.error('sin ELEVENLABS_API_KEY'); process.exit(1); }

const audio = fs.readFileSync(AUDIO);
const text = fs.readFileSync(TXT, 'utf8').trim();
const B = '----mako' + Date.now();
const pre = Buffer.from(`--${B}\r\nContent-Disposition: form-data; name="file"; filename="a.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n`);
const mid = Buffer.from(`\r\n--${B}\r\nContent-Disposition: form-data; name="text"\r\n\r\n${text}\r\n--${B}--\r\n`);
const body = Buffer.concat([pre, audio, mid]);

const req = https.request({
  hostname: 'api.elevenlabs.io', path: '/v1/forced-alignment', method: 'POST',
  headers: { 'xi-api-key': KEY, 'Content-Type': `multipart/form-data; boundary=${B}`, 'Content-Length': body.length },
}, res => {
  const ch = []; res.on('data', c => ch.push(c));
  res.on('end', () => {
    const b = Buffer.concat(ch);
    if (res.statusCode !== 200) { console.error('ERR', res.statusCode, b.toString('utf8').slice(0, 700)); process.exit(1); }
    fs.writeFileSync(OUT, b);
    const j = JSON.parse(b.toString('utf8'));
    console.log('OK ->', OUT, '| words:', (j.words || []).length, '| chars:', (j.characters || []).length);
  });
});
req.on('error', e => { console.error('req err', e.message); process.exit(1); });
req.write(body); req.end();
