// =============================================================================
// La plantilla de fábrica: que un cliente nuevo pueda generar sin hacerlo a mano
// =============================================================================
// Hasta hoy un cliente nuevo NO podía generar una imagen hasta hacer una a mano
// en Google Flow con la pestaña abierta, para que el espejo copiara el pedido. Le
// costó la tarde a una clienta, y el dueño lo cortó con la pregunta correcta:
// «¿por qué hacemos eso cada vez que uno quiere generar? Si tú ya sabes cómo es».
//
// Tiene razón: la FORMA del pedido es universal. Lo único que de verdad es de
// cada cliente es el `projectId`.
//
// Lo que estos tests cuidan es lo OTRO: que este archivo no se convierta en la
// fuente de verdad. Es una foto de un contrato privado de Google que ya derivó
// una vez —el modelo hoy es `GEM_PIX_2` y los comentarios viejos del repo dicen
// `NARWHAL`—, así que tiene que ser un piso que cualquier pedido real desplace.

import test from 'node:test';
import assert from 'node:assert/strict';
import { plantillaImagenDeFabrica, conPlantillaDeFabrica, CLASE_IMAGEN } from '../lib/plantilla-fabrica';
import { fundirPlantillas, sanearPlantillas, tieneCaraParcheable } from '../lib/flow-plantillas';

const PROJ = '9973383e-74eb-4503-80f3-d30fb856781a';

// ── Que sirva para lo que se hizo ───────────────────────────────────────────

test('lleva el projectId del cliente en la url Y en el cuerpo', () => {
  // Las dos veces: Flow lo mira en el path y en el clientContext.
  const p = plantillaImagenDeFabrica(PROJ)!;
  assert.match(p.url, new RegExp(`/v1/projects/${PROJ}/`));
  assert.equal(JSON.parse(p.cuerpo!).clientContext.projectId, PROJ);
});

test('tiene DÓNDE poner la cara, que es lo que decide si se puede parchear', () => {
  // `caraParcheable()` exige `imageInputs[0]` con `name` Y `imageInputType`. Con
  // uno solo, parchear deja el pedido a medias — y `fundir()` reemplaza arrays
  // enteros, así que un `imageInputs` ausente se crearía sin su tipo.
  const p = plantillaImagenDeFabrica(PROJ)!;
  assert.equal(tieneCaraParcheable(p.cuerpo), true);
});

test('los valores del contrato son los MEDIDOS, no inventados', () => {
  // Reconstruir un contrato privado a partir de documentación ajena ya costó caro
  // en este repo. Si alguien cambia uno de estos, que sea mirando tráfico real.
  const b = JSON.parse(plantillaImagenDeFabrica(PROJ)!.cuerpo!);
  assert.equal(b.requests[0].imageModelName, 'GEM_PIX_2');
  assert.equal(b.requests[0].imageAspectRatio, 'IMAGE_ASPECT_RATIO_PORTRAIT');
  assert.equal(b.requests[0].imageInputs[0].imageInputType, 'IMAGE_INPUT_TYPE_REFERENCE');
  assert.equal(b.clientContext.tool, 'PINHOLE');
  assert.equal(b.useNewMedia, true);
});

test('sin un projectId válido NO se inventa una plantilla', () => {
  // Un pedido sin proyecto no es un pedido a medias: es uno que va a fallar con
  // un error de Google que no dice nada útil.
  assert.equal(plantillaImagenDeFabrica(''), null);
  assert.equal(plantillaImagenDeFabrica('no-soy-un-uuid'), null);
  assert.equal(plantillaImagenDeFabrica('9973383e'), null);
});

// ── Y que NO se convierta en la fuente de verdad ────────────────────────────

test('cualquier pedido REAL la desplaza sola', () => {
  // El mecanismo es `cuando: 0`: `fundirPlantillas` prefiere la más reciente, así
  // que nadie tiene que acordarse de borrar la de fábrica.
  const fabrica = plantillaImagenDeFabrica(PROJ)!;
  const real = { ...fabrica, cuerpo: '{"medido":true}', cuando: 1788205948335, deFabrica: undefined };
  const [queda] = fundirPlantillas([fabrica], [real]);
  assert.equal(queda.cuerpo, '{"medido":true}');
});

test('y NO pisa una medida que ya existía', () => {
  // Una medida describe lo que Google acepta HOY en la cuenta de ese cliente; la
  // de fábrica, lo que aceptaba cuando se copió. Pisarla sería cambiar un hecho
  // por un recuerdo.
  const real = { clase: CLASE_IMAGEN, url: 'https://aisandbox-pa.googleapis.com/x', metodo: 'POST', headers: {}, cuerpo: '{"real":1}', cuando: 999 };
  const out = conPlantillaDeFabrica([real], PROJ);
  assert.equal(out.length, 1);
  assert.equal(out[0].cuerpo, '{"real":1}');
});

test('se suma sólo cuando falta la de imagen', () => {
  const otra = { clase: 'credits', url: 'https://aisandbox-pa.googleapis.com/v1/credits', metodo: 'GET', headers: {}, cuerpo: null, cuando: 5 };
  const out = conPlantillaDeFabrica([otra], PROJ);
  assert.equal(out.length, 2);
  assert.ok(out.some((p) => p.clase === CLASE_IMAGEN));
});

test('sin projectId no se suma nada: se espera a saberlo', () => {
  assert.deepEqual(conPlantillaDeFabrica([], ''), []);
});

test('queda MARCADA, y la marca sobrevive al saneo', () => {
  // Sin la marca, una de fábrica que quedó vieja porque Google cambió el contrato
  // es indistinguible de una medida — y el diagnóstico arranca de una premisa
  // falsa. Y si el saneo la borrara, se perdería en el primer ida y vuelta.
  const p = plantillaImagenDeFabrica(PROJ)!;
  assert.equal(p.deFabrica, true);
  assert.equal(sanearPlantillas([p])[0]?.deFabrica, true);
});

test('pasa el saneo entero: origen, clase y cuerpo', () => {
  // Si `sanearPlantillas` la descartara, todo esto sería decorativo — es el filtro
  // por el que pasa TODO lo que entra y sale del espejo.
  const p = plantillaImagenDeFabrica(PROJ)!;
  const [s] = sanearPlantillas([p]);
  assert.ok(s, 'la de fábrica sobrevive al saneo');
  assert.equal(s.clase, CLASE_IMAGEN);
  assert.ok(s.cuerpo && s.cuerpo.length > 100);
});
