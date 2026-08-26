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
import { clasificarFalla, clasificarFallaDelNavegador, extraerMediaId, LIMITES, MODELOS, RECAPTCHA_SITE_KEY } from '../lib/flow-protocolo';

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
test('la sesión marcada NO se reintenta, ni por reason ni por texto', () => {
  for (const cuerpo of [
    conReason('PUBLIC_ERROR_UNUSUAL_ACTIVITY'),
    { error: { message: 'reCAPTCHA evaluation failed' } },
  ]) {
    const r = clasificarFalla(403, cuerpo);
    assert.equal(r.motivo, 'sesion_marcada', JSON.stringify(cuerpo));
    assert.equal(r.reintentable, false);
    assert.match(r.error, /parar/i);
  }
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
