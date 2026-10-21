// =============================================================================
// Los TIPOS son parte del veredicto: un VERDE sin tipos no se llama VERDE
// =============================================================================
// El 21/10/2026 fallaron seis runs de Actions y cada uno le mandó a Martín un email de GitHub («integracion → main: All jobs have failed»). Cuatro cayeron en «Tipos», y siempre
// en un TEST nuevo o editado (candado-pesado, crm-ficha-bloques-partidos, m-mako-chat, ops-center-landing-receta). Las puntas venían con `VERDE (tipos: los chequea Actions)`, porque
// el tsc acotado no entró en RAM, y `tests-afectados.mjs` —que el Cerebro corre antes de cada push— ejecuta los tests con `tsx`, que NO chequea tipos: un test con un error de
// tipos corre perfecto, da verde, y el error aparece recién en Actions.
//
// Lo que se fija acá (scripts/tests-afectados.mjs: `correrTipos`, `cerrar`, y el CLI):
//   · `correrTipos` devuelve un ESTADO —ok / nada / rojo / sin-tipos—, medido por el código de salida y la salida del tsc, sin pipes. Que el vigía lo mate, que se quede sin heap,
//     que no haya RAM o que otro typecheck no se libere es `sin-tipos`: ni un error de tipos ni un verde.
//   · `cerrar` es la ÚNICA función que decide la palabra del veredicto y el código de salida: rojo → ROJO (1); sin rojos pero sin tipos → SIN TIPOS (98); `--sin-tipos` a propósito
//     → PARCIAL (0); si no, VERDE. La usan tests-afectados y antes-de-subir: dicen lo mismo.
//   · DE PUNTA A PUNTA (un repo de git de mentira + el CLI de verdad): un test NUEVO con un error de tipos da ROJO en tests-afectados, aunque como test corra perfecto con tsx.
//
// ⚠️ Las pruebas del tsc usan un repo de mentira en una carpeta temporal (con un junction a node_modules), un lock propio (MAKO_TIPOS_LOCK: no se pelean con el typecheck de
// otro chat) y un piso de RAM bajo (MAKO_TIPOS_PISO_GB: chequean un archivito de ~300 MB): no dependen de cuánta RAM libre tenga la PC.
//
// ⚠️ PROBADO ROMPIÉNDOLO (21/10/2026): ver el final del archivo.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cerrar, correrTipos, SALIDA_SIN_TIPOS } from '../scripts/tests-afectados.mjs';

const REPO_REAL = fileURLToPath(new URL('..', import.meta.url));
const TESTS_AFECTADOS = join(REPO_REAL, 'scripts', 'tests-afectados.mjs');

// Sin un git del entorno heredado (el índice temporal con el que antes-de-subir corre los tests): los repos de mentira usan el suyo.
const limpio = (extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv => {
  const e: NodeJS.ProcessEnv = { ...process.env, ...extra };
  for (const k of ['GIT_INDEX_FILE', 'GIT_DIR', 'GIT_WORK_TREE', 'NODE_TEST_CONTEXT']) delete e[k];
  return e;
};

// ---------------------------------------------------------------------------
// cerrar: la palabra del veredicto y el código de salida
// ---------------------------------------------------------------------------

test('cerrar: un verde SIN tipos no se llama VERDE — SIN TIPOS (98) si no se pudieron chequear, PARCIAL (0) si se pidió a propósito; y un rojo manda sobre todo', () => {
  const ok = { estado: 'ok' };
  const nada = { estado: 'nada' };
  const sin = { estado: 'sin-tipos', porque: 'no hay RAM: quedan 0.9 GB y el tsc acotado pide 4.0' };
  assert.deepEqual(cerrar({ tipos: ok }), { palabra: 'VERDE', detalle: '', codigo: 0 });
  assert.equal(cerrar({ tipos: nada }).palabra, 'VERDE', 'ningún .ts cambió: no hay nada que compilar, y eso sí es un verde');
  const s = cerrar({ tipos: sin });
  assert.equal(s.palabra, 'SIN TIPOS');
  assert.equal(s.codigo, SALIDA_SIN_TIPOS);
  assert.equal(SALIDA_SIN_TIPOS, 98, 'distinto de 0 (no es verde), de 1 (no es un rojo) y de 99 (no es «no corrió por falta de RAM»)');
  assert.match(s.detalle, /no hay RAM: quedan 0\.9 GB/, 'dice por qué');
  assert.match(s.detalle, /un VERDE sin tipos no es un VERDE/);
  assert.deepEqual(cerrar({ tipos: null, sinTiposPedido: true }).palabra, 'PARCIAL', '--sin-tipos a propósito: sale 0 pero tampoco es VERDE');
  assert.equal(cerrar({ tipos: null, sinTiposPedido: true }).codigo, 0);
  const r = cerrar({ rojos: ['tests: a.test.ts'], tipos: sin });
  assert.equal(r.palabra, 'ROJO', 'un rojo manda sobre SIN TIPOS');
  assert.equal(r.codigo, 1);
  assert.match(r.detalle, /a\.test\.ts[\s\S]*además, SIN TIPOS: no hay RAM/, 'y no esconde que los tipos tampoco se chequearon');
  assert.equal(cerrar({ rojos: ['tipos: 1 errores (tests/x.test.ts)'], tipos: { estado: 'rojo' } }).palabra, 'ROJO');
});

// ---------------------------------------------------------------------------
// correrTipos: el estado, con un tsc inyectado
// ---------------------------------------------------------------------------

async function conEntorno<T>(env: Record<string, string>, fn: () => Promise<T>): Promise<T> {
  const antes = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]]));
  Object.assign(process.env, env);
  try { return await fn(); } finally { for (const [k, v] of Object.entries(antes)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } }
}
const FIJO = () => ({ MAKO_TIPOS_LOCK: join(mkdtempSync(join(tmpdir(), 'lock-tipos-')), 'lock'), MAKO_TIPOS_PISO_GB: '0.01' });
const conTsc = (r: { status: number | null; salida: string; error?: string }) => ({ ejecutar: () => r, raiz: REPO_REAL, esperaMs: 2000 });

test('correrTipos: el tsc terminó bien → ok; errores EN LO CAMBIADO → rojo; errores sólo por arrastre → ok y lo avisa; nada que compilar → nada, sin llamar al tsc', async () => {
  await conEntorno(FIJO(), async () => {
    const lineas: string[] = [];
    const ok = await correrTipos(['tests/a.test.ts'], { ...conTsc({ status: 0, salida: '' }), out: (s) => lineas.push(s) });
    assert.equal(ok.estado, 'ok');
    assert.match(lineas.join('\n'), /tipos de 1 archivos sin errores/);

    const rojo = await correrTipos(['tests/a.test.ts', 'lib/b.ts'], conTsc({ status: 2, salida: "tests/a.test.ts(3,7): error TS2322: Type 'string' is not assignable to type 'number'.\nlib/b.ts(1,1): error TS2339: x\n" }));
    assert.equal(rojo.estado, 'rojo');
    assert.equal(rojo.porque, 'tipos: 2 errores (tests/a.test.ts, lib/b.ts)');

    const arrastre = await correrTipos(['tests/a.test.ts'], conTsc({ status: 2, salida: "app/x.ts(1,1): error TS2339: Property 'y' does not exist\n" }));
    assert.equal(arrastre.estado, 'ok', 'un error en un archivo que sólo se compila por arrastre no es de lo cambiado: lo decide el tsc completo de Actions');
    assert.equal(arrastre.arrastre, 1);

    let llamado = false;
    const nada = await correrTipos([], { ejecutar: () => { llamado = true; return { status: 0, salida: '' }; }, raiz: REPO_REAL });
    assert.equal(nada.estado, 'nada');
    assert.equal(llamado, false);
  });
});

test('correrTipos: el tsc MUERTO sin decir un error (lo mató el vigía de RAM, se quedó sin heap, tiempo) NO es un verde ni un rojo: es sin-tipos, con el porqué', async () => {
  await conEntorno(FIJO(), async () => {
    for (const r of [
      { status: 1, salida: '' },                                  // el vigía: exit 1 y ni un byte
      { status: null, salida: '', error: 'spawnSync ETIMEDOUT' },  // el tope de tiempo
      { status: 134, salida: 'FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory\n' },
    ]) {
      const t = await correrTipos(['tests/a.test.ts'], conTsc(r));
      assert.equal(t.estado, 'sin-tipos', JSON.stringify(r));
      assert.match(t.porque ?? '', /no terminó \(código/);
      assert.match(t.porque ?? '', /no es un error de tipos/);
    }
  });
});

test('correrTipos: sin RAM no corre el tsc y dice «no hay RAM» (sin-tipos)', async () => {
  await conEntorno({ ...FIJO(), MAKO_TIPOS_PISO_GB: '999' }, async () => {
    let llamado = false;
    const t = await correrTipos(['tests/a.test.ts'], { ejecutar: () => { llamado = true; return { status: 0, salida: '' }; }, raiz: REPO_REAL, esperaMs: 50 });
    assert.equal(t.estado, 'sin-tipos');
    assert.match(t.porque ?? '', /no hay RAM: quedan [\d.]+ GB y el tsc acotado pide 999\.0/);
    assert.equal(llamado, false, 'ni lo intenta: el vigía lo mataría y arrastraría a otros');
  });
});

// ---------------------------------------------------------------------------
// De punta a punta: el CLI de verdad, en un repo de git de mentira
// ---------------------------------------------------------------------------

/** Un repo de git con un tsconfig estricto, un junction a node_modules (typescript, tsx, @types/node) y un test base commiteado. */
function repoDeMentira(): string {
  const dir = mkdtempSync(join(tmpdir(), 'repo-tipos-'));
  const git = (...args: string[]) => execFileSync('git', ['-c', 'user.name=Prueba', '-c', 'user.email=prueba@example.com', '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', ...args], { cwd: dir, env: limpio(), encoding: 'utf8' });
  git('init', '-q', '-b', 'main');
  writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true, target: 'es2022', module: 'esnext', moduleResolution: 'bundler', noEmit: true, skipLibCheck: true } }));
  symlinkSync(join(REPO_REAL, 'node_modules'), join(dir, 'node_modules'), 'junction');
  writeFileSync(join(dir, '.gitignore'), 'node_modules\n');
  mkdirSync(join(dir, 'tests'));
  writeFileSync(join(dir, 'tests', 'base.test.ts'), "import test from 'node:test';\ntest('base', () => {});\n");
  git('add', '-A'); git('commit', '-q', '-m', 'base');
  return dir;
}
function agregarYCommitear(dir: string, archivo: string, texto: string) {
  const git = (...args: string[]) => execFileSync('git', ['-c', 'user.name=Prueba', '-c', 'user.email=prueba@example.com', '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', ...args], { cwd: dir, env: limpio(), encoding: 'utf8' });
  writeFileSync(join(dir, archivo), texto);
  git('add', '-A'); git('commit', '-q', '-m', `cambio ${archivo}`);
}
/** Corre `node scripts/tests-afectados.mjs --base HEAD~1 …` en ese repo; sin CI (ahí no se miran los tipos) y con el piso de RAM y el lock de la prueba. */
function correrCli(dir: string, args: string[], extra: NodeJS.ProcessEnv = {}) {
  const r = spawnSync(process.execPath, [TESTS_AFECTADOS, '--base', 'HEAD~1', ...args], {
    cwd: dir, encoding: 'utf8', timeout: 240_000,
    env: limpio({ CI: '', MAKO_TIPOS_LOCK: join(dir, '.lock-tipos'), MAKO_TIPOS_PISO_GB: '0.05', MAKO_TESTS_SIN_ESPERA: '1', MAKO_TIPOS_ESPERA_S: '60', MAKO_SIN_TIPOS: '', ...extra }),
  });
  const salida = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  // El veredicto sale por stdout; los avisos de espera de RAM, por stderr: juntarlos uno detrás del otro pone los avisos al final, y en una terminal van intercalados por la hora.
  return { codigo: r.status, salida, ultima: (r.stdout ?? '').trim().split('\n').pop() ?? '' };
}

const TEST_BUENO = "import test from 'node:test';\nimport assert from 'node:assert/strict';\ntest('anda', () => { assert.equal(1 + 1, 2); });\n";
// Corre perfecto con tsx (tsx sólo quita los tipos) y NO compila con tsc: el error exacto que cayó en Actions cuatro veces el 21/10.
const TEST_CON_ERROR_DE_TIPOS = "import test from 'node:test';\nconst cuenta: number = 'esto no es un número';\ntest('anda', () => { void cuenta; });\n";

test('DE PUNTA A PUNTA: un test NUEVO con un error de tipos da ROJO en tests-afectados, aunque como test corra perfecto; uno sano da VERDE con sus tipos', () => {
  const dir = repoDeMentira();
  try {
    agregarYCommitear(dir, 'tests/malo.test.ts', TEST_CON_ERROR_DE_TIPOS);
    const rojo = correrCli(dir, []);
    assert.equal(rojo.codigo, 1, rojo.salida);
    assert.match(rojo.salida, /tests en verde/, 'como TEST corre bien (tsx no chequea tipos): ésa es la trampa');
    assert.match(rojo.salida, /tests\/malo\.test\.ts\(\d+,\d+\): error TS2322/, 'y el tsc acotado muestra el error');
    assert.match(rojo.ultima, /^ROJO: tipos: 1 errores \(tests\/malo\.test\.ts\)/, `la ÚLTIMA línea: ${rojo.ultima}`);

    agregarYCommitear(dir, 'tests/malo.test.ts', TEST_BUENO);
    const verde = correrCli(dir, []);
    assert.equal(verde.codigo, 0, verde.salida);
    assert.match(verde.ultima, /^VERDE · tipos de 1 archivos sin errores · 1 tests de 1 archivos/, `la última línea: ${verde.ultima}`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('DE PUNTA A PUNTA: si los tipos NO se pueden chequear (sin RAM) la línea final es «SIN TIPOS: …» y sale 98, no VERDE; con --sin-tipos es PARCIAL (0) y tampoco es VERDE', () => {
  const dir = repoDeMentira();
  try {
    agregarYCommitear(dir, 'tests/malo.test.ts', TEST_CON_ERROR_DE_TIPOS);
    // MAKO_TESTS_SIN_ESPERA='' : esa variable dice «corro igual aunque no haya RAM» y valdría también para los tipos; acá hay que dejar que la falta de RAM se vea.
    const sinRam = correrCli(dir, [], { MAKO_TIPOS_PISO_GB: '999', MAKO_TIPOS_ESPERA_S: '1', MAKO_TESTS_SIN_ESPERA: '' });
    assert.equal(sinRam.codigo, SALIDA_SIN_TIPOS, sinRam.salida);
    assert.match(sinRam.ultima, /^SIN TIPOS: no hay RAM: quedan [\d.]+ GB y el tsc acotado pide 999\.0/, `la última línea: ${sinRam.ultima}`);
    assert.doesNotMatch(sinRam.salida, /^VERDE/m, 'en ningún momento dice VERDE');
    assert.match(sinRam.salida, /tests en verde/, 'los tests sí se corrieron y dieron verde: lo que falta son los tipos');

    const aProposito = correrCli(dir, ['--sin-tipos']);
    assert.equal(aProposito.codigo, 0, aProposito.salida);
    assert.match(aProposito.ultima, /^PARCIAL \(sin tipos \(--sin-tipos\)/, `la última línea: ${aProposito.ultima}`);
    assert.doesNotMatch(aProposito.salida, /^VERDE/m, '--sin-tipos no se disfraza de VERDE');
    assert.doesNotMatch(aProposito.salida, /error TS2322/, 'y no miró los tipos: por eso el error de tipos pasa — a propósito');

    const porEntorno = correrCli(dir, [], { MAKO_SIN_TIPOS: '1' });
    assert.match(porEntorno.ultima, /^PARCIAL/, 'MAKO_SIN_TIPOS=1 equivale a --sin-tipos');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

/** antes-de-subir en ese repo: sin el candado de lo pesado (MAKO_SIN_COLA), sin fetch ni condiciones de árbol limpio, y con unas guardas de mentira que dan verde. */
function correrAntesDeSubir(dir: string, args: string[], extra: NodeJS.ProcessEnv = {}) {
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  writeFileSync(join(dir, 'scripts', 'guardas-push.sh'), 'exit 0\n');
  const r = spawnSync(process.execPath, [join(REPO_REAL, 'scripts', 'antes-de-subir.mjs'), '--base', 'HEAD~1', '--sin-fetch', '--sin-condiciones', ...args], {
    cwd: dir, encoding: 'utf8', timeout: 240_000,
    env: limpio({ CI: '', MAKO_SIN_COLA: '1', MAKO_TIPOS_LOCK: join(dir, '.lock-tipos'), MAKO_TIPOS_PISO_GB: '0.05', MAKO_TESTS_SIN_ESPERA: '1', MAKO_TIPOS_ESPERA_S: '60', MAKO_SIN_TIPOS: '', ...extra }),
  });
  return { codigo: r.status, salida: `${r.stdout ?? ''}${r.stderr ?? ''}`, ultima: (r.stdout ?? '').trim().split('\n').pop() ?? '' };
}

test('DE PUNTA A PUNTA con antes-de-subir (el VERDE que se le pasa al Cerebro): error de tipos → ROJO; sin RAM → SIN TIPOS (98), nunca VERDE; --sin-tipos → PARCIAL; sano → VERDE <sha>', () => {
  const dir = repoDeMentira();
  try {
    agregarYCommitear(dir, 'tests/malo.test.ts', TEST_CON_ERROR_DE_TIPOS);
    const rojo = correrAntesDeSubir(dir, ['--rapido']);
    assert.equal(rojo.codigo, 1, rojo.salida);
    assert.match(rojo.ultima, /^ROJO: tipos: 1 errores \(tests\/malo\.test\.ts\)/, `la última línea: ${rojo.ultima}`);

    // Sin RAM para los tipos: ANTES esto terminaba en «VERDE <sha> (rápido: sin tipos…)» — el disfraz que dejó pasar cuatro errores de tipos a Actions.
    const sinRam = correrAntesDeSubir(dir, ['--rapido'], { MAKO_TIPOS_PISO_GB: '999', MAKO_TIPOS_ESPERA_S: '1', MAKO_TESTS_SIN_ESPERA: '' });
    assert.equal(sinRam.codigo, SALIDA_SIN_TIPOS, sinRam.salida);
    assert.match(sinRam.ultima, /^SIN TIPOS: no hay RAM/, `la última línea: ${sinRam.ultima}`);
    assert.doesNotMatch(sinRam.salida, /^VERDE/m, 'ni una línea que diga VERDE');

    const aProposito = correrAntesDeSubir(dir, ['--rapido', '--sin-tipos']);
    assert.equal(aProposito.codigo, 0, aProposito.salida);
    assert.match(aProposito.ultima, /^PARCIAL \(sin tipos \(--sin-tipos\)/, `la última línea: ${aProposito.ultima}`);
    assert.doesNotMatch(aProposito.salida, /^VERDE/m);

    agregarYCommitear(dir, 'tests/malo.test.ts', TEST_BUENO);
    const verde = correrAntesDeSubir(dir, ['--rapido']);
    assert.equal(verde.codigo, 0, verde.salida);
    assert.match(verde.ultima, /^VERDE [0-9a-f]{7,40} \(rápido: tipos de lo cambiado sí/, `la última línea: ${verde.ultima}`);
    assert.match(verde.salida, /tipos de 1 archivos sin errores/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('DE PUNTA A PUNTA: en Actions (CI) y con --resto no se corren los tipos: ahí está el paso «Tipos», y la salida es la de siempre', () => {
  const dir = repoDeMentira();
  try {
    agregarYCommitear(dir, 'tests/malo.test.ts', TEST_CON_ERROR_DE_TIPOS);
    const ci = correrCli(dir, [], { CI: 'true' });
    assert.equal(ci.codigo, 0, ci.salida);
    assert.match(ci.salida, /\[tests-afectados\] ✔ VERDE · 1 tests de 1 archivos/, 'el formato de siempre');
    assert.doesNotMatch(ci.salida, /tipos \(tsc acotado/, 'sin la etapa de tipos');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('el hook de pre-push (la copia versionada) distingue el 98 de un rojo y el PARCIAL de un verde', () => {
  const hook = readFileSync(join(REPO_REAL, 'scripts', 'claude-hooks', 'pre-push'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(hook, /if \[ "\$ANTES" -eq 98 \]; then[\s\S]*?PUSH BLOQUEADO: SIN TIPOS[\s\S]*?exit 1/, 'un 98 bloquea el push, y dice que NO es un rojo del código');
  assert.match(hook, /MAKO_SIN_TIPOS=1/, 'y dice cómo seguir a propósito');
  assert.match(hook, /PARCIAL\*\) echo "\[pre-push\] ⚠ antes-de-subir PARCIAL/, 'un PARCIAL no se anuncia como «en verde»');
});

// =============================================================================
// ⚠️ PROBADO ROMPIÉNDOLO (21/10/2026; se rompe UNA pieza, se corren estas pruebas, se restaura): 16 roturas, 16 rojas. Detalle en docs/hallazgos-infra.md («tsx no chequea tipos…»).
//   `cerrar` (5): sin tipos disfrazado de VERDE (lo que pasaba) → 3 rojas · SIN TIPOS que sale 0 → 2 · un rojo que no manda sobre SIN TIPOS → 1 · `--sin-tipos` llamado VERDE → 3 · un rojo
//     que esconde que los tipos tampoco se chequearon → 1.
//   `correrTipos` (4): un tsc muerto sin error dado por ok → 1 · sin RAM que corre igual → 3 · los errores del alcance que no cuentan → 3 · un error de arrastre que frena → 1.
//   `tests-afectados` (3): no corre los tipos por default → 2 · `--sin-tipos` que no cambia la palabra → 1 · los tipos que corren también en Actions (CI) → 1.
//     (La primera versión de esta última rotura tocaba otra línea y salió VERDE: no era una rotura de verdad, y por eso se repitió bien.)
//   `antes-de-subir` (4): `--rapido` que no mira los tipos → 1 · SIN TIPOS que vuelve a salir como VERDE → 1 · SIN TIPOS que sale 0 → 1 · un error de tipos que no entra a los rojos → 1.
// =============================================================================
