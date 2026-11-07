// =============================================================================
// ApiMart: que una generación que ARRANCÓ no se pueda dar por fallada (7/11/2026)
// =============================================================================
// Martín, 7/11: «no quiero que sólo dependamos de Flow, muchos clientes no tienen Flow… quiero poder
// ofrecerles otra API». Ésta es la otra API, y la paga MaKo — así que cada generación de más es plata nuestra.
//
// ⚠️ EL BUG QUE ESTO IMPIDE YA PASÓ, el 7/11, mientras se medían los precios. ApiMart devuelve el `task_id` en
// DOS formas según el modelo. Mi extractor leía una sola, no encontró el id, y el código concluyó que la
// llamada había fallado. **No había fallado: estaba corriendo y cobrándose.** Un reintento automático ahí
// paga dos veces la misma pieza.
//
// Por eso esto prueba la conducta, no el formato: que el id se lea venga como venga, y —más importante— que
// lo que NO se entiende no se trate como «no arrancó».
//
// Correr: node --import tsx --test tests/apimart-arranque.test.ts
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  comoQuedo, sePuedeReintentar, cuerpoDePedido, usdDeVideo,
  MODELOS_VIDEO, MODELO_VIDEO_POR_DEFECTO, modelosVerticales,
} from '../lib/apimart-reglas';

test('el task_id se lee venga como venga: objeto o lista', () => {
  // Las dos formas MEDIDAS contra la API real el 7/11. seedance/wan dan la primera; MiniMax la segunda.
  const comoObjeto = comoQuedo({ data: { task_id: 'task_ABC' } }, 200);
  const comoLista = comoQuedo({ code: 200, data: [{ status: 'submitted', task_id: 'task_XYZ' }] }, 200);
  assert.equal(comoObjeto.estado, 'aceptado');
  assert.equal(comoLista.estado, 'aceptado', 'la forma de lista se leyó como un fallo: así se paga dos veces');
  if (comoObjeto.estado === 'aceptado') assert.equal(comoObjeto.taskId, 'task_ABC');
  if (comoLista.estado === 'aceptado') assert.equal(comoLista.taskId, 'task_XYZ');
});

test('lo que no se entiende NO es «no arrancó», y por eso no se reintenta solo', () => {
  // ⚠️ El corazón del asunto. Con un proveedor que cobra por generación, «no sé si arrancó» y «no arrancó»
  // son cosas distintas, y la diferencia es dinero. Tratar lo desconocido como fallo es lo que duplica.
  for (const raro of [null, undefined, {}, { data: null }, { data: [] }, { algo: 'otra cosa' }, { data: { id: 'x' } }]) {
    const q = comoQuedo(raro, 500);
    assert.equal(q.estado, 'desconocido', `una respuesta ${JSON.stringify(raro)} se clasificó como ${q.estado}`);
    assert.equal(sePuedeReintentar(q), false, 'se habilitó reintentar algo que puede estar corriendo y cobrándose');
  }
});

test('un rechazo explícito del proveedor SÍ se puede reintentar: no arrancó nada', () => {
  // Éste es el 400 real que devolvió MiniMax cuando le mandé el campo equivocado.
  const q = comoQuedo({
    code: 'invalid_request_error',
    message: 'MiniMax-Hailuo-2.3-Fast only supports image-to-video; `first_frame_image` is required',
  }, 400);
  assert.equal(q.estado, 'rechazado', 'un pedido mal armado se tomó como estado desconocido: se traba para siempre');
  assert.equal(sePuedeReintentar(q), true);
});

test('una generación aceptada NUNCA se reintenta: ya corre y ya se cobra', () => {
  assert.equal(sePuedeReintentar(comoQuedo({ data: { task_id: 't' } }, 200)), false);
});

test('una data: URL se frena ACÁ, no en el 400 del proveedor', () => {
  // Medido: /v1/videos/generations contesta «Only http/https URLs or asset:// … are supported». La ruta de
  // imágenes SÍ las acepta, así que una prueba que anda en imágenes no prueba nada sobre video: el error
  // aparece recién el día que alguien genera un video de verdad.
  assert.throws(
    () => cuerpoDePedido('seedance-2.0-mini', 'data:image/jpeg;base64,/9j/4AAQ', 'hola', 5),
    /http/i,
  );
  assert.doesNotThrow(() => cuerpoDePedido('seedance-2.0-mini', 'https://x.test/f.jpg', 'hola', 5));
});

test('cada modelo pide la imagen con SU nombre de campo', () => {
  // No está documentado en ningún lado: se descubre con un 400. Si el cuerpo se arma con el campo
  // equivocado, la generación no arranca y el usuario ve un error que no explica nada.
  const seed = cuerpoDePedido('seedance-2.0-mini', 'https://x.test/f.jpg', 'p', 5);
  const mini = cuerpoDePedido('MiniMax-Hailuo-2.3-Fast', 'https://x.test/f.jpg', 'p', 5);
  assert.ok(Array.isArray(seed.image_urls), 'seedance no recibió image_urls');
  assert.equal(typeof mini.first_frame_image, 'string', 'MiniMax no recibió first_frame_image');
  assert.equal(mini.image_urls, undefined, 'a MiniMax se le mandó image_urls, que no entiende');
});

test('el default devuelve 9:16, aunque no sea el más barato', () => {
  // ⚠️ La guarda del producto. Hailuo sale un tercio menos y devuelve 3:4 — y un reel es vertical. Un
  // formato equivocado no se arregla recortando: recorta la cara, que es lo único que no se puede perder.
  assert.equal(MODELOS_VIDEO[MODELO_VIDEO_POR_DEFECTO].formato, '9:16',
    'el modelo por defecto no devuelve vertical: las piezas van a salir con la cara recortada');
  assert.ok(modelosVerticales().length > 0, 'no queda ningún modelo que sirva para un reel');
  assert.ok(modelosVerticales().every((m) => m.formato === '9:16'));
});

test('los precios están MEDIDOS y el caro no se vuelve el default por descuido', () => {
  // Los tres preservan la identidad (la preserva el método, no el modelo). Entonces lo único que distingue
  // al default es precio y formato — y si alguien pone el caro, esto se pone rojo.
  const def = MODELOS_VIDEO[MODELO_VIDEO_POR_DEFECTO];
  const verticales = modelosVerticales();
  assert.equal(def.usdPorSegundo, Math.min(...verticales.map((m) => m.usdPorSegundo)),
    `el default cuesta US$${def.usdPorSegundo}/s y hay un vertical más barato`);
  for (const m of Object.values(MODELOS_VIDEO)) {
    assert.ok(m.usdPorSegundo > 0.005 && m.usdPorSegundo < 0.2, `US$${m.usdPorSegundo}/s en ${m.id} no es un precio medido`);
  }
});

test('lo que cuesta crece con los segundos y nunca es negativo', () => {
  assert.ok(usdDeVideo('seedance-2.0-mini', 10) > usdDeVideo('seedance-2.0-mini', 5));
  assert.equal(usdDeVideo('seedance-2.0-mini', -5), 0, 'una duración negativa dio un costo distinto de cero');
});
