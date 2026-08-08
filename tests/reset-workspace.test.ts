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
import { OWNER_WS, WS_PRUEBA, exigirClienteDePrueba } from '../lib/auth-session';

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
