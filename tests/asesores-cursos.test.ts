// =============================================================================
// Cada referente apunta a un curso que EXISTE, verificado abriendo los archivos (2/11/2026)
// =============================================================================
// El mapa `CURSO_DE_REFERENTE` es el eslabón entre un asesor y su Second Brain: sin él, la capa no
// sabe qué curso leer, porque `Asesor.curso` guarda el título en prosa y no el slug.
//
// ⚠️ ESTE TEST ABRE LOS ARCHIVOS DE LOS CURSOS, no confía en el mapa. Un slug inventado o con una
// letra cambiada no rompe nada a la vista: simplemente el gurú se queda sin Second Brain y nadie se
// entera. Y deducir estos nombres YA puso dos mal en producción —«Jaime Jiguera» por Higuera y
// «Jordi Sigues» por Segués—, que es exactamente la clase de error que este test caza.
//
// PROBADO ROMPIÉNDOLO (2/11/2026), con el archivo en 4 / 0, una rotura por vez y restaurada:
//   · un slug con una letra cambiada ('social-funel')                       → 3 / 1
//   · un referente del catálogo con ficha pero sin curso en el mapa          → 2 / 2
//   · Albaa y Nievas apuntando a cursos distintos                            → 2 / 2
// Los del 3/11 (el mapa tenía 3 de los 22: Hormozi sin curso) están al final, con sus roturas.
// Correr: node --import tsx --test tests/asesores-cursos.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CURSO_DE_REFERENTE, cursoDeReferente } from '../lib/asesores/cursos';
import { ASESORES } from '../lib/asesores/catalogo';
import CLASES from '../lib/asesores/clases-de-referentes.json';

const CURSOS_DIR = join(__dirname, '..', 'app', 'conocimientos');

/** Todos los `slug:` de primer nivel declarados por los archivos de curso. */
function slugsQueExisten(): Set<string> {
  const vistos = new Set<string>();
  for (const f of readdirSync(CURSOS_DIR)) {
    if (!f.startsWith('curso-') || !f.endsWith('.ts')) continue;
    const src = readFileSync(join(CURSOS_DIR, f), 'utf8');
    // El slug del CURSO está con dos espacios de sangría; los de las clases van más adentro.
    const m = /^ {2}slug: '([^']+)'/m.exec(src);
    if (m) vistos.add(m[1]);
  }
  return vistos;
}

test('todos los cursos del mapa existen de verdad', () => {
  const existen = slugsQueExisten();
  assert.ok(existen.size > 20, `sólo encontré ${existen.size} cursos: el lector de slugs se rompió`);
  for (const [id, slug] of Object.entries(CURSO_DE_REFERENTE)) {
    assert.ok(existen.has(slug), `${id} apunta a «${slug}», que no es el slug de ningún curso. Verificalo abriendo el archivo, no deduciéndolo del nombre.`);
  }
});

test('los doce referentes que pidió Martín están en el mapa', () => {
  // Los diez que todavía no tienen ficha ya tienen su curso localizado: el mapa no es lo que falta.
  assert.equal(Object.keys(CURSO_DE_REFERENTE).length >= 12, true);
  for (const id of ['emilio-puigrredon', 'julian-alborna', 'juan-carrizo', 'vilma-nunez', 'mateo-maffia', 'samuel-albaa']) {
    assert.ok(cursoDeReferente(id), `${id} se quedó sin curso en el mapa`);
  }
});

test('ningún referente YA CARGADO que salga de un curso se queda sin su curso', () => {
  // Los asesores de las tandas viejas no tienen por qué estar; los de esta tanda sí.
  for (const id of ['emilio-puigrredon', 'julian-alborna']) {
    const esta = ASESORES.some((a) => a.id === id);
    if (!esta) continue;
    assert.ok(cursoDeReferente(id), `${id} está en el catálogo y no tiene curso: su Second Brain quedaría vacío`);
  }
});

test('Albaa y Nievas comparten curso, a propósito', () => {
  // «Growing Closer» es de los dos. La ficha de Albaa destila el appointment setter; la de Nievas,
  // el cierre. Si alguien «arregla» esto creyendo que es un duplicado, rompe uno de los dos.
  assert.equal(cursoDeReferente('samuel-albaa'), cursoDeReferente('agustin-nievas'));
  assert.match(cursoDeReferente('samuel-albaa') ?? '', /growing-closer/);
});

// ── Los 22 de la galería, con SU curso (3/11/2026) ───────────────────────────────────────────────────
// Martín: «Cuando le escribo a algun guru, aun no me respondo con su base de conocimientos». El mapa tenía 3 de los 22: los otros 19
// contestaban con la ficha y su Second Brain decía «todavía no tiene su curso», sin un error en ningún lado.
//
// PROBADO ROMPIÉNDOLO (3/11/2026), con estos tres en verde, una rotura por vez y restaurada:
//   · borrar 'hormozi' del mapa                                                → cae «todos los de la galería»
//   · 'hormozi' apuntando a otro curso que existe ('masteryhaus')              → cae «el de su ficha»
//   · sacar una clase de `clases-de-referentes.json`                           → cae «el índice trae todas sus clases»

test('todos los de la galería tienen curso: uno que falta se queda sin base de conocimientos', () => {
  const sinCurso = ASESORES.filter((a) => !cursoDeReferente(a.id)).map((a) => a.id);
  assert.deepEqual(sinCurso, []);
});

test('cada uno apunta al curso del que sale SU ficha, no a otro que también existe', () => {
  const slugDeArchivo = (archivo: string) => /^ {2}slug: '([^']+)'/m.exec(readFileSync(join(CURSOS_DIR, archivo), 'utf8'))?.[1];
  for (const a of ASESORES) {
    const ficha = readFileSync(join(__dirname, '..', 'lib', 'asesores', `ficha-${a.id}.ts`), 'utf8');
    const archivo = /app\/conocimientos\/(curso-[a-z0-9-]+\.ts)/.exec(ficha)?.[1];
    assert.ok(archivo, `la ficha de ${a.id} no dice de qué curso sale`);
    assert.equal(cursoDeReferente(a.id), slugDeArchivo(archivo), `${a.id}: su ficha sale de ${archivo}`);
  }
});

test('el índice trae todas sus clases: una que el generador no agarra se pierde en silencio', () => {
  const indice = CLASES as Record<string, Array<{ t: string; v: string }>>;
  const archivos = readdirSync(CURSOS_DIR).filter((f) => f.startsWith('curso-') && f.endsWith('.ts'));
  for (const a of ASESORES) {
    const slug = cursoDeReferente(a.id) ?? '';
    const src = archivos.map((f) => readFileSync(join(CURSOS_DIR, f), 'utf8')).find((s) => new RegExp(`^ {2}slug: '${slug}'`, 'm').test(s)) ?? '';
    const enElArchivo = [...src.matchAll(/videoId:\s*'([A-Za-z0-9_-]+)'/g)].length;
    assert.ok(enElArchivo > 0, `${a.id}: su curso no tiene clases`);
    assert.equal(indice[slug]?.length, enElArchivo, `${a.id}: el índice no trae todas las clases de ${slug} (node scripts/generar-clases-de-referentes.mjs)`);
  }
});
