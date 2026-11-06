// =============================================================================
// Un test que lista el repo ENTERO con git pide su propio maxBuffer (5/11/2026)
// =============================================================================
// `execFileSync` y `execSync` cortan la salida en 1 MiB (1.048.576 bytes) si nadie les pide otra cosa, y tiran ENOBUFS.
// El 5/11/2026 `git ls-files` del repo entero midió 1.048.494 bytes en main y 1.048.905 en punta/suscripciones-ficha: dos
// barredoras (tests/resend-clave-admin y tests/puente-leads-retirado) dieron rojo por once archivos nuevos, sin un bug. Lo
// que lista una carpeta (app y lib suman ~216 KB) todavía tiene aire; la lista entera, no. Molde: archivosVersionados en
// tests/colision-de-nombres.test.ts (`maxBuffer: 64 * 1024 * 1024`).
//
// PROBADO ROMPIÉNDOLO (5/11/2026): sacarle el maxBuffer a tests/puente-leads-retirado.test.ts → 0 / 1; con él → 1 / 0.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');

test('toda llamada que lista el repo entero con git lleva su maxBuffer', () => {
  const archivos = execFileSync('git', ['ls-files', 'tests', 'scripts'], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .split('\n').filter((f) => /\.(ts|mts|mjs|js)$/.test(f));
  assert.ok(archivos.length > 500, `git ls-files trajo ${archivos.length}: no miró el repo`);
  // La lista entera: `ls-files` sin carpeta (con o sin -z) y `ls-tree -r` sobre un ref. Una llamada por renglón: así se escriben.
  const ENTERA = /(execFileSync|spawnSync)\(\s*'git',\s*\[\s*'ls-files'(\s*,\s*'-z')?\s*\]|execSync\(\s*['"`]git ls-files(\s+-z)?\s*['"`]/;
  const sinBuffer: string[] = [];
  for (const f of archivos) {
    if (f === 'tests/git-lista-entera-buffer.test.ts' || f === 'tests/tests-afectados.test.ts') continue; // éste y los ejemplos de texto
    readFileSync(join(RAIZ, f), 'utf8').split('\n').forEach((l, i) => {
      if (!/^\s*\/\//.test(l) && ENTERA.test(l) && !/maxBuffer/.test(l)) sinBuffer.push(`${f}:${i + 1}`);
    });
  }
  assert.deepEqual(sinBuffer, [], 'listan el repo entero sin maxBuffer (ENOBUFS en cuanto el repo pase 1 MiB de rutas)');
});
