// =============================================================================
// Compartir la lectura entre negocios sin servirle datos viejos a quien pidió frescos (2/11/2026)
// =============================================================================
// Martín: «súper importante que esta tab sea compartida por todos los usuarios. No tiene sentido de
// que uno analice a Alex Hormozi y luego otro también vuelva a analizar al mismo».
//
// Lo que se comparte es LO CARO —el resultado de leer un canal público, que es igual para
// cualquiera porque el canal es público— y nunca la lista de a quién mira cada negocio.
//
// ⚠️ LA REGLA QUE ESTE TEST CUIDA, Y ES LA QUE SEPARA AHORRAR DE MENTIR: «Revisar ahora» NUNCA usa
// la lectura de otro. Quien toca ese botón está mirando la pantalla y pidiendo datos de hoy. En el
// ALTA es al revés: no hay NADA que mostrar, y la lectura de ayer vale infinitamente más que un
// cuadro vacío mientras se gasta un crédito del tope diario.
//
// PROBADO ROMPIÉNDOLO (2/11/2026), con el archivo en 8 / 0, una rotura por vez y restaurada:
//   · `HORAS_QUE_SIRVE['a-pedido']` en 6 (Revisar ahora sirviendo datos ajenos)   → 7 / 1
//   · `sirveLaCompartida` sin el `if (!leidoEn)`                                   → 8 / 0  ⚠️ NO LA CAZA
//     Y vale escribirlo: esa guarda es REDUNDANTE. Sin ella, `Date.parse(null)` da `NaN`, y toda
//     comparación con `NaN` es falsa, así que la función devuelve `false` igual. Queda en el código
//     porque depender de la semántica de `NaN` para una decisión de plata es una trampa para el que
//     lea esto después — pero que quede claro que **este test no la cuida**. Lo mismo vale para el
//     `Number.isFinite`.
//   · `sirveLaCompartida` sin el descarte de fechas futuras                        → 7 / 1
//   · `claveDeCanal` sin bajar el @ de Instagram a minúscula                       → 7 / 1
// Correr: node --import tsx --test tests/spy-lectura-compartida.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HORAS_QUE_SIRVE, claveDeCanal, sirveLaCompartida } from '../lib/spy-compartido';

const AHORA = Date.parse('2026-11-02T20:00:00.000Z');
const haceHoras = (h: number) => new Date(AHORA - h * 3_600_000).toISOString();

test('«Revisar ahora» NUNCA sirve la lectura de otro, por fresca que sea', () => {
  // Un minuto de antigüedad y aun así se paga la lectura: el botón pide datos de hoy.
  assert.equal(sirveLaCompartida('a-pedido', haceHoras(0.016), AHORA), false);
  assert.equal(HORAS_QUE_SIRVE['a-pedido'], 0, 'si esto deja de ser 0, Revisar ahora empieza a mentir');
});

test('en el ALTA sí sirve: es donde se ahorra de verdad', () => {
  // Es el caso «otro ya analizó a Hormozi»: no hay nada en pantalla y la lectura ya está pagada.
  assert.equal(sirveLaCompartida('alta', haceHoras(3), AHORA), true);
  assert.equal(sirveLaCompartida('alta', haceHoras(23), AHORA), true);
});

test('pero no sirve para siempre', () => {
  assert.equal(sirveLaCompartida('alta', haceHoras(25), AHORA), false);
  assert.equal(sirveLaCompartida('rutina', haceHoras(7), AHORA), false);
  assert.equal(sirveLaCompartida('rutina', haceHoras(5), AHORA), true);
});

test('sin nada guardado, se lee: no hay de dónde ahorrar', () => {
  assert.equal(sirveLaCompartida('alta', null, AHORA), false);
  assert.equal(sirveLaCompartida('alta', undefined, AHORA), false);
  assert.equal(sirveLaCompartida('alta', 'no es una fecha', AHORA), false);
});

test('una fecha en el futuro no es una lectura fresquísima: es un dato roto', () => {
  // Un reloj desfasado haría que una fila basura tape lecturas de verdad para siempre.
  assert.equal(sirveLaCompartida('alta', new Date(AHORA + 3_600_000).toISOString(), AHORA), false);
});

test('la clave es el CANAL, no el competidor', () => {
  // Dos negocios que miran a la misma persona tienen dos filas en spy_competidores y UNA acá.
  assert.deepEqual(claveDeCanal('instagram', '@AlexHormozi'), { canal: 'instagram', ref: 'alexhormozi' });
  assert.deepEqual(claveDeCanal('Instagram', 'alexhormozi'), { canal: 'instagram', ref: 'alexhormozi' });
});

test('el id de YouTube NO se baja a minúscula: distingue mayúsculas', () => {
  // `UCxxxx` y `ucxxxx` son canales distintos para la API de YouTube. Normalizarlo rompería la clave.
  assert.deepEqual(claveDeCanal('youtube', 'UCesPsZfMq9lA'), { canal: 'youtube', ref: 'UCesPsZfMq9lA' });
});

test('una clave incompleta o gigante no se arma', () => {
  assert.equal(claveDeCanal('', 'algo'), null);
  assert.equal(claveDeCanal('instagram', '   '), null);
  assert.equal(claveDeCanal('instagram', 'x'.repeat(201)), null, 'la columna topea en 200 y la base lo rechazaría');
});
