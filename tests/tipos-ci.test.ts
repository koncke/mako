// =============================================================================
// El paso «Tipos» de Actions dice QUÉ pasó: errores de tipos, sin memoria, o matado — y mide la memoria en cada run
// =============================================================================
// El 21/10/2026 (run 200, 06ce1cb25) el paso «Tipos» salió con exit 134 a los 297 s, con 5.082 MB de los 5.120 del tope: `heap out of memory`. En GitHub eso se ve IGUAL que un error
// de tipos (un paso rojo y el email «All jobs have failed»): hacía falta leer el log entero para descubrir que el código no tenía la culpa. Y el tope había subido cuatro veces en
// una semana, cada vez después de que un run muriera: el borde se descubría por el email, no por un número.
//
// Lo que se fija acá (scripts/tipos-ci.mjs):
//   · `clasificar`: ok / errores / sin-memoria / matado / sin-chequear, por el código de salida, la señal y la salida del tsc. ⚠️ Un «heap out of memory» GANA sobre un «error TS»:
//     un tsc muerto a mitad no imprimió TODOS los errores, y corregir sólo esos manda a la persona a una vuelta más.
//   · `veredictoDeTipos`: la palabra, el exit (0 / 1 / 98 —el mismo «SIN TIPOS» de tests-afectados—), la anotación de GitHub y la línea `TIPOS-MEDIDA` que queda en el log de cada
//     run. La memoria viva arriba del 80 % del tope avisa (`::warning::`) ANTES de que el paso muera.
//   · `topeDeHeapMb`: el tope se deriva de la RAM del runner (RAM − 1,5 GB, múltiplos de 512, entre 4 y 8 GB); TIPOS_HEAP_MB lo fuerza.
//   · `leerEstadisticas` y `argumentosDeTsc`: «Memory used» es la memoria VIVA sólo con `--expose-gc` (el tsc hace un GC antes de leerla); sin eso el número es una foto cualquiera.
//   · DE PUNTA A PUNTA con el tsc de verdad sobre un proyecto chico: sano → exit 0 y una memoria viva REAL; un error de tipos → exit 1; y un OOM DE VERDAD (un tope de 30 MB) → exit 98
//     y «SIN MEMORIA, no son errores de tipos».
//   · El workflow llama a este script y no a un tsc pelado.
//
// ⚠️ PROBADO ROMPIÉNDOLO (21/10/2026): ver el final del archivo.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  argumentosDeTanda, argumentosDeTsc, clasificar, correrTsc, juntarTandas, leerEstadisticas, miles, raicesPedidas, SALIDA_SIN_TIPOS, soloTandasPedido, tandasPedidas, topeDeHeapMb, UMBRAL_AVISO, veredictoDeTipos,
} from '../scripts/tipos-ci.mjs';
import * as TESTS_AFECTADOS from '../scripts/tests-afectados.mjs';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const CLI = join(RAIZ, 'scripts', 'tipos-ci.mjs');
const OOM = 'FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory\n----- Native stack trace -----\n';
const ERROR_TS = "src/a.ts(1,14): error TS2322: Type 'string' is not assignable to type 'number'.\n";

// ---------------------------------------------------------------------------------------------------------------------------------
// topeDeHeapMb
// ---------------------------------------------------------------------------------------------------------------------------------

test('el tope se deriva de la RAM del runner: RAM − 1,5 GB, múltiplos de 512, entre 4 y 8 GB', () => {
  assert.equal(topeDeHeapMb({ totalMb: 7941 }), 6144, 'el runner de 2 CPU (7,9 GB, run 102) da 6.144');
  assert.equal(topeDeHeapMb({ totalMb: 7680 }), 6144, 'justo en el borde: 7.680 − 1.536 = 6.144');
  assert.equal(topeDeHeapMb({ totalMb: 7679 }), 5632, 'un MB menos baja un escalón de 512 (no se pasa de lo que hay)');
  assert.equal(topeDeHeapMb({ totalMb: 32768 }), 8192, 'una máquina grande no se come toda la RAM: tope máximo 8 GB');
  assert.equal(topeDeHeapMb({ totalMb: 3000 }), 4096, 'una máquina chica no baja de 4 GB: probar y que el paso diga qué pasó');
  assert.ok(topeDeHeapMb({ totalMb: 7941 }) + 1536 <= 7941, 'el tope derivado SIEMPRE deja la reserva para el SO y el runner');
});

test('TIPOS_HEAP_MB fuerza el tope; un valor que no es un entero positivo se ignora', () => {
  assert.equal(topeDeHeapMb({ totalMb: 7941, env: { TIPOS_HEAP_MB: '7000' } }), 7000);
  assert.equal(topeDeHeapMb({ totalMb: 7941, env: { TIPOS_HEAP_MB: '30' } }), 30, 'forzado es forzado (así se prueba un OOM de verdad)');
  for (const malo of ['', 'abc', '0', '-5']) {
    assert.equal(topeDeHeapMb({ totalMb: 7941, env: { TIPOS_HEAP_MB: malo } }), 6144, `«${malo}» no es un tope`);
  }
});

// ---------------------------------------------------------------------------------------------------------------------------------
// clasificar
// ---------------------------------------------------------------------------------------------------------------------------------

test('clasificar: ok / errores / sin-memoria / matado / sin-chequear', () => {
  assert.deepEqual(clasificar({ status: 0, salida: 'Files: 3\n' }), { estado: 'ok' });
  assert.deepEqual(clasificar({ status: 2, salida: ERROR_TS + ERROR_TS }), { estado: 'errores', errores: 2 }, 'cuenta los errores');
  assert.equal(clasificar({ status: 134, signal: null, salida: OOM }).estado, 'sin-memoria', 'el run 200: exit 134 + heap out of memory');
  assert.equal(clasificar({ status: 1, salida: OOM }).estado, 'sin-memoria', 'el mensaje de V8 alcanza aunque el exit no sea 134 (en Windows no lo es)');
  assert.equal(clasificar({ status: null, signal: 'SIGABRT', salida: '' }).estado, 'sin-memoria', 'abortado por señal, sin mensaje');
  assert.equal(clasificar({ status: 134, salida: '' }).estado, 'sin-memoria', 'exit 134 a secas: el abort de V8');
  assert.equal(clasificar({ status: 137, salida: '' }).estado, 'matado', '137 = SIGKILL: el OOM-killer del runner');
  assert.equal(clasificar({ status: null, signal: 'SIGKILL', salida: '' }).estado, 'matado');
  assert.equal(clasificar({ status: 1, salida: '' }).estado, 'sin-chequear', 'sale con error y sin una sola línea: no hay un error de tipos que corregir');
  assert.equal(clasificar({ status: null, salida: '' }).estado, 'sin-chequear', 'ni siquiera se pudo lanzar');
});

test('clasificar: un heap out of memory GANA sobre los «error TS» que alcanzó a imprimir (no son todos)', () => {
  const c = clasificar({ status: 134, salida: ERROR_TS + OOM });
  assert.equal(c.estado, 'sin-memoria');
  assert.equal(c.errores, undefined, 'no se informa «N errores»: serían una parte');
});

// ---------------------------------------------------------------------------------------------------------------------------------
// leerEstadisticas / argumentosDeTsc
// ---------------------------------------------------------------------------------------------------------------------------------

const ESTADISTICAS = [
  'Files:                         6732', 'Lines of Library:           48155', 'Identifiers:                43630', 'Symbols:                    33690',
  'Types:                    2345678', 'Instantiations:           8123456', 'Memory used:             4912345K', 'Check time:                 80.33s', 'Total time:                 213.5s', '',
].join('\r\n');

test('leerEstadisticas lee el formato real del tsc (con CRLF), y una línea que falta es null, nunca 0', () => {
  const e = leerEstadisticas(ESTADISTICAS);
  assert.equal(e.archivos, 6732);
  assert.equal(e.tipos, 2345678);
  assert.equal(e.instanciaciones, 8123456);
  assert.equal(e.chequeoS, 80.33);
  assert.equal(e.totalS, 213.5);
  // «Memory used» está en miles de BYTES (no KiB): 4.912.345 K = 4.912.345.000 B = 4.684,7 MiB.
  assert.equal(e.vivoMb, 4685);
  const sin = leerEstadisticas('error TS2322: x\n');
  assert.equal(sin.vivoMb, null, 'sin la línea no se inventa una memoria de 0');
  assert.equal(sin.archivos, null);
  assert.equal(leerEstadisticas('Memory used:  4,912,345K\n').vivoMb, 4685, 'tolera comas de miles');
});

test('el tsc corre con --expose-gc y --extendedDiagnostics: sin lo primero «Memory used» no es la memoria viva', () => {
  const a = argumentosDeTsc({ topeMb: 6144, tsc: 'ruta/tsc', extra: ['-p', 'x.json'] });
  assert.equal(a[0], '--max-old-space-size=6144', 'el tope va primero: es una opción de node');
  assert.ok(a.includes('--expose-gc'), 'sin --expose-gc el tsc no hace el GC antes de leer «Memory used»');
  assert.ok(a.includes('--extendedDiagnostics'), 'sin --extendedDiagnostics no hay números');
  assert.ok(a.indexOf('--expose-gc') < a.indexOf('ruta/tsc'), '--expose-gc es una opción de node: va ANTES del tsc');
  assert.ok(a.indexOf('--extendedDiagnostics') > a.indexOf('ruta/tsc'), '--extendedDiagnostics es una opción del tsc');
  assert.ok(a.includes('--noEmit'));
  assert.deepEqual(a.slice(-2), ['-p', 'x.json'], 'los argumentos extra llegan al tsc');
});

// ---------------------------------------------------------------------------------------------------------------------------------
// veredictoDeTipos
// ---------------------------------------------------------------------------------------------------------------------------------

const base = { segundos: 187.4, topeMb: 6144, ramMb: 7941, cpu: 2 };
const estadisticas = (vivoMb: number | null) => ({ archivos: 6732, tipos: 2345678, instanciaciones: 8123456, simbolos: 1, vivoMb, chequeoS: 80.33, totalS: 213.5 });

test('veredictoDeTipos: cada estado tiene su palabra y su exit, y los fallos de memoria NO se llaman errores de tipos', () => {
  const ok = veredictoDeTipos({ ...base, estado: 'ok', estadisticas: estadisticas(3000) });
  assert.equal(ok.codigo, 0);
  assert.equal(ok.palabra, 'OK');
  const err = veredictoDeTipos({ ...base, estado: 'errores', errores: 3 });
  assert.equal(err.codigo, 1);
  assert.equal(err.palabra, 'ERRORES DE TIPOS');
  assert.match(err.anotaciones.join('\n'), /::error title=Tipos: errores de tipos::3 error/);

  const oom = veredictoDeTipos({ ...base, segundos: 297, estado: 'sin-memoria' });
  assert.equal(oom.codigo, SALIDA_SIN_TIPOS, 'sin memoria sale 98, no 1');
  assert.equal(oom.palabra, 'SIN MEMORIA');
  const texto = oom.lineas.join('\n');
  assert.match(texto, /SIN MEMORIA — NO son errores de tipos/);
  assert.match(texto, /tope de heap 6\.144 MB, RAM del runner 7\.941 MB, 2 CPU/, 'dice con qué tope y qué RAM murió');
  assert.doesNotMatch(texto + oom.anotaciones.join('\n'), /ERRORES DE TIPOS/, 'un OOM nunca se rotula como errores de tipos');
  assert.match(oom.anotaciones.join('\n'), /::error title=Tipos: SIN MEMORIA \(no son errores de tipos\)::/);

  const matado = veredictoDeTipos({ ...base, estado: 'matado', signal: 'SIGKILL' });
  assert.equal(matado.codigo, SALIDA_SIN_TIPOS);
  assert.equal(matado.palabra, 'MATADO POR EL SISTEMA');
  assert.match(matado.lineas.join('\n'), /OOM-killer/);
  assert.match(matado.lineas.join('\n'), /NO son errores de tipos/);

  const mudo = veredictoDeTipos({ ...base, estado: 'sin-chequear', status: 1 });
  assert.equal(mudo.codigo, SALIDA_SIN_TIPOS);
  assert.equal(mudo.palabra, 'SIN VEREDICTO');
  assert.match(mudo.lineas.join('\n'), /no hay un error de tipos que corregir/);
});

test('el 98 del paso de Actions es el mismo «SIN TIPOS» de tests-afectados y antes-de-subir', () => {
  assert.equal(SALIDA_SIN_TIPOS, 98);
  // tests-afectados exporta SALIDA_SIN_TIPOS desde que los tipos son parte del veredicto de la PC (tests/tipos-del-cambio.test.ts): en cuanto están los dos, tienen que coincidir.
  const delVerde = (TESTS_AFECTADOS as Record<string, unknown>).SALIDA_SIN_TIPOS;
  if (delVerde !== undefined) assert.equal(SALIDA_SIN_TIPOS, delVerde);
});

test('la línea TIPOS-MEDIDA va primero y trae lo que hace falta para decidir (tope, memoria viva, % y tamaño del programa)', () => {
  const v = veredictoDeTipos({ ...base, estado: 'ok', estadisticas: estadisticas(4915) });
  assert.equal(v.lineas[0], 'TIPOS-MEDIDA estado=ok segundos=187 tope_mb=6144 ram_mb=7941 vivo_mb=4915 vivo_pct=80 archivos=6732 tipos=2345678 instanciaciones=8123456 chequeo_s=80.33');
  const sinNumeros = veredictoDeTipos({ ...base, segundos: 297, estado: 'sin-memoria' });
  assert.match(sinNumeros.lineas[0], /estado=sin-memoria .*vivo_mb=n\/d vivo_pct=n\/d archivos=n\/d/, 'un OOM no tiene estadísticas: se dice n/d, no 0');
});

test(`la memoria viva desde el ${UMBRAL_AVISO * 100} % del tope avisa con un warning (el paso sigue verde); por debajo, no`, () => {
  const justo = veredictoDeTipos({ ...base, estado: 'ok', estadisticas: estadisticas(Math.ceil(6144 * UMBRAL_AVISO)) });
  assert.equal(justo.codigo, 0, 'un aviso no frena el push');
  assert.match(justo.anotaciones.join('\n'), /^::warning title=Tipos: al borde de la memoria::El tsc usó 4\.916 MB vivos de 6\.144 \(80 %\)/);
  const holgado = veredictoDeTipos({ ...base, estado: 'ok', estadisticas: estadisticas(Math.floor(6144 * UMBRAL_AVISO) - 1) });
  assert.deepEqual(holgado.anotaciones, [], 'con aire no hay ruido');
  const sinMedir = veredictoDeTipos({ ...base, estado: 'ok', estadisticas: estadisticas(null) });
  assert.deepEqual(sinMedir.anotaciones, [], 'sin medir no se inventa una alarma');
  assert.match(sinMedir.lineas.join('\n'), /memoria viva sin medir/);
});

test('el resumen del run (GITHUB_STEP_SUMMARY) trae la palabra, la memoria y el runner', () => {
  const v = veredictoDeTipos({ ...base, estado: 'ok', estadisticas: estadisticas(3000) });
  const md = v.resumen.join('\n');
  assert.match(md, /\*\*Tipos: OK\*\* · 187 s/);
  assert.match(md, /Memoria viva \(tras GC\) \| 3\.000 MB de 6\.144 \(49 %\)/);
  assert.match(md, /Runner \| 7\.941 MB de RAM, 2 CPU/);
  assert.equal(miles(5082), '5.082');
});

// ---------------------------------------------------------------------------------------------------------------------------------
// correrTsc (con un proceso de mentira)
// ---------------------------------------------------------------------------------------------------------------------------------

function falso(emitir: (h: EventEmitter & { stdout: EventEmitter; stderr: EventEmitter }) => void) {
  return () => {
    const h = Object.assign(new EventEmitter(), { stdout: new EventEmitter(), stderr: new EventEmitter() });
    setImmediate(() => emitir(h));
    return h;
  };
}

test('correrTsc reenvía la salida EN VIVO y devuelve estado, señal y la salida acumulada', async () => {
  const visto: string[] = [];
  const salida = { stdout: { write: (b: Buffer) => visto.push(`out:${b}`) }, stderr: { write: (b: Buffer) => visto.push(`err:${b}`) } };
  const lanzar = falso((h) => { h.stdout.emit('data', Buffer.from('Files: 3\n')); h.stderr.emit('data', Buffer.from(OOM)); h.emit('close', 134, null); });
  const r = await correrTsc({ topeMb: 100, tsc: 'x', lanzar, salida });
  assert.equal(r.status, 134);
  assert.equal(r.signal, null);
  assert.match(r.salida, /Files: 3[\s\S]*heap out of memory/, 'junta stdout y stderr');
  assert.deepEqual(visto.map((l) => l.slice(0, 4)), ['out:', 'err:'], 'lo reenvía mientras llega: un paso colgado no queda mudo');
  assert.equal(clasificar({ status: r.status, signal: r.signal, salida: r.salida }).estado, 'sin-memoria');
});

test('correrTsc: si no se puede lanzar el tsc, no hay veredicto (sin-chequear), no un error de tipos', async () => {
  const lanzar = falso((h) => { h.emit('error', new Error('spawn ENOENT')); h.emit('close', 0, null); });
  const r = await correrTsc({ topeMb: 100, tsc: 'x', lanzar, salida: { stdout: { write() {} }, stderr: { write() {} } } });
  assert.equal(r.status, null, 'un fallo al lanzar nunca se lee como «salió 0»');
  assert.ok(r.fallo);
});

// ---------------------------------------------------------------------------------------------------------------------------------
// DE PUNTA A PUNTA: el CLI de verdad, con el tsc de verdad, sobre un proyecto chico
// ---------------------------------------------------------------------------------------------------------------------------------

function proyecto(fuente: string) {
  const dir = mkdtempSync(join(tmpdir(), 'tipos-ci-'));
  writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true, noEmit: true, target: 'ES2017', module: 'esnext', moduleResolution: 'bundler', types: [] }, files: ['a.ts'] }));
  writeFileSync(join(dir, 'a.ts'), fuente);
  return dir;
}

function correrCli(dir: string, env: Record<string, string> = {}) {
  const resumen = join(dir, 'resumen.md');
  const e: NodeJS.ProcessEnv = { ...process.env, GITHUB_STEP_SUMMARY: resumen, ...env };
  delete e.NODE_TEST_CONTEXT;
  if (!('TIPOS_HEAP_MB' in env)) delete e.TIPOS_HEAP_MB;
  if (!('TIPOS_TANDAS' in env)) delete e.TIPOS_TANDAS;     // el entorno de afuera no cambia el paso que se prueba
  if (!('TIPOS_RAICES' in env)) delete e.TIPOS_RAICES;
  if (!('TIPOS_SOLO_TANDAS' in env)) delete e.TIPOS_SOLO_TANDAS;
  if (!('TIPOS_HEAP_ENTERO_MB' in env)) delete e.TIPOS_HEAP_ENTERO_MB;
  const r = spawnSync(process.execPath, [CLI, '-p', join(dir, 'tsconfig.json')], { encoding: 'utf8', env: e, timeout: 120_000 });
  let md = '';
  try { md = readFileSync(resumen, 'utf8'); } catch { /* sin resumen */ }
  return { status: r.status, out: r.stdout ?? '', err: r.stderr ?? '', md };
}

test('de punta a punta: un proyecto sano da exit 0 y mide la memoria viva DE VERDAD', () => {
  const dir = proyecto('export const n: number = 1;\n');
  try {
    const r = correrCli(dir);
    assert.equal(r.status, 0, r.out + r.err);
    const m = /TIPOS-MEDIDA estado=ok .*vivo_mb=(\d+) vivo_pct=(\d+) archivos=(\d+)/.exec(r.out);
    assert.ok(m, `falta la línea TIPOS-MEDIDA con números:\n${r.out}`);
    assert.ok(Number(m[1]) > 20, `la memoria viva medida es real (${m[1]} MB), no un 0 de «no medí»`);
    assert.ok(Number(m[3]) > 1, 'cuenta los archivos del programa (la lib + el nuestro)');
    assert.match(r.out, /Tipos: OK · /);
    assert.match(r.md, /\*\*Tipos: OK\*\*/, 'escribe el resumen del run');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('de punta a punta: un error de tipos da exit 1 y ERRORES DE TIPOS, con el error a la vista', () => {
  const dir = proyecto('export const n: number = "x";\n');
  try {
    const r = correrCli(dir);
    assert.equal(r.status, 1, r.out + r.err);
    assert.match(r.out, /error TS2322/, 'el error del tsc sigue en el log, con su archivo y línea');
    assert.match(r.out, /Tipos: ERRORES DE TIPOS · 1 error\(es\)/);
    assert.match(r.out, /::error title=Tipos: errores de tipos::/);
    assert.doesNotMatch(r.out, /SIN MEMORIA/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('de punta a punta: un OOM DE VERDAD (tope de 30 MB) da exit 98 y «SIN MEMORIA, no son errores de tipos»', () => {
  const dir = proyecto('export const n: number = 1;\n');
  try {
    const r = correrCli(dir, { TIPOS_HEAP_MB: '30' });
    assert.equal(r.status, SALIDA_SIN_TIPOS, r.out + r.err);
    assert.match(r.out + r.err, /heap out of memory/i, 'el mensaje de V8 queda en el log (por stderr, como lo escribe node)');
    assert.match(r.out, /Tipos: SIN MEMORIA — NO son errores de tipos/);
    assert.match(r.out, /::error title=Tipos: SIN MEMORIA \(no son errores de tipos\)::/);
    assert.match(r.out, /TIPOS-MEDIDA estado=sin-memoria /);
    assert.doesNotMatch(r.out, /ERRORES DE TIPOS/, 'un OOM nunca se rotula como un error de tipos');
    assert.match(r.md, /SIN MEMORIA/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ---------------------------------------------------------------------------------------------------------------------------------
// El workflow
// ---------------------------------------------------------------------------------------------------------------------------------

test('el paso «Tipos» del workflow llama a tipos-ci.mjs, y propaga su exit (no lo traga)', () => {
  // 4/11/2026: integracion.yml se retiró; el paso «Tipos» que frena es el de punta.yml.
  const wf = readFileSync(join(RAIZ, '.github', 'workflows', 'punta.yml'), 'utf8').replace(/\r\n/g, '\n');
  const paso = /- name: Tipos\n([\s\S]*?)(?=\n      - name: )/.exec(wf)?.[1] ?? '';
  const codigo = paso.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  assert.match(codigo, /node scripts\/tipos-ci\.mjs/, 'el paso corre el script que dice qué pasó');
  assert.doesNotMatch(codigo, /typescript\/bin\/tsc/, 'y no un tsc pelado, que en rojo no distingue un OOM de un error de tipos');
  assert.match(codigo, /exit \$c/, 'el exit del script llega al paso');
  const script = readFileSync(CLI, 'utf8');
  assert.match(script, /'typescript', 'bin', 'tsc'/, 'el script corre el tsc completo de node_modules');
});

// ---------------------------------------------------------------------------------------------------------------------------------
// TANDAS (TIPOS_TANDAS): el chequeo completo repartido en procesos, el arreglo de fondo del 21/10/2026
// ---------------------------------------------------------------------------------------------------------------------------------

test('tandasPedidas: TIPOS_TANDAS es un entero de 1 a 8; cualquier otra cosa es 1 (el tsc de siempre)', () => {
  assert.equal(tandasPedidas({ TIPOS_TANDAS: '3' }), 3);
  assert.equal(tandasPedidas({ TIPOS_TANDAS: '8' }), 8);
  for (const malo of [undefined, '', 'abc', '0', '-2', '9', '2.5x']) assert.equal(tandasPedidas({ TIPOS_TANDAS: malo }), malo === '2.5x' ? 2 : 1, `«${malo}»`);
});

test('argumentosDeTanda: el tope y --expose-gc son de node (van antes del script); la tanda va al final', () => {
  const a = argumentosDeTanda({ topeMb: 6144, script: 'ruta/tandas.mjs', i: 2, K: 3, extra: ['-p', 'x.json'] });
  assert.deepEqual(a, ['--max-old-space-size=6144', '--expose-gc', 'ruta/tandas.mjs', '-p', 'x.json', '--tanda', '2/3']);
  const r = argumentosDeTanda({ topeMb: 6144, script: 'ruta/tandas.mjs', i: 2, K: 4, extra: ['-p', 'x.json'], raices: true });
  assert.deepEqual(r, ['--max-old-space-size=6144', '--expose-gc', 'ruta/tandas.mjs', '--raices', '-p', 'x.json', '--tanda', '2/4'], 'con raíces el driver recibe --raices (después del script, que es donde lo lee)');
  assert.ok(!argumentosDeTanda({ topeMb: 6144, script: 's.mjs', i: 1, K: 2 }).includes('--raices'), 'sin pedirlo, no');
  const o = argumentosDeTanda({ topeMb: 6144, script: 'ruta/tandas.mjs', i: 3, K: 4, raices: true, orden: '/tmp/orden.json' });
  assert.deepEqual(o, ['--max-old-space-size=6144', '--expose-gc', 'ruta/tandas.mjs', '--raices', '--orden', '/tmp/orden.json', '--tanda', '3/4'], 'con raíces, el archivo donde las tandas comparten el orden del programa');
  assert.ok(!argumentosDeTanda({ topeMb: 6144, script: 's.mjs', i: 1, K: 2, orden: '/tmp/orden.json' }).includes('--orden'), 'sin raíces el orden no hace falta (cada tanda ya tiene el programa entero)');
});

test('raicesPedidas: sólo TIPOS_RAICES=1 lo enciende (cualquier otra cosa es el programa entero por tanda)', () => {
  assert.equal(raicesPedidas({ TIPOS_RAICES: '1' }), true);
  for (const malo of [undefined, '', '0', 'true', 'si', ' 1']) assert.equal(raicesPedidas({ TIPOS_RAICES: malo }), false, `«${malo}»`);
});

const tanda = (estado: string, vivoMb: number | null, baseMb: number | null, segundos = 60, lineasDeError: string[] = []) => ({
  clase: { estado },
  segundos,
  estadisticas: { archivos: 7723, tipos: null, instanciaciones: null, simbolos: null, vivoMb, baseMb, chequeados: 2500, chequeoS: segundos / 2, totalS: null },
  lineasDeError,
});

test('juntarTandas: el estado más grave manda, las líneas de error no se repiten, el pico es el de la tanda más pesada', () => {
  const ok = juntarTandas([tanda('ok', 3000, 1800), tanda('ok', 3300, 1800), tanda('ok', 2900, 1800)]);
  assert.equal(ok.estado, 'ok');
  assert.equal(ok.estadisticas.vivoMb, 3300, 'el pico es el de la tanda más pesada, no la suma');
  assert.equal(ok.estadisticas.baseMb, 1800);
  assert.equal(ok.segundos, 180);
  assert.equal(ok.tandaFallida, null);

  const e1 = 'a.ts(1,1): error TS2322: x';
  const e2 = 'b.ts(2,2): error TS2339: y';
  const err = juntarTandas([tanda('errores', 3000, 1800, 60, [e1, e2]), tanda('ok', 3000, 1800), tanda('errores', 3000, 1800, 60, [e2])]);
  assert.equal(err.estado, 'errores');
  assert.equal(err.errores, 2, 'el error que dos tandas informan (config, sintaxis) cuenta una vez');

  const oom = juntarTandas([tanda('errores', 3000, 1800, 60, [e1]), tanda('sin-memoria', null, null), tanda('ok', 3000, 1800)]);
  assert.equal(oom.estado, 'sin-memoria', 'una tanda que no llegó a un veredicto no se compensa con las otras');
  assert.equal(oom.tandaFallida, 2);
  assert.equal(juntarTandas([tanda('matado', null, null), tanda('sin-memoria', null, null)]).estado, 'sin-memoria', 'sin memoria antes que matado');
  assert.equal(juntarTandas([tanda('sin-chequear', null, null), tanda('errores', 1, 1)]).estado, 'sin-chequear', 'sin veredicto antes que errores');
  assert.equal(juntarTandas([tanda('ok', null, null)]).estadisticas.vivoMb, null, 'sin medir sigue siendo null, no 0');
});

test('veredictoDeTipos con tandas: la línea TIPOS-MEDIDA suma tandas= y base_mb= AL FINAL (la de siempre no cambia), y los avisos dicen cuál tanda', () => {
  const e = { archivos: 7723, tipos: null, instanciaciones: null, simbolos: null, vivoMb: 3300, baseMb: 1800, chequeados: null, chequeoS: 90, totalS: null };
  const v = veredictoDeTipos({ estado: 'ok', segundos: 200, topeMb: 6144, ramMb: 7941, cpu: 2, estadisticas: e, tandas: 3 });
  assert.equal(v.lineas[0], 'TIPOS-MEDIDA estado=ok segundos=200 tope_mb=6144 ram_mb=7941 vivo_mb=3300 vivo_pct=54 archivos=7723 tipos=n/d instanciaciones=n/d chequeo_s=90 tandas=3 base_mb=1800');
  const solo = veredictoDeTipos({ estado: 'ok', segundos: 134, topeMb: 6144, ramMb: 7941, estadisticas: { ...e, vivoMb: 5062 }, tandas: 1 });
  assert.doesNotMatch(solo.lineas[0], /tandas=|base_mb=/, 'con una sola tanda la línea es la de siempre');
  assert.doesNotMatch(v.lineas[0], /raices=/, 'sin raíces la línea no lo dice');
  const conRaices = veredictoDeTipos({ estado: 'ok', segundos: 200, topeMb: 6144, ramMb: 7941, cpu: 2, estadisticas: e, tandas: 4, raices: true });
  assert.match(conRaices.lineas[0], / tandas=4 base_mb=1800 raices=1$/, 'con raíces, `raices=1` AL FINAL: quien lee la línea no ve moverse nada');
  assert.doesNotMatch(veredictoDeTipos({ estado: 'ok', segundos: 134, topeMb: 6144, ramMb: 7941, estadisticas: e, tandas: 1, raices: true }).lineas[0], /raices=/, 'con una sola tanda es el tsc de siempre: no hay raíces que decir');
  assert.match(conRaices.resumen.join('\n'), /piso \(programa de sus raíces\) 1\.800 MB/, 'el resumen del run dice de qué es el piso: ya no es «el programa atado»');
  assert.match(v.resumen.join('\n'), /piso \(programa atado\) 1\.800 MB/);
  const aviso = veredictoDeTipos({ estado: 'ok', segundos: 200, topeMb: 6144, ramMb: 7941, estadisticas: { ...e, vivoMb: 5000 }, tandas: 3 });
  assert.match(aviso.anotaciones.join('\n'), /La tanda más pesada \(de 3\) usó 5\.000 MB vivos/);
  const oom = veredictoDeTipos({ estado: 'sin-memoria', segundos: 90, topeMb: 6144, ramMb: 7941, tandas: 3, tandaFallida: 2 });
  assert.match(oom.lineas.join('\n'), /se quedó sin heap \(tanda 2\/3\) a los 90 s/);
  assert.match(oom.anotaciones.join('\n'), /sin heap \(tanda 2\/3\) a los 90 s/);
  assert.match(veredictoDeTipos({ estado: 'matado', segundos: 90, topeMb: 6144, ramMb: 7941, tandas: 3, tandaFallida: 3, signal: 'SIGKILL' }).lineas.join('\n'), /El tsc murió \(tanda 3\/3\) por SIGKILL/);
  assert.match(v.resumen.join('\n'), /\| Tandas \| 3: pico por tanda 3\.300 MB, piso \(programa atado\) 1\.800 MB \|/);
});

test('veredictoDeTipos: si una tanda murió pero otras terminaron con errores REALES, los errores se dicen (no «no hay nada que corregir»)', () => {
  const e = { archivos: 7723, tipos: null, instanciaciones: null, simbolos: null, vivoMb: 5900, baseMb: 1800, chequeados: null, chequeoS: 90, totalS: null };
  for (const estado of ['sin-memoria', 'matado', 'sin-chequear']) {
    const con = veredictoDeTipos({ estado, errores: 3, segundos: 90, topeMb: 6144, ramMb: 7941, estadisticas: e, tandas: 4, tandaFallida: 2, signal: 'SIGKILL', status: 1 });
    const texto = `${con.lineas.join('\n')}\n${con.anotaciones.join('\n')}`;
    assert.equal(con.codigo, SALIDA_SIN_TIPOS, `${estado}: sigue siendo 98, nunca 0 ni 1`);
    // En el log (las líneas) Y en la anotación de GitHub: son dos lugares que se leen por separado.
    for (const [donde, t] of [['las líneas del log', con.lineas.join('\n')], ['la anotación', con.anotaciones.join('\n')]] as const) {
      assert.match(t, /3 error\(es\) de tipos REALES en las tandas que terminaron/, `${estado}: ${donde} dice cuántos`);
      assert.match(t, /esos SÍ se corrigen|esos sí se corrigen/, `${estado}: ${donde} dice que esos sí se corrigen`);
    }
    assert.doesNotMatch(texto, /No hay nada que corregir en el código|no hay un error de tipos que corregir|Qué hacer: no corregir código/, `${estado}: no manda a «no corregir» con errores reales arriba`);
    const sin = veredictoDeTipos({ estado, errores: 0, segundos: 90, topeMb: 6144, ramMb: 7941, estadisticas: e, tandas: 4, tandaFallida: 2, signal: 'SIGKILL', status: 1 });
    assert.doesNotMatch(`${sin.lineas.join('\n')}${sin.anotaciones.join('\n')}`, /REALES/, `${estado}: sin errores no inventa ninguno`);
  }
  assert.match(veredictoDeTipos({ estado: 'sin-memoria', errores: 0, segundos: 90, topeMb: 6144, ramMb: 7941, tandas: 4, tandaFallida: 1 }).lineas.join('\n'), /NO son errores de tipos/, 'y sin errores reales el mensaje de siempre');
});

test('leerEstadisticas lee también el piso (Base memory used) y los archivos chequeados de una tanda', () => {
  const e = leerEstadisticas('Files:  7723\nFiles checked:  2500\nBase memory used:  1887436K\nMemory used:  3250000K\n');
  assert.equal(e.baseMb, 1800);
  assert.equal(e.chequeados, 2500);
  assert.equal(e.vivoMb, 3099);
  assert.equal(leerEstadisticas('Memory used: 69011K\n').baseMb, null, 'el tsc de siempre no tiene piso: null');
});

function proyectoVarios(archivos: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), 'tipos-ci-tandas-'));
  writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true, noEmit: true, target: 'ES2017', module: 'esnext', moduleResolution: 'bundler', types: [] }, include: ['**/*.ts'] }));
  for (const [ruta, texto] of Object.entries(archivos)) writeFileSync(join(dir, ruta), texto);
  return dir;
}
const TRES = { 'a.ts': 'export const a: number = 1;\n', 'b.ts': "export const b: number = 'x';\n", 'c.ts': "import { a } from './a';\nexport const c: string = a;\n" };

test('de punta a punta con TIPOS_TANDAS=3 y TIPOS_SOLO_TANDAS=1: los errores salen una vez cada uno, con exit 1, y cada tanda deja su línea TIPOS-TANDA', () => {
  const dir = proyectoVarios(TRES);
  try {
    const r = correrCli(dir, { TIPOS_TANDAS: '3', TIPOS_SOLO_TANDAS: '1' });
    assert.equal(r.status, 1, r.out + r.err);
    assert.match(r.out, /── tanda 1\/3 ──/);
    assert.match(r.out, /── tanda 3\/3 ──/);
    assert.equal((r.out.match(/^TIPOS-TANDA \d\/3 estado=/gm) ?? []).length, 3, 'una línea por tanda');
    assert.match(r.out, /Tipos: ERRORES DE TIPOS · 2 error\(es\)/, 'los dos errores del proyecto, sin repetir');
    assert.match(r.out, /TIPOS-MEDIDA estado=errores .* tandas=3 base_mb=\d+/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('de punta a punta con TIPOS_TANDAS=3, TIPOS_SOLO_TANDAS=1 y TIPOS_RAICES=1: los mismos dos errores, una vez cada uno, y la línea dice raices=1', () => {
  const dir = proyectoVarios(TRES);
  try {
    const r = correrCli(dir, { TIPOS_TANDAS: '3', TIPOS_SOLO_TANDAS: '1', TIPOS_RAICES: '1' });
    assert.equal(r.status, 1, r.out + r.err);
    assert.match(r.out, /3 tandas, cada una con el programa de SUS raíces \(TIPOS_RAICES\)/);
    assert.match(r.out, /Tipos: ERRORES DE TIPOS · 2 error\(es\)/, 'lo mismo que sin raíces: el tsc de verdad da esos dos');
    assert.match(r.out, /TIPOS-MEDIDA estado=errores .* tandas=3 base_mb=\d+ raices=1/);
    const raicesPorTanda = (out: string) => [...out.matchAll(/^Root files:\s+(\d+)/gm)].map((m) => m[1]);
    assert.deepEqual(raicesPorTanda(r.out), ['1', '1', '1'], 'cada tanda partió de SU archivo y no de los tres: el driver recibió --raices (no sólo lo dice la línea)');
    const sin = correrCli(dir, { TIPOS_TANDAS: '3', TIPOS_SOLO_TANDAS: '1' });
    assert.doesNotMatch(sin.out, /raices=1|SUS raíces/, 'sin pedirlas, no hay raíces');
    assert.deepEqual(raicesPorTanda(sin.out), ['3', '3', '3'], 'y sin pedirlas cada tanda ata los tres archivos, como siempre');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('de punta a punta con TIPOS_TANDAS=4 (con y sin raíces): una instanciación profunda (TS2589) que el checker cachea en otro archivo NO da «OK» — la repro del Cerebro, 21/10/2026', () => {
  const rel = (n: number) => `//${'x'.repeat(n)}\n`;
  const dir = proyectoVarios({
    'a_g1.ts': `import { v1 } from './b_h1'; export const g1 = v1;\n${rel(140)}`,
    'a_h0.ts': `import type { Rec } from './d_rec';\nexport const v0 = [null! as Rec<2000>][0];\n${rel(118)}`,
    'b_g2.ts': `import { v0 } from './a_h0'; export const g2 = v0;\n${rel(140)}`,
    'b_h1.ts': `import type { Rec } from './d_rec';\nexport const v1 = [null! as Rec<2000>][0];\n${rel(118)}`,
    'c_1.ts': `export const c1 = 1;\n${rel(170)}`,
    'c_2.ts': `export const c2 = 2;\n${rel(170)}`,
    'd_1.ts': `export const d1 = 3;\n${rel(170)}`,
    'd_rec.ts': `export type Rec<N extends number, A extends unknown[] = []> = A['length'] extends N ? A : Rec<N, [...A, 0]>;\n${rel(88)}`,
  });
  const tmp = mkdtempSync(join(tmpdir(), 'tipos-ci-tmp-'));
  try {
    const entornos: Record<string, string>[] = [{ TIPOS_TANDAS: '4' }, { TIPOS_TANDAS: '4', TIPOS_SOLO_TANDAS: '1' }, { TIPOS_TANDAS: '4', TIPOS_SOLO_TANDAS: '1', TIPOS_RAICES: '1', TEMP: tmp, TMP: tmp, TMPDIR: tmp }];
    for (const env of entornos) {
      const r = correrCli(dir, env);
      assert.equal(r.status, 1, `${JSON.stringify(env)}: el tsc da exit 2 y esto tiene que dar ERRORES DE TIPOS (exit 1), no OK:\n${r.out}${r.err}`);
      assert.match(r.out, /error TS2589/);
      assert.match(r.out, /Tipos: ERRORES DE TIPOS/);
      assert.doesNotMatch(r.out, /Tipos: OK/);
    }
    assert.deepEqual(readdirSync(tmp), [], 'la carpeta del orden del programa (TIPOS_RAICES) se borra al terminar');
  } finally { rmSync(dir, { recursive: true, force: true }); rmSync(tmp, { recursive: true, force: true }); }
});

test('de punta a punta con TIPOS_TANDAS=3 y TIPOS_SOLO_TANDAS=1: un proyecto sano da exit 0 PARCIAL y mide el pico y el piso', () => {
  const dir = proyectoVarios({ 'a.ts': TRES['a.ts'], 'b.ts': 'export const b: number = 2;\n', 'c.ts': 'export const c = 3;\n' });
  try {
    const r = correrCli(dir, { TIPOS_TANDAS: '3', TIPOS_SOLO_TANDAS: '1' });
    assert.equal(r.status, 0, r.out + r.err);
    const m = /TIPOS-MEDIDA estado=ok .*vivo_mb=(\d+) .* tandas=3 base_mb=(\d+)/.exec(r.out);
    assert.ok(m, `la línea con tandas:\n${r.out}`);
    assert.ok(Number(m[2]) > 20 && Number(m[1]) >= Number(m[2]), `el piso (${m[2]}) es real y el pico (${m[1]}) no baja de él`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ---------------------------------------------------------------------------------------------------------------------------------
// «TIPOS» ES SIEMPRE EL TSC ENTERO; las tandas son el RESPALDO por memoria y su OK es PARCIAL (criterio del Cerebro, 21/10/2026)
// ---------------------------------------------------------------------------------------------------------------------------------

test('soloTandasPedido: sólo TIPOS_SOLO_TANDAS=1 salta el intento del tsc entero', () => {
  assert.equal(soloTandasPedido({ TIPOS_SOLO_TANDAS: '1' }), true);
  for (const malo of [undefined, '', '0', 'true', 'si']) assert.equal(soloTandasPedido({ TIPOS_SOLO_TANDAS: malo }), false, `«${malo}»`);
});

test('veredictoDeTipos con parcial: el OK sale «OK PARCIAL» (exit 0) con un aviso, nunca limpio; los errores y el OOM no cambian', () => {
  const e = { archivos: 7723, tipos: null, instanciaciones: null, simbolos: null, vivoMb: 3300, baseMb: 1800, chequeados: null, chequeoS: 90, totalS: null };
  const motivo = 'el tsc entero murió por memoria (sin heap a los 150 s)';
  const ok = veredictoDeTipos({ estado: 'ok', segundos: 350, topeMb: 6144, ramMb: 7941, cpu: 2, estadisticas: e, tandas: 4, parcial: motivo });
  assert.equal(ok.codigo, 0, 'sigue avanzando: la parcial no frena el push, lo avisa');
  assert.equal(ok.palabra, 'OK PARCIAL');
  assert.match(ok.lineas.join('\n'), /Tipos: OK PARCIAL — NO es el tsc entero \(el tsc entero murió por memoria/);
  assert.doesNotMatch(ok.lineas.join('\n'), /^Tipos: OK ·/m, 'ni una línea de OK limpio');
  assert.match(ok.anotaciones.join('\n'), /::warning title=Tipos: verificación PARCIAL \(no es el tsc entero\)::el tsc entero murió por memoria.*tipos-respaldo\.yml/);
  assert.match(ok.lineas[0], / tandas=4 base_mb=1800 parcial=1$/, 'la línea TIPOS-MEDIDA lo dice AL FINAL');
  assert.match(ok.resumen.join('\n'), /\*\*Tipos: OK PARCIAL\*\*/);
  const limpio = veredictoDeTipos({ estado: 'ok', segundos: 134, topeMb: 6144, ramMb: 7941, estadisticas: e, tandas: 1 });
  assert.equal(limpio.palabra, 'OK');
  assert.doesNotMatch(limpio.lineas[0], /parcial=/);
  assert.equal(veredictoDeTipos({ estado: 'errores', errores: 2, segundos: 350, topeMb: 6144, ramMb: 7941, estadisticas: e, tandas: 4, parcial: motivo }).codigo, 1, 'los errores de las tandas SIGUEN frenando');
  assert.equal(veredictoDeTipos({ estado: 'sin-memoria', segundos: 350, topeMb: 6144, ramMb: 7941, estadisticas: e, tandas: 4, tandaFallida: 2, parcial: motivo }).codigo, SALIDA_SIN_TIPOS, 'y un OOM de las tandas sigue siendo 98');
});

test('de punta a punta con TIPOS_TANDAS=3 SIN el respaldo pedido: «Tipos» es el tsc entero (sin tandas, OK limpio)', () => {
  const dir = proyectoVarios({ 'a.ts': TRES['a.ts'], 'b.ts': 'export const b: number = 2;\n', 'c.ts': 'export const c = 3;\n' });
  try {
    const r = correrCli(dir, { TIPOS_TANDAS: '3' });
    assert.equal(r.status, 0, r.out + r.err);
    assert.match(r.out, /Tipos: OK ·/);
    assert.doesNotMatch(r.out, /PARCIAL|── tanda|TIPOS-TANDA|parcial=1/, 'el entero entró: no hubo tandas ni nada parcial');
    assert.doesNotMatch(r.out, /tandas=3/, 'la línea es la de siempre');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('de punta a punta: si el tsc ENTERO muere por memoria, las tandas son el respaldo y el OK sale PARCIAL (exit 0, aviso, parcial=1); sus errores siguen frenando', () => {
  const sano = proyectoVarios({ 'a.ts': TRES['a.ts'], 'b.ts': 'export const b: number = 2;\n', 'c.ts': 'export const c = 3;\n' });
  const roto = proyectoVarios(TRES);
  try {
    const r = correrCli(sano, { TIPOS_TANDAS: '3', TIPOS_HEAP_ENTERO_MB: '30' });
    assert.equal(r.status, 0, r.out + r.err);
    assert.match(r.out, /el tsc entero murió por memoria \(sin heap a los \d+ s\): verifico por 3 tandas/);
    assert.match(r.out, /Tipos: OK PARCIAL — NO es el tsc entero/);
    assert.match(r.out, /::warning title=Tipos: verificación PARCIAL/);
    assert.match(r.out, /TIPOS-MEDIDA estado=ok .* tandas=3 base_mb=\d+ parcial=1/);
    assert.doesNotMatch(r.out, /^Tipos: OK ·/m, 'nunca un OK limpio');
    const e = correrCli(roto, { TIPOS_TANDAS: '3', TIPOS_HEAP_ENTERO_MB: '30' });
    assert.equal(e.status, 1, e.out + e.err);
    assert.match(e.out, /Tipos: ERRORES DE TIPOS · 2 error\(es\)/, 'los errores que encuentran las tandas frenan igual');
    const sinRespaldo = correrCli(sano, { TIPOS_HEAP_ENTERO_MB: '30' });
    assert.equal(sinRespaldo.status, SALIDA_SIN_TIPOS, 'sin TIPOS_TANDAS no hay respaldo: el entero muerto es SIN MEMORIA, como siempre');
    assert.doesNotMatch(sinRespaldo.out, /PARCIAL|── tanda/);
  } finally { rmSync(sano, { recursive: true, force: true }); rmSync(roto, { recursive: true, force: true }); }
});

test('de punta a punta con TIPOS_TANDAS=3: un OOM de verdad (del entero y del respaldo) da exit 98, dice «tanda 1/3» y NO sigue con las otras', () => {
  const dir = proyectoVarios(TRES);
  try {
    const r = correrCli(dir, { TIPOS_TANDAS: '3', TIPOS_HEAP_MB: '30' });
    assert.equal(r.status, SALIDA_SIN_TIPOS, r.out + r.err);
    assert.match(r.out, /Tipos: SIN MEMORIA — NO son errores de tipos\. El tsc se quedó sin heap \(tanda 1\/3\)/);
    assert.doesNotMatch(r.out, /── tanda 2\/3 ──/, 'una tanda sin veredicto corta: son minutos de runner');
    assert.doesNotMatch(r.out, /ERRORES DE TIPOS/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// =============================================================================
// ⚠️ TANDAS (21/10/2026, tarde): 8 roturas, 8 rojas — TIPOS_TANDAS que acepta cualquier número → 1 · --tanda antes del script → 1 · los errores que mandan sobre el OOM al juntar → 1 · los errores contados repetidos → 1 ·
//   el pico como suma de las tandas → 1 · que no corte en una tanda sin veredicto → 1 · tandas= siempre en la línea de siempre → 1 · el aviso que no dice la tanda → 2.
// ⚠️ PROBADO ROMPIÉNDOLO (21/10/2026; se rompe UNA pieza, se corren estas pruebas, se restaura): 30 roturas, 30 rojas (una salió verde en la primera pasada y se reforzó).
//   `clasificar` (7): un OOM que no mira el mensaje de V8 → 1 · sin SIGABRT → 1 · sin exit 134 → 1 · los «error TS» que ganan sobre el OOM → 2 · «matado» sin SIGKILL → 1 · sin exit 137 → 1 ·
//     un fallo al lanzar que se lee como salida 0 → 1.
//   exits y palabras (6): sin memoria que sale 1 → 2 · matado que sale 1 → 1 · sin veredicto que sale 0 → 1 · errores de tipos que salen 98 → 2 · SALIDA_SIN_TIPOS = 99 → 1 · un OOM que no dice
//     «NO son errores de tipos» → 2.
//   medición (9): sin `--expose-gc` → 1 (la primera versión del test lo dejaba pasar: `indexOf` = −1 es menor que cualquier posición) · sin `--extendedDiagnostics` → 2 · «Memory used» leído en KiB → 1 ·
//     una línea que falta como 0 → 1 · sin tolerar CRLF → 1 · umbral de aviso al 95 % → 1 · avisa siempre → 1 · el resumen del run que no se escribe → 2 · el exit del script que no llega → 2.
//   tope (5): sin reserva de RAM → 2 · sin tope máximo → 1 · sin tope mínimo → 1 · TIPOS_HEAP_MB ignorado → 2 · TIPOS_HEAP_MB que acepta basura → 4.
//   reenvío y workflow (3): la salida que no se reenvía → 3 · el workflow que vuelve al tsc pelado → 2 · el paso que traga el exit → 1.
// ⚠️ TIPOS_RAICES (21/10/2026 tarde): 9 roturas, 9 rojas — TIPOS_RAICES que acepta cualquier valor → 1 · argumentosDeTanda sin --raices → 1 · --raices antes del script (lo leería node) → 1 · --raices siempre → 1 · la línea sin raices=1 → 2 ·
//   raices=1 aunque no se pidan → 2 · el resumen que no distingue el piso → 1 · main sin pasarle raíces al veredicto → 1 · main sin pasarle --raices al driver → 1 (verde la primera vez: la línea decía raices=1 pero ninguna tanda las usaba; ahora se cuentan los «Root files» de cada tanda).
// ⚠️ «TIPOS» ES SIEMPRE EL TSC ENTERO, las tandas son el RESPALDO y su OK es PARCIAL (21/10 noche): 9 roturas, 9 rojas — el OK de las tandas sin marcar → 1 · la parcial que frena el push → 3 · sin el ::warning:: → 2 · las tandas que corren aunque el entero haya andado → 1 ·
//   que no corren si el entero muere → 1 · TIPOS_SOLO_TANDAS ignorado → 3 · sólo el «matado» como memoria → 1 · sin parcial=1 en la línea → 2 · TIPOS_HEAP_ENTERO_MB ignorado → 1.
// =============================================================================
