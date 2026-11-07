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
  MODELOS_VIDEO, MODELO_VIDEO_POR_DEFECTO, MODELO_PARA_PROBAR, modelosQueRespetanLaEntrada,
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

test('el default RESPETA la proporción de la imagen, que es lo único que se puede prometer', () => {
  // ⚠️ Esta guarda decía antes «el default devuelve 9:16». Era falsa: medido el 7/11, la proporción la pone
  // la IMAGEN DE ENTRADA y cada modelo la respeta o la ignora (el error de wan lo dice textual:
  // «ratio is determined by input image»). Un reel sale vertical porque la imagen es vertical.
  assert.equal(MODELOS_VIDEO[MODELO_VIDEO_POR_DEFECTO].respetaLaEntrada, true,
    'el default no respeta la proporción de entrada: las piezas van a salir recortadas');
  assert.ok(modelosQueRespetanLaEntrada().length > 0, 'no queda ningún modelo que respete la entrada');
  assert.ok(modelosQueRespetanLaEntrada().every((m) => m.respetaLaEntrada));
});

test('el default es el MÁS BARATO de los que respetan la entrada', () => {
  // Ninguno «preserva la cara» mejor que otro: eso lo preserva el método (la foto es el cuadro 0).
  // Entonces lo único que distingue al default es precio y si respeta la proporción.
  const def = MODELOS_VIDEO[MODELO_VIDEO_POR_DEFECTO];
  const fieles = modelosQueRespetanLaEntrada();
  assert.equal(def.usdPorSegundo, Math.min(...fieles.map((m) => m.usdPorSegundo)),
    `el default cuesta US$${def.usdPorSegundo}/s y hay uno más barato que también respeta la entrada`);
});

test('el modelo para PROBAR es el más barato de todos, y no es el de entregar', () => {
  // ⚠️ Esta guarda vale US$ 11,51: lo que se tiró el 7/11 validando con modelos caros preguntas que no
  // dependen del modelo. El de probar tiene que ser el piso de precio del catálogo, siempre.
  const probar = MODELOS_VIDEO[MODELO_PARA_PROBAR];
  const piso = Math.min(...Object.values(MODELOS_VIDEO).map((m) => m.usdPorSegundo));
  assert.equal(probar.usdPorSegundo, piso,
    `el modelo para probar cuesta US$${probar.usdPorSegundo}/s y hay uno más barato en el catálogo`);
  // Y que la diferencia con el más caro siga siendo visible: es el número que evita repetir el error.
  const techo = Math.max(...Object.values(MODELOS_VIDEO).map((m) => m.usdPorSegundo));
  assert.ok(techo / piso > 10, `el caro ya no es 10× el barato (${(techo / piso).toFixed(1)}×): revisar la tabla`);
});

test('los precios están MEDIDOS, no estimados', () => {
  for (const m of Object.values(MODELOS_VIDEO)) {
    assert.ok(m.usdPorSegundo > 0.005 && m.usdPorSegundo < 1,
      `US$${m.usdPorSegundo}/s en ${m.id} no es un precio medido`);
  }
});

test('lo que cuesta crece con los segundos y nunca es negativo', () => {
  assert.ok(usdDeVideo('seedance-2.0-mini', 10) > usdDeVideo('seedance-2.0-mini', 5));
  assert.equal(usdDeVideo('seedance-2.0-mini', -5), 0, 'una duración negativa dio un costo distinto de cero');
});
