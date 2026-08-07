// =============================================================================
// Los puntitos del WizardShell: honestos o mudos, pero nunca mentirosos
// =============================================================================
// Lo que se prueba acá no es cosmético. La fila de puntitos es una PROMESA
// ("faltan dos pantallas y terminás"), y un wizard con ramas la rompe todo el
// tiempo: el mapa crece cuando elegís una opción, o el paso salta de la 1 a la 3
// porque el medio no aplicaba. La pieza no puede arreglar la cuenta del
// llamador, pero sí puede dejar de firmarla.
//
// El caso que motivó estos tests: los DOS modos —el mapa y los dos números—
// tienen que responder IGUAL al mismo estado. No lo hacían: con la cuenta en
// cero y `enUltimo` en false, el modo `cuenta` decía "faltan pasos" y el modo
// `mapa` decía "Último paso" con un "Siguiente →" abajo.
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { colaDeProgreso, etiquetaProgreso } from '../app/_components/wizard-progreso';

const mapa = (largo: number, pos: number, enUltimo: boolean, variable = false) =>
  colaDeProgreso({ modo: 'mapa', largo, pos, variable, enUltimo });
const cuenta = (total: number | undefined, actual: number, enUltimo: boolean, salto = false) =>
  colaDeProgreso({ modo: 'cuenta', total, actual, salto, enUltimo });

// ── enUltimo manda, en las dos direcciones ───────────────────────────────────

test('enUltimo dice que no hay más: no queda cola, cuente lo que cuente el mapa', () => {
  assert.equal(mapa(5, 2, true), 0);
  assert.equal(cuenta(5, 2, true), 0);
});

test('LA CONTRADICCIÓN: cuenta cero + enUltimo false → "faltan pasos" en LOS DOS modos', () => {
  // Estado real del onboarding: el mapa son las SECCIONES y hay varias pantallas
  // por sección, así que en la primera pantalla de la última sección la posición
  // ya es la última del mapa y todavía faltan dos pantallas.
  assert.equal(mapa(4, 3, false), -1, 'el mapa pintaba "Último paso" con un "Siguiente →" abajo');
  assert.equal(cuenta(4, 3, false), -1);
  // Y no es que uno sea más laxo: el mismo estado da lo mismo en los dos.
  for (const n of [1, 2, 5, 12]) assert.equal(mapa(n, n - 1, false), cuenta(n, n - 1, false));
});

// ── Modo mapa ────────────────────────────────────────────────────────────────

test('la cola del mapa es EXACTA mientras el mapa no se mueva', () => {
  assert.equal(mapa(5, 0, false), 4);
  assert.equal(mapa(5, 3, false), 1);
});

test('un mapa que ya cambió a la vista no vuelve a prometer una cantidad', () => {
  assert.equal(mapa(5, 1, false, true), -1);
  // Pegajoso pero no absurdo: si igual estás en el último, sigue siendo 0.
  assert.equal(mapa(5, 1, true, true), 0);
});

test('un paso que no está en el mapa no habilita a contar desde una posición inventada', () => {
  // `indexOf` devuelve -1 con el mapa vacío o con un `pasoActual` que quedó viejo.
  assert.equal(mapa(0, -1, false), -1);
  assert.equal(mapa(6, -1, false), -1);
});

// ── Modo cuenta (total/idx) ──────────────────────────────────────────────────

test('sin total no se promete nada', () => {
  assert.equal(cuenta(undefined, 0, false), -1);
  assert.equal(cuenta(Number.NaN, 0, false), -1);
});

test('un idx que se pasó del total no puede dar una cola negativa', () => {
  assert.equal(cuenta(3, 7, false), -1);
  assert.equal(cuenta(3, 2, false), -1, 'estar en el último de la cuenta sin enUltimo es la contradicción de arriba');
});

test('un salto probado deja el total inservible para contar lo que queda', () => {
  assert.equal(cuenta(10, 2, false), 7);
  assert.equal(cuenta(10, 2, false, true), -1);
});

// ── La leyenda (es también el aria-label de los puntitos) ────────────────────

test('la leyenda no dice una cantidad cuando no la sabe', () => {
  assert.equal(etiquetaProgreso(0, 3), 'Paso 1 de 4');
  assert.equal(etiquetaProgreso(2, 0), 'Último paso (3)');
  assert.equal(etiquetaProgreso(2, -1), 'Paso 3 · faltan pasos');
});
