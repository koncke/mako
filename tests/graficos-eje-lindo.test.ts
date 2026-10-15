// Las marcas de un eje automático de la dispersión: redondas, con aire en las puntas y sin cruzar el cero.
// Verificado rompiéndolo (14/10/2026): con `pasoLindo` devolviendo el paso crudo, 3 fallos y 2 pases; sin el `aire`,
// 2 fallos y 3 pases (la burbuja en el máximo y el eje que cruza el cero).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ejeLindo, pasoLindo } from '../app/dashboard/graficos/eje-lindo';

test('pasoLindo elige 1, 2, 2,5 o 5 por una potencia de 10', () => {
  assert.equal(pasoLindo(4.3), 5);
  assert.equal(pasoLindo(0.17), 0.2);
  assert.equal(pasoLindo(2.2), 2.5);
  assert.equal(pasoLindo(31), 50);
  assert.equal(pasoLindo(10), 10);
});

test('el caso del arnés: la retención de 5% a 33% sale en marcas redondas', () => {
  const { dominio, marcas } = ejeLindo([6.2, 21.5, 33.1, 9.8], 2, 0.08, true);
  assert.deepEqual(dominio, [0, 40]);
  assert.deepEqual(marcas, [0, 20, 40]);
});

test('el caso de las burbujas: esfuerzo de 1,7 a 5,1 no da «1,5 · 3,5 · 5,7»', () => {
  const { marcas } = ejeLindo([1.7, 2.6, 4.3, 5.1], 4, 0.14, true);
  for (const m of marcas) assert.equal(Math.round(m * 2) / 2, m, `marca ${m} no es múltiplo de 0,5`);
});

test('una burbuja en el máximo no queda en el borde del eje', () => {
  const { dominio } = ejeLindo([10, 20, 30], 4, 0.14, true);
  assert.ok(dominio[1] > 30, `el dominio termina en ${dominio[1]}`);
  assert.ok(dominio[0] < 10);
});

test('sin cruzar el cero con valores positivos, y un solo valor no deja el eje en cero de ancho', () => {
  assert.ok(ejeLindo([1, 2, 3], 4, 0.5, true).dominio[0] >= 0);
  const uno = ejeLindo([7, 7], 4, 0.08, true);
  assert.ok(uno.dominio[1] > uno.dominio[0]);
  assert.ok(ejeLindo([-5, 5], 4, 0.08, false).dominio[0] < -5);
});
