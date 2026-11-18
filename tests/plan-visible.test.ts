// =============================================================================
// «Tu plan» dice el plan que se VENDE, nunca la capa (18/11/2026)
// =============================================================================
// Martín vio en la maqueta «Agencia» como nombre del plan de una prueba de MaKo Pro, y la app real hacía lo mismo:
// `capaDef(capa).nombre` (lib/capas.ts) es el nombre de la CAPA, algo interno. A quien paga Pro le decía «Agencia» y a quien
// paga Essential, «Completo», en tres lugares: «Tu plan» de la computadora, la del teléfono y el email del código de baja.
// La regla es la de la ficha de los tickets (`planDeLaFicha`, el #89 del 12/11): la capa con `rige` (si paga un plan de MaKo).
// Fija:
//   1. LA REGLA (lib/plan-visible-reglas.ts): quien paga ve el nombre del CATÁLOGO; el cliente de una agencia sin un plan del
//      catálogo, «Plan de tu agencia»; un acuerdo a mano o una capa sin plan, «Plan a medida». Nunca la capa;
//   2. UNA SOLA DECISIÓN: la ficha de los tickets y «Tu plan» la leen de `planQueSeVende`;
//   3. LA PÁGINA DIBUJADA (tests/_plan-pedir-pro-hijo.ts, con sus bordes de mentira): el título de «Tu plan» en cada caso;
//   4. LAS TRES VISTAS piden el nombre a `nombreDelPlanDe` y ninguna vuelve a `capaDef(...).nombre`.
//
// Correr: node --import tsx --test tests/plan-visible.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { nombreDelPlanVisible, planQueSeVende, PLAN_A_MEDIDA, PLAN_DE_TU_AGENCIA } from '../lib/plan-visible-reglas';
import { planDeLaFicha } from '../lib/tickets-reglas';
import { PLANES_MAKO_DEFAULT } from '../lib/planes-mako';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8');
const nombres = { esencial: 'MaKo Essential', pro: 'MaKo Pro' };
/** Los nombres de las capas que NUNCA tiene que leer un cliente como nombre de su plan (lib/capas.ts). */
const CAPAS = ['Completo', 'Agencia', 'Project Manager', 'SuperAdmin'];

test('1. quien paga ve el plan del catálogo; el resto, un texto claro; nunca la capa', () => {
  const v = (capa: string | null, rige: boolean | null, clienteDeAgencia = false) => nombreDelPlanVisible({ capa, rige, clienteDeAgencia, nombres });
  assert.equal(v('agencia', true), 'MaKo Pro', 'la capa `agencia` pagada es Pro');
  assert.equal(v('completo', true), 'MaKo Essential', 'la capa `completo` pagada es Essential');
  // El cliente de una agencia: si su agencia le paga un plan del catálogo, ése; si no, que lo maneja ella.
  assert.equal(v('completo', true, true), 'MaKo Essential');
  assert.equal(v('completo', false, true), PLAN_DE_TU_AGENCIA);
  assert.equal(v('pm', null, true), PLAN_DE_TU_AGENCIA);
  // El ws1 y los acuerdos a mano tienen la capa de un plan sin pagarlo: algo neutro.
  assert.equal(v('agencia', false), PLAN_A_MEDIDA);
  assert.equal(v('completo', false), PLAN_A_MEDIDA);
  assert.equal(v('pm', null), PLAN_A_MEDIDA);
  assert.equal(v(null, null), PLAN_A_MEDIDA);
  // Sin poder leer `rige`, el plan de su capa (es lo que paga casi todo negocio con esa capa), no la capa.
  assert.equal(v('agencia', null), 'MaKo Pro');
  assert.equal(v('completo', null), 'MaKo Essential');
  // Ningún caso devuelve el nombre de una capa.
  for (const capa of ['completo', 'agencia', 'pm', 'superadmin', null]) for (const rige of [true, false, null]) for (const ag of [true, false]) {
    assert.ok(!CAPAS.includes(v(capa, rige, ag)), `capa ${capa}, rige ${rige}, agencia ${ag}: dijo la capa`);
  }
  // Los nombres salen del catálogo que se le pase: si el catálogo cambia, cambia el nombre.
  assert.equal(nombreDelPlanVisible({ capa: 'agencia', rige: true, clienteDeAgencia: false, nombres: { esencial: 'E', pro: 'P' } }), 'P');
  assert.deepEqual(PLANES_MAKO_DEFAULT.filter((p) => p.id === 'esencial' || p.id === 'pro').map((p) => p.nombre), ['MaKo Essential', 'MaKo Pro']);
});

test('2. la ficha de los tickets y «Tu plan» deciden con la MISMA regla (`planQueSeVende`)', () => {
  for (const capa of ['completo', 'agencia', 'pm', null]) for (const rige of [true, false, null]) {
    const plan = planQueSeVende({ capa, rige });
    const ficha = planDeLaFicha({ capa, nombreCapa: `capa-${capa}`, rige });
    const esperada = { pro: 'Pro', esencial: 'Essential', 'sin-plan': `sin cobro de MaKo, sin topes (capa capa-${capa})`, 'no-se': `? (capa capa-${capa})`, 'otra-capa': `capa-${capa}` }[plan];
    assert.equal(ficha, esperada, `capa ${capa}, rige ${rige}`);
  }
  assert.match(leer('lib/tickets-reglas.ts'), /const plan = planQueSeVende\(p\);/, 'la ficha no repite la regla: la lee de lib/plan-visible-reglas.ts');
});

test('3. «Tu plan» DIBUJADA: el título dice el plan que se vende en cada caso', () => {
  const out = execFileSync(process.execPath, [
    '--experimental-test-module-mocks', '--no-warnings', '--import', 'tsx', join(RAIZ, 'tests/_plan-pedir-pro-hijo.ts'),
  ], { cwd: RAIZ, encoding: 'utf8', timeout: 180_000, maxBuffer: 8 * 1024 * 1024 });
  const d = JSON.parse(out.trim().split('\n').pop()!) as { nombres: Record<string, string | null>; yaEsPro: { plan: string | null } };
  assert.deepEqual(d.nombres, {
    pruebaEssential: 'MaKo Essential',
    pagaPro: 'MaKo Pro',
    deAgenciaConPlan: 'MaKo Essential',
    deAgenciaSinPlan: PLAN_DE_TU_AGENCIA,
    aMano: PLAN_A_MEDIDA,
    otraCapa: PLAN_A_MEDIDA,
    sinLeerRige: 'MaKo Pro',
  });
  // La prueba de MaKo Pro (la de la maqueta del onboarding): «MaKo Pro», no «Agencia».
  assert.equal(d.yaEsPro.plan, 'MaKo Pro');
});

test('4. las tres vistas piden el nombre a `nombreDelPlanDe`, y ninguna vuelve a la capa', () => {
  const vistas: Array<[string, RegExp]> = [
    ['app/configuraciones/plan/page.tsx', /<PlanPanel plan=\{await nombreDelPlanDe\(ws, capa\)\}/],
    ['app/m/configuraciones/plan/page.tsx', /<PlanM plan=\{await nombreDelPlanDe\(ws, capa\)\}/],
    ['app/configuraciones/plan/actions.ts', /const plan = await nombreDelPlanDe\(ws, await getCapaActual\(\)\);/],
  ];
  for (const [r, patron] of vistas) {
    const src = leer(r);
    assert.match(src, patron, `${r}: el nombre del plan sale de lib/plan-visible.ts`);
    assert.doesNotMatch(src, /capaDef\([^)]*\)\.nombre/, `${r}: volvió el nombre de la capa`);
  }
  // La acción lo importa con `import()`: los tests que corren las acciones de «Tu plan» con sus bordes simulados
  // (tests/prueba-topes.test.ts) no tienen lo que lee el plan, y no tienen por qué.
  assert.match(leer('app/configuraciones/plan/actions.ts'), /await import\('@\/lib\/plan-visible'\)/);
  // `rige` es el de la ficha de los tickets (`pagaUnPlanDe`), no otra lectura.
  assert.match(leer('lib/plan-visible.ts'), /pagaUnPlanDe\(ws, capa\)/);
});
