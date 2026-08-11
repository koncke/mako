// =============================================================================
// La firma que sostiene tres webhooks
// =============================================================================
// Fathom, Resend y Whop firman igual (Standard Webhooks / Svix). El algoritmo
// estaba escrito DOS veces con dos redacciones; ahora está una sola y estos
// tests son lo que impide que se rompa para los tres a la vez.
//
// La firma es lo ÚNICO que protege estas rutas: `/api/webhooks` está en
// PUBLICOS, así que el middleware hace early-return antes del login y antes del
// chequeo CSRF de Origin. Un `return true` de más acá es una ruta abierta.
//
// Los tres detalles que fallan siempre si se hacen mal, y que ninguno da un
// síntoma que apunte al lugar correcto (todos dicen «firma no coincide»): cómo
// se convierte el secreto en clave —que DEPENDE DEL PREFIJO, ver el final del
// archivo—, que la salida es BASE64 y no hex, y que el body tiene que ser el
// texto CRUDO.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { verificarFirmaSvix, headersSvix, MOTIVO_FIRMA, claveDelSecreto } from '../lib/standard-webhooks';

const SECRETO_B64 = Buffer.from('un-secreto-de-prueba-de-32-bytes').toString('base64');
const SECRETO = `whsec_${SECRETO_B64}`;
const ID = 'msg_2abcdef';
const BODY = '{"event":"course_lesson_interaction.completed","data":{"id":"less_1"}}';

const ahora = () => Math.floor(Date.now() / 1000);

function firmar(body: string, id = ID, ts = ahora(), secretoB64 = SECRETO_B64): string {
  const clave = Buffer.from(secretoB64, 'base64');
  return crypto.createHmac('sha256', clave).update(`${id}.${ts}.${body}`).digest('base64');
}

const cab = (sig: string, id = ID, ts = ahora()) => ({ id, timestamp: String(ts), signature: `v1,${sig}` });

test('el caso feliz', () => {
  const ts = ahora();
  assert.equal(verificarFirmaSvix(BODY, cab(firmar(BODY, ID, ts), ID, ts), SECRETO), null);
});

test('anda igual sin el prefijo whsec_', () => {
  const ts = ahora();
  assert.equal(verificarFirmaSvix(BODY, cab(firmar(BODY, ID, ts), ID, ts), SECRETO_B64), null);
});

test('el secreto va DECODIFICADO: usarlo crudo como clave no pasa', () => {
  // Es el error clásico. Firma con el string tal cual (sin base64-decode) y el
  // verificador tiene que rechazarlo.
  const ts = ahora();
  const malo = crypto.createHmac('sha256', SECRETO).update(`${ID}.${ts}.${BODY}`).digest('base64');
  assert.equal(verificarFirmaSvix(BODY, cab(malo, ID, ts), SECRETO), 'no-coincide');
});

test('la salida va en BASE64: una firma en hex no pasa', () => {
  const ts = ahora();
  const hex = crypto.createHmac('sha256', Buffer.from(SECRETO_B64, 'base64')).update(`${ID}.${ts}.${BODY}`).digest('hex');
  assert.equal(verificarFirmaSvix(BODY, cab(hex, ID, ts), SECRETO), 'no-coincide');
});

test('el body tiene que ser el CRUDO: reserializar el JSON rompe la firma', () => {
  // Lo que pasa si la ruta hace request.json() y después JSON.stringify: cambia
  // el espaciado y el HMAC deja de dar. Falla siempre, no a veces.
  const ts = ahora();
  const sig = firmar(BODY, ID, ts);
  const reserializado = JSON.stringify(JSON.parse(BODY), null, 2);
  assert.notEqual(reserializado, BODY);
  assert.equal(verificarFirmaSvix(reserializado, cab(sig, ID, ts), SECRETO), 'no-coincide');
});

test('acepta CUALQUIERA de las firmas del header: es lo que sostiene una rotación', () => {
  // Durante una rotación el proveedor manda la vieja y la nueva juntas,
  // separadas por espacio. Comparar el header entero rechazaría todo el tráfico
  // mientras dura.
  const ts = ahora();
  const buena = firmar(BODY, ID, ts);
  assert.equal(verificarFirmaSvix(BODY, { id: ID, timestamp: String(ts), signature: `v1,firmaVieja v1,${buena}` }, SECRETO), null);
  assert.equal(verificarFirmaSvix(BODY, { id: ID, timestamp: String(ts), signature: `v1,${buena} v1,otraCosa` }, SECRETO), null);
});

test('acepta la firma sin el prefijo de versión', () => {
  const ts = ahora();
  assert.equal(verificarFirmaSvix(BODY, { id: ID, timestamp: String(ts), signature: firmar(BODY, ID, ts) }, SECRETO), null);
});

test('el id firmado es parte del contenido: cambiarlo invalida', () => {
  const ts = ahora();
  const sig = firmar(BODY, ID, ts);
  assert.equal(verificarFirmaSvix(BODY, cab(sig, 'msg_otro', ts), SECRETO), 'no-coincide');
});

test('anti-replay: un timestamp viejo se rechaza, y se distingue del secreto malo', () => {
  const viejo = ahora() - 3600;
  assert.equal(verificarFirmaSvix(BODY, cab(firmar(BODY, ID, viejo), ID, viejo), SECRETO), 'timestamp-viejo');
  // El motivo importa: «timestamp-viejo» manda a mirar el reloj, no el secreto.
  assert.notEqual(MOTIVO_FIRMA['timestamp-viejo'], MOTIVO_FIRMA['no-coincide']);
});

test('un timestamp del FUTURO lejano también se rechaza', () => {
  const futuro = ahora() + 3600;
  assert.equal(verificarFirmaSvix(BODY, cab(firmar(BODY, ID, futuro), ID, futuro), SECRETO), 'timestamp-viejo');
});

test('fail-closed: sin secreto, sin headers o con basura, nunca pasa', () => {
  const ts = ahora();
  const sig = firmar(BODY, ID, ts);
  assert.equal(verificarFirmaSvix(BODY, cab(sig, ID, ts), null), 'sin-secreto');
  assert.equal(verificarFirmaSvix(BODY, cab(sig, ID, ts), ''), 'sin-secreto');
  assert.equal(verificarFirmaSvix(BODY, { id: null, timestamp: String(ts), signature: `v1,${sig}` }, SECRETO), 'faltan-headers');
  assert.equal(verificarFirmaSvix(BODY, { id: ID, timestamp: null, signature: `v1,${sig}` }, SECRETO), 'faltan-headers');
  assert.equal(verificarFirmaSvix(BODY, { id: ID, timestamp: String(ts), signature: null }, SECRETO), 'faltan-headers');
  assert.equal(verificarFirmaSvix(BODY, cab(sig, ID, ts), SECRETO) !== null ? 'x' : 'ok', 'ok');
  assert.equal(verificarFirmaSvix(BODY, { id: ID, timestamp: 'ayer', signature: `v1,${sig}` }, SECRETO), 'timestamp-invalido');
  assert.equal(verificarFirmaSvix(BODY, { id: ID, timestamp: String(ts), signature: '' }, SECRETO), 'faltan-headers');
});

test('una firma de largo distinto no rompe timingSafeEqual', () => {
  const ts = ahora();
  assert.equal(verificarFirmaSvix(BODY, cab('corta', ID, ts), SECRETO), 'no-coincide');
  assert.equal(verificarFirmaSvix(BODY, cab('x'.repeat(500), ID, ts), SECRETO), 'no-coincide');
});

test('headersSvix lee los tres nombres del estándar', () => {
  const req = new Request('https://x.test/api/webhooks/whop', {
    method: 'POST',
    headers: { 'webhook-id': ID, 'webhook-timestamp': '123', 'webhook-signature': 'v1,abc' },
  });
  assert.deepEqual(headersSvix(req), { id: ID, timestamp: '123', signature: 'v1,abc' });
});

test('headersSvix devuelve nulls cuando no vienen, sin romper', () => {
  const req = new Request('https://x.test/api/webhooks/whop', { method: 'POST' });
  assert.deepEqual(headersSvix(req), { id: null, timestamp: null, signature: null });
});

// ── El prefijo del secreto decide cómo se hace la clave ──────────────────────
// Whop entrega `ws_` + 64 hex, que NO es base64. Sus SDK piden que se lo pase
// base64-ENCODEADO al verificador estándar, que después lo decodifica: la clave
// termina siendo el string entero en UTF-8. Elegir mal no da error, da «firma no
// coincide» — y manda a revisar el secreto, o sea lo único que estaba bien.

const WHOP_SECRET = 'ws_0200e3fbe32464d1702eadce97e50886a282e8dc93b527f06ecb21fd33680d95';

/** Firma EXACTAMENTE como firma Whop, según su propia doc: el verificador
 *  estándar recibe base64(secreto) y lo decodifica, así que la clave son los
 *  bytes literales del secreto. */
function firmarComoWhop(body: string, id: string, ts: number, secreto = WHOP_SECRET): string {
  const claveDelSdk = Buffer.from(Buffer.from(secreto, 'utf8').toString('base64'), 'base64');
  return crypto.createHmac('sha256', claveDelSdk).update(`${id}.${ts}.${body}`).digest('base64');
}

test('un secreto ws_ de Whop verifica: la clave es el string entero, no su base64-decode', () => {
  const ts = ahora();
  const sig = firmarComoWhop(BODY, ID, ts);
  assert.equal(verificarFirmaSvix(BODY, cab(sig, ID, ts), WHOP_SECRET), null);
});

test('tratar el secreto de Whop como base64 (lo que hacía antes) NO verifica', () => {
  // La regresión concreta: `Buffer.from('ws_0200…','base64')` no lanza —descarta
  // los caracteres inválidos y devuelve bytes— así que fallaba en silencio.
  const ts = ahora();
  const claveVieja = Buffer.from(WHOP_SECRET, 'base64');
  const sigVieja = crypto.createHmac('sha256', claveVieja).update(`${ID}.${ts}.${BODY}`).digest('base64');
  assert.notEqual(sigVieja, firmarComoWhop(BODY, ID, ts), 'las dos claves tienen que dar firmas distintas');
  assert.equal(verificarFirmaSvix(BODY, cab(sigVieja, ID, ts), WHOP_SECRET), 'no-coincide');
});

test('claveDelSecreto: cada prefijo, su regla', () => {
  // whsec_ → base64-decode de lo que sigue (Fathom, Resend, el mundo Svix).
  assert.deepEqual(claveDelSecreto(`whsec_${Buffer.from('hola').toString('base64')}`), Buffer.from('hola'));
  // ws_ → los bytes literales, prefijo incluido (Whop).
  assert.deepEqual(claveDelSecreto('ws_abc'), Buffer.from('ws_abc', 'utf8'));
  // sin prefijo → base64, el default del estándar.
  assert.deepEqual(claveDelSecreto(Buffer.from('hola').toString('base64')), Buffer.from('hola'));
});

test('un secreto que decodifica a cero bytes no verifica nada', () => {
  // `Buffer.from('!!!!','base64')` devuelve vacío sin lanzar. Con clave vacía el
  // HMAC igual se calcula, así que sin este corte cualquiera podría firmar.
  const ts = ahora();
  assert.equal(verificarFirmaSvix(BODY, cab('x', ID, ts), '!!!!'), 'sin-secreto');
});
