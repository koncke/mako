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
//      plan de cuotas sin montos;
//   3. (revisión de bc5fb022d) con el total en dólares, las cuotas valen sólo si SUMAN el total, con la tolerancia del
//      asistente: un total en USD con cuotas en pesos no da un plan en dólares que nadie declaró.
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
import { montosDelContrato, toleranciaCuotas } from '../lib/contrato-montos';

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
  assert.match(w, /if \(j\.cuotas\.every\(\(c: \{ monto\?: number \| string \| null \}\) => c\.monto != null\)\) \{ ok\.add\('plan'\); rell\.push\('plan de cuotas'\); \}\s*else aRevisar\.push\(j\.cuotas_no_cuadran\s*\? 'A revisar: plan de cuotas \(las cuotas del contrato no suman su total en dólares: cárgalas a mano\)'/,
    'sin montos, el paso del plan queda a la vista');
  // El total en dólares sigue siendo SÓLO el del contrato en dólares (la ruta lo da null en otra moneda).
  assert.match(sinComentarios(leer('app/api/extract-contract/route.ts')), /const montos = montosDelContrato\(parsed\);\s*return Response\.json\(\{\s*\.\.\.montos,/);
});

test('3. ⚠️ con el total en dólares, las cuotas valen sólo si suman el total (la misma tolerancia que el asistente)', () => {
  const s = correr();
  // «US$4,000 total, 12 mensualidades de $6,000 M.N.»: el total sí (es USD), las cuotas no (suman 72.000).
  const m = s.mixto.respuesta;
  assert.deepEqual([m.total_usd, m.moneda, m.cuotas_no_cuadran], [4000, 'USD', true]);
  assert.ok(m.cuotas.length === 12 && m.cuotas.every((c) => c.monto === null && typeof c.fecha === 'string'), 'las fechas sí, los montos no');
  // Las mismas cuotas convertidas por la IA (352,94 × 12 = 4.235,28): tampoco cuadran con 4.000.
  const c = s.convertido.respuesta;
  assert.deepEqual([c.total_usd, c.cuotas_no_cuadran], [4000, true]);
  assert.ok(c.cuotas.every((x) => x.monto === null));
  // Las que cuadran, van (3 × 1.000 = 3.000); y dentro de la tolerancia, también.
  assert.equal(s.dolares.respuesta.cuotas_no_cuadran, undefined);
  assert.deepEqual(montosDelContrato({ total: 3000, moneda: 'USD', cuotas: [{ monto: 1000, fecha: 'a' }, { monto: 1000, fecha: 'b' }, { monto: 1000.9, fecha: 'c' }] }).cuotas.map((x) => x.monto), [1000, 1000, 1000.9]);
  // Sin total no hay con qué cuadrarlas, y con una cuota sin monto tampoco: no van.
  assert.ok(montosDelContrato({ total: null, moneda: 'USD', cuotas: [{ monto: 1000, fecha: 'a' }] }).cuotas.every((x) => x.monto === null));
  assert.ok(montosDelContrato({ total: 2000, moneda: 'USD', cuotas: [{ monto: 1000, fecha: 'a' }, { monto: null, fecha: 'b' }] }).cuotas.every((x) => x.monto === null));
  // UNA tolerancia: la del asistente (`cuotasCuadran`) es la misma función.
  assert.deepEqual([toleranciaCuotas(100), toleranciaCuotas(4000)], [1, 20]);
  assert.match(sinComentarios(leer('app/crm/StageMoveDialog.tsx')), /const tolCuotas = toleranciaCuotas\(totalMonto\);/);
  // El copy público ya no dice que convierte con una tasa aproximada.
  const copy = leer('app/vsl/_detalle/features.ts');
  assert.doesNotMatch(copy, /convierte a USD|tasa aproximada|~17 MXN\/USD/);
});

// ROTURAS (21/10/2026). Base: 2 pases, 0 fallos. Rota (pases / fallos):
//   · el total_usd de un prompt viejo vuelve a usarse                     → 1 / 1 (1)
//   · un contrato en pesos llena los montos como dólares                  → 1 / 1 (1)
//   · el prompt viejo no se marca                                         → 1 / 1 (1)
//   · el prompt vuelve a pedir convertir                                  → 1 / 1 (1)
//   · el plan sin montos se da por resuelto                               → 1 / 1 (2)
//   · el asistente no dice el total en su moneda                          → 1 / 1 (2)
//
// ROTURAS de la revisión de bc5fb022d (21/10/2026). Base: 3 pases, 0 fallos. Rota (pases / fallos):
//   · las cuotas en dólares van sin mirar la suma                         → 2 / 1 (3)
//   · sin total, las cuotas van igual                                     → 2 / 1 (3)
//   · una tolerancia propia, más ancha (10%)                              → 2 / 1 (3)
//   · el asistente con su propia tolerancia                               → 2 / 1 (3)
//   · no dice que las cuotas no suman                                     → 2 / 1 (3)
//   · el copy público vuelve a prometer la conversión                     → 2 / 1 (3)
// (La primera versión de «sin total, las cuotas van igual» no rompía nada: con total null, |suma − null| ≤ 1 ya era
//  falso. Se reescribió para que de verdad las deje pasar.)
