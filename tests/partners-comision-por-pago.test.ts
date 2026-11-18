import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COMISION_PARTNER_DIRECTO, COMISION_PARTNER_PASARELA, comisionDelPago } from '../lib/partners-reglas';

// La regla del 18/11/2026: 30 % por Binance/transferencia, 27 % por pasarela. La landing de Partners importa estos nombres.
test('las dos tasas son las que dijo Martín', () => {
  assert.equal(COMISION_PARTNER_DIRECTO, 0.3);
  assert.equal(COMISION_PARTNER_PASARELA, 0.27);
});

test('comisionDelPago: los números del brief, al centavo', () => {
  assert.equal(comisionDelPago(97, 'directo'), 29.1);
  assert.equal(comisionDelPago(97, 'pasarela'), 26.19);
  assert.equal(comisionDelPago(47, 'directo'), 14.1);
  assert.equal(comisionDelPago(47, 'pasarela'), 12.69);
});

test('comisionDelPago: un pago anual es el 30 % de lo que paga, no de un mes', () => {
  assert.equal(comisionDelPago(970, 'directo'), 291);
  assert.equal(comisionDelPago(970, 'pasarela'), 261.9);
});

test('comisionDelPago: sin plata o con basura no inventa nada', () => {
  assert.equal(comisionDelPago(0, 'directo'), 0);
  assert.equal(comisionDelPago(-50, 'pasarela'), 0);
  assert.equal(comisionDelPago(Number.NaN, 'directo'), 0);
});
