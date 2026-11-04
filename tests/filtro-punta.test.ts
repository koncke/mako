// =============================================================================
// El filtro chico del pre-push (scripts/filtro-punta.mjs), CORRIENDO en un repo de git de verdad con tests de verdad.
// =============================================================================
// Lo que cuida, y cada assert se probó rompiéndolo (4/11/2026, node 24.22):
//   · un test que importa lo tocado y falla FRENA (exit 1) y se nombra. Con `testsSuyos` devolviendo [] queda verde: rojo.
//   · una barredora (readdirSync) que fallaría NO corre: es de la punta en GitHub. Sin el filtro de motivos en `testsSuyos`, corre y
//     frena: rojo.
//   · lo que no entra en el tope NO frena: «A MEDIAS», exit 0. Con `if (x.vencio)` sacado, la tanda cortada cuenta como roja: rojo.
//   · nunca sale 99.
//   · elige sobre lo COMMITEADO: un test nuevo sin commitear no viaja en el push y no corre. Sumando los archivos sin commitear a
//     la lista (como hacía la primera versión, que leía el disco), corre y frena: rojo.
// No cubre los TIPOS de punta a punta (el repo temporal no tiene el tsconfig de MaKo): el tsc acotado es el de antes-de-subir, y el
// recorte a «sólo errores de lo tocado» se midió a mano el 4/11 sobre las dos puntas rojas de ese día (TS2339 y TS2769: los dos frenan).
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { clausuraDeImports, correrTestsConTope, testsSuyos } from '../scripts/filtro-punta.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILTRO = join(RAIZ, 'scripts', 'filtro-punta.mjs');

function entorno(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const limpio: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v != null && !k.startsWith('GIT_') && k !== 'NODE_TEST_CONTEXT') limpio[k] = v;
  return { ...limpio, NODE_ENV: 'test', GIT_AUTHOR_NAME: 'a', GIT_AUTHOR_EMAIL: 'a@mako.test', GIT_COMMITTER_NAME: 'a', GIT_COMMITTER_EMAIL: 'a@mako.test', ...extra } as unknown as NodeJS.ProcessEnv;
}

/** Un repo con main (lib/a.mjs + un test que lo importa + una barredora que está ROTA a propósito) y origin/main apuntando ahí. */
function armarRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'filtro-punta-'));
  const g = (...a: string[]) => { const r = spawnSync('git', a, { cwd: dir, env: entorno(), encoding: 'utf8' }); if (r.status !== 0) throw new Error(`git ${a.join(' ')}: ${r.stderr}`); return r.stdout; };
  mkdirSync(join(dir, 'lib'));
  mkdirSync(join(dir, 'tests'));
  symlinkSync(join(RAIZ, 'node_modules'), join(dir, 'node_modules'), 'junction');
  writeFileSync(join(dir, '.gitignore'), 'node_modules\n');
  writeFileSync(join(dir, 'lib', 'a.mjs'), 'export const doble = (n) => n * 2;\n');
  writeFileSync(join(dir, 'lib', 'lento.mjs'), 'export const x = 1;\n');
  writeFileSync(join(dir, 'tests', 'a.test.ts'), "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { doble } from '../lib/a.mjs';\ntest('doble', () => assert.equal(doble(2), 4));\n");
  writeFileSync(join(dir, 'tests', 'lento.test.ts'), "import test from 'node:test';\nimport { x } from '../lib/lento.mjs';\ntest('lento', async () => { await new Promise((r) => setTimeout(r, 8000)); void x; });\n");
  writeFileSync(join(dir, 'tests', 'barre.test.ts'), "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { readdirSync } from 'node:fs';\ntest('barre', () => { readdirSync('.'); assert.fail('rota a propósito: el filtro no la corre'); });\n");
  g('init', '-q', '-b', 'main');
  g('add', '.');
  g('commit', '-q', '-m', 'base');
  g('update-ref', 'refs/remotes/origin/main', 'HEAD');
  const commitear = () => { g('commit', '-q', '-am', 'cambio'); };
  return { dir, commitear, rm: () => rmSync(dir, { recursive: true, force: true }) };
}

const filtrar = (cwd: string, tope = 60) => {
  const r = spawnSync(process.execPath, [FILTRO, '--tope', String(tope)], { cwd, env: entorno({ CI: '1' }), encoding: 'utf8', timeout: 120_000 });
  return { codigo: r.status, salida: `${r.stdout}${r.stderr}`, ultima: (r.stdout.trim().split('\n').pop() ?? '') };
};

test('tocar lib/a.mjs y romper su test FRENA el push y lo nombra; la barredora rota no corre', () => {
  const { dir, commitear, rm } = armarRepo();
  try {
    writeFileSync(join(dir, 'lib', 'a.mjs'), 'export const doble = (n) => n * 3;\n');
    commitear();
    // Un test nuevo SIN commitear que fallaría: no viaja en el push, así que no frena (ni corre).
    writeFileSync(join(dir, 'tests', 'suelto.test.ts'), "import test from 'node:test';\nimport '../lib/a.mjs';\ntest('suelto', () => { throw new Error('no viaja'); });\n");
    const r = filtrar(dir);
    assert.equal(r.codigo, 1, r.salida);
    assert.match(r.ultima, /FILTRO ROJO/);
    assert.match(r.ultima, /tests\/a\.test\.ts/);
    assert.doesNotMatch(r.salida, /barre\.test/, 'la barredora es de la punta en GitHub');
    assert.doesNotMatch(r.salida, /suelto\.test/, 'lo que no se commiteó no viaja: no corre');
  } finally { rm(); }
});

test('tocar lib/a.mjs sin romper nada: verde, corriendo SÓLO su test', () => {
  const { dir, commitear, rm } = armarRepo();
  try {
    writeFileSync(join(dir, 'lib', 'a.mjs'), 'export const doble = (n) => n + n;\n');
    commitear();
    const r = filtrar(dir);
    assert.equal(r.codigo, 0, r.salida);
    assert.match(r.ultima, /FILTRO VERDE.*1 de 1 tests/);
  } finally { rm(); }
});

test('lo que no entra en el tope no frena: «A MEDIAS» y exit 0, nunca 99', () => {
  const { dir, commitear, rm } = armarRepo();
  try {
    writeFileSync(join(dir, 'lib', 'lento.mjs'), 'export const x = 2;\n');
    commitear();
    const r = filtrar(dir, 3);
    assert.equal(r.codigo, 0, r.salida);
    assert.match(r.ultima, /FILTRO A MEDIAS.*no entraron en el tope/);
  } finally { rm(); }
});

test('testsSuyos: lo que toca el cambio, después lo que nombra, después lo que importa; una barredora sola, afuera', () => {
  const t = new Map([
    ['tests/importa.test.ts', [{ tipo: 'importa', detalle: 'x' }]],
    ['tests/barre.test.ts', [{ tipo: 'barre', detalle: 'git ls-files' }]],
    ['tests/nombra.test.ts', [{ tipo: 'nombra', detalle: 'x' }, { tipo: 'barre', detalle: 'recorre carpetas' }]],
    ['tests/cambio.test.ts', [{ tipo: 'cambio', detalle: 'x' }]],
  ]);
  assert.deepEqual(testsSuyos(t), ['tests/cambio.test.ts', 'tests/nombra.test.ts', 'tests/importa.test.ts']);
});

test('correrTestsConTope: la tanda que el reloj corta no cuenta como roja, y lo que no arrancó se cuenta', async () => {
  let llamadas = 0;
  const correr = async () => (++llamadas === 1
    ? { codigo: 0, salida: 'ℹ tests 3\nℹ pass 3\nℹ fail 0', vencio: false }
    : { codigo: null, salida: '', vencio: true });
  const tests = Array.from({ length: 14 }, (_, i) => `tests/t${i}.test.ts`);
  const r = await correrTestsConTope(tests, { hasta: Date.now() + 1000, correr });
  assert.deepEqual([r.corridos, r.casos, r.rojos.length, r.sinCorrer], [6, 3, 0, 8]);
});

// ── El hook: corre el filtro sólo en un push a punta/*, frena sólo con su exit 1, y MAKO_SIN_FILTRO=1 lo saltea ─────────────
// Probado rompiéndolo: con `[ $? -eq 1 ]` cambiado por `[ $? -eq 99 ]` el hook deja pasar el rojo, y cae el primer assert.
const HOOK = join(RAIZ, 'scripts', 'claude-hooks', 'pre-push');
const haySh = !spawnSync('sh', ['-c', 'exit 0']).error;

function correrHook(refRemota: string, filtroSale: number, extra: Record<string, string> = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'filtro-hook-'));
  try {
    const g = (...a: string[]) => spawnSync('git', a, { cwd: dir, env: entorno(), encoding: 'utf8' }).stdout.trim();
    mkdirSync(join(dir, 'scripts'));
    writeFileSync(join(dir, 'scripts', 'guardas-push.sh'), 'exit 0\n');
    // Un filtro de mentira: deja una marca de que corrió y sale con lo que pide el test.
    writeFileSync(join(dir, 'scripts', 'filtro-punta.mjs'), `require('node:fs').writeFileSync('corrio', '1'); console.log('[filtro-punta] línea'); process.exit(${filtroSale});\n`.replace("require('node:fs')", "(await import('node:fs'))"));
    g('init', '-q', '-b', 'main');
    g('add', '.');
    g('commit', '-q', '-m', 'x');
    const sha = g('rev-parse', 'HEAD');
    const r = spawnSync('sh', [HOOK, 'origin'], { cwd: dir, env: entorno(extra), input: `refs/heads/x ${sha} ${refRemota} 0000000000000000000000000000000000000000\n`, encoding: 'utf8' });
    const corrio = spawnSync('test', ['-f', join(dir, 'corrio')]).status === 0;
    return { codigo: r.status, salida: `${r.stdout}${r.stderr}`, corrio };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('el hook: un rojo del filtro frena el push a punta/*; un verde o un «a medias» lo deja pasar', { skip: !haySh && 'sin sh' }, () => {
  const rojo = correrHook('refs/heads/punta/algo', 1);
  assert.equal(rojo.codigo, 1, rojo.salida);
  assert.equal(rojo.corrio, true);
  assert.match(rojo.salida, /PUSH BLOQUEADO: el filtro de la punta dio ROJO/);
  const verde = correrHook('refs/heads/punta/algo', 0);
  assert.equal(verde.codigo, 0, verde.salida);
  assert.equal(verde.corrio, true);
});

test('el hook: MAKO_SIN_FILTRO=1 no lo corre, y un push que no es a punta/* tampoco', { skip: !haySh && 'sin sh' }, () => {
  const saltado = correrHook('refs/heads/punta/algo', 1, { MAKO_SIN_FILTRO: '1' });
  assert.equal(saltado.codigo, 0, saltado.salida);
  assert.equal(saltado.corrio, false);
  const otra = correrHook('refs/heads/otra-rama', 1);
  assert.equal(otra.codigo, 0, otra.salida);
  assert.equal(otra.corrio, false);
});

test('clausuraDeImports: cuenta lo que el tsc arrastra hacia adelante, sin repetir ni colgarse en un ciclo', () => {
  // a → b → c → a (ciclo) y a → d. El grafo de tests-afectados guarda «quién importa a quién» (destino → importadores).
  const importadoPor = new Map([['b', new Set(['a'])], ['c', new Set(['b'])], ['a', new Set(['c'])], ['d', new Set(['a'])], ['z', new Set(['y'])]]);
  assert.equal(clausuraDeImports(['a'], importadoPor), 4);
  assert.equal(clausuraDeImports(['d'], importadoPor), 1, 'd no importa nada');
  assert.equal(clausuraDeImports([], importadoPor), 0);
});
