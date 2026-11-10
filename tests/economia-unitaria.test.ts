// =============================================================================
// La economía por cliente: lo que falta vale `null`, nunca 0 (7/11/2026)
// =============================================================================
// Esta pantalla ya tiene una regla que se gana sola el lugar: un 0 puede significar «no pude leer»,
// y ahí deja de ser un dato. Pasó con el «Facturable REAL: 0 min» de GitHub Actions, que decía
// «no gastamos» cuando quería decir «no tengo permiso».
//
// Acá se fija lo mismo: sin clientes, sin MRR o sin el gasto de IA, los números que dependen de eso
// son `null` y hay un aviso. Un «fijo por cliente: US$0» leería «no cuesta nada», que es lo
// contrario de la verdad.
//
// Correr: node --import tsx --test tests/economia-unitaria.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  economiaDelMes, cacPorMes, PARTE_DE_COBRAR, CAC_USD, MESES_DE_VIDA,
} from '../lib/economia-unitaria';

const base = {
  clientesQuePagan: 50,
  mrrUsd: 3600,
  iaDelMesUsd: 800,
  fijoMensualUsd: 438.25,
};

test('con todo a mano sale el resultado, el margen y el equilibrio', () => {
  const e = economiaDelMes(base);
  assert.equal(e.clientes, 50);
  assert.ok(e.fijoPorCliente != null && Math.abs(e.fijoPorCliente - 438.25 / 50) < 1e-9);
  assert.ok(e.resultadoDelMes != null && e.resultadoDelMes > 0, 'con esos números tiene que dar positivo');
  assert.ok(e.margen != null && e.margen > 0.3);
  assert.ok(e.equilibrio != null && e.equilibrio < 50, 'ya pasó el equilibrio');
  assert.equal(e.faltanParaElEquilibrio, 0);
  assert.equal(e.avisos.length, 0, 'con todos los datos no hay nada que avisar');
});

test('SIN clientes: el fijo por cliente es null, NUNCA 0, y se avisa', () => {
  const e = economiaDelMes({ ...base, clientesQuePagan: 0, mrrUsd: 0 });
  assert.equal(e.fijoPorCliente, null, 'un 0 leería «no cuesta nada»');
  assert.equal(e.equilibrio, null);
  assert.equal(e.faltanParaElEquilibrio, null);
  assert.ok(e.avisos.some((a) => /clientes/i.test(a)));
});

test('sin lo facturado NO se inventa un margen: null y aviso', () => {
  const e = economiaDelMes({ ...base, mrrUsd: null });
  assert.equal(e.resultadoDelMes, null);
  assert.equal(e.margen, null);
  assert.ok(e.avisos.some((a) => /no pude leer lo facturado/i.test(a)));
  // Lo que NO depende del MRR sigue estando: el fijo se reparte igual.
  assert.ok(e.fijoPorCliente != null);
});

test('sin el gasto de IA tampoco se completa el resultado', () => {
  const e = economiaDelMes({ ...base, iaDelMesUsd: null });
  assert.equal(e.resultadoDelMes, null);
  assert.ok(e.avisos.some((a) => /gasto de ia/i.test(a)));
});

test('el equilibrio dice cuántos faltan, y no baja de cero', () => {
  const pocos = economiaDelMes({ ...base, clientesQuePagan: 3, mrrUsd: 216, iaDelMesUsd: 48 });
  assert.ok(pocos.equilibrio != null && pocos.equilibrio > 3);
  assert.equal(pocos.faltanParaElEquilibrio, pocos.equilibrio - 3);
  assert.ok(pocos.resultadoDelMes != null && pocos.resultadoDelMes < 0, 'con 3 clientes todavía pierde');
});

test('si cada cliente cuesta más de lo que deja, NO hay equilibrio: null, no un número enorme', () => {
  // La IA se come todo: ninguna cantidad de clientes lo arregla, y decir «hacen falta 99.999»
  // sugeriría que sí.
  const e = economiaDelMes({ ...base, iaDelMesUsd: 3500 });
  assert.ok(e.dejaCadaCliente != null && e.dejaCadaCliente <= 0);
  assert.equal(e.equilibrio, null);
  assert.ok(e.avisos.some((a) => /no hay cantidad de clientes/i.test(a)));
});

test('un conteo roto no rompe la cuenta: cae a 0 y avisa', () => {
  for (const malo of [Number.NaN, -7, Number.POSITIVE_INFINITY]) {
    const e = economiaDelMes({ ...base, clientesQuePagan: malo });
    assert.equal(e.clientes, 0, `${malo} tenía que caer a 0`);
    assert.equal(e.fijoPorCliente, null);
  }
});

test('el CAC se reparte en la vida del cliente, y una vida corta lo EMPEORA', () => {
  // Va al revés de la intuición y por eso se fija acá.
  assert.ok(Math.abs(cacPorMes() - CAC_USD / MESES_DE_VIDA) < 1e-9);
  assert.ok(cacPorMes() > 10 && cacPorMes() < 11, `a ${MESES_DE_VIDA} meses el CAC pesa US$${cacPorMes().toFixed(2)}/mes`);
  const siSeFueranAntes = CAC_USD / 4;
  assert.ok(siSeFueranAntes > cacPorMes() * 2, 'quedarse menos tiempo hace que el CAC pese MÁS por mes');
});

test('cobrar se lleva su parte antes que nada', () => {
  const e = economiaDelMes({ ...base, iaDelMesUsd: 0, fijoMensualUsd: 0, clientesQuePagan: 1 });
  // Sin IA ni fijo, lo que queda es el MRR menos lo de cobrar menos el CAC del mes.
  const esperado = base.mrrUsd! - base.mrrUsd! * PARTE_DE_COBRAR - cacPorMes();
  assert.ok(e.resultadoDelMes != null && Math.abs(e.resultadoDelMes - esperado) < 1e-9);
});
