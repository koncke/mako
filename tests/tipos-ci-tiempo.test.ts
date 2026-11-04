// =============================================================================
// Un tsc que no termina a tiempo es la MÁQUINA, no el código: «SIN TIEMPO» (97), la memoria de ese momento, y una corrida más
// =============================================================================
// 4/11/2026, punta/dash-cobranza, corrida 180: «The action 'Tipos' has timed out after 18 minutes», sin una línea del tsc y sin un error
// de tipos, y la punta quedó con su marca ci-rojo como si el chat la hubiera roto. El MISMO árbol, en la corrida 188 y con la máquina
// recién prendida (sin los 639 s de tests antes), terminó en 456 s. El Cerebro: «que un tope de tiempo no se lea como rojo del chat: que se
// reintente una vez o avise como corrida fallida de la máquina».
//
// Lo que fija (scripts/tipos-ci.mjs, .github/workflows/punta.yml y sobre-main.yml):
//   · TIPOS_TOPE_S: el script corta el tsc y sale 97 «SIN TIEMPO — NO son errores de tipos», con la memoria al cortarlo. Otro número que
//     el 98 a propósito: un SIN MEMORIA no se arregla con otra corrida, un SIN TIEMPO casi siempre sí. DE PUNTA A PUNTA con un tsc de
//     verdad sobre un proyecto lento a propósito.
//   · Una línea TIPOS-RAM por minuto (memoria disponible, swap, lo del tsc), leída de /proc: si se repite, el log dice si fue el swap.
//   · Las condiciones de los workflows EVALUADAS con las reglas de GitHub (tests/_workflow.ts): se relanza UNA vez sólo si el tsc no
//     terminó y lo demás no dio rojo, y en ese caso no queda la marca del rojo. El script del paso que relanza, CORRIDO con un gh de mentira.
//   · En punta.yml los tipos van ANTES de los tests, y el swap se saca después del tsc.
//
// Probado rompiéndolo (4/11/2026): ver el final del archivo.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  clasificar, correrTsc, juntarTandas, leerMeminfo, leerStatusDeProceso, lineaDeRam, SALIDA_SIN_TIEMPO, SALIDA_SIN_TIPOS, topeDeTiempoS, veredictoDeTipos,
} from '../scripts/tipos-ci.mjs';
import { correPaso, correrPaso, leerWorkflow } from './_workflow';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const CLI = join(RAIZ, 'scripts', 'tipos-ci.mjs');

// ── Lo puro ─────────────────────────────────────────────────────────────────────────────────────

test('TIPOS_TOPE_S: un entero positivo de segundos; cualquier otra cosa es «sin tope»', () => {
  assert.equal(topeDeTiempoS({ TIPOS_TOPE_S: '840' }), 840);
  for (const v of [undefined, '', '0', '-5', 'x']) assert.equal(topeDeTiempoS({ TIPOS_TOPE_S: v }), null, String(v));
});

test('el 97 es su propio número: ni el 98 (SIN MEMORIA, que otra corrida no arregla) ni un error de tipos', () => {
  assert.equal(SALIDA_SIN_TIEMPO, 97);
  assert.notEqual(SALIDA_SIN_TIEMPO, SALIDA_SIN_TIPOS);
});

test('leerMeminfo y leerStatusDeProceso leen el formato de /proc en MB, y lo que falta es null (no 0)', () => {
  const meminfo = 'MemTotal:        8122848 kB\nMemFree:          123456 kB\nMemAvailable:     409600 kB\nSwapTotal:       9437180 kB\nSwapFree:        7340028 kB\n';
  assert.deepEqual(leerMeminfo(meminfo), { disponibleMb: 400, swapMb: 2048 });
  assert.deepEqual(leerMeminfo('MemTotal: 1 kB\n'), { disponibleMb: null, swapMb: null });
  const status = 'Name:\tnode\nVmPeak:\t 9000000 kB\nVmRSS:\t 7340032 kB\nVmSwap:\t  524288 kB\n';
  assert.deepEqual(leerStatusDeProceso(status), { rssMb: 7168, swapMb: 512 });
  assert.deepEqual(leerStatusDeProceso('Name:\tnode\n'), { rssMb: null, swapMb: null });
  assert.equal(lineaDeRam({ segundos: 120.4, maquina: { disponibleMb: 400, swapMb: 2048 }, tsc: { rssMb: 7168, swapMb: 512 } }),
    'TIPOS-RAM s=120 disponible_mb=400 swap_mb=2048 tsc_rss_mb=7168 tsc_swap_mb=512');
  assert.match(lineaDeRam({ segundos: 1, maquina: { disponibleMb: null, swapMb: null }, tsc: { rssMb: null, swapMb: null } }), /disponible_mb=n\/d .*tsc_swap_mb=n\/d/);
});

test('clasificar: cortado por el tope es «sin-tiempo», aunque el SIGKILL sea el mismo que el del OOM-killer', () => {
  assert.equal(clasificar({ status: null, signal: 'SIGKILL', salida: '', porTiempo: true }).estado, 'sin-tiempo');
  assert.equal(clasificar({ status: null, signal: 'SIGKILL', salida: '' }).estado, 'matado', 'sin el tope, sigue siendo el sistema');
  assert.equal(clasificar({ status: 2, salida: "a.ts(1,1): error TS2322: x\n", porTiempo: true }).estado, 'sin-tiempo', 'los errores que alcanzó a imprimir no son todos');
});

test('veredictoDeTipos «sin-tiempo»: 97, NO son errores de tipos, la memoria al cortarlo, y si estaba en swap lo dice', () => {
  const base = { segundos: 840.3, topeMb: 12288, ramMb: 7932, cpu: 2, topeS: 840 };
  const v = veredictoDeTipos({ ...base, estado: 'sin-tiempo', alCortar: { disponibleMb: 150, swapMb: 4100, tscSwapMb: 2300 } });
  assert.equal(v.codigo, SALIDA_SIN_TIEMPO);
  assert.equal(v.palabra, 'SIN TIEMPO');
  const texto = v.lineas.join('\n');
  assert.match(texto, /Tipos: SIN TIEMPO — NO son errores de tipos\. El tsc no terminó en 840 s \(tope TIPOS_TOPE_S=840 s/);
  assert.match(texto, /150 MB disponibles y 4\.100 MB de swap usado; el tsc, 2\.300 MB en swap/);
  assert.match(texto, /estaba en swap/);
  assert.match(v.anotaciones.join('\n'), /::error title=Tipos: SIN TIEMPO \(no son errores de tipos\)::/);
  assert.doesNotMatch(texto + v.anotaciones.join('\n'), /ERRORES DE TIPOS/);
  assert.match(texto, /TIPOS-MEDIDA estado=sin-tiempo segundos=840 /);
  const sinSwap = veredictoDeTipos({ ...base, estado: 'sin-tiempo', alCortar: { disponibleMb: 3000, swapMb: 0, tscSwapMb: 0 } });
  assert.doesNotMatch(sinSwap.lineas.join('\n'), /estaba en swap/, 'sin swap no se afirma que esperaba al disco');
  assert.match(sinSwap.lineas.join('\n'), /TIPOS-RAM/, 'manda a mirar las líneas de la memoria');
  assert.match(veredictoDeTipos({ ...base, estado: 'sin-tiempo' }).lineas.join('\n'), /No hay una medición de la memoria al cortarlo/);
});

test('juntarTandas: una tanda cortada por tiempo no se compensa con las otras, y un OOM le gana', () => {
  const t = (estado: string) => ({ clase: { estado }, segundos: 10, estadisticas: { archivos: 1, tipos: null, instanciaciones: null, simbolos: null, vivoMb: null, baseMb: null, chequeados: null, chequeoS: null, totalS: null } });
  assert.equal(juntarTandas([t('ok'), t('sin-tiempo')]).estado, 'sin-tiempo');
  assert.equal(juntarTandas([t('ok'), t('sin-tiempo')]).tandaFallida, 2);
  assert.equal(juntarTandas([t('sin-tiempo'), t('sin-memoria')]).estado, 'sin-memoria');
});

// ── correrTsc con un tsc de mentira que nunca termina ───────────────────────────────────────────

function colgado() {
  const muertes: string[] = [];
  const lanzar = () => {
    const h = Object.assign(new EventEmitter(), { stdout: new EventEmitter(), stderr: new EventEmitter(), pid: 4242, kill: (s: string) => { muertes.push(s); setImmediate(() => h.emit('close', null, s)); return true; } });
    return h;
  };
  return { lanzar, muertes };
}

// Con `timeout`: si el corte no mata al tsc, el de mentira no termina nunca, y el test tiene que caer, no quedarse colgado.
test('correrTsc con topeS: mata el tsc con SIGKILL, vuelve porTiempo y la memoria de ese momento (leída de /proc)', { timeout: 10_000 }, async () => {
  const { lanzar, muertes } = colgado();
  const visto: string[] = [];
  const leer = (r: string) => (r === '/proc/meminfo' ? 'MemAvailable: 204800 kB\nSwapTotal: 2097152 kB\nSwapFree: 1048576 kB\n' : r === '/proc/4242/status' ? 'VmRSS: 1048576 kB\nVmSwap: 524288 kB\n' : '');
  const r = await correrTsc({ topeMb: 100, tsc: 'x', lanzar, topeS: 0.2, leer, salida: { stdout: { write: (b: string) => visto.push(String(b)) }, stderr: { write() {} } } });
  assert.deepEqual(muertes, ['SIGKILL']);
  assert.equal(r.porTiempo, true);
  assert.deepEqual(r.alCortar, { disponibleMb: 200, swapMb: 1024, tscSwapMb: 512 });
  assert.match(visto.join(''), /TIPOS-RAM s=0 disponible_mb=200 swap_mb=1024 tsc_rss_mb=1024 tsc_swap_mb=512 corte=tope_0\.2s/);
  assert.equal(clasificar({ status: r.status, signal: r.signal, salida: r.salida, porTiempo: r.porTiempo }).estado, 'sin-tiempo');
});

test('correrTsc con cadaS: imprime TIPOS-RAM mientras corre; sin /proc (Windows) dice n/d y no rompe', async () => {
  const visto: string[] = [];
  const lanzar = () => {
    const h = Object.assign(new EventEmitter(), { stdout: new EventEmitter(), stderr: new EventEmitter(), pid: 1 });
    setTimeout(() => h.emit('close', 0, null), 250);
    return h;
  };
  const r = await correrTsc({ topeMb: 100, tsc: 'x', lanzar, cadaS: 0.05, leer: () => { throw new Error('ENOENT'); }, salida: { stdout: { write: (b: string) => visto.push(String(b)) }, stderr: { write() {} } } });
  assert.equal(r.status, 0);
  assert.equal(r.porTiempo, false);
  assert.ok(visto.filter((l) => l.startsWith('TIPOS-RAM ')).length >= 2, visto.join(''));
  assert.match(visto.join(''), /disponible_mb=n\/d/);
});

// ── De punta a punta: el tsc de verdad sobre un proyecto lento a propósito ──────────────────────

/** Un proyecto que tarda en chequearse: 60 tuplas recursivas de ~990 elementos (13 s de check medidos el 4/11/2026, 4 CPU). */
function proyectoLento() {
  const dir = mkdtempSync(join(tmpdir(), 'tipos-ci-lento-'));
  const lineas = ["type Rep<N extends number, A extends unknown[] = []> = A['length'] extends N ? A : Rep<N, [...A, 0]>;"];
  for (let i = 0; i < 60; i++) lineas.push(`export const x${i}: Rep<${990 - i}>['length'] = ${990 - i};`);
  writeFileSync(join(dir, 'a.ts'), `${lineas.join('\n')}\n`);
  writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true, noEmit: true, target: 'ES2017', module: 'esnext', moduleResolution: 'bundler', types: [] }, files: ['a.ts'] }));
  return dir;
}

test('de punta a punta: con TIPOS_TOPE_S=2 un tsc lento sale 97, «SIN TIEMPO — NO son errores de tipos», y NO sigue por tandas', () => {
  const dir = proyectoLento();
  try {
    const e: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: 'test', TIPOS_TOPE_S: '2', TIPOS_TANDAS: '3', GITHUB_STEP_SUMMARY: join(dir, 'resumen.md') };
    delete e.NODE_TEST_CONTEXT;
    delete e.TIPOS_HEAP_MB;
    const t0 = Date.now();
    const r = spawnSync(process.execPath, [CLI, '-p', join(dir, 'tsconfig.json')], { encoding: 'utf8', env: e, timeout: 120_000 });
    const segundos = (Date.now() - t0) / 1000;
    const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
    assert.equal(r.status, SALIDA_SIN_TIEMPO, out);
    assert.ok(segundos < 30, `cortó a tiempo (${segundos.toFixed(1)} s), no esperó al tsc`);
    // Lo que prueba que lo MATÓ: un tsc que termina imprime sus diagnósticos (--extendedDiagnostics); uno cortado a los 2 s, no. Medir sólo
    // el tiempo no alcanza: sin el kill, en una máquina libre este proyecto igual termina en ~8 s.
    assert.doesNotMatch(out, /^Check time:/m, 'el tsc no llegó a terminar: lo cortó el tope');
    assert.match(out, /tope de tiempo 2 s \(TIPOS_TOPE_S\)/);
    assert.match(out, /TIPOS-RAM s=2 .*corte=tope_2s/);
    assert.match(out, /Tipos: SIN TIEMPO — NO son errores de tipos/);
    assert.match(out, /TIPOS-MEDIDA estado=sin-tiempo /);
    assert.doesNotMatch(out, /── tanda 1\/3 ──/, 'un SIN TIEMPO no es un SIN MEMORIA: repartir en tandas no lo arregla y se comería el tiempo que queda');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ── Los workflows: qué corre en cada caso, EVALUADO con las reglas de GitHub ────────────────────

const PUNTA = leerWorkflow(RAIZ, 'punta.yml');
const SOBRE = leerWorkflow(RAIZ, 'sobre-main.yml');
const RELANZAR = 'Relanzar si la máquina no llegó a los tipos';
const MARCA = 'Dejar la marca del rojo en ci-rojo/<punta>';
const fallo = { success: false, failure: true, cancelled: false, always: true };

/** El contexto de la corrida: lo que dejó Tipos, cómo terminaron las guardas y los tests, y con qué evento se lanzó. */
function ctx(o: { tipos?: Record<string, string>; guardas?: string; afectados?: string; barredoras?: string; relanzo?: string; relanzada?: boolean } = {}) {
  return {
    steps: {
      tipos: { outputs: o.tipos ?? { empezo: 'si', salida: 'sin-tiempo' } },
      guardas: { outcome: o.guardas ?? 'success' },
      afectados: { outcome: o.afectados ?? 'success' },
      barredoras: { outcome: o.barredoras ?? 'success' },
      relanzar: { outputs: o.relanzada ? { relanzada: 'si' } : {} },
    },
    github: o.relanzo == null ? { event_name: 'push', event: {} } : { event_name: 'workflow_dispatch', event: { inputs: { relanzo: o.relanzo } } },
  };
}

test('punta.yml: se relanza UNA vez sólo si la máquina no llegó a los tipos y lo demás no dio rojo', () => {
  const corre = (o: Parameters<typeof ctx>[0], estado = fallo) => correPaso(PUNTA, RELANZAR, estado, ctx(o));
  assert.equal(corre({}), true, 'SIN TIEMPO (97), guardas y tests en verde: se relanza');
  assert.equal(corre({ tipos: { empezo: 'si' } }), true, 'Actions cortó el paso sin que escribiera la salida (lo de la corrida 180): también es la máquina');
  assert.equal(corre({ afectados: 'skipped' }), true, 'con los tests cubiertos por el veredicto, igual');
  assert.equal(corre({ tipos: { empezo: 'si', salida: 'otra' } }), false, 'un error de tipos o un SIN MEMORIA es del código o del programa: rojo como siempre');
  assert.equal(corre({ guardas: 'failure' }), false, 'con una guarda roja, el rojo es del chat');
  assert.equal(corre({ afectados: 'failure' }), false, 'con un test rojo, el rojo es del chat');
  assert.equal(corre({ tipos: {} }), false, 'si Tipos no llegó a arrancar, no hay nada de la máquina que relanzar');
  assert.equal(corre({ relanzo: 'maquina' }), false, 'la corrida relanzada no se vuelve a relanzar');
  assert.equal(corre({ relanzo: '' }), true, 'la que relanza ci-main-verde.sh (sin la entrada) sí puede');
  assert.equal(corre({}, { success: true, failure: false, cancelled: false, always: true }), false, 'en verde no corre');
});

test('punta.yml: con la corrida relanzada no queda la marca del rojo; sin relanzar, queda como siempre', () => {
  assert.equal(correPaso(PUNTA, MARCA, fallo, ctx({ relanzada: true })), false);
  assert.equal(correPaso(PUNTA, MARCA, fallo, ctx({})), true);
  assert.equal(correPaso(PUNTA, MARCA, { success: true, failure: false, cancelled: false, always: true }, ctx({})), false);
  assert.match(PUNTA, /workflow_dispatch:\n\s+inputs:\n(?:\s+#.*\n)*\s+relanzo:/, 'la entrada `relanzo` existe: sin ella `gh workflow run -f relanzo=…` falla');
});

test('sobre-main.yml: un SIN TIEMPO se relanza una vez y no marca main en rojo; un rojo de las barredoras, sí', () => {
  const corre = (o: Parameters<typeof ctx>[0]) => correPaso(SOBRE, RELANZAR, fallo, ctx(o));
  assert.equal(corre({}), true);
  assert.equal(corre({ barredoras: 'failure' }), false);
  assert.equal(corre({ tipos: { empezo: 'si', salida: 'otra' } }), false);
  assert.equal(corre({ relanzo: 'maquina' }), false);
  assert.equal(correPaso(SOBRE, 'Main está rojo', fallo, ctx({ relanzada: true })), false);
  assert.equal(correPaso(SOBRE, 'Main está rojo', fallo, ctx({})), true);
  assert.match(SOBRE, /TIPOS_TOPE_S: '\d+'/);
});

test('el tope del script va por debajo del timeout-minutes del paso: corta tipos-ci, que lo dice, y no Actions, que mata mudo', () => {
  for (const [nombre, yml] of [['punta.yml', PUNTA], ['sobre-main.yml', SOBRE]] as const) {
    const paso = /- name: Tipos\n([\s\S]*?)(?=\n {6}- name: )/.exec(yml.replace(/\r\n/g, '\n'))?.[1] ?? '';
    const tope = Number(/TIPOS_TOPE_S: '(\d+)'/.exec(paso)?.[1]);
    const minutos = Number(/timeout-minutes: (\d+)/.exec(paso)?.[1]);
    assert.ok(tope > 0 && minutos > 0, `${nombre}: los dos topes están`);
    assert.ok(tope <= minutos * 60 - 120, `${nombre}: ${tope} s de tope y ${minutos} min de paso: hacen falta 2 min de margen para que el script cierre y diga qué pasó`);
  }
});

test('punta.yml: los tipos van antes de los tests, y el swap se saca después del tsc y antes de los tests', () => {
  const i = (n: string) => PUNTA.indexOf(`- name: ${n}\n`);
  const orden = ['Swap para los tipos', 'Tipos', 'Sacar el swap de los tipos', 'Tests afectados por lo que cambió (todos, sin cortar)'].map(i);
  assert.ok(orden.every((x) => x >= 0), String(orden));
  assert.deepEqual([...orden].sort((a, b) => a - b), orden, 'en ese orden');
});

// ── El script del paso que relanza, CORRIDO con un gh de mentira ────────────────────────────────

test('el paso que relanza llama a gh con la rama y relanzo=maquina, deja relanzada=si y lo dice; si gh falla, no deja la marca de relanzada', { skip: spawnSync('bash', ['-c', 'exit 0']).error && 'sin bash' }, () => {
  const tmp = mkdtempSync(join(tmpdir(), 'relanzar-'));
  try {
    const registro = join(tmp, 'gh.txt');
    const bien = correrPaso(PUNTA, RELANZAR, { antes: `gh() { echo "$*" >> ${JSON.stringify(registro)}; }`, env: { GITHUB_REF_NAME: 'punta/x' } });
    assert.equal(bien.codigo, 0, bien.salida);
    assert.equal(spawnSync('cat', [registro], { encoding: 'utf8' }).stdout.trim(), 'workflow run punta.yml --ref punta/x -f relanzo=maquina');
    assert.match(bien.outputs, /^relanzada=si$/m);
    assert.match(bien.salida, /::warning title=Tipos: la máquina no llegó \(no es el código\)::/);
    assert.match(bien.resumen, /No es un rojo de la punta/);
    const mal = correrPaso(PUNTA, RELANZAR, { antes: 'gh() { return 1; }', env: { GITHUB_REF_NAME: 'punta/x' } });
    assert.equal(mal.codigo, 0, 'el paso que relanza nunca suma un rojo');
    assert.doesNotMatch(mal.outputs, /relanzada/, 'sin relanzar, la marca del rojo queda');
    assert.match(mal.salida, /No pude relanzar/);
    const sobre = correrPaso(SOBRE, RELANZAR, { antes: `gh() { echo "$*" > ${JSON.stringify(registro)}; }` });
    assert.equal(spawnSync('cat', [registro], { encoding: 'utf8' }).stdout.trim(), 'workflow run sobre-main.yml --ref main -f relanzo=maquina');
    assert.match(sobre.outputs, /^relanzada=si$/m);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

test('el paso Tipos deja empezo=si antes del tsc y salida=sin-tiempo sólo con el 97 (corrido con un node de mentira)', { skip: spawnSync('bash', ['-c', 'exit 0']).error && 'sin bash' }, () => {
  for (const [c, salida] of [[97, 'sin-tiempo'], [98, 'otra'], [1, 'otra'], [0, 'otra']] as const) {
    const r = correrPaso(PUNTA, 'Tipos', { antes: `node() { return ${c}; }` });
    assert.equal(r.codigo, c, r.salida);
    assert.match(r.outputs, /^empezo=si$/m, `con ${c}`);
    assert.match(r.outputs, new RegExp(`^salida=${salida}$`, 'm'), `con ${c}`);
  }
});

// =============================================================================
// ⚠️ PROBADO ROMPIÉNDOLO (4/11/2026; se rompe una pieza, se corre este archivo y se mira su EXIT, se restaura):
//   1. `clasificar` sin la rama de porTiempo → 3 rojos (sale «matado», no «sin-tiempo»).
//   2. el corte sin el kill → rojo: el de mentira no termina (cae por su timeout, que node cuenta como «cancelled», no como «fail»)
//      y el de punta a punta llega a imprimir «Check time». ⚠️ La primera versión medía sólo el tiempo (< 30 s) y daba VERDE: sin el
//      kill, con la máquina libre, el proyecto lento igual termina en ~8 s.
//   3. el 98 en vez del 97 → 1 rojo.
//   4. el relanzar de punta.yml sin `steps.afectados.outcome != 'failure'` → 1 rojo («con un test rojo»).
//   5. la marca sin `steps.relanzar.outputs.relanzada != 'si'` → 1 rojo.
//   6. Tipos otra vez después de los tests → 1 rojo.
//   7. renombrar una variable local de correrTsc → verde.
// =============================================================================
