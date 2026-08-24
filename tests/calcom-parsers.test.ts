// =============================================================================
// Cal.com — firma, parseo y clasificación
// =============================================================================
// El espejo de tests/calendly-parsers.test.ts, y hace falta separado porque son
// DOS PRODUCTOS distintos: otra empresa, otra firma, otro payload. Confundirlos ya
// costó una conversión real (24/08/2026, ws13: se agendó y MaKo no registró nada).
//
// Lo que estos tests cuidan, en orden de lo que más duele si se rompe:
//   1. la firma, porque es lo único que separa una reserva real de una inventada;
//   2. que el lead sea QUIEN RESERVÓ y no el dueño del calendario;
//   3. que R1 y R2 se clasifiquen igual acá que en Calendly.
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  verifyCalcomSignature,
  normalizarReserva,
  clasificarJuntaCalcom,
  accionDeTrigger,
  CalcomSignatureError,
  CALCOM_API,
  calcomHeaders,
} from '../lib/calcom';

const SECRET = 'secreto-de-prueba';
const BODY = JSON.stringify({ triggerEvent: 'BOOKING_CREATED', payload: { uid: 'bk_1' } });
const firmar = (body: string, secret = SECRET) =>
  crypto.createHmac('sha256', secret).update(body, 'utf8').digest('hex');

// ── La firma ────────────────────────────────────────────────────────────────

test('una firma correcta pasa, con y sin el prefijo sha256=', () => {
  const f = firmar(BODY);
  assert.doesNotThrow(() => verifyCalcomSignature(BODY, f, SECRET));
  // Distintos proxies y versiones agregan el prefijo. Rechazarlo sería rechazar
  // una firma correcta.
  assert.doesNotThrow(() => verifyCalcomSignature(BODY, `sha256=${f}`, SECRET));
  assert.doesNotThrow(() => verifyCalcomSignature(BODY, f.toUpperCase(), SECRET));
});

test('un body alterado NO pasa, aunque el cambio sea de un carácter', () => {
  const f = firmar(BODY);
  assert.throws(() => verifyCalcomSignature(BODY.replace('bk_1', 'bk_2'), f, SECRET), CalcomSignatureError);
});

test('la firma de OTRO secreto no pasa: es lo que separa a un inquilino de otro', () => {
  // El secreto lo elige quien crea el webhook, y la ayuda le pide al cliente que lo
  // comparta. Si esto no cortara, con el secreto de uno y el slug público de otro
  // se podrían forjar reservas que le escriben leads a la víctima.
  assert.throws(() => verifyCalcomSignature(BODY, firmar(BODY, 'otro-secreto'), SECRET), CalcomSignatureError);
});

test('sin header no pasa, y sin secreto configurado tampoco', () => {
  assert.throws(() => verifyCalcomSignature(BODY, null, SECRET), CalcomSignatureError);
  assert.throws(() => verifyCalcomSignature(BODY, firmar(BODY), ''), CalcomSignatureError);
});

test('⚠️ «no-secret-provided» se RECHAZA: es un header presente que no es una firma', () => {
  // La trampa propia de este proveedor: cuando el webhook se da de alta sin
  // secreto, Cal.com no omite el header — manda esta cadena. Un guard escrito
  // como `if (header) verificar()` la trata como firma; uno escrito como
  // `if (!secret) return` deja pasar el webhook sin verificar NADA, y ahí
  // cualquiera que descubra la URL puede inventar reservas.
  assert.throws(
    () => verifyCalcomSignature(BODY, 'no-secret-provided', SECRET),
    (e: unknown) => e instanceof CalcomSignatureError && /sin secreto/i.test(e.message),
    'tiene que rechazar Y decir qué hacer: el que lee el error es quien configuró el webhook',
  );
  // Y con el secreto vacío de nuestro lado tampoco: el fail-closed no depende de
  // cuál de las dos puntas falta.
  assert.throws(() => verifyCalcomSignature(BODY, 'no-secret-provided', ''), CalcomSignatureError);
});

// ── El payload ──────────────────────────────────────────────────────────────

const RESERVA = {
  uid: 'bk_abc',
  title: 'Llamada de auditoría entre Ana y Codigo Inmobiliario',
  startTime: '2026-09-01T15:00:00.000Z',
  endTime: '2026-09-01T15:30:00.000Z',
  eventTypeId: 4242,
  eventTypeSlug: 'llamada-de-auditoria',
  organizer: { name: 'Ana Dueña', email: 'ana@lainmobiliaria.com' },
  attendees: [{ name: 'Codigo Inmobiliario', email: 'CodigoInmobiliarioIA@gmail.com', timeZone: 'America/Argentina/Buenos_Aires' }],
};

test('⚠️ el lead es QUIEN RESERVÓ, no el dueño del calendario', () => {
  // En Calendly no hay forma de equivocarse: el invitado ES el payload. Acá las dos
  // personas viven en el mismo objeto, y confundirlas crea un lead con los datos del
  // propio negocio — un cliente «agendándose a sí mismo» en cada reserva.
  const r = normalizarReserva(RESERVA)!;
  assert.equal(r.email, 'codigoinmobiliarioia@gmail.com', 'el mail va en minúsculas: es la clave de dedupe');
  assert.equal(r.nombre, 'Codigo Inmobiliario');
  assert.notEqual(r.email, 'ana@lainmobiliaria.com');
});

test('sin identificador de reserva no se normaliza: sin él no hay idempotencia', () => {
  assert.equal(normalizarReserva({ ...RESERVA, uid: undefined, bookingId: undefined }), null);
  // Pero el id numérico alcanza: no todas las versiones mandan uid.
  assert.equal(normalizarReserva({ ...RESERVA, uid: undefined, bookingId: 991 })!.uid, '991');
  assert.equal(normalizarReserva(undefined), null);
});

test('el teléfono se busca en los tres lugares donde puede venir', () => {
  assert.equal(normalizarReserva(RESERVA)!.telefono, null, 'si no está, es null — no se inventa');
  assert.equal(
    normalizarReserva({ ...RESERVA, attendees: [{ ...RESERVA.attendees[0], phoneNumber: '+5491122334455' }] })!.telefono,
    '+5491122334455',
  );
  assert.equal(
    normalizarReserva({ ...RESERVA, responses: { 'tu-telefono': '+5491100000000' } })!.telefono,
    '+5491100000000',
  );
  // La forma anidada `{ value }` que usan algunas versiones del embed.
  assert.equal(
    normalizarReserva({ ...RESERVA, userFieldsResponses: { whatsapp: { value: '+5491199999999' } } })!.telefono,
    '+5491199999999',
  );
});

// ── R1 / R2 ─────────────────────────────────────────────────────────────────

test('clasifica por id, por slug o por nombre: el dueño pega el que tiene a mano', () => {
  const et = normalizarReserva(RESERVA)!.eventType;
  assert.equal(clasificarJuntaCalcom(et, { j1: '4242' }), 'j1');
  assert.equal(clasificarJuntaCalcom(et, { j1: 'llamada-de-auditoria' }), 'j1');
  // Y por la URL entera de reservas, que es lo que se copia del navegador.
  assert.equal(clasificarJuntaCalcom(et, { j1: 'https://cal.com/ana/llamada-de-auditoria' }), 'j1');
  assert.equal(clasificarJuntaCalcom(et, { j2: 'llamada-de-auditoria' }), 'j2');
});

test('sin coincidencia es «desconocido», que río abajo se trata como R1', () => {
  const et = normalizarReserva(RESERVA)!.eventType;
  assert.equal(clasificarJuntaCalcom(et, { j1: 'otra-cosa', j2: 'otra-mas' }), 'desconocido');
  assert.equal(clasificarJuntaCalcom(undefined, { j1: 'x' }), 'desconocido');
  // ⚠️ Y sin config NO puede dar j1: si «sin configurar» clasificara como R1, un
  // workspace recién creado empezaría a marcar primeras reuniones que nadie definió.
  assert.equal(clasificarJuntaCalcom(et, {}), 'desconocido');
});

test('R2 gana sobre R1 si las dos matchean, igual que en Calendly', () => {
  // Es el desempate que ya existe allá. Tienen que decidir IGUAL: si divergen, la
  // misma reunión se clasifica R1 por un lado y R2 por el otro, y el CRM mueve la
  // etapa a un lugar mientras el recordatorio habla del otro.
  const et = normalizarReserva(RESERVA)!.eventType;
  assert.equal(clasificarJuntaCalcom(et, { j1: 'llamada-de-auditoria', j2: 'llamada-de-auditoria' }), 'j2');
});

// ── Los triggers ────────────────────────────────────────────────────────────

test('cada trigger se traduce a lo que el CRM tiene que hacer', () => {
  assert.equal(accionDeTrigger('BOOKING_CREATED'), 'agenda');
  assert.equal(accionDeTrigger('BOOKING_RESCHEDULED'), 'agenda', 'reprogramar es volver a agendar: la fecha nueva pisa a la vieja');
  assert.equal(accionDeTrigger('BOOKING_CANCELLED'), 'cancela');
  assert.equal(accionDeTrigger('BOOKING_REJECTED'), 'cancela', 'rechazada por el dueño es una reunión que no va a pasar');
  assert.equal(accionDeTrigger('MEETING_ENDED'), 'termina');
  // Lo que no conocemos NO se adivina: se acusa recibo y se ignora.
  assert.equal(accionDeTrigger('FORM_SUBMITTED'), null);
  assert.equal(accionDeTrigger(undefined), null);
});

test('la API apunta a v2 y manda el header de versión', () => {
  // ⚠️ La v1 se apagó el 8/4/2026: una integración nueva que naciera ahí nace muerta.
  // Y sin el header de versión la respuesta puede cambiar de forma sin aviso, que es
  // el modo de falla más caro: no rompe, devuelve otra cosa.
  assert.ok(CALCOM_API.base.endsWith('/v2'), 'la v1 está apagada');
  const h = calcomHeaders('cal_live_xxx');
  assert.equal(h.Authorization, 'Bearer cal_live_xxx');
  assert.ok(h['cal-api-version'], 'sin el header de versión, la forma de la respuesta no está fijada');
});
