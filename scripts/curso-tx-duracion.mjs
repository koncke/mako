// Repara la duración de la cabecera de las transcripciones que dicen «0m00s».
//
// EL DAÑO. `curso-transcribir.ts` sumaba `r.duracion_s ?? 0`: cuando el proveedor no
// devolvía la duración —Gemini casi nunca la devuelve—, la pieza aportaba CERO y la
// cabecera afirmaba el total con toda confianza. Medido el 26/08/2026 sobre las 2195
// transcripciones locales con cabecera: **1055 dicen `0m00s`** teniendo texto adentro, y
// 23 más declaran una fracción. Casi la mitad del corpus.
//
// La suma ya está arreglada en el origen. Esto repara lo VIEJO, que no se vuelve a
// transcribir solo (el .md existe, así que la próxima corrida lo saltea).
//
// ⚠️ LA FUENTE NO ES EL AUDIO. El audio local se libera después de subir a Drive, así que
// para la mayoría ya no está. La duración REAL vive publicada en el `cardDesc` de cada
// clase (`app/conocimientos/curso-*.ts`), que la midió `curso-a-portal.mjs` con ffprobe
// sobre el video: `'40:51 · Descubre tu Don'`. Es un dato, no una estimación.
//
// ⚠️ Y EL CRUCE ES POR TÍTULO, que es un PARECIDO y no una clave. Por eso:
//   - se normaliza a NFC, sin acentos, sin mayúsculas y con los espacios colapsados
//     (un acento distinto ya partió una carpeta de Drive en dos en este mismo repo);
//   - la carpeta se ata a UN archivo de curso por mayoría de títulos, no por su nombre
//     —`certificacion-marketing-ia` vs `curso-certificacion-marketing-digital-ia.ts`—;
//   - si un título matchea con dos clases, NO se elige la primera: se deja como estaba y
//     se informa. Una rama que sabe que es ambigua no puede terminar en `[0]`.
//
// Uso:  node scripts/curso-tx-duracion.mjs [--aplicar] [--curso <carpeta>]
// Sin `--aplicar` no toca nada: cuenta qué haría.
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const CURSOS = process.env.CURSOS_DIR || 'C:\\cursos';
const APLICAR = process.argv.includes('--aplicar');
const SOLO = (() => { const i = process.argv.indexOf('--curso'); return i > 0 ? process.argv[i + 1] : null; })();

/** La clave con la que se comparan dos títulos. Nunca se comparan crudos. */
const clave = (s) => s
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const mmss = (s) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}h${String(m).padStart(2, '0')}m` : `${m}m${String(Math.round(s % 60)).padStart(2, '0')}s`;
};

// ── 1. el índice de duraciones publicadas, por archivo de curso ──────────────
// Se guarda `null` cuando un título aparece dos veces con duraciones distintas: eso es
// la marca de ambigüedad, y más abajo hace que esa clase NO se toque.
const catalogos = [];
for (const f of readdirSync(join(REPO, 'app', 'conocimientos')).filter((x) => /^curso-.*\.ts$/.test(x))) {
  const s = readFileSync(join(REPO, 'app', 'conocimientos', f), 'utf8');
  const porTitulo = new Map();
  // El bloque de una clase trae `titulo` y, unas líneas abajo, `cardDesc`. Se emparejan
  // por posición en el archivo: el cardDesc que sigue a un título es el suyo.
  const titulos = [...s.matchAll(/titulo: '((?:[^'\\]|\\.)*)'/g)];
  const descs = [...s.matchAll(/cardDesc: '((?:[^'\\]|\\.)*)'/g)];
  for (const t of titulos) {
    const d = descs.find((x) => x.index > t.index);
    if (!d) continue;
    const m = /^(?:(\d+):)?(\d+):(\d\d)\b/.exec(d[1]);
    if (!m) continue;
    const seg = (m[1] ? +m[1] * 3600 : 0) + +m[2] * 60 + +m[3];
    const k = clave(t[1].replace(/\\'/g, "'"));
    if (!k) continue;
    if (porTitulo.has(k) && porTitulo.get(k) !== seg) porTitulo.set(k, null); // ambiguo
    else if (!porTitulo.has(k)) porTitulo.set(k, seg);
  }
  if (porTitulo.size) catalogos.push({ archivo: f, porTitulo });
}
console.log(`  ${catalogos.length} cursos publicados · ${catalogos.reduce((t, c) => t + c.porTitulo.size, 0)} títulos con duración\n`);

// ── 2. recorrer las transcripciones ─────────────────────────────────────────
let mirados = 0, rotos = 0, reparados = 0, sinMatch = 0, ambiguos = 0;
const huerfanas = [];
const implausibles = [];
const wpms = [];

for (const carpeta of readdirSync(CURSOS)) {
  if (SOLO && carpeta !== SOLO) continue;
  const dir = join(CURSOS, carpeta, 'texto');
  let archivos;
  try { if (!statSync(dir).isDirectory()) continue; archivos = readdirSync(dir).filter((f) => f.endsWith('.md') && f !== '_indice.md'); } catch { continue; }
  if (!archivos.length) continue;

  // El nombre de la carpeta NO nombra el archivo del curso. Se ata por CONTENIDO: gana
  // el catálogo que reconoce más títulos de esta carpeta. Es el mismo criterio que
  // «la identidad sale del contenido, no del nombre».
  const titulosCarpeta = archivos.map((f) => clave(f.replace(/\.md$/, '').replace(/^\d+\s*-\s*/, '')));
  const puntajes = catalogos
    .map((c) => ({ c, n: titulosCarpeta.filter((t) => c.porTitulo.has(t)).length }))
    .sort((a, b) => b.n - a.n);
  let mejor = puntajes[0]?.c ?? null;
  const mejorN = puntajes[0]?.n ?? 0;
  const cobertura = mejorN / archivos.length;

  // ⚠️ «El que más matchea» NO es un match: es el ganador de una comparación que puede
  //    no tener ningún candidato bueno. Medido el 26/08/2026: la carpeta `masteryhaus`
  //    ganaba con `curso-bigseo-academy.ts` reconociendo **1 título de 170** (0,6 %), y
  //    con eso iba a escribirle a una clase la duración de otro curso. No falla, no
  //    avisa: deja un dato plausible y equivocado.
  //
  //    Los dos pisos salen de correrlo contra los 14 cursos reales, no de que suenen
  //    razonables. Los aciertos dan 46 %, 97 %, 99 %, 100 %; los errores 0,6 % y 13 %.
  //    Con 5 títulos y 30 % queda separado y con aire.
  const PISO_TITULOS = 5;
  const PISO_COBERTURA = 0.30;
  const flojo = mejorN < PISO_TITULOS || cobertura < PISO_COBERTURA;
  if (flojo) mejor = null;

  let rotosAca = 0, repAca = 0, sinAca = 0;
  for (const f of archivos) {
    mirados++;
    const ruta = join(dir, f);
    const s = readFileSync(ruta, 'utf8');
    const m = /^(>\s*)(\?|0m00s)(\s*(?:·|\u00b7))/m.exec(s);
    if (!m) continue;                        // la cabecera ya dice algo plausible
    rotos++; rotosAca++;
    if (!mejor) { sinMatch++; sinAca++; continue; }
    const seg = mejor.porTitulo.get(clave(f.replace(/\.md$/, '').replace(/^\d+\s*-\s*/, '')));
    if (seg === null) { ambiguos++; continue; }   // dos clases con ese título: no se elige
    if (seg === undefined) { sinMatch++; sinAca++; huerfanas.push(`${carpeta}/${f}`); continue; }
    // LA POST-CONDICIÓN, y no es decorativa: el cruce es por título, o sea por un
    // PARECIDO, así que una reparación puede escribir la duración de otra clase sin que
    // nada falle. Lo único que delata ese caso es que el número deje de tener sentido
    // contra el texto que hay al lado. El español hablado va entre 130 y 200 wpm; fuera
    // de 60-260 el par es sospechoso y la clase NO se toca.
    const palabras = s.split('\n').filter((l) => !l.startsWith('>') && !l.startsWith('#')).join(' ').split(/\s+/).filter(Boolean).length;
    const wpm = seg > 0 ? palabras / (seg / 60) : Infinity;
    if (palabras >= 50 && (wpm < 60 || wpm > 260)) {
      implausibles.push(`${Math.round(wpm)} wpm · ${(seg / 60).toFixed(1)} min · ${palabras} pal · ${carpeta}/${f.slice(0, 46)}`);
      continue;
    }
    if (palabras >= 50) wpms.push(wpm);
    if (APLICAR) writeFileSync(ruta, s.replace(m[0], `${m[1]}${mmss(seg)}${m[3]}`), 'utf8');
    reparados++; repAca++;
  }
  if (rotosAca) {
    console.log(`  ${carpeta.padEnd(38)} ${String(rotosAca).padStart(4)} rotas · ${String(repAca).padStart(4)} reparables · ${String(sinAca).padStart(4)} sin par` +
      `   [${mejor ? mejor.archivo : `SIN CATÁLOGO — el mejor era ${puntajes[0]?.c.archivo ?? '(ninguno)'} con ${mejorN}`} ${Math.round(cobertura * 100)}%]`);
  }
}

console.log(`\n  ${mirados} transcripciones miradas`);
console.log(`  ${rotos} con la duración rota`);
console.log(`  ${reparados} ${APLICAR ? 'REPARADAS' : 'reparables (corré con --aplicar)'}`);
console.log(`  ${ambiguos} ambiguas: el título matchea dos clases con duraciones distintas — NO se tocan`);
console.log(`  ${sinMatch} sin par en el catálogo publicado`);
console.log(`  ${implausibles.length} descartadas por la post-condición (el par daría un ritmo de habla imposible)`);
if (wpms.length) {
  wpms.sort((a, b) => a - b);
  const p = (q) => Math.round(wpms[Math.min(wpms.length - 1, Math.floor(wpms.length * q))]);
  console.log(`  ritmo implícito de las reparadas: p10=${p(0.1)} · mediana=${p(0.5)} · p90=${p(0.9)} wpm`);
}
if (implausibles.length) {
  console.log(`\n  las descartadas (mirá si el título matcheó otra clase):`);
  for (const x of implausibles.slice(0, 12)) console.log(`   ${x}`);
}
if (huerfanas.length) {
  console.log(`\n  las primeras sin par (probablemente clases que nunca se publicaron):`);
  for (const h of huerfanas.slice(0, 10)) console.log(`   ${h}`);
}
