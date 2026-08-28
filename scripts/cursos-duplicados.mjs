// ¿Hay cursos DUPLICADOS? Cruza las cuatro poblaciones que pueden tener copias del mismo
// curso con nombres distintos.
//
//   node scripts/cursos-duplicados.mjs
//
// ⚠️ POR QUÉ ESTO EXISTE. Un curso vive con cuatro nombres, y ninguno es la clave:
//
//   catálogo de plataforma  slug        `curso-de-claude-ai-rodrigo-rojo`
//   carpeta local           nombre      `100M money Models - Alex Hormozi`
//   ficha del portal        archivo     `curso-claude-ai-rodrigo-rojo.ts`
//   carpeta de Drive        «Curso - Autor»
//
// Los cuatro se derivan del título por caminos distintos, así que un acento, un guion o
// una mayúscula los parte en dos. Ya pasó: «MasteryHaus - Sofia Contreras» y «…Sofía…»
// dejaron DOS carpetas en Drive con 23 videos y 60 GB para el mismo curso, sin un solo
// error. Y `claude-ai-rodrigo-rojo` (vacía) convive con `curso-de-claude-ai-rodrigo-rojo`
// (la de verdad, 20 clases publicadas).
//
// Acá se compara SIEMPRE normalizado (sin acentos, sin separadores, minúsculas), que es
// la única forma de que dos nombres «iguales a ojo» se comparen de verdad.

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const RAIZ = arg('raiz', 'C:\\cursos');
const REPO = process.cwd();

const norm = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '');

const gb = (p) => {
  let t = 0;
  try { for (const f of readdirSync(p)) { try { t += statSync(join(p, f)).size; } catch { /* se lo llevaron */ } } } catch { /* no existe */ }
  return t / 2 ** 30;
};

// ── 1. carpetas locales: agrupar por lo que el plan dice que SON ────────────────────
const porClave = new Map(); // clave normalizada -> [{carpeta, clases, slug, titulo, gbVideo}]
const sinPlan = [];
for (const d of readdirSync(RAIZ, { withFileTypes: true })) {
  if (!d.isDirectory() || d.name.startsWith('_')) continue;
  const dir = join(RAIZ, d.name);
  const pj = join(dir, 'plan.json');
  if (!existsSync(pj)) {
    // Una carpeta sin plan con contenido adentro es sospechosa: o es basura, o es la
    // mitad huérfana de un duplicado.
    const v = gb(join(dir, 'video')) + gb(join(dir, 'audio')) + gb(join(dir, 'texto'));
    const arch = (() => { try { return readdirSync(dir).length; } catch { return 0; } })();
    if (arch) sinPlan.push({ carpeta: d.name, archivos: arch, gb: v });
    continue;
  }
  let p;
  try { p = JSON.parse(readFileSync(pj, 'utf8')); } catch { continue; }
  const claves = new Set([norm(p.curso), norm(p.slug)]);
  const m = /\/curso\/([^/?#]+)/.exec(p.pagina || '');
  if (m) claves.add(norm(m[1]));
  const ficha = {
    carpeta: d.name,
    clases: (p.clases || []).length,
    slug: p.slug || '',
    titulo: p.curso || '',
    autor: p.autor || '',
    gbVideo: gb(join(dir, 'video')),
    textos: (() => { try { return readdirSync(join(dir, 'texto')).length; } catch { return 0; } })(),
  };
  for (const k of claves) {
    if (!k) continue;
    if (!porClave.has(k)) porClave.set(k, []);
    if (!porClave.get(k).some((x) => x.carpeta === ficha.carpeta)) porClave.get(k).push(ficha);
  }
}

// ── 2. fichas del portal, agrupadas por título normalizado ──────────────────────────
const dirPortal = join(REPO, 'app', 'conocimientos');
const porTitulo = new Map();
if (existsSync(dirPortal)) {
  for (const f of readdirSync(dirPortal)) {
    const m = /^curso-(.+)\.ts$/.exec(f);
    if (!m) continue;
    let txt = '';
    try { txt = readFileSync(join(dirPortal, f), 'utf8'); } catch { /* sigue */ }
    const t = /titulo:\s*['"`]([^'"`]+)/.exec(txt);
    const clases = (txt.match(/videoId:/g) || []).length;
    const k = norm(t ? t[1] : m[1]);
    if (!porTitulo.has(k)) porTitulo.set(k, []);
    porTitulo.get(k).push({ archivo: f, titulo: t ? t[1] : '(sin título)', clases });
  }
}

// ── informe ─────────────────────────────────────────────────────────────────────────
let hallazgos = 0;

console.log('\n══ CARPETAS LOCALES que son el MISMO curso ═══════════════════════════');
const vistos = new Set();
for (const [k, arr] of porClave) {
  if (arr.length < 2) continue;
  const firma = arr.map((a) => a.carpeta).sort().join('|');
  if (vistos.has(firma)) continue;
  vistos.add(firma);
  hallazgos++;
  console.log(`\n  «${arr[0].titulo || k}»`);
  for (const a of arr) {
    console.log(`     ${a.carpeta.padEnd(42)} ${String(a.clases).padStart(4)} clases · ${a.textos} txt · ${a.gbVideo.toFixed(1)} GB video`);
  }
  const vacias = arr.filter((a) => !a.clases && !a.textos && a.gbVideo < 0.01);
  if (vacias.length) console.log(`     → sobra(n): ${vacias.map((v) => v.carpeta).join(', ')} (sin clases, sin texto, sin video)`);
}
if (!hallazgos) console.log('  (ninguna)');

console.log('\n══ FICHAS DEL PORTAL con el mismo título ═════════════════════════════');
let dupPortal = 0;
for (const [, arr] of porTitulo) {
  if (arr.length < 2) continue;
  dupPortal++;
  console.log(`\n  «${arr[0].titulo}»`);
  for (const a of arr) console.log(`     ${a.archivo.padEnd(52)} ${a.clases} clases`);
}
if (!dupPortal) console.log('  (ninguna)');

console.log('\n══ CARPETAS SIN PLAN pero con archivos ═══════════════════════════════');
console.log('  (o son basura, o son la mitad huérfana de un duplicado)');
if (!sinPlan.length) console.log('  (ninguna)');
for (const s of sinPlan.sort((a, b) => b.gb - a.gb).slice(0, 20)) {
  console.log(`     ${s.carpeta.padEnd(46)} ${String(s.archivos).padStart(3)} archivos · ${s.gb.toFixed(2)} GB`);
}

console.log(`\n${'─'.repeat(70)}`);
console.log(`  ${hallazgos} grupo(s) de carpetas duplicadas · ${dupPortal} ficha(s) repetida(s) · ${sinPlan.length} carpeta(s) sin plan\n`);
