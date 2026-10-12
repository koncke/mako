// =============================================================================
// Montos y monedas de las pasarelas (lib/pasarela-moneda.ts)
// =============================================================================
// Stripe y Mercado Pago cuentan distinto y NINGUNA da error si te equivocás: un CLP mandado ×100 a
// Stripe cobra cien veces más, y Mercado Pago no quiere centavos sino el decimal tal cual. Lo que
// se fija acá:
//   · Stripe en unidades mínimas: USD ×100; CLP y JPY enteros (cero decimales); ISK y UGX ×100
//     ENTEROS y terminados en 00 (los «casos especiales» de docs.stripe.com/currencies); siempre
//     un entero, y un monto inválido TIRA (no se manda un 0 ni un NaN a cobrar);
//   · la inversa, para leer lo que devuelve Stripe;
//   · el sitio de la cuenta de Mercado Pago → su moneda (nunca un USD asumido);
//   · cómo se escribe un monto para una persona.
//
// Probado ROMPIÉNDOLO (11/10/2026), una rotura por vez sobre la base en verde y restaurando de
// memoria (un script que guarda el texto y lo repone, nunca git). Con el código como está:
// 6 pases, 0 fallos. Rota (pases / fallos):
//   · CLP fuera de la lista de cero decimales                                    → 4 / 2
//   · ISK ×100 con los decimales (`Math.round(monto * 100)`)                     → 5 / 1
//   · aUnidadMinima sin el `throw` del monto inválido                            → 5 / 1
//   · monedaDeSitioMp sin normalizar a mayúsculas                                → 5 / 1
//   · formatoMonto con `$` para el dólar (sin el «US$»)                          → 5 / 1
// Correr: node --import tsx --test tests/pasarela-moneda.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aUnidadMinima, deUnidadMinima, formatoMonto, monedaDeSitioMp, normalizarMoneda } from '../lib/pasarela-moneda';

test('Stripe: USD ×100 (con centavos), CLP y JPY enteros, y siempre un entero', () => {
  assert.equal(aUnidadMinima(47, 'USD'), 4700);
  assert.equal(aUnidadMinima(19.99, 'USD'), 1999);
  assert.equal(aUnidadMinima(0.1 + 0.2, 'usd'), 30, 'el error de coma flotante no llega a Stripe');
  assert.equal(aUnidadMinima(1234.565, 'MXN'), 123457);
  // ⚠️ Cero decimales: ×100 cobraría cien veces más.
  assert.equal(aUnidadMinima(49900, 'CLP'), 49900);
  assert.equal(aUnidadMinima(1500, 'JPY'), 1500);
  assert.equal(aUnidadMinima(1500.4, 'jpy'), 1500);
  for (const [m, mon] of [[47.123, 'USD'], [49900.7, 'CLP'], [1500.4, 'ISK'], [3.3, 'EUR']] as const) {
    assert.ok(Number.isInteger(aUnidadMinima(m, mon)), `${m} ${mon} no dio un entero`);
  }
});

test('Stripe: ISK y UGX van ×100 ENTEROS, terminados en 00 (la regla especial gana)', () => {
  assert.equal(aUnidadMinima(1500, 'ISK'), 150000);
  assert.equal(aUnidadMinima(1500.4, 'ISK'), 150000, 'ISK no tiene decimales: termina en 00');
  assert.equal(aUnidadMinima(1500.6, 'ISK'), 150100);
  // UGX figura en la lista de cero decimales Y en la de casos especiales: gana la especial.
  assert.equal(aUnidadMinima(5000, 'UGX'), 500000);
});

test('un monto inválido TIRA: nunca se manda a cobrar un 0, un negativo o un NaN', () => {
  for (const m of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => aUnidadMinima(m, 'USD'), /monto inválido/, `${m} no tiró`);
  }
});

test('deUnidadMinima: la inversa de lo que devuelve Stripe (amount_total, amount_paid)', () => {
  assert.equal(deUnidadMinima(4700, 'USD'), 47);
  assert.equal(deUnidadMinima(1999, 'usd'), 19.99);
  assert.equal(deUnidadMinima(49900, 'CLP'), 49900);
  assert.equal(deUnidadMinima(1500, 'JPY'), 1500);
  assert.equal(deUnidadMinima(150000, 'ISK'), 1500);
  assert.equal(deUnidadMinima(500000, 'UGX'), 5000);
  for (const [m, mon] of [[47, 'USD'], [19.99, 'EUR'], [49900, 'CLP'], [1500, 'ISK'], [5000, 'UGX']] as const) {
    assert.equal(deUnidadMinima(aUnidadMinima(m, mon), mon), m, `ida y vuelta de ${m} ${mon}`);
  }
});

test('Mercado Pago: el sitio de la cuenta → su moneda; uno que no conocemos → null (nunca USD)', () => {
  const sitios: Record<string, string> = { MLA: 'ARS', MLB: 'BRL', MLM: 'MXN', MLC: 'CLP', MCO: 'COP', MPE: 'PEN', MLU: 'UYU' };
  for (const [s, m] of Object.entries(sitios)) assert.equal(monedaDeSitioMp(s), m, s);
  assert.equal(monedaDeSitioMp('mla'), 'ARS');
  assert.equal(monedaDeSitioMp(' MLM '), 'MXN');
  assert.equal(monedaDeSitioMp('MLV'), null);
  assert.equal(monedaDeSitioMp(''), null);
  assert.equal(monedaDeSitioMp(null), null);
  assert.equal(monedaDeSitioMp(undefined), null);
  // Y la moneda que viene escrita por una persona se normaliza o se rechaza.
  assert.equal(normalizarMoneda(' ars '), 'ARS');
  assert.equal(normalizarMoneda('pesos'), null);
});

test('formatoMonto: «US$ 47», «$ 49.900 ARS», decimales sólo si los tiene', () => {
  assert.equal(formatoMonto(47, 'USD'), 'US$ 47');
  assert.equal(formatoMonto(19.99, 'usd'), 'US$ 19,99');
  assert.equal(formatoMonto(49900, 'ARS'), '$ 49.900 ARS');
  assert.equal(formatoMonto(49900, 'CLP'), '$ 49.900 CLP');
  assert.equal(formatoMonto(1500, 'MXN'), '$ 1.500 MXN');
  assert.equal(formatoMonto(12.5, 'EUR'), '12,50 EUR');
  assert.equal(formatoMonto(1500, 'JPY'), '1.500 JPY');
});
