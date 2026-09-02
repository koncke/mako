// Para CADA carpeta de Drive que damos por cargada: ¿es de verdad ese curso, y esta
// completo?
//
//   node --import tsx scripts/curso-drive-vs-portal.mjs
//
// `curso-drive-faltantes.mjs` contesta «que carpeta no tiene curso» comparando NOMBRES.
// Esto contesta las dos preguntas que un nombre no puede contestar:
//
//   1. ¿El emparejamiento es real?  Dos cursos del mismo autor se llaman parecido. Si
//      ninguna clase coincide, lo dimos por cargado y en realidad FALTA.
//   2. ¿Le falta material?          Drive puede tener mas clases que las publicadas: el
//      curso esta en MaKo, incompleto, y nada lo dice.
//
// ⚠️ SE COMPARA POR TITULO DE CLASE, que es el unico dato que las dos puntas comparten.
//    El nombre de archivo en Drive y el titulo en la ficha salen del mismo original, asi
//    que normalizados coinciden — y cuando NO coinciden en absoluto, es que son cursos
//    distintos, que es justo lo que se busca.
import { readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const RAIZ = arg('drive', 'G:/My Drive/MARKETING KONCEPT/CURSOS');
const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
if (!existsSync(RAIZ)) { console.error(`\n  ✖ No veo ${RAIZ} — ¿está montado Drive?\n`); process.exit(2); }

const { CURSOS_TODOS } = await import(pathToFileURL(join(REPO, 'app/conocimientos/catalogo.ts')).href);

// La numeracion de adelante se saca: Drive numera «01 - », la ficha a veces no, y eso
// convertiria dos titulos iguales en distintos.
const norm = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  // ⚠️ SE SACAN TODAS LAS NUMERACIONES DE ADELANTE, NO UNA. El archivo en Drive se llama
  //    «001 - 1. Bienvenida y Tour.mp4»: el «001 - » lo pone nuestro pipeline y el «1. »
  //    venia del origen. Sacando una sola quedaba «1 bienvenida y tour» contra «bienvenida
  //    y tour» y NADA coincidia — con eso, este chequeo acuso de «mal emparejados» a 55
  //    cursos con el mismo nombre y el mismo numero de clases. Cuando un chequeo marca
  //    casi todo, el roto es el chequeo.
  .replace(/^(\s*\d{1,3}\s*[-.)_]\s*|\s*\d{1,3}\s+)+/, '')
  .replace(/^(\s*copia de\s*)+/i, '')
  .replace(/[^a-z0-9]+/gi, ' ').toLowerCase().trim();

const ES_VIDEO = /\.(mp4|mkv|webm|mov|m4v)$/i;
const videosDe = (dir, prof = 0, out = []) => {
  if (prof > 4) return out;
  let e = [];
  try { e = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const x of e) {
    if (x.isDirectory()) videosDe(join(dir, x.name), prof + 1, out);
    else if (ES_VIDEO.test(x.name)) out.push(norm(x.name.replace(/\.[^.]+$/, '')));
  }
  return out;
};
const modulosDe = (dir) => {
  try { return readdirSync(dir, { withFileTypes: true }).filter((x) => x.isDirectory()).length; } catch { return 0; }
};

// El mismo cruce por nombre que usa el otro script, para partir del mismo emparejamiento.
const sinAutor = (s) => { const i = String(s).lastIndexOf(' - '); return norm(i > 0 ? String(s).slice(0, i) : s); };
const PALABRAS_VACIAS = new Set(['curso', 'cursos', 'de', 'del', 'la', 'el', 'los', 'las', 'y', 'con', 'en', 'para', 'a', 'tu', 'tus', 'mi', 'por', 'academia', 'master', 'programa', 'formacion', 'completo', 'online', 'pro', 'vip']);
const fichas = (s) => new Set(norm(s).split(' ').filter((w) => w.length > 2 && !PALABRAS_VACIAS.has(w)));
const frecuencia = new Map();
for (const c of CURSOS_TODOS) for (const w of fichas(c.titulo)) frecuencia.set(w, (frecuencia.get(w) ?? 0) + 1);
const peso = (w) => 1 / Math.log2(2 + (frecuencia.get(w) ?? 0));
const parecido = (a, b) => {
  const A = fichas(a), B = fichas(b);
  if (!A.size || !B.size) return 0;
  let ca = 0, ta = 0, cb = 0, tb = 0;
  for (const w of A) { ta += peso(w); if (B.has(w)) ca += peso(w); }
  for (const w of B) { tb += peso(w); if (A.has(w)) cb += peso(w); }
  return Math.max(ca / ta, cb / tb);
};

const carpetas = readdirSync(RAIZ, { withFileTypes: true }).filter((x) => x.isDirectory()).map((x) => x.name);

const enriquecer = [];
const falsos = [];
const bien = [];
const vacias = [];

for (const nombre of carpetas) {
  const dir = join(RAIZ, nombre);
  const videos = videosDe(dir);
  if (!videos.length) { vacias.push(nombre); continue; }

  /**
   * ⚠️ SE ELIGE POR CLASES, NO POR NOMBRE.
   *
   * La primera version buscaba el titulo mas parecido y recien despues medía las clases.
   * Con eso emparejaba «360 Marca Personal - Lathos club» con «Master Marca Personal 5.0
   * - Victor Heras» —comparten tres palabras— teniendo el portal el 360 exacto, y lo
   * reportaba como «dado por cargado y no lo esta».
   *
   * El nombre es un parecido; las clases son el curso. Comparar contra los 119 cuesta 119
   * intersecciones de conjuntos ya armados, o sea nada, y la respuesta es la correcta sin
   * umbrales ni desempates: si hay que desempatar, todavia estas adivinando.
   */
  const juegos = CURSOS_TODOS.map((c) => ({ c, set: new Set((c.clases ?? []).map((x) => norm(x.titulo))) }));
  let mejor = null, comunes = 0;
  for (const { c, set } of juegos) {
    const n = videos.filter((t) => set.has(t)).length;
    if (n > comunes) { comunes = n; mejor = c; }
  }
  // Ninguna clase en comun con NINGUN curso: es material que no esta en MaKo. Lo reporta
  // el otro script, que es el que sabe mirar por nombre.
  if (!mejor || !comunes) continue;

  const pct = Math.round((comunes / videos.length) * 100);
  const score = parecido(sinAutor(nombre), sinAutor(mejor.titulo));
  const modsDrive = modulosDe(dir);
  const modsPortal = new Set((mejor.clases ?? []).map((x) => x.grupo).filter(Boolean)).size;

  const fila = { nombre, curso: mejor, videos: videos.length, clases: (mejor.clases ?? []).length, comunes, pct, modsDrive, modsPortal, score };

  /**
   * ⚠️ EL UMBRAL PARTE TRES CASOS, no dos.
   *
   *   pct alto  + Drive tiene MAS  → el curso esta en MaKo INCOMPLETO: hay que enriquecer.
   *   pct alto  + iguales          → esta bien, no se dice nada.
   *   pct bajo                     → el nombre engancho y las clases no: son cursos
   *                                  DISTINTOS, y lo dimos por cargado sin estarlo.
   *
   * El 25% de corte no es un numero elegido a ojo: por debajo de eso, mirados a mano, los
   * pares eran siempre cursos distintos del mismo autor.
   */
  if (pct < 25) falsos.push(fila);
  else if (videos.length > (mejor.clases ?? []).length) enriquecer.push(fila);
  else bien.push(fila);
}

console.log(`\n  ${carpetas.length} carpetas · ${bien.length} completas · ${enriquecer.length} con MÁS en Drive · ${falsos.length} mal emparejadas · ${vacias.length} sin video\n`);

if (enriquecer.length) {
  console.log('  ══ EN MaKo PERO INCOMPLETOS: Drive tiene más ══');
  for (const f of enriquecer.sort((a, b) => (b.videos - b.clases) - (a.videos - a.clases))) {
    console.log(`     +${String(f.videos - f.clases).padStart(4)} clases   ${f.curso.titulo}`);
    console.log(`                    Drive «${f.nombre}»: ${f.videos} videos / ${f.modsDrive} carpetas`);
    console.log(`                    MaKo: ${f.clases} clases / ${f.modsPortal} módulos  ·  coinciden ${f.pct}%`);
  }
}
if (falsos.length) {
  console.log('\n  ══ DADOS POR CARGADOS Y NO LO ESTÁN: el nombre enganchó, las clases no ══');
  for (const f of falsos.sort((a, b) => b.videos - a.videos)) {
    console.log(`     ${String(f.videos).padStart(4)} videos   ${f.nombre}`);
    console.log(`                    lo emparejé con «${f.curso.titulo}» (${f.clases} clases) y sólo coincide el ${f.pct}%`);
  }
}
console.log('');
