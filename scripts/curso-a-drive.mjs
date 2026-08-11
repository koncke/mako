// Copia el curso a Google Drive ORGANIZADO por módulo y devuelve el videoId de
// cada clase, que es lo que consume DRIVE_PREVIEW en app/conocimientos.
//
// Por qué no hay OAuth acá: Drive for Desktop ya tiene la cuenta montada en G:.
// Copiar dentro de G:\My Drive es la subida — Drive la hace en background, con
// reintentos propios. Y el file id no hace falta pedirlo por API: Drive mantiene
// una SQLite local (metadata_sqlite_db) cuya tabla `items` tiene `id` (el file id
// de Drive) junto a `local_title`. Se lee con node:sqlite, copiando la DB antes
// porque Drive la tiene lockeada.
//
// Estructura que deja:
//   G:\My Drive\MARKETING KONCEPT\CURSOS\<Curso>\<NN Módulo>\<NN - Clase>.mp4
//                                              \PDFs\
//                                              \texto\
//
//   node <abs>\scripts\curso-a-drive.mjs --plan C:\cursos\<slug>\plan.json
//   node <abs>\scripts\curso-a-drive.mjs --plan … --solo-ids   # sin copiar, solo leer ids

import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, statSync, readdirSync, unlinkSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const tiene = (n) => process.argv.includes(`--${n}`);

const PLAN = arg('plan', '');
const DRIVE = arg('drive', 'G:\\My Drive\\MARKETING KONCEPT\\CURSOS');
const DFS = arg('dfs', join(process.env.LOCALAPPDATA ?? '', 'Google\\DriveFS'));
const MINUTOS = Number(arg('minutos', 20)); // tope de espera a que Drive registre

if (!PLAN || !existsSync(PLAN)) { console.error('\n  ✖ Falta --plan <plan.json>\n'); process.exit(1); }
const plan = JSON.parse(readFileSync(PLAN, 'utf8'));
const base = dirname(PLAN);

const limpio = (s) => String(s).normalize('NFC').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
  .replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '').slice(0, 120);
const mb = (b) => (b / 1048576).toFixed(1);

// ── El lector de la metadata de Drive ────────────────────────────────────────
const dbDeDrive = () => {
  if (!existsSync(DFS)) return null;
  // La carpeta de la cuenta es un id numérico largo; el resto (Logs, Crashpad…) no.
  const cuentas = readdirSync(DFS, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d{15,}$/.test(d.name))
    .map((d) => join(DFS, d.name, 'metadata_sqlite_db'))
    .filter(existsSync);
  return cuentas[0] ?? null;
};

const idsDeDrive = (nombres) => {
  const src = dbDeDrive();
  if (!src) return { error: `no encontré metadata_sqlite_db bajo ${DFS}` };
  // Copiar: Drive la tiene abierta y un open directo falla o lee a medias.
  const tmp = join(tmpdir(), `dfs-${process.pid}.db`);
  copyFileSync(src, tmp);
  const db = new DatabaseSync(tmp, { readOnly: true });
  const q = db.prepare(`SELECT id, local_title, file_size, trashed FROM items
                        WHERE local_title = ? AND is_folder = 0 AND trashed = 0`);
  const out = new Map();
  for (const n of nombres) {
    const filas = q.all(n);
    if (filas.length === 1) out.set(n, { id: filas[0].id, size: Number(filas[0].file_size ?? 0) });
    else if (filas.length > 1) out.set(n, { ambiguo: filas.length, id: filas[0].id });
  }
  db.close();
  try { unlinkSync(tmp); } catch {}
  return { ids: out };
};

// ── 1. Copiar (= subir) ──────────────────────────────────────────────────────
const dirCurso = join(DRIVE, limpio(plan.curso));
const esperados = []; // { nombre, clase }

if (!tiene('solo-ids')) {
  if (!existsSync(DRIVE)) {
    console.error(`\n  ✖ No existe ${DRIVE}\n    ¿Está Drive for Desktop montado en G:? Pasá otra ruta con --drive\n`);
    process.exit(1);
  }
  mkdirSync(dirCurso, { recursive: true });
  console.log(`\n  Destino: ${dirCurso}\n`);

  const dirVideo = join(base, 'video');
  let copiados = 0, ya = 0, sinArchivo = 0;

  for (const c of plan.clases) {
    // El archivo puede tener cualquier extensión según lo que mergeó yt-dlp.
    const cand = existsSync(dirVideo)
      ? readdirSync(dirVideo).filter((f) => f.startsWith(c.archivo) && /\.(mp4|mkv|webm|m4v)$/i.test(f))
      : [];
    if (!cand.length) { console.log(`  ⚠ ${c.archivo} — no está bajado todavía`); sinArchivo++; continue; }

    const src = join(dirVideo, cand[0]);
    const mod = limpio(c.modulo ?? 'Sin módulo').replace(/^(\d+)\.\s*/, (_, n) => `${String(n).padStart(2, '0')} `);
    const dstDir = join(dirCurso, mod);
    mkdirSync(dstDir, { recursive: true });
    const dst = join(dstDir, cand[0]);
    esperados.push({ nombre: cand[0], clase: c });

    if (existsSync(dst) && statSync(dst).size === statSync(src).size) { console.log(`  = ${mod}\\${cand[0]}`); ya++; continue; }
    process.stdout.write(`  ↑ ${mod}\\${cand[0]} (${mb(statSync(src).size)} MB) … `);
    copyFileSync(src, dst);
    console.log('copiado');
    copiados++;
  }

  // PDFs y texto, si están.
  for (const [sub, etiqueta] of [['pdfs', 'PDFs'], ['texto', 'texto']]) {
    const d = join(base, sub);
    if (!existsSync(d)) continue;
    const dst = join(dirCurso, etiqueta);
    mkdirSync(dst, { recursive: true });
    let n = 0;
    for (const f of readdirSync(d)) {
      const a = join(d, f), b = join(dst, f);
      if (existsSync(b) && statSync(b).size === statSync(a).size) continue;
      copyFileSync(a, b); n++;
    }
    if (n) console.log(`  ↑ ${etiqueta}: ${n} archivo(s)`);
  }

  console.log(`\n  ${copiados} copiado(s) · ${ya} ya estaban${sinArchivo ? ` · ${sinArchivo} sin bajar` : ''}`);
} else {
  for (const c of plan.clases) {
    const dirVideo = join(base, 'video');
    const cand = existsSync(dirVideo) ? readdirSync(dirVideo).filter((f) => f.startsWith(c.archivo)) : [];
    if (cand.length) esperados.push({ nombre: cand[0], clase: c });
  }
}

if (!esperados.length) { console.error('\n  ✖ No hay nada para mapear. ¿Corriste curso-bajar.mjs?\n'); process.exit(1); }

// ── 2. Esperar a que Drive registre y leer los ids ───────────────────────────
console.log(`\n  Esperando a que Drive suba y registre (tope ${MINUTOS} min)…`);
console.log('  (el id aparece cuando el archivo existe del lado del servidor)\n');

const pendientes = new Map(esperados.map((e) => [e.nombre, e.clase]));
const resueltos = new Map();
const t0 = Date.now();

while (pendientes.size && Date.now() - t0 < MINUTOS * 60000) {
  const r = idsDeDrive([...pendientes.keys()]);
  if (r.error) { console.error(`  ✖ ${r.error}\n`); process.exit(1); }
  for (const [nombre, info] of r.ids) {
    if (info.ambiguo) {
      console.log(`  ⚠ ${nombre} — ${info.ambiguo} archivos con ese nombre en tu Drive; tomo el primero`);
    }
    resueltos.set(nombre, { ...info, clase: pendientes.get(nombre) });
    console.log(`  ✓ ${nombre}  →  ${info.id}`);
    pendientes.delete(nombre);
  }
  if (pendientes.size) await new Promise((r2) => setTimeout(r2, 10000));
}

// ── 3. Salida lista para el portal ───────────────────────────────────────────
const clases = esperados
  .filter((e) => resueltos.has(e.nombre))
  .map((e) => {
    const { id } = resueltos.get(e.nombre);
    const c = e.clase;
    return {
      n: c.n, titulo: c.titulo, duracion: c.duracion, modulo: c.modulo,
      videoId: id,
      preview: `https://drive.google.com/file/d/${id}/preview`,
      archivo: e.nombre,
    };
  });

const salida = join(base, 'drive.json');
writeFileSync(salida, JSON.stringify({ curso: plan.curso, carpeta: dirCurso, clases }, null, 2), 'utf8');

console.log('\n' + '─'.repeat(70));
console.log(`  ${clases.length}/${esperados.length} clases con videoId de Drive`);
console.log(`  Carpeta: ${dirCurso}`);
console.log(`  → ${salida}`);
console.log('─'.repeat(70));

if (pendientes.size) {
  console.log(`\n  ⚠ ${pendientes.size} sin id todavía — Drive sigue subiendo. Volvé a correr con`);
  console.log('    --solo-ids cuando el ícono de Drive deje de girar (no re-copia nada):');
  for (const n of [...pendientes.keys()].slice(0, 6)) console.log(`      ${n}`);
}

console.log(`\n  Los videoId de drive.json son lo que come DRIVE_PREVIEW en`);
console.log(`  app/conocimientos/CursoPortal.tsx:21. La transcripción de cada clase va a`);
console.log(`  public/cono-tx/<videoId>.json, que es de donde la lee TranscriptLazy.\n`);
process.exit(pendientes.size ? 3 : 0);
