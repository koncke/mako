// =============================================================================
// La prueba de producción del aviso «ya quedó arreglado»: lo que SIRVE hola-mako.com, con el commit entero (24/10/2026)
// =============================================================================
// scripts/avisar-arreglo-al-grupo.mts manda el aviso al grupo de un cliente sólo si hola-mako.com sirve un despliegue de un
// commit de main que contiene el arreglo. Esa noche se creyó que la guarda no podía dar verde nunca («Vercel no guarda el
// commit», docs/hallazgos-infra.md): era el sha CORTO de la medición a mano. Con el entero, Vercel encuentra el despliegue.
// Las salidas de abajo son las reales del CLI 65.2.0 (24/10/2026, producción servida por mako-mht66t1ed, de 59d228ea1).
//
// Verificado ROMPIÉNDOLO (24/10/2026, base 6 / 0), de a una y restaurando a mano:
//   · `esShaEntero` que acepta el sha corto (`{7,40}`)                                  → 5 / 1
//   · `urlQueSirve` sin la bandera `m` (el `^` sólo mira la primera línea)              → 5 / 1
//   · `filaDeProduccion` sin mirar «● Ready»                                            → 5 / 1
//   · el script vuelve a aceptar cualquier despliegue Ready (sin `fila.url === sirve`)  → 4 / 2
//   · el script vuelve a pasarle `--yes` a `vercel inspect`                             → 5 / 1

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { esShaEntero, filaDeProduccion, urlQueSirve } from '../lib/vercel-salida';

const INSPECT = `Vercel CLI 65.2.0 (Node.js 24.17.0)
> Fetched deployment "mako-mht66t1ed-mbustos-4239s-projects.vercel.app" in mbustos-4239s-projects [1s]

  General

    id\t\tdpl_GMXTsznmTDkEBxNL5sb2Zmx8CsH7
    name\tmako
    target\tproduction
    status\t● Ready
    url\t\thttps://mako-mht66t1ed-mbustos-4239s-projects.vercel.app
    created\tSat Oct 24 2026 19:11:02 GMT-0300 (Argentina Standard Time) [7m ago]

  Build Machine
`.replace(/\n/g, '\r\n');

const LS_ENTERO = `Vercel CLI 65.2.0 (Node.js 24.17.0)
> Production deployments under mbustos-4239s-projects [279ms]

  Age     Project                         Deployment                                                   Status      Environment     Duration     Username
  6m      mbustos-4239s-projects/mako     https://mako-mht66t1ed-mbustos-4239s-projects.vercel.app     ● Ready     Production      2m           koncke

https://mako-mht66t1ed-mbustos-4239s-projects.vercel.app
`;
const LS_CORTO = `Vercel CLI 65.2.0 (Node.js 24.17.0)
> No deployments found under mbustos-4239s-projects.
`;
const LS_ARMANDO = LS_ENTERO.replace('● Ready  ', '● Building');
const INSPECT_YES = `Vercel CLI 65.2.0 (Node.js 24.17.0)
x unknown or unexpected option: --yes
  Vercel CLI 65.2.0 accepts: --api, --cwd, --debug, --format, --global-config, --help, --json, --local-config, --logs, --no-color
`;

test('el filtro de Vercel sólo reconoce el sha ENTERO', () => {
  assert.equal(esShaEntero('59d228ea1e921a29f83f5a5b6f4a52c16b6c3c90'), true);
  assert.equal(esShaEntero('59d228ea1'), false, 'con el corto Vercel contesta «No deployments found» para un despliegue vivo');
  assert.equal(esShaEntero('59D228EA1E921A29F83F5A5B6F4A52C16B6C3C90'), false);
});

test('de `vercel inspect hola-mako.com`: la URL del despliegue que sirve el dominio (no la de un alias)', () => {
  assert.equal(urlQueSirve(INSPECT), 'https://mako-mht66t1ed-mbustos-4239s-projects.vercel.app');
  assert.equal(urlQueSirve(INSPECT_YES), null, 'con `--yes` el CLI no contesta nada: no hay URL que inventar');
});

test('de `vercel ls --meta githubCommitSha=…`: la fila de producción y si está Ready', () => {
  assert.deepEqual(filaDeProduccion(LS_ENTERO), { url: 'https://mako-mht66t1ed-mbustos-4239s-projects.vercel.app', lista: true });
  assert.equal(filaDeProduccion(LS_CORTO), null);
  assert.equal(filaDeProduccion(LS_ARMANDO)?.lista, false, 'un despliegue que se está armando no es una prueba');
});

const SCRIPT = readFileSync(new URL('../scripts/avisar-arreglo-al-grupo.mts', import.meta.url), 'utf8')
  .replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('el script compara contra lo que SIRVE el dominio, con el sha entero, y no le pasa `--yes` a inspect', () => {
  assert.match(SCRIPT, /const sirve = urlQueSirve\(vercel\('inspect', DOMINIO\)\);/);
  assert.match(SCRIPT, /const DOMINIO = 'hola-mako\.com';/);
  assert.match(SCRIPT, /if \(fila && fila\.url === sirve\) \{/, 'un despliegue Ready que NO es el que sirve no prueba nada (una vuelta atrás)');
  assert.match(SCRIPT, /if \(!esShaEntero\(sha\)\)/);
  // Desde el 27/10/2026 (b11601685) el CLI va con versión FIJA: con `vercel` a secas npx buscó la 65.4.0 recién salida, que
  // no estaba en la caché, y `--no-install` la rechazó callado. El `--yes` de adelante es de NPX (instala esa versión); al
  // CLI de Vercel no le llega ninguno global: `inspect` sigue sin `--yes`.
  assert.match(SCRIPT, /const VERSION_VERCEL = '\d+\.\d+\.\d+';/, 'la versión del CLI de Vercel tiene que ir fija (exacta)');
  assert.match(SCRIPT, /\['--yes', `vercel@\$\{VERSION_VERCEL\}`, \.\.\.a, '--scope', SCOPE\]/, 'el `--yes` global rompe `inspect` (o el CLI dejó de ir con versión fija)');
  assert.match(SCRIPT, /vercel\('ls', '--environment', 'production', '--yes', '--meta', `githubCommitSha=\$\{sha\}`\)/);
});

test('si el que sirve es de un commit sin el arreglo, NO', () => {
  const dentro = SCRIPT.slice(SCRIPT.indexOf('if (fila && fila.url === sirve) {'));
  assert.match(dentro, /^if \(fila && fila\.url === sirve\) \{\s*if \(!contiene\(commit, sha\)\) \{\s*console\.error\([^\n]*\);\s*return null;/);
  assert.match(SCRIPT, /if \(!fila\.lista\) \{ console\.error\([^\n]*\); return null; \}/);
});

// 10/11/2026: con `--first-parent`, el commit desplegado quedó de segundo padre detrás de una mezcla «origin/main en
// punta/…» y la guarda dijo NO con el despliegue sano (el aviso de Leandro). Se busca entre los que contienen el arreglo.
test('los candidatos son los commits de main que contienen el arreglo, sin `--first-parent`', () => {
  assert.doesNotMatch(SCRIPT, /'--first-parent'/, '`--first-parent` de main saltea el commit desplegado detrás de una mezcla');
  assert.match(SCRIPT, /git\('rev-list', '--ancestry-path', '-n', '\d+', `\$\{commit\}\.\.origin\/main`\)/);
  assert.match(SCRIPT, /git\('rev-parse', `\$\{commit\}\^\{commit\}`\)/, 'el arreglo mismo también es candidato (rev-list A..B no lo trae)');
});

test('la tabla de Vercel se lee de stdout Y stderr', () => {
  assert.match(SCRIPT, /const salida = `\$\{r\.stdout \?\? ''\}\\n\$\{r\.stderr \?\? ''\}`;/);
});
