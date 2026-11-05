// =============================================================================
// Leer `git ls-files` del repo ENTERO pide un `maxBuffer` (5/11/2026)
// =============================================================================
// `execFileSync` corta la salida en 1 MiB por default y tira ENOBUFS. El 5/11/2026 `git ls-files` del repo entero pasó ese
// tope por 42 bytes (1.048.618) al sumar cuatro archivos de una pestaña nueva, y dos tests que nada tenían que ver
// (resend-clave-admin y puente-leads-retirado) dieron rojo: el rojo lo trae cualquier archivo nuevo, no el código de nadie.
// Este test barre tests/, scripts/ y lib/ y pide el tope en toda llamada que lista el repo entero (sin carpeta).
//
// Probado rompiéndolo (base 1 pase, 0 fallos): sin el `maxBuffer` de tests/resend-clave-admin.test.ts → 1 rojo; sin el de
// tests/puente-leads-retirado.test.ts → 1 rojo. Un fuente de mentira adentro de un texto (tests-afectados) no cuenta.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

test('toda llamada a `git ls-files` del repo entero lleva maxBuffer', () => {
  const archivos = execFileSync('git', ['ls-files', 'tests', 'scripts', 'lib'], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 50_000_000 })
    .split('\n').filter((f) => /\.(ts|mts|mjs|cjs|js)$/.test(f));
  assert.ok(archivos.length > 500, `git ls-files trajo ${archivos.length}: no miró el repo`);
  const sinTope: string[] = [];
  for (const f of archivos) {
    const src = readFileSync(join(RAIZ, f), 'utf8');
    // Una llamada que lista TODO: `['ls-files']` sin más argumentos, o el texto 'git ls-files' cerrado ahí.
    const re = /exec(?:File)?Sync\(\s*(?:'git',\s*\['ls-files'\]|['"`]git ls-files['"`])[^)]*\)/g;
    for (const m of src.matchAll(re)) {
      if (/maxBuffer/.test(m[0])) continue;
      // Un fuente de MENTIRA adentro de un texto (tests/tests-afectados.test.ts arma archivos así) no es una llamada.
      const antes = src.slice(src.lastIndexOf('\n', m.index) + 1, m.index);
      if (/["`]/.test(antes)) continue;
      sinTope.push(`${f}: ${m[0].slice(0, 80)}`);
    }
  }
  assert.deepEqual(sinTope, [], 'listar el repo entero sin maxBuffer da ENOBUFS cuando pasa de 1 MiB');
});
