// Inspiración: ¿la pieza va sola a su carpeta o a la bandeja? (lib/inspiracion/reglas.ts, 19/11/2026). Martín: «Cuando no
// sabes dónde ponerlo, tenés que preguntar, no determinarlo automáticamente».

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIANZA_PARA_ORDENAR, CONFIRMADAS_PARA_ORDENAR, destinoDe, preguntaDe } from '../lib/inspiracion/reglas';

const carpetas = [{ id: 1 }, { id: 2 }];
const confirmadas = new Map([[1, CONFIRMADAS_PARA_ORDENAR], [2, 1]]);

test('segura y en una carpeta que ya aprendió: va sola', () => {
  assert.deepEqual(destinoDe({ carpetaId: 1, confianza: CONFIANZA_PARA_ORDENAR }, carpetas, confirmadas), { estado: 'ordenada', carpetaId: 1 });
});

test('segura pero la carpeta todavía no tiene 3 confirmadas: pregunta', () => {
  assert.deepEqual(destinoDe({ carpetaId: 2, confianza: 99 }, carpetas, confirmadas), { estado: 'por_revisar', sugeridaId: 2, carpetaNueva: null });
});

test('con duda: pregunta, con su sospecha', () => {
  assert.deepEqual(destinoDe({ carpetaId: 1, confianza: CONFIANZA_PARA_ORDENAR - 1 }, carpetas, confirmadas), { estado: 'por_revisar', sugeridaId: 1, carpetaNueva: null });
});

test('una carpeta que no existe o ningún veredicto: a la bandeja sin sugerencia', () => {
  assert.deepEqual(destinoDe({ carpetaId: 77, confianza: 100 }, carpetas, confirmadas), { estado: 'por_revisar', sugeridaId: null, carpetaNueva: null });
  assert.deepEqual(destinoDe(null, carpetas, confirmadas), { estado: 'por_revisar', sugeridaId: null, carpetaNueva: null });
  assert.deepEqual(destinoDe({ carpetaId: 1, confianza: Number.NaN }, carpetas, confirmadas), { estado: 'por_revisar', sugeridaId: 1, carpetaNueva: null });
});

test('sin carpeta que le cierre: propone una nueva', () => {
  assert.deepEqual(destinoDe({ carpetaId: null, confianza: 40, carpetaNueva: '  Historias A/B ' }, [], new Map()), { estado: 'por_revisar', sugeridaId: null, carpetaNueva: 'Historias A/B' });
});

test('la pregunta de la tarjeta', () => {
  assert.equal(preguntaDe({ sugerida: 'Serie 3: ventas' }), '¿Va en «Serie 3: ventas»?');
  assert.equal(preguntaDe({ carpetaNueva: 'Historias A/B', tipoLink: 'reel' }), '¿Creo la carpeta «Historias A/B» para este reel?');
  assert.equal(preguntaDe({ tipoLink: 'cuenta' }), 'Esta cuenta, ¿dónde va?');
});
