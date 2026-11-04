#!/usr/bin/env node
// =============================================================================
// generar-clases-de-referentes.mjs — el índice chico de clases por gurú (3/11/2026)
// =============================================================================
// ⚠️ POR QUÉ EXISTE, y es un error mío medido en Vercel: para colgarle a un chat el curso de su
// referente, `lib/cerebro-para-chat.ts` importaba `@/app/conocimientos/catalogo`. Ese catálogo
// arrastra los 100+ archivos de cursos, y el deploy se rompió:
//
//     The Vercel Function "admin/docs" is 281.43mb uncompressed, exceeds the maximum of 250mb
//
// El build pasaba y Actions estaba en VERDE: el límite es del empaquetado, no de los tipos ni de
// los tests. Por eso CI no lo vio.
//
// La solución es no importar el catálogo: de cada curso sólo hacen falta los `videoId`, los
// títulos de sus clases y su módulo, que son unos pocos KB. Esto los extrae y los deja en un JSON.
//
// Cada clase: `{ t: título, v: videoId, g?: módulo }`. El módulo (el `grupo` de la clase) es la sección de su
// Second Brain (lib/cerebro-referente-vista.ts).
//
// ⚠️ SE LEE BLOQUE POR BLOQUE, nunca con una regex suelta sobre el archivo (4/11/2026). La de antes
// buscaba `titulo:` y encontraba también `subtitulo:` del CURSO: la primera clase de Hormozi quedó
// titulada «33 clases, 2 módulos. Video, transcripción y tus apuntes en un solo lugar.».
//
// Correr cuando se agregue un referente o cambie su curso:
//   node scripts/generar-clases-de-referentes.mjs
// =============================================================================

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(RAIZ, 'app', 'conocimientos');
const SALIDA = path.join(RAIZ, 'lib', 'asesores', 'clases-de-referentes.json');

// Los slugs que nos importan salen del mapa de referentes, para no leer 100 cursos.
const mapa = readFileSync(path.join(RAIZ, 'lib', 'asesores', 'cursos.ts'), 'utf8');
const slugs = [...mapa.matchAll(/'([a-z0-9-]+)':\s*'([a-z0-9-]+)',/g)].map((m) => m[2]);
const quiero = new Set(slugs);

/** Un campo de texto de un bloque de clase (`    grupo: '…',`), con sus comillas escapadas resueltas. */
const campo = (bloque, nombre) => {
  const m = new RegExp(`^ {6}${nombre}: '((?:[^'\\\\]|\\\\.)*)'`, 'm').exec(bloque);
  return m ? m[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\').trim() : '';
};

const salida = {};
for (const f of readdirSync(DIR)) {
  if (!f.startsWith('curso-') || !f.endsWith('.ts')) continue;
  const src = readFileSync(path.join(DIR, f), 'utf8').replace(/\r\n/g, '\n');
  const slug = (/^ {2}slug: '([^']+)'/m.exec(src) || [])[1];
  if (!slug || !quiero.has(slug)) continue;
  // Las clases, en el orden del archivo: cada una es un bloque `    {` … `    },` adentro de `clases: [`.
  const inicio = src.indexOf('\n  clases: [');
  if (inicio < 0) continue;
  const leidas = [];
  for (const bloque of src.slice(inicio).split(/\n {4}\{\n/).slice(1)) {
    const v = (/^ {6}videoId: '([A-Za-z0-9_-]+)'/m.exec(bloque) || [])[1];
    if (!v) continue;
    const grupo = campo(bloque, 'grupo').slice(0, 120);
    // Una clase sin sección es su propia sección con el nombre del módulo (la última de Hormozi, «Workshop Recordings»).
    leidas.push({ t: campo(bloque, 'titulo').slice(0, 200), v, grupo, sub: campo(bloque, 'subgrupo').slice(0, 120) || grupo });
  }
  // LA SECCIÓN de cada clase. Casi siempre es su módulo (`grupo`). Pero un curso de menos de 4 módulos con sus clases repartidas en
  // SECCIONES adentro (`subgrupo`) se lee por sección: el de Hormozi son 2 módulos y uno tiene 32 de sus 33 clases — en el mapa era
  // una estrella —, y por sección son 8. Una sección que se llama igual en dos módulos lleva el módulo entre paréntesis.
  const grupos = new Set(leidas.map((c) => c.grupo));
  const combos = new Set(leidas.map((c) => `${c.grupo}|${c.sub}`));
  const porSeccion = grupos.size < 4 && combos.size >= 4 && combos.size <= 30;
  const subEnVarios = new Set([...new Set(leidas.map((c) => c.sub))].filter((x) => new Set(leidas.filter((c) => c.sub === x).map((c) => c.grupo)).size > 1));
  const clases = leidas.map(({ t, v, grupo, sub }) => {
    const g = porSeccion ? (subEnVarios.has(sub) ? `${sub} (${grupo})` : sub) : grupo;
    return g ? { t, v, g } : { t, v };
  });
  if (clases.length) salida[slug] = clases;
}

writeFileSync(SALIDA, `${JSON.stringify(salida, null, 0)}\n`, 'utf8');
const total = Object.values(salida).reduce((n, c) => n + c.length, 0);
console.log(`${path.relative(RAIZ, SALIDA)} · ${Object.keys(salida).length} cursos · ${total} clases · ${Math.round(JSON.stringify(salida).length / 1024)} KB`);
for (const [s, c] of Object.entries(salida)) console.log(`  ${s.padEnd(44)} ${c.length} clases · ${new Set(c.map((x) => x.g ?? '')).size} módulos`);
