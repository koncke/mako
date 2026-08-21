// =============================================================================
// El botón no puede prometer altas que no va a hacer
// =============================================================================
// El caso que lo trajo (2026-08-21): una reunión donde las 16 filas eran AMPLIACIONES
// —tarjetas que ya estaban en el plan y a las que solo se les suma el contexto de la
// charla— y el botón decía «Cargar 16 al plan». El dueño le dio, no apareció ninguna
// tarea nueva (correcto: no había), el modal no se cerró y se lo volvió a preguntar.
//
// Dos cuentas distintas para lo mismo es como se llegó ahí: `nAmpliar` usaba una
// definición y `nIncluidas` otra, así que las ampliaciones se contaban DOS veces (una
// como alta y otra como ampliación). Por eso la definición vive afuera del componente y
// se testea acá.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esAmpliarFila } from '../app/plan/board/TareasRecibidasModal';

const cruce = { id: 't123', razon: 'la misma tarea' };

test('una fila cruzada contra una tarjeta que ya existe AMPLÍA, no crea', () => {
  assert.equal(esAmpliarFila({ enriquece: cruce }), true);
});

test('sin cruce, es un alta', () => {
  assert.equal(esAmpliarFila({}), false);
  assert.equal(esAmpliarFila({ enriquece: undefined }), false);
});

test('«no es la misma» (ampliar:false) la devuelve a ser alta', () => {
  // Es la corrección del dueño: el cruce se equivocó, esto SÍ es una tarea nueva.
  assert.equal(esAmpliarFila({ enriquece: cruce, ampliar: false }), false);
});

test('lo de otra persona nunca amplía MI tablero', () => {
  assert.equal(esAmpliarFila({ enriquece: cruce, esDeOtro: true }), false);
});

test('omitir es «no le sumes nada»: ni amplía ni crea', () => {
  assert.equal(esAmpliarFila({ enriquece: cruce, omitir: true }), false);
});

test('una fila NO puede contarse como alta y como ampliación a la vez', () => {
  // La invariante que el botón rompía: con 16 ampliaciones tildadas, la cuenta de altas
  // tiene que dar CERO. Se replica acá la fórmula de las dos cuentas del modal.
  const filas = Array.from({ length: 16 }, () => ({ incluir: true, enriquece: cruce }));
  const nAmpliar = filas.filter(esAmpliarFila).length;
  const nIncluidas = filas.filter((f) => f.incluir && !esAmpliarFila(f)).length;
  assert.equal(nAmpliar, 16);
  assert.equal(nIncluidas, 0, 'el botón prometía «Cargar 16» sobre una reunión que no crea ninguna');
});
