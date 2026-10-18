// =============================================================================
// La tabla de cuotas del Dashboard no dice «Pendiente» de una cuota DEVUELTA o DE BAJA (17/10/2026)
// =============================================================================
// docs/hallazgos-pagos.md §4: con «Todo», `filasPagos` (lib/graficos-datos.ts) pintaba «Pendiente» una cuota de un cliente
// dado de baja (#871) o devuelta por un reembolso, y la sumaba en `pendiente`: no se le debe a nadie. La regla es la de
// toda suma de lo impago (`noEsDeuda`, lib/cobrado-lead.ts), y se lee con `*` para que una base sin la 0307 no rompa.
//
// Probado rompiéndolo (17/10/2026; base 2 / 0). Una rotura por vez, restaurando (pasan / fallan):
//   · el estado sin la rama de la baja (vuelve a «Pendiente»)     -> 1 / 1
//   · `pendiente` sin `|| fuera` (la sigue sumando)              -> 1 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = readFileSync(join(import.meta.dirname, '..', 'lib/graficos-datos.ts'), 'utf8').replace(/\r\n/g, '\n');
const f = SRC.slice(SRC.indexOf('async function filasPagos('), SRC.indexOf('\n}\n', SRC.indexOf('async function filasPagos(')));

test('una cuota devuelta o de baja se dice como tal, no «Pendiente»', () => {
  assert.match(f, /const fuera = !x\.pagado && noEsDeuda\(\{ \.\.\.x, pagado: false \}\);/);
  assert.match(f, /fuera \? \(esCuotaDeBaja\(\{ pagado: false, baja_at: x\.baja_at \}\) \? 'De baja' : 'Devuelta'\)/);
});

test('y no se suma a lo pendiente', () => {
  assert.match(f, /pendiente: x\.pagado \|\| fuera \? 0 : monto/);
});
