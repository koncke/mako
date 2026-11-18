// P37 (18/11/2026): la fila «Plata» del Admin del teléfono (`plataDeCliente`, lib/clientes-plataforma-reglas.ts). Decía «Plan a mano» a
// todo negocio sin MRR, fuera de prueba y sin un plan a mano guardado: la misma frase falsa que se sacó de la computadora el 5/11.
// Lo que no se sabe no se afirma. Probado rompiéndolo: con el `?? 'Plan a mano'` de antes, el tercer caso cae.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plataDeCliente } from '../lib/clientes-plataforma-reglas';

const base = { mrrUsd: 0, primerMesUsd: null, prueba: false, planAManoTxt: null, sinDolares: 0 };

test('con MRR, el MRR (y el primer mes con descuento si lo hay)', () => {
  assert.equal(plataDeCliente({ ...base, mrrUsd: 97 }), 'US$ 97 por mes');
  assert.equal(plataDeCliente({ ...base, mrrUsd: 97, primerMesUsd: 47 }), 'US$ 97 por mes · primer mes a US$ 47');
});

test('en prueba, o con su plan a mano, lo dice', () => {
  assert.equal(plataDeCliente({ ...base, prueba: true }), 'En prueba gratis');
  assert.equal(plataDeCliente({ ...base, planAManoTxt: 'Gratis hasta el 30/11' }), 'Gratis hasta el 30/11');
});

test('⚠️ sin cobros, sin prueba y sin plan a mano NO dice «Plan a mano»: no se sabe', () => {
  assert.equal(plataDeCliente(base), '—');
  assert.notEqual(plataDeCliente(base), 'Plan a mano');
});

test('pagos sin su valor en dólares: se dice eso, no un cero ni un plan', () => {
  assert.equal(plataDeCliente({ ...base, sinDolares: 1 }), 'Un pago sin su valor en dólares');
  assert.equal(plataDeCliente({ ...base, sinDolares: 3 }), '3 pagos sin su valor en dólares');
});
