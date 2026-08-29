// =============================================================================
// La forma se adapta; el cierre, no
// =============================================================================
// El dueño, después de ver el primer arreglo: *«si me gusta que le puso el acento
// de Mauricio y sus muletillas, eso sí está muy bien, pero que le cambie el CTA,
// para nada»*.
//
// O sea que el contrato tiene DOS mitades y una sola es rígida. Estos tests
// cubren la rígida —dónde empieza el cierre y qué tomas lo llevan— y la métrica
// que distingue «lo mismo dicho de otra forma» de «otra cosa».

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cierreDeGuion, tomasDelCierre, fidelidad } from '../lib/guion-cierre';

const CON_ROTULOS = `GANCHO
El viernes vas a terminar resolviendo un problema que ya existía desde el lunes.

PROBLEMA
El lunes preguntas si llegan y todos dicen que sí.

CTA
En el video del enlace te explico cómo construir ese sistema.
Da click en el enlace.`;

const SIN_ROTULOS = `El viernes vas a terminar resolviendo un problema que ya existía desde el lunes.
El lunes preguntas si llegan y todos dicen que sí.
En el video del enlace te explico cómo construir ese sistema.
Da click en el enlace.`;

// ── Dónde empieza el cierre ────────────────────────────────────────────────

test('con rótulos, el cierre sale del bloque CTA', () => {
  const c = cierreDeGuion(CON_ROTULOS);
  assert.match(c, /^En el video del enlace/);
  assert.match(c, /Da click en el enlace\.$/);
  assert.ok(!/GANCHO|PROBLEMA|CTA/.test(c), 'se coló un rótulo en el cierre');
  assert.ok(!/todos dicen que sí/.test(c), 'se llevó texto que no era del cierre');
});

test('sin rótulos, el cierre son las últimas frases', () => {
  const c = cierreDeGuion(SIN_ROTULOS);
  assert.match(c, /Da click en el enlace\.$/);
  assert.ok(!/El viernes vas a terminar/.test(c), 'se llevó el guion entero');
});

test('el cierre toma varias frases si la última es corta', () => {
  // Un CTA suele ser dos frases: la promesa y la orden. Quedarse solo con «Da
  // click en el enlace» dejaría adaptable la parte que dice A DÓNDE manda.
  const c = cierreDeGuion(SIN_ROTULOS);
  assert.match(c, /En el video del enlace te explico/);
});

test('otros rótulos de cierre también valen', () => {
  for (const rot of ['ACCION', 'LLAMADO', 'CIERRE']) {
    const t = `GANCHO\nAlgo pasa acá y se cuenta entero.\n\n${rot}\nEntra al link ahora mismo.`;
    assert.equal(cierreDeGuion(t), 'Entra al link ahora mismo.', `falló con ${rot}`);
  }
});

test('un guion vacío no tiene cierre y no revienta', () => {
  assert.equal(cierreDeGuion(''), '');
  assert.equal(cierreDeGuion('   \n  '), '');
});

// ── Qué tomas lo llevan ────────────────────────────────────────────────────

const tomas = (...ns: number[]) => ns.map((palabras) => ({ palabras }));

test('las tomas del cierre se cuentan desde el final', () => {
  // 7 tomas de 20 palabras, cierre de 24 → entran las dos últimas.
  const s = tomasDelCierre(tomas(20, 20, 20, 20, 20, 20, 20), 24);
  assert.deepEqual([...s].sort((a, b) => a - b), [5, 6]);
});

test('un cierre que entra en una sola toma marca una sola', () => {
  const s = tomasDelCierre(tomas(20, 20, 20, 24), 24);
  assert.deepEqual([...s], [3]);
});

test('la última toma SIEMPRE es literal, aunque no se reconozca el cierre', () => {
  // Un guion sin cierre reconocible igual termina en algún lado, y esa última
  // frase es lo que la persona dice antes de que corte.
  const s = tomasDelCierre(tomas(20, 20, 20), 0);
  assert.deepEqual([...s], [2]);
});

test('un cierre más largo que el guion no rompe: marca todo', () => {
  const s = tomasDelCierre(tomas(10, 10), 500);
  assert.deepEqual([...s].sort((a, b) => a - b), [0, 1]);
});

test('sin tomas devuelve conjunto vacío', () => {
  assert.equal(tomasDelCierre([], 20).size, 0);
});

// ── La métrica del desvío ──────────────────────────────────────────────────

test('agregar muletillas NO cuenta como desvío', () => {
  // Es LA razón por la que la métrica ignora las palabras vacías: sumar «mira»,
  // «pues» o «la verdad» es exactamente la adaptación que se quiere.
  const orig = 'El viernes vas a terminar resolviendo un problema que ya existía desde el lunes.';
  const adap = 'Mira, pues el viernes vas a terminar resolviendo un problema que, la verdad, ya existía desde el lunes.';
  assert.equal(fidelidad(orig, adap), 1);
});

test('EL CASO REAL: cambiar el CTA sí es un desvío', () => {
  const orig = 'En el video del enlace te explico cómo construir ese sistema para detectar el incendio antes de que empiece.';
  const adap = 'Toca el botón aquí abajo, deja tus datos en el formulario y te mando los detalles completos.';
  assert.ok(fidelidad(orig, adap) < 0.2, `la fidelidad dio ${fidelidad(orig, adap)}, tendría que ser casi cero`);
});

test('decir lo mismo más corto no se marca como desvío grave', () => {
  const orig = 'Porque puedes contratar al gerente más exigente del mundo y seis meses después estar exactamente igual.';
  const adap = 'Puedes contratar al gerente más exigente y seguir igual seis meses después.';
  assert.ok(fidelidad(orig, adap) >= 0.45, `la fidelidad dio ${fidelidad(orig, adap)}`);
});

test('un original sin palabras con contenido da fidelidad 1', () => {
  // Sin nada que comparar, no se puede afirmar que se alejó. La métrica dice
  // «no sé» del lado bueno: marcar de menos y nunca de más.
  assert.equal(fidelidad('y el', 'cualquier otra cosa'), 1);
});
