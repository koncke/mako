// =============================================================================
// Lo que queda en el bolsillo: la cuenta que Martín no entendía (7/11/2026)
// =============================================================================
// Martín, 7/11: «¿cómo es posible que vendiendo 10 clientes me quede con 44 dólares, y vendiendo 20, el doble, me quede
// con 500?». La cuenta estaba bien; la FRASE de la pantalla decía «con 10 clientes son US$43,83 por cliente» —el fijo
// dividido por los clientes— y se leía como la ganancia.
//
// Estos tests fijan las dos cosas que hacen que la cuenta se entienda:
//   · es LINEAL (cada cliente deja lo mismo) pero el RESULTADO no lo es, porque el fijo se paga una sola vez;
//   · la IA del cliente NO se resta: la paga él con su propia clave.
//
// Correr: node --import tsx --test tests/lo-que-queda.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dejaUnCliente, loQueQueda, clientesParaNoPerder, cacPorMes, PARTE_DE_COBRAR } from '../lib/economia-unitaria';

const PLAN_97 = 97;
const FIJO_HOY = 438.25;     // lo que sale del bolsillo de Martín (lib/costos-fijos.ts)
const FIJO_TODO = 1144.25;   // si pagara también lo de Mauricio

// 10/11/2026: cobrar pasó del 15% (con Creem adentro, que rechazó la tienda el 5/11) a 1,80% de Mercado Pago + 8,36% de
// impuesto = 10,16% (lib/economia-unitaria.ts). Los números de abajo se movieron con eso: 78,08 → 82,78, 342,56 → 389,50,
// 1.123,36 → 1.217,26, y pagando todo el fijo el equilibrio pasó de 15 a 14.
// 10/11/2026, más tarde: la vida del cliente bajó de 22,2 a 9 meses (decisión de Martín). El CAC pesa US$10,78 por mes y no 4,37:
// 82,78 → 76,37, 389,50 → 325,42, 1.217,26 → 1.089,09, y pagando todo el fijo el equilibrio vuelve a 15.
test('un cliente de US$97 deja US$76,37: se le resta cobrar y el CAC, NO su IA', () => {
  const deja = dejaUnCliente(PLAN_97);
  assert.ok(Math.abs(deja - (97 - 97 * PARTE_DE_COBRAR - cacPorMes())) < 1e-9);
  assert.ok(Math.abs(deja - 76.37) < 0.01, `dio US$${deja.toFixed(2)}`);
  // ⚠️ La IA del cliente la paga él (BYOK): restarla acá la contaría dos veces.
  assert.ok(deja > 97 * 0.75, 'si alguien suma un costo de IA por cliente, este número se desploma y hay que discutirlo');
});

test('el resultado NO es lineal aunque cada cliente deje lo mismo: el fijo se paga UNA vez', () => {
  const diez = loQueQueda(10, PLAN_97, FIJO_HOY);
  const veinte = loQueQueda(20, PLAN_97, FIJO_HOY);
  assert.ok(Math.abs(diez - 325.42) < 0.05, `con 10 quedan US$${diez.toFixed(2)}`);
  assert.ok(Math.abs(veinte - 1089.09) < 0.05, `con 20 quedan US$${veinte.toFixed(2)}`);
  // Es la pregunta de Martín: el doble de clientes da MÁS del doble, no el doble.
  assert.ok(veinte > diez * 2, 'pasar de 10 a 20 más que duplica: la segunda decena no vuelve a pagar el fijo');
});

test('con pocos clientes se PIERDE, y el número es negativo y no cero', () => {
  const cinco = loQueQueda(5, PLAN_97, FIJO_HOY);
  assert.ok(cinco < 0, 'con 5 todavía pierde');
  assert.ok(loQueQueda(6, PLAN_97, FIJO_HOY) > 0, 'con 6 ya gana');
});

test('el equilibrio: 6 clientes hoy, 15 si pagara TODO el fijo', () => {
  assert.equal(clientesParaNoPerder(PLAN_97, FIJO_HOY), 6);
  assert.equal(clientesParaNoPerder(PLAN_97, FIJO_TODO), 15);
});

test('el plan de 47 necesita el doble de clientes que el de 97, o más', () => {
  const con47 = clientesParaNoPerder(47, FIJO_HOY)!;
  const con97 = clientesParaNoPerder(PLAN_97, FIJO_HOY)!;
  assert.ok(con47 >= con97 * 2, `47 pide ${con47} y 97 pide ${con97}: el CAC pesa igual en los dos, así que el de 47 deja mucho menos`);
});

test('sin clientes no se inventa un cero: queda el fijo en negativo', () => {
  assert.ok(Math.abs(loQueQueda(0, PLAN_97, FIJO_HOY) + FIJO_HOY) < 1e-9);
  assert.ok(Math.abs(loQueQueda(-3, PLAN_97, FIJO_HOY) + FIJO_HOY) < 1e-9, 'un conteo roto cae a 0 clientes, no a 0 pérdida');
});

test('si un plan no cubriera ni su propio CAC, NO hay cantidad de clientes: null, no un número enorme', () => {
  assert.equal(clientesParaNoPerder(3, FIJO_HOY), null, 'US$3 no alcanzan ni para cobrarlos y el CAC');
});
