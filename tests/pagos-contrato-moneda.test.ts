// =============================================================================
// El plan que se lee de un contrato: los montos en dólares sólo si el contrato es en dólares, nunca con una tasa de la IA
// (21/10/2026, Pagos)
// =============================================================================
// El extractor del contrato (CONTRACT_EXTRACT_DEFAULT) pedía «todos los montos en USD», convertidos «con un tipo de cambio
// aproximado actual». Con esa tasa inventada se armaron planes de verdad: 72.000 MXN / 17 = 4.235,29 la cuota de una
// suscripción del ws11. Lo que se fija, pasando por la ruta REAL (tests/_contrato-ruta-hijo.ts):
//   1. un contrato en pesos trae el total ORIGINAL y las fechas de las cuotas, SIN dólares; uno en dólares, los montos; uno
//      con «$» sin código, tampoco dólares; un prompt viejo guardado que convertía: sus montos no se usan, y se marca; y
//      el prompt de siempre ya no pide convertir;
//   2. el asistente de Ganado lo dice («el contrato dice MX$72.000: carga cuánto es en dólares») y no da por resuelto un
//      plan de cuotas sin montos.
//
// Probado rompiéndolo (21/10/2026, una rotura por vez, restaurando byte a byte): los números, en ROTURAS al final.
//
// Correr: node --import tsx --test tests/pagos-contrato-moneda.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CONTRACT_EXTRACT_DEFAULT } from '../lib/prompt-defaults';
import { montosDelContrato } from '../lib/contrato-montos';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '');

type Pedido = { status: number; respuesta: Record<string, unknown> & { cuotas: Array<{ monto: number | null; fecha: string | null }> } };
const correr = (): Record<string, Pedido> & { red: string[]; sinMock: string[] } => JSON.parse(execFileSync(process.execPath, ['--conditions=react-server', '--experimental-test-module-mocks', '--no-warnings', '--import', 'tsx', join(RAIZ, 'tests/_contrato-ruta-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', timeout: 120_000,
}));

test('1. ⚠️ la ruta REAL: en pesos el total original y las fechas, sin dólares; en dólares, los montos; un prompt viejo no se usa', () => {
  const s = correr();
  assert.deepEqual([s.red, s.sinMock], [[], []]);
  // Un contrato de MX$72.000 en 12 cuotas de MX$6.000: ningún dólar inventado.
  const p = s.pesos.respuesta;
  assert.equal(s.pesos.status, 200);
  assert.deepEqual([p.total_usd, p.moneda, p.total_original], [null, 'MXN', 72000]);
  assert.equal(p.cuotas.length, 12);
  assert.ok(p.cuotas.every((c) => c.monto === null && typeof c.fecha === 'string'), 'las fechas sí, los montos no');
  // Un contrato en dólares: como siempre.
  const d = s.dolares.respuesta;
  assert.deepEqual([d.total_usd, d.moneda, d.total_original], [3000, 'USD', null]);
  assert.deepEqual(d.cuotas.map((c) => c.monto), [1000, 1000, 1000]);
  // «$» sin código: la IA no sabe la moneda; no son dólares.
  const sp = s.signoPesos.respuesta;
  assert.deepEqual([sp.total_usd, sp.moneda, sp.total_original], [null, null, 72000]);
  assert.ok(sp.cuotas.every((c) => c.monto === null));
  // Un prompt viejo guardado en Configuraciones (total_usd convertido): no se usa nada, y se marca.
  const v = s.viejo.respuesta;
  assert.deepEqual([v.total_usd, v.total_original, v.montos_no_usados], [null, null, true]);
  assert.ok(v.cuotas.every((c) => c.monto === null));
  // El prompt de siempre ya no pide convertir, y dice que un «$» solo no es USD.
  assert.doesNotMatch(CONTRACT_EXTRACT_DEFAULT, /convierte con|tipo de cambio aproximado|total_usd/i);
  assert.match(CONTRACT_EXTRACT_DEFAULT, /"total": number\|null, "moneda": string\|null/);
  assert.match(CONTRACT_EXTRACT_DEFAULT, /NO conviertas ningún monto/);
  assert.match(CONTRACT_EXTRACT_DEFAULT, /«\$», «MX\$» o «pesos» sin código NO son dólares/);
  // La regla, sola: un monto de 0 o en texto no es un monto.
  assert.deepEqual(montosDelContrato({ total: '3000', moneda: 'USD', cuotas: [{ monto: 0, fecha: '01/11/2026' }] }).cuotas, [{ monto: null, fecha: '01/11/2026' }]);
  assert.equal(montosDelContrato({ total: 3000, moneda: 'usd' }).total_usd, 3000);
  assert.equal(montosDelContrato({ total_usd: null, cuotas: [] }).montos_no_usados, undefined, 'un prompt viejo sin montos no avisa nada');
});

test('2. el asistente de Ganado lo dice, y no da por resuelto un plan sin montos', () => {
  const w = sinComentarios(leer('app/crm/StageMoveDialog.tsx'));
  assert.match(w, /if \(pideMonto && j\.total_usd == null && Number\(j\.total_original\) > 0\) \{/);
  assert.match(w, /aRevisar\.push\(`A revisar: monto \(el contrato dice \$\{dice\}: carga cuánto es en dólares\)`\);/);
  assert.match(w, /if \(j\.montos_no_usados\) aRevisar\.push\('A revisar: los montos del contrato no se usaron/);
  assert.match(w, /if \(j\.cuotas\.every\(\(c: \{ monto\?: number \| string \| null \}\) => c\.monto != null\)\) \{ ok\.add\('plan'\); rell\.push\('plan de cuotas'\); \}\s*else aRevisar\.push\('A revisar: plan de cuotas/,
    'sin montos, el paso del plan queda a la vista');
  // El total en dólares sigue siendo SÓLO el del contrato en dólares (la ruta lo da null en otra moneda).
  assert.match(sinComentarios(leer('app/api/extract-contract/route.ts')), /const montos = montosDelContrato\(parsed\);\s*return Response\.json\(\{\s*\.\.\.montos,/);
});

// ROTURAS (21/10/2026). Base: 2 pases, 0 fallos. Rota (pases / fallos):
//   · el total_usd de un prompt viejo vuelve a usarse                     → 1 / 1 (1)
//   · un contrato en pesos llena los montos como dólares                  → 1 / 1 (1)
//   · el prompt viejo no se marca                                         → 1 / 1 (1)
//   · el prompt vuelve a pedir convertir                                  → 1 / 1 (1)
//   · el plan sin montos se da por resuelto                               → 1 / 1 (2)
//   · el asistente no dice el total en su moneda                          → 1 / 1 (2)
