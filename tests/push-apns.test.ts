// =============================================================================
// Los avisos de la app de iPhone por APNs (docs/tiendas-play-appstore.md, paso 9, 3/11/2026)
// =============================================================================
// Web Push no existe adentro de una app con WebView en iOS. Lo que corre de verdad (HTTP/2 contra un servidor local que contesta como Apple, y
// el camino entero de `enviarPushAUsuario`) está en tests/_push-apns-hijo.ts. Falta mirarlo llegar a un iPhone: pide la cuenta de Apple.
//
// Correr: node --import tsx --test tests/push-apns.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (3/11/2026): al pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createVerify, generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BUNDLE_ID, MARCA_SIN_CLAVE_APNS, accionTrasErrorApns, armarApns, clavesApnsDe, endpointDeApns, esEndpointApns, jwtApns, tokenApnsValido, tokenDeEndpoint,
} from '../lib/push-apns-reglas';
import { endpointPermitido } from '../lib/push-payload';

const RAIZ = join(__dirname, '..');
const leer = (f: string) => readFileSync(join(RAIZ, f), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_push-apns-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;

const payload = { titulo: 'MaKo', cuerpo: 'Te pide confirmar', url: 'https://hola-mako.com/mako/pendientes', tag: 'mako-pendiente' };
const AHORA = Date.UTC(2026, 10, 3);

test('1. el armado: el TTL es una FECHA, la urgencia es la prioridad, y el link viaja', () => {
  const a = armarApns(payload, { ttlSegundos: 7200, urgencia: 'high', ahoraMs: AHORA });
  assert.equal(a.cabeceras['apns-topic'], BUNDLE_ID);
  assert.equal(a.cabeceras['apns-push-type'], 'alert');
  assert.equal(a.cabeceras['apns-priority'], '10', 'high despierta el teléfono');
  assert.equal(a.cabeceras['apns-expiration'], String(AHORA / 1000 + 7200), 'una fecha, no segundos');
  assert.equal(armarApns(payload, { ttlSegundos: 60, urgencia: 'normal', ahoraMs: AHORA }).cabeceras['apns-priority'], '5');
  assert.equal(armarApns(payload, { ttlSegundos: 0, urgencia: 'normal', ahoraMs: AHORA }).cabeceras['apns-expiration'], '0', '0 es «ahora o nunca»');
  const cuerpo = JSON.parse(a.cuerpo) as { aps: { alert: { title: string; body: string }; badge?: number }; url: string };
  assert.deepEqual(cuerpo.aps.alert, { title: 'MaKo', body: 'Te pide confirmar' });
  assert.equal(cuerpo.url, payload.url, 'al tocar, lib/nativo.ts abre esto');
  assert.equal(cuerpo.aps.badge, undefined);
  assert.equal((JSON.parse(armarApns({ ...payload, badge: 3 }, { ttlSegundos: 1, urgencia: 'high' }).cuerpo) as { aps: { badge: number } }).aps.badge, 3);
});

test('2. `apns-collapse-id`: hasta 64 bytes y sólo ASCII (una raya o un emoji en una cabecera mata el pedido)', () => {
  for (const tag of ['ñ'.repeat(80), 'aviso — con raya', 'reunión 🗓️ hoy', 'x'.repeat(200)]) {
    const c = armarApns({ ...payload, tag }, { ttlSegundos: 1, urgencia: 'high' }).cabeceras['apns-collapse-id'];
    assert.ok(Buffer.byteLength(c) <= 64, tag);
    assert.match(c, /^[A-Za-z0-9:_.-]*$/, tag);
  }
});

test('3. el JWT: ES256 en el formato que pide Apple, y con su issuer y su kid', () => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const p8 = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const c = clavesApnsDe({ keyId: 'ABC123DEFG', teamId: 'XYZ987WVUT', p8 })!;
  const [h, b, firma] = jwtApns(c, AHORA).split('.');
  assert.deepEqual(JSON.parse(Buffer.from(h, 'base64url').toString()), { alg: 'ES256', kid: 'ABC123DEFG' });
  assert.deepEqual(JSON.parse(Buffer.from(b, 'base64url').toString()), { iss: 'XYZ987WVUT', iat: AHORA / 1000 });
  const ok = createVerify('SHA256').update(`${h}.${b}`).verify({ key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(firma, 'base64url'));
  assert.equal(ok, true, 'no verifica');
  assert.equal(Buffer.from(firma, 'base64url').length, 64, 'ES256 en JWT son 64 bytes crudos, no DER');
});

test('4. las claves: se pegan a mano, y un pegado sin saltos de línea igual sirve', () => {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const p8 = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const bien = { keyId: ' ABC123DEFG ', teamId: 'XYZ987WVUT' };
  const sinSaltos = clavesApnsDe({ ...bien, p8: p8.replace(/\r?\n/g, ' ') })!;
  assert.equal(sinSaltos.keyId, 'ABC123DEFG');
  assert.doesNotThrow(() => jwtApns(sinSaltos), 'la clave pegada en un renglón tiene que firmar');
  assert.equal(clavesApnsDe({}), null);
  assert.equal(clavesApnsDe({ ...bien, p8: '' }), null);
  assert.equal(clavesApnsDe({ ...bien, keyId: 'corta', p8 }), null);
});

test('5. sólo se borra lo que murió: una clave mal cargada no deja sin avisos a todos', () => {
  assert.equal(accionTrasErrorApns(410, 'Unregistered'), 'borrar');
  assert.equal(accionTrasErrorApns(400, 'BadDeviceToken'), 'borrar');
  assert.equal(accionTrasErrorApns(400, 'DeviceTokenNotForTopic'), 'borrar');
  for (const [s, r] of [[403, 'InvalidProviderToken'], [403, 'ExpiredProviderToken'], [429, 'TooManyRequests'], [500, 'InternalServerError'], [null, 'sin respuesta'], [400, 'BadTopic']] as const) {
    assert.equal(accionTrasErrorApns(s, r), 'fallo', `${s} ${r}`);
  }
});

test('6. el endpoint de un iPhone no se confunde con uno de Web Push', () => {
  const t = 'AB'.repeat(32);
  assert.equal(tokenApnsValido(t), true);
  for (const m of ['', 'xyz', 'ab'.repeat(10), 'g'.repeat(64), 'ab'.repeat(101), null, 5, '../../x']) assert.equal(tokenApnsValido(m), false, String(m));
  const e = endpointDeApns(t);
  assert.equal(esEndpointApns(e), true);
  assert.equal(tokenDeEndpoint(e), t.toLowerCase());
  assert.equal(esEndpointApns('https://fcm.googleapis.com/fcm/send/x'), false);
  assert.equal(endpointPermitido(e), false, 'un `apns:` nunca puede entrar como Web Push');
  assert.ok(MARCA_SIN_CLAVE_APNS.length >= 10, 'las columnas p256dh (10) y auth (8) tienen un largo mínimo');
});

test('7. HTTP/2 de verdad: la ruta, las cabeceras, la firma y cómo se lee lo que contesta', () => {
  assert.deepEqual(R.respuestas, [{ status: 200, razon: null }, { status: 410, razon: 'Unregistered' }, { status: 403, razon: 'InvalidProviderToken' }]);
  const r0 = R.recibidos[0];
  assert.equal(r0.path, `/3/device/${'a'.repeat(64)}`);
  assert.equal(r0.cabeceras[':method'], 'POST');
  assert.equal(r0.cabeceras['apns-topic'], BUNDLE_ID);
  assert.equal(r0.cabeceras['apns-priority'], '10');
  const [h, b, firma] = String(r0.cabeceras.authorization).replace(/^bearer /, '').split('.');
  assert.ok(createVerify('SHA256').update(`${h}.${b}`).verify({ key: R.publica, dsaEncoding: 'ieee-p1363' }, Buffer.from(firma, 'base64url')), 'la firma no verifica contra la .p8');
  assert.equal((JSON.parse(r0.cuerpo) as { url: string }).url, 'https://hola-mako.com/mako/pendientes');
});

test('8. sin las claves de Apple: no sale nada, no se borra nada y no rompe el envío', () => {
  assert.equal(R.clavesSinCargar, null);
  assert.equal(R.sinClaves.enviados, 0);
  assert.equal(R.sinClaves.fallidos, 1);
  assert.equal(R.filaSinClaves.id, 1, 'la fila sigue');
  assert.match(R.filaSinClaves.ultimo_error, /sin las claves de APNs/);
  assert.equal(R.filaSinClaves.fallos, 1);
});

test('9. `despachar` separa: nada de `apns:` le llega a web-push, y lo de APNs suma al rastro', () => {
  const p = sinComentarios(leer('lib/push.ts'));
  assert.match(p, /const deApns = todas\.filter\(\(s\) => esEndpointApns\(s\.endpoint\)\);/);
  assert.match(p, /const subs = todas\.filter\(\(s\) => !esEndpointApns\(s\.endpoint\)\);/);
  assert.match(p, /return \{ enviados: enviados \+ apns\.enviados, fallidos: fallidos \+ apns\.fallidos \};/);
  assert.match(sinComentarios(leer('lib/push-apns.ts')), /credWsEstricta\(k, ws\)/, 'de la plataforma, nunca de variables de Vercel');
  const ruta = sinComentarios(leer('app/api/push/suscripcion/route.ts'));
  assert.match(ruta, /if \(!tokenApnsValido\(body\.apns\.token\)\) return Response\.json/);
  assert.match(ruta, /endpoint = endpointDeApns\(body\.apns\.token\);/);
  assert.match(ruta, /plataforma: body\.apns \? 'ios' : plataformaDeUA\(ua\),/, 'el onboarding y el corte de grupos cuentan teléfonos por `plataforma`');
  const m = sinComentarios(leer('lib/metodo-catalogo.ts'));
  for (const k of ['APNS_KEY_ID', 'APNS_TEAM_ID', 'APNS_P8']) assert.match(m, new RegExp(`env: '${k}'`), `${k}: Martín no tiene dónde pegarla`);
  // /metodo ya no es una pantalla: la tarjeta vive en Integraciones, y sin su fila ahí el formulario no se ve (la primera versión tenía sólo la de arriba).
  assert.match(sinComentarios(leer('lib/integraciones-catalogo.ts')), /\{ key: 'apple-push', [^\n]*envs: \['APNS_KEY_ID', 'APNS_TEAM_ID', 'APNS_P8'\], soloPlataforma: true \}/);
});

// ⚠️ PROBADO ROMPIÉNDOLO (3/11/2026, base 9 / 0; una rotura por vez, restaurada de memoria y comprobada con sha256):
//   · el TTL en segundos y no como fecha          → 8 / 1 (1)
//   · normal despierta el teléfono                → 8 / 1 (1)
//   · la firma en DER                             → 7 / 2 (3 y 7)
//   · una clave mal cargada borra los iPhones     → 8 / 1 (5)
//   · un `apns:` le llega a web-push              → 7 / 2 (8 y 9)
//   · la .p8 sin normalizar                       → 8 / 1 (4)
// ⚠️ La primera corrida le mandó UN pedido de verdad a api.push.apple.com, con claves de prueba y un token inventado (contestó 403): el JWT se
//    guardaba en la misma memoria que las claves, y firmar «de paso» dejaba cargadas las de la prueba. Por eso son dos memorias. La 8 mira
//    que `clavesSinCargar` sea null: si volviera a pasar, falla acá.
