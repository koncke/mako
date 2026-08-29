// Suma al CATÁLOGO las fichas de curso que están en disco y nadie importó.
//
//   node scripts/curso-al-catalogo.mjs            # las agrega
//   node scripts/curso-al-catalogo.mjs --ver      # solo dice cuáles faltan
//
// ⚠️ POR QUÉ EXISTE: publicar un curso son DOS pasos y el segundo era MANUAL.
//
// `curso-a-portal.mjs` escribe `app/conocimientos/curso-<slug>.ts` y después imprime
// «Falta UN paso a mano en catalogo.ts: import … y sumarlo a CURSOS_TODOS». Ese aviso
// estaba, se leyó, y aun así el 28/08/2026 había **13 cursos publicados en disco que el
// portal no mostraba**: Cardona, MonetizaTube, AutomatizaTube, Automatización y
// Monetización, y todos los de esa tanda. Martín los buscó y no estaban.
//
// La forma en que falla es la peor: el `.ts` existe, tiene sus clases, sus
// transcripciones y sus ids de Drive, el commit se ve completo y NADA falla. El curso
// simplemente no aparece — y desde afuera es indistinguible de «no se procesó».
//
// Es «un comentario no es un control», otra vez: con 72 cursos en la cola, el aviso se
// iba a ignorar 72 veces más. Lo que lo cierra es que el paso lo dé el código.
//
// ⚠️ Y NO toca lo que ya está: solo agrega lo que falta, al final del array y con su
//    import. Un curso que alguien puso a mano con `conRecursos(...)` o `portadasModulo`
//    queda como está — se detecta por el PATH del import, no por el nombre de la const.

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const tiene = (n) => process.argv.includes(`--${n}`);
const REPO = process.cwd();
const DIR = join(REPO, 'app', 'conocimientos');
const CAT = join(DIR, 'catalogo.ts');

const constDe = (slug) => `CURSO_${slug.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;

let cat = readFileSync(CAT, 'utf8');
const NL = cat.includes('\r\n') ? '\r\n' : '\n';

const fichas = readdirSync(DIR)
  .map((f) => /^curso-(.+)\.ts$/.exec(f))
  .filter(Boolean)
  .map((m) => m[1])
  .sort();

// El PATH del import es la clave: el nombre de la const puede diferir del slug.
const faltan = fichas.filter((s) => !cat.includes(`'./curso-${s}'`));

console.log(`\n  ${fichas.length} ficha(s) en disco · ${faltan.length} sin importar en catalogo.ts\n`);
for (const s of faltan) console.log(`     ✖ ${s}`);
if (!faltan.length) { console.log('  Todo el catálogo al día.\n'); process.exit(0); }
if (tiene('ver')) { console.log('\n  (--ver: no escribí nada)\n'); process.exit(0); }

// ── 1. los imports, después del último `import { CURSO_… } from './curso-…'` ─────────
const imports = [...cat.matchAll(/^import \{ CURSO_[A-Z0-9_]+ \} from '\.\/curso-[^']+';$/gm)];
if (!imports.length) { console.error('\n  ✖ No encontré los imports de curso en catalogo.ts\n'); process.exit(1); }
const ultimo = imports[imports.length - 1];
const nuevosImports = faltan.map((s) => `import { ${constDe(s)} } from './curso-${s}';`).join(NL);
cat = cat.slice(0, ultimo.index + ultimo[0].length) + NL + nuevosImports + cat.slice(ultimo.index + ultimo[0].length);

// ── 2. las constantes, al final del array ────────────────────────────────────────────
// El ancla es el cierre del array: `].map((c) => ({`. Se inserta ANTES, para no meterse
// entre el spread y el map.
const cierre = '].map((c) => ({';
if (!cat.includes(cierre)) { console.error('\n  ✖ No encontré el cierre de CURSOS_TODOS\n'); process.exit(1); }
const bloque = `${NL}  // Sumados por scripts/curso-al-catalogo.mjs (ver el porqué en ese archivo).${NL}`
  + faltan.map((s) => `  ${constDe(s)},`).join(NL) + NL;
cat = cat.replace(cierre, bloque + cierre);

writeFileSync(CAT, cat, 'utf8');
console.log(`\n  ✓ ${faltan.length} curso(s) sumado(s) a catalogo.ts`);
console.log(`  Verificá con:  npm run typecheck\n`);
