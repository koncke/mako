// Subtitulos ASS palabra por palabra, look CapCut. Adaptado de generar-subtitulos.mjs
// de la corrida del 24/08. Cambios: input/output por argv, y se transcribe la VOZ SOLA
// (no la mezcla) para que la musica no ensucie los timestamps.
import fs from 'node:fs';

const IN = process.argv[2];
const OUT = process.argv[3];

const W = 720, H = 1280;
// ⚠️ NO 'Segoe UI Black'. Existe en Windows y NO existe en un servidor Linux, y
// libass **no falla**: cae a la primera fuente que encuentre y sigue. El
// resultado son subtitulos con otra tipografia, sin una linea en ningun log.
// Anton es OFL, va bundleada en `worker/fuentes/` y su nombre de familia es
// exactamente «Anton» (verificado leyendo la tabla `name` del .ttf: el nombre
// que libass busca es el de la familia, no el del archivo).
const FUENTE = process.env.SUBS_FUENTE || 'Anton';
const CUERPO = 52;
const MAX_CHARS = 18;
const MAX_PAL = 3;
const HUECO = 0.6;
const Y = 950;
const COLA = 0.12;

// La key: del ENTORNO primero —que es como la va a tener el worker— y del
// .env.local solo como comodidad para correrlo a mano desde el repo. Leer una
// ruta absoluta a la carpeta de Martin era lo segundo que no sobrevivia al
// contenedor, y su forma de fallar es la peor: `K` queda undefined, la request
// sale sin Authorization y Groq contesta 401 sobre algo que parece un problema
// de audio.
let K = process.env.GROQ_API_KEY;
if (!K) {
  try {
    const env = fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
    K = env.split(/\r?\n/).find((l) => l.startsWith('GROQ_API_KEY='))?.slice(13).trim();
  } catch { /* sin archivo: se avisa abajo */ }
}
if (!K) {
  console.error('FALTA GROQ_API_KEY: es la que transcribe la voz para los subtitulos.');
  process.exit(1);
}

const fd = new FormData();
fd.append('file', new Blob([fs.readFileSync(IN)], { type: 'audio/mpeg' }), 'a.mp3');
fd.append('model', 'whisper-large-v3');
fd.append('language', 'es');
fd.append('response_format', 'verbose_json');
fd.append('timestamp_granularities[]', 'word');
const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
  method: 'POST', headers: { Authorization: `Bearer ${K}` }, body: fd,
});
if (!r.ok) { console.error('GROQ ' + r.status + ': ' + (await r.text()).slice(0, 400)); process.exit(1); }
const j = await r.json();
const W_ = (j.words || []).filter(w => w.word && w.end > w.start);
console.log('palabras con timestamp:', W_.length);
if (!W_.length) { console.error('SIN PALABRAS: revisar response_format/granularity'); process.exit(1); }

const BRACE = /[{}]/g;
const BS = String.fromCharCode(92);
const esc = s => s.replace(BRACE, '').split(BS).join('').toUpperCase().trim();

const bloques = [];
let cur = [];
const anchoDe = arr => arr.map(w => esc(w.word)).join(' ').length;
for (const w of W_) {
  const proximo = cur.concat([w]);
  const corta = cur.length && (
    cur.length >= MAX_PAL ||
    anchoDe(proximo) > MAX_CHARS ||
    w.start - cur[cur.length - 1].end > HUECO
  );
  if (corta) { bloques.push(cur); cur = []; }
  cur.push(w);
}
if (cur.length) bloques.push(cur);

let eventos = [];
for (const b of bloques) {
  for (let i = 0; i < b.length; i++) eventos.push({ w: b[i], bloque: b, idx: i });
}
// Whisper puede devolver palabras cuyos start se pisan o distan menos de un frame.
// El script original forzaba `Math.max(next.start, start+0.02)`, y ESO es lo que crea
// los solapes: el minimo de 20 ms se mete adentro del evento siguiente. La duracion
// minima no se fuerza estirando el fin, se resuelve saneando los inicios y tirando
// los eventos que quedan degenerados.
for (const e of eventos) e.ini = e.w.start;
for (let i = 1; i < eventos.length; i++) {
  if (eventos[i].ini < eventos[i - 1].ini) eventos[i].ini = eventos[i - 1].ini;
}
const MINDUR = 0.04;
const descartados = [];
eventos = eventos.filter((e, i) => {
  if (i + 1 >= eventos.length) return true;
  if (eventos[i + 1].ini - e.ini >= MINDUR) return true;
  descartados.push(esc(e.w.word));       // la palabra sigue en pantalla dentro de su
  return false;                          // bloque; solo pierde su resalte propio
});
if (descartados.length) console.log('eventos fusionados por durar <' + MINDUR + 's:', descartados.join(' '));
for (let i = 0; i < eventos.length; i++) {
  eventos[i].fin = (i + 1 < eventos.length) ? eventos[i + 1].ini : eventos[i].w.end + COLA;
}

const t = s => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return h + ':' + String(m).padStart(2, '0') + ':' + x.toFixed(2).padStart(5, '0');
};
const B = String.fromCharCode(92);
const AMARILLO = '{' + B + 'c&H00E5FF&}';
const BLANCO = '{' + B + 'c&H00FFFFFF&}';
const POS = '{' + B + 'an5' + B + 'pos(' + (W / 2) + ',' + Y + ')}';

let ass = [
  '[Script Info]',
  'ScriptType: v4.00+',
  'PlayResX: ' + W,
  'PlayResY: ' + H,
  'WrapStyle: 2',
  'ScaledBorderAndShadow: yes',
  '',
  '[V4+ Styles]',
  'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
  'Style: Reel,' + FUENTE + ',' + CUERPO + ',&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,5,2,5,20,20,20,1',
  '',
  '[Events]',
  'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  '',
].join('\n');

for (const e of eventos) {
  const txt = e.bloque.map((w, k) => k === e.idx ? AMARILLO + esc(w.word) + BLANCO : esc(w.word)).join(' ');
  ass += 'Dialogue: 0,' + t(e.ini) + ',' + t(e.fin) + ',Reel,,0,0,0,,' + POS + txt + '\n';
}
fs.writeFileSync(OUT, ass, 'utf8');

let solapes = 0, peor = 0;
for (let i = 0; i < eventos.length - 1; i++) {
  const d = eventos[i].fin - eventos[i + 1].ini;
  if (d > 0.001) { solapes++; if (d > peor) peor = d; }
}
const largos = eventos.map(e => e.bloque.map(w => esc(w.word)).join(' ').length);
console.log('bloques:', bloques.length, '| eventos:', eventos.length);
console.log('SOLAPES:', solapes, peor ? '(peor ' + peor.toFixed(3) + 's)' : '');
console.log('largo max de linea:', Math.max(...largos), 'chars (tope', MAX_CHARS + ')');
console.log('ultimo evento termina en:', eventos[eventos.length - 1].fin.toFixed(2), 's');
if (solapes) { console.error('\nREVISAR: hay solapes'); process.exit(1); }
