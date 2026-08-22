// =============================================================================
// curso-drive-censo — qué hay en Drive, qué de eso está publicado, y qué se repite
// =============================================================================
// El tercer inventario que faltaba. Ya existían:
//
//   curso-faltantes.mjs  compara la FUENTE contra el portal, pero solo para los cursos
//                        que tienen carpeta en C:\cursos.
//   curso-censo.mjs      le pregunta a la PLATAFORMA qué cursos hay en la cuenta.
//
// Ninguno de los dos mira DRIVE, que es donde vive el video de verdad. Y ahí puede haber
// dos cosas que no se ven desde ningún otro lado:
//
//   · un curso BAJADO Y SUBIDO que nunca se publicó — trabajo hecho y perdido;
//   · el MISMO curso en dos carpetas, que es plata en almacenamiento y confusión sobre
//     cuál es la buena.
//
// ⚠️ Recorrer G: es lento (es un montaje de red): contar los .mp4 de 58 carpetas tarda
// minutos y `du` directamente se cuelga. Por eso se cuentan archivos, no bytes.
//
//   node scripts/curso-drive-censo.mjs
//   node scripts/curso-drive-censo.mjs --json
// =============================================================================
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const DRIVE = arg('drive', 'G:\\My Drive\\MARKETING KONCEPT\\CURSOS');
const REPO = arg('repo', process.cwd());
const JSON_CRUDO = process.argv.includes('--json');

if (!existsSync(DRIVE)) {
  console.error(`\n  ✖ No existe ${DRIVE}\n    ¿Está Drive for Desktop montado? Si G: no aparece, arrancá GoogleDriveFS.exe.\n`);
  process.exit(1);
}

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/gi, '').toLowerCase();

// Los nombres de archivo de una carpeta, recursivo. Sin stat: en un montaje de red el
// stat por archivo es lo que hace la diferencia entre segundos y minutos.
const videosDe = (dir) => {
  const out = [];
  const caminar = (d, prof) => {
    if (prof > 4) return;
    let e;
    try { e = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const x of e) {
      if (x.isDirectory()) caminar(join(d, x.name), prof + 1);
      else if (/\.(mp4|mkv|webm|m4v)$/i.test(x.name)) out.push(x.name);
    }
  };
  caminar(dir, 0);
  return out;
};

// Lo que el portal publica, para saber qué carpeta tiene dueño.
const CONO = join(REPO, 'app', 'conocimientos');
const enPortal = new Set();
for (const f of readdirSync(CONO).filter((x) => x.startsWith('curso') && x.endsWith('.ts'))) {
  const s = readFileSync(join(CONO, f), 'utf8');
  enPortal.add(norm(f.replace(/^curso-|\.ts$/g, '')));
  for (const m of s.matchAll(/titulo:\s*'([^']*)'/g)) enPortal.add(norm(m[1]));
  for (const m of s.matchAll(/"titulo":\s*"([^"]*)"/g)) enPortal.add(norm(m[1]));
  for (const m of s.matchAll(/"slug":\s*"([a-z0-9-]+)"/g)) enPortal.add(norm(m[1]));
}
const publicado = (nombre) => {
  const a = norm(nombre.split(' - ')[0]);
  for (const k of enPortal) {
    if (!k || k.length < 8) continue;
    if (k === a || k.includes(a) || a.includes(k)) return true;
  }
  return false;
};

const carpetas = readdirSync(DRIVE, { withFileTypes: true }).filter((x) => x.isDirectory()).map((x) => x.name);
const filas = [];
for (const c of carpetas) {
  const vids = videosDe(join(DRIVE, c));
  filas.push({ carpeta: c, videos: vids.length, nombres: vids, publicado: publicado(c) });
}

// ── ¿Dos carpetas del MISMO curso? ──────────────────────────────────────────
// Se compara por NOMBRE DE ARCHIVO normalizado, no por el nombre de la carpeta: dos
// cortes del mismo curso se llaman distinto («BlueHacker 2.0» / «Growth Bluehackers»)
// pero comparten las clases.
const repetidos = [];
for (let i = 0; i < filas.length; i++) {
  for (let j = i + 1; j < filas.length; j++) {
    const a = new Set(filas[i].nombres.map(norm));
    const b = filas[j].nombres.map(norm);
    const comunes = b.filter((x) => a.has(x)).length;
    if (!comunes) continue;
    const menor = Math.min(filas[i].videos, filas[j].videos) || 1;
    repetidos.push({ a: filas[i].carpeta, b: filas[j].carpeta, comunes, pct: Math.round((comunes / menor) * 100) });
  }
}

if (JSON_CRUDO) {
  console.log(JSON.stringify({ filas: filas.map(({ nombres, ...r }) => r), repetidos }, null, 1));
  process.exit(0);
}

const sinPublicar = filas.filter((f) => f.videos > 0 && !f.publicado).sort((a, b) => b.videos - a.videos);
const total = filas.reduce((t, f) => t + f.videos, 0);

console.log(`\n  DRIVE: ${carpetas.length} carpetas · ${total} videos`);
console.log(`  con curso publicado: ${filas.filter((f) => f.publicado && f.videos).length}`);
console.log(`  SIN publicar       : ${sinPublicar.length} carpetas · ${sinPublicar.reduce((t, f) => t + f.videos, 0)} videos\n`);

console.log(`  ${'carpeta'.padEnd(52)} ${'videos'.padStart(6)}  portal`);
for (const f of filas.sort((a, b) => b.videos - a.videos)) {
  if (!f.videos) continue;
  console.log(`  ${f.carpeta.slice(0, 52).padEnd(52)} ${String(f.videos).padStart(6)}  ${f.publicado ? '✓' : '—'}`);
}
const vacias = filas.filter((f) => !f.videos);
if (vacias.length) console.log(`\n  (${vacias.length} carpeta(s) sin videos: ${vacias.map((f) => f.carpeta).slice(0, 6).join(' · ')}${vacias.length > 6 ? ' …' : ''})`);

console.log(`\n  ── ARCHIVOS REPETIDOS ENTRE CARPETAS ──`);
if (!repetidos.length) console.log(`  Ninguno. Cada video vive en una sola carpeta.`);
for (const r of repetidos.sort((a, b) => b.comunes - a.comunes)) {
  console.log(`  ${String(r.comunes).padStart(4)} en común (${r.pct}% de la menor)  ${r.a.slice(0, 34)}  ↔  ${r.b.slice(0, 34)}`);
}
writeFileSync(join('C:\\cursos', 'censo-drive.json'), JSON.stringify({ filas: filas.map(({ nombres, ...r }) => r), repetidos }, null, 1), 'utf8');
console.log(`\n  → C:\\cursos\\censo-drive.json\n`);
