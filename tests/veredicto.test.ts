// =============================================================================
// El veredicto: lo que ya pasó sobre el MISMO árbol no se repite en GitHub, y uno falso o de otro árbol no pasa (scripts/veredicto.mjs)
// =============================================================================
// Lo que fija, CORRIENDO el script sobre repos de git de verdad (la selección es la de tests-afectados, no una lista a mano):
//   · un veredicto de la nube que vale, con main quieto: GitHub corre sólo la MUESTRA, y los tipos los da por cubiertos;
//   · con main movido: corre las barredoras y lo que mira a la vez algo de la punta y algo de main; NO lo que mira sólo lo de main;
//   · NO pasa: el de otro árbol, el editado a mano, el de una selección que no es la de la punta, el de Node 22, el sin firma
//     cuando GitHub tiene la clave, y el de una base que no es de main;
//   · el de Actions (la corrida anterior de la misma rama): con un rojo arreglado repite el rojo, lo que tocó el arreglo y las
//     barredoras, y no los tipos de una punta que cambió;
//   · `guardar` deja en verde lo seleccionado menos lo que no dio verde;
//   · tests-afectados `--solo` corre EXACTAMENTE la lista.
// Probado rompiéndolo (4/11/2026): sacar la comparación del árbol → cae «otro árbol»; sacar la de la selección → cae «otra
// selección»; dejar `afectados` siempre en null → cae «main movido»; dar los tipos por cubiertos sin mirar la punta → cae «el de
// Actions con la punta cambiada». Renombrar una variable local no cambia nada.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { escribirRenglon, leerRenglon, sumaDe, aRepetir, muestraDe, revisarRenglon } from '../scripts/veredicto.mjs';
import { scriptDelPaso, leerWorkflow } from './_workflow';
import { condicionDe, evaluar } from './_expresion-actions';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join(RAIZ, 'scripts', 'veredicto.mjs');
const hayGit = !spawnSync('git', ['--version']).error;
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const H40 = 'a'.repeat(40);

// ── Lo puro ─────────────────────────────────────────────────────────────────────────────────────

const base = { arbol: H40, base: 'b'.repeat(40), sel: sha256('tests/x.test.ts'), archivos: 1, tests: 3, tipos: 'ok', node: '24.1.0', quien: 'cli_x' };

test('el renglón se lee como se escribió, y un campo editado rompe la suma', () => {
  const r = leerRenglon(escribirRenglon(base));
  assert.equal(r?.arbol, H40);
  assert.equal(r?.suma, sumaDe({ ...base, v: 1 }));
  assert.equal(leerRenglon('v=1 arbol=x arbol=y'), null, 'un campo repetido no es un veredicto');
  assert.equal(leerRenglon('v=1 cualquiera=x'), null, 'un campo que no existe tampoco');
  const editado = escribirRenglon(base).replace('archivos=1', 'archivos=2');
  const ok = revisarRenglon({ renglon: editado, arbolPunta: H40, esAncestro: () => true, existe: () => true, seleccion: () => ['tests/x.test.ts'], main: 'm' });
  assert.equal(ok.ok, false);
  assert.match((ok as { motivo: string }).motivo, /suma/);
});

test('revisarRenglon: cada cosa que no cuadra lo frena, y dice cuál', () => {
  const vale = { arbolPunta: H40, esAncestro: () => true, existe: () => true, seleccion: () => ['tests/x.test.ts'], main: 'm' };
  const r = (c: object, o: object = {}) => revisarRenglon({ renglon: escribirRenglon({ ...base, ...c }), ...vale, ...o });
  assert.equal(r({}).ok, true);
  const motivo = (x: ReturnType<typeof r>) => (x.ok ? '' : x.motivo);
  assert.match(motivo(r({}, { arbolPunta: 'c'.repeat(40) })), /otro|otra cosa/);
  assert.match(motivo(r({ node: '22.9.0' })), /Node 22/);
  assert.match(motivo(r({ tipos: 'parcial' })), /tipos/);
  assert.match(motivo(r({}, { seleccion: () => ['tests/x.test.ts', 'tests/y.test.ts'] })), /selección/);
  assert.match(motivo(r({}, { esAncestro: (a: string, b: string) => b !== 'm' })), /main/);
  assert.match(motivo(r({}, { esAncestro: (a: string, b: string) => b !== 'PUNTA' })), /historia de la punta/);
  assert.match(motivo(r({ tests: 0 })), /0 tests/);
  // Con la clave cargada en GitHub: sin firma no pasa, con otra clave tampoco, con la buena sí.
  assert.match(motivo(r({}, { clave: 's3creta' })), /no viene firmado/);
  const firmado = (clave: string) => revisarRenglon({ renglon: escribirRenglon(base, clave), ...vale, clave: 's3creta' });
  assert.equal(firmado('otra').ok, false);
  assert.equal(firmado('s3creta').ok, true);
});

test('aRepetir: lo afectado y lo que no estaba en verde, más la muestra que esté en la selección', () => {
  const sel = ['tests/a.test.ts', 'tests/b.test.ts', 'tests/c.test.ts'];
  assert.deepEqual(aRepetir({ sel, verdes: new Set(sel), afectados: null }), [], 'nada cambió: nada se repite');
  assert.deepEqual(aRepetir({ sel, verdes: new Set(sel), afectados: new Set(['tests/b.test.ts', 'tests/z.test.ts']) }), ['tests/b.test.ts']);
  assert.deepEqual(aRepetir({ sel, verdes: new Set(['tests/a.test.ts']), afectados: null }), ['tests/b.test.ts', 'tests/c.test.ts'], 'lo que no estaba en verde corre');
  assert.deepEqual(aRepetir({ sel, verdes: new Set(sel), afectados: null, muestra: ['tests/c.test.ts', 'tests/fuera.test.ts'] }), ['tests/c.test.ts']);
  const m1 = muestraDe(sel, 'arbol-1', 2);
  assert.deepEqual(muestraDe(sel, 'arbol-1', 2), m1, 'la muestra es fija para un árbol');
  assert.equal(m1.length, 2);
});

// ── Con git de verdad ───────────────────────────────────────────────────────────────────────────

const BARRE = ['ls', 'files'].join('-');   // armado: si este archivo lo dijera entero, tests-afectados lo tomaría por una barredora

/** Lo que se le pasa de más a un hijo (una clave, una salida de GitHub). */
type Entorno = Record<string, string>;

function entorno(dir: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { NODE_ENV: 'test' };
  for (const [k, v] of Object.entries(process.env)) if (!k.startsWith('GIT_') && !k.startsWith('MAKO_') && !k.startsWith('GITHUB_') && k !== 'CI') env[k] = v;
  return { ...env, NODE_ENV: 'test', HOME: dir, GIT_CONFIG_NOSYSTEM: '1', GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@x', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@x' };
}

/** main con 10 tests que importan lib/a, uno que importa lib/c, uno de lib/compartida (que importan a y c) y una barredora. */
function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'veredicto-'));
  const fuera = mkdtempSync(join(tmpdir(), 'veredicto-fuera-'));   // lo que escribe la prueba: fuera del árbol, que se mira
  const env = entorno(dir);
  const g = (...a: string[]) => { const r = spawnSync('git', a, { cwd: dir, env, encoding: 'utf8' }); assert.equal(r.status, 0, `git ${a.join(' ')}: ${r.stderr}`); return r.stdout.trim(); };
  const escribir = (m: Record<string, string>) => { for (const [f, c] of Object.entries(m)) { mkdirSync(join(dir, dirname(f)), { recursive: true }); writeFileSync(join(dir, f), c); } };
  const t = (dep: string) => `import { test } from 'node:test';\nimport { x } from '../lib/${dep}.ts';\ntest('${dep}', () => { if (x !== 1) throw new Error('x'); });\n`;
  const archivos: Record<string, string> = {
    '.gitignore': 'node_modules\n',
    'lib/compartida.ts': 'export const y = 1;\n',
    'lib/a.ts': "import { y } from './compartida.ts';\nexport const x = y;\n",
    'lib/c.ts': "import { y } from './compartida.ts';\nexport const x = y;\n",
    'tests/c.test.ts': t('c'),
    'tests/barre.test.ts': `import { test } from 'node:test';\nimport { execFileSync } from 'node:child_process';\ntest('barre', () => { execFileSync('git', ['${BARRE}']); });\n`,
  };
  for (let i = 0; i < 10; i++) archivos[`tests/a${i}.test.ts`] = t('a');
  g('init', '-q', '-b', 'main');
  escribir(archivos);
  g('add', '.'); g('commit', '-qm', 'base');
  g('update-ref', 'refs/remotes/origin/main', 'HEAD');
  g('checkout', '-qb', 'punta');
  /** Commitea en la punta. */
  const enPunta = (m: Record<string, string>, msg = 'punta') => { escribir(m); g('add', '.'); g('commit', '-qm', msg); return g('rev-parse', 'HEAD'); };
  /** Mueve origin/main como si otro chat hubiera llevado algo. */
  const moverMain = (m: Record<string, string>) => {
    g('checkout', '-q', 'origin/main'); escribir(m); g('add', '.'); g('commit', '-qm', 'otro chat');
    g('update-ref', 'refs/remotes/origin/main', 'HEAD'); g('checkout', '-q', 'punta');
  };
  return { dir, fuera, env, g, escribir, enPunta, moverMain };
}

type R = ReturnType<typeof repo>;

/** Lo que haría `sacar` sobre la punta, sin correr los tests (eso lo prueba el veredicto real en la nube): el renglón en el commit. */
function conVeredicto(r: R, o: { node?: string; clave?: string; sel?: string[]; base?: string } = {}) {
  const baseSha = o.base ?? r.g('merge-base', 'HEAD', 'origin/main');
  const url = new URL('../scripts/veredicto.mjs', import.meta.url).href;
  const lista: string[] = o.sel ?? JSON.parse(spawnSync(process.execPath, ['--input-type=module', '-e',
    `const m = await import(${JSON.stringify(url)}); const { execFileSync } = await import('node:child_process');
     const d = execFileSync('git', ['diff', '--name-only', '-z', '--no-renames', ${JSON.stringify(baseSha)}, 'HEAD'], { encoding: 'utf8' }).split('\\0').filter(Boolean);
     process.stdout.write(JSON.stringify(m.seleccionSobre('HEAD', d).tests));`], { cwd: r.dir, env: r.env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).stdout);
  const c = { arbol: r.g('rev-parse', 'HEAD^{tree}'), base: baseSha, sel: sha256(lista.join('\n')), archivos: lista.length, tests: lista.length * 2, tipos: 'ok', node: o.node ?? '24.1.0', quien: 'cli_prueba' };
  const msg = `${r.g('log', '-1', '--format=%B')}\n\nVeredicto: ${escribirRenglon(c, o.clave ?? '')}\n`;
  r.g('commit', '-q', '--amend', '-m', msg);
  return { punta: r.g('rev-parse', 'HEAD'), lista };
}

/** Como punta.yml: mezcla origin/main sobre la punta y corre `revisar`. */
type Revision = { usar?: string; cuantos?: string; tipos_saltear?: string; sin_probar?: string; origen?: string; repetir: string[] | null; salida: string; outputs: Record<string, string> };

function revisar(r: R, punta: string, o: { previo?: object; env?: Entorno } = {}): Revision {
  r.g('checkout', '-q', '--detach', punta);
  r.g('merge', '-q', '--no-edit', '-m', 'mezcla de la corrida', 'origin/main');
  const out = join(r.fuera, 'salida');
  const gh = join(r.fuera, 'gh-output');
  writeFileSync(gh, '');
  const args = ['revisar', '--punta', punta, '--main', 'origin/main', '--salida', out];
  if (o.previo) { writeFileSync(join(r.fuera, 'previo.json'), JSON.stringify(o.previo)); args.push('--previo', join(r.fuera, 'previo.json')); }
  const s = spawnSync(process.execPath, [SCRIPT, ...args], { cwd: r.dir, env: { ...r.env, GITHUB_OUTPUT: gh, ...o.env }, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  assert.equal(s.status, 0, s.stdout + s.stderr);
  const outputs: Record<string, string> = Object.fromEntries(readFileSync(gh, 'utf8').split('\n').filter(Boolean).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
  const repetir = outputs.usar === 'true' ? readFileSync(outputs.repetir, 'utf8').split('\n').filter(Boolean) : null;
  r.g('checkout', '-q', 'punta');
  const res: Revision = { usar: outputs.usar, cuantos: outputs.cuantos, tipos_saltear: outputs.tipos_saltear, sin_probar: outputs.sin_probar, origen: outputs.origen, repetir, salida: s.stdout, outputs };
  return res;
}

const A = Array.from({ length: 10 }, (_, i) => `tests/a${i}.test.ts`);

test('el de la nube, con main quieto: sólo la muestra, y los tipos cubiertos (la punta llega «sin probar»)', { skip: !hayGit && 'sin git' }, () => {
  const r = repo();
  r.enPunta({ 'lib/a.ts': "import { y } from './compartida.ts';\nexport const x = y; // otra\n" });
  const v = conVeredicto(r);
  assert.ok(v.lista.includes('tests/barre.test.ts') && A.every((t) => v.lista.includes(t)), 'la selección es la de tests-afectados');
  const s = revisar(r, v.punta);
  assert.equal(s.usar, 'true', s.salida);
  assert.equal(s.repetir?.length, 4, `sólo la muestra: ${s.repetir}`);
  assert.equal(s.tipos_saltear, 'true');
  assert.equal(s.sin_probar, '1', 'lo que dijo la nube lo vuelve a mirar sobre-main en Actions');
  assert.equal(s.origen, 'nube');
});

test('el de la nube, con main movido: barredoras y lo que cruza; no lo que mira sólo lo de main', { skip: !hayGit && 'sin git' }, () => {
  const r = repo();
  r.enPunta({ 'lib/a.ts': "import { y } from './compartida.ts';\nexport const x = y; // otra\n" });
  const v = conVeredicto(r);
  r.moverMain({ 'lib/c.ts': "import { y } from './compartida.ts';\nexport const x = y; // de main\n" });
  const s = revisar(r, v.punta);
  assert.equal(s.usar, 'true', s.salida);
  assert.ok(s.repetir?.includes('tests/barre.test.ts'), 'la barredora corre: el repo cambió');
  assert.ok(!s.repetir?.includes('tests/c.test.ts'), 'c.test mira sólo lo de main: no es de esta punta');
  assert.equal(s.repetir?.filter((t) => A.includes(t)).length, 4, `de los de a, sólo la muestra: lo de main no los toca (${s.repetir})`);

  // main mueve algo que los de la punta también miran: corren todos.
  const r2 = repo();
  r2.enPunta({ 'lib/a.ts': "import { y } from './compartida.ts';\nexport const x = y; // otra\n" });
  const v2 = conVeredicto(r2);
  r2.moverMain({ 'lib/compartida.ts': 'export const y = 1; // de main\n' });
  const s2 = revisar(r2, v2.punta);
  assert.ok(A.every((t) => s2.repetir?.includes(t)), `lo que mira a la vez la punta y main corre entero: ${s2.repetir}`);
});

test('no pasa: otro árbol, editado, otra selección, Node 22, base que no es de main, y sin firma con la clave en GitHub', { skip: !hayGit && 'sin git' }, () => {
  const cambio = { 'lib/a.ts': "import { y } from './compartida.ts';\nexport const x = y; // otra\n" };
  const caso = (preparar: (r: R) => string, env?: Entorno) => { const r = repo(); r.enPunta(cambio); return revisar(r, preparar(r), { env }); };
  const no = (s: ReturnType<typeof revisar>, re: RegExp) => { assert.equal(s.usar, 'false', s.salida); assert.match(s.salida, re); };

  no(caso((r) => { conVeredicto(r); return r.enPunta({ 'lib/a.ts': 'export const x = 1;\n' }, 'otro commit encima'); }), /no trae un veredicto/);
  no(caso((r) => { conVeredicto(r); r.escribir({ 'lib/a.ts': 'export const x = 1; // amend\n' }); r.g('add', '.'); r.g('commit', '-q', '--amend', '--no-edit'); return r.g('rev-parse', 'HEAD'); }), /otra cosa/);
  no(caso((r) => { conVeredicto(r); const m = r.g('log', '-1', '--format=%B').replace(/archivos=(\d+)/, (_, n) => `archivos=${Number(n) + 1}`); r.g('commit', '-q', '--amend', '-m', m); return r.g('rev-parse', 'HEAD'); }), /suma/);
  no(caso((r) => conVeredicto(r, { sel: ['tests/a0.test.ts'] }).punta), /selección/);
  no(caso((r) => conVeredicto(r, { node: '22.9.0' }).punta), /Node 22/);
  // Una base que está en la punta pero no en main: el veredicto se calculó contra algo que GitHub no mezcla.
  no(caso((r) => { const x = r.g('rev-parse', 'HEAD'); r.enPunta({ 'docs/x.md': 'x\n' }, 'segundo'); return conVeredicto(r, { base: x }).punta; }), /no es un commit de main/);
  no(caso((r) => conVeredicto(r).punta, { MAKO_VEREDICTO_CLAVE: 's3creta' }), /no viene firmado/);
  const firmado = caso((r) => conVeredicto(r, { clave: 's3creta' }).punta, { MAKO_VEREDICTO_CLAVE: 's3creta' });
  assert.equal(firmado.usar, 'true', firmado.salida);
});

test('el de Actions: un rojo arreglado repite el rojo, lo que tocó el arreglo y las barredoras; los tipos, sólo con la misma punta', { skip: !hayGit && 'sin git' }, () => {
  const r = repo();
  const p1 = r.enPunta({ 'lib/a.ts': "import { y } from './compartida.ts';\nexport const x = y; // otra\n" });
  const main = r.g('rev-parse', 'origin/main');
  // La corrida anterior: todo en verde menos a3. Misma punta, main quieto: corre a3 sola, y los tipos ya estaban.
  const sel = conVeredicto(r).lista;
  r.g('reset', '-q', '--hard', p1);
  const previo = { v: 1, punta: p1, main, verdes: sel.filter((t) => t !== 'tests/a3.test.ts'), tipos: 'ok', node: '24.1.0', corrida: 7 };
  const s = revisar(r, p1, { previo });
  assert.equal(s.usar, 'true', s.salida);
  assert.deepEqual(s.repetir, ['tests/a3.test.ts']);
  assert.equal(s.tipos_saltear, 'true');
  assert.equal(s.sin_probar, '0', 'ese árbol ya pasó los tipos EN Actions: nada que mirar después');
  // El arreglo toca a3: corre a3 (y la barredora); los tipos corren, porque la punta cambió.
  const p2 = r.enPunta({ 'tests/a3.test.ts': readFileSync(join(r.dir, 'tests/a3.test.ts'), 'utf8') + '// arreglado\n' });
  const s2 = revisar(r, p2, { previo });
  assert.deepEqual(s2.repetir, ['tests/a3.test.ts', 'tests/barre.test.ts']);
  assert.equal(s2.tipos_saltear, 'false');
});

test('guardar: en verde queda lo seleccionado menos lo que no dio verde', { skip: !hayGit && 'sin git' }, () => {
  const r = repo();
  const p = r.enPunta({ 'lib/a.ts': "import { y } from './compartida.ts';\nexport const x = y; // otra\n" });
  writeFileSync(join(r.fuera, 'corrida.json'), JSON.stringify({ corridos: [], noVerdes: ['tests/a1.test.ts'] }));
  const out = join(r.fuera, 'ver.json');
  const s = spawnSync(process.execPath, [SCRIPT, 'guardar', '--punta', p, '--main', 'origin/main', '--corrida', join(r.fuera, 'corrida.json'), '--tipos', 'ok', '--salida', out], { cwd: r.dir, env: r.env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  assert.equal(s.status, 0, s.stderr);
  const v = JSON.parse(readFileSync(out, 'utf8'));
  assert.equal(v.punta, p);
  assert.ok(!v.verdes.includes('tests/a1.test.ts'));
  assert.ok(v.verdes.includes('tests/a2.test.ts') && v.verdes.includes('tests/barre.test.ts'));
  assert.equal(v.tipos, 'ok');
});

test('tests-afectados --solo corre exactamente la lista, y deja lo que no dio verde', { skip: !hayGit && 'sin git' }, () => {
  const r = repo();
  r.enPunta({ 'lib/a.ts': "import { y } from './compartida.ts';\nexport const x = y; // otra\n", 'tests/a5.test.ts': "import { test } from 'node:test';\ntest('rojo', () => { throw new Error('rojo'); });\n" });
  if (existsSync(join(RAIZ, 'node_modules'))) symlinkSync(join(RAIZ, 'node_modules'), join(r.dir, 'node_modules'), 'dir');
  writeFileSync(join(r.fuera, 'solo.txt'), 'tests/a2.test.ts\ntests/a5.test.ts\ntests/no-existe.test.ts\n');
  const corrida = join(r.fuera, 'corrida.json');
  const s = spawnSync(process.execPath, [join(RAIZ, 'scripts/tests-afectados.mjs'), '--base', 'origin/main', '--solo', join(r.fuera, 'solo.txt'), '--concurrencia', '1', '--tanda', '10'],
    { cwd: r.dir, env: { ...r.env, MAKO_VEREDICTO_CORRIDA: corrida, MAKO_TESTS_SIN_ESPERA: '1' }, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  assert.match(s.stdout, /--solo: 2 de los 3/, s.stdout + s.stderr);
  assert.equal(s.status, 1, 'a5 está roja: el código es el del rojo');
  const c = JSON.parse(readFileSync(corrida, 'utf8'));
  assert.deepEqual(c.corridos, ['tests/a2.test.ts', 'tests/a5.test.ts']);
  assert.deepEqual(c.noVerdes, ['tests/a5.test.ts']);
});

test('node24.sh: con el 24 en el PATH lo usa; con otro, el que dejó una vez anterior en la caché', { skip: (process.platform === 'win32' || spawnSync('sh', ['-c', 'exit 0']).error) && 'sin sh' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'node24-'));
  const falso = (carpeta: string, version: string) => {
    mkdirSync(carpeta, { recursive: true });
    writeFileSync(join(carpeta, 'node'), `#!/bin/sh\necho ${version.split('.')[0]}\n`, { mode: 0o755 });
  };
  const correr = (path: string, cache: string) => spawnSync('sh', [join(RAIZ, 'scripts/node24.sh')], { encoding: 'utf8', env: { NODE_ENV: 'test', PATH: `${path}:/usr/bin:/bin`, HOME: dir, MAKO_NODE_CACHE: cache } });
  falso(join(dir, 'con24'), '24.1.0');
  const a = correr(join(dir, 'con24'), join(dir, 'cache-vacia'));
  assert.equal(a.status, 0, a.stderr);
  assert.equal(a.stdout.trim(), join(dir, 'con24'), 'con el 24 a mano no baja nada');
  falso(join(dir, 'con22'), '22.9.0');
  const so = process.platform === 'darwin' ? 'darwin' : 'linux';
  const arq = process.arch === 'arm64' ? 'arm64' : 'x64';
  falso(join(dir, 'cache', `node-v24.3.0-${so}-${arq}`, 'bin'), '24.3.0');
  falso(join(dir, 'cache', `node-v24.10.0-${so}-${arq}`, 'bin'), '24.10.0');
  const b = correr(join(dir, 'con22'), join(dir, 'cache'));
  assert.equal(b.status, 0, b.stderr);
  assert.equal(b.stdout.trim(), join(dir, 'cache', `node-v24.10.0-${so}-${arq}`, 'bin'), 'el más nuevo de la caché (sort -V: 24.10 > 24.3)');
});

test('punta.yml: el veredicto se revisa antes de los tests, decide los tipos, y lo que pasó se guarda antes de llevar a main', () => {
  const yml = leerWorkflow(RAIZ, 'punta.yml');
  const i = (s: string) => yml.indexOf(s);
  for (const [a, b] of [['node scripts/veredicto.mjs revisar', 'node scripts/tests-afectados.mjs'], ['node scripts/tests-afectados.mjs', 'node scripts/tipos-ci.mjs'], ['node scripts/tipos-ci.mjs', 'node scripts/veredicto.mjs guardar'], ['node scripts/veredicto.mjs guardar', 'git push origin "HEAD:refs/heads/main"']]) {
    assert.ok(i(a) >= 0 && i(b) > i(a), `«${a}» va antes que «${b}»`);
  }
  assert.match(scriptDelPaso(yml, 'Tests afectados por lo que cambió (todos, sin cortar)'), /--solo \$REPETIR/);
  // Qué paso de los tests corre en cada caso lo EVALÚA el test de abajo («sin veredicto, los tests corren»), con las reglas de GitHub.
  assert.match(yml, /- name: Tipos\n\s+id: tipos\n\s+if: ".*steps\.veredicto\.outputs\.tipos_saltear != 'true'"/);
  assert.match(scriptDelPaso(yml, 'Llevar a main (sin forzar)'), /if \[ "\$SIN_PROBAR_VEREDICTO" = "1" \]; then sp=1; fi/, 'sin los tipos de acá, main lo mira sobre-main');
  // Con el secreto cargado, el paso lo recibe: si no, la clave de GitHub no frenaría nada.
  assert.match(yml, /- name: Lo que ya se probó\n[\s\S]*?MAKO_VEREDICTO_CLAVE: \$\{\{ secrets\.MAKO_VEREDICTO_CLAVE \}\}/);
  // El paso que revisa nunca frena la punta: si falla, corre todo.
  assert.match(scriptDelPaso(yml, 'Lo que ya se probó'), /echo "usar=false" >> "\$GITHUB_OUTPUT"/);
});

// ── Qué paso de los tests corre: las condiciones de punta.yml EVALUADAS con las reglas de GitHub ──────────────────────
// 4/11/2026, corridas 188 y 189: con `cuantos != '0'` y sin veredicto (`cuantos` no se escribe), GitHub comparó null con '0' como 0 con 0
// y salteó el paso: dash-cobranza y spy-paginas-bloqueadas llegaron a main sin correr un test. El test de antes miraba el TEXTO de la
// condición y daba verde con el bug adentro. Éste la evalúa sobre las salidas que `revisar` escribe de verdad, en cada caso.
// Probado rompiéndolo (4/11/2026): con la condición vieja, «sin veredicto» y «el paso no corrió» dan que NO corre ningún paso de tests
// (los tres casos de abajo que lo esperan caen); con `nada_que_repetir` sacado de `sinVeredicto`, igual sigue verde (null != 'si' corre),
// que es lo que se busca: la condición no depende de que la salida exista.

const TESTS = 'Tests afectados por lo que cambió (todos, sin cortar)';
const CUBRE = 'Los tests los cubre el veredicto';

/** Qué pasos de tests corren con estas salidas del paso «Lo que ya se probó» (`null`: el paso no corrió). */
function corren(yml: string, outputs: Record<string, string> | null) {
  const ctx = { funciones: { cancelled: false, success: true, failure: false, always: true }, datos: { steps: { instalar: { outcome: 'success' }, veredicto: outputs == null ? { outputs: {} } : { outputs } } } };
  const c = (n: string) => { const e = condicionDe(yml, n); assert.ok(e, `«${n}» tiene su if:`); return evaluar(e, ctx); };
  return { tests: c(TESTS), cubre: c(CUBRE) };
}

test('las reglas de GitHub: una salida que falta es null, y null contra un número es 0 (lo que salteó los tests)', () => {
  const ctx = (outputs: Record<string, string>) => ({ funciones: {}, datos: { steps: { v: { outputs } } } });
  assert.equal(evaluar("steps.v.outputs.cuantos != '0'", ctx({})), false, 'null != \'0\' es falso: así se salteó el paso en las corridas 188 y 189');
  assert.equal(evaluar("steps.v.outputs.cuantos != '0'", ctx({ cuantos: '7' })), true);
  assert.equal(evaluar("steps.v.outputs.marca != 'si'", ctx({})), true, 'contra una palabra no hay número: null != \'si\' es verdadero');
  assert.equal(evaluar("steps.v.outputs.usar == 'TRUE'", ctx({ usar: 'true' })), true, 'los strings se comparan sin mayúsculas');
  assert.equal(evaluar("!(steps.v.outputs.a == 'x' && steps.v.outputs.b == 'y') || false", ctx({ a: 'x', b: 'y' })), false);
  assert.throws(() => evaluar("contains(steps.v.outputs.a, 'x')", ctx({})), /no sé (leer|evaluar)/, 'lo que no sabe evaluar tira: no se cree evaluado');
});

test('punta.yml: sin veredicto, con uno que repite, con uno que cubre todo y con el paso que no corrió, corre exactamente UN paso de tests', { skip: !hayGit && 'sin git' }, () => {
  const yml = leerWorkflow(RAIZ, 'punta.yml');
  const r = repo();
  const p1 = r.enPunta({ 'lib/a.ts': "import { y } from './compartida.ts';\nexport const x = y; // otra\n" });
  // 1. Sin veredicto: la punta no trae renglón y no hay corrida anterior. Es el caso de casi todas las puntas.
  const sin = revisar(r, p1);
  assert.equal(sin.usar, 'false', sin.salida);
  assert.deepEqual(corren(yml, sin.outputs), { tests: true, cubre: false }, `sin veredicto los tests CORREN (salidas: ${JSON.stringify(sin.outputs)})`);
  // 2. El de la nube con main quieto: repite la muestra.
  const sel = conVeredicto(r).lista;
  const nube = revisar(r, r.g('rev-parse', 'HEAD'));
  assert.ok((nube.repetir ?? []).length > 0, nube.salida);
  assert.deepEqual(corren(yml, nube.outputs), { tests: true, cubre: false }, 'con algo que repetir corren los tests');
  // 3. El de Actions con todo en verde, misma punta y main quieto: no queda nada que repetir.
  r.g('reset', '-q', '--hard', p1);
  const previo = { v: 1, punta: p1, main: r.g('rev-parse', 'origin/main'), verdes: sel, tipos: 'ok', node: '24.1.0', corrida: 9 };
  const todo = revisar(r, p1, { previo });
  assert.deepEqual(todo.repetir, [], todo.salida);
  assert.deepEqual(corren(yml, todo.outputs), { tests: false, cubre: true }, 'con nada que repetir corre el paso que lo dice, no el de los tests');
  // 4. El paso no corrió (sólo texto) o 5. falló (el respaldo del paso): corren los tests.
  assert.deepEqual(corren(yml, null), { tests: true, cubre: false }, 'si «Lo que ya se probó» no corrió, los tests corren');
  assert.deepEqual(corren(yml, { usar: 'false', nada_que_repetir: 'no' }), { tests: true, cubre: false }, 'si falló, corren');
  assert.match(scriptDelPaso(yml, 'Lo que ya se probó'), /echo "nada_que_repetir=no" >> "\$GITHUB_OUTPUT"/, 'el respaldo lo escribe');
});

test('ningún workflow compara una salida de un paso contra un número: una que falta vale 0', () => {
  const dir = join(RAIZ, '.github', 'workflows');
  const malos: string[] = [];
  for (const f of readdirSync(dir).filter((n) => /\.ya?ml$/.test(n))) {
    readFileSync(join(dir, f), 'utf8').split(/\r?\n/).forEach((l, i) => {
      if (/^\s*#/.test(l)) return;
      if (/outputs\.[\w-]+\s*[!=]=\s*'-?\d/.test(l) || /'-?\d[\d.]*'\s*[!=]=\s*steps\.[\w-]+\.outputs/.test(l)) malos.push(`${f}:${i + 1}: ${l.trim()}`);
    });
  }
  assert.deepEqual(malos, [], 'comparar con una palabra («si»/«no»), nunca con un número');
});

