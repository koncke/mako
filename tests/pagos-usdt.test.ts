// =============================================================================
// P30 (17/11/2026): el pago del CRM puede guardar USDT/USDC, y «Cargar pago» le pasa la moneda del recibo
// =============================================================================
// Código Inmobiliario paga en USDT. Los recibos ya guardaban la moneda (mig 0397), pero el pago del CRM nacía SIN moneda: el CHECK de la 0255
// (`'^[A-Z]{3}$'`) y `normalizarMoneda` rechazaban 'USDT', y sin moneda un pago cuenta como dólares sin rastro. Ahora:
//   · `normalizarMonedaDePago` acepta las de 3 letras y las stablecoins en dólares (USDT, USDC); `normalizarMoneda` —la de las pasarelas—
//     NO cambia: Stripe y Mercado Pago no cobran en cripto;
//   · `pagoEnMoneda` toma los dólares de una stablecoin de lo cobrado (1:1, sin tasa inventada);
//   · `monedaDelPago` decide la moneda de UN pago del CRM a partir de los cobros del recibo, y es null si se mezclan o falta el monto;
//   · la mig 0417 ensancha el CHECK, y `registrarReciboEnElCrm` reintenta SIN moneda si la base todavía no la tiene (el orden de deploy no importa).
// Probado ROMPIÉNDOLO (17/11/2026): ver el pie.
// Correr: node --import tsx --test tests/pagos-usdt.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizarMoneda, normalizarMonedaDePago } from '../lib/pasarela-moneda';
import { pagoEnMoneda } from '../lib/pagos-campo';
import { monedaDelPago, planParaElCrm, type CobroDelRecibo } from '../lib/recibos-reglas';

const RAIZ = join(__dirname, '..');
const cobro = (extra: Partial<CobroDelRecibo> = {}): CobroDelRecibo => ({
  id: 1, medio: 'binance', referencia: 'A1', fecha: '2026-11-10', monto_usd: 94, anulado: false, pago_id: null, monto: 94, moneda: 'USDT', ...extra,
});

test('normalizarMonedaDePago: ISO de 3 letras y USDT/USDC; la de las pasarelas sigue sin aceptar cripto', () => {
  assert.equal(normalizarMonedaDePago(' usdt '), 'USDT');
  assert.equal(normalizarMonedaDePago('USDC'), 'USDC');
  assert.equal(normalizarMonedaDePago('mxn'), 'MXN');
  assert.equal(normalizarMonedaDePago('USD'), 'USD');
  for (const mala of ['DOGE', 'USDTX', 'US', '', null, undefined, 'U$D']) assert.equal(normalizarMonedaDePago(mala as string | null), null, String(mala));
  assert.equal(normalizarMoneda('USDT'), null, 'Stripe y Mercado Pago no cobran en cripto');
});

test('pagoEnMoneda: una stablecoin vale sus dólares sin pedirlos; las demás monedas siguen pidiendo los dólares', () => {
  assert.deepEqual(pagoEnMoneda({ moneda: 'USDT', montoOriginal: 426 }), { ok: true, montoUsd: 426, moneda: 'USDT', montoOriginal: 426 });
  assert.deepEqual(pagoEnMoneda({ moneda: 'usdc', montoOriginal: 94.5, montoUsd: 94.4 }), { ok: true, montoUsd: 94.4, moneda: 'USDC', montoOriginal: 94.5 });
  const mxn = pagoEnMoneda({ moneda: 'MXN', montoOriginal: 1700 });
  assert.equal(mxn.ok, false, 'sin los dólares, un pago en pesos no inventa una tasa');
  assert.deepEqual(pagoEnMoneda({ moneda: 'DOGE4', montoOriginal: 5 }).ok, false);
  const sinMonto = pagoEnMoneda({ moneda: 'USDT' });
  assert.equal(sinMonto.ok, false);
});

test('monedaDelPago: dos órdenes USDT del mismo mes son UN pago en USDT; mezcladas, en dólares o sin monto, nace como siempre', () => {
  assert.deepEqual(monedaDelPago([cobro({ id: 1, monto: 94 }), cobro({ id: 2, monto: 144 })]), { moneda: 'USDT', montoOriginal: 238 });
  assert.deepEqual(monedaDelPago([cobro({ moneda: 'USDT' }), cobro({ id: 2, moneda: 'MXN' })]), { moneda: null, montoOriginal: null });
  assert.deepEqual(monedaDelPago([cobro({ moneda: 'USD' })]), { moneda: null, montoOriginal: null });
  assert.deepEqual(monedaDelPago([cobro({ moneda: null })]), { moneda: null, montoOriginal: null });
  assert.deepEqual(monedaDelPago([cobro({ monto: null })]), { moneda: null, montoOriginal: null });
  assert.deepEqual(monedaDelPago([cobro({ moneda: 'AB1' })]), { moneda: null, montoOriginal: null });
});

test('planParaElCrm: el pago nuevo lleva la moneda de los cobros que registra, y no la de los que ya tienen su pago', () => {
  const plan = planParaElCrm([cobro({ id: 1, monto: 94, monto_usd: 94 }), cobro({ id: 2, referencia: 'B2', monto: 144, monto_usd: 144 }), cobro({ id: 3, referencia: 'C3', pago_id: 77, moneda: 'MXN', monto: 9 })], new Map());
  assert.deepEqual(plan.registrar, { ids: [1, 2], usd: 238, fecha: '2026-11-10', moneda: 'USDT', montoOriginal: 238 });
});

test('la mig 0417 ensancha el CHECK de pagos.moneda a 3-5 letras, sin tocar filas', () => {
  const sql = readFileSync(join(RAIZ, 'supabase/migrations/0417_pagos_moneda_cripto.sql'), 'utf8').replace(/\r\n/g, '\n').replace(/^--.*$/gm, '');
  assert.match(sql, /alter table pagos drop constraint if exists pagos_moneda_check;/);
  assert.match(sql, /alter table pagos add constraint pagos_moneda_check check \(moneda is null or moneda ~ '\^\[A-Z\]\{3,5\}\$'\);/);
  assert.doesNotMatch(sql, /\b(update|delete|insert)\b/i, 'sólo cambia el CHECK');
});

test('«Cargar pago» pasa la moneda al pago del CRM y, si la base no la acepta todavía, reintenta SIN ella', () => {
  const src = readFileSync(join(RAIZ, 'lib/recibos.ts'), 'utf8').replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '');
  assert.match(src, /select\('id, medio, referencia, fecha, monto, moneda, monto_usd, anulado, pago_id'\)/);
  assert.match(src, /registrarPagoSuelto\(lead\.id, moneda \? \{ \.\.\.base, moneda, montoOriginal \} : base\)/);
  assert.match(src, /if \(!moneda \|\| !\/pagos_moneda_check\/\.test\(msg\(e\)\)\) throw e;/);
  assert.match(src, /registrarPagoSuelto\(lead\.id, base\)/);
});

// Probado ROMPIENDO (17/11/2026), una rotura por vez y restaurando de memoria. Con el código como está: 6 pases, 0 fallos.
// Rota (pases / fallos):
//   · USDT fuera de STABLECOINS_USD                                                      → 2 / 4
//   · `normalizarMoneda` (la de las pasarelas) acepta hasta 5 letras                     → 5 / 1
//   · pagoEnMoneda sin los dólares de la stablecoin                                      → 5 / 1
//   · monedaDelPago acepta monedas mezcladas / sin monto                                 → 5 / 1
//   · planParaElCrm no pasa la moneda al pago                                            → 5 / 1
//   · registrarReciboEnElCrm sin el reintento sin moneda                                 → 5 / 1
//   · la mig 0417 deja el CHECK en 3 letras                                              → 5 / 1
