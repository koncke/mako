// =============================================================================
// EL VIDEO DEL WHATSAPP CON SU PRIMERA FRASE NUEVA, Y LA VOZ APROBADA EN EL RESTO (19/11/2026)
// =============================================================================
// Cortado del unido, el segundo video arrancaba «Una de ellas es tu WhatsApp…» (las preguntas de la bienvenida). El Cerebro: «que el
// segundo video arranque "Tu WhatsApp es por donde MaKo te manda avances…": solo tiene que entenderse». Sólo esa frase es voz nueva
// (ElevenLabs, LA-CONFIG, como hacer.mjs). Las otras tres son la voz APROBADA del unido (trabajo/onboarding-bienvenida/voz.mp3), desde
// el final de «…sobre tu negocio.» (24,08 s): el silencio hasta «Para confirmarlo» queda igual. La alineación se arma igual: la de la
// frase nueva y, después, la del unido corrida. Deja trabajo/onboarding-bienvenida-whatsapp/{voz.mp3, guion.txt, alin.json}; con eso,
// `hacer.mjs onboarding-bienvenida-whatsapp cuadros|video` no vuelve a generar la voz (el guion es el mismo) y renderiza el video entero.
//   node pantallas-onboarding/frase-nueva.mjs
// =============================================================================
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const RAIZ = 'C:/dev/tutoriales-video';
const ID = 'onboarding-bienvenida-whatsapp';
const DIR = `${RAIZ}/trabajo/${ID}`;
// La voz APROBADA del unido, guardada aparte (20/11: la bienvenida pasó a ser su propio guion, OA-17, y su carpeta de trabajo ya es otra).
const UNIDO = `${RAIZ}/trabajo/onboarding-bienvenida-unido`;
const DESDE = 24.08;   // en el unido: el final de «…sobre tu negocio.»; de ahí sigue la voz aprobada (el silencio y «Para confirmarlo…»)
mkdirSync(DIR, { recursive: true });

const env = readFileSync('C:/Users/marti/OneDrive/Escritorio/dashboard-marketing-main/dashboard-marketing/.env.local', 'utf8');
const KEY = (env.match(/^\s*ELEVENLABS_API_KEY\s*=\s*(.+?)\s*$/m) || [])[1]?.replace(/^["']|["']$/g, '');
const VOZ = JSON.parse(readFileSync('C:/dev/reel-mentores/voz/LA-CONFIG.json', 'utf8'))._para_texto_sin_video;
const g = JSON.parse(readFileSync(`${RAIZ}/guiones.json`, 'utf8')).find((x) => x.id === ID);
if (!g) throw new Error(`no hay guion para ${ID} en guiones.json`);
const textoVoz = g.pasos.map((p) => p.dice.trim()).join(' ');
const nueva = g.pasos[0].dice.trim();

// 1. la frase nueva, sola (se guarda: volver a correr no la regenera)
const fNueva = `${DIR}/frase-1.mp3`, aNueva = `${DIR}/frase-1.alin.json`;
if (!existsSync(fNueva)) {
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOZ.voz}?output_format=mp3_44100_192`, {
    method: 'POST', headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text: nueva, model_id: VOZ.model_id }) });
  if (!r.ok) throw new Error(`la voz: ${r.status} ${(await r.text()).slice(0, 300)}`);
  writeFileSync(fNueva, Buffer.from(await r.arrayBuffer()));
  console.log(`voz nueva: «${nueva}» (${VOZ.model_id}, cobró ${r.headers.get('character-cost') || '?'} créditos)`);
}
if (!existsSync(aNueva)) {
  const fd = new FormData();
  fd.append('file', new Blob([readFileSync(fNueva)], { type: 'audio/mpeg' }), 'a.mp3');
  fd.append('text', nueva);
  const r = await fetch('https://api.elevenlabs.io/v1/forced-alignment', { method: 'POST', headers: { 'xi-api-key': KEY }, body: fd });
  if (!r.ok) throw new Error(`la alineación: ${r.status} ${(await r.text()).slice(0, 300)}`);
  writeFileSync(aNueva, JSON.stringify(await r.json()));
}

// 2. la voz: la frase nueva hasta su última palabra + la aprobada desde DESDE
const wN = JSON.parse(readFileSync(aNueva, 'utf8')).words;
const finNueva = [...wN].reverse().find((w) => w.text.trim()).end;
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', fNueva, '-i', `${UNIDO}/voz.mp3`, '-filter_complex',
  `[0:a]atrim=0:${finNueva},asetpts=PTS-STARTPTS[a];[1:a]atrim=start=${DESDE},asetpts=PTS-STARTPTS[b];[a][b]concat=n=2:v=0:a=1[o]`,
  '-map', '[o]', '-c:a', 'libmp3lame', '-b:a', '192k', '-ar', '44100', '-ac', '1', `${DIR}/voz.mp3`], { stdio: 'inherit' });

// 3. la alineación: la de la frase nueva y la del unido desde DESDE, corrida
const wU = JSON.parse(readFileSync(`${UNIDO}/alin.json`, 'utf8')).words;
const corre = finNueva - DESDE;
const r2 = (n) => Math.round(n * 1000) / 1000;
const palabras = [...wN.filter((w) => w.end <= finNueva + 1e-6), ...wU.filter((w) => w.start >= DESDE - 1e-6).map((w) => ({ ...w, start: r2(w.start + corre), end: r2(w.end + corre) }))];
const cuenta = palabras.filter((w) => w.text.trim()).length;
const delGuion = textoVoz.split(/\s+/).length;
if (cuenta !== delGuion) throw new Error(`la alineación trae ${cuenta} palabras y el guion ${delGuion}`);
writeFileSync(`${DIR}/alin.json`, JSON.stringify({ words: palabras, characters: [], loss: null }));
writeFileSync(`${DIR}/guion.txt`, textoVoz);
const dur = +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', `${DIR}/voz.mp3`], { encoding: 'utf8' }).trim();
console.log(`listo: la frase nueva termina a ${finNueva.toFixed(2)} s; la voz dura ${dur.toFixed(2)} s; ${cuenta} palabras (el guion: ${delGuion})`);
