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
import {
  plantillaImagenDeFabrica, conPlantillaDeFabrica, CLASE_IMAGEN,
  plantillaClipDeFabrica, plantillaEstadoClipDeFabrica, CLASE_CLIP, CLASE_ESTADO_CLIP,
} from '../lib/plantilla-fabrica';
import { parchesEstadoClip } from '../lib/flow-protocolo';
import { proyectoDePlantilla } from '../lib/flow-plantillas';
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
  // ⚠️ La medida de imagen queda INTACTA, y eso es lo que este test cuida. Lo que
  // cambió el 01/09/2026 es que ahora se suman además las dos de VIDEO: antes la
  // función salía temprano al encontrar la de imagen, y por eso un cliente que ya
  // había generado una imagen nunca recibía las que le faltaban para filmar.
  const imagen = out.filter((p) => p.clase === CLASE_IMAGEN);
  assert.equal(imagen.length, 1);
  assert.equal(imagen[0].cuerpo, '{"real":1}');
  assert.equal(out.length, 3);
});

test('se suman las que faltan, sin tocar lo que ya había', () => {
  const otra = { clase: 'credits', url: 'https://aisandbox-pa.googleapis.com/v1/credits', metodo: 'GET', headers: {}, cuerpo: null, cuando: 5 };
  const out = conPlantillaDeFabrica([otra], PROJ);
  assert.equal(out.length, 4);                    // credits + las tres de fábrica
  assert.ok(out.some((p) => p.clase === CLASE_IMAGEN));
  assert.ok(out.some((p) => p.clase === 'credits'));
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

// =============================================================================
// Las dos de VIDEO: el paso manual que quedaba vivo en el último tramo
// =============================================================================
// La fábrica cubría sólo la imagen. Un usuario nuevo llegaba hasta el escenario
// —sin tocar Flow, que era el punto— y ahí, al filmar, se topaba con «Abre Flow,
// genera UNO a mano usando tu foto». Medido en producción el 01/09/2026: le pasó
// a una clienta, con el error `SIN_PLANTILLA:video:batchAsyncGenerateVideoReferenceImages`.


test('la de CLIP trae el clientContext, que es todo lo que el código no manda', () => {
  const p = plantillaClipDeFabrica(PROJ);
  assert.ok(p);
  const c = JSON.parse(p.cuerpo!);
  // `cuerpoClipReferencias` manda todo MENOS esto, y por eso la plantilla existe.
  assert.equal(c.clientContext.projectId, PROJ);
  assert.equal(c.clientContext.tool, 'PINHOLE');
  assert.equal(c.clientContext.recaptchaContext.applicationType, 'RECAPTCHA_APPLICATION_TYPE_WEB');
  assert.equal(p.metodo, 'POST');
  assert.match(p.url, /\/v1\/video:batchAsyncGenerateVideoReferenceImages$/);
});

test('⚠️ la de CLIP NO afirma en qué plan está la cuenta del cliente', () => {
  // El pedido real trae `userPaygateTier: 'PAYGATE_TIER_NOT_PAID'`. Copiarlo del
  // espejo de otro cliente sería afirmar un hecho sobre una cuenta ajena que no
  // medimos. Omitirlo deja que lo resuelva Google, que sí lo sabe.
  const c = JSON.parse(plantillaClipDeFabrica(PROJ)!.cuerpo!);
  assert.equal(c.clientContext.userPaygateTier, undefined);
  // Y `sessionId` es del navegador y cambia en cada sesión. La de imagen ya lo
  // omite y está generando en producción: la evidencia dice que no es obligatorio.
  assert.equal(c.clientContext.sessionId, undefined);
});

test('la de ESTADO deja el hueco que `parchesEstadoClip` pisa', () => {
  // Sin esta clase el clip se genera igual y NADIE VA A BUSCARLO: la toma se
  // queda «filmando» hasta que alguien mire el proyecto de Flow a mano.
  const p = plantillaEstadoClipDeFabrica(PROJ);
  assert.ok(p);
  const c = JSON.parse(p.cuerpo!);
  assert.equal(c.media[0].projectId, PROJ);
  assert.equal(c.media[0].name, '');
  // El parche del protocolo apunta exactamente a ese hueco.
  assert.deepEqual(Object.keys(parchesEstadoClip('op-1')), ['media.0.name']);
});

test('las dos se desplazan solas ante un pedido REAL', () => {
  // `cuando: 0` es lo que hace que el primer pedido que la extensión copie del
  // tráfico de Flow las reemplace, sin que nadie tenga que acordarse de borrarlas.
  for (const p of [plantillaClipDeFabrica(PROJ), plantillaEstadoClipDeFabrica(PROJ)]) {
    assert.equal(p!.cuando, 0);
    assert.equal(p!.deFabrica, true);
  }
});

test('sin un projectId de verdad no se inventa ninguna', () => {
  for (const malo of ['', 'no-es-un-uuid', '   ', '9973383e']) {
    assert.equal(plantillaClipDeFabrica(malo), null);
    assert.equal(plantillaEstadoClipDeFabrica(malo), null);
  }
});

test('⚠️ conPlantillaDeFabrica cubre clase por clase, no «si falta alguna»', () => {
  // Salía temprano en cuanto encontraba la de imagen. O sea que el cliente que YA
  // había generado una imagen —el que tenía la de imagen— nunca recibía las de
  // video, que eran justo las que le faltaban. Es el caso real de la clienta.
  const soloImagen = [{
    clase: CLASE_IMAGEN, url: 'x', metodo: 'POST', headers: {}, cuerpo: '{}', cuando: 111,
  }];
  const out = conPlantillaDeFabrica(soloImagen, PROJ);
  const clases = out.map((p) => p.clase);
  assert.ok(clases.includes(CLASE_CLIP), 'no se sumó la de filmar');
  assert.ok(clases.includes(CLASE_ESTADO_CLIP), 'no se sumó la de preguntar si salió');
  // Y la medida NO se pisa: describe lo que Google acepta HOY en esa cuenta.
  assert.equal(out.find((p) => p.clase === CLASE_IMAGEN)?.cuando, 111);
  assert.equal(out.filter((p) => p.clase === CLASE_IMAGEN).length, 1);
});

test('con las tres ya medidas no se agrega nada', () => {
  const todas = [CLASE_IMAGEN, CLASE_CLIP, CLASE_ESTADO_CLIP].map((clase) => ({
    clase, url: 'x', metodo: 'POST', headers: {}, cuerpo: '{}', cuando: 222,
  }));
  assert.equal(conPlantillaDeFabrica(todas, PROJ).length, 3);
});

test('un cliente SIN nada recibe las tres, que es todo lo que hace falta para un anuncio', () => {
  // El recorrido entero: generar el escenario (imagen), filmarlo (clip) y saber
  // que salió (estado). Con las tres, nadie tiene que abrir Flow a generar nada.
  const clases = conPlantillaDeFabrica([], PROJ).map((p) => p.clase).sort();
  assert.deepEqual(clases, [CLASE_IMAGEN, CLASE_CLIP, CLASE_ESTADO_CLIP].sort());
});

test('⚠️ el projectId se puede DERIVAR de una plantilla ya guardada', () => {
  // Las tres fábricas se abstienen sin un uuid, y el navegador lo aprende de UN
  // solo lugar: la url de las llamadas de imagen. Un cliente que todavía no hizo
  // ninguna llegaba con vacío, no recibía ninguna fábrica, y le volvía a salir
  // «Abre Flow, genera UNO a mano» — el paso manual que las fábricas borran,
  // degradando en silencio: sin error y sin log.
  //
  // Las de video traen el proyecto adentro del cuerpo, así que con una alcanza.
  const soloVideo = [{
    clase: CLASE_CLIP,
    url: 'https://aisandbox-pa.googleapis.com/v1/video:batchAsyncGenerateVideoReferenceImages',
    metodo: 'POST', headers: {}, cuando: 7,
    cuerpo: JSON.stringify({ clientContext: { projectId: PROJ } }),
  }];
  assert.equal(proyectoDePlantilla(soloVideo[0]), PROJ);

  // Y con eso —sin que el latido traiga projectId— se pueden sembrar las que faltan.
  const derivado = soloVideo.map(proyectoDePlantilla).find((x) => !!x) || '';
  const out = conPlantillaDeFabrica(soloVideo, derivado);
  assert.ok(out.some((p) => p.clase === CLASE_IMAGEN));
  assert.ok(out.some((p) => p.clase === CLASE_ESTADO_CLIP));
});

test('sin NADA de donde derivar, las fábricas se abstienen', () => {
  // No inventa un uuid: un projectId equivocado manda el pedido al proyecto de
  // otro, y eso no da error — da una imagen en la grilla que no es de nadie.
  assert.deepEqual(conPlantillaDeFabrica([], ''), []);
});
