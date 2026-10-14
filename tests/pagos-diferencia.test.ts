// Tests de lo que pasa al cobrar una cuota por un monto DISTINTO (lib/pagos-diferencia.ts). Mauricio, reunión del
// 13/10/2026: «yo no pude ponerle el tema cuando es un pago diferente». Hasta acá la diferencia DESAPARECÍA: la cuota
// quedaba pagada por menos y el Outstanding bajaba como si el cliente ya no debiera nada.
//
// Y el cableado: la ficha del CRM y la API de MaKo cobran por UNA función (`cobrarCuota`, lib/pagos.ts), y esa
// función usa la regla pura.
//
// Probado rompiéndolo (14/10/2026), contra la base en verde (5 de 5), restaurando de memoria:
//   · `diferenciaPendiente` sin mirar el descuento → 1 fallo, 4 pases;
//   · `diferenciaPendiente` sin mirar si ya estaba pagada → 1 fallo, 4 pases;
//   · la ficha con su propia copia (sin `cobrarCuota`) → 1 fallo, 4 pases.
//
// Correr: npx tsx --test tests/pagos-diferencia.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { diferenciaPendiente, centavos } from '../lib/pagos-diferencia';

const leer = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('se cobró de menos: la diferencia queda pendiente', () => {
  assert.equal(diferenciaPendiente(500, 300, { yaPagada: false }), 200);
  assert.equal(diferenciaPendiente(500, 300, { yaPagada: false, resto: 'pendiente' }), 200);
  assert.equal(diferenciaPendiente(99.99, 33.33, { yaPagada: false }), 66.66);
});

test('si es un descuento, no queda nada pendiente', () => {
  assert.equal(diferenciaPendiente(500, 300, { yaPagada: false, resto: 'descuento' }), 0);
});

test('igual, de más, o sin monto: no queda nada pendiente', () => {
  assert.equal(diferenciaPendiente(500, 500, { yaPagada: false }), 0);
  assert.equal(diferenciaPendiente(500, 700, { yaPagada: false }), 0);
  assert.equal(diferenciaPendiente(500, null, { yaPagada: false }), 0);
  assert.equal(diferenciaPendiente(500, -5, { yaPagada: false }), 0);
  assert.equal(diferenciaPendiente(500, Number.NaN, { yaPagada: false }), 0);
});

test('una cuota que ya estaba pagada no genera diferencia (se corrige el registro, no se cobra)', () => {
  assert.equal(diferenciaPendiente(500, 300, { yaPagada: true }), 0);
  assert.equal(centavos(0.1 + 0.2), 0.3);
});

test('la ficha y la API de MaKo cobran por la MISMA función', () => {
  const ficha = sinComentarios(leer('../app/crm/[id]/deal-actions.ts'));
  const ini = ficha.indexOf('export async function marcarPagoManualAction');
  const cuerpo = ficha.slice(ini, ficha.indexOf('\n}\n', ini));
  assert.match(cuerpo, /await cobrarCuota\(/);
  assert.doesNotMatch(cuerpo, /from\('pagos'\)/);
  const api = sinComentarios(leer('../lib/api-mako/areas/crm.run.ts'));
  assert.match(api, /await cobrarCuota\(/);
  assert.match(api, /await registrarPagoSuelto\(/);
  const pagos = sinComentarios(leer('../lib/pagos.ts'));
  assert.match(pagos, /diferenciaPendiente\(original, monto/);
});
