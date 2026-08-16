// =============================================================================
// El Reset solo puede vaciar el cliente de prueba
// =============================================================================
// Es la operación más destructiva de la app: 50+ tablas y 4 buckets de storage,
// sin vuelta atrás. Durante meses el guard fue `ws !== OWNER_WS` —una condición
// NEGATIVA— así que protegía a Mauricio y a nadie más: vaciar el workspace de un
// cliente real estaba a un click.
//
// Este test existe para que eso no pueda volver en silencio. Si alguien afloja
// la condición, acá se cae.
//
// Se prueba `exigirClienteDePrueba`, que es la condición sola. `reset-workspace.ts`
// no se puede importar desde un test (`server-only` lo corta), y por eso la
// condición vive afuera: si estuviera adentro, la guarda más peligrosa de la app
// sería la única sin test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OWNER_WS, WS_PRUEBA, WS_DISENO, WS_PRUEBAS, esClienteDePrueba, exigirClienteDePrueba } from '../lib/auth-session';

test('el workspace del dueño no se vacía nunca', () => {
  assert.throws(() => exigirClienteDePrueba(OWNER_WS), /dueño/i);
});

test('un cliente REAL tampoco se vacía, aunque no sea el dueño', () => {
  // El caso que el guard viejo dejaba pasar: decía `ws !== OWNER_WS`, así que
  // cualquiera de estos entraba. Se prueban varios para que no alcance con
  // excluir uno a mano.
  for (const ws of [9, 10, 11, 42]) {
    assert.notEqual(ws, WS_PRUEBA, 'el id de prueba no puede estar en esta lista');
    assert.throws(
      () => exigirClienteDePrueba(ws),
      /cliente de prueba/i,
      `el workspace ${ws} es de un cliente real y no debería poder vaciarse`,
    );
  }
});

test('el cliente de prueba sí pasa', () => {
  assert.doesNotThrow(() => exigirClienteDePrueba(WS_PRUEBA));
});

test('el cliente de DISEÑO también pasa, y es el único otro que puede', () => {
  assert.doesNotThrow(() => exigirClienteDePrueba(WS_DISENO));
  // La lista blanca tiene exactamente dos. Si mañana alguien agrega un tercero
  // sin pensarlo, este test lo obliga a pasar por acá y a justificarlo.
  assert.deepEqual([...WS_PRUEBAS].sort((a, b) => a - b), [WS_PRUEBA, WS_DISENO].sort((a, b) => a - b));
  assert.equal(WS_PRUEBAS.length, 2);
});

test('el de diseño no es el del dueño ni pisa un cliente real que exista', () => {
  assert.notEqual(WS_DISENO, OWNER_WS);
  // 5 es un cliente REAL (Ananda) y 9/10/11 son personas del equipo: el id del
  // cliente de diseño no puede ser ninguno de ésos, o «crearlo» sería
  // apropiarse de un workspace ajeno.
  for (const real of [5, 9, 10, 11]) assert.notEqual(WS_DISENO, real);
});

test('esClienteDePrueba no tira y contesta lo mismo que el guard', () => {
  for (const ws of [WS_PRUEBA, WS_DISENO]) assert.equal(esClienteDePrueba(ws), true);
  for (const ws of [OWNER_WS, 5, 9, 42]) assert.equal(esClienteDePrueba(ws), false);
  // Es la versión que decide qué PINTAR, así que no puede explotar con basura.
  for (const malo of [null, undefined, NaN, 0.5]) {
    assert.doesNotThrow(() => esClienteDePrueba(malo as unknown as number));
    assert.equal(esClienteDePrueba(malo as unknown as number), false);
  }
});

test('un workspace que no es un entero se rechaza antes que nada', () => {
  for (const malo of [0.5, NaN, -1]) {
    assert.throws(() => exigirClienteDePrueba(malo));
  }
});

test('el de prueba y el del dueño no pueden ser el mismo', () => {
  // Si alguien pusiera WS_PRUEBA = 1 «para probar», el guard del dueño lo
  // frenaría igual — pero el mensaje sería confuso y la intención, imposible.
  assert.notEqual(WS_PRUEBA, OWNER_WS);
});
