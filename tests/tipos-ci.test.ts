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
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  argumentosDeTsc, clasificar, correrTsc, leerEstadisticas, miles, SALIDA_SIN_TIPOS, topeDeHeapMb, UMBRAL_AVISO, veredictoDeTipos,
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
  const wf = readFileSync(join(RAIZ, '.github', 'workflows', 'integracion.yml'), 'utf8').replace(/\r\n/g, '\n');
  const paso = /- name: Tipos\n([\s\S]*?)(?=\n      - name: )/.exec(wf)?.[1] ?? '';
  const codigo = paso.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  assert.match(codigo, /node scripts\/tipos-ci\.mjs/, 'el paso corre el script que dice qué pasó');
  assert.doesNotMatch(codigo, /typescript\/bin\/tsc/, 'y no un tsc pelado, que en rojo no distingue un OOM de un error de tipos');
  assert.match(codigo, /exit \$c/, 'el exit del script llega al paso');
  const script = readFileSync(CLI, 'utf8');
  assert.match(script, /'typescript', 'bin', 'tsc'/, 'el script corre el tsc completo de node_modules');
});

// =============================================================================
// ⚠️ PROBADO ROMPIÉNDOLO (21/10/2026; se rompe UNA pieza, se corren estas pruebas, se restaura): 30 roturas, 30 rojas (una salió verde en la primera pasada y se reforzó).
//   `clasificar` (7): un OOM que no mira el mensaje de V8 → 1 · sin SIGABRT → 1 · sin exit 134 → 1 · los «error TS» que ganan sobre el OOM → 2 · «matado» sin SIGKILL → 1 · sin exit 137 → 1 ·
//     un fallo al lanzar que se lee como salida 0 → 1.
//   exits y palabras (6): sin memoria que sale 1 → 2 · matado que sale 1 → 1 · sin veredicto que sale 0 → 1 · errores de tipos que salen 98 → 2 · SALIDA_SIN_TIPOS = 99 → 1 · un OOM que no dice
//     «NO son errores de tipos» → 2.
//   medición (9): sin `--expose-gc` → 1 (la primera versión del test lo dejaba pasar: `indexOf` = −1 es menor que cualquier posición) · sin `--extendedDiagnostics` → 2 · «Memory used» leído en KiB → 1 ·
//     una línea que falta como 0 → 1 · sin tolerar CRLF → 1 · umbral de aviso al 95 % → 1 · avisa siempre → 1 · el resumen del run que no se escribe → 2 · el exit del script que no llega → 2.
//   tope (5): sin reserva de RAM → 2 · sin tope máximo → 1 · sin tope mínimo → 1 · TIPOS_HEAP_MB ignorado → 2 · TIPOS_HEAP_MB que acepta basura → 4.
//   reenvío y workflow (3): la salida que no se reenvía → 3 · el workflow que vuelve al tsc pelado → 2 · el paso que traga el exit → 1.
// =============================================================================
