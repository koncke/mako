// The voices of a batch, one at a time (no Chromium: only ElevenLabs), each checked against its script.
//   node motor/voces.mjs <id>…   |   node motor/voces.mjs v5     (every script marked v5 in guiones.json)
// `hacer.mjs <id> beats` makes the voice only if the script changed, transcribes it, aligns it and builds the beats (no render).
// If the voice does NOT say the script (a real difference, not the transcriber's spelling), it asks for a new take, twice at most.
// Writes trabajo/_voces.log: one line per video with the verdict, to READ before rendering.
import { readFileSync, appendFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const RAIZ = 'C:/dev/tutoriales-video';
const G = JSON.parse(readFileSync(`${RAIZ}/guiones.json`, 'utf8'));
let ids = process.argv.slice(2);
if (ids[0] === 'v5') ids = G.filter((g) => g.v5).map((g) => g.id);
const LOG = `${RAIZ}/trabajo/_voces.log`;
writeFileSync(LOG, `# voces ${new Date().toISOString()} · ${ids.length} videos\n`);
for (const id of ids) {
  let veredicto = '', intento = 0;
  for (; intento < 3; intento++) {
    const r = spawnSync('node', [`${RAIZ}/motor/hacer.mjs`, id, 'beats', ...(intento ? ['voz-nueva'] : [])], { cwd: RAIZ, encoding: 'utf8' });
    const out = (r.stdout || '') + (r.stderr || '');
    const chequeo = (out.match(/chequeo: (.*)/) || [])[1] || '';
    const voz = (out.match(/(voz nueva[^\n]*|voz: la misma[^\n]*)/) || [])[1] || '';
    if (r.status !== 0) { veredicto = `❌ falló (${out.trim().split('\n').pop().slice(0, 160)})`; continue; }
    if (/la voz NO dice exactamente el guion/.test(out)) { veredicto = `⚠️ no dice el guion: ${chequeo.slice(0, 220)}`; continue; }
    veredicto = `✅ ${chequeo.slice(0, 160)} · ${voz.slice(0, 80)}`; break;
  }
  const linea = `${id}: ${veredicto}${intento ? ` (tomas extra: ${Math.min(intento, 2)})` : ''}`;
  appendFileSync(LOG, linea + '\n'); console.log(linea);
}
console.log('listo:', LOG);
