// =============================================================================
// dLocal Go: el formato del header, la firma del aviso, y los estados que NO son «pagado»
// =============================================================================
// Lo que este test fija es lo que no se ve leyendo el código y se paga en producción:
//
//   · EL VECTOR OFICIAL DE LA FIRMA. Sale de la propia doc de dLocal
//     (docs.dlocalgo.com → payments/notifications, leída el 06/11/2026), que publica el ejemplo con
//     ApiKey `MyMerchantApiKey`, SecretKey `MyMerchantSecretKey` y cuerpo `{"payment_id":"DP-283"}`.
//     Si alguien «arregla» el manifiesto (un `.` en el medio, el orden al revés, el cuerpo
//     reserializado), este vector cae y el push se frena. Sin él, el error se ve en producción como
//     «la firma no coincide» en el 100% de los avisos, indistinguible de una clave mal pegada.
//   · QUE LA VERIFICACIÓN ES FAIL-CLOSED. Sin claves no hay «se acepta igual»: es el pedido explícito
//     de la skill add-webhook-receiver, y es lo contrario de lo que hace Mercado Pago a propósito.
//   · QUE `CANCELLED` Y `EXPIRED` NO SON UN PAGO FALLIDO. Es la trampa de los cinco estados: un
//     ternario de dos ramas los manda a «fallido», y entonces MaKo le escribe al lead que su pago se
//     rechazó cuando nadie intentó pagar nunca.
//   · QUE UNA TASA DE CAMBIO NO ES UN PERMISO DE PAÍS. La cuenta publica tasas de EUR y GBP y dLocal
//     Go no recibe pagos de Europa: si alguien deriva los países de las monedas, esto cae.
//
// Probado ROMPIÉNDOLO (06/11/2026), una rotura por vez y restaurando después de cada una. Con el
// código como está: 9 pases, 0 fallos. Rota (pases / fallos):
//   · `manifiestoDlocal` devolviendo `${apiKey}.${raw}` (la analogía con Stripe)        → 7 / 2
//   · `manifiestoDlocal` devolviendo `${raw}${apiKey}` (el orden al revés)              → 7 / 2
//   · `verificarFirmaDlocal` con `&&` en vez de `||` (deja de ser fail-closed)          → 8 / 1
//   · `queHacerConPagoDlocal` como ternario de dos ramas (lo que no es PAID, «fallido») → 8 / 1
//   · `authDlocal` devolviendo `Bearer ${apiKey}` (sin la secret)                       → 8 / 1
//   · `PAISES_DLOCAL` con 'US' adentro                                                  → 8 / 1
//   · `cuentaPuedeCobrar` sin mirar la revisión de fraude                               → 8 / 1
// Correr: node --import tsx --test tests/dlocal-api.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  authDlocal, baseDlocal, cuentaPuedeCobrar, DLOCAL_API, DLOCAL_API_SBX, ESTADOS_DLOCAL,
  paisCobrableDlocal, PAISES_DLOCAL, queHacerConPagoDlocal, type CuentaDlocal, type PagoDlocal,
} from '../lib/dlocal-reglas';
import { firmarDlocal, manifiestoDlocal, PREFIJO_FIRMA_DLOCAL, verificarFirmaDlocal } from '../lib/pasarela-firma';

// ── El vector de la DOC de dLocal ────────────────────────────────────────────────────────────────

const API_KEY = 'MyMerchantApiKey';
const SECRET = 'MyMerchantSecretKey';
const CUERPO = '{"payment_id":"DP-283"}';
const CLAVES = { apiKey: API_KEY, secret: SECRET };

test('el mensaje firmado es la api key pegada al cuerpo crudo, SIN separador', () => {
  // El ejemplo de la doc, textual: «MyMerchantApiKey{"payment_id":"DP-283"}».
  assert.equal(manifiestoDlocal(API_KEY, CUERPO), 'MyMerchantApiKey{"payment_id":"DP-283"}');
});

test('el vector oficial de la firma verifica', () => {
  const esperada = crypto.createHmac('sha256', SECRET).update(`${API_KEY}${CUERPO}`, 'utf8').digest('hex');
  const header = `${PREFIJO_FIRMA_DLOCAL}${esperada}`;
  assert.equal(verificarFirmaDlocal(CUERPO, header, CLAVES), null);
  // Y la que arma el repo tiene que ser la MISMA (si no, el test se probaría contra sí mismo).
  assert.equal(firmarDlocal(CUERPO, CLAVES), header);
});

test('la firma NO verifica si el cuerpo cambia un solo byte', () => {
  const header = firmarDlocal(CUERPO, CLAVES);
  assert.equal(verificarFirmaDlocal('{"payment_id":"DP-284"}', header, CLAVES), 'no-coincide');
  // Reserializar el JSON cambia el cuerpo: por eso el webhook firma sobre el crudo y no sobre el parseado.
  assert.equal(verificarFirmaDlocal(JSON.stringify(JSON.parse(CUERPO)) + ' ', header, CLAVES), 'no-coincide');
});

test('la firma NO verifica con la secret de otro negocio (el corte entre workspaces)', () => {
  const header = firmarDlocal(CUERPO, CLAVES);
  assert.equal(verificarFirmaDlocal(CUERPO, header, { apiKey: API_KEY, secret: 'la-secret-de-otro' }), 'no-coincide');
  // Y tampoco con la api key de otro: las DOS entran en la cuenta.
  assert.equal(verificarFirmaDlocal(CUERPO, header, { apiKey: 'OtraApiKey', secret: SECRET }), 'no-coincide');
});

test('FAIL-CLOSED: sin claves, sin header o con una firma que no es hex, se rechaza', () => {
  const header = firmarDlocal(CUERPO, CLAVES);
  assert.equal(verificarFirmaDlocal(CUERPO, header, { apiKey: API_KEY, secret: null }), 'sin-secreto');
  assert.equal(verificarFirmaDlocal(CUERPO, header, { apiKey: null, secret: SECRET }), 'sin-secreto');
  assert.equal(verificarFirmaDlocal(CUERPO, null, CLAVES), 'faltan-headers');
  assert.equal(verificarFirmaDlocal(CUERPO, 'Bearer algo', CLAVES), 'faltan-headers');
  assert.equal(verificarFirmaDlocal(CUERPO, `${PREFIJO_FIRMA_DLOCAL}no-es-hex`, CLAVES), 'faltan-headers');
  // Una firma de 64 caracteres pero inventada: ahí sí es «no coincide» y no «faltan headers».
  assert.equal(verificarFirmaDlocal(CUERPO, `${PREFIJO_FIRMA_DLOCAL}${'a'.repeat(64)}`, CLAVES), 'no-coincide');
});

// ── El header de autenticación: las DOS claves, con dos puntos ───────────────────────────────────

test('el header de la API lleva las dos claves con dos puntos', () => {
  assert.equal(authDlocal(CLAVES), 'Bearer MyMerchantApiKey:MyMerchantSecretKey');
  assert.equal(baseDlocal('real'), DLOCAL_API);
  assert.equal(baseDlocal('prueba'), DLOCAL_API_SBX);
  assert.notEqual(DLOCAL_API, DLOCAL_API_SBX);
});

// ── Los cinco estados, y los dos que NO son un pago fallido ──────────────────────────────────────

const pago = (p: Partial<PagoDlocal>): PagoDlocal => ({
  id: 'DP-1', estado: null, detalle: null, monto: 47, moneda: 'USD', acreditado: null, comision: null,
  monedaSaldo: null, pais: 'AR', referencia: 'tok', rechazo: null, creado: null, aprobado: null, ...p,
});

test('sólo PAID aprueba, sólo REJECTED falla, y CANCELLED/EXPIRED no son un pago rechazado', () => {
  assert.equal(queHacerConPagoDlocal(pago({ estado: 'PAID' })).accion, 'aprobado');
  assert.equal(queHacerConPagoDlocal(pago({ estado: 'REJECTED' })).accion, 'fallido');
  // ⚠️ El corazón del test: un ternario de dos ramas manda estos cuatro a «fallido», y MaKo le
  // escribe al lead que su pago se rechazó cuando nadie lo intentó.
  for (const estado of ['CANCELLED', 'EXPIRED', 'PENDING']) {
    assert.equal(queHacerConPagoDlocal(pago({ estado })).accion, 'ignorar', `${estado} no es un pago fallido`);
  }
  // Un intento rechazado con el cobro todavía abierto tampoco cierra el cobro.
  assert.equal(queHacerConPagoDlocal(pago({ estado: 'PENDING', detalle: 'PAYMENT_FAILED' })).accion, 'ignorar');
  // Y un estado que dLocal agregue mañana cae en 'ignorar' NOMBRÁNDOSE, no en «pagado» por descarte.
  const futuro = queHacerConPagoDlocal(pago({ estado: 'CHARGED_BACK' }));
  assert.equal(futuro.accion, 'ignorar');
  assert.match(futuro.motivo, /CHARGED_BACK/);
  assert.equal(ESTADOS_DLOCAL.length, 5);
});

// ── La cuenta que contesta 200 y NO cobra ────────────────────────────────────────────────────────

const cuenta = (c: Partial<CuentaDlocal>): CuentaDlocal => ({
  id: '248551', moneda: 'USD', modo: 'real', kycNivel: 2, kycEstado: 'APPROVED',
  enRevisionDeFraude: false, topeExcedido: false, ...c,
});

test('una cuenta en revisión de fraude o con el KYC pendiente NO puede cobrar', () => {
  assert.equal(cuentaPuedeCobrar(cuenta({})), null);
  // El estado REAL de la cuenta de MaKo medido el 06/11/2026: nivel 2, PENDING, en revisión de fraude.
  assert.match(cuentaPuedeCobrar(cuenta({ enRevisionDeFraude: true }))!, /revisión de fraude/);
  assert.match(cuentaPuedeCobrar(cuenta({ kycEstado: 'PENDING' }))!, /no aprobó los papeles/);
  assert.match(cuentaPuedeCobrar(cuenta({ topeExcedido: true }))!, /tope/);
  // Sin dato de KYC no se inventa un bloqueo (dLocal podría dejar de mandar el campo).
  assert.equal(cuentaPuedeCobrar(cuenta({ kycEstado: null })), null);
});

// ── Una tasa de cambio no es un permiso de país ──────────────────────────────────────────────────

test('dLocal Go NO cobra de Estados Unidos ni de Europa, aunque publique su tasa', () => {
  // Medido el 06/11/2026 contra la cuenta real: /v1/currency-exchanges devuelve 32 monedas, EUR y
  // GBP entre ellas. El centro de ayuda dice que no recibe pagos de EE.UU. ni de Europa.
  for (const pais of ['US', 'ES', 'DE', 'GB', 'FR', 'IT', 'PT']) {
    assert.equal(paisCobrableDlocal(pais), false, `${pais} no puede pagar por dLocal Go`);
  }
  for (const pais of ['AR', 'MX', 'BR', 'CL', 'CO', 'PE', 'UY']) {
    assert.equal(paisCobrableDlocal(pais), true, `${pais} sí`);
  }
  // Lista BLANCA: un país nuevo no entra solo.
  assert.ok(!PAISES_DLOCAL.includes('US') && !PAISES_DLOCAL.includes('ES'));
  assert.equal(paisCobrableDlocal(null), false);
  assert.equal(paisCobrableDlocal('ar'), true); // y no depende de las mayúsculas
});
