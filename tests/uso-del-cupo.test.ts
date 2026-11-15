// =============================================================================
// El cupo de IA es un TECHO, no un costo (7/11/2026)
// =============================================================================
// Martín: «muy probablemente muchos no gasten al 100% de los MaKo Tokens, y eso me reduce un montón el gasto por cliente».
// Tenía razón, y el número es grande: entre que nadie use el cupo y que todos lo agoten hay un techo entero por cliente
// por mes (hoy US$24 en el plan de US$97).
//
// ⚠️ ACÁ NO SE ESCRIBE EL NÚMERO DEL CUPO, SE LEE. Este archivo tenía «24,25» en siete lugares y en el título de tres
// tests, y el 15/11 se puso rojo entero porque Martín cambió el cupo: el test se rompió por una DECISIÓN, que es
// exactamente lo que un test no tiene que hacer. Un número de negocio transcripto también calla cuando el cálculo se
// rompe de verdad, porque los dos lados dicen lo mismo por casualidad y no por construcción.
//
// Correr: node --import tsx --test tests/uso-del-cupo.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { techoDeIa, dejaConUso, tasaDeUsoMedida, compraDelMes } from '../lib/uso-del-cupo';
import { dejaUnCliente } from '../lib/economia-unitaria';
import { CUPO_MENSUAL, usdDeMt } from '../lib/mako-tokens-reglas';

const PLAN_97 = 97;
/** El techo, leído de donde vive. Si alguien lo cambia, estos tests se mueven con él en vez de ponerse rojos. */
const TECHO_97 = techoDeIa('growth');

test('el cupo de un plan es su techo de IA, y es lo que el cupo COMPRA', () => {
  // La igualdad que importa: el techo en dólares es el cupo en MaKo Tokens a la unidad de la casa (1.000 MT = US$1).
  assert.equal(TECHO_97, usdDeMt(CUPO_MENSUAL.growth));
  assert.equal(techoDeIa('pro'), usdDeMt(CUPO_MENSUAL.pro));
  // Y el orden, que sí es una decisión de producto: el plan caro tiene más techo.
  assert.ok(TECHO_97 > techoDeIa('pro'), 'el plan de US$97 tiene que dar más IA que el de US$47');
});

test('entre no usar nada y agotar el cupo hay un techo entero por cliente por mes', () => {
  const sinUso = dejaConUso(PLAN_97, 'growth', 0);
  const todo = dejaConUso(PLAN_97, 'growth', 1);
  // Lo que deja un cliente que no genera nada NO depende del cupo: es la cuenta sin IA, y por eso sí va escrito.
  assert.ok(Math.abs(sinUso - 76.37) < 0.01, `sin uso deja US$${sinUso.toFixed(2)}`);
  // La diferencia entre los dos extremos es el techo, ni más ni menos. Ésta es la propiedad, no el número.
  assert.ok(Math.abs(sinUso - todo - TECHO_97) < 0.01, `la diferencia dio US$${(sinUso - todo).toFixed(2)} y el techo es US$${TECHO_97}`);
});

test('⚠️ «deja US$76,37» es el TECHO, no lo típico: es el cliente que no genera nada', () => {
  // dejaUnCliente no resta cupo a propósito (es la cuenta sin IA). Si alguien lo usa como «lo que deja un cliente»
  // sin decir a qué uso, está mostrando el mejor caso como si fuera el normal. Eso pasó el 7/11.
  assert.ok(Math.abs(dejaUnCliente(PLAN_97) - dejaConUso(PLAN_97, 'growth', 0)) < 1e-9);
});

test('pasarse del cupo no sigue restando: el medidor lo frena', () => {
  assert.equal(dejaConUso(PLAN_97, 'growth', 3), dejaConUso(PLAN_97, 'growth', 1));
  assert.equal(dejaConUso(PLAN_97, 'growth', -1), dejaConUso(PLAN_97, 'growth', 0));
});

test('la tasa de uso REAL sale del gasto contra el cupo, y sin datos es null y NO cero', () => {
  // 12 clientes de growth: el techo son 12 × el techo del plan, y se gasta el 10% de eso.
  const m = tasaDeUsoMedida(12 * TECHO_97 * 0.1, 12, 'growth');
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
  assert.equal(compraDelMes('growth', 0), TECHO_97, 'cuenta vacía: se compra el cupo entero');
  assert.equal(compraDelMes('growth', 20), Math.round((TECHO_97 - 20) * 100) / 100, 'con US$20 sin gastar, se repone sólo lo que falta');
  assert.equal(compraDelMes('growth', TECHO_97), 0, 'no gastó nada: no se compra NADA este mes');
  assert.equal(compraDelMes('growth', 100), 0, 'con saldo de sobra tampoco se compra');
});

test('un saldo roto no hace comprar de más: cae a 0 y se compra el cupo entero', () => {
  for (const malo of [Number.NaN, -5, Number.POSITIVE_INFINITY]) {
    assert.equal(compraDelMes('growth', malo as number), TECHO_97, `${malo} tenía que caer a 0`);
  }
});
