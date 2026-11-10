// =============================================================================
// El cupo de IA es un TECHO, no un costo (7/11/2026)
// =============================================================================
// Martín: «muy probablemente muchos no gasten al 100% de los MaKo Tokens, y eso me reduce un montón el gasto por cliente».
// Tenía razón, y el número es grande: entre que nadie use el cupo y que todos lo agoten hay US$24,25 por cliente por mes.
//
// Correr: node --import tsx --test tests/uso-del-cupo.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { techoDeIa, dejaConUso, tasaDeUsoMedida, compraDelMes } from '../lib/uso-del-cupo';
import { dejaUnCliente } from '../lib/economia-unitaria';

const PLAN_97 = 97;

test('el cupo del plan de 97 son US$24,25 de IA: ése es el techo, no el costo', () => {
  assert.ok(Math.abs(techoDeIa('growth') - 24.25) < 0.001);
  assert.ok(Math.abs(techoDeIa('pro') - 11.75) < 0.001);
});

test('entre no usar nada y agotar el cupo hay US$24,25 por cliente por mes', () => {
  const sinUso = dejaConUso(PLAN_97, 'growth', 0);
  const todo = dejaConUso(PLAN_97, 'growth', 1);
  assert.ok(Math.abs(sinUso - 82.78) < 0.01, `sin uso deja US$${sinUso.toFixed(2)}`);
  assert.ok(Math.abs(todo - 58.53) < 0.01, `agotándolo deja US$${todo.toFixed(2)}`);
  assert.ok(Math.abs(sinUso - todo - 24.25) < 0.01);
});

test('⚠️ «deja US$82,78» es el TECHO, no lo típico: es el cliente que no genera nada', () => {
  // dejaUnCliente no resta cupo a propósito (es la cuenta sin IA). Si alguien lo usa como «lo que deja un cliente»
  // sin decir a qué uso, está mostrando el mejor caso como si fuera el normal. Eso pasó el 7/11.
  assert.ok(Math.abs(dejaUnCliente(PLAN_97) - dejaConUso(PLAN_97, 'growth', 0)) < 1e-9);
});

test('pasarse del cupo no sigue restando: el medidor lo frena', () => {
  assert.equal(dejaConUso(PLAN_97, 'growth', 3), dejaConUso(PLAN_97, 'growth', 1));
  assert.equal(dejaConUso(PLAN_97, 'growth', -1), dejaConUso(PLAN_97, 'growth', 0));
});

test('la tasa de uso REAL sale del gasto contra el cupo, y sin datos es null y NO cero', () => {
  // 12 clientes de growth: el techo son 12 × 24,25 = US$291
  const m = tasaDeUsoMedida(29.1, 12, 'growth');
  assert.ok(m.tasa != null && Math.abs(m.tasa - 0.1) < 1e-9, 'gastaron el 10% del cupo');
  assert.equal(m.aviso, null);

  assert.equal(tasaDeUsoMedida(null, 12, 'growth').tasa, null, 'un 0 leería «nadie usa nada», que es la conclusión que queremos MEDIR');
  assert.ok(tasaDeUsoMedida(null, 12, 'growth').aviso);
  assert.equal(tasaDeUsoMedida(100, 0, 'growth').tasa, null, 'sin clientes no hay contra qué medir');
});

test('gastar más que el cupo no da una tasa mayor a 1', () => {
  assert.equal(tasaDeUsoMedida(1000, 12, 'growth').tasa, 1);
});

test('la compra del mes es el DIFERENCIAL: sólo lo que falta para llegar al techo', () => {
  assert.equal(compraDelMes('growth', 0), 24.25, 'cuenta vacía: se compra el cupo entero');
  assert.equal(compraDelMes('growth', 20), 4.25, 'si quedaron US$20 sin gastar, se reponen 4,25');
  assert.equal(compraDelMes('growth', 24.25), 0, 'no gastó nada: no se compra NADA este mes');
  assert.equal(compraDelMes('growth', 100), 0, 'con saldo de sobra tampoco se compra');
});

test('un saldo roto no hace comprar de más: cae a 0 y se compra el cupo entero', () => {
  for (const malo of [Number.NaN, -5, Number.POSITIVE_INFINITY]) {
    assert.equal(compraDelMes('growth', malo as number), 24.25, `${malo} tenía que caer a 0`);
  }
});
