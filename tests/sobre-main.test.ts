// =============================================================================
// El chequeo sobre main (.github/workflows/sobre-main.yml) y el relanzamiento de las puntas que esperaban (scripts/ci-main-verde.sh).
// =============================================================================
// ci-main-verde.sh se CORRE contra un remoto de git de verdad (un repo desnudo) con un `gh` de mentira que anota lo que le piden.
// Probado rompiéndolo (4/11/2026): sin la comparación `[ "$actual" = "$sha" ]` relanza también la punta que ya cambió (cae el
// primer test); sin el `git push --delete "$ref"` las marcas sobreviven y se relanzarían en cada verde (cae el mismo test); con
// `exit 1` al final, cae «un fallo de gh no pone rojo el verde».
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { corre, correrPaso, leerWorkflow } from './_workflow';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join(RAIZ, 'scripts', 'ci-main-verde.sh');
const haySh = !spawnSync('sh', ['-c', 'exit 0']).error;

function entorno(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const limpio: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v != null && !k.startsWith('GIT_')) limpio[k] = v;
  return { ...limpio, NODE_ENV: 'test', GIT_AUTHOR_NAME: 'a', GIT_AUTHOR_EMAIL: 'a@mako.test', GIT_COMMITTER_NAME: 'a', GIT_COMMITTER_EMAIL: 'a@mako.test', ...extra } as unknown as NodeJS.ProcessEnv;
}

/** Un remoto desnudo y un clon. `refs`: nombre de rama → qué commit (uno de los dos que se arman). */
function armar(refs: Record<string, 'c1' | 'c2'>, ghSale = 0) {
  const dir = mkdtempSync(join(tmpdir(), 'main-verde-'));
  const env = entorno();
  const g = (cwd: string, ...a: string[]) => { const r = spawnSync('git', a, { cwd, env, encoding: 'utf8' }); if (r.status !== 0) throw new Error(`git ${a.join(' ')}: ${r.stderr}`); return r.stdout.trim(); };
  g(dir, 'init', '-q', '--bare', 'origen.git');
  g(dir, 'init', '-q', '-b', 'main', 'clon');
  const clon = join(dir, 'clon');
  g(clon, 'remote', 'add', 'origin', join(dir, 'origen.git'));
  writeFileSync(join(clon, 'a'), '1');
  g(clon, 'add', 'a');
  g(clon, 'commit', '-q', '-m', 'c1');
  const c1 = g(clon, 'rev-parse', 'HEAD');
  writeFileSync(join(clon, 'a'), '2');
  g(clon, 'commit', '-q', '-am', 'c2');
  const c2 = g(clon, 'rev-parse', 'HEAD');
  const sha = { c1, c2 };
  g(clon, 'push', '-q', 'origin', 'HEAD:refs/heads/main', ...Object.entries(refs).map(([r, c]) => `${sha[c]}:refs/heads/${r}`));
  // `gh` de mentira: anota cada llamada y sale con lo que pida el test.
  const bin = join(dir, 'bin');
  spawnSync('mkdir', [bin]);
  writeFileSync(join(bin, 'gh'), `#!/bin/sh\necho "$*" >> "${join(dir, 'gh.log')}"\nexit ${ghSale}\n`);
  chmodSync(join(bin, 'gh'), 0o755);
  const correr = () => spawnSync('sh', [SCRIPT, 'origin'], { cwd: clon, env: { ...env, PATH: `${bin}:${process.env.PATH}` }, encoding: 'utf8' });
  const remotas = () => g(clon, 'ls-remote', 'origin').split('\n').map((l) => l.split('\t')[1]).filter(Boolean).sort();
  const llamadas = () => (existsSync(join(dir, 'gh.log')) ? readFileSync(join(dir, 'gh.log'), 'utf8').trim().split('\n') : []);
  return { clon, sha, ghLog: join(dir, 'gh.log'), correr, remotas, llamadas, rm: () => rmSync(dir, { recursive: true, force: true }) };
}

test('main verde: borra ci-rojo/main, relanza SÓLO la punta que sigue en el commit rojo, y borra todas las marcas', { skip: !haySh && 'sin sh' }, () => {
  const r = armar({ 'ci-rojo/main': 'c2', 'punta/quieta': 'c1', 'espera-main/quieta': 'c1', 'punta/movida': 'c2', 'espera-main/movida': 'c1' });
  try {
    const x = r.correr();
    assert.equal(x.status, 0, x.stderr);
    assert.deepEqual(r.llamadas(), ['workflow run punta.yml --ref punta/quieta'], 'la que se movió ya tiene su corrida');
    assert.deepEqual(r.remotas(), ['refs/heads/main', 'refs/heads/punta/movida', 'refs/heads/punta/quieta'], 'sin marcas: no se relanza dos veces');
  } finally { r.rm(); }
});

test('sin marcas no hace nada, y un fallo de gh no pone rojo el verde', { skip: !haySh && 'sin sh' }, () => {
  const vacio = armar({ 'punta/x': 'c1' });
  try {
    assert.equal(vacio.correr().status, 0);
    assert.deepEqual(vacio.llamadas(), []);
  } finally { vacio.rm(); }
  const ghRoto = armar({ 'punta/x': 'c1', 'espera-main/x': 'c1' }, 1);
  try {
    const x = ghRoto.correr();
    assert.equal(x.status, 0, 'relanzar es un favor');
    assert.match(x.stdout, /No pude relanzar punta\/x/);
  } finally { ghRoto.rm(); }
});

test('sobre-main.yml: corre al lanzarlo, y su paso rojo deja ci-rojo/main en el commit chequeado (corrido contra un remoto)', { skip: !haySh && 'sin sh' }, () => {
  const yml = leerWorkflow(RAIZ, 'sobre-main.yml');
  assert.equal(corre(yml, 'mezcla-de-main', { event_name: 'workflow_dispatch', event: {} }), true);
  const r = armar({});
  try {
    const x = correrPaso(yml, 'Main está rojo', { cwd: r.clon });
    assert.equal(x.codigo, 0, x.salida);
    assert.match(x.salida, /::error::La mezcla de main/);
    assert.deepEqual(r.remotas(), ['refs/heads/ci-rojo/main', 'refs/heads/main']);
  } finally { r.rm(); }
  const vercel = JSON.parse(readFileSync(join(RAIZ, 'vercel.json'), 'utf8'));
  assert.equal(vercel.git.deploymentEnabled['espera-main/**'], false, 'una marca no construye en Vercel');
});

// ── Los dos pasos de punta.yml que hablan con main ─────────────────────────────────────────────────────────────────────────
// Probado rompiéndolo: con `[ "$SIN_PROBAR" = "1" ]` invertido no se lanza sobre-main después de una mezcla sin probar; sin el
// `if git ls-remote … ci-rojo/main` del paso rojo no queda la marca espera-main/<punta>. Los dos casos caen.
const PUNTA = leerWorkflow(RAIZ, 'punta.yml');

function conScriptDeMainVerde(clon: string) {
  spawnSync('mkdir', ['-p', join(clon, 'scripts')]);
  writeFileSync(join(clon, 'scripts', 'ci-main-verde.sh'), readFileSync(SCRIPT, 'utf8'));
}

test('punta.yml: una mezcla SIN PROBAR lanza sobre-main; una probada con main rojo lo devuelve a verde y relanza; si no, nada', { skip: !haySh && 'sin sh' }, () => {
  const sinProbar = armar({});
  try {
    const x = correrPaso(PUNTA, 'Main después de esta punta', { cwd: sinProbar.clon, env: { SIN_PROBAR: '1', PATH: `${dirname(sinProbar.ghLog)}/bin:${process.env.PATH}` } });
    assert.equal(x.codigo, 0, x.salida);
    assert.deepEqual(sinProbar.llamadas(), ['workflow run sobre-main.yml --ref main']);
  } finally { sinProbar.rm(); }

  const probadaConMainRojo = armar({ 'ci-rojo/main': 'c1', 'punta/esperaba': 'c1', 'espera-main/esperaba': 'c1' });
  try {
    conScriptDeMainVerde(probadaConMainRojo.clon);
    const x = correrPaso(PUNTA, 'Main después de esta punta', { cwd: probadaConMainRojo.clon, env: { SIN_PROBAR: '0', PATH: `${dirname(probadaConMainRojo.ghLog)}/bin:${process.env.PATH}` } });
    assert.equal(x.codigo, 0, x.salida);
    assert.deepEqual(probadaConMainRojo.llamadas(), ['workflow run punta.yml --ref punta/esperaba']);
    assert.deepEqual(probadaConMainRojo.remotas(), ['refs/heads/main', 'refs/heads/punta/esperaba']);
  } finally { probadaConMainRojo.rm(); }

  const tranquila = armar({ 'punta/x': 'c1' });
  try {
    conScriptDeMainVerde(tranquila.clon);
    assert.equal(correrPaso(PUNTA, 'Main después de esta punta', { cwd: tranquila.clon, env: { SIN_PROBAR: '0', PATH: `${dirname(tranquila.ghLog)}/bin:${process.env.PATH}` } }).codigo, 0);
    assert.deepEqual(tranquila.llamadas(), []);
  } finally { tranquila.rm(); }
});

test('punta.yml: un rojo con main rojo deja además espera-main/<punta>; con main verde, sólo ci-rojo/<punta>', { skip: !haySh && 'sin sh' }, () => {
  for (const [mainRojo, esperado] of [[true, ['refs/heads/ci-rojo/main', 'refs/heads/ci-rojo/prueba', 'refs/heads/espera-main/prueba', 'refs/heads/main']], [false, ['refs/heads/ci-rojo/prueba', 'refs/heads/main']]] as const) {
    const r = armar(mainRojo ? { 'ci-rojo/main': 'c1' } : {});
    try {
      const x = correrPaso(PUNTA, 'Dejar la marca del rojo en ci-rojo/<punta>', { cwd: r.clon, env: { GITHUB_REF_NAME: 'punta/prueba', GITHUB_SHA: r.sha.c2, GITHUB_SERVER_URL: 'https://github.com', GITHUB_REPOSITORY: 'koncke/mako', GITHUB_RUN_ID: '1' } });
      assert.equal(x.codigo, 0, x.salida);
      assert.deepEqual(r.remotas(), esperado);
    } finally { r.rm(); }
  }
});

// ── tests-afectados --barredoras, corrido en un repo de verdad ───────────────────────────────────────────────────────────
// Probado rompiéndolo: con `lista = todas` cambiado por `lista = []` sale «0 tests» y cae; sin el `!o.barredoras` del «Nada cambió», también.
test('--barredoras corre TODAS las que barren aunque no haya cambiado nada, y ninguna otra', () => {
  const dir = mkdtempSync(join(tmpdir(), 'barredoras-'));
  try {
    const env = entorno();
    const g = (...a: string[]) => spawnSync('git', a, { cwd: dir, env, encoding: 'utf8' });
    spawnSync('mkdir', ['-p', join(dir, 'tests')]);
    spawnSync('ln', ['-s', join(RAIZ, 'node_modules'), join(dir, 'node_modules')]);
    writeFileSync(join(dir, '.gitignore'), 'node_modules\n');
    writeFileSync(join(dir, 'tests', 'barre.test.ts'), "import test from 'node:test';\nimport { readdirSync } from 'node:fs';\ntest('barre', () => { readdirSync('.'); });\n");
    writeFileSync(join(dir, 'tests', 'normal.test.ts'), "import test from 'node:test';\ntest('normal', () => { throw new Error('no barre: no corre'); });\n");
    g('init', '-q', '-b', 'main'); g('add', '.'); g('commit', '-q', '-m', 'x');
    const r = spawnSync(process.execPath, [join(RAIZ, 'scripts', 'tests-afectados.mjs'), '--barredoras', '--base', 'HEAD', '--sin-compartir'], { cwd: dir, env: { ...env, CI: '1' }, encoding: 'utf8', timeout: 120_000, maxBuffer: 64 * 1024 * 1024 });
    assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
    assert.match(r.stdout, /--barredoras: las 1 que barren/);
    assert.match(r.stdout, /VERDE · 1 tests de 1 archivos/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
