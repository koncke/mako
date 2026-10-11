// =============================================================================
// La firma de los avisos de Stripe y de Mercado Pago (lib/pasarela-firma.ts)
// =============================================================================
// Un aviso con la firma mal verificada es, para un lado, un pago falso que entra al CRM y, para el
// otro, un pago REAL que se rechaza en silencio y se lee igual que «el secreto está mal pegado».
// Las trampas que se fijan acá (fuentes en relev/apis.md y en el encabezado del módulo):
//   · Stripe usa el `whsec_…` ENTERO como clave HMAC (UTF-8). Svix (lib/standard-webhooks.ts) le
//     saca el prefijo y lo decodifica de base64: por ese camino se rechaza el 100%. Por eso el
//     módulo no lo importa, y por eso hay un VECTOR FIJO escrito en hex (calculado una vez con
//     node:crypto, aparte del módulo): si alguien cambia el algoritmo, el test no se autovalida
//     firmando con la misma función que verifica.
//   · Puede haber VARIOS `v1` (rotación del secreto, hasta 24 h) y vale cualquiera; `v0` es una
//     firma falsa de los eventos de prueba y se ignora. Tolerancia de reloj: 300 s.
//   · Mercado Pago firma `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` y el par que falta se
//     SACA entero; la doc pide `data.id` en minúsculas y el SDK no lo hace: valen las dos.
//
// Probado ROMPIÉNDOLO (11/10/2026), una rotura por vez sobre la base en verde y restaurando de
// memoria (un script que guarda el texto y lo repone, nunca git). Con el código como está:
// 12 pases, 0 fallos. Rota (pases / fallos):
//   · Stripe con el secreto sin el prefijo `whsec_` (lo que hace Svix)                     → 7 / 5
//   · Stripe mirando sólo el PRIMER v1                                                     → 11 / 1
//   · Stripe mirando sólo el ÚLTIMO v1 (el `Object.fromEntries` de lib/calendly.ts)        → 11 / 1
//   · Stripe aceptando también `v0`                                                        → 11 / 1
//   · Stripe sin la tolerancia de reloj                                                    → 11 / 1
//   · igualHex sin comparar el largo en bytes (timingSafeEqual tira RangeError)            → 10 / 2
//   · un `import … from './standard-webhooks'` en el módulo                                → 11 / 1
//   · MP sin la variante en minúsculas del data.id                                         → 11 / 1
//   · MP con `request-id:;` cuando falta el header (en vez de sacar el par)                → 11 / 1
// Correr: node --import tsx --test tests/pasarela-firma.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  firmarMercadoPago, firmarStripe, manifiestoMercadoPago, verificarFirmaMercadoPago, verificarFirmaStripe,
} from '../lib/pasarela-firma';

const RAIZ = join(__dirname, '..');

// ── Stripe ────────────────────────────────────────────────────────────────────

/** El vector FIJO. El hex se calculó UNA vez con `crypto.createHmac('sha256', SECRETO).update(`${T}.${RAW}`)`
 *  el 11/10/2026, fuera del módulo, y se pega literal: no se recalcula acá. */
const RAW = '{"id":"evt_1MaKo","object":"event","type":"checkout.session.completed"}';
const SECRETO = 'whsec_MaKoPruebaFija0123456789abcdef';
const T = 1760180400;
const HEX = '0e062f0507353402749029f2469a5e9c2215c8035bf56a253178307606b11f8a';

test('Stripe: el vector fijo (whsec_ entero como clave, `${t}.${raw}`, hex) pasa, y firmarStripe lo reproduce', () => {
  assert.equal(verificarFirmaStripe(RAW, `t=${T},v1=${HEX}`, SECRETO, T), null);
  assert.equal(firmarStripe(RAW, SECRETO, T), `t=${T},v1=${HEX}`);
});

test('Stripe: el secreto se usa TAL CUAL; la lectura de Svix (sin prefijo, base64) no coincide', () => {
  const t = 1760180400;
  // Calculada aparte, como lo hace Stripe: HMAC con el string entero.
  const buena = crypto.createHmac('sha256', SECRETO).update(`${t}.${RAW}`, 'utf8').digest('hex');
  assert.equal(verificarFirmaStripe(RAW, `t=${t},v1=${buena}`, SECRETO, t), null);
  // Como lo haría `claveDelSecreto` de Svix: el resto del secreto decodificado de base64.
  const svix = crypto.createHmac('sha256', Buffer.from(SECRETO.slice('whsec_'.length), 'base64')).update(`${t}.${RAW}`, 'utf8').digest('hex');
  assert.equal(verificarFirmaStripe(RAW, `t=${t},v1=${svix}`, SECRETO, t), 'no-coincide');
});

test('Stripe: firma mala, cuerpo tocado y otro secreto → no-coincide', () => {
  const malo = HEX.replace(/^0/, '1');
  assert.equal(verificarFirmaStripe(RAW, `t=${T},v1=${malo}`, SECRETO, T), 'no-coincide');
  assert.equal(verificarFirmaStripe(`${RAW} `, `t=${T},v1=${HEX}`, SECRETO, T), 'no-coincide', 'el cuerpo es CRUDO: un espacio cambia la firma');
  assert.equal(verificarFirmaStripe(RAW, `t=${T},v1=${HEX}`, 'whsec_otroSecreto', T), 'no-coincide');
  // El mismo hex con OTRO t: el t es parte de lo firmado (si no, se podría reusar una firma vieja).
  assert.equal(verificarFirmaStripe(RAW, `t=${T + 1},v1=${HEX}`, SECRETO, T), 'no-coincide');
});

test('Stripe: el reloj tolera 300 s para los dos lados, y sin `ahora` usa el de la máquina', () => {
  assert.equal(verificarFirmaStripe(RAW, `t=${T},v1=${HEX}`, SECRETO, T + 300), null);
  assert.equal(verificarFirmaStripe(RAW, `t=${T},v1=${HEX}`, SECRETO, T + 301), 'timestamp-viejo');
  assert.equal(verificarFirmaStripe(RAW, `t=${T},v1=${HEX}`, SECRETO, T - 301), 'timestamp-viejo', 'una firma del futuro tampoco');
  const ahora = Math.floor(Date.now() / 1000);
  assert.equal(verificarFirmaStripe(RAW, firmarStripe(RAW, SECRETO, ahora), SECRETO), null);
});

test('Stripe: VARIOS v1 (rotación del secreto) — vale cualquiera, aunque la buena vaya en el medio', () => {
  const malo = 'a'.repeat(64);
  assert.equal(verificarFirmaStripe(RAW, `t=${T},v1=${malo},v1=${HEX}`, SECRETO, T), null, 'la buena en segundo lugar');
  assert.equal(verificarFirmaStripe(RAW, `t=${T},v1=${malo},v1=${HEX},v1=${'b'.repeat(64)}`, SECRETO, T), null, 'la buena en el medio (un parser que se queda con la última la pierde)');
  assert.equal(verificarFirmaStripe(RAW, `t=${T},v1=${malo},v1=${'b'.repeat(64)}`, SECRETO, T), 'no-coincide');
});

test('Stripe: `v0` se IGNORA (es la firma falsa de los eventos de prueba)', () => {
  assert.equal(verificarFirmaStripe(RAW, `t=${T},v0=${HEX}`, SECRETO, T), 'faltan-headers', 'v0 solo no es una firma');
  assert.equal(verificarFirmaStripe(RAW, `t=${T},v1=${'a'.repeat(64)},v0=${HEX}`, SECRETO, T), 'no-coincide');
  assert.equal(verificarFirmaStripe(RAW, `t=${T},v1=${HEX},v0=${'a'.repeat(64)}`, SECRETO, T), null);
});

test('Stripe: header roto o ausente, sin secreto, y una firma con otro largo NO tira', () => {
  assert.equal(verificarFirmaStripe(RAW, `t=${T},v1=${HEX}`, null, T), 'sin-secreto');
  assert.equal(verificarFirmaStripe(RAW, `t=${T},v1=${HEX}`, '', T), 'sin-secreto');
  assert.equal(verificarFirmaStripe(RAW, null, SECRETO, T), 'faltan-headers');
  assert.equal(verificarFirmaStripe(RAW, '', SECRETO, T), 'faltan-headers');
  assert.equal(verificarFirmaStripe(RAW, 'basura', SECRETO, T), 'faltan-headers');
  assert.equal(verificarFirmaStripe(RAW, `v1=${HEX}`, SECRETO, T), 'faltan-headers', 'sin t');
  assert.equal(verificarFirmaStripe(RAW, `t=${T}`, SECRETO, T), 'faltan-headers', 'sin v1');
  assert.equal(verificarFirmaStripe(RAW, `t=ayer,v1=${HEX}`, SECRETO, T), 'timestamp-invalido');
  // Una firma falsificada de otro largo (o con un carácter de 2 bytes y 64 caracteres) es un 401,
  // no un RangeError de timingSafeEqual que sale como 500 sin autenticar.
  assert.equal(verificarFirmaStripe(RAW, `t=${T},v1=abc`, SECRETO, T), 'no-coincide');
  assert.equal(verificarFirmaStripe(RAW, `t=${T},v1=ñ${'a'.repeat(63)}`, SECRETO, T), 'no-coincide');
});

test('el módulo NO pasa por Svix (lib/standard-webhooks.ts)', () => {
  const src = readFileSync(join(RAIZ, 'lib/pasarela-firma.ts'), 'utf8')
    .replace(/^[ \t]*\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(src, /standard-webhooks|claveDelSecreto|verificarFirmaSvix/);
});

// ── Mercado Pago ──────────────────────────────────────────────────────────────

/** Vector FIJO de MP, calculado UNA vez con node:crypto sobre el manifiesto escrito a mano (el
 *  ejemplo de la doc: data.id 123456789, el x-request-id y el ts 1704908010). */
const MP_SECRETO = 'claveSecretaDelPanelMP';
const MP_REQ = 'bb56a2f1-6aae-46ac-982e-9dcd3581d08e';
const MP_TS = '1704908010';
const MP_HEX = '123cc41b90ababd06412a366e153b6a195c29e0e6fa000f5c6db6e6931eabe84';

test('MP: el manifiesto EXACTO, y el par que falta se saca entero', () => {
  assert.equal(manifiestoMercadoPago({ dataId: '123456789', requestId: MP_REQ, ts: MP_TS }), `id:123456789;request-id:${MP_REQ};ts:${MP_TS};`);
  assert.equal(manifiestoMercadoPago({ dataId: null, requestId: MP_REQ, ts: MP_TS }), `request-id:${MP_REQ};ts:${MP_TS};`);
  assert.equal(manifiestoMercadoPago({ dataId: '123456789', requestId: null, ts: MP_TS }), `id:123456789;ts:${MP_TS};`);
  assert.equal(manifiestoMercadoPago({ dataId: null, requestId: null, ts: MP_TS }), `ts:${MP_TS};`);
});

test('MP: el vector fijo pasa; firma, secreto, request-id o data.id distintos, no', () => {
  const header = `ts=${MP_TS},v1=${MP_HEX}`;
  assert.equal(firmarMercadoPago({ dataId: '123456789', requestId: MP_REQ, ts: MP_TS }, MP_SECRETO), header);
  assert.equal(verificarFirmaMercadoPago({ dataId: '123456789', requestId: MP_REQ, header }, MP_SECRETO), null);
  assert.equal(verificarFirmaMercadoPago({ dataId: '123456789', requestId: MP_REQ, header: `ts=${MP_TS},v1=${'0'.repeat(64)}` }, MP_SECRETO), 'no-coincide');
  assert.equal(verificarFirmaMercadoPago({ dataId: '123456789', requestId: MP_REQ, header }, 'otraClave'), 'no-coincide');
  assert.equal(verificarFirmaMercadoPago({ dataId: '123456789', requestId: 'otro-request', header }, MP_SECRETO), 'no-coincide');
  assert.equal(verificarFirmaMercadoPago({ dataId: '123456780', requestId: MP_REQ, header }, MP_SECRETO), 'no-coincide');
  // Sin request-id: lo firmado SIN el par pasa; lo firmado CON el par no.
  const sinReq = firmarMercadoPago({ dataId: '123456789', requestId: null, ts: MP_TS }, MP_SECRETO);
  assert.equal(verificarFirmaMercadoPago({ dataId: '123456789', requestId: null, header: sinReq }, MP_SECRETO), null);
  assert.equal(verificarFirmaMercadoPago({ dataId: '123456789', requestId: null, header }, MP_SECRETO), 'no-coincide');
  // Sin tolerancia de reloj, a propósito: MP reentrega cada 15 minutos con la MISMA firma (el ts es de 2024).
});

test('MP: un data.id alfanumérico en MAYÚSCULAS pasa firmado en minúsculas (la doc) o tal cual (el SDK)', () => {
  const ts = '1760180400';
  const enMinusculas = `ts=${ts},v1=${crypto.createHmac('sha256', MP_SECRETO).update(`id:2c9380848f;request-id:${MP_REQ};ts:${ts};`).digest('hex')}`;
  const talCual = `ts=${ts},v1=${crypto.createHmac('sha256', MP_SECRETO).update(`id:2C9380848F;request-id:${MP_REQ};ts:${ts};`).digest('hex')}`;
  assert.equal(verificarFirmaMercadoPago({ dataId: '2C9380848F', requestId: MP_REQ, header: enMinusculas }, MP_SECRETO), null);
  assert.equal(verificarFirmaMercadoPago({ dataId: '2C9380848F', requestId: MP_REQ, header: talCual }, MP_SECRETO), null);
  // Y otro id no pasa con ninguna de las dos lecturas.
  assert.equal(verificarFirmaMercadoPago({ dataId: '2C9380848E', requestId: MP_REQ, header: enMinusculas }, MP_SECRETO), 'no-coincide');
});

test('MP: header sin ts o sin v1, ts que no es número, sin header y sin secreto', () => {
  assert.equal(verificarFirmaMercadoPago({ dataId: '1', requestId: MP_REQ, header: `v1=${MP_HEX}` }, MP_SECRETO), 'faltan-headers');
  assert.equal(verificarFirmaMercadoPago({ dataId: '1', requestId: MP_REQ, header: `ts=${MP_TS}` }, MP_SECRETO), 'faltan-headers');
  assert.equal(verificarFirmaMercadoPago({ dataId: '1', requestId: MP_REQ, header: null }, MP_SECRETO), 'faltan-headers');
  assert.equal(verificarFirmaMercadoPago({ dataId: '1', requestId: MP_REQ, header: `ts=hoy,v1=${MP_HEX}` }, MP_SECRETO), 'timestamp-invalido');
  assert.equal(verificarFirmaMercadoPago({ dataId: '1', requestId: MP_REQ, header: `ts=${MP_TS},v1=${MP_HEX}` }, null), 'sin-secreto');
  assert.equal(verificarFirmaMercadoPago({ dataId: '1', requestId: MP_REQ, header: `ts=${MP_TS},v1=corta` }, MP_SECRETO), 'no-coincide');
});
