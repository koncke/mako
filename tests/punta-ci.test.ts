// =============================================================================
// Cada punta se chequea sola y llega a main sola: lo que no puede romperse sin que nadie lo vea (3/11/2026)
// =============================================================================
// Martín: «Y no podemos hacer que entren en diferentes testeos en github? Entonces se va deployando lo que ya pasó en
// lugar de todo junto... Esto como regla». Lo hace .github/workflows/punta.yml, y ese archivo es el único camino
// automático a main que mezcla por su cuenta: un error acá no da un rojo, da un VERDE con código sin chequear.
//
// Lo que se fija, por orden de lo que cuesta si se rompe:
//   · main sólo se empuja después de las guardas, los afectados y los tipos, y sin forzar;
//   · el código 2 («no pude calcular») y el 98/99 («no corrió») no pueden dar verde, ni un 0 sin tests adentro;
//   · lo que tests-afectados compara DESPUÉS de mezclar es lo que la punta le agrega a main, y no queda vacío;
//   · la mezcla la firma el autor de la punta: si la firma github-actions[bot], Vercel puede no desplegarla;
//   · los pushes a punta/** y ci-rojo/** no construyen en Vercel.
// Los pasos de la mezcla y de llevar a main se CORREN acá, con git de verdad sobre un repo de mentira: leerlos como
// texto no diría si el bucle pisa main ni quién firma.
//
// Probado ROMPIÉNDOLO (3/11/2026). Una rotura por vez en punta.yml, y cada una dio rojo acá:
//   · `--cortar` en los afectados · `--force` en el push a main · `exit 0` en el código 2 · Tipos después del push
//   · sin el `env` del autor en la mezcla · la marca del rojo apuntando a main · `|| true` en las guardas
//   · sacar la línea que exige VERDE con tests · la mezcla del bucle sin repetir las guardas · `--depth` en el fetch
//   · dejar pasar a un bot como autor · un choque sin `git merge --abort` · `punta/**` fuera de vercel.json.
//   · `grep -v '^docs/'` (un docs/x.ts contaba como documentación) · Tipos en 12 min · el job en 45 · el semanal en 20
//   · el semanal sin tope en su paso · el respaldo con `/swapfile`.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
const YML = leer('.github/workflows/punta.yml');
const CODIGO = sinComentarios(YML);
const haySh = !spawnSync('sh', ['-c', 'exit 0']).error;

/** Un paso del workflow: su texto entero y el cuerpo de su `run: |`. */
function paso(nombre: string): { texto: string; run: string } {
  const lineas = CODIGO.split('\n');
  const i = lineas.findIndex((l) => l.trim() === `- name: ${nombre}`);
  assert.ok(i >= 0, `no encuentro el paso «${nombre}»`);
  let fin = lineas.findIndex((l, k) => k > i && /^ {6}- /.test(l));
  if (fin < 0) fin = lineas.length;
  const bloque = lineas.slice(i, fin);
  const r = bloque.findIndex((l) => /^ {8}run: \|$/.test(l));
  return { texto: bloque.join('\n'), run: r < 0 ? '' : bloque.slice(r + 1).map((l) => l.slice(10)).join('\n') };
}

const MEZCLAR = 'Mezclar main en la punta';
const LLEVAR = 'Llevar a main (sin forzar)';
const AFECTADOS = 'Tests afectados por lo que cambió (todos, sin cortar)';
const TIPOS = 'Tipos';
const GUARDAS = 'Guardas del push';
const MARCA = 'Dejar la marca del rojo en ci-rojo/<punta>';

// ── Lo que se ve leyendo el archivo ─────────────────────────────────────────────────────────────

test('se dispara sólo con un push a punta/**, una corrida por rama, con su tope de minutos', () => {
  const on = CODIGO.slice(CODIGO.indexOf('\non:'), CODIGO.indexOf('\nconcurrency:'));
  assert.match(on, /push:\n\s+branches: \['punta\/\*\*'\]/);
  assert.doesNotMatch(on, /pull_request|schedule/, 'cada disparo extra paga minutos');
  assert.match(CODIGO, /group: punta-\$\{\{ github\.ref_name \}\}/, 'una por rama: una punta no cancela a otra');
  assert.match(CODIGO, /cancel-in-progress: true/, 'un retoque seguido no paga dos corridas');
  assert.match(CODIGO, /^ {4}timeout-minutes: 55$/m);
  assert.match(CODIGO, /fetch-depth: 0/);
  assert.match(CODIGO, /node-version: 24/);
});

test('main sólo se empuja después de mezclar, guardas, afectados y tipos, en ese orden', () => {
  const orden = ['git diff --name-only --no-renames "$base" HEAD', 'git merge --no-edit', 'npm ci', 'npx next typegen', 'sh scripts/guardas-push.sh origin', 'node scripts/tests-afectados.mjs', 'node scripts/tipos-ci.mjs', 'git push origin "HEAD:refs/heads/main"'];
  const posiciones = orden.map((o) => CODIGO.indexOf(o));
  orden.forEach((o, k) => assert.ok(posiciones[k] >= 0, `falta «${o}»`));
  for (let k = 1; k < orden.length; k++) assert.ok(posiciones[k - 1] < posiciones[k], `«${orden[k - 1]}» tiene que ir antes que «${orden[k]}»`);
  assert.equal(CODIGO.split('HEAD:refs/heads/main').length - 1, 1, 'hay un solo push a main');
  const llevar = paso(LLEVAR).texto;
  assert.doesNotMatch(llevar.split('run: |')[0], /always\(\)|failure\(\)|cancelled\(\)/, 'con cualquier paso rojo, llevar a main se saltea: no puede cambiar esa condición');
  assert.doesNotMatch(CODIGO, /continue-on-error/, 'un paso que puede fallar sin frenar es un verde falso');
});

// ⚠️ 4/11/2026: el rojo suma una SEGUNDA marca forzada, `espera-main/<punta>` (la relanza ci-main-verde.sh cuando main vuelve a
// verde). La guarda se afinó, no se aflojó: buscaba «main» en la línea, y `espera-main` lo contiene. Lo que protege sigue igual:
// ningún push a `refs/heads/main` va forzado, y lo único forzado son marcas de ESTA punta, del commit que se subió.
test('nada fuerza main, y lo único forzado son las marcas del rojo de esa punta', () => {
  const pushes = CODIGO.split('\n').filter((l) => /git push/.test(l));
  const aMain = pushes.filter((x) => /refs\/heads\/main(?![\w/-])/.test(x));
  assert.ok(aMain.length >= 1, 'el push a main sigue estando');
  for (const l of aMain) assert.doesNotMatch(l, /--force|(^|\s)-f(\s|$)|\+HEAD:|\+refs\//, `main avanza sin forzar y esta línea fuerza: ${l.trim()}`);
  const forzados = pushes.filter((l) => /--force|(^|\s)-f(\s|$)|\+HEAD:|\+refs\//.test(l));
  assert.equal(forzados.length, 2, `se esperaban dos pushes forzados (las dos marcas): ${forzados.join(' / ')}`);
  assert.match(forzados[0], /"\$GITHUB_SHA:refs\/heads\/ci-rojo\/\$punta"/, 'la marca es por punta, y del commit que se subió: HEAD puede ser una mezcla');
  assert.match(forzados[1], /"\$GITHUB_SHA:refs\/heads\/espera-main\/\$punta"/, 'la espera también es por punta y del commit que se subió');
  const marca = paso(MARCA).texto;
  assert.match(marca, /if: failure\(\)/, 'con always() un verde también movería la marca');
  assert.doesNotMatch(marca, /refs\/heads\/main/);
});

test('los afectados corren todos y NO corre el resto: ese es el semanal', () => {
  const a = paso(AFECTADOS).texto;
  assert.match(a, /--base origin\/main/);
  assert.doesNotMatch(a, /--cortar/, 'sin cortar: un rojo muestra TODOS');
  assert.doesNotMatch(CODIGO, /--resto|npm test/, 'lo demás corre en semanal-tests.yml, decisión de Martín del 21/10');
  assert.match(YML, /Lo que vaya a main no\n?.*puede dar un OK falso; un chequeo completo nocturno o semanal queda de red/, 'el comentario dice por qué, con la cita');
  assert.ok(existsSync(join(RAIZ, '.github/workflows/semanal-tests.yml')), 'la red que este flujo da por hecha');
});

test('los topes: el del job alcanza para los de sus pasos, y Tipos entra en el suyo', () => {
  const job = Number(/^ {4}timeout-minutes: (\d+)$/m.exec(CODIGO)?.[1]);
  const pasos = [...CODIGO.matchAll(/^ {8}timeout-minutes: (\d+)$/gm)].map((m) => Number(m[1]));
  assert.equal(pasos.length, 2, 'los dos pasos largos');
  const suma = pasos.reduce((a, b) => a + b, 0);
  assert.ok(job >= suma + 5, `el job tiene ${job} min y sus pasos suman ${suma}: se cortaría el job, y un job cancelado no deja la marca del rojo`);
  const tipos = Number(/^ {8}timeout-minutes: (\d+)$/m.exec(paso(TIPOS).texto)?.[1]);
  assert.ok(tipos >= 15, `Tipos tiene ${tipos} min y ya tardó 727 s en \`integracion\` (corrida 385): un rojo falso le cuesta ~25 min a cada punta`);
});

// ⚠️ Medido el 3/11/2026: las dos redes existían, y este archivo sólo miraba eso. La semanal murió cancelada por su techo el 2/11;
// la del tsc entero nunca dio un veredicto. Un archivo que existe no es una red.
test('las dos redes que este flujo da por hechas pueden dar un veredicto', () => {
  const semanal = sinComentarios(leer('.github/workflows/semanal-tests.yml'));
  assert.ok(Number(/^ {4}timeout-minutes: (\d+)$/m.exec(semanal)?.[1]) >= 45, 'la semanal: el 2/11 la cortaron sus 20 min, y es la única que ve «los demás»');
  assert.match(semanal, /^ {8}timeout-minutes: \d+$/m, 'la semanal: con un cuelgue corta el paso, no el job');
  const respaldo = sinComentarios(leer('.github/workflows/tipos-respaldo.yml'));
  assert.match(respaldo, /swapon/, 'el tsc entero no entra sin swap');
  assert.doesNotMatch(respaldo, /\s\/swapfile\s*$/m, 'el runner ya trae /swapfile en uso: fallocate muere con «Text file busy» (2/11)');
  assert.match(respaldo, /^ {8}timeout-minutes: \d+$/m, 'el respaldo: si no entra, corta el paso, no el job');
});

test('ningún paso de los que frenan traga su propio rojo', () => {
  for (const nombre of [GUARDAS, AFECTADOS, TIPOS]) {
    const t = paso(nombre).texto;
    assert.doesNotMatch(t, /\|\| true/, `«${nombre}» no puede tragarse un rojo`);
    assert.doesNotMatch(t, /exit 0/, `«${nombre}» no puede salir en verde por un costado`);
  }
  assert.match(paso(TIPOS).texto, /TIPOS_TANDAS: '4'/);
  assert.match(paso(TIPOS).texto, /TIPOS_HEAP_MB: '12288'/, 'con el tope por defecto el entero muere, y se gastan 6 min para un OK PARCIAL');
  // Si el script cambia cómo dice el verde, este paso daría rojo siempre: que se entere quien lo cambie.
  assert.ok(leer('scripts/tests-afectados.mjs').includes("'✔ VERDE'} · ${r.total.tests} tests de"), 'el paso busca esa línea en la salida del script');
});

test('la mezcla la firma el autor de la punta, nunca el bot', () => {
  for (const nombre of [MEZCLAR, LLEVAR]) {
    const t = paso(nombre).texto;
    for (const v of ['GIT_AUTHOR_NAME', 'GIT_COMMITTER_NAME']) assert.ok(t.includes(`${v}: \${{ steps.punta.outputs.autor_nombre }}`), `«${nombre}» sin ${v}`);
    for (const v of ['GIT_AUTHOR_EMAIL', 'GIT_COMMITTER_EMAIL']) assert.ok(t.includes(`${v}: \${{ steps.punta.outputs.autor_correo }}`), `«${nombre}» sin ${v}`);
  }
  // Afinada el 4/11/2026, no aflojada: prohibía CUALQUIER `git config`, y el driver de las bitácoras (merge.bitacora.*) no
  // toca al autor. Sigue frenando todo lo que lo pisa: `git config [--global] user.*`, `-c user.name=…` y el bot.
  assert.doesNotMatch(CODIGO, /git config[^\n]*\buser\.|user\.(?:name|email)|github-actions\[bot\]/, 'el autor sale sólo del último commit de la punta');
  for (const malo of ['git config user.name x', 'git config --global user.email x@y', 'git -c user.name=x commit', 'github-actions[bot]']) {
    assert.match(malo, /git config[^\n]*\buser\.|user\.(?:name|email)|github-actions\[bot\]/, `la guarda sigue viendo «${malo}»`);
  }
});

test('ningún fetch vuelve superficial el clon: la mezcla necesita la historia', () => {
  assert.doesNotMatch(CODIGO, /--depth/);
});

test('los pushes a punta/** y ci-rojo/** no construyen en Vercel (cada build cuesta)', () => {
  const v = JSON.parse(leer('vercel.json'));
  assert.equal(v.git?.deploymentEnabled?.['punta/**'], false);
  assert.equal(v.git?.deploymentEnabled?.['ci-rojo/**'], false);
});

// ── Los pasos, corridos de verdad ───────────────────────────────────────────────────────────────

/** El entorno sin ningún GIT_*: tests-afectados le pasa GIT_INDEX_FILE a los tests, y ese índice no es de este repo. */
function entornoLimpio(tmp: string): NodeJS.ProcessEnv {
  const env = {} as NodeJS.ProcessEnv;
  for (const [k, v] of Object.entries(process.env)) if (!k.startsWith('GIT_')) env[k] = v;
  const global = join(tmp, 'gitconfig-vacio');
  writeFileSync(global, '');
  return { ...env, GIT_CONFIG_GLOBAL: global, GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0' };
}

type Salida = { codigo: number | null; salida: string; outputs: Record<string, string>; tmp: string };

/** Corre el cuerpo de un paso como lo corre Actions (`-e`), con funciones que tapan lo que no se quiere correr de verdad. */
function correrPaso(nombre: string, cwd: string, o: { env?: Partial<NodeJS.ProcessEnv>; antes?: string; tmp?: string } = {}): Salida {
  const tmp = o.tmp ?? mkdtempSync(join(tmpdir(), 'punta-paso-'));
  const script = join(tmp, 'paso.sh');
  writeFileSync(script, `${o.antes ?? ''}\n${paso(nombre).run}\n`);
  const salidaGh = join(tmp, 'github-output');
  writeFileSync(salidaGh, '');
  const r = spawnSync('sh', ['-e', script], {
    cwd,
    encoding: 'utf8',
    env: { ...entornoLimpio(tmp), RUNNER_TEMP: tmp, GITHUB_STEP_SUMMARY: join(tmp, 'resumen'), GITHUB_OUTPUT: salidaGh, GITHUB_REF_NAME: 'punta/prueba', ...o.env },
  });
  if (r.error) throw r.error;
  const outputs = Object.fromEntries(readFileSync(salidaGh, 'utf8').split('\n').filter(Boolean).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
  return { codigo: r.status, salida: `${r.stdout}${r.stderr}`, outputs, tmp };
}

const AUTORA = { nombre: 'Autora', correo: 'autora@mako.test' };
const OTRO = { nombre: 'Otro', correo: 'otro@mako.test' };
const firma = (p: typeof AUTORA) => ({ GIT_AUTHOR_NAME: p.nombre, GIT_AUTHOR_EMAIL: p.correo, GIT_COMMITTER_NAME: p.nombre, GIT_COMMITTER_EMAIL: p.correo });

/** Un remoto, y un clon parado en la punta como lo deja actions/checkout: main con un commit y scripts/guardas-push.sh de mentira. */
function armarRepo() {
  const raiz = mkdtempSync(join(tmpdir(), 'punta-ci-'));
  const env = entornoLimpio(raiz);
  const origen = join(raiz, 'origen.git');
  const clon = join(raiz, 'clon');
  const git = (cwd: string, ...a: string[]) => {
    const r = spawnSync('git', a, { cwd, encoding: 'utf8', env });
    assert.equal(r.status, 0, `git ${a.join(' ')}: ${r.stderr}`);
    return r.stdout.trim();
  };
  const commit = (cwd: string, quien: typeof AUTORA, archivos: Record<string, string>, msg = 'cambio') => {
    for (const [r, t] of Object.entries(archivos)) {
      mkdirSync(dirname(join(cwd, r)), { recursive: true });
      writeFileSync(join(cwd, r), t);
    }
    git(cwd, 'add', '--', ...Object.keys(archivos));
    git(cwd, '-c', `user.name=${quien.nombre}`, '-c', `user.email=${quien.correo}`, 'commit', '-q', '-m', msg);
  };
  git(raiz, 'init', '-q', '--bare', '-b', 'main', origen);
  git(raiz, 'clone', '-q', origen, clon);
  git(clon, 'checkout', '-q', '-b', 'main');
  const guardasLog = join(raiz, 'guardas.log');
  commit(clon, OTRO, { 'lib/base.ts': 'export const base = 1;\n', 'docs/base.md': 'base\n', 'scripts/guardas-push.sh': `echo corrida >> "${guardasLog.replace(/\\/g, '/')}"\n`, 'scripts/ci-workflow-nuevo.sh': readFileSync(join(RAIZ, 'scripts', 'ci-workflow-nuevo.sh'), 'utf8') }, 'base');
  git(clon, 'push', '-q', 'origin', 'main');
  git(clon, 'checkout', '-q', '-b', 'punta/prueba');
  /** Otro chat empuja a main desde su propio clon. */
  const otroClon = join(raiz, 'otro');
  git(raiz, 'clone', '-q', '-b', 'main', origen, otroClon);
  const moverMain = (archivos: Record<string, string>) => {
    git(otroClon, 'pull', '-q', 'origin', 'main');
    commit(otroClon, OTRO, archivos, 'otro chat');
    git(otroClon, 'push', '-q', 'origin', 'main');
    return git(otroClon, 'rev-parse', 'HEAD');
  };
  const veces = () => (existsSync(guardasLog) ? readFileSync(guardasLog, 'utf8').split('\n').filter(Boolean).length : 0);
  const subir = () => git(clon, 'fetch', '-q', 'origin');
  return { raiz, origen, clon, env, git, commit, moverMain, veces, subir };
}

/** `leerCambios` de tests-afectados, en otro proceso: mira el repo de donde se corre, y este test no puede mudar el suyo. */
function loQueCompara(cwd: string, env: NodeJS.ProcessEnv): string[] {
  const url = pathToFileURL(join(RAIZ, 'scripts/tests-afectados.mjs')).href;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', `const m = await import(${JSON.stringify(url)}); process.stdout.write(JSON.stringify(m.leerCambios('origin/main')));`], { cwd, encoding: 'utf8', env, maxBuffer: 64 * 1024 * 1024 });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout).cambiados;
}

test('mezclado main, tests-afectados compara lo que la punta le agrega: ni lo de main, ni vacío', { skip: !haySh && 'sin sh' }, () => {
  const R = armarRepo();
  R.commit(R.clon, AUTORA, { 'lib/punta.ts': 'export const punta = 1;\n' });
  R.moverMain({ 'lib/de-main.ts': 'export const deMain = 1;\n' });
  R.subir();

  const antes = correrPaso('Lo que cambió la punta', R.clon);
  assert.equal(antes.codigo, 0, antes.salida);
  assert.equal(readFileSync(join(antes.tmp, 'punta-cambiados.txt'), 'utf8').trim(), 'lib/punta.ts');
  assert.equal(antes.outputs.autor_nombre, 'Autora');
  assert.equal(antes.outputs.autor_correo, 'autora@mako.test');

  const m = correrPaso(MEZCLAR, R.clon, { env: firma(AUTORA), tmp: antes.tmp });
  assert.equal(m.codigo, 0, m.salida);
  assert.equal(m.outputs.nada, 'false');
  assert.equal(m.outputs.solo_docs, 'false');
  assert.ok(existsSync(join(R.clon, 'lib/de-main.ts')), 'lo de main quedó adentro');
  assert.deepEqual(loQueCompara(R.clon, R.env), ['lib/punta.ts'], 'la lista es lo que la punta le agrega a main');
  assert.equal(R.git(R.clon, 'log', '-1', '--format=%an <%ae> | %cn <%ce>'), 'Autora <autora@mako.test> | Autora <autora@mako.test>', 'la mezcla la firma la autora de la punta');
  assert.equal(R.git(R.clon, 'rev-list', '--parents', '-1', 'HEAD').split(' ').length, 3, 'es una mezcla');
});

test('si main ya tiene lo mismo que la punta, no queda nada para chequear ni para llevar', { skip: !haySh && 'sin sh' }, () => {
  const R = armarRepo();
  R.commit(R.clon, AUTORA, { 'lib/igual.ts': 'export const igual = 1;\n' });
  R.moverMain({ 'lib/igual.ts': 'export const igual = 1;\n' });
  R.subir();
  const antes = correrPaso('Lo que cambió la punta', R.clon);
  const m = correrPaso(MEZCLAR, R.clon, { env: firma(AUTORA), tmp: antes.tmp });
  assert.equal(m.codigo, 0, m.salida);
  assert.equal(m.outputs.nada, 'true');
  assert.deepEqual(loQueCompara(R.clon, R.env), [], 'y por eso se corta antes: el script diría «Nada cambió» con un 0');
  for (const n of [GUARDAS, AFECTADOS, TIPOS, LLEVAR]) assert.match(paso(n).texto, /steps\.(mezcla\.outputs\.nada|instalar\.outcome)/, `«${n}» tiene que saltearse sin nada que llevar`);
});

test('sólo docs se decide con las dos listas: un archivo fuera de docs/, o código adentro, corre todo', { skip: !haySh && 'sin sh' }, () => {
  for (const [archivos, esperado] of [[{ 'docs/nuevo.md': 'x\n' }, 'true'], [{ 'docs/nuevo.md': 'x\n', 'lib/punta.ts': 'export const p = 1;\n' }, 'false'], [{ 'AGENTS.md': 'x\n' }, 'false'], [{ 'docs/x.ts': 'export const x: number = "a";\n' }, 'false'], [{ 'docs/x.mjs': 'x\n' }, 'false'], [{ 'docs/diseno/x.png': 'x\n' }, 'true']] as const) {
    const R = armarRepo();
    R.commit(R.clon, AUTORA, archivos);
    R.subir();
    const antes = correrPaso('Lo que cambió la punta', R.clon);
    const m = correrPaso(MEZCLAR, R.clon, { env: firma(AUTORA), tmp: antes.tmp });
    assert.equal(m.codigo, 0, m.salida);
    assert.equal(m.outputs.solo_docs, esperado, Object.keys(archivos).join(', '));
  }
});

test('un choque con main es rojo, lo dice, y no deja una mezcla a medias', { skip: !haySh && 'sin sh' }, () => {
  const R = armarRepo();
  R.commit(R.clon, AUTORA, { 'lib/base.ts': 'export const base = 2;\n' });
  R.moverMain({ 'lib/base.ts': 'export const base = 3;\n' });
  R.subir();
  const punta = R.git(R.clon, 'rev-parse', 'HEAD');
  const antes = correrPaso('Lo que cambió la punta', R.clon);
  const m = correrPaso(MEZCLAR, R.clon, { env: firma(AUTORA), tmp: antes.tmp });
  assert.notEqual(m.codigo, 0);
  assert.match(m.salida, /::error::.*lib\/base\.ts/, 'el mensaje nombra el archivo');
  assert.equal(R.git(R.clon, 'rev-parse', 'HEAD'), punta);
  assert.ok(!existsSync(join(R.clon, '.git/MERGE_HEAD')), 'sin mezcla a medias');
});

test('el último commit de un bot frena la corrida: Vercel puede no desplegarlo', { skip: !haySh && 'sin sh' }, () => {
  const R = armarRepo();
  R.commit(R.clon, { nombre: 'github-actions[bot]', correo: '41898282+github-actions[bot]@users.noreply.github.com' }, { 'lib/punta.ts': 'export const p = 1;\n' });
  R.subir();
  const r = correrPaso('Lo que cambió la punta', R.clon);
  assert.notEqual(r.codigo, 0);
  assert.match(r.salida, /::error::.*Vercel/);
});

const SIN_ESPERAS = 'sleep() { :; }';

test('llevar a main: sin moverse, es un push simple y conserva los commits', { skip: !haySh && 'sin sh' }, () => {
  const R = armarRepo();
  R.commit(R.clon, AUTORA, { 'lib/punta.ts': 'export const p = 1;\n' });
  R.subir();
  const punta = R.git(R.clon, 'rev-parse', 'HEAD');
  const r = correrPaso(LLEVAR, R.clon, { env: firma(AUTORA), antes: SIN_ESPERAS });
  assert.equal(r.codigo, 0, r.salida);
  assert.equal(R.git(R.origen, 'rev-parse', 'main'), punta, 'fast-forward: sin una mezcla de más');
  assert.equal(R.veces(), 0, 'sin mezcla nueva no hace falta repetir las guardas');
});

test('llevar a main: si otra punta llegó mientras tanto, mezcla, repite las guardas, avisa y no pisa nada', { skip: !haySh && 'sin sh' }, () => {
  const R = armarRepo();
  R.commit(R.clon, AUTORA, { 'lib/punta.ts': 'export const p = 1;\n' });
  R.subir();
  const deOtro = R.moverMain({ 'lib/otra-punta.ts': 'export const o = 1;\n' });
  const r = correrPaso(LLEVAR, R.clon, { env: firma(AUTORA), antes: SIN_ESPERAS });
  assert.equal(r.codigo, 0, r.salida);
  assert.equal(R.veces(), 1, 'la mezcla nueva pasó por las guardas');
  assert.match(r.salida, /::warning::main se movió/, 'y se dice que no pasó por tests ni tipos');
  R.git(R.origen, 'merge-base', '--is-ancestor', deOtro, 'main');
  assert.equal(R.git(R.origen, 'log', '-1', '--format=%an %cn', 'main'), 'Autora Autora', 'la mezcla nueva también la firma la autora');
  assert.equal(R.git(R.origen, 'ls-tree', '--name-only', 'main', 'lib/').split('\n').includes('lib/punta.ts'), true);
});

test('llevar a main: si la mezcla nueva choca es rojo, y main queda como estaba', { skip: !haySh && 'sin sh' }, () => {
  const R = armarRepo();
  R.commit(R.clon, AUTORA, { 'lib/base.ts': 'export const base = 2;\n' });
  R.subir();
  const deOtro = R.moverMain({ 'lib/base.ts': 'export const base = 3;\n' });
  const r = correrPaso(LLEVAR, R.clon, { env: firma(AUTORA), antes: SIN_ESPERAS });
  assert.notEqual(r.codigo, 0);
  assert.match(r.salida, /::error::.*lib\/base\.ts/);
  assert.equal(R.git(R.origen, 'rev-parse', 'main'), deOtro);
});

test('llevar a main: si la mezcla nueva rompe una guarda es rojo, y main queda como estaba', { skip: !haySh && 'sin sh' }, () => {
  const R = armarRepo();
  R.commit(R.clon, AUTORA, { 'lib/punta.ts': 'export const p = 1;\n', 'scripts/guardas-push.sh': 'exit 1\n' });
  R.subir();
  const deOtro = R.moverMain({ 'lib/otra-punta.ts': 'export const o = 1;\n' });
  const r = correrPaso(LLEVAR, R.clon, { env: firma(AUTORA), antes: SIN_ESPERAS });
  assert.notEqual(r.codigo, 0);
  assert.equal(R.git(R.origen, 'rev-parse', 'main'), deOtro);
});

test('llevar a main: con el remoto rechazando, se rinde a los 5 intentos en rojo', { skip: !haySh && 'sin sh' }, () => {
  const R = armarRepo();
  R.commit(R.clon, AUTORA, { 'lib/punta.ts': 'export const p = 1;\n' });
  R.subir();
  const main = R.git(R.origen, 'rev-parse', 'main');
  mkdirSync(join(R.origen, 'hooks'), { recursive: true });
  writeFileSync(join(R.origen, 'hooks/pre-receive'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  const r = correrPaso(LLEVAR, R.clon, { env: firma(AUTORA), antes: SIN_ESPERAS });
  assert.notEqual(r.codigo, 0);
  assert.equal(r.salida.split('main rechazó el push').length - 1, 5, 'cinco intentos');
  assert.match(r.salida, /::error::Después de 5 intentos/);
  assert.equal(R.git(R.origen, 'rev-parse', 'main'), main);
});

/** `node` de mentira: imprime `dice` y sale con `codigo`. */
const nodeQue = (codigo: number, dice = '') => `node() { printf '%s\\n' "${dice}"; return ${codigo}; }\nfree() { :; }\nnproc() { echo 2; }`;

test('tests afectados: el 2, el 99 y el 1 son rojo; el 0 sin tests adentro también', { skip: !haySh && 'sin sh' }, () => {
  const VERDE = '[tests-afectados] ✔ VERDE · 5342 tests de 1159 archivos · 7 min 54 s';
  const R = mkdtempSync(join(tmpdir(), 'punta-af-'));
  for (const [codigo, dice, debe] of [
    [2, '[tests-afectados] no encuentro origin/main', 'rojo'],
    [99, '[tests-afectados] ⚠ SIN CHEQUEAR · 0 tests', 'rojo'],
    [98, '', 'rojo'],
    [1, '[tests-afectados] ✖ ROJO · 10 tests de 2 archivos', 'rojo'],
    [0, '[tests-afectados] Nada cambió respecto de origin/main: no hay tests que correr.', 'rojo'],
    [0, '[tests-afectados] Ningún test mira lo cambiado.', 'rojo'],
    [0, '[tests-afectados] ✔ VERDE · 0 tests de 0 archivos', 'rojo'],
    [0, VERDE, 'verde'],
  ] as const) {
    const r = correrPaso(AFECTADOS, R, { antes: nodeQue(codigo, dice) });
    if (debe === 'verde') assert.equal(r.codigo, 0, r.salida);
    else assert.notEqual(r.codigo, 0, `«${dice}» (código ${codigo}) no puede dar verde`);
    if (codigo !== 0 && debe === 'rojo') assert.equal(r.codigo, codigo, 'el código sale tal cual: el resumen lo distingue');
  }
});

test('tipos: el 98 y el 99 («no llegó a un veredicto») son rojo, igual que el 1', { skip: !haySh && 'sin sh' }, () => {
  const R = mkdtempSync(join(tmpdir(), 'punta-ti-'));
  for (const c of [1, 98, 99]) assert.equal(correrPaso(TIPOS, R, { antes: nodeQue(c) }).codigo, c);
  assert.equal(correrPaso(TIPOS, R, { antes: nodeQue(0) }).codigo, 0);
});
