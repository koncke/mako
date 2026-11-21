// =============================================================================
// «IR A UN PASO» SIGUE SOLO EL PASO EN EL QUE ESTÁ (21/11/2026, Martín en producción, por el Cerebro: punto 2)
// =============================================================================
// «debería ir avanzando automáticamente, tipo seleccionándose en el paso que estoy. Si no, me pierdo». El server dice el paso del estado
// guardado (con las máquinas de verdad); el navegador, el del recorrido (el motor sabe en qué marca va). El desplegable lo muestra y se
// pone al día solo.
//
// ⚠️ PROBADO ROMPIÉNDOLO: ver al pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pasoActualDe } from '../lib/onboarding-v2/paso-actual';
import { estadoArranqueHasta, estadoRetoEnDia, PASOS_DE_REVISION } from '../lib/onboarding-v2/saltar';

const fuente = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const tel = { telefonoNumero: '5491155550101' };
const ahora = Date.parse('2026-11-21T12:00:00Z');

test('1. el paso del estado guardado: cada etapa del arranque, la llegada, «¿Qué hacemos ahora?» y el día abierto', () => {
  for (const p of ['bienvenida', 'nombre', 'telefono', 'agendado', 'agendado-no', 'negocio', 'origen', 'interes', 'cierre'] as const) {
    assert.equal(pasoActualDe({ arranque: estadoArranqueHasta(p, tel), terminado: false, reto: null, ahora }), p, p);
  }
  assert.equal(pasoActualDe({ arranque: estadoArranqueHasta('codigo', { ...tel, codigo: '111111' }), terminado: false, reto: null, ahora }), 'codigo');
  assert.equal(pasoActualDe({ arranque: null, terminado: true, reto: null, ahora }), 'llegada');
  assert.equal(pasoActualDe({ arranque: null, terminado: true, reto: estadoRetoEnDia(0, ahora), ahora }), 'reto');
  assert.equal(pasoActualDe({ arranque: null, terminado: true, reto: estadoRetoEnDia(3, ahora), ahora }), 'dia-3');
  const ids = new Set(PASOS_DE_REVISION.map((x) => x.id));
  assert.ok(['llegada', 'reto', 'dia-3', 'bienvenida'].every((x) => ids.has(x)), 'siempre un paso de la lista');
});

test('2. la ruta lo devuelve, el motor dice en qué marca va, y el desplegable lo muestra y se pone al día solo', () => {
  const r = sinComentarios(fuente('app/api/admin/saltar-onboarding/route.ts'));
  assert.match(r, /const actual = pasoActualDe\(\{/);
  assert.match(r, /pasos: PASOS_DE_REVISION, actual \}\)/);
  const st = sinComentarios(fuente('app/_ui/tutorial/store.ts'));
  assert.match(st, /export function anotarPasoDelMotor\(i: number \| null\): void/);
  // 21/11 (producción): en el MODO VIDEO, el paso de la frase que se muestra (antes `i`, que ahí queda en -1).
  const motor = sinComentarios(fuente('app/_ui/tutorial/MotorTutorial.tsx'));
  assert.match(motor, /const iMostrado = modoVideo \? \(pasoFrase \? pasos\.findIndex\(\(p\) => mismoLugar\(p\.sel, pasoFrase\.sel\)\) : null\) : i;/);
  assert.match(motor, /anotarPasoDelMotor\(pasoAnotado\.current\);/);
  const s = sinComentarios(fuente('app/_components/SaltarAPaso.tsx'));
  assert.match(s, /<select value=\{valor\}/, 'muestra el paso, no «Ir a un paso» fijo');
  assert.match(s, /const valor = delRecorrido \?\? actual \?\? '';/);
  assert.match(s, /window\.setInterval\(pedir, 5000\)/, 'se pone al día solo');
});

// ─────────────────────────────────────────────────────────────────────────────
// PROBADO ROMPIÉNDOLO (21/11/2026): la llegada como «reto» → 1; el desplegable con value="" → 2; sin ponerse al día → 2.
// ─────────────────────────────────────────────────────────────────────────────
