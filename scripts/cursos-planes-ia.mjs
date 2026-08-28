// Arma el plan.json de VARIOS cursos de una, manejando el Chrome dedicado.
//
//   node scripts/cursos-planes-ia.mjs                 # todos los de categoría IA que falten
//   node scripts/cursos-planes-ia.mjs --solo udia,master-ia
//   node scripts/cursos-planes-ia.mjs --categoria Ecommerce
//
// Requiere el Chrome dedicado abierto y logueado:
//   powershell -File scripts/curso-perfil.ps1
//
// ⚠️ POR QUÉ NO SE CRUZA POR SLUG. El slug de la plataforma y el del portal NO coinciden:
// «Curso de Claude AI - Rodrigo Rojo» es `curso-de-claude-ai-rodrigo-rojo` allá y
// `claude-ai-rodrigo-rojo` acá. Cruzar por slug lo reporta como faltante y manda a
// rebajar 20 clases que ya están publicadas. Se cruza por TRES claves —slug de
// plataforma, carpeta local del plan.json, y título normalizado— y alcanza con que una
// matchee. Es la regla de «contar filas no es contar cosas»: el parecido inventa
// faltantes en las dos direcciones.
//
// ⚠️ Y NO se abre una pestaña por curso sin cerrarla: `curso-plan.mjs` se planta si hay
// varias pestañas de curso abiertas (con razón — un curso equivocado se descubre con
// 2 GB bajados). Acá se abre una, se usa, se cierra.

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const PORT = Number(arg('port', 9333));
const CAT = arg('categoria', 'IA');
const SOLO = (arg('solo', '') || '').split(',').map((s) => s.trim()).filter(Boolean);
const RAIZ = arg('raiz', 'C:\\cursos');
const CATALOGO = arg('catalogo', join(RAIZ, 'catalogo-plataforma-full.json'));
const REPO = process.cwd();

const norm = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '');

const cdp = async (ruta, metodo = 'GET') => {
  const r = await fetch(`http://127.0.0.1:${PORT}${ruta}`, { method: metodo });
  const t = await r.text();
  try { return JSON.parse(t); } catch { return t; }
};

// ── qué cursos ya están, por las TRES claves ────────────────────────────────────────
const publicados = new Set();
const dirPortal = join(REPO, 'app', 'conocimientos');
if (existsSync(dirPortal)) {
  for (const f of readdirSync(dirPortal)) {
    const m = /^curso-(.+)\.ts$/.exec(f);
    if (m) publicados.add(norm(m[1]));
  }
}
// carpeta local -> slug de plataforma (de la URL del plan.json)
const localPorSlug = new Map();
for (const d of readdirSync(RAIZ, { withFileTypes: true })) {
  if (!d.isDirectory()) continue;
  const pj = join(RAIZ, d.name, 'plan.json');
  if (!existsSync(pj)) continue;
  try {
    const p = JSON.parse(readFileSync(pj, 'utf8'));
    const m = /\/curso\/([^/?#]+)/.exec(p.pagina || '');
    if (m) localPorSlug.set(norm(m[1]), d.name);
    if (p.slug) localPorSlug.set(norm(p.slug), d.name);
    if (p.curso) localPorSlug.set(norm(p.curso), d.name);
  } catch { /* un plan roto no frena el censo */ }
}

const yaEsta = (c) => {
  const claves = [norm(c.slug), norm(c.title)];
  for (const k of claves) {
    if (!k) continue;
    if (publicados.has(k)) return true;
    const car = localPorSlug.get(k);
    if (car && publicados.has(norm(car))) return true;
  }
  return false;
};

// ── el listado ──────────────────────────────────────────────────────────────────────
const cat = JSON.parse(readFileSync(CATALOGO, 'utf8'));
let cursos = cat.filter((c) => (c.category || '') === CAT);
if (SOLO.length) cursos = cursos.filter((c) => SOLO.some((s) => norm(c.slug).includes(norm(s))));

const faltan = cursos.filter((c) => !yaEsta(c) && !existsSync(join(RAIZ, c.slug, 'plan.json')));
const hechos = cursos.length - faltan.length;

console.log(`\n  Categoría «${CAT}»: ${cursos.length} cursos · ${hechos} ya con plan o publicados · ${faltan.length} por enumerar\n`);
if (!faltan.length) { console.log('  Nada que hacer.\n'); process.exit(0); }

// ── una pestaña por curso, abrir → plan → cerrar ─────────────────────────────────────
const ok = [];
const mal = [];
for (const [i, c] of faltan.entries()) {
  const url = `https://cursoselite.com.mx/curso/${c.slug}`;
  console.log(`\n  ── ${i + 1}/${faltan.length} · ${c.title} — ${c.instructor || '(sin autor)'}`);
  console.log(`     ${url}`);

  let tab;
  try {
    tab = await cdp(`/json/new?${url}`, 'PUT');
  } catch (e) {
    console.error(`     ✖ no pude abrir la pestaña: ${e.message}`);
    mal.push({ ...c, motivo: 'no abrió la pestaña' });
    continue;
  }
  await new Promise((r) => setTimeout(r, 9000)); // que cargue la SPA

  const p = spawnSync(process.execPath, [
    join(REPO, 'scripts', 'curso-plan.mjs'),
    '--url', c.slug,
    '--autor', c.instructor || '',
    '--port', String(PORT),
    '--raiz', RAIZ,
  ], { encoding: 'utf8' });

  const out = `${p.stdout || ''}${p.stderr || ''}`;
  const resumen = out.split('\n').map((l) => l.trim()).filter((l) => /clases con video|PDF\(s\)|✖|No encontr/.test(l)).slice(-3);
  for (const l of resumen) console.log(`     ${l}`);

  if (p.status === 0) ok.push(c); else { mal.push({ ...c, motivo: `salió ${p.status}` }); }

  if (tab && tab.id) { try { await cdp(`/json/close/${tab.id}`); } catch { /* la cierra el usuario */ } }
}

console.log(`\n${'─'.repeat(70)}`);
console.log(`  ${ok.length} plan(es) armado(s) · ${mal.length} con error`);
for (const m of mal) console.log(`     ✖ ${m.title} — ${m.motivo}`);
console.log(`\n  Los planes quedan en ${RAIZ}\\<slug>\\plan.json`);
console.log(`  Seguí con la cola:  schtasks /run /tn "cursos-cola"\n`);
