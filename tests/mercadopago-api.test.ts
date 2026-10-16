// =============================================================================
// El cliente HTTP de Mercado Pago (lib/mercadopago-api.ts), con `fetch` de mentira
// =============================================================================
// Mercado Pago cuenta y nombra distinto que Stripe, y casi nada de eso da error: se cobra otra cosa
// o no pasa nada. Se fija, ejecutando el módulo contra un `fetch` que anota y contesta:
//   · `X-Idempotency-Key` en todo POST/PUT (en un reembolso es OBLIGATORIO: sin él, error 4292) y
//     nunca en un GET;
//   · `unit_price` y `transaction_amount` DECIMALES (49900.5), no unidades mínimas;
//   · el link es `init_point`, NUNCA `sandbox_init_point` (la doc: «Do not use this parameter»);
//   · una suscripción se cancela con `'canceled'` (UNA ele; `cancelled` es el estado de un PAGO);
//   · el modo de prueba sale de `tags: ['test_user']` de /users/me, no del prefijo del token (en
//     Checkout Pro el de prueba también empieza con APP_USR);
//   · un id que no tiene la forma de un id no sale a la red (no arma rutas con lo que trae un aviso).
//
// El módulo es `server-only`: se neutraliza el marcador con el parche de Module._load de
// tests/mover-etapa-validacion.test.ts y se importa adentro de cada test. Sin red.
//
// Probado ROMPIÉNDOLO (11/10/2026), una rotura por vez sobre la base en verde y restaurando de
// memoria (un script que guarda el texto y lo repone, nunca git). Con el código como está:
// 8 pases, 0 fallos. Rota (pases / fallos):
//   · sin el header `X-Idempotency-Key`                                         → 5 / 3
//   · `unit_price` ×100 (unidades mínimas, como Stripe)                         → 7 / 1
//   · el link tomado de `sandbox_init_point` primero                            → 6 / 2
//   · cancelar con `'cancelled'` (dos eles)                                     → 7 / 1
//   · el modo sin mirar `tags` (sólo el prefijo TEST-)                          → 7 / 1
//   · leerPagoMp sin validar el id antes de ir a la red                         → 7 / 1
// Y el 15/10/2026, con vencerPreferenciaMp (anular un link; 9 pases en verde), cada una → 8 / 1: sin
// `expires`, el instante con `Z` en vez del desfase, sin X-Idempotency-Key, y sin validar el id.
// Correr: node --import tsx --test tests/mercadopago-api.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';

type Cargador = (pedido: string, padre: unknown, esMain: boolean) => unknown;
const M = Module as unknown as { _load: Cargador };
const cargarOriginal = M._load;
M._load = ((pedido: string, padre: unknown, esMain: boolean) =>
  pedido === 'server-only' ? {} : Reflect.apply(cargarOriginal, Module, [pedido, padre, esMain])) as Cargador;

const api = () => import('../lib/mercadopago-api');

// ── fetch de mentira ──────────────────────────────────────────────────────────

type Llamada = { url: URL; metodo: string; headers: Headers; cuerpo: unknown };
let llamadas: Llamada[] = [];
let contestar: (l: Llamada) => Response = () => json(500, {});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const url = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  const crudo = typeof init.body === 'string' ? init.body : null;
  const l: Llamada = { url, metodo: (init.method ?? 'GET').toUpperCase(), headers: new Headers(init.headers), cuerpo: crudo == null ? undefined : JSON.parse(crudo) };
  llamadas.push(l);
  return contestar(l);
}) as typeof fetch;

function preparar(f: (l: Llamada) => Response) {
  llamadas = [];
  contestar = f;
}
const que = (l: Llamada) => `${l.metodo} ${l.url.pathname}`;
type Obj = Record<string, unknown>;

const TOKEN_MP = 'APP_USR-1234567890123456-101112-abcdefabcdef-123456';
const COBRO = 'TokenDelCobroDeMaKo0123456789abc';
const VOLVER = 'https://mako.test/pagar/x/listo';
const AVISO = 'https://mako.test/api/webhooks/mercadopago?u=123456';

// ── Crear ─────────────────────────────────────────────────────────────────────

test('preferencia (Checkout Pro): POST JSON con X-Idempotency-Key, unit_price DECIMAL y el link de init_point', async () => {
  const { crearPreferenciaMp } = await api();
  preparar(() => json(201, {
    id: '123456-abc', init_point: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=123456-abc',
    sandbox_init_point: 'https://sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=123456-abc',
  }));
  const r = await crearPreferenciaMp(TOKEN_MP, { idem: 'mako-cobro-7', concepto: 'Plan Pro', monto: 49900.5, moneda: 'ars', email: 'a@b.com', token: COBRO, notificationUrl: AVISO, volverUrl: VOLVER });
  assert.equal(llamadas.length, 1);
  const l = llamadas[0];
  assert.equal(l.url.href, 'https://api.mercadopago.com/checkout/preferences');
  assert.equal(l.metodo, 'POST');
  assert.equal(l.headers.get('Authorization'), `Bearer ${TOKEN_MP}`);
  assert.equal(l.headers.get('X-Idempotency-Key'), 'mako-cobro-7');
  assert.equal(l.headers.get('Content-Type'), 'application/json');
  const b = l.cuerpo as Obj;
  const item = (b.items as Obj[])[0];
  assert.equal(item.unit_price, 49900.5, 'MP quiere el decimal, no centavos');
  assert.equal(item.currency_id, 'ARS');
  assert.equal(item.quantity, 1);
  assert.equal(b.external_reference, COBRO, 'el cruce con el cobro es external_reference (payer viene en null)');
  assert.equal(b.notification_url, AVISO);
  assert.deepEqual(b.back_urls, { success: VOLVER, pending: VOLVER, failure: VOLVER });
  assert.deepEqual(b.payer, { email: 'a@b.com' });
  assert.deepEqual(r, { ok: true, id: '123456-abc', url: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=123456-abc' });
});

test('sin init_point no hay link, aunque venga sandbox_init_point', async () => {
  const { crearPreferenciaMp } = await api();
  preparar(() => json(201, { id: 'p1', sandbox_init_point: 'https://sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=p1' }));
  const r = await crearPreferenciaMp(TOKEN_MP, { idem: 'mako-cobro-8', concepto: 'Plan', monto: 100, moneda: 'ARS', token: COBRO, notificationUrl: AVISO, volverUrl: VOLVER });
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.status, 502);
  // Y sin email no se manda un payer vacío.
  assert.equal((llamadas[0].cuerpo as Obj).payer, undefined);
});

test('suscripción (preapproval): POST con X-Idempotency-Key, monto decimal, payer_email, pending y SIN notification_url', async () => {
  const { crearSuscripcionMp } = await api();
  preparar(() => json(201, { id: '2c9380848f', init_point: 'https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=2c9380848f' }));
  const r = await crearSuscripcionMp(TOKEN_MP, { idem: 'mako-cobro-9', concepto: 'Plan mensual', monto: 15000.75, moneda: 'ars', email: 'paga@b.com', token: COBRO, volverUrl: VOLVER });
  const l = llamadas[0];
  assert.equal(que(l), 'POST /preapproval');
  assert.equal(l.headers.get('X-Idempotency-Key'), 'mako-cobro-9');
  const b = l.cuerpo as Obj;
  assert.deepEqual(b.auto_recurring, { frequency: 1, frequency_type: 'months', transaction_amount: 15000.75, currency_id: 'ARS' });
  assert.equal(b.payer_email, 'paga@b.com');
  assert.equal(b.status, 'pending');
  assert.equal(b.external_reference, COBRO);
  assert.equal(b.back_url, VOLVER);
  assert.ok(!('notification_url' in b), 'el body de /preapproval no acepta notification_url');
  assert.deepEqual(r, { ok: true, id: '2c9380848f', url: 'https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=2c9380848f' });
});

// ── Plata que vuelve y bajas ──────────────────────────────────────────────────

test('reembolso TOTAL (sin amount) y cancelación con `canceled` (una ele), los dos con X-Idempotency-Key', async () => {
  const { reembolsarMp, cancelarSuscripcionMp } = await api();
  preparar((l) => (l.metodo === 'POST' ? json(201, { id: 9001, status: 'approved' }) : json(200, { id: '2c9380848f', status: 'cancelled' })));
  const r = await reembolsarMp(TOKEN_MP, '123456789', 'mako-reembolso-7');
  assert.deepEqual(r, { ok: true, id: '9001', estado: 'approved' });
  assert.equal(que(llamadas[0]), 'POST /v1/payments/123456789/refunds');
  assert.equal(llamadas[0].headers.get('X-Idempotency-Key'), 'mako-reembolso-7', 'sin la clave MP rechaza el reembolso (4292)');
  assert.deepEqual(llamadas[0].cuerpo, {}, 'un amount lo haría parcial');
  await cancelarSuscripcionMp(TOKEN_MP, '2c9380848f', 'mako-baja-7');
  assert.equal(que(llamadas[1]), 'PUT /preapproval/2c9380848f');
  assert.deepEqual(llamadas[1].cuerpo, { status: 'canceled' });
  assert.equal(llamadas[1].headers.get('X-Idempotency-Key'), 'mako-baja-7');
});

test('anular un link: la preferencia se VENCE (PUT con expires y expiration_date_to de ahora), con X-Idempotency-Key', async () => {
  // Hasta el 15/10/2026 un link anulado de MP quedaba abierto y se podía pagar igual (lib/cobros.ts, anularCobro).
  const { vencerPreferenciaMp, instanteMp } = await api();
  preparar(() => json(200, { id: '123456789-abc-def' }));
  const antes = Date.now();
  const r = await vencerPreferenciaMp(TOKEN_MP, '123456789-abc-def', 'mako-anular-7');
  assert.deepEqual(r, { ok: true, id: '123456789-abc-def' });
  assert.equal(que(llamadas[0]), 'PUT /checkout/preferences/123456789-abc-def');
  assert.equal(llamadas[0].headers.get('X-Idempotency-Key'), 'mako-anular-7');
  const cuerpo = llamadas[0].cuerpo as Obj;
  assert.equal(cuerpo.expires, true, 'sin `expires: true` la fecha de fin no cuenta');
  const fin = String(cuerpo.expiration_date_to ?? '');
  assert.match(fin, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}\+00:00$/, 'el formato de la documentación de MP: milisegundos y el desfase');
  assert.ok(Math.abs(Date.parse(fin) - antes) < 5_000, `el fin no es AHORA: ${fin}`);
  assert.equal(instanteMp(Date.UTC(2026, 9, 15, 23, 59, 59)), '2026-10-15T23:59:59.000+00:00');
  // Y un id que no tiene forma de id no sale a la red.
  preparar(() => json(200, {}));
  const malo = await vencerPreferenciaMp(TOKEN_MP, '../users/me', 'mako-anular-1');
  assert.equal(!malo.ok && malo.status, 400);
  assert.deepEqual(llamadas.map(que), []);
});

// ── Lecturas ──────────────────────────────────────────────────────────────────

test('un GET no lleva X-Idempotency-Key ni Content-Type; el pago se lee con su cobrador y su modo', async () => {
  const { leerPagoMp } = await api();
  preparar(() => json(200, {
    id: 123456789, status: 'approved', status_detail: 'accredited', transaction_amount: 49900.5, currency_id: 'ars',
    external_reference: COBRO, collector_id: 999, date_approved: '2026-10-11T12:00:00.000-03:00', live_mode: false,
    transaction_amount_refunded: 0, metadata: { preapproval_id: '2c9380848f' }, operation_type: 'recurring_payment',
  }));
  const r = await leerPagoMp(TOKEN_MP, '123456789');
  const l = llamadas[0];
  assert.equal(que(l), 'GET /v1/payments/123456789');
  assert.equal(l.headers.get('X-Idempotency-Key'), null);
  assert.equal(l.headers.get('Content-Type'), null);
  assert.equal(l.cuerpo, undefined);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.id, '123456789');
  assert.equal(r.estado, 'approved');
  assert.equal(r.monto, 49900.5);
  assert.equal(r.moneda, 'ARS');
  assert.equal(r.referencia, COBRO);
  assert.equal(r.cobradorId, '999', 'el webhook exige collector_id === MERCADOPAGO_USER_ID');
  assert.equal(r.preapprovalId, '2c9380848f');
  assert.equal(r.modo, 'prueba');
  assert.equal(r.recurrente, true);
});

test('leerCuentaMp: el modo de prueba sale de tags (test_user), no del prefijo; el sitio da la moneda', async () => {
  const { leerCuentaMp } = await api();
  preparar(() => json(200, { id: 123456, site_id: 'MLA', nickname: 'TESTUSER123', tags: ['normal', 'test_user'] }));
  const prueba = await leerCuentaMp(TOKEN_MP);
  assert.deepEqual(prueba, { ok: true, id: '123456', sitio: 'MLA', moneda: 'ARS', nombre: 'TESTUSER123', modo: 'prueba' });
  assert.equal(que(llamadas[0]), 'GET /users/me');
  preparar(() => json(200, { id: 777, site_id: 'MLM', nickname: 'NEGOCIO', tags: ['normal'] }));
  const real = await leerCuentaMp(TOKEN_MP);
  assert.equal(real.ok && real.modo, 'real', 'un APP_USR sin test_user es de producción');
  assert.equal(real.ok && real.moneda, 'MXN');
  // Lo que no es un access token no sale a la red.
  preparar(() => json(200, { id: 1 }));
  const malo = await leerCuentaMp('sk_live_51AbcDefGhiJkl');
  assert.equal(!malo.ok && malo.status, 400);
  assert.equal(llamadas.length, 0);
});

test('los ids que no tienen forma de id no van a la red (no se arman rutas con lo que trae un aviso)', async () => {
  const mp = await api();
  preparar(() => json(200, {}));
  const intentos = [
    await mp.leerPagoMp(TOKEN_MP, '../users/me'),
    await mp.leerPagoMp(TOKEN_MP, '123?x=1'),
    await mp.leerPagoMp(TOKEN_MP, ''),
    await mp.reembolsarMp(TOKEN_MP, '12a', 'mako-reembolso-1'),
    await mp.leerSuscripcionMp(TOKEN_MP, '../../v1/payments'),
    await mp.cancelarSuscripcionMp(TOKEN_MP, 'a b', 'mako-baja-1'),
    await mp.leerCuotaSuscripcionMp(TOKEN_MP, 'abc'),
  ];
  for (const r of intentos) assert.equal(!r.ok && r.status, 400);
  assert.deepEqual(llamadas.map(que), [], 'un id inválido salió a la red');
});

test('el error se lee del cuerpo (message, o la causa); sin cuerpo, el status; un corte, status 0', async () => {
  const { leerPagoMp } = await api();
  preparar(() => json(404, { message: 'Payment not found', error: 'not_found', status: 404, cause: [] }));
  assert.deepEqual(await leerPagoMp(TOKEN_MP, '1'), { ok: false, status: 404, error: 'Payment not found' });
  preparar(() => json(400, { cause: [{ code: 2067, description: 'Invalid user identification number' }] }));
  assert.deepEqual(await leerPagoMp(TOKEN_MP, '1'), { ok: false, status: 400, error: 'Invalid user identification number' });
  preparar(() => new Response('upstream error', { status: 503 }));
  assert.deepEqual(await leerPagoMp(TOKEN_MP, '1'), { ok: false, status: 503, error: 'Mercado Pago respondió 503' });
  preparar(() => { throw new TypeError('fetch failed'); });
  const corte = await leerPagoMp(TOKEN_MP, '1');
  assert.equal(!corte.ok && corte.status, 0);
});
