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

import { execSync } from 'node:child_process';

// ⚠️ SE PREGUNTA POR EL COMMIT (HEAD), NO POR EL ARBOL DE TRABAJO.
//
//    La primera versión leía el `catalogo.ts` del disco y lo cruzaba contra `git ls-files`.
//    Eso mide una mezcla de dos cosas —lo que está escrito ahora y lo que está commiteado—
//    y con DOS SESIONES sobre el mismo clon deja un bloqueo cruzado: la cola le agrega un
//    import al catálogo del disco, la ficha todavía no está commiteada, y a partir de ahí
//    **ninguna de las dos sesiones puede pushear**, ni siquiera la que solo toca `docs/`.
//    Pasó a la hora de instalarlo: la otra sesión tenía un commit de documentación esperando
//    y esta guarda se lo trababa por un archivo que no era suyo.
//
//    Lo que se pushea es HEAD. Un archivo sin commitear no va a romper ningún build, así
//    que no tiene por qué frenar a nadie. Un guard que bloquea por algo que no se publica
//    no protege: estorba, y lo que se aprende es a saltearlo.
const enHead = (ruta) => execSync(`git show HEAD:${ruta}`, { encoding: 'utf8' });

const CAT = 'app/conocimientos/catalogo.ts';
const cat = enHead(CAT);

// Todo import relativo del catálogo, no solo los `curso-*`: un `./AnalisisNegocio` sin
// commitear rompe el build igual.
const imports = [...cat.matchAll(/from '\.\/([^']+)'/g)].map((m) => m[1]);

const trackeados = new Set(
  execSync('git ls-tree --name-only HEAD app/conocimientos/', { encoding: 'utf8' })
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/^app\/conocimientos\//, '').replace(/\.tsx?$/, '')),
);

const faltan = imports.filter((i) => !trackeados.has(i));

if (!faltan.length) {
  console.log(`  ✓ las ${imports.length} fichas que importa el catálogo commiteado existen en el commit.`);
  process.exit(0);
}

console.error(`\n  ✖ EL CATALOGO COMMITEADO IMPORTA ${faltan.length} ARCHIVO(S) QUE NO ESTAN EN EL COMMIT.`);
console.error('    El build de Vercel va a morir con «Module not found» y el push sale con 0.\n');
for (const f of faltan) console.error(`      · app/conocimientos/${f}.ts`);
console.error('\n    Se arregla commiteándolos (por ruta explícita, que acá hay dos sesiones):');
console.error(`      git add ${faltan.map((f) => `app/conocimientos/${f}.ts`).join(' ')}`);
console.error('      git commit\n');
process.exit(1);
