// =============================================================================
// Una mezcla que arma una versión NUEVA de un workflow corta a los ~20 s, no después de los tests (scripts/ci-workflow-nuevo.sh)
// =============================================================================
// Lo que fija, CORRIENDO el script sobre repos de git de verdad:
//   · la punta y main cambian el MISMO workflow → la mezcla de la corrida da 1, nombra el archivo y dice qué hacer;
//   · sólo uno de los dos lo cambia (o cambian workflows distintos) → 0: cada archivo queda igual al de un padre, y
//     GitHub lo deja subir (así entraron 9b155e3f0 y 65ac4c4fc el 4/11/2026);
//   · la punta ya estaba al día (su punta es una mezcla hecha a mano) o avanzó rápido → 0: la corrida no creó nada;
//   · punta.yml lo llama después de las DOS mezclas, con el HEAD de antes.
// Probado rompiéndolo (4/11/2026): comparar sólo contra el primer padre → caen «sólo main» y «distintos»; sacar la
// condición del primer padre → cae «ya al día con una mezcla a mano»; sacar la llamada de «Llevar a main» → cae el último.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scriptDelPaso, leerWorkflow } from './_workflow';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join(RAIZ, 'scripts', 'ci-workflow-nuevo.sh');
const hayGit = !spawnSync('git', ['--version']).error && !spawnSync('sh', ['-c', 'exit 0']).error;

const wf = (a: string, b: string) => ['name: x', 'on: push', `# ${a}`, ...Array.from({ length: 8 }, (_, i) => `# línea ${i}`), `# ${b}`, ''].join('\n');

/** base con dos workflows; la punta y main escriben lo suyo y commitean; queda parado en la punta. */
function repo(punta: Record<string, string>, main: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), 'ci-wf-nuevo-'));
  // Sin las variables de git de afuera: corrido desde el pre-push de un worktree, `GIT_DIR` apunta al repo de verdad y este `git init` y
  // sus commits le escribían a él (4/11/2026: movió main y la rama de la punta, y dejó core.bare=true). Ver sinElRepoDelHook en filtro-punta.
  const afuera = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')));
  const env = { ...afuera, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@x', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@x', GIT_CONFIG_NOSYSTEM: '1', HOME: dir };
  const g = (...a: string[]) => spawnSync('git', a, { cwd: dir, env, encoding: 'utf8' });
  const escribir = (m: Record<string, string>) => { for (const [f, c] of Object.entries(m)) { mkdirSync(join(dir, dirname(f)), { recursive: true }); writeFileSync(join(dir, f), c); } };
  g('init', '-q', '-b', 'main');
  escribir({ '.github/workflows/a.yml': wf('a', 'a'), '.github/workflows/b.yml': wf('b', 'b'), 'x.txt': 'x\n' });
  g('add', '.'); g('commit', '-qm', 'base');
  g('checkout', '-qb', 'punta'); escribir(punta); g('add', '.'); g('commit', '-qm', 'punta');
  g('checkout', '-q', 'main'); escribir(main); g('add', '.'); g('commit', '-qm', 'main');
  g('checkout', '-q', 'punta');
  const correr = (antes: string) => spawnSync('sh', [SCRIPT, antes], { cwd: dir, env, encoding: 'utf8' });
  /** Como la corrida: guarda el HEAD, mezcla main y corre el script. */
  const mezclarYMirar = () => {
    const antes = g('rev-parse', 'HEAD').stdout.trim();
    const m = g('merge', '--no-edit', '-m', 'mezcla de la corrida', 'main');
    assert.equal(m.status, 0, `la mezcla sale limpia: ${m.stdout}${m.stderr}`);
    return correr(antes);
  };
  return { dir, g, correr, mezclarYMirar };
}

test('la punta y main cambian el MISMO workflow: corta y dice qué hacer', { skip: !hayGit && 'sin git o sh' }, () => {
  const r = repo({ '.github/workflows/a.yml': wf('de la punta', 'a') }, { '.github/workflows/a.yml': wf('a', 'de main') });
  const s = r.mezclarYMirar();
  assert.equal(s.status, 1, s.stdout + s.stderr);
  assert.match(s.stdout, /::error::La punta y main cambiaron el mismo workflow \(\.github\/workflows\/a\.yml\)/);
  assert.match(s.stdout, /git merge origin\/main/, 'dice cómo se arregla');
});

test('sólo main cambia un workflow, o cambian workflows distintos: 0 (GitHub lo deja subir)', { skip: !hayGit && 'sin git o sh' }, () => {
  const soloMain = repo({ 'x.txt': 'de la punta\n' }, { '.github/workflows/a.yml': wf('a', 'de main') });
  assert.equal(soloMain.mezclarYMirar().status, 0, 'cada workflow queda igual al de main');
  const distintos = repo({ '.github/workflows/a.yml': wf('de la punta', 'a') }, { '.github/workflows/b.yml': wf('b', 'de main') });
  assert.equal(distintos.mezclarYMirar().status, 0, 'a.yml es el de la punta y b.yml el de main');
  const soloPunta = repo({ '.github/workflows/a.yml': wf('de la punta', 'a') }, { 'x.txt': 'de main\n' });
  assert.equal(soloPunta.mezclarYMirar().status, 0);
});

test('si la corrida no creó una mezcla (ya al día, aunque su punta sea una mezcla a mano, o avance rápido): 0', { skip: !hayGit && 'sin git o sh' }, () => {
  const r = repo({ '.github/workflows/a.yml': wf('de la punta', 'a') }, { '.github/workflows/a.yml': wf('a', 'de main') });
  // La persona mezcló a mano (con su token): su commit de mezcla ya está en el repo, con la versión nueva del workflow.
  assert.equal(r.g('merge', '--no-edit', '-m', 'a mano', 'main').status, 0);
  const antes = r.g('rev-parse', 'HEAD').stdout.trim();
  assert.match(r.g('merge', '--no-edit', 'main').stdout, /Already up to date/);
  assert.equal(r.correr(antes).status, 0, 'ya al día: no hay mezcla nueva de la corrida');
  // Avance rápido: la punta no tenía nada propio.
  const ff = repo({}, { '.github/workflows/a.yml': wf('a', 'de main') });
  const antesFf = ff.g('rev-parse', 'HEAD').stdout.trim();
  ff.g('merge', '--no-edit', 'main');
  assert.equal(ff.correr(antesFf).status, 0);
});

test('punta.yml corre el chequeo después de las DOS mezclas, con el HEAD de antes', () => {
  const yml = leerWorkflow(RAIZ, 'punta.yml');
  for (const paso of ['Mezclar main en la punta', 'Llevar a main (sin forzar)']) {
    const s = scriptDelPaso(yml, paso);
    const antes = s.indexOf('antes=$(git rev-parse HEAD)');
    const mezcla = s.indexOf('git merge --no-edit', antes);
    const chequeo = s.indexOf('sh scripts/ci-workflow-nuevo.sh "$antes"', mezcla);
    assert.ok(antes >= 0 && mezcla > antes && chequeo > mezcla, `«${paso}»: guarda el HEAD, mezcla y después chequea`);
  }
  assert.match(readFileSync(SCRIPT, 'utf8'), /refusing to allow a GitHub App/, 'el script cita el rechazo que evita');
});
