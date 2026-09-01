// Verificacion de un corte. DOS cosas, y las dos hacen falta:
//   1. huecos entre palabras (que no queden baches)
//   2. el TEXTO, comparado palabra por palabra contra el original
//
// Contar palabras NO alcanza y ya engaño una vez: un corte que se come el ataque de
// "requiere" y lo deja en "quiere" mantiene el conteo intacto. Hay que comparar el texto.
//
// uso: node verificar.mjs <dir sts-N.mp3> <ntomas> <audio resultante>
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const DIR = process.argv[2], N = +process.argv[3], RES = process.argv[4];
// La key, del entorno primero: en el worker no hay `.env.local` ni carpeta de
// Martín. El archivo queda como comodidad para correr el verificador a mano.
//
// ⚠️ Y se corta ACÁ si falta, en vez de seguir con `K` undefined. Este script es
// el que decide si el anuncio se entrega o no: sin key, la transcripción vuelve
// 401, la comparación de texto se hace contra una lista vacía y el veredicto es
// «no se perdió ninguna palabra» — un verde sobre una verificación que no
// ocurrió, que es peor que un rojo.
let K = process.env.GROQ_API_KEY;
if (!K) {
  try {
    const env = fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
    K = env.split(/\r?\n/).find((l) => l.startsWith('GROQ_API_KEY='))?.slice(13).trim();
  } catch { /* sin archivo: se corta abajo */ }
}
if (!K) {
  console.error('FALTA GROQ_API_KEY: sin ella la verificación no puede leer el audio, y un verde sin verificar es peor que un rojo.');
  process.exit(2);
}

async function palabras(file) {
  const mp3 = file.replace(/\.[^.]+$/, '') + '.v16.mp3';
  spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', file, '-ac', '1', '-ar', '16000', '-b:a', '48k', mp3]);
  const fd = new FormData();
  fd.append('file', new Blob([fs.readFileSync(mp3)], { type: 'audio/mpeg' }), 'a.mp3');
  fd.append('model', 'whisper-large-v3');
  fd.append('language', 'es');
  fd.append('response_format', 'verbose_json');
  fd.append('timestamp_granularities[]', 'word');
  const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions',
    { method: 'POST', headers: { Authorization: `Bearer ${K}` }, body: fd });
  const j = await r.json();
  return (j.words || []).filter(x => x.word && x.end > x.start);
}
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zñ]/g, '');

// texto original: la union de las tomas (cacheado por el planificador)
const orig = [];
for (let i = 1; i <= N; i++) {
  const p = `${DIR}/words-${i}.json`;
  if (!fs.existsSync(p)) { console.error(`falta ${p}`); process.exit(1); }
  for (const w of JSON.parse(fs.readFileSync(p, 'utf8')).words || []) if (w.word) orig.push(norm(w.word));
}
const res = (await palabras(RES)).map(w => norm(w.word));

// diff de Myers simple sobre listas de palabras
function diff(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Uint32Array(n + 1));
  for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--)
    dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const falta = [], sobra = [];
  let i = 0, j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) { i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) falta.push(a[i++]);
    else sobra.push(b[j++]);
  }
  while (i < m) falta.push(a[i++]);
  while (j < n) sobra.push(b[j++]);
  return { falta, sobra };
}
const { falta, sobra } = diff(orig.filter(Boolean), res.filter(Boolean));

const w = await palabras(RES);
const huecos = [];
for (let i = 1; i < w.length; i++) {
  const g = w[i].start - w[i - 1].end;
  if (g >= 0.30) huecos.push({ g: +g.toFixed(2), a: w[i - 1].word, b: w[i].word });
}

console.log(`  TEXTO   original ${orig.length} palabras -> resultado ${res.length}`);
if (falta.length) console.log(`  ❌ FALTAN (${falta.length}): ${falta.join(' ')}`);
if (sobra.length) console.log(`  ⚠  aparecen (${sobra.length}): ${sobra.join(' ')}   <- mutilacion: el ataque cortado cambia la palabra`);
if (!falta.length && !sobra.length) console.log('  ✅ texto intacto, ni una palabra mutilada');
console.log(`  HUECOS  ${huecos.length} >= 0.30s` + (huecos.length ? ` | peor ${Math.max(...huecos.map(h => h.g))}s` : ' ✅'));
for (const h of huecos.sort((x, y) => y.g - x.g).slice(0, 5)) console.log(`     ${h.g}s entre ${JSON.stringify(h.a)} y ${JSON.stringify(h.b)}`);
process.exit(falta.length || sobra.length ? 1 : 0);
