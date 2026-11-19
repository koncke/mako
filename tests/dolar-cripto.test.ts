// =============================================================================
// Los pesos del checkout al dólar CRIPTO del momento (lib/dolar-cripto-reglas.ts) — 19/11/2026
// =============================================================================
// Martín (18/11): «no del día, sino del momento». Las dos fuentes (dolarapi cripto y CriptoYa Binance P2P) dentro de un 3 %, la más alta; la banda
// contra la última buena; sin eso, la última buena de menos de 6 h; si no, nada (y no se ofrece Mercado Pago). Datos con la forma de lo medido el
// 19/11 (1.718,47 y 1.715,77).
// Correr: node --import tsx --test tests/dolar-cripto.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cotizacionParaElCheckout, leerCriptoYa, leerDolarApiCripto, leerUltima, type LecturaCripto } from '../lib/dolar-cripto-reglas';
import { pesosDelPlan } from '../lib/dolar-blue-reglas';

const AHORA = Date.parse('2026-11-19T04:00:00Z');
const H = 3_600_000;
const DOLARAPI = { moneda: 'USD', casa: 'cripto', nombre: 'Cripto', compra: 1714.23, venta: 1718.47, fechaActualizacion: '2026-11-18T20:56:00.000Z' };
const CRIPTOYA = { binancep2p: { ask: 1715.77, totalAsk: 1715.77, bid: 1707.51, totalBid: 1707.51, time: AHORA / 1000 - 30 } };
const l = (venta: number, at = AHORA, fuente = 'x'): LecturaCripto => ({ venta, fuente, at });

test('las lecturas: dolarapi cripto (venta) y CriptoYa Binance P2P (totalAsk); lo roto o del blue, no', () => {
  assert.equal(leerDolarApiCripto(DOLARAPI, AHORA)?.venta, 1718.47);
  assert.equal(leerDolarApiCripto({ ...DOLARAPI, casa: 'blue' }, AHORA), null, 'el blue NO es la fuente');
  assert.equal(leerDolarApiCripto({ ...DOLARAPI, compra: 1800 }, AHORA), null, 'compra mayor que venta: roto');
  assert.equal(leerDolarApiCripto({ ...DOLARAPI, venta: 12 }, AHORA), null, 'fuera del piso');
  assert.equal(leerCriptoYa(CRIPTOYA, AHORA)?.venta, 1715.77);
  assert.equal(leerCriptoYa({ binance: {} }, AHORA), null);
  assert.equal(leerCriptoYa(null, AHORA), null);
});

test('coinciden: la MÁS ALTA (el dólar que le cuesta a Martín), y el precio del plan al millar hacia arriba', () => {
  const c = cotizacionParaElCheckout([leerDolarApiCripto(DOLARAPI, AHORA), leerCriptoYa(CRIPTOYA, AHORA)], l(1704, AHORA - H), AHORA);
  assert.ok(c);
  assert.equal(c.venta, 1718.47);
  assert.equal(c.deLaUltima, false);
  assert.equal(pesosDelPlan(97, c.venta), 167_000);
  assert.equal(pesosDelPlan(47, c.venta), 81_000);
});

test('no coinciden (más de 3 %) o falla una: la última buena de menos de 6 h; si no hay, NADA (no se inventa)', () => {
  const lejos = [l(1718), l(1800)];
  assert.equal(cotizacionParaElCheckout(lejos, l(1710, AHORA - 2 * H), AHORA)?.venta, 1710);
  assert.equal(cotizacionParaElCheckout(lejos, l(1710, AHORA - 2 * H), AHORA)?.deLaUltima, true);
  assert.equal(cotizacionParaElCheckout(lejos, l(1710, AHORA - 7 * H), AHORA), null, 'la última es vieja');
  assert.equal(cotizacionParaElCheckout(lejos, null, AHORA), null);
  assert.equal(cotizacionParaElCheckout([l(1718), null], null, AHORA), null, 'con una sola fuente y sin última: nada');
  assert.equal(cotizacionParaElCheckout([null, null], l(1710, AHORA - H), AHORA)?.venta, 1710);
});

test('la banda: un salto de más del 15 % contra la última buena de esta semana no se usa; contra una de hace un mes, sí', () => {
  const salto = [l(2100), l(2110)];
  assert.equal(cotizacionParaElCheckout(salto, l(1700, AHORA - H), AHORA)?.venta, 1700, 'se queda con la última');
  assert.equal(cotizacionParaElCheckout(salto, l(1700, AHORA - 30 * 24 * H), AHORA)?.venta, 2110, 'la de hace un mes no traba el checkout para siempre');
});

test('la última guardada se lee entera o no se lee', () => {
  assert.deepEqual(leerUltima(JSON.stringify({ venta: 1718.47, fuente: 'x', at: AHORA })), { venta: 1718.47, fuente: 'x', at: AHORA });
  assert.equal(leerUltima('{"venta":1718}'), null);
  assert.equal(leerUltima(null), null);
});

test('el checkout usa la cotización del momento en UN solo punto, y sin ella no ofrece Mercado Pago en pesos', () => {
  const c = readFileSync(join(__dirname, '..', 'lib', 'compra-plan.ts'), 'utf8').replace(/\r\n/g, '\n');
  const oferta = c.slice(c.indexOf('export async function ofertaDelPlan'), c.indexOf('export async function ofertasDeLosPlanes'));
  assert.match(oferta, /const vivo = monedas\.some\(\(m\) => m\.moneda === MONEDA_PESOS\) \? await dolarCriptoAhora\(\)/);
  assert.match(oferta, /moneda === MONEDA_PESOS \? \(vivo \? pesosDelPlan\(plan\.precioUsd, vivo\.venta\) : null\)/);
  // El cobro lee la misma oferta (lo que se muestra es lo que se cobra).
  assert.match(c, /ofertaDelPlan\(/);
});
