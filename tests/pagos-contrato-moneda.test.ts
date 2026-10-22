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
//      asistente: un total en USD con cuotas en pesos no da un plan en dólares que nadie declaró;
//   4. (revisión de b23ce2a9c) el plan del contrato queda resuelto sólo si cuadra con el monto de cierre que va a QUEDAR
//      (`planDelContrato`), y cada aviso dice lo que pasó: sin total no es «no suman su total», y una cuota de 0 se saca.
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
import { montosDelContrato, planDelContrato, toleranciaCuotas } from '../lib/contrato-montos';

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
  // (revisión de b23ce2a9c) Una cuota de 0 no es una cuota: se saca (antes quedaba sin monto y anulaba el plan entero).
  assert.deepEqual(montosDelContrato({ total: '3000', moneda: 'USD', cuotas: [{ monto: 0, fecha: '01/11/2026' }] }).cuotas, []);
  assert.deepEqual(montosDelContrato({ total: '3000', moneda: 'USD', cuotas: [{ monto: 'mil', fecha: '01/11/2026' }] }).cuotas, [{ monto: null, fecha: '01/11/2026' }], 'en texto, sin monto');
  assert.equal(montosDelContrato({ total: 3000, moneda: 'usd' }).total_usd, 3000);
  assert.equal(montosDelContrato({ total_usd: null, cuotas: [] }).montos_no_usados, undefined, 'un prompt viejo sin montos no avisa nada');
});

test('2. el asistente de Ganado lo dice, y no da por resuelto un plan sin montos', () => {
  const w = sinComentarios(leer('app/crm/StageMoveDialog.tsx'));
  assert.match(w, /if \(pideMonto && j\.total_usd == null && Number\(j\.total_original\) > 0\) \{/);
  assert.match(w, /aRevisar\.push\(`A revisar: monto \(el contrato dice \$\{dice\}: carga cuánto es en dólares\)`\);/);
  assert.match(w, /if \(j\.montos_no_usados\) aRevisar\.push\('A revisar: los montos del contrato no se usaron/);
  // (revisión de b23ce2a9c) Lo decide `planDelContrato` (el test 4), con el monto de cierre que va a quedar.
  assert.match(w, /const delPlan = planDelContrato\(j, \{ montoQueQueda, suscripcion: ventaTipo === 'suscripcion' \}\);\s*if \(delPlan\.resuelto\) \{ ok\.add\('plan'\); rell\.push\('plan de cuotas'\); \}\s*else if \(delPlan\.aviso\) aRevisar\.push\(delPlan\.aviso\);/,
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

test('4. ⚠️ el plan del contrato se resuelve sólo si cuadra con el monto que va a quedar, y cada aviso dice lo que pasó', () => {
  const cuotas = (...m: Array<number | null>) => ({ cuotas: m.map((monto) => ({ monto, fecha: 'x' })) });
  // Cierre de 5.000 ya cargado y un contrato de 4 × 1.000: NO queda resuelto (antes sí, sin pasar por `cuotasCuadran`).
  const b11 = planDelContrato(cuotas(1000, 1000, 1000, 1000), { montoQueQueda: 5000, suscripcion: false });
  assert.deepEqual(b11, { resuelto: false, aviso: 'A revisar: plan de cuotas (suman US$ 4.000 y el monto de cierre es US$ 5.000)' });
  // Cuadra con el monto que queda (el que había, o el total recién precargado), con la tolerancia del asistente.
  assert.deepEqual(planDelContrato(cuotas(1000, 1000, 1000, 1000), { montoQueQueda: 4000, suscripcion: false }), { resuelto: true, aviso: null });
  assert.equal(planDelContrato(cuotas(1000, 1000, 1000, 1010), { montoQueQueda: 4000, suscripcion: false }).resuelto, true, 'dentro del 0,5%');
  assert.equal(planDelContrato(cuotas(1000, 1000, 1000, 1000), { montoQueQueda: 0, suscripcion: false }).aviso, 'A revisar: plan de cuotas (suman US$ 4.000: falta el monto de cierre)');
  // Una suscripción no tiene total que cuadrar (como `cuotasCuadran`).
  assert.equal(planDelContrato(cuotas(500, 500), { montoQueQueda: 0, suscripcion: true }).resuelto, true);
  // Sin montos: el aviso dice POR QUÉ.
  assert.match(String(planDelContrato({ ...cuotas(null, null), sin_total: true }, { montoQueQueda: 0, suscripcion: false }).aviso), /el contrato no dice su total: carga el monto y las cuotas/);
  assert.match(String(planDelContrato({ ...cuotas(null, null), cuotas_no_cuadran: true }, { montoQueQueda: 0, suscripcion: false }).aviso), /no suman su total en dólares/);
  assert.match(String(planDelContrato(cuotas(null, null), { montoQueQueda: 0, suscripcion: false }).aviso), /vinieron las fechas/);

  // Por la ruta REAL: «6 pagos de US$500» sin total. Antes decía «no suman su total», sin total.
  const s = correr();
  const st = s.sinTotal.respuesta;
  assert.deepEqual([st.total_usd, st.cuotas_no_cuadran, st.sin_total], [null, undefined, true]);
  assert.ok(st.cuotas.length === 6 && st.cuotas.every((c) => c.monto === null), 'sin total no hay con qué cuadrarlas: van sin monto');
  // Con una cuota de 0 (0 + 3 × 1.000, total 3.000): la de 0 se saca y las tres valen. Antes, el plan entero sin monto.
  const cc = s.conCero.respuesta;
  assert.deepEqual([cc.total_usd, cc.cuotas_no_cuadran, cc.cuotas.map((c) => c.monto)], [3000, undefined, [1000, 1000, 1000]]);
  // `cuotas_no_cuadran` sólo con un total y todas las cuotas con monto.
  assert.equal(montosDelContrato({ total: 2000, moneda: 'USD', cuotas: [{ monto: 1000, fecha: 'a' }, { monto: null, fecha: 'b' }] }).cuotas_no_cuadran, undefined);
  assert.equal(montosDelContrato({ total: 2000, moneda: 'USD', cuotas: [{ monto: 1000, fecha: 'a' }, { monto: 500, fecha: 'b' }] }).cuotas_no_cuadran, true);
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
//
// ROTURAS de la revisión de b23ce2a9c (21/10/2026). Base: 4 pases, 0 fallos. Rota (pases / fallos):
//   · el plan se resuelve con cuadrar con el total del contrato (sin el cierre)       → 3 / 1 (4)
//   · el asistente no le pasa el monto de cierre                                       → 3 / 1 (2)
//   · «no suman su total» vuelve a salir sin total                                     → 3 / 1 (4)
//   · sin total no se dice                                                             → 3 / 1 (4)
//   · una cuota de 0 anula el plan                                                     → 2 / 2 (1 y 4)
//   · el aviso de «sin total» se pierde                                                → 3 / 1 (4)
//   · una suscripción tiene que cuadrar                                                → 3 / 1 (4)
