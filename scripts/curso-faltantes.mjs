// =============================================================================
// curso-faltantes — qué le falta al portal contra la fuente, curso por curso
// =============================================================================
// Cruza el inventario de la fuente (`curso-inventario.mjs`) con lo que el portal tiene
// publicado, en los tres ejes que importan: MÓDULOS, LECCIONES y RECURSOS.
//
// ⚠️ LOS DOS DESCUENTOS QUE HAY QUE HACER, O EL NÚMERO MIENTE HACIA ARRIBA:
//
//  1. LA PLATAFORMA TIENE MATERIAL CARGADO DOS VECES. «Hackeando la Edición» devuelve 56
//     filas de recursos en UNA respuesta, con 56 ids distintos y 27 títulos: son ~28
//     archivos subidos dos veces. Único = mismo título Y mismo tamaño.
//  2. LAS LECCIONES DUPLICADAS LLEVAN UN SUFIJO. La segunda copia se llama «2. Intro (1)».
//     Títulos DISTINTOS, misma lección — por eso un chequeo de unicidad por título exacto
//     dice «0 repetidos» y deja pasar 20 duplicados. Pasó con jaque-blue: parecía que
//     faltaban 20 clases y el portal estaba perfecto.
//
// El dedup se valida solo contra los cursos que YA están completos: `claude-ai` da 40
// filas → 20 únicos y el portal tiene 20; `sell-your-knowledge` 39 → 39 → 39.
//
//   node scripts/curso-faltantes.mjs
// =============================================================================
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { esFinderJunk } from './curso-comun.mjs';

const RAIZ = 'C:\\cursos';
const DIR = join(process.cwd(), 'app', 'conocimientos');

/** Sin acentos, sin puntuación, sin el número del autor adelante. */
const norm = (x) => String(x ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/^\s*\d{1,3}\s*[.)-]\s*/, '').replace(/[^a-z0-9]+/g, '');

/**
 * La segunda copia de una lección duplicada. La plataforma la marca de TRES formas
 * distintas y las tres aparecen en cursos reales:
 *
 *   «2. Introduccion (1)»              jaque-blue — 20 de sus 40
 *   «Copy of 1_0 Comienza Aquí»        social-funnel
 *   «Copia de 1. Downsell Offers»      100m-money-models
 *
 * Contemplar solo la primera daba 86 lecciones «faltantes» que están todas publicadas.
 * Es la misma trampa de siempre: un chequeo de unicidad que no conoce todas las formas
 * del duplicado reporta como pérdida lo que es ruido del origen.
 */
const esCopia = (t) => /\(\d+\)\s*$/.test(String(t ?? '')) || /^\s*(copy of|copia de)\b/i.test(String(t ?? ''));

const filas = [];
for (const f of readdirSync(DIR).filter((x) => /^curso-.*\.ts$/.test(x))) {
  const slug = f.replace(/^curso-/, '').replace(/\.ts$/, '');
  const inv = join(RAIZ, slug, 'inventario.json');
  if (!existsSync(inv)) { filas.push({ slug, sin: 'sin inventario' }); continue; }
  const j = JSON.parse(readFileSync(inv, 'utf8'));
  if (j.capturaFallida) { filas.push({ slug, sin: 'NO SE PUDO CAPTURAR' }); continue; }

  const ts = readFileSync(join(DIR, f), 'utf8');
  // Los títulos del portal, en los dos dialectos de comillas.
  const portTit = [
    ...ts.matchAll(/titulo:\s*'((?:[^'\\]|\\.)*)'/g),
    ...ts.matchAll(/"titulo":\s*"((?:[^"\\]|\\.)*)"/g),
  ].map((m) => m[1]).filter(Boolean);
  const portRec = Math.max(0, (ts.match(/slug: '/g) ?? []).length - 1);

  // ⚠️ UNA COPIA SOLO ES COPIA SI EXISTE EL ORIGINAL. `social-funnel` tiene sus ONCE
  // lecciones nombradas «Copy of …» —así las subió el autor, no son duplicados— y el
  // filtro las borraba todas: el curso quedaba con 0 lecciones en la fuente, que es
  // exactamente el «cero que significa no miré» disfrazado de dato.
  //
  // Ahora se descarta la copia solo si su gemela sin marca está en la misma lista.
  const todasLec = (j.leccionesDetalle ?? []).map((x) => x.titulo || '');
  const sinMarca = new Set(todasLec.filter((t) => !esCopia(t)).map(norm));
  const desmarcar = (t) => String(t).replace(/\s*\(\d+\)\s*$/, '').replace(/^\s*(copy of|copia de)\s*/i, '');
  const srcLec = todasLec.filter((t) => !(esCopia(t) && sinMarca.has(norm(desmarcar(t)))));
  const enPortal = new Set(portTit.map(norm));
  const faltanLec = srcLec.filter((t) => !enPortal.has(norm(t)));

  // ⚠️ Sin sacar la basura del Finder, este informe —el que rotula «RECURSOS: N faltan, y
  // acá el número SÍ es duro»— afirma como hecho una pérdida que no existe: son los `._`
  // de macOS que el bajador saltea a propósito. Ver `esFinderJunk` en curso-comun.mjs.
  const uniRec = new Set((j.recursosDetalle ?? [])
    .filter((r) => !esFinderJunk(r.titulo ?? r.title))
    .map((r) => `${r.titulo}\u0000${r.bytes}`)).size;

  filas.push({
    slug,
    lecFuente: srcLec.length, lecPortal: portTit.length,
    // ⚠️ EL VEREDICTO ES POR CONTEO, NO POR TÍTULO. `faltanLec` sale de comparar títulos
    // normalizados, y eso NO se puede sostener como afirmación: el pipeline los reescribe
    // al ingerir, la plataforma los duplica con «Copy of» y cada captura lee un rótulo
    // distinto para la misma clase («1- Pre INTRO» contra «PRE INTRO»). Medido acá:
    // `social-funnel` decía «faltan 11» teniendo 13 en el portal y 11 en la fuente, o sea
    // afirmaba una pérdida sobre un curso que tiene MÁS de lo que la fuente declara.
    //
    // Si el portal tiene al menos tantas como la fuente, no falta nada y punto. La lista
    // por título sigue abajo, pero como PISTA para mirar a mano, no como número.
    faltanLec: Math.max(0, srcLec.length - portTit.length) ? faltanLec.length : 0,
    pistasTitulo: faltanLec.length,
    recFuente: uniRec, recPortal: portRec, faltanRec: Math.max(0, uniRec - portRec),
    truncado: !!j.truncado,
    ejemplos: faltanLec.slice(0, 3),
  });
}

const vivos = filas.filter((f) => !f.sin);
const pad = (s, n) => String(s).padEnd(n);
const num = (s, n) => String(s).padStart(n);

console.log(`\n  ${pad('curso', 34)} ${num('LECCIONES', 22)}   ${num('RECURSOS', 20)}`);
console.log(`  ${pad('', 34)} ${num('fuente', 7)}${num('portal', 8)}${num('faltan', 7)}   ${num('fuente', 7)}${num('portal', 7)}${num('faltan', 6)}`);
console.log('  ' + '─'.repeat(78));
let tl = 0, tr = 0;
for (const f of vivos.sort((a, b) => (b.faltanRec + b.faltanLec) - (a.faltanRec + a.faltanLec))) {
  tl += f.faltanLec; tr += f.faltanRec;
  const marca = f.truncado ? ' ⚠piso' : '';
  console.log(`  ${pad(f.slug, 34)} ${num(f.lecFuente, 7)}${num(f.lecPortal, 8)}${num(f.faltanLec || '-', 7)}   ${num(f.recFuente, 7)}${num(f.recPortal, 7)}${num(f.faltanRec || '-', 6)}${marca}`);
}
console.log('  ' + '─'.repeat(78));
console.log(`  ${pad('TOTAL', 34)} ${num('', 7)}${num('', 8)}${num(tl, 7)}   ${num('', 7)}${num('', 7)}${num(tr, 6)}`);

// ── EL VEREDICTO SE APOYA EN EL CONTEO, NO EN LOS TÍTULOS ───────────────────────
//
// ⚠️ La columna «faltan» de LECCIONES es una SOSPECHA, no un hecho, y hay que decirlo
// donde se lee el número. El pipeline REESCRIBE los títulos al ingerir —limpia, corrige
// mayúsculas, saca prefijos— así que cruzar por título produce huecos que no existen:
// «AS BAJO LA MANGA» y «Haz Bajo La manga» son la misma clase. De ahí salen las 86.
//
// Lo que SÍ es un hecho es el conteo: si el portal tiene tantas o más que la fuente, no
// se perdió ninguna, digan lo que digan los títulos. Un curso con MENOS es el único caso
// que hay que ir a mirar.
const faltanDeVerdad = vivos.filter((f) => f.lecPortal < f.lecFuente);
console.log('\n  ── LECCIONES: el veredicto por CONTEO (los títulos solo sospechan) ──');
if (!faltanDeVerdad.length) {
  console.log('  ✓ Ningún curso tiene MENOS lecciones que la fuente. Las «faltan» de arriba son');
  console.log('    títulos que el pipeline reescribió al ingerir, no clases perdidas.');
} else {
  for (const f of faltanDeVerdad) {
    console.log(`  ⚠ ${pad(f.slug, 34)} fuente ${f.lecFuente} · portal ${f.lecPortal} → faltan ${f.lecFuente - f.lecPortal}`);
  }
}
console.log(`\n  ── RECURSOS: ${tr} faltan, y acá el número SÍ es duro ──`);
console.log('     El portal tiene CERO en cada uno de esos cursos, así que no hay títulos');
console.log('     que cruzar: es la diferencia entre lo que la fuente tiene y nada.');

const sin = filas.filter((f) => f.sin);
if (sin.length) {
  console.log(`\n  Sin medir (${sin.length}):`);
  for (const f of sin) console.log(`    · ${pad(f.slug, 34)} ${f.sin}`);
}

const conLec = vivos.filter((f) => f.faltanLec);
if (conLec.length) {
  console.log('\n  Ejemplos de lecciones que faltan:');
  for (const f of conLec) console.log(`    ${f.slug}: ${f.ejemplos.map((t) => t.slice(0, 44)).join(' · ')}`);
}
