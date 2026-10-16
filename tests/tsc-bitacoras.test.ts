// El tsc ACOTADO a las bitácoras de /admin/dev corre en las guardas baratas del push
// (scripts/guardas-push.sh): un hito sin `puntos` (TS2741) frenó tres pushes el 14/10/2026 y
// el 15/10 tiró un run entero de GitHub Actions por un error que se ve en ~4 segundos.
//
// Lo que se fija acá: que las guardas lo llamen, que el tsconfig mire las bitácoras y sólo
// ellas, y el veredicto — sobre todo que un tsc MATADO (código 1, cero salida: el vigía de RAM)
// no se lea como «hay errores» y frene el push. El tsc de verdad no corre en este test (pesa y
// lo corre el pre-push); se probó a mano en un worktree limpio: árbol bueno 0, un hito
// `prompt` sin `puntos` 1 con TS2741, restaurado 0.
//
// Verificado rompiéndolo: tratar la salida vacía como error da 1 fallo; sacar la llamada de
// guardas-push.sh da 1 fallo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { veredicto } from '../scripts/tsc-bitacoras.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');

test('el veredicto: 0 es ok, un «error TS» es error, y un tsc matado NO es error', () => {
  assert.equal(veredicto(0, ''), 'ok');
  assert.equal(veredicto(2, "app/admin/dev/x/bitacora.ts(9,3): error TS2741: Property 'puntos' is missing"), 'errores');
  assert.equal(veredicto(1, ''), 'sin-chequear', 'matado por el vigía: código 1 y cero salida — frenar el push por eso es un candado sin llave');
  assert.equal(veredicto(134, 'FATAL ERROR: Reached heap limit Allocation failed'), 'sin-chequear', 'sin heap tampoco es un error de tipos');
  assert.equal(veredicto(null, ''), 'sin-chequear', 'no se pudo lanzar');
});

test('las guardas del push lo corren, y un árbol sin el script no se frena', () => {
  const g = leer('scripts/guardas-push.sh');
  assert.match(g, /if \[ -f scripts\/tsc-bitacoras\.mjs \]; then[\s\S]*?node scripts\/tsc-bitacoras\.mjs[\s\S]*?exit 1[\s\S]*?\nfi/);
});

test('el tsconfig acotado extiende el principal y mira sólo las bitácoras', () => {
  const c = JSON.parse(leer('scripts/tsconfig.bitacoras.json'));
  assert.equal(c.extends, '../tsconfig.json', 'mismas reglas que el tsc completo');
  assert.deepEqual(c.include, ['../app/admin/dev/*/bitacora.ts']);
  assert.equal(c.compilerOptions?.noEmit, true);
});
