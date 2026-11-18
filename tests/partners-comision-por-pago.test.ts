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

// ── Un crédito por CADA pago (lo puro; el cron lo ejercita tests/partners-credito-simulado.test.ts) ─────────────────────────
import { canalDelPago, creditosDeUnReferido, PAGOS_QUE_CUBRE_EL_CREDITO_VIEJO } from '../lib/partners-reglas';

test('canalDelPago: pasarela si tiene proveedor o es tarjeta; Binance, transferencia y efectivo son directo; lo dudoso, la tasa menor', () => {
  assert.equal(canalDelPago({ proveedor: 'mercadopago', metodo: 'tarjeta' }), 'pasarela');
  assert.equal(canalDelPago({ proveedor: 'stripe' }), 'pasarela');
  assert.equal(canalDelPago({ proveedor: 'creem', metodo: null }), 'pasarela');
  assert.equal(canalDelPago({ proveedor: null, metodo: 'cripto' }), 'directo', 'Binance (USDT/USDC) entra como cripto');
  assert.equal(canalDelPago({ proveedor: null, metodo: 'transferencia' }), 'directo');
  assert.equal(canalDelPago({ proveedor: null, metodo: 'efectivo' }), 'directo');
  assert.equal(canalDelPago({ proveedor: null, metodo: 'tarjeta' }), 'pasarela');
  assert.equal(canalDelPago({ proveedor: null, metodo: 'otro' }), 'pasarela', 'no se sabe: nunca se acredita de más');
  assert.equal(canalDelPago({}), 'pasarela');
});

const pago = (id: number, fecha: string, montoUsd: number | null, extra: Record<string, unknown> = {}) => ({ id, fecha, montoUsd, ...extra });

test('creditosDeUnReferido: uno por cada pago, en orden, cada uno con su canal', () => {
  const r = creditosDeUnReferido({
    pagos: [pago(3, '2026-12-25', 97, { metodo: 'transferencia' }), pago(1, '2026-10-25', 97, { proveedor: 'mercadopago' }), pago(2, '2026-11-25', 97, { metodo: 'cripto' })],
    yaAcreditados: new Set(), teniaCreditoViejo: false,
  });
  assert.deepEqual(r.acreditar.map((c) => [c.pagoId, c.canal, c.comisionUsd]), [[1, 'pasarela', 26.19], [2, 'directo', 29.1], [3, 'directo', 29.1]]);
  assert.deepEqual(r.sinMonto, []);
});

test('creditosDeUnReferido: lo ya acreditado no se repite, y un pago anual vale el % de lo que pagó', () => {
  const r = creditosDeUnReferido({
    pagos: [pago(1, '2026-10-25', 97, { metodo: 'cripto' }), pago(2, '2026-11-25', 970, { metodo: 'cripto' })],
    yaAcreditados: new Set([1]), teniaCreditoViejo: false,
  });
  assert.deepEqual(r.acreditar.map((c) => [c.pagoId, c.comisionUsd]), [[2, 291]]);
});

test('creditosDeUnReferido: quien ya ganó con la regla VIEJA no gana otra vez por sus 2 primeros pagos, y del 3º en adelante sí', () => {
  assert.equal(PAGOS_QUE_CUBRE_EL_CREDITO_VIEJO, 2);
  const pagos = [pago(1, '2026-09-25', 97, { metodo: 'cripto' }), pago(2, '2026-10-25', 97, { metodo: 'cripto' }), pago(3, '2026-11-25', 97, { metodo: 'cripto' })];
  assert.deepEqual(creditosDeUnReferido({ pagos, yaAcreditados: new Set(), teniaCreditoViejo: true }).acreditar.map((c) => c.pagoId), [3]);
  assert.deepEqual(creditosDeUnReferido({ pagos, yaAcreditados: new Set(), teniaCreditoViejo: false }).acreditar.map((c) => c.pagoId), [1, 2, 3], 'sin crédito viejo, también el primero');
});

test('creditosDeUnReferido: un pago sin monto en dólares no se acredita (no se inventa la plata) y se informa', () => {
  const r = creditosDeUnReferido({ pagos: [pago(1, '2026-10-25', null), pago(2, '2026-11-25', 0), pago(3, '2026-12-25', 47, { metodo: 'cripto' })], yaAcreditados: new Set(), teniaCreditoViejo: false });
  assert.deepEqual(r.acreditar.map((c) => c.pagoId), [3]);
  assert.deepEqual(r.sinMonto, [1, 2]);
});

test('creditosDeUnReferido: el pago cuenta hasta el precio de lista × sus meses (un US$ 1.500 no deja el 30 % de 1.500; un anual de 12 meses, sí)', () => {
  const r = creditosDeUnReferido({
    pagos: [pago(1, '2026-10-25', 1500, { metodo: 'cripto', topeUsd: 97 }), pago(2, '2026-11-25', 970, { metodo: 'cripto', topeUsd: 1164 }), pago(3, '2026-12-25', 60, { metodo: 'cripto', topeUsd: 97 })],
    yaAcreditados: new Set(), teniaCreditoViejo: false,
  });
  assert.deepEqual(r.acreditar.map((c) => [c.pagoId, c.pagoUsd, c.comisionUsd, c.topado]), [[1, 97, 29.1, true], [2, 970, 291, false], [3, 60, 18, false]]);
});
