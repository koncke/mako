// =============================================================================
// El reporte de tiempo por archivo (scripts/reporter-tiempos.mjs + scripts/tiempos-tests.mjs), CORRIENDO node de verdad.
// =============================================================================
// Lo que cuida, y cada assert se probó rompiéndolo (4/11/2026, node 24.22):
//   · el tiempo del ARCHIVO incluye lo que corre al cargar (b carga 400 ms antes de su único caso). Con `esDelArchivo` devolviendo
//     siempre false, b sale como «casos» con ~0 ms: el assert del «archivo» da rojo.
//   · el spec de siempre sigue saliendo por stdout (tests-afectados lo lee con regex). Sacando las dos banderas del spec de
//     `banderasDeTiempos`, el reporter queda solo y «ℹ tests 4» desaparece: rojo.
//   · un rojo queda marcado «rojo» en la línea del archivo.
//   · la tabla se queda con el tiempo MAYOR de un archivo repetido (el reintento aislado de un rojo) y ordena de mayor a menor.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { lineasDeTiempos } from '../scripts/reporter-tiempos.mjs';
import { markdown, tabla } from '../scripts/tiempos-tests.mjs';
import { banderasDeTiempos } from '../scripts/tests-afectados.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPORTER = pathToFileURL(path.join(RAIZ, 'scripts', 'reporter-tiempos.mjs')).href;

test('corriendo node: una línea por archivo con su tiempo entero, el spec intacto, y el rojo marcado', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'reporter-tiempos-'));
  try {
    writeFileSync(path.join(dir, 'a.test.mjs'), "import test from 'node:test';\ntest('uno', async () => { await new Promise((r) => setTimeout(r, 150)); });\ntest('dos', () => {});\n");
    writeFileSync(path.join(dir, 'b.test.mjs'), "import test from 'node:test';\nawait new Promise((r) => setTimeout(r, 400));\ntest('tres', () => {});\n");
    writeFileSync(path.join(dir, 'c.test.mjs'), "import test from 'node:test';\nimport assert from 'node:assert';\ntest('rojo', () => assert.equal(1, 2));\n");
    const tsv = path.join(dir, 'tiempos.tsv');
    const { NODE_TEST_CONTEXT: _anidado, ...env } = process.env;
    // Las MISMAS banderas que usa tests-afectados.mjs en cada tanda, no una copia.
    const r = spawnSync(process.execPath, ['--test', ...banderasDeTiempos({ MAKO_TIEMPOS_TESTS: tsv }), 'a.test.mjs', 'b.test.mjs', 'c.test.mjs'],
      { cwd: dir, env: { ...env, MAKO_TIEMPOS_TESTS: tsv }, encoding: 'utf8', timeout: 60_000 });
    assert.equal(r.status, 1, 'c falla: node sale con 1');
    assert.match(r.stdout, /^ℹ tests 4/m, 'el spec de siempre sigue saliendo por stdout');
    assert.match(r.stdout, /^test at .*c\.test\.mjs/m, 'y el pie de rojos que lee tests-afectados también');
    const filas = tabla(readFileSync(tsv, 'utf8'));
    const de = (f: string) => filas.find((x) => x.archivo === f);
    assert.deepEqual(filas.map((f) => f.medida), ['archivo', 'archivo', 'archivo'], 'con un proceso por archivo, se mide el archivo entero');
    assert.ok((de('b.test.mjs')?.ms ?? 0) >= 400, `b carga 400 ms antes de su caso: el tiempo del archivo los incluye (${de('b.test.mjs')?.ms} ms)`);
    assert.ok((de('a.test.mjs')?.ms ?? 0) >= 150);
    assert.equal(de('c.test.mjs')?.rojo, true, 'el rojo queda marcado');
    assert.equal(de('a.test.mjs')?.rojo, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('sin MAKO_TIEMPOS_TESTS el reporter no escribe nada (es un dato de más, nunca un archivo suelto)', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'reporter-tiempos-'));
  try {
    writeFileSync(path.join(dir, 'a.test.mjs'), "import test from 'node:test';\ntest('uno', () => {});\n");
    const { NODE_TEST_CONTEXT: _anidado, MAKO_TIEMPOS_TESTS: _t, ...env } = process.env;
    const r = spawnSync(process.execPath, ['--test', '--test-reporter=spec', '--test-reporter-destination=stdout', `--test-reporter=${REPORTER}`, '--test-reporter-destination=stdout', 'a.test.mjs'], { cwd: dir, env, encoding: 'utf8', timeout: 60_000 });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /^ℹ pass 1/m);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('compartido (sin envoltorio de archivo): queda la suma de los casos, marcada «casos»', () => {
  const f = path.join(process.cwd(), 'tests', 'x.test.ts');
  const lineas = lineasDeTiempos([
    { type: 'test:pass', data: { file: f, name: 'uno', nesting: 0, details: { duration_ms: 100, passed: true } } },
    { type: 'test:pass', data: { file: f, name: 'dentro', nesting: 1, details: { duration_ms: 99, passed: true } } },
    { type: 'test:fail', data: { file: f, name: 'dos', nesting: 0, details: { duration_ms: 50, passed: false } } },
  ]);
  assert.deepEqual(lineas, ['150\ttests/x.test.ts\tcasos\trojo'], 'nesting 1 no suma (ya está adentro del de arriba)');
});

test('la tabla: el mayor de un archivo repetido, de mayor a menor, y markdown con su medida', () => {
  const filas = tabla('100\ttests/a.test.ts\tarchivo\tverde\n900\ttests/b.test.ts\tarchivo\tverde\n300\ttests/a.test.ts\tarchivo\trojo\nbasura\n');
  assert.deepEqual(filas.map((f) => [f.archivo, f.ms, f.rojo]), [['tests/b.test.ts', 900, false], ['tests/a.test.ts', 300, true]]);
  const md = markdown(filas, 1);
  assert.match(md, /\| 0,9 \| `tests\/b\.test\.ts` \| el archivo entero \|/);
  assert.doesNotMatch(md, /a\.test\.ts/, '--top 1 muestra uno');
  assert.match(markdown([]), /Sin tiempos/);
});
