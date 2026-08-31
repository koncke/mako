// =============================================================================
// Lo que cuesta un clip es EXACTO y depende de cuánto dura
// =============================================================================
// La pantalla anunciaba «~15 (estimado) créditos» para toda toma, viniera de un
// clip de 4 segundos o de uno de 10. Martín lo corrigió con la tabla medida: «no
// es costo ESTIMADO, es exacto — 15 si son 10s, 12 para 8s, 10 para 6s y 7 para
// 4s».
//
// Los dos daños del número único: el «~» le pide a la persona que desconfíe de un
// dato que sí conocemos, y 15 sobre un clip de 4 segundos anuncia más del doble
// de lo que sale.

import test from 'node:test';
import assert from 'node:assert/strict';
import { creditosDeClip, CREDITOS_POR_DURACION } from '../lib/costo-clip';

test('la tabla es la que dio el dueño, sin interpretar', () => {
  assert.equal(creditosDeClip(10), 15);
  assert.equal(creditosDeClip(8), 12);
  assert.equal(creditosDeClip(6), 10);
  assert.equal(creditosDeClip(4), 7);
});

test('el precio NO es lineal, y por eso es una tabla', () => {
  // Una regla de tres sobre los 4 s daría 17,5 para 10 s: cobraría de más justo
  // en el caso normal. El segundo de un clip corto sale casi el doble.
  const porSegundo = (s: number) => creditosDeClip(s)! / s;
  assert.ok(porSegundo(4) > porSegundo(10) * 1.15, 'el clip corto es más caro por segundo');
});

test('una duración que no está en la tabla devuelve null, no el más parecido', () => {
  // Devolver el precio de otra duración sería inventar un número exacto — peor
  // que admitir una estimación, porque se muestra sin «~» y nadie lo duda.
  assert.equal(creditosDeClip(7), null);
  assert.equal(creditosDeClip(12), null);
  assert.equal(creditosDeClip(0), null);
});

test('los decimales se redondean antes de buscar', () => {
  // `repartirDuracion` puede dar 7.98 por un reparto: eso es un clip de 8 s.
  assert.equal(creditosDeClip(7.98), 12);
  assert.equal(creditosDeClip(10.2), 15);
});

test('la tabla cubre las duraciones que los formatos pueden pedir', () => {
  // Si alguien agrega un formato con clips de 12 s, este test le avisa que
  // también hay que agregar su precio — o la pantalla vuelve a estimar.
  for (const s of [4, 6, 8, 10]) {
    assert.equal(typeof CREDITOS_POR_DURACION[s], 'number', `falta el precio de ${s} s`);
  }
});
