#!/usr/bin/env node
// =============================================================================
// generar-clases-de-referentes.mjs — el índice chico de clases por gurú (3/11/2026)
// =============================================================================
// ⚠️ POR QUÉ EXISTE, y es un error mío medido en Vercel: para colgarle a un chat el curso de su
// referente, `lib/cerebro-para-chat.ts` importaba `@/app/conocimientos/catalogo`. Ese catálogo
// arrastra los 100+ archivos de cursos, y el deploy se rompió:
//
//     The Vercel Function "admin/docs" is 281.43mb uncompressed которое exceeds the maximum of 250mb
//
// El build pasaba y Actions estaba en VERDE: el límite es del empaquetado, no de los tipos ni de
// los tests. Por eso CI no lo vio.
//
// La solución es no importar el catálogo: de cada curso sólo hacen falta los `videoId` y los
// títulos de sus clases, que son unos pocos KB. Esto los extrae y los deja en un JSON.
//
// Correr cuando se agregue un referente o cambie su curso:
//   node scripts/generar-clases-de-referentes.mjs
// =============================================================================
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const RAIZ = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const DIR = path.join(RAIZ, 'app', 'conocimientos');
const SALIDA = path.join(RAIZ, 'lib', 'asesores', 'clases-de-referentes.json');

// Los slugs que nos importan salen del mapa de referentes, para no leer 100 cursos.
const mapa = readFileSync(path.join(RAIZ, 'lib', 'asesores', 'cursos.ts'), 'utf8');
const slugs = [...mapa.matchAll(/'([a-z0-9-]+)':\s*'([a-z0-9-]+)',/g)].map((m) => m[2]);
const quiero = new Set(slugs);

const salida = {};
for (const f of readdirSync(DIR)) {
  if (!f.startsWith('curso-') || !f.endsWith('.ts')) continue;
  const src = readFileSync(path.join(DIR, f), 'utf8');
  const slug = (/^ {2}slug: '([^']+)'/m.exec(src) || [])[1];
  if (!slug || !quiero.has(slug)) continue;
  // Las clases, en el orden del archivo: su título y su videoId.
  const clases = [];
  const re = /titulo:\s*'((?:[^'\\]|\\.)*)'[\s\S]{0,400}?videoId:\s*'([A-Za-z0-9_-]+)'/g;
  let m;
  while ((m = re.exec(src))) clases.push({ t: m[1].replace(/\\'/g, "'").slice(0, 200), v: m[2] });
  if (clases.length) salida[slug] = clases;
}

writeFileSync(SALIDA, `${JSON.stringify(salida, null, 0)}\n`, 'utf8');
const total = Object.values(salida).reduce((n, c) => n + c.length, 0);
console.log('%s · %d cursos · %d clases · %d KB', path.relative(RAIZ, SALIDA), Object.keys(salida).length, total, Math.round(JSON.stringify(salida).length / 1024));
for (const [s, c] of Object.entries(salida)) console.log('  %-44s %d clases', s, c.length);
