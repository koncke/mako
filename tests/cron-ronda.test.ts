import test from 'node:test';
import assert from 'node:assert/strict';
import { entraEnLaRonda, ordenRotado } from '../lib/cron-ronda';

test('entraEnLaRonda: entra solo si el trabajo mínimo entra ENTERO', () => {
  assert.equal(entraEnLaRonda(0, 285_000, 160_000), true);
  assert.equal(entraEnLaRonda(125_000, 285_000, 160_000), true);
  // Quedan 110 s: no entra una llamada a Opus. Se DIFIERE a la próxima ronda en vez
  // de arrancar algo que la plataforma mata a mitad, después de pagarlo.
  assert.equal(entraEnLaRonda(175_000, 285_000, 160_000), false);
  // Justo en el borde entra: el chequeo es <=, no <.
  assert.equal(entraEnLaRonda(125_000, 285_000, 160_000), true);
  assert.equal(entraEnLaRonda(0, 0, 0), true); // sin mínimo, siempre entra
});

test('ordenRotado: la ronda arranca en el SIGUIENTE al último servido', () => {
  assert.deepEqual(ordenRotado([1, 3, 5, 9], null), [1, 3, 5, 9]);
  assert.deepEqual(ordenRotado([1, 3, 5, 9], 3), [5, 9, 1, 3]);
  assert.deepEqual(ordenRotado([1, 3, 5, 9], 9), [1, 3, 5, 9]);
  assert.deepEqual(ordenRotado([1, 3, 5, 9], 4), [5, 9, 1, 3]); // cursor de un ws pausado
  assert.deepEqual(ordenRotado([], 3), []);
});

test('con 10 clientes y 2 turnos por ronda, nadie queda sin turno en 5 rondas', () => {
  const ids = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const vistos = new Set<number>();
  let cursor: number | null = null;
  for (let ronda = 0; ronda < 5; ronda++) {
    for (const ws of ordenRotado(ids, cursor).slice(0, 2)) {
      vistos.add(ws);
      cursor = ws;
    }
  }
  // Ésta es la invariante que importa y la que falla contra el código viejo: sin
  // rotación el orden es siempre el mismo, así que 8 de los 10 clientes no reciben
  // servicio NUNCA — no «más tarde»: nunca.
  assert.equal(vistos.size, 10);
});
