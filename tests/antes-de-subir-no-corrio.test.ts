// =============================================================================
// antes-de-subir: «0 tests» NO es un rojo — un proceso que murió sin juzgar nada sale con 99, no con 1
// =============================================================================
// EL 30/10/2026 EL VEREDICTO DEL PUSH DIJO «ROJO» Y EL GRUPO HABÍA CORRIDO CERO TESTS. Textual del log:
//   grupo compartido 1/2 · 495 archivos · 0 tests · ROJO (? archivos) · 25 min 2 s
//     ↻ 495 archivo(s) rojo(s) en proceso compartido: los repito AISLADOS, uno por proceso, por si es la interferencia
//     ✖ 6143 tests de 1143 archivos · 49 min 55 s · RAM libre mínima 0.7 GB
//   ROJO: tests: accion-invitar-curso.test.ts, adjuntos-chats-de-texto.test.ts, admin-view-props.test.ts, …
// Veinticinco minutos (el tope del grupo compartido: lo mató el reloj) con 0,7 GB libres y sin ejecutar un test, y la última línea —la única
// que se lee de un push— escribió 495 nombres detrás de la palabra ROJO. Medio día de buscar fantasmas, con dos rojos de verdad escondidos
// entre los 495 (el mismo día, en la corrida de 615: `operaciones` y `ops-center-decisiones`).
//
// LO QUE SE FIJA ACÁ:
//   1. el DISCRIMINANTE entre «corrió y falló» y «no corrió», con las salidas de node MEDIDAS (abajo, «lo medido»);
//   2. los cuatro casos del veredicto: 0 tests → 99 · tests que fallan → 1 · verde → 0 · la mezcla → gana el rojo;
//   3. que la línea del veredicto diga la RAM mínima y la ruta del detalle, y que la carpeta del detalle NO viva en `os.tmpdir()`.
// Todo con los procesos INYECTADOS (`correr`/`correrGrupo`): la clasificación no puede depender de que la PC tenga 16 GB libres ni de
// esperar 25 minutos a que el vigía mate un grupo.
//
// ⚠️ PROBADO ROMPIÉNDOLO (30/10/2026): ver el final del archivo.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { armarVeredicto, carpetaDeLaCorrida } from '../scripts/antes-de-subir.mjs';
import { CASO_FALLADO, PIE_DEL_RUNNER, correrTests, juzgoAlgo, leerResultado, SALIDA_SIN_CORRER } from '../scripts/tests-afectados.mjs';

const REPO = fileURLToPath(new URL('..', import.meta.url));

// ---------------------------------------------------------------------------
// LO MEDIDO (node 24.17.0, 30/10/2026). Son salidas de verdad, copiadas de una corrida; el último test de este archivo las vuelve a medir.
// ---------------------------------------------------------------------------

/** Un archivo de test VACÍO: el runner lo cuenta como UN test que pasa. Un archivo vacío NO puede dar «0 tests». */
const VACIO = { codigo: 0, colgada: false, ms: 140, salida: '✔ tests/vacio.test.ts (120.109ms)\nℹ tests 1\nℹ suites 0\nℹ pass 1\nℹ fail 0\nℹ cancelled 0\nℹ skipped 0\nℹ todo 0\nℹ duration_ms 140.1266\n' };

/** Dos archivos en un proceso compartido, los dos verdes (uno de ellos vacío). */
const VERDE = { codigo: 0, colgada: false, ms: 32, salida: '✔ tests/vacio.test.ts (2.6001ms)\n✔ sano (0.2177ms)\nℹ tests 2\nℹ suites 0\nℹ pass 2\nℹ fail 0\nℹ cancelled 0\nℹ skipped 0\nℹ todo 0\nℹ duration_ms 31.8088\n' };

/** Un archivo que falla en su PRIMER caso: imprime el caso fallado, el pie, y el nombre del archivo en el pie de rojos. */
const roto = (archivo: string) => ({
  codigo: 1,
  colgada: false,
  ms: 148,
  salida: `✖ el primero falla (2.0188ms)\n✔ el segundo pasa (0.5225ms)\nℹ tests 2\nℹ suites 0\nℹ pass 1\nℹ fail 1\nℹ cancelled 0\nℹ skipped 0\nℹ todo 0\nℹ duration_ms 147.5752\n\n✖ failing tests:\n\ntest at ${archivo}:3:1\n✖ el primero falla (2.0188ms)\n  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:\n\n  1 !== 2\n`,
});

/** EL CASO DEL 30/10: el proceso murió antes de juzgar nada. Salida VACÍA, código != 0. (Medido con un archivo que llama a process.exit en un grupo compartido.) */
const MUERTO = { codigo: 7, colgada: false, ms: 1_502_000, salida: '', casos: 0 };
/** Lo mismo, pero matado por su tope de tiempo (`colgada`): 25 min 2 s, que es lo que decía el log del 30/10. */
const COLGADO_SIN_JUZGAR = { codigo: 1, colgada: true, ms: 1_502_000, salida: '', casos: 0 };

// ---------------------------------------------------------------------------
// 1. El discriminante
// ---------------------------------------------------------------------------

test('«no corrió» es que el runner NO juzgó nada: ni pie ni un caso fallado. Un primer caso rojo, un archivo vacío y un pie sin nombres SÍ juzgaron', () => {
  assert.equal(juzgoAlgo(MUERTO.salida), false, 'salida vacía: no hay veredicto que dar');
  assert.equal(juzgoAlgo(COLGADO_SIN_JUZGAR.salida), false, 'que lo mate el reloj no cambia nada: tampoco juzgó');
  assert.equal(juzgoAlgo(roto('tests/x.test.ts').salida), true, 'falla en el PRIMER caso, pero ejecutó tests');
  assert.equal(juzgoAlgo(VACIO.salida), true, 'un archivo vacío no es «0 tests»: el runner lo cuenta y lo imprime');
  // Una muerte A MITAD: alcanzó a imprimir un caso FALLADO y nunca llegó al pie. Algo se juzgó y falló: es un rojo, no un 99.
  const aMitad = '✔ uno (1.2ms)\n✖ dos (3.4ms)\n';
  assert.equal(PIE_DEL_RUNNER.test(aMitad), false, 'sin pie');
  assert.equal(CASO_FALLADO.test(aMitad), true);
  assert.equal(juzgoAlgo(aMitad), true, 'un caso fallado ya es un veredicto, aunque el proceso no haya llegado al final');
  // Una muerte a mitad con TODO verde: nada falló (no hay rojo) y no terminó (no hay verde). No se sabe.
  assert.equal(juzgoAlgo('✔ uno (1.2ms)\n✔ dos (3.4ms)\n'), false);
});

test('leerResultado sobre la salida del 30/10: 0 tests y 0 nombres — de ahí salía el «ROJO (? archivos)»', () => {
  const r = leerResultado(MUERTO.salida);
  assert.equal(r.tests, 0);
  assert.deepEqual(r.rojos, [], 'el «?» del log: no hay a quién nombrar');
});

// ---------------------------------------------------------------------------
// 2. Los cuatro casos, de la clasificación al veredicto
// ---------------------------------------------------------------------------

const BARREDORAS = (prefijo: string, n: number) => Array.from({ length: n }, (_, i) => `tests/${prefijo}-${String(i).padStart(2, '0')}.test.ts`);

type Proceso = { codigo: number; colgada: boolean; ms: number; salida: string; casos?: number };

/**
 * `correrTests` con los procesos de node INYECTADOS: `grupo(archivos, i)` contesta por cada proceso compartido y `aislado(archivos, i)` por
 * cada proceso aislado (las tandas y el reintento). Sin esperar RAM: la clasificación no puede depender de cuántos chats haya abiertos.
 */
async function correr({ compartidos = [], lista = [], cortar = false, grupo, aislado }: {
  compartidos?: string[]; lista?: string[]; cortar?: boolean;
  grupo?: (archivos: string[], i: number) => Proceso;
  aislado?: (archivos: string[], i: number) => Proceso;
}) {
  const dir = mkdtempSync(join(tmpdir(), 'no-corrio-'));
  const lineas: string[] = [];
  const nunca = (que: string) => () => { throw new Error(`no tenía que haber ${que}`); };
  let iGrupo = 0;
  let iAislado = 0;
  const r = await correrTests({
    lista,
    compartidos,
    tanda: 6,
    concurrencia: 2,
    cortar,
    env: process.env,
    carpetaTmp: dir,
    out: (s: string) => { lineas.push(s); },
    esperar: (async (c: number) => c) as never,
    correr: (async (archivos: string[]) => (aislado ?? nunca('corrido nada aislado'))(archivos, iAislado++)) as never,
    correrGrupo: (async (archivos: string[]) => (grupo ?? nunca('corrido ningún grupo compartido'))(archivos, iGrupo++)) as never,
  });
  return { r, lineas, dir, log: () => readFileSync(join(dir, 'compartido-aislado.log'), 'utf8') };
}

test('CASO 1 — un grupo con 0 tests: NO es un rojo. Sale 99, la línea no lleva la palabra ROJO, y dice la RAM y dónde está el detalle', async () => {
  const archivos = BARREDORAS('barre', 24);
  // El grupo murió sin juzgar nada, y el reintento aislado tampoco pudo (es el 30/10: no hay RAM ni para uno ni para el otro).
  const { r, lineas, dir } = await correr({ compartidos: archivos, grupo: () => MUERTO, aislado: () => MUERTO });
  try {
    assert.equal(r.rojos.size, 0, 'ni un rojo: nadie ejecutó un test');
    assert.equal(r.sinCorrer.size, 24, 'los 24 quedan en «no se sabe»');
    assert.equal(r.flaky.length, 0, 'y NINGUNO es flaky: declararlos verdes sería mentir al revés');
    assert.match(lineas.join('\n'), /NO CORRIÓ: no juzgó NI UN caso/, 'la línea del grupo lo dice en el momento');
    assert.match(lineas.join('\n'), /NO SE SABE si están rotos/);

    const v = armarVeredicto({ sha: 'ab12cd34e', sinChequear: [`tests: ${r.sinCorrer.size} archivo(s) NO corrieron (su proceso murió sin juzgar un test)`], ramMin: 0.7, detalle: '/casa/.claude/antes-de-subir/2026-10-30T18-14-22-ab12cd34e' });
    assert.equal(v.codigo, SALIDA_SIN_CORRER, '99: «no pude chequear», no «hay tests rotos»');
    assert.doesNotMatch(v.linea, /ROJO/, 'la palabra ROJO es lo único que lee quien pushea: no puede aparecer sin un rojo');
    assert.equal(v.linea, 'SIN CHEQUEAR ab12cd34e: tests: 24 archivo(s) NO corrieron (su proceso murió sin juzgar un test) — NO es un rojo del código: volvé a correrlo con menos chats abiertos, o pusheá dejándole el chequeo a Actions · RAM libre mínima 0.7 GB · detalle: /casa/.claude/antes-de-subir/2026-10-30T18-14-22-ab12cd34e');
    assert.equal(v.guardarDetalle, true, 'el log se conserva: es lo único que separa al caído por memoria del roto de verdad');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('CASO 2 — un grupo con tests que FALLAN: sale 1, con el nombre del archivo y la RAM en la misma línea', async () => {
  const archivos = BARREDORAS('barre', 24);
  const roto1 = archivos[0];
  // El grupo nombra un rojo; el reintento aislado lo confirma (sigue rojo solo).
  const { r, dir } = await correr({ compartidos: archivos, grupo: (fs) => (fs.includes(roto1) ? roto(roto1) : VERDE), aislado: () => roto(roto1) });
  try {
    assert.deepEqual([...r.rojos], [roto1], 'un rojo CONFIRMADO: corrió y falló');
    assert.equal(r.sinCorrer.size, 0);
    const v = armarVeredicto({ sha: 'ab12cd34e', rojos: [`tests: ${[...r.rojos].map((f) => f.replace(/^tests\//, '').replace(/\.test\.ts$/, '')).join(', ')}`], ramMin: 3.1, detalle: '/casa/d' });
    assert.equal(v.codigo, 1);
    assert.equal(v.linea, 'ROJO: tests: barre-00 · RAM libre mínima 3.1 GB · detalle: /casa/d');
    assert.equal(v.guardarDetalle, true);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('CASO 3 — todo verde: sale 0, y la línea del VERDE sigue siendo la que el Cerebro ya lee (sin cola)', async () => {
  const archivos = BARREDORAS('barre', 24);
  const { r, dir } = await correr({ compartidos: archivos, grupo: () => VERDE });
  try {
    assert.equal(r.rojos.size, 0);
    assert.equal(r.sinCorrer.size, 0);
    const v = armarVeredicto({ sha: 'ab12cd34e', ramMin: 3.1, detalle: '/casa/d' });
    assert.equal(v.codigo, 0);
    assert.equal(v.linea, 'VERDE ab12cd34e', 'un VERDE no lleva RAM ni detalle: no hay nada que creer o no, y el formato es el que ya se lee');
    assert.equal(v.guardarDetalle, false, 'y el detalle se borra: lo que nadie va a mirar no ocupa disco');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('CASO 4 — LA MEZCLA: un grupo que no corrió y otro con un rojo real. Gana el ROJO (hay algo roto confirmado) y la línea avisa que la lista está incompleta', async () => {
  const archivos = BARREDORAS('barre', 24);
  const roto1 = archivos[1];                       // índice impar: cae en el grupo 2 (el reparto es alternado)
  // Grupo 1: murió sin juzgar nada. Grupo 2: nombró un rojo. El reintento aislado TAMBIÉN murió (no hay RAM para nada).
  const { r, lineas, dir } = await correr({ compartidos: archivos, grupo: (fs) => (fs.includes(roto1) ? roto(roto1) : MUERTO), aislado: () => MUERTO });
  try {
    assert.deepEqual([...r.rojos], [roto1], 'el que CORRIÓ y falló sigue rojo aunque el reintento no haya podido confirmarlo');
    assert.equal(r.sinCorrer.size, 12, 'los del grupo que nunca corrió quedan en «no se sabe», y no se mezclan con el rojo');
    assert.ok(!r.sinCorrer.has(roto1));
    assert.match(lineas.join('\n'), /el reintento aislado no llegó a confirmarlo/);

    const v = armarVeredicto({
      sha: 'ab12cd34e',
      rojos: ['tests: barre-01'],
      sinChequear: ['tests: 12 archivo(s) NO corrieron (su proceso murió sin juzgar un test)'],
      ramMin: 0.7,
      detalle: '/casa/d',
    });
    assert.equal(v.codigo, 1, 'gana el rojo: si hay algo roto, no se sube');
    assert.match(v.linea, /^ROJO: tests: barre-01 · ⚠ y ADEMÁS tests: 12 archivo\(s\) NO corrieron/);
    assert.match(v.linea, /la lista de rojos puede estar incompleta · RAM libre mínima 0\.7 GB · detalle: \/casa\/d$/, 'el que lee tiene que saber que faltan');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ---------------------------------------------------------------------------
// 3. Los bordes que importan
// ---------------------------------------------------------------------------

test('un archivo VACÍO (sin un solo caso) no disfraza un rojo de 99: el grupo que lo tiene juzga y sale verde, y con un rojo al lado el rojo sale', async () => {
  const archivos = BARREDORAS('barre', 24);
  const a = await correr({ compartidos: archivos, grupo: () => VACIO });
  assert.equal(a.r.sinCorrer.size, 0, 'un archivo vacío pasa: nunca entra en «no corrió»');
  assert.equal(a.r.rojos.size, 0);
  rmSync(a.dir, { recursive: true, force: true });
  // Un grupo que sólo tiene archivos vacíos y sale con != 0 igual juzgó (tiene pie): es un rojo, no un 99.
  const b = await correr({ compartidos: archivos, grupo: () => ({ ...VACIO, codigo: 1 }), aislado: () => ({ ...VACIO, codigo: 1 }) });
  assert.equal(b.r.sinCorrer.size, 0, 'con el pie impreso no hay «no se sabe»');
  assert.equal(b.r.rojos.size, 24, 'el pie salió y el proceso falló sin nombrar a nadie: todo el grupo queda sospechoso, como siempre');
  rmSync(b.dir, { recursive: true, force: true });
});

test('si el reintento aislado SÍ llega a su pie, lo que no nombró está bien: el del grupo muerto sale limpio y el del grupo rojo queda FLAKY', async () => {
  const archivos = BARREDORAS('barre', 24);
  const roto1 = archivos[1];
  const { r, dir } = await correr({ compartidos: archivos, grupo: (fs) => (fs.includes(roto1) ? roto(roto1) : MUERTO), aislado: () => VERDE });
  try {
    assert.equal(r.rojos.size, 0, 'el reintento pasó: el rojo del compartido era interferencia');
    assert.deepEqual(r.flaky, [roto1], 'y se informa como FLAKY, que es lo de siempre');
    assert.equal(r.sinCorrer.size, 0, 'los del grupo muerto corrieron aislados y pasaron: ya se sabe, no quedan en «no se sabe»');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('una TANDA (no compartida) que muere sin juzgar nada tampoco acusa a sus archivos, y las que siguen igual encuentran el rojo de verdad', async () => {
  const lista = ['tests/a.test.ts', 'tests/b.test.ts', 'tests/c.test.ts', 'tests/d.test.ts', 'tests/e.test.ts', 'tests/f.test.ts', 'tests/g.test.ts'];
  const pasadas = [MUERTO, roto('tests/g.test.ts'), roto('tests/g.test.ts')];   // tandas de 6: la 1.a muere, la 2.a trae el rojo, y el rojo se confirma de a uno
  const { r, dir } = await correr({ lista, cortar: true, aislado: (_a, i) => pasadas[i] });
  try {
    assert.deepEqual([...r.rojos], ['tests/g.test.ts'], 'la tanda que SÍ corrió manda su rojo');
    assert.deepEqual([...r.sinCorrer], lista.slice(0, 6), 'y los 6 de la tanda muerta quedan en «no se sabe», no en la lista de rojos');
    assert.equal(r.cortada, true, 'con --cortar, lo que corta es el rojo de VERDAD de la tanda 2: la tanda muerta no cortó nada (si no, nunca se habría llegado al rojo)');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('el 99 no se come un rojo de otra etapa: con un rojo de guardas o de tipos, el veredicto es ROJO (exit 1) aunque los tests no hayan corrido', () => {
  const v = armarVeredicto({ sha: 'x', rojos: ['una guarda del push: voseo'], sinChequear: ['tests: 495 archivo(s) NO corrieron'], ramMin: 0.7 });
  assert.equal(v.codigo, 1);
  assert.match(v.linea, /^ROJO: una guarda del push/);
});

test('sin RAM y sin turno (lo que ya salía con 99) la línea tampoco dice ROJO, y un PARCIAL con algo sin chequear no es un PARCIAL limpio', () => {
  const sinRam = armarVeredicto({ sha: 'x', sinChequear: ['tests: no hay RAM (quedan 0.7 GB) — no se corrieron, no es un rojo de código'], ramMin: 0.7 });
  assert.equal(sinRam.codigo, SALIDA_SIN_CORRER);
  assert.doesNotMatch(sinRam.linea, /ROJO/);
  const parcial = armarVeredicto({ sha: 'x', parcial: { que: '(tipos)', porque: 'faltan las otras etapas' } });
  assert.equal(parcial.linea, 'PARCIAL (tipos): sin rojos — no vale como VERDE, faltan las otras etapas');
  assert.equal(parcial.codigo, 0);
  const parcialSinChequear = armarVeredicto({ sha: 'x', sinChequear: ['tests: no hay RAM'], parcial: { que: '(tipos)', porque: 'faltan las otras etapas' } });
  assert.equal(parcialSinChequear.codigo, SALIDA_SIN_CORRER);
  assert.match(parcialSinChequear.linea, /^SIN CHEQUEAR x: tests: no hay RAM — NO es un rojo del código, y tampoco un VERDE: faltan las otras etapas$/);
});

// ---------------------------------------------------------------------------
// 4. El detalle: dónde queda y cómo se nombra
// ---------------------------------------------------------------------------

test('la carpeta del detalle NO vive en os.tmpdir() (otra sesión poda %TEMP% a mitad de la corrida) y se poda sola', () => {
  const casa = mkdtempSync(join(tmpdir(), 'detalle-casa-'));
  try {
    const hechas: string[] = [];
    for (let i = 1; i <= 8; i++) hechas.push(carpetaDeLaCorrida({ casa, sha: 'sha00000' + i, sello: `2026-10-30T10-0${i}-00`, guardar: 5 }));
    const quedan = readdirSync(casa).sort();
    assert.equal(quedan.length, 5, 'se guardan las últimas 5 corridas, no todas: el disco de esta PC está al 96 %');
    assert.deepEqual(quedan, ['2026-10-30T10-04-00-sha000004', '2026-10-30T10-05-00-sha000005', '2026-10-30T10-06-00-sha000006', '2026-10-30T10-07-00-sha000007', '2026-10-30T10-08-00-sha000008'], 'y son las más NUEVAS (el nombre empieza con la fecha ISO, así que ordenar por nombre es ordenar por fecha)');
    assert.ok(hechas[7].startsWith(casa), 'la carpeta de la corrida vive adentro de la casa que se le pasó');
  } finally { rmSync(casa, { recursive: true, force: true }); }
});

test('la ruta del detalle va EN la línea del veredicto, y el log del reintento aislado queda escrito ahí', async () => {
  const archivos = BARREDORAS('barre', 24);
  const { r, dir, log } = await correr({ compartidos: archivos, grupo: () => MUERTO, aislado: () => ({ ...MUERTO, salida: 'lo que haya dicho node antes de morir' }) });
  try {
    assert.equal(r.sinCorrer.size, 24);
    assert.equal(log(), 'lo que haya dicho node antes de morir', 'compartido-aislado.log se escribe SIEMPRE que el reintento salga mal, no sólo cuando hay rojos con nombre');
    assert.match(armarVeredicto({ sha: 'x', sinChequear: ['tests: 24 sin correr'], detalle: dir }).linea, new RegExp(`detalle: ${dir.replace(/\\/g, '\\\\').replace(/[.*+?^${}()|[\]]/g, '\\$&')}$`));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('antes-de-subir manda los logs a la carpeta que sobrevive y sólo la borra si el veredicto es verde (en el código de verdad, no sólo en la función)', () => {
  const src = readFileSync(join(REPO, 'scripts', 'antes-de-subir.mjs'), 'utf8').replace(/\r\n/g, '\n');
  const sinComentarios = src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  assert.match(sinComentarios, /carpetaDetalle = carpetaDelDetalle\(sha\)/, 'la carpeta de la corrida sale de ~/.claude, no de os.tmpdir()');
  assert.match(sinComentarios, /correrTests\(\{[^}]*carpetaTmp: carpetaDetalle[^}]*\}\)/, 'y es la que recibe correrTests: el log del reintento aislado cae ahí');
  assert.match(sinComentarios, /if \(!v\.guardarDetalle && carpetaDetalle\) rmSync\(carpetaDetalle/, 'se borra sólo si el veredicto dice que no hay nada que mirar');
  assert.match(sinComentarios, /os\.homedir\(\), '\.claude', 'antes-de-subir'/, 'y la casa del detalle es ~/.claude, que no poda nadie');
  assert.match(sinComentarios, /ramMin = r\.ramMin/, 'la RAM mínima se guarda para el veredicto');
});

// ---------------------------------------------------------------------------
// 5. LO MEDIDO, remedido: las constantes de arriba son salidas de node de verdad
// ---------------------------------------------------------------------------

test('REMEDIDO con el node de esta PC: un archivo de test vacío cuenta como UN test y sale 0; un proceso que muere no imprime NADA', () => {
  const dir = mkdtempSync(join(tmpdir(), 'medir-node-'));
  try {
    writeFileSync(join(dir, 'vacio.prueba.mjs'), '// ningún caso\n');
    writeFileSync(join(dir, 'muere.prueba.mjs'), 'process.exit(7);\n');
    // Sin NODE_TEST_CONTEXT: llamado DESDE un test, node toma al hijo por un test anidado y deja de imprimir su reporte (lo mismo hace correrTanda).
    const { NODE_TEST_CONTEXT: _anidado, ...env } = process.env;
    const correrNode = (args: string[]) => {
      try { return { salida: execFileSync(process.execPath, ['--test-concurrency=1', '--test', ...args], { cwd: dir, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }), codigo: 0 }; }
      catch (e) { const x = e as { status?: number; stdout?: string; stderr?: string }; return { salida: `${x.stdout ?? ''}${x.stderr ?? ''}`, codigo: x.status ?? -1 }; }
    };
    const vacio = correrNode(['vacio.prueba.mjs']);
    assert.equal(vacio.codigo, 0, 'un archivo vacío NO es un rojo');
    assert.equal(leerResultado(vacio.salida).tests, 1, 'y no da «0 tests»: el runner lo cuenta como un test que pasa');
    assert.equal(juzgoAlgo(vacio.salida), true);

    // En UN proceso compartido, un archivo que se va sin avisar se lleva todo: ni un caso, ni pie. Ése es el «0 tests» del 30/10.
    const muerto = correrNode(['--test-isolation=none', 'vacio.prueba.mjs', 'muere.prueba.mjs']);
    assert.notEqual(muerto.codigo, 0);
    assert.equal(muerto.salida.trim(), '', `la salida tiene que venir vacía y vino: ${JSON.stringify(muerto.salida.slice(0, 200))}`);
    assert.equal(juzgoAlgo(muerto.salida), false, 'de acá sale el 99: no hay con qué acusar a nadie');
    assert.equal(leerResultado(muerto.salida).tests, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// =============================================================================
// ⚠️ PROBADO ROMPIÉNDOLO (30/10/2026; se rompe UNA pieza del script, se corren estas pruebas, se restaura). Las roturas y lo que las caza:
//   1. `juzgoAlgo` que devuelve siempre true (el comportamiento de antes: todo código != 0 es un rojo) → CASO 1, CASO 4 y la tanda muerta.
//   2. `juzgoAlgo` que devuelve siempre false (todo pasa a ser 99) → CASO 2, el archivo vacío y el 99-que-se-come-un-rojo.
//   3. `juzgoAlgo` que mira sólo el pie (sin CASO_FALLADO) → la muerte a mitad con un caso rojo deja de ser un rojo (el primer test).
//   4. `juzgoAlgo` que mira sólo un caso fallado (sin el pie) → un grupo con pie que falla sin nombres se vuelve 99 (el del archivo vacío).
//   5. `armarVeredicto` que pone `sinChequear` adentro de la línea ROJO → CASO 1 (la palabra ROJO sin un rojo).
//   6. `armarVeredicto` que devuelve 1 en vez de 99 → CASO 1.
//   7. `armarVeredicto` que devuelve 99 cuando hay rojos Y cosas sin chequear → CASO 4 y el 99-que-se-come-un-rojo.
//   8. la cola sin la RAM, o sin el detalle → CASO 1, CASO 2 y «la ruta del detalle va EN la línea».
//   9. el VERDE con la cola pegada → CASO 3.
//  10. `guardarDetalle: false` con rojos o con archivos sin correr → CASO 1 y CASO 2 (el log se borraba: fue justo lo que pasó el 30/10).
//  11. los `mudos` que no se repiten aislados → «si el reintento SÍ llega a su pie» (los 24 quedaban en «no se sabe» para siempre).
//  12. el reintento sin pie que declara FLAKY a los que no nombró (el verde falso) → CASO 1 (`flaky.length` 0) y CASO 4.
//  13. el reintento sin pie que borra el rojo con nombre del grupo compartido → CASO 4 (el rojo se perdía y salía 99).
//  14. la carpeta del detalle de vuelta en `os.tmpdir()` → el test del texto del script.
//  15. la poda que deja todas las corridas, o que borra las nuevas en vez de las viejas → el test de la carpeta.
// Y las dos del final («REMEDIDO»): si node cambiara y un archivo vacío diera 0 tests, o una muerte imprimiera algo, el discriminante
// dejaría de valer y hay que volver a medir. Por eso se mide acá y no se confía en la memoria.
// =============================================================================
