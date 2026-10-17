// =============================================================================
// Las lecturas de cobranza leen TODAS las cuotas, no las primeras 1.000 (17/10/2026)
// =============================================================================
// PostgREST corta cada consulta en 1.000 filas SIN error. El Outstanding, «A quién cobrarle», las cuotas por vencer,
// el cash del período y los desgloses del Revenue (lib/pagos.ts) leían `pagos` de un tirón: pasadas las 1.000 cuotas
// daban de menos y nadie se enteraba (docs/hallazgos-crm.md, 11/10). Ahora pasan por `leerTodo`
// (lib/supabase-paginado.ts). El barrido: en esas funciones no queda un `.from('pagos')` suelto.
//
// Probado rompiéndolo (17/10/2026; base 2 / 0). Una rotura por vez, restaurando (pasan / fallan):
//   · getOutstandingTotal vuelve a `.from('pagos').select('*')`                   -> 1 / 1
//   · _getCuotasPendientes ordena sólo por vencimiento (empata entre páginas)     -> 1 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = readFileSync(join(import.meta.dirname, '..', 'lib/pagos.ts'), 'utf8').replace(/\r\n/g, '\n');
const cuerpo = (firma: string): string => {
  const i = SRC.indexOf(firma);
  assert.ok(i >= 0, `no encontré ${firma}`);
  return SRC.slice(i, SRC.indexOf('\n}\n', i));
};

const LECTURAS = [
  'export async function getCashCollectedPeriodo(',
  'export async function getOutstandingPeriodo(',
  'export async function getOutstandingTotal(',
  'async function _getOutstandingDetalle(',
  'async function _getCuotasPendientes(',
  'async function _getRevenueBreakdowns(',
];

test('ninguna lectura de cobranza lee `pagos` sin paginar', () => {
  const sueltas = LECTURAS.filter((f) => /\.from\('pagos'\)/.test(cuerpo(f)));
  assert.deepEqual(sueltas, [], 'una lectura de `pagos` sin leerTodo corta en 1.000 cuotas sin error');
  for (const f of LECTURAS) assert.match(cuerpo(f), /leerTodo</, `${f} no pasa por leerTodo`);
});

test('las cuotas por vencer se paginan con un orden ÚNICO (vencimiento + id)', () => {
  assert.match(cuerpo('async function _getCuotasPendientes('), /orden: \['fecha_esperada', 'id'\]/);
});
