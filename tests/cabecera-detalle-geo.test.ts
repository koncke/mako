// =============================================================================
// La marca cruza la portada por la mitad, y la fila le deja su lugar
// =============================================================================
// Los dos números de la cabecera de un detalle están ACOPLADOS: la marca se monta a
// caballo del borde de abajo de la portada, y el padding izquierdo de la fila del
// título es el hueco que esa marca ocupa. Escribirlos a mano —que es como estaban en
// el tablero, con la cuenta en un comentario— funciona hasta que alguien toca el alto
// de la banda y mueve uno solo.
//
// El síntoma de que se desincronicen no se parece a un número viejo: es el título
// escrito ENCIMA de la marca, o la marca flotando en el aire. Se lee como un layout
// roto, y en una captura no se distingue de un problema de flex.
//
// ⚠️ Probado ROMPIÉNDOLO, dos veces, en lib/…/cabecera-detalle-geo.ts. De 7/7:
//   (a) cambiando `cruce` a `alto - tam` —o sea colgando la marca del borde en vez de
//       partirla al medio, que es el error natural— quedan **4 pases y 3 FALLOS**: los
//       tres casos que comprueban que la mitad de la marca queda de cada lado.
//   (b) dejando `sangria` fija en 86 —el número que estaba cableado— quedan **4 pases
//       y 3 FALLOS**: el par de la ficha de un cliente (espera 120), «la sangría sigue
//       al tamaño de la marca» y «siempre deja pasar a la marca entera». ⚠️ Y el dato
//       que importa: con la marca de 54 del tablero NO falla NINGUNO de los tres. El
//       número cableado sobrevivió tanto porque era correcto para el único tamaño con
//       el que se lo probaba — es el corolario 3 de OWNER_WS aplicado a un píxel.

import test from 'node:test';
import assert from 'node:assert/strict';
import { geometriaCabecera } from '../app/_components/cabecera-detalle-geo';

test('con los números del tablero devuelve los que estaban escritos a mano', () => {
  // 124 de banda y una marca de 54: `top:97px` y `paddingLeft:86`. Si esto cambia, el
  // detalle de un proyecto se movió, y eso es una decisión, no un refactor.
  assert.deepEqual(geometriaCabecera(124, 54), { cruce: 97, sangria: 86 });
});

test('con los números de la ficha de un cliente da su propio par', () => {
  // 160 de banda y una marca de 88. El número cableado (86) le quedaba corto por 34 px,
  // que es justo el ancho que el título le pisaría a la marca.
  assert.deepEqual(geometriaCabecera(160, 88), { cruce: 116, sangria: 120 });
});

test('LA MARCA QUEDA PARTIDA AL MEDIO por el borde de la portada', () => {
  // Es la invariante, y es la que el error natural (colgarla del borde) rompe.
  for (const [alto, tam] of [[124, 54], [160, 88], [100, 40], [200, 64]]) {
    const { cruce } = geometriaCabecera(alto, tam);
    const arriba = alto - cruce;          // cuánto de la marca queda sobre la imagen
    const abajo = tam - arriba;           // cuánto queda sobre la fila
    assert.ok(Math.abs(arriba - abajo) <= 1, `${alto}/${tam}: ${arriba} arriba vs ${abajo} abajo`);
  }
});

test('la marca nunca se sale de la portada hacia arriba', () => {
  // Con una banda más baja que media marca, `cruce` se iría a negativo y la marca
  // quedaría flotando sobre el borde del modal.
  for (const [alto, tam] of [[124, 54], [160, 88], [60, 54]]) {
    assert.ok(geometriaCabecera(alto, tam).cruce > 0, `${alto}/${tam} deja la marca afuera`);
  }
});

test('LA SANGRÍA SIGUE AL TAMAÑO DE LA MARCA, no es una constante', () => {
  // Lo que este caso persigue: que agrandar la marca corra el título. Con el 86
  // cableado, una marca de 88 se comía 34 px del nombre.
  const chica = geometriaCabecera(124, 54).sangria;
  const grande = geometriaCabecera(124, 88).sangria;
  assert.ok(grande > chica, `${grande} no es mayor que ${chica}`);
  assert.equal(grande - chica, 88 - 54);
});

test('la sangría siempre deja pasar a la marca entera más su margen', () => {
  for (const tam of [40, 54, 64, 88, 120]) {
    const { sangria } = geometriaCabecera(124, tam);
    assert.ok(sangria > 20 + tam, `con tam ${tam} el título arranca encima de la marca`);
  }
});

test('los dos números son ENTEROS: un medio píxel en un absolute se ve', () => {
  // Con un lado impar, `tam/2` no es entero. Un `top: 96.5px` deja la marca a medio
  // píxel del borde y el navegador la antialiasea: se ve como un borde sucio.
  for (const tam of [53, 55, 87]) {
    const g = geometriaCabecera(124, tam);
    assert.ok(Number.isInteger(g.cruce), `cruce ${g.cruce} no es entero`);
    assert.ok(Number.isInteger(g.sangria), `sangria ${g.sangria} no es entero`);
  }
});
