// ¿Todas las fichas que importa el catálogo están EN GIT?
//
//   node scripts/curso-catalogo-verificar.mjs
//
// Sale con código 1 si falta alguna. Lo corre el hook de pre-push.
//
// ⚠️ POR QUÉ EXISTE: el 29/08/2026 producción estuvo 46 minutos en la versión vieja y
// nada lo dijo. El commit subió `catalogo.ts` con 18 imports nuevos y NO los archivos que
// esos imports nombran — al commitear por ruta explícita se subió el índice y no lo
// indexado. El build de Vercel murió con 18 «Module not found» y el `git push` había
// salido con código 0.
//
// ⚠️ Y EL TYPECHECK NO LO CAZA, A PROPOSITO: corre contra el ARBOL DE TRABAJO, donde los
// archivos existen. Lo que falta es que existan EN GIT. Son dos preguntas distintas y
// hasta hoy solo una tenía guarda — por eso este chequeo pregunta por `git ls-files` y no
// por `existsSync`, que contestaría que sí sobre el mismo agujero.
//
// ⚠️ Y AHORA ES MAS FACIL QUE PASE, no menos: la cola llama sola a `curso-al-catalogo.mjs`
// después de publicar cada curso, así que CADA curso nuevo agrega un import por su cuenta.
// La automatización que arregló el olvido de importar creó un olvido nuevo, más silencioso.

import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const CAT = 'app/conocimientos/catalogo.ts';
const cat = readFileSync(CAT, 'utf8');

// Todo import relativo del catálogo, no solo los `curso-*`: un `./AnalisisNegocio` sin
// commitear rompe el build igual.
const imports = [...cat.matchAll(/from '\.\/([^']+)'/g)].map((m) => m[1]);

const trackeados = new Set(
  execSync('git ls-files app/conocimientos', { encoding: 'utf8' })
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/^app\/conocimientos\//, '').replace(/\.tsx?$/, '')),
);

const faltan = imports.filter((i) => !trackeados.has(i));

if (!faltan.length) {
  console.log(`  ✓ las ${imports.length} fichas que importa el catálogo están en git.`);
  process.exit(0);
}

console.error(`\n  ✖ EL CATALOGO IMPORTA ${faltan.length} ARCHIVO(S) QUE NO ESTAN EN GIT.`);
console.error('    El build de Vercel va a morir con «Module not found» y el push sale con 0.\n');
for (const f of faltan) console.error(`      · app/conocimientos/${f}.ts`);
console.error('\n    Se arregla agregándolos:');
console.error(`      git add ${faltan.map((f) => `app/conocimientos/${f}.ts`).join(' ')}\n`);
process.exit(1);
