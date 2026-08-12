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
// A Drive va SIEMPRE el archivo tal cual se bajó (máxima calidad): no se recodifica
// ni se baja de resolución en ningún punto.
//
// --liberar borra el original LOCAL, y solo el que cumple las cuatro condiciones:
// está dentro de video/, tiene id de Drive, la copia en G: coincide byte a byte, y
// el propio Drive reporta ese mismo tamaño (o sea: terminó de subir, no solo de
// registrarse). Cualquier duda = se conserva. Y solo actúa si queda menos de
// --min-libre-gb libre, así que con espacio de sobra no borra nada.
//
//   node <abs>\scripts\curso-a-drive.mjs --plan C:\cursos\<slug>\plan.json
//   node <abs>\scripts\curso-a-drive.mjs --plan … --solo-ids   # sin copiar, solo leer ids
//   node <abs>\scripts\curso-a-drive.mjs --plan … --liberar    # + limpiar local si falta espacio
//   node <abs>\scripts\curso-a-drive.mjs --plan … --liberar --min-libre-gb 99999  # limpiar siempre

import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, statSync, readdirSync, unlinkSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
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
const LIBERAR = tiene('liberar');           // borrar el local una vez CONFIRMADO arriba
const MIN_LIBRE = Number(arg('min-libre-gb', 25)); // solo libera si queda menos que esto

if (!PLAN || !existsSync(PLAN)) { console.error('\n  ✖ Falta --plan <plan.json>\n'); process.exit(1); }
// .replace del BOM: en PowerShell 5.1 «Set-Content -Encoding utf8» escribe UTF-8
// CON BOM, y JSON.parse de Node revienta con «Unexpected token '﻿'». Cualquier
// edición del plan desde PowerShell lo reintroduce, así que se limpia al leer.
const plan = JSON.parse(readFileSync(PLAN, 'utf8').replace(/^﻿/, ''));
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

// ⚠️ Drive crea la fila ANTES de subir el archivo, con un id PLACEHOLDER
// ('local-46973') y file_size = 0. Ese id no sirve para nada: DRIVE_PREVIEW con
// él da un iframe muerto. El id de verdad son 25+ chars alfanuméricos y aparece
// recién cuando el archivo existe del lado del servidor.
// Tomar el placeholder por bueno fue un falso positivo que reportó "20/20 OK"
// con cero archivos subidos, así que la validación es explícita y no derivada.
const ID_REAL = /^[A-Za-z0-9_-]{20,}$/;
const esIdReal = (id) => typeof id === 'string' && !id.startsWith('local-') && ID_REAL.test(id);

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
  const enVuelo = new Map(); // registrado pero todavía subiendo
  for (const n of nombres) {
    const filas = q.all(n);
    const reales = filas.filter((f) => esIdReal(f.id));
    if (reales.length === 1) out.set(n, { id: reales[0].id, size: Number(reales[0].file_size ?? 0) });
    else if (reales.length > 1) out.set(n, { ambiguo: reales.length, id: reales[0].id, size: Number(reales[0].file_size ?? 0) });
    else if (filas.length) enVuelo.set(n, filas[0].id); // hay fila, con id placeholder
  }
  db.close();
  try { unlinkSync(tmp); } catch {}
  return { ids: out, enVuelo };
};

// ── 1. Copiar (= subir) ──────────────────────────────────────────────────────
// La convención de la carpeta en Drive es «<Curso> - <Autor>», y la cumplen 36 de
// las 39 carpetas de CURSOS. El autor sale del plan (--autor en curso-plan-vip),
// porque la API de la plataforma no lo trae. Separador: guión normal, que es el que
// usan 33 de las 36 (las otras 3 tienen guión largo, que no se replica a propósito).
const nombreCurso = plan.autor?.trim()
  ? `${limpio(plan.curso)} - ${limpio(plan.autor)}`
  : limpio(plan.curso);
const dirCurso = join(DRIVE, nombreCurso);
if (!plan.autor?.trim()) {
  console.log(`\n  ⚠ El plan no trae autor, así que la carpeta va a quedar «${nombreCurso}»`);
  console.log(`    y sin el « - Autor» que usan las otras 36. Agregá "autor" al plan.json.`);
}
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
    esperados.push({ nombre: cand[0], clase: c, src, dst });

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

  // --solo-copiar: para correr EN PARALELO con la descarga. Copiar a G: es
  // instantáneo (Drive sube después, en su propio background), pero resolver los
  // ids exige esperar a que la subida TERMINE del lado del servidor — y eso puede
  // ser media hora. Se separan: copiar cada ronda, resolver ids una sola vez al
  // final con --solo-ids.
  if (tiene('solo-copiar')) {
    console.log(`  (--solo-copiar: no espero los ids. Al final: --solo-ids)\n`);
    process.exit(0);
  }
} else {
  for (const c of plan.clases) {
    const dirVideo = join(base, 'video');
    const cand = existsSync(dirVideo) ? readdirSync(dirVideo).filter((f) => f.startsWith(c.archivo)) : [];
    if (!cand.length) continue;
    const mod = limpio(c.modulo ?? 'Sin módulo').replace(/^(\d+)\.\s*/, (_, n) => `${String(n).padStart(2, '0')} `);
    esperados.push({ nombre: cand[0], clase: c, src: join(dirVideo, cand[0]), dst: join(dirCurso, mod, cand[0]) });
  }
}

if (!esperados.length) { console.error('\n  ✖ No hay nada para mapear. ¿Corriste curso-bajar.mjs?\n'); process.exit(1); }

// ── 2. Esperar a que Drive registre y leer los ids ───────────────────────────
console.log(`\n  Esperando a que Drive suba y registre (tope ${MINUTOS} min)…`);
console.log('  (el id aparece cuando el archivo existe del lado del servidor)\n');

const pendientes = new Map(esperados.map((e) => [e.nombre, e.clase]));
const resueltos = new Map();
const t0 = Date.now();

let vuelta = 0;
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
  // Distinguir "Drive todavía no lo vio" de "lo registró y está subiendo": son
  // dos estados distintos y el segundo es progreso, no un problema.
  if (pendientes.size && vuelta++ % 6 === 0) {
    const subiendo = r.enVuelo?.size ?? 0;
    const mins = Math.round((Date.now() - t0) / 60000);
    console.log(`  … ${resueltos.size} con id · ${subiendo} subiendo · ${pendientes.size - subiendo} sin registrar aún  (${mins} min)`);
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

// ── 4. Liberar espacio local, SOLO con la subida confirmada ──────────────────
// La guarda va en POSITIVO (AGENTS.md): se borra únicamente el archivo que cumple
// TODAS las condiciones. Cualquier duda = no se borra. Un borrado de más acá
// significa perder una descarga de 100 MB y volver a bajarla, así que el costo de
// ser conservador es cero y el de equivocarse no.
if (LIBERAR) {
  const libreGB = () => {
    try {
      const raiz = base.slice(0, 3); // 'C:\'
      const out = execFileSync('powershell', ['-NoProfile', '-Command',
        `[math]::Round((Get-PSDrive ${raiz[0]}).Free/1GB,2)`], { encoding: 'utf8' });
      return Number(out.trim());
    } catch { return null; }
  };
  const libre = libreGB();

  console.log(`\n  ── Liberar espacio local ──`);
  console.log(`  Libre en ${base.slice(0, 3)}: ${libre ?? '?'} GB · umbral: ${MIN_LIBRE} GB`);

  if (libre !== null && libre >= MIN_LIBRE) {
    console.log(`  Nada que liberar: sobra espacio. (Para forzar: --min-libre-gb 99999)`);
  } else {
    let borrados = 0, bytes = 0;
    for (const e of esperados) {
      const r = resueltos.get(e.nombre);
      const razon = [];

      // Las cuatro condiciones que habilitan el borrado, todas en positivo.
      const dentroDelCurso = !!e.src && e.src.startsWith(join(base, 'video') + '\\');
      // esIdReal explícito: un 'local-*' significa que Drive NO subió nada todavía.
      const tieneId = esIdReal(r?.id) && !r?.ambiguo;
      const localOk = !!e.src && existsSync(e.src);
      const tamLocal = localOk ? statSync(e.src).size : -1;
      const copiaOk = !!e.dst && existsSync(e.dst) && statSync(e.dst).size === tamLocal;
      const driveOk = tieneId && Number(r.size) === tamLocal;

      if (!dentroDelCurso) razon.push('fuera de video/');
      if (!tieneId) razon.push(r?.ambiguo ? 'id ambiguo' : 'sin id de Drive');
      if (!localOk) razon.push('ya no está local');
      if (!copiaOk) razon.push('la copia en G: no coincide en bytes');
      if (!driveOk && tieneId) razon.push(`Drive reporta ${r.size} B y el local ${tamLocal} B (sigue subiendo)`);

      if (dentroDelCurso && tieneId && localOk && copiaOk && driveOk) {
        unlinkSync(e.src);
        borrados++; bytes += tamLocal;
        console.log(`  🗑 ${e.nombre}  (${mb(tamLocal)} MB liberados)`);
      } else {
        console.log(`  · conservo ${e.nombre} — ${razon.join(' · ')}`);
      }
    }
    console.log(`\n  ${borrados} archivo(s) borrado(s) del local · ${mb(bytes)} MB liberados`);
    if (borrados) console.log(`  El máster en máxima calidad queda en ${dirCurso}`);
  }
}

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
