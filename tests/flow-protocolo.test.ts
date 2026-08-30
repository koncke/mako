// =============================================================================
// El protocolo de Google Flow: clasificar el fallo y sacar el id del medio
// =============================================================================
// Las dos funciones que deciden si el pipeline hace lo correcto, y las dos
// fallan en silencio si se degradan:
//
// - `clasificarFalla` decide si se reintenta. Confundir un terminal con un
//   transitorio quema créditos en un loop; confundir «la sesión está marcada»
//   con «transitorio» hace que sigamos pegando justo cuando hay que parar.
// - `extraerMediaId` decide qué se guarda. Guardar el `mediaGenerationId`
//   (protobuf en base64) rompe todo lo que venga después SIN dar error en el
//   momento, que es la peor forma de romperse.
//
// `lib/flow.ts` tiene `server-only`, así que se importa con `--conditions`
// puestas por el runner de tests del repo; las dos funciones bajo prueba son
// puras y no tocan red.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clasificarFalla, clasificarFallaDelNavegador, leerSaldo, extraerMediaId, LIMITES, MODELOS, RECAPTCHA_SITE_KEY } from '../lib/flow-protocolo';

// ── Clasificar el fallo ──────────────────────────────────────────────────────

const conReason = (reason: string, message = 'algo') => ({
  error: { message, details: [{ reason }] },
});

test('el filtro de contenido es TERMINAL: reintentar no cambia el prompt', () => {
  const r = clasificarFalla(400, conReason('PUBLIC_ERROR_UNSAFE_GENERATION'));
  assert.equal(r.motivo, 'contenido');
  assert.equal(r.reintentable, false);
});

test('la cuota agotada es TERMINAL: reintentar la quema más rápido', () => {
  const r = clasificarFalla(429, conReason('PUBLIC_ERROR_USER_QUOTA_REACHED'));
  assert.equal(r.motivo, 'cuota');
  assert.equal(r.reintentable, false);
});

test('el modelo no disponible es TERMINAL: se baja de modelo, no se insiste', () => {
  const r = clasificarFalla(403, conReason('PUBLIC_ERROR_MODEL_ACCESS_DENIED'));
  assert.equal(r.motivo, 'modelo');
  assert.equal(r.reintentable, false);
});

// El peor de todos: si la sesión quedó marcada, cada llamada nueva empeora el
// score. Un `reintentable: true` acá es lo que termina de quemar la cuenta.
test('la sesión marcada NO se reintenta', () => {
  const r = clasificarFalla(403, conReason('PUBLIC_ERROR_UNUSUAL_ACTIVITY'));
  assert.equal(r.motivo, 'sesion_marcada');
  assert.equal(r.reintentable, false);
  assert.match(r.error, /parar/i);
});

/**
 * ⚠️ Este test AFIRMABA LO CONTRARIO, y estaba mal.
 *
 * «reCAPTCHA evaluation failed» estaba metido en la misma rama que la sesión
 * marcada, y eso apagaba el PUENTE ENTERO además de decirle al dueño que
 * limpiara sus cookies. El 29/08 se midió qué lo disparaba de verdad: el token
 * se acuñaba con un nombre de acción distinto del endpoint que se llamaba
 * (reCAPTCHA Enterprise ata el token a la acción). El problema era NUESTRO.
 *
 * Los dos 403 se parecen y significan cosas opuestas: uno dice «esta cuenta está
 * quemada», el otro «este token no servía». El segundo se arregla acuñando otro.
 */
test('un token de reCAPTCHA rechazado NO es una sesión quemada, y NO se reintenta', () => {
  const r = clasificarFalla(403, { error: { message: 'reCAPTCHA evaluation failed' } });
  assert.equal(r.motivo, 'captcha', 'tiene motivo propio: no es ni sesión quemada ni un fallo cualquiera');
  assert.doesNotMatch(r.error, /cookies/i, 'no se le pide al dueño que limpie nada: el problema no es suyo');

  // ⚠️ Y NO se reintenta, aunque suene a que reintentar es gratis.
  //
  // Si la causa fuera el SCORE de la sesión, cada reintento acuña otro token desde
  // la misma pestaña y lo empeora — el modo de falla que este proyecto ya midió:
  // 25 pedidos automáticos contra un bloqueo, causando el bloqueo. Y si la causa
  // es un token mal acuñado, reintentar tampoco lo arregla: hay que acuñarlo bien,
  // que es un cambio de código.
  assert.equal(r.reintentable, false);
});

test('pero la página de bloqueo SIGUE frenando, aunque el 403 hable de reCAPTCHA', () => {
  // La red de abajo: si de verdad la sesión está marcada, el reintento cae acá.
  const r = clasificarFalla(403, '<html><head><title>Sorry...</title></head><body>unusual traffic</body></html>');
  assert.equal(r.motivo, 'sesion_marcada');
  assert.equal(r.reintentable, false);
});

test('el medio vencido SÍ se reintenta: se resube y sigue', () => {
  const r = clasificarFalla(404, { error: { message: 'Requested entity was not found.' } });
  assert.equal(r.motivo, 'medio_vencido');
  assert.equal(r.reintentable, true);
});

test('un 401 pide recapturar el token, no reescribir el pedido', () => {
  const r = clasificarFalla(401, { error: { message: 'Request had invalid authentication credentials.' } });
  assert.equal(r.motivo, 'sin_sesion');
  assert.equal(r.reintentable, true);
});

test('un 500 sin reason cae en transitorio y se reintenta', () => {
  const r = clasificarFalla(500, { error: { message: 'Internal error encountered.' } });
  assert.equal(r.motivo, 'transitorio');
  assert.equal(r.reintentable, true);
});

// Flow manda el fallo ADENTRO de un 200 y anidado bajo `data`. Es la regla del
// repo sobre `res.ok`, que ya mordió en Meta y en Evolution.
test('lee el error aunque venga anidado en data.error con HTTP 200', () => {
  const r = clasificarFalla(200, { data: { error: { message: 'x', details: [{ reason: 'PUBLIC_ERROR_USER_QUOTA_REACHED' }] } } });
  assert.equal(r.motivo, 'cuota');
});

test('gana el reason estructurado sobre el texto del mensaje', () => {
  // El texto de un proveedor cambia sin aviso; el enum, mucho menos.
  const r = clasificarFalla(400, conReason('PUBLIC_ERROR_UNSAFE_GENERATION', 'Internal error encountered'));
  assert.equal(r.motivo, 'contenido');
});

test('un cuerpo basura no rompe: cae en transitorio', () => {
  for (const basura of [null, undefined, 'texto suelto', 42, []]) {
    const r = clasificarFalla(503, basura);
    assert.equal(r.motivo, 'transitorio', String(basura));
  }
});

// ── El id del medio ──────────────────────────────────────────────────────────

const UUID_OK = '3f2a1b4c-5d6e-7f80-91a2-b3c4d5e6f708';

test('toma el UUID cuando viene suelto', () => {
  assert.equal(extraerMediaId({ mediaId: UUID_OK }), UUID_OK);
  assert.equal(extraerMediaId({ name: UUID_OK }), UUID_OK);
});

test('lo extrae de la URL firmada cuando no viene suelto', () => {
  const url = `https://storage.googleapis.com/ai-sandbox-videofx/${UUID_OK}/video.mp4?X-Goog-Expires=3600`;
  assert.equal(extraerMediaId({ fifeUrl: url }), UUID_OK);
});

// EL caso que rompe todo río abajo sin dar error hoy.
test('NUNCA devuelve el mediaGenerationId en base64', () => {
  const proto = 'CAMSJDNmMmExYjRjLTVkNmUtN2Y4MC05MWEyLWIzYzRkNWU2ZjcwOA';
  assert.equal(extraerMediaId({ mediaGenerationId: proto }), null);
  // Y si están los dos, gana el UUID.
  assert.equal(extraerMediaId({ mediaGenerationId: proto, mediaId: UUID_OK }), UUID_OK);
});

test('un valor que no es UUID no se toma por más que esté en mediaId', () => {
  assert.equal(extraerMediaId({ mediaId: 'CAMS-algo-que-no-es-uuid' }), null);
  assert.equal(extraerMediaId({}), null);
  assert.equal(extraerMediaId(null), null);
});

// ── Las constantes que contienen el ritmo ────────────────────────────────────
// Son la contención que reemplaza al simulador de actividad humana de FlowKit.
// Si alguien las afloja «para ir más rápido», vuelve el 403 y la cuenta marcada.

test('el ritmo no baja de lo que hace una persona', () => {
  assert.ok(LIMITES.cooldownMs >= 10_000, `cooldown ${LIMITES.cooldownMs}`);
  assert.ok(LIMITES.concurrencia <= 5, `concurrencia ${LIMITES.concurrencia}`);
  assert.ok(LIMITES.timeoutMs > LIMITES.pollMs);
});

test('la site key del captcha es la de Flow y no un placeholder', () => {
  assert.match(RECAPTCHA_SITE_KEY, /^6L[\w-]{38}$/);
});

test('los modelos son ids literales, no descripciones', () => {
  for (const [k, v] of Object.entries(MODELOS)) {
    assert.match(v, /^[a-zA-Z0-9_]+$/, `${k}: «${v}»`);
  }
});

// ── Las fallas que NO vienen de la API sino del navegador ────────────────────
// El `catch` de la extensión clasifica por descarte: todo lo que no reconoce sale
// como «transitorio, reintentable». Con eso, un problema permanente se reintenta
// cinco veces y muere igual sin decir nunca qué había que hacer — pasó, con tres
// trabajos consecutivos quemados contra lo mismo.

test('la pestaña de Flow sin content script NO se reintenta: se recarga', () => {
  const r = clasificarFallaDelNavegador('Could not establish connection. Receiving end does not exist.');
  assert.equal(r?.motivo, 'puente_dormido');
  assert.equal(r?.reintentable, false);
  assert.match(r!.error, /Recárgala|recarga/i, 'el mensaje tiene que decir QUÉ hacer');
});

test('el captcha que no contesta tampoco se reintenta', () => {
  for (const msg of ['CAPTCHA_TIMEOUT', 'SIN_GRECAPTCHA']) {
    const r = clasificarFallaDelNavegador(msg);
    assert.equal(r?.motivo, 'puente_dormido', msg);
    assert.equal(r?.reintentable, false, msg);
  }
});

test('sin pestaña de Flow es sin_sesion, no puente_dormido', () => {
  // Son cosas distintas y llevan a acciones distintas: abrir Flow vs. recargarlo.
  const r = clasificarFallaDelNavegador('NO_FLOW_TAB');
  assert.equal(r?.motivo, 'sin_sesion');
  assert.equal(r?.reintentable, false);
});

test('un error que no reconoce devuelve null y NO pisa la clasificación previa', () => {
  // Devolver un default acá sería el mismo error por descarte, movido de lugar.
  assert.equal(clasificarFallaDelNavegador('HTTP 500'), null);
  assert.equal(clasificarFallaDelNavegador(''), null);
});

test('ningún motivo del navegador es reintentable: los tres piden una acción', () => {
  // El contrato completo. Si mañana se agrega uno reintentable, que este test lo
  // haga explícito en vez de que se cuele.
  for (const msg of ['Receiving end does not exist', 'CAPTCHA_TIMEOUT', 'SIN_GRECAPTCHA', 'NO_FLOW_TAB']) {
    assert.equal(clasificarFallaDelNavegador(msg)?.reintentable, false, msg);
  }
});

// ── El cuerpo no siempre es JSON ─────────────────────────────────────────────
// Google no contesta un error de la API cuando decide que el tráfico es
// automatizado: sirve su página HTML de bloqueo. Sin este caso, todo eso caía en
// «transitorio» y se REINTENTABA — y cada reintento empeora el score.
// Medido en producción el 26/08/2026: 25 pedidos consecutivos contra el bloqueo.

const SORRY = '<html><head><meta http-equiv="content-type" content="text/html; charset=utf-8"/>'
  + '<title>Sorry...</title></head><body>Our systems have detected unusual traffic'
  + ' from your computer network.</body></html>';

test('la página de bloqueo de Google FRENA, no se reintenta', () => {
  const r = clasificarFalla(429, SORRY);
  assert.equal(r.motivo, 'sesion_marcada');
  assert.equal(r.reintentable, false, 'reintentar contra el bloqueo empeora el score');
});

test('el bloqueo se detecta aunque el status sea 200', () => {
  // «res.ok no es salió bien»: el fallo puede venir con cualquier status.
  assert.equal(clasificarFalla(200, SORRY).motivo, 'sesion_marcada');
});

test('un 429 sin la página de bloqueo tampoco se reintenta', () => {
  // No hay backoff largo en la cola: volver antes de tiempo es lo que convierte
  // un límite pasajero en una sesión marcada.
  const r = clasificarFalla(429, { error: { message: 'Too Many Requests' } });
  assert.equal(r.reintentable, false);
});

test('un HTML cualquiera NO es un bloqueo: solo lo es el que lo dice', () => {
  // El guard va en positivo: se afirma el bloqueo por su marca, no por «vino algo
  // que no era JSON». Un 500 con una página de error genérica sigue siendo
  // transitorio y sí se reintenta.
  const r = clasificarFalla(500, '<html><body>Internal Server Error</body></html>');
  assert.equal(r.motivo, 'transitorio');
  assert.equal(r.reintentable, true);
});

test('el timeout del fetch desde la página también manda a recargar', () => {
  // El pedido lo hace la página de Flow, no el service worker: si no contesta,
  // la pestaña quedó en un estado del que no sale sola. Y NO se reintenta.
  for (const msg of ['FETCH_TIMEOUT', 'FETCH_FALLO']) {
    const r = clasificarFallaDelNavegador(msg);
    assert.equal(r?.motivo, 'puente_dormido', msg);
    assert.equal(r?.reintentable, false, msg);
    assert.doesNotMatch(r!.error, /captcha|seguridad/i, 'no puede mandar a mirar el captcha: es otra cosa');
  }
});

test('sin plantilla NO se inventa el pedido: se dice qué falta', () => {
  // La extensión calca el pedido del que hace la propia app de Flow. Si nunca vio
  // uno de esa clase, reconstruirlo a mano es exactamente lo que no funcionó.
  const r = clasificarFallaDelNavegador('SIN_PLANTILLA:credits');
  assert.equal(r?.motivo, 'puente_dormido');
  assert.equal(r?.reintentable, false);
  assert.match(r!.error, /credits/, 'tiene que decir QUÉ pedido falta');
  // ⚠️ Este assert miraba la frase literal («genera algo») y se puso rojo el día
  // que el mensaje mejoró, sobre un comportamiento que había mejorado. Ahora mide
  // el CONTRATO: que diga adónde ir y qué hacer ahí. Un test atado a la redacción
  // castiga escribir mejor, que es lo contrario de lo que tiene que hacer.
  assert.match(r!.error, /Flow/, 'tiene que decir dónde se arregla');
  assert.match(r!.error, /vuelve a intentar|espera/i, 'y qué hacer para que aparezca');
});

test('cada clase dice QUÉ hacer, y no «genera algo»', () => {
  // Con dos clases de generación, «abre Flow y genera algo» manda a hacer la que ya
  // estaba hecha: generar un video no le enseña al espejo a pedir una imagen, son
  // plantillas distintas. El mensaje tiene que nombrar la acción correcta.
  const img = clasificarFallaDelNavegador('SIN_PLANTILLA:flowMedia:batchGenerateImages');
  assert.match(img!.error, /imagen/i, 'la de imágenes manda a generar una IMAGEN');

  const vid = clasificarFallaDelNavegador('SIN_PLANTILLA:video:batchAsyncGenerateVideoReferenceImages');
  assert.match(vid!.error, /video/i, 'la de clips manda a generar un VIDEO');

  // Y las dos frases tienen que ser DISTINTAS: si son iguales, el mensaje volvió a
  // no decir cuál de las dos cosas hacer.
  assert.notEqual(img!.error, vid!.error);
});

test('la clase con dos puntos adentro llega ENTERA al mensaje', () => {
  // El bug: la clase se sacaba con `split(':')[1]`, y la de imágenes lleva dos
  // puntos adentro (`flowMedia:batchGenerateImages`). El error nombraba
  // `flowMedia`, un endpoint que NO EXISTE — o sea que el mensaje mandaba a
  // buscar otra cosa. Un dato partido a la mitad adentro de un error es peor que
  // no ponerlo: se lee como preciso.
  const r = clasificarFallaDelNavegador('SIN_PLANTILLA:flowMedia:batchGenerateImages');
  assert.match(r!.error, /flowMedia:batchGenerateImages/, 'la clase va completa');
});

test('una clase que todavía no tiene frase propia no se queda sin mensaje', () => {
  // El fallback importa: una clase nueva —el día que se agregue un endpoint— no
  // puede dejar al usuario con un error vacío. Dice lo genérico y nombra la clase.
  const r = clasificarFallaDelNavegador('SIN_PLANTILLA:algoQueTodaviaNoExiste');
  assert.equal(r?.motivo, 'puente_dormido');
  assert.match(r!.error, /algoQueTodaviaNoExiste/);
  assert.ok(r!.error.trim().length > 20, 'no puede ser una frase vacía');
});

// ── El saldo, medido contra una cuenta real el 26/08/2026 ───────────────────
const SALDO_REAL = {
  sku: 'WS_FREEMIUM', credits: 1012, serviceTier: 'SERVICE_TIER_ENTRY',
  userPaygateTier: 'PAYGATE_TIER_NOT_PAID', subscriptionCredits: 1012,
};

test('lee el saldo de una cuenta gratuita', () => {
  const s = leerSaldo(SALDO_REAL);
  assert.equal(s.creditos, 1012);
  assert.equal(s.esGratuito, true);
  assert.match(s.etiqueta, /1.012 créditos/);
  assert.match(s.etiqueta, /gratuito/);
});

test('«gratuito» se afirma solo con la marca de Google, nunca por descarte', () => {
  // Lo que no matchea no se declara «de pago»: se muestra el sku tal cual vino.
  const pago = leerSaldo({ sku: 'WS_PRO', credits: 12500, userPaygateTier: 'PAYGATE_TIER_PAID' });
  assert.equal(pago.esGratuito, false);
  assert.match(pago.etiqueta, /WS_PRO/);
  assert.doesNotMatch(pago.etiqueta, /gratuito/);
});

test('una respuesta sin créditos lo DICE, no inventa un cero', () => {
  // Un cero afirmaría que la cuenta está sin saldo, que es otra cosa.
  const s = leerSaldo({});
  assert.equal(s.creditos, null);
  assert.match(s.etiqueta, /no informado/);
});

test('NO convierte créditos a videos', () => {
  // El costo por clip que circula en el corpus sale de la doc de un tercero y no
  // está medido. Tratar ese dato como un hecho ya costó un día entero.
  const s = leerSaldo(SALDO_REAL);
  assert.doesNotMatch(s.etiqueta, /video|clip/i);
});

