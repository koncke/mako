// Reescribe C:/cursos/_cola.txt con los cursos que tienen plan y NO están publicados,
// de menor a mayor.
//
//   node scripts/cursos-cola-armar.mjs            # escribe la cola
//   node scripts/cursos-cola-armar.mjs --ver      # sólo muestra, no escribe
//
// ⚠️ EL CRUCE NO ES POR NOMBRE DE CARPETA, y esto ya costó dos errores el 27/08/2026:
//
//   · La carpeta «100M money Models - Alex Hormozi» se publica como `100m-money-models`.
//     Cruzar por nombre de carpeta la daba por pendiente → 27 cursos «faltantes» cuando
//     eran 15, con ~1.000 clases YA publicadas metidas en la cola.
//   · Y al revés: «Curso de Claude AI - Rodrigo Rojo» es `curso-de-claude-ai-rodrigo-rojo`
//     en la plataforma y `claude-ai-rodrigo-rojo` en el portal. Cruzar por el slug de
//     plataforma lo daba por faltante y mandaba a rebajar 20 clases publicadas.
//
// Se cruza por CUATRO claves —nombre de carpeta, `slug` y `curso` del plan, y el slug de
// la URL de `pagina`— y alcanza con que UNA matchee para considerarlo hecho. En un cruce
// que decide si se bajan decenas de GB, el falso «falta» es mucho más caro que el falso
// «ya está»: lo segundo se arregla mirando, lo primero se descubre con el disco lleno.
//
// ⚠️ Y HAY DUPLICADOS EN DISCO: 13 cursos tienen DOS carpetas —«<Curso> - <Autor>» con el
// trabajo hecho, y «<slug>» con un plan re-enumerado y nada más—. Por eso un curso cuya
// GEMELA ya está publicada tampoco entra: `scripts/cursos-duplicados.mjs` los lista.

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const tiene = (n) => process.argv.includes(`--${n}`);
const RAIZ = arg('raiz', 'C:\\cursos');
const SALIDA = arg('salida', join(RAIZ, '_cola.txt'));
const REPO = process.cwd();

const norm = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '');

// ── lo publicado ────────────────────────────────────────────────────────────────────
const publicados = new Set();
const dirPortal = join(REPO, 'app', 'conocimientos');
if (existsSync(dirPortal)) {
  for (const f of readdirSync(dirPortal)) {
    const m = /^curso-(.+)\.ts$/.exec(f);
    if (m) publicados.add(norm(m[1]));
  }
}

// ── todos los planes en disco, con sus cuatro claves ────────────────────────────────
const cursos = [];
for (const d of readdirSync(RAIZ, { withFileTypes: true })) {
  if (!d.isDirectory() || d.name.startsWith('_')) continue;
  const pj = join(RAIZ, d.name, 'plan.json');
  if (!existsSync(pj)) continue;
  let p;
  try { p = JSON.parse(readFileSync(pj, 'utf8')); } catch { continue; }
  const clases = (p.clases || []).length;
  if (!clases) continue;
  const claves = new Set([norm(d.name), norm(p.slug), norm(p.curso)]);
  const m = /\/curso\/([^/?#]+)/.exec(p.pagina || '');
  if (m) claves.add(norm(m[1]));
  claves.delete('');
  cursos.push({ carpeta: d.name, clases, claves, titulo: p.curso || d.name });
}

// ── un curso está hecho si ALGUNA de sus claves está publicada… ─────────────────────
// Igualdad NO alcanza: los prefijos parten la clave.
// curso-de-claude-ai-rodrigo-rojo (plataforma) y claude-ai-rodrigo-rojo (portal) son el
// MISMO curso, publicado y con sus 20 transcripciones. Normalizados no son iguales: uno
// lleva el prefijo "curso de". Con igualdad estricta volvia a la cola para bajarse entero.
//
// Por eso tambien matchea por CONTENCION, con un piso de 14 caracteres en la clave
// contenida. El piso es el guard: sin el, "masteria" matchearia dentro de cualquier
// "master ia ..." y daria por hecho un curso que no lo esta -- y ese error es el peor de
// los dos, porque un curso saltado no avisa NUNCA. 14 caracteres ya es una frase.
const PISO_CONTENIDA = 14;
const matchea = (k) => {
  if (publicados.has(k)) return true;
  for (const p of publicados) {
    if (p.length >= PISO_CONTENIDA && k.includes(p)) return true;
    if (k.length >= PISO_CONTENIDA && p.includes(k)) return true;
  }
  return false;
};
const hecho = (c) => [...c.claves].some(matchea);

// ── …o si su GEMELA en disco (misma clave) ya está publicada ────────────────────────
const porClave = new Map();
for (const c of cursos) for (const k of c.claves) {
  if (!porClave.has(k)) porClave.set(k, []);
  porClave.get(k).push(c);
}
const gemelaHecha = (c) => [...c.claves].some((k) => (porClave.get(k) || []).some((o) => o !== c && hecho(o)));

const pendientes = cursos.filter((c) => !hecho(c) && !gemelaHecha(c));

// Entre dos carpetas del MISMO curso pendientes, gana la que más trabajo tiene hecho:
// bajar la otra sería empezar de cero al lado de lo ya andado.
const elegidas = [];
const usadas = new Set();
for (const c of pendientes.sort((a, b) => b.clases - a.clases)) {
  const firma = [...c.claves].sort().join('|');
  if ([...c.claves].some((k) => usadas.has(k))) continue;
  for (const k of c.claves) usadas.add(k);
  elegidas.push(c);
  void firma;
}

elegidas.sort((a, b) => a.clases - b.clases);   // los chicos primero: publican antes

const total = elegidas.reduce((s, c) => s + c.clases, 0);
console.log(`\n  ${cursos.length} curso(s) con plan · ${cursos.length - pendientes.length} ya publicado(s) o gemelo de uno\n`);
for (const c of elegidas) console.log(`     ${c.carpeta.padEnd(46)} ${String(c.clases).padStart(4)} clases`);
console.log(`\n     ${'TOTAL'.padEnd(46)} ${String(total).padStart(4)} clases en ${elegidas.length} cursos`);

if (tiene('ver')) { console.log('\n  (--ver: no escribí nada)\n'); process.exit(0); }

// LF explícito: con CRLF el `\r` se pega al nombre de la carpeta y la cola saltea todo.
writeFileSync(SALIDA, elegidas.map((c) => c.carpeta).join('\n') + '\n', { encoding: 'utf8' });
console.log(`\n  → ${SALIDA}`);
console.log(`  Lanzá:  schtasks /run /tn "cursos-cola"\n`);
