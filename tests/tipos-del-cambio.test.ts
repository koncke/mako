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
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { alcanceTsc, cerrar, correrTipos, especificadoresConTipos, planDeTipos, reexportaciones, salidaSinRam, SALIDA_SIN_TIPOS, seleccionar, tiposNoAcotables } from '../scripts/tests-afectados.mjs';
import { armarTsconfig, dtsVersionados, GLOBALES_DE_NEXT } from '../scripts/tsc-acotado.mjs';

const REPO_REAL = fileURLToPath(new URL('..', import.meta.url));
const TESTS_AFECTADOS = join(REPO_REAL, 'scripts', 'tests-afectados.mjs');

// Sin un git del entorno heredado (el índice temporal con el que antes-de-subir corre los tests): los repos de mentira usan el suyo.
const limpio = (extra: Record<string, string> = {}): NodeJS.ProcessEnv => {
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
  writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true, target: 'es2022', module: 'esnext', moduleResolution: 'bundler', noEmit: true, skipLibCheck: true, allowJs: true, jsx: 'react-jsx' } }));
  symlinkSync(join(REPO_REAL, 'node_modules'), join(dir, 'node_modules'), 'junction');
  writeFileSync(join(dir, '.gitignore'), 'node_modules\n');
  mkdirSync(join(dir, 'tests'));
  writeFileSync(join(dir, 'tests', 'base.test.ts'), "import test from 'node:test';\ntest('base', () => {});\n");
  git('add', '-A'); git('commit', '-q', '-m', 'base');
  return dir;
}
function agregarYCommitear(dir: string, archivo: string, texto: string) {
  const git = (...args: string[]) => execFileSync('git', ['-c', 'user.name=Prueba', '-c', 'user.email=prueba@example.com', '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', ...args], { cwd: dir, env: limpio(), encoding: 'utf8' });
  mkdirSync(dirname(join(dir, archivo)), { recursive: true });
  writeFileSync(join(dir, archivo), texto);
  git('add', '-A'); git('commit', '-q', '-m', `cambio ${archivo}`);
}
/** Corre `node scripts/tests-afectados.mjs --base HEAD~1 …` en ese repo; sin CI (ahí no se miran los tipos) y con el piso de RAM y el lock de la prueba. */
function correrCli(dir: string, args: string[], extra: Record<string, string> = {}) {
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
function correrAntesDeSubir(dir: string, args: string[], extra: Record<string, string> = {}) {
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
// La revisión del 21/10/2026 (efa346252): lo que el tsc acotado NO veía
// =============================================================================
// 1. Un test SIN TOCAR que dependía de lo cambiado (run 187: cambió un TIPO de lib/ y tests/m-mako-chat.test.ts dejó de compilar): nadie importa un test, así que nunca entraba al
//    programa. Y m-mako-chat importaba ese tipo sólo con `import type`, que el grafo de ejecución ignora.
// 2. Los .d.ts propios del repo (tono.ts → soundtouchjs.d.ts, color-picker → eyedropper.d.ts): el acotado daba un ROJO FALSO en el archivo cambiado.
// 3. Un cambio que sólo toca tsconfig, package.json, un .d.ts o un .mjs daba alcance vacío → «nada» → VERDE (el mecanismo del run 173).
// 4. archivoDe cortaba la ruta en el primer «(»: un grupo de rutas de Next (`app/(publico)/…`) o un error sin archivo contaban como arrastre y daban VERDE.
// 5. tests-afectados perdía un ROJO de tipos si después los tests no tenían RAM (salía 99, «no es un rojo del código»).

const FUENTES_187: Record<string, string> = {
  'lib/reglas.ts': 'export type Propuesta = { boton: string };\n',
  'app/chat-ui.ts': "import type { Propuesta } from '../lib/reglas';\nexport const x = 1;\nexport type { Propuesta };\n",
  'tests/directo-tipos.test.ts': "import test from 'node:test';\nimport type { Propuesta } from '../lib/reglas';\ntest('d', () => { const p: Propuesta = { boton: 'a' }; void p; });\n",
  'tests/por-cadena.test.ts': "import test from 'node:test';\nimport { x } from '../app/chat-ui';\ntest('c', () => { void x; });\n",
  'tests/ajeno.test.ts': "import test from 'node:test';\ntest('a', () => {});\n",
};
const sel187 = () => seleccionar({ cambiados: ['lib/reglas.ts'], archivos: Object.keys(FUENTES_187), leer: (r: string) => FUENTES_187[r] ?? null });

test('seleccionar: el grafo de TIPOS ve el import type que el de ejecución ignora (run 187)', () => {
  const sel = sel187();
  assert.deepEqual([...(sel.importadoPor.get('lib/reglas.ts') ?? [])], [], 'por ejecución nadie importa reglas.ts: sólo se importa como tipo');
  assert.deepEqual([...(sel.importadoPorTipos.get('lib/reglas.ts') ?? [])].sort(), ['app/chat-ui.ts', 'tests/directo-tipos.test.ts']);
  assert.deepEqual(especificadoresConTipos("import type { A } from './a';\nimport { b } from './b';\nexport type { C } from './c';\n").sort(), ['./a', './b', './c']);
});

test('alcanceTsc: los tests que importan DIRECTO lo cambiado entran al alcance, los toque el cambio o no (también si lo importan sólo como tipo); con más saltos, la cadena', () => {
  const sel = sel187();
  const archivos = Object.keys(FUENTES_187);
  const con = alcanceTsc({ cambiados: ['lib/reglas.ts'], archivos, importadoPor: sel.importadoPor, importadoPorTipos: sel.importadoPorTipos, aumentan: sel.aumentan });
  assert.deepEqual(con, ['lib/reglas.ts', 'tests/directo-tipos.test.ts'], 'un salto: el test que importa el tipo DIRECTO (el 187); no el que llega por chat-ui ni el ajeno');
  const dos = alcanceTsc({ cambiados: ['lib/reglas.ts'], archivos, importadoPor: sel.importadoPor, importadoPorTipos: sel.importadoPorTipos, aumentan: sel.aumentan, profundidadTests: 2 });
  assert.deepEqual(dos, ['lib/reglas.ts', 'tests/directo-tipos.test.ts', 'tests/por-cadena.test.ts'], 'con dos saltos entra también el que llega por la cadena, y NUNCA el ajeno');
  const sin = alcanceTsc({ cambiados: ['lib/reglas.ts'], archivos, importadoPor: sel.importadoPor, aumentan: sel.aumentan });
  assert.deepEqual(sin, ['lib/reglas.ts'], 'sin el grafo de tipos pasaba lo del run 187: el alcance era sólo lo cambiado');
});

test('alcanceTsc: un archivo BORRADO suma a quienes lo importaban (son los que se rompen)', () => {
  const fuentes: Record<string, string> = { 'app/usa.ts': "import { v } from '../lib/viejo';\nexport const w = v;\n", 'app/otro.ts': 'export const o = 1;\n' };
  const sel = seleccionar({ cambiados: ['lib/viejo.ts'], archivos: Object.keys(fuentes), leer: (r: string) => fuentes[r] ?? null });
  const alcance = alcanceTsc({ cambiados: ['lib/viejo.ts'], archivos: Object.keys(fuentes), importadoPor: sel.importadoPor, importadoPorTipos: sel.importadoPorTipos, aumentan: sel.aumentan });
  assert.deepEqual(alcance, ['app/usa.ts']);
});

test('planDeTipos junta el alcance y lo que no se puede acotar, y tiposNoAcotables mira tsconfig, package.json y los .d.ts (sólo los de la raíz)', () => {
  assert.deepEqual(
    tiposNoAcotables(['tsconfig.json', 'package.json', 'package-lock.json', 'tsconfig.build.json', 'types/x.d.ts', 'scripts/tsconfig.bitacoras.json', 'packages/x/package.json', 'app/a.ts', 'docs/package.json.md']),
    ['package-lock.json', 'package.json', 'tsconfig.build.json', 'tsconfig.json', 'types/x.d.ts'],
  );
  const sel = sel187();
  const p = planDeTipos({ cambiados: ['lib/reglas.ts', 'package.json'], archivos: Object.keys(FUENTES_187), sel });
  assert.deepEqual(p.noAcotables, ['package.json']);
  assert.ok(p.alcance.includes('tests/directo-tipos.test.ts'));
});

test('correrTipos con noAcotables: un acotado verde NO es verde si cambió tsconfig/package.json/.d.ts (sin-tipos); un rojo sigue siendo rojo', async () => {
  await conEntorno(FIJO(), async () => {
    const lineas: string[] = [];
    const ok = await correrTipos(['tests/a.test.ts'], { ...conTsc({ status: 0, salida: '' }), noAcotables: ['package.json'], out: (s: string) => lineas.push(s) });
    assert.equal(ok.estado, 'sin-tipos');
    assert.match(ok.porque ?? '', /^cambió package\.json: define tipos para todo el repo/);
    assert.match(lineas.join('\n'), /SIN TIPOS: cambió package\.json/);
    const nada = await correrTipos([], { ejecutar: () => ({ status: 0, salida: '' }), raiz: REPO_REAL, noAcotables: ['tsconfig.json', 'types/x.d.ts'] });
    assert.equal(nada.estado, 'sin-tipos', 'alcance vacío + tsconfig cambiado ya no es «nada» → VERDE');
    assert.match(nada.porque ?? '', /cambió tsconfig\.json, types\/x\.d\.ts/);
    const rojo = await correrTipos(['tests/a.test.ts'], { ...conTsc({ status: 2, salida: 'tests/a.test.ts(1,1): error TS2322: x\n' }), noAcotables: ['package.json'] });
    assert.equal(rojo.estado, 'rojo', 'un rojo manda');
    const sinNada = await correrTipos([], { ejecutar: () => ({ status: 0, salida: '' }), raiz: REPO_REAL });
    assert.equal(sinNada.estado, 'nada', 'sin noAcotables todo sigue igual');
  });
});

test('correrTipos: una ruta con grupo de Next «(publico)» y un error SIN archivo cuentan como errores del alcance, no como arrastre', async () => {
  await conEntorno(FIJO(), async () => {
    const grupo = await correrTipos(['app/(publico)/precios/page.tsx'], conTsc({ status: 2, salida: "app/(publico)/precios/page.tsx(3,7): error TS2322: Type 'string' is not assignable to type 'number'.\n" }));
    assert.equal(grupo.estado, 'rojo', 'antes la ruta se cortaba en «app/» y el error pasaba por arrastre → VERDE');
    assert.match(grupo.porque ?? '', /\(app\/\(publico\)\/precios\/page\.tsx\)/);
    const global = await correrTipos(['app/a.ts'], conTsc({ status: 1, salida: "error TS5023: Unknown compiler option 'estrictoo'.\n" }));
    assert.equal(global.estado, 'rojo', 'un error del programa entero no es de ningún archivo suelto');
    assert.match(global.porque ?? '', /\(\(sin archivo\)\)/);
    const arrastre = await correrTipos(['app/a.ts'], conTsc({ status: 2, salida: 'app/(otro)/y.ts(1,1): error TS2339: x\n' }));
    assert.equal(arrastre.estado, 'ok', 'y un error en un archivo con grupo que NO es del alcance sigue siendo arrastre');
    assert.equal(arrastre.arrastre, 1);
  });
});

test('salidaSinRam: un ROJO de tipos gana sobre «los tests no tuvieron RAM» (sale 1, no 99)', () => {
  const rojo = salidaSinRam({ estado: 'rojo', porque: 'tipos: 1 errores (tests/x.test.ts)' });
  assert.equal(rojo.codigo, 1);
  assert.match(rojo.linea ?? '', /^ROJO: tipos: 1 errores \(tests\/x\.test\.ts\) · \(además, los tests no corrieron: no había RAM\)/);
  for (const t of [null, { estado: 'ok' }, { estado: 'nada' }, { estado: 'sin-tipos', porque: 'x' }]) {
    const s = salidaSinRam(t);
    assert.equal(s.codigo, 99, JSON.stringify(t));
    assert.equal(s.linea, null);
  }
});

test('armarTsconfig suma los .d.ts propios a files, y dtsVersionados lista sólo los que git tiene', () => {
  const dir = repoDeMentira();
  try {
    agregarYCommitear(dir, 'types/foo.d.ts', "declare module 'foo-sin-tipos' { export const v: number; }\n");
    writeFileSync(join(dir, 'types', 'sin-versionar.d.ts'), 'export {};\n');
    assert.deepEqual(dtsVersionados(dir), ['types/foo.d.ts'], 'el que no está en git no entra');
    const c = armarTsconfig(dir, ['tests/base.test.ts'], { dts: dtsVersionados(dir) });
    assert.ok(c.files.some((f: string) => f.endsWith('/types/foo.d.ts')), 'el .d.ts propio está en files');
    assert.ok(c.files.some((f: string) => f.endsWith('/tests/base.test.ts')));
    assert.ok(!armarTsconfig(dir, ['tests/base.test.ts']).files.some((f: string) => f.endsWith('/types/foo.d.ts')), 'sin dts no cambia nada (compatibilidad)');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('DE PUNTA A PUNTA (run 187): cambia un TIPO y un test SIN TOCAR que sólo lo importa como tipo deja de compilar → ROJO, aunque como test corra perfecto', () => {
  const dir = repoDeMentira();
  try {
    agregarYCommitear(dir, 'tests/usa.test.ts', "import test from 'node:test';\nimport type { P } from '../lib/tipo';\nconst p: P = { a: 'x' };\ntest('usa', () => { void p; });\n");
    agregarYCommitear(dir, 'lib/tipo.ts', 'export type P = { a: string };\n');
    agregarYCommitear(dir, 'lib/tipo.ts', 'export type P = { a: string; b: number };\n');   // el test NO se toca
    const r = correrCli(dir, []);
    assert.equal(r.codigo, 1, r.salida);
    assert.match(r.salida, /tests\/usa\.test\.ts\(\d+,\d+\): error TS2741/, 'el tsc acotado muestra el error del test que no cambió');
    assert.match(r.ultima, /^ROJO: tipos: 1 errores \(tests\/usa\.test\.ts\)/, 'la línea final: ' + r.ultima);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('DE PUNTA A PUNTA (run 173): cambia sólo un .mjs y el test .ts que lo importa (sin tocar) deja de compilar → ROJO', () => {
  const dir = repoDeMentira();
  try {
    agregarYCommitear(dir, 'scripts/h.mjs', 'export const cfg = { n: 1 };\n');
    agregarYCommitear(dir, 'tests/usa-mjs.test.ts', "import test from 'node:test';\nimport { cfg } from '../scripts/h.mjs';\nconst n: number = cfg.n;\ntest('usa', () => { void n; });\n");
    agregarYCommitear(dir, 'scripts/h.mjs', "export const cfg = { n: 'uno' };\n");   // sólo el .mjs
    const r = correrCli(dir, []);
    assert.equal(r.codigo, 1, r.salida);
    assert.match(r.ultima, /^ROJO: tipos: 1 errores \(tests\/usa-mjs\.test\.ts\)/, 'la línea final: ' + r.ultima);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('DE PUNTA A PUNTA: un archivo que depende de un .d.ts propio que no importa NO da un ROJO falso (el acotado ya lo ve)', () => {
  const dir = repoDeMentira();
  try {
    agregarYCommitear(dir, 'types/foo.d.ts', "declare module 'foo-sin-tipos' { export const v: number; }\n");
    agregarYCommitear(dir, 'app/usa-foo.ts', "import { v } from 'foo-sin-tipos';\nexport const w: number = v;\n");
    agregarYCommitear(dir, 'app/usa-foo.ts', "import { v } from 'foo-sin-tipos';\nexport const w: number = v + 1;\n");
    const r = correrCli(dir, []);
    assert.equal(r.codigo, 0, r.salida);
    assert.doesNotMatch(r.salida, /TS2307|TS7016/, 'sin el .d.ts en files esto era «Cannot find module» en el archivo cambiado');
    assert.match(r.ultima, /^VERDE · tipos de 1 archivos sin errores/, 'la línea final: ' + r.ultima);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('DE PUNTA A PUNTA: si sólo cambia tsconfig.json la línea NO es VERDE: es «SIN TIPOS: cambió tsconfig.json…» (98); con --sin-tipos, PARCIAL', () => {
  const dir = repoDeMentira();
  try {
    const cfg = JSON.parse(readFileSync(join(dir, 'tsconfig.json'), 'utf8'));
    agregarYCommitear(dir, 'tsconfig.json', JSON.stringify({ compilerOptions: { ...cfg.compilerOptions, noUnusedLocals: true } }));
    const r = correrCli(dir, []);
    assert.equal(r.codigo, SALIDA_SIN_TIPOS, r.salida);
    assert.match(r.ultima, /^SIN TIPOS: cambió tsconfig\.json: define tipos para todo el repo/, 'la línea final: ' + r.ultima);
    assert.doesNotMatch(r.salida, /^VERDE/m);
    const aProposito = correrCli(dir, ['--sin-tipos']);
    assert.match(aProposito.ultima, /^PARCIAL/);
    assert.equal(aProposito.codigo, 0);
    // y antes-de-subir —el VERDE que se le pasa al Cerebro— dice lo mismo: no hay un VERDE <sha> con un tsconfig cambiado
    const antes = correrAntesDeSubir(dir, ['--rapido']);
    assert.equal(antes.codigo, SALIDA_SIN_TIPOS, antes.salida);
    assert.match(antes.ultima, /^SIN TIPOS: cambió tsconfig\.json/, 'la última línea: ' + antes.ultima);
    assert.doesNotMatch(antes.salida, /^VERDE/m);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('DE PUNTA A PUNTA: tipos en ROJO y los tests sin RAM → ROJO (1), no 99 «no es un rojo del código»', () => {
  const dir = repoDeMentira();
  try {
    agregarYCommitear(dir, 'tests/malo.test.ts', TEST_CON_ERROR_DE_TIPOS);
    // Los tipos entran (su piso es bajo) y dan rojo; después los TESTS esperan una RAM que no hay (piso 999 GB, 1 s de espera).
    const r = correrCli(dir, [], { MAKO_TESTS_SIN_ESPERA: '', MAKO_TESTS_PISO_GB: '999', MAKO_TESTS_ESPERA_S: '1' });
    assert.match(r.salida, /NO CORRÍ LOS TESTS: NO HAY RAM/, 'los tests no tuvieron RAM: ' + r.salida);
    assert.equal(r.codigo, 1, r.salida);
    assert.match(r.ultima, /^ROJO: tipos: 1 errores \(tests\/malo\.test\.ts\) · \(además, los tests no corrieron: no había RAM\)/, 'la línea final: ' + r.ultima);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// =============================================================================
// La revisión v2 del 21/10/2026 (2b8edc128): lo que el acotado todavía no veía o decía mal
// =============================================================================
// 1. `<style jsx>` daba un ROJO FALSO (TS2322 «jsx no existe en StyleHTMLAttributes»): el acotado no cargaba los tipos de styled-jsx, que el tsc completo trae por next-env.d.ts.
// 2. Los AYUDANTES de tests (`tests/_*.ts`) no entraban al alcance aunque importaran DIRECTO lo cambiado: el mismo mecanismo del run 187.
// 3. Un SIN TIPOS por package.json / tsconfig / un .d.ts mandaba a «liberar RAM y repetir», que no cambia nada: ahí hay que decir tsc completo o --sin-tipos.
// 4. (Mejora) Atravesar un RE-EXPORT no cuenta como un salto: un test que importa el barril depende del tipo original.

test('GLOBALES_DE_NEXT: cada archivo que el acotado carga existe en el node_modules REAL (si un upgrade de next lo mueve, los falsos rojos vuelven en silencio)', () => {
  assert.ok(GLOBALES_DE_NEXT.includes('node_modules/next/dist/styled-jsx/types/index.d.ts'), 'los tipos de styled-jsx están en la lista');
  for (const rel of GLOBALES_DE_NEXT) assert.ok(existsSync(join(REPO_REAL, rel)), `${rel} existe`);
});

const ESTILO_JSX = "export const Estilo = () => (\n  <div>\n    <style jsx>{`div { color: red; }`}</style>\n  </div>\n);\n";

test('DE PUNTA A PUNTA: un .tsx con <style jsx> NO da un ROJO falso (el acotado carga los tipos de styled-jsx)', () => {
  const dir = repoDeMentira();
  try {
    agregarYCommitear(dir, 'app/Estilo.tsx', ESTILO_JSX);
    const r = correrCli(dir, []);
    assert.equal(r.codigo, 0, r.salida);
    assert.doesNotMatch(r.salida, /TS2322|StyleHTMLAttributes/, 'sin los tipos de styled-jsx esto era un error de un archivo que el tsc completo da por bueno');
    assert.match(r.ultima, /^VERDE · tipos de 1 archivos sin errores/, 'la línea final: ' + r.ultima);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('alcanceTsc: los AYUDANTES de tests (tests/_*.ts) que importan DIRECTO lo cambiado entran al alcance, como los tests; lo que no está en la raíz de tests/, no', () => {
  const fuentes: Record<string, string> = {
    'lib/tipo.ts': 'export type P = { a: string };\n',
    'tests/_ayuda.ts': "import type { P } from '../lib/tipo';\nexport const p: P = { a: 'x' };\n",
    'tests/uno.test.ts': "import { p } from './_ayuda';\nvoid p;\n",
    'tests/sub/otro.ts': "import type { P } from '../../lib/tipo';\nexport const q: P = { a: 'y' };\n",
    'tests/ajeno.test.ts': 'export {};\n',
  };
  const archivos = Object.keys(fuentes);
  const sel = seleccionar({ cambiados: ['lib/tipo.ts'], archivos, leer: (r: string) => fuentes[r] ?? null });
  const alcance = alcanceTsc({ cambiados: ['lib/tipo.ts'], archivos, importadoPor: sel.importadoPor, importadoPorTipos: sel.importadoPorTipos, reexportadoPor: sel.reexportadoPor, aumentan: sel.aumentan });
  assert.deepEqual(alcance, ['lib/tipo.ts', 'tests/_ayuda.ts'], 'el ayudante sí; el test que lo importa está a dos saltos (no); el de la subcarpeta no es de la raíz de tests/');
});

test('DE PUNTA A PUNTA: cambia un TIPO y un ayudante de tests SIN TOCAR deja de compilar → ROJO', () => {
  const dir = repoDeMentira();
  try {
    agregarYCommitear(dir, 'tests/_ayuda.ts', "import type { P } from '../lib/tipo';\nexport const p: P = { a: 'x' };\n");
    agregarYCommitear(dir, 'lib/tipo.ts', 'export type P = { a: string };\n');
    agregarYCommitear(dir, 'lib/tipo.ts', 'export type P = { a: string; b: number };\n');   // el ayudante NO se toca
    const r = correrCli(dir, []);
    assert.equal(r.codigo, 1, r.salida);
    assert.match(r.ultima, /^ROJO: tipos: 1 errores \(tests\/_ayuda\.ts\)/, 'la línea final: ' + r.ultima);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('reexportaciones: lee los `export … from` y nada más', () => {
  const src = [
    "export * from './a';", "export * as ns from './b';", "export { x, y as z } from './c';", "export type { T } from './d';",
    "export {\n  uno,\n  dos,\n} from './e';",
    "export const k = 1;", "export { local };", "import { i } from './f';", "import type { J } from './g';",
  ].join('\n');
  assert.deepEqual(reexportaciones(src).sort(), ['./a', './b', './c', './d', './e']);
});

test('alcanceTsc: atravesar un RE-EXPORT no cuenta como un salto (un test que importa el barril entra); una cadena de imports comunes, sí cuenta', () => {
  const fuentes: Record<string, string> = {
    'lib/tipos.ts': 'export type P = { a: string };\n',
    'lib/barril.ts': "export * from './tipos';\n",
    'lib/medio.ts': "import type { P } from './tipos';\nexport const m = (p: P) => p;\n",
    'tests/por-barril.test.ts': "import type { P } from '../lib/barril';\nexport const x: P = { a: '1' };\n",
    'tests/por-medio.test.ts': "import { m } from '../lib/medio';\nvoid m;\n",
  };
  const archivos = Object.keys(fuentes);
  const sel = seleccionar({ cambiados: ['lib/tipos.ts'], archivos, leer: (r: string) => fuentes[r] ?? null });
  const alc = (extra: object = {}) => alcanceTsc({ cambiados: ['lib/tipos.ts'], archivos, importadoPor: sel.importadoPor, importadoPorTipos: sel.importadoPorTipos, reexportadoPor: sel.reexportadoPor, aumentan: sel.aumentan, ...extra });
  assert.deepEqual(alc(), ['lib/tipos.ts', 'tests/por-barril.test.ts'], 'el test del barril entra con un salto; el de «medio» (un import común: dos saltos) no');
  assert.deepEqual(alc({ reexportadoPor: null }), ['lib/tipos.ts'], 'sin saber de los re-exports el barril cuenta como un salto más: el test queda a dos');
  assert.deepEqual(alc({ profundidadTests: 2 }), ['lib/tipos.ts', 'tests/por-barril.test.ts', 'tests/por-medio.test.ts'], 'con dos saltos entra también el otro');
});

test('DE PUNTA A PUNTA: cambia un tipo, y un test SIN TOCAR que lo importa por un BARRIL deja de compilar → ROJO', () => {
  const dir = repoDeMentira();
  try {
    agregarYCommitear(dir, 'lib/barril.ts', "export * from './tipos';\n");
    agregarYCommitear(dir, 'tests/por-barril.test.ts', "import type { P } from '../lib/barril';\nconst p: P = { a: 'x' };\nvoid p;\n");
    agregarYCommitear(dir, 'lib/tipos.ts', 'export type P = { a: string };\n');
    agregarYCommitear(dir, 'lib/tipos.ts', 'export type P = { a: string; b: number };\n');
    const r = correrCli(dir, []);
    assert.equal(r.codigo, 1, r.salida);
    assert.match(r.ultima, /^ROJO: tipos: 1 errores \(tests\/por-barril\.test\.ts\)/, 'la línea final: ' + r.ultima);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('el SIN TIPOS por un cambio que NO se puede acotar dice la salida de verdad (tsc completo o --sin-tipos), y el de «sin RAM» sigue diciendo liberar RAM', async () => {
  await conEntorno(FIJO(), async () => {
    const noAcotable = await correrTipos([], { ejecutar: () => ({ status: 0, salida: '' }), raiz: REPO_REAL, noAcotables: ['package.json'] });
    assert.equal(noAcotable.estado, 'sin-tipos');
    assert.equal(noAcotable.noAcotable, true, 'la causa queda marcada');
    assert.match(noAcotable.porque ?? '', /^cambió package\.json: define tipos para todo el repo/);
    assert.match(noAcotable.porque ?? '', /corré el tsc completo \(npm run typecheck\), o --sin-tipos y que decida el paso «Tipos» de Actions/);
    const fin = cerrar({ tipos: noAcotable });
    assert.equal(fin.palabra, 'SIN TIPOS');
    assert.equal(fin.codigo, SALIDA_SIN_TIPOS);
    assert.match(fin.detalle, /acá NO hay RAM que liberar/);
    assert.doesNotMatch(fin.detalle, /liberá RAM y repetí/, 'no manda a hacer algo que no cambia nada');
    assert.match(fin.detalle, /el tsc completo, o --sin-tipos \(la línea pasa a PARCIAL\)/);
  });
  const sinRam = cerrar({ tipos: { estado: 'sin-tipos', porque: 'no hay RAM: quedan 0.9 GB y el tsc acotado pide 4.0' } });
  assert.match(sinRam.detalle, /liberá RAM y repetí, o --sin-tipos si lo decidís vos/, 'el de la RAM no cambia');
  assert.doesNotMatch(sinRam.detalle, /NO hay RAM que liberar/);
});

test('el hook de pre-push (la copia versionada) dice, para un 98 por package.json / tsconfig / .d.ts, que NO hay RAM que liberar y cuál es la salida', () => {
  const hook = readFileSync(join(REPO_REAL, 'scripts', 'claude-hooks', 'pre-push'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(hook, /cambió package\.json \/ tsconfig \/ un \.d\.ts»: NO hay RAM que liberar[\s\S]*?npm run typecheck[\s\S]*?MAKO_SIN_TIPOS=1: Actions decide/);
});

// =============================================================================
// ⚠️ PROBADO ROMPIÉNDOLO (21/10/2026; se rompe UNA pieza, se corren estas pruebas, se restaura): 16 roturas, 16 rojas. Detalle en docs/hallazgos-infra.md («tsx no chequea tipos…»).
//   `cerrar` (5): sin tipos disfrazado de VERDE (lo que pasaba) → 3 rojas · SIN TIPOS que sale 0 → 2 · un rojo que no manda sobre SIN TIPOS → 1 · `--sin-tipos` llamado VERDE → 3 · un rojo
//     que esconde que los tipos tampoco se chequearon → 1.
//   `correrTipos` (4): un tsc muerto sin error dado por ok → 1 · sin RAM que corre igual → 3 · los errores del alcance que no cuentan → 3 · un error de arrastre que frena → 1.
//   `tests-afectados` (3): no corre los tipos por default → 2 · `--sin-tipos` que no cambia la palabra → 1 · los tipos que corren también en Actions (CI) → 1.
//     (La primera versión de esta última rotura tocaba otra línea y salió VERDE: no era una rotura de verdad, y por eso se repitió bien.)
//   `antes-de-subir` (4): `--rapido` que no mira los tipos → 1 · SIN TIPOS que vuelve a salir como VERDE → 1 · SIN TIPOS que sale 0 → 1 · un error de tipos que no entra a los rojos → 1.
// ⚠️ TERCERA VUELTA (la revisión v2, 21/10/2026 noche): 12 roturas, 12 rojas — sin los tipos de styled-jsx → 2 · los ayudantes que no entran → 2 · «ayudante» con subcarpetas → 1 · un re-export contado como salto → 2 · el límite de saltos → 1 · planDeTipos sin los re-exports → 1 ·
//   seleccionar sin registrarlos → 2 · RE_REEXPORT sin `export *` → 2 · el 98 no marcado como no acotable → 1 · el mensaje que vuelve a mandar a liberar RAM → 1 · cerrar sin distinguir la causa → 1 · el hook sin la aclaración → 1.
// ⚠️ SEGUNDA VUELTA (la revisión del Cerebro, 21/10/2026): 22 roturas, 22 rojas.
//   el alcance (10): el grafo de tipos que no se pasa a alcanceTsc → 3 · sin el `import type` en el grafo → 3 · especificadoresConTipos que ignora el import type → 3 · los tests importadores que no entran → 4 ·
//     la búsqueda que sólo parte de los .ts cambiados (se pierde el .mjs del run 173) → 1 · el archivo borrado que no suma a sus importadores → 1 · sin límite de profundidad → 1 · la profundidad por defecto infinita → 1 ·
//     tests-afectados / antes-de-subir que no pasan los no acotables → 1 y 1.
//   lo que no se puede acotar (5): sin los .d.ts → 1 · sin package.json → 1 · un alcance vacío que sigue siendo «nada» → 1 · nunca convierte → 2 · pisa un rojo → 1.
//   archivoDe (2): cortar la ruta en el primer «(» → 1 · un error sin archivo como arrastre → 1.
//   .d.ts propios (3): no entran a files en correrTipos → 1 · armarTsconfig que los ignora → 2 · dtsVersionados que lista lo no versionado → 1.
//   sin RAM (2): salidaSinRam sin el rojo de tipos → 2 · main que no la usa → 1.
// =============================================================================
