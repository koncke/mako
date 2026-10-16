// =============================================================================
// El cliente HTTP de Stripe (lib/stripe-api.ts), con `fetch` de mentira
// =============================================================================
// Lo que se manda a Stripe no lo ve ningún tipo: un header que falta, una metadata que no baja al
// pago o un monto en dólares en vez de centavos compilan, y Stripe los acepta (o cobra otra cosa).
// Se fija, ejecutando el módulo contra un `fetch` que anota y contesta:
//   · el POST va form-urlencoded, con `Stripe-Version` fijada e `Idempotency-Key` (un reintento con
//     la misma clave devuelve la primera respuesta en vez de cobrar dos veces);
//   · la metadata del cobro va TAMBIÉN en `payment_intent_data` (pago único) o en
//     `subscription_data` (suscripción): la del Checkout no baja sola, y de la suscripción llega a
//     cada factura — sin ella una renovación no se encuentra;
//   · `unit_amount` en unidad mínima, y `expires_at` nunca más de 24 h (Stripe lo rechaza);
//   · el error se lee de `body.error.message` (res.ok no es «salió bien», y el 4xx dice el porqué);
//   · `asegurarWebhookStripe` borra el NUESTRO (la misma url, o el que MaKo creó con el mismo camino
//     y cuenta en otro dominio; nunca uno ajeno) antes de crear, y sin el
//     `secret` en la respuesta falla: el whsec_ sólo vuelve al crear. Y crear el aviso es la
//     EXCEPCIÓN al Idempotency-Key: una clave repetible devolvería, dentro de las 24 h, el aviso
//     que se acaba de borrar;
//   · `modoDeClaveStripe` distingue real / prueba y rechaza lo que no es una clave secreta;
//   · `borrarWebhooksStripe` (al desconectar) se lleva lo mismo que se borra al reconectar.
//
// El módulo es `server-only` (ese paquete TIRA fuera de un Server Component): se neutraliza el
// marcador con el parche de Module._load de tests/mover-etapa-validacion.test.ts y se importa
// adentro de cada test. No hay red: `globalThis.fetch` es el de abajo.
//
// Probado ROMPIÉNDOLO (11/10/2026), una rotura por vez sobre la base en verde y restaurando de
// memoria (un script que guarda el texto y lo repone, nunca git). Con el código como está:
// 11 pases, 0 fallos. Rota (pases / fallos):
//   · sin el header `Idempotency-Key`                                                → 9 / 2
//   · sin el header `Stripe-Version`                                                 → 9 / 2
//   · sin `payment_intent_data` / `subscription_data` con la metadata                → 9 / 2
//   · `unit_amount: p.monto` (sin pasar a unidad mínima)                             → 10 / 1
//   · el tope de `expires_at` en 48 h                                                → 10 / 1
//   · el error sin leer `body.error.message`                                         → 9 / 2
//   · asegurarWebhookStripe borrando por prefijo de url (se lleva uno ajeno)         → 10 / 1
//   · asegurarWebhookStripe sin exigir el `secret`                                   → 10 / 1
//   · la creación del aviso con una clave repetible (`mako-aviso-${url}`)            → 10 / 1
//   · modoDeClaveStripe aceptando `sk_org_`                                          → 10 / 1
// Y el 15/10/2026, con el aviso de otro dominio (12 pases, 0 fallos en verde):
//   · sin mirar `metadata.mako` (se lleva uno ajeno con el mismo camino)             → 10 / 2
//   · sólo la url exacta (el del dominio viejo queda vivo)                           → 11 / 1
//   · la firma sin la cuenta (se lleva un aviso de MaKo con otro `acct=`)            → 11 / 1
// Correr: node --import tsx --test tests/stripe-api.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';

type Cargador = (pedido: string, padre: unknown, esMain: boolean) => unknown;
const M = Module as unknown as { _load: Cargador };
const cargarOriginal = M._load;
M._load = ((pedido: string, padre: unknown, esMain: boolean) =>
  pedido === 'server-only' ? {} : Reflect.apply(cargarOriginal, Module, [pedido, padre, esMain])) as Cargador;

const api = () => import('../lib/stripe-api');

// ── fetch de mentira ──────────────────────────────────────────────────────────

type Llamada = { url: URL; metodo: string; headers: Headers; cuerpo: string | null };
let llamadas: Llamada[] = [];
let contestar: (l: Llamada) => Response = () => json(500, {});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const url = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  const l: Llamada = { url, metodo: (init.method ?? 'GET').toUpperCase(), headers: new Headers(init.headers), cuerpo: typeof init.body === 'string' ? init.body : null };
  llamadas.push(l);
  return contestar(l);
}) as typeof fetch;

function preparar(f: (l: Llamada) => Response) {
  llamadas = [];
  contestar = f;
}
const que = (l: Llamada) => `${l.metodo} ${l.url.pathname}`;
const form = (l: Llamada) => new URLSearchParams(l.cuerpo ?? '');

const KEY = 'sk_test_51MaKoPruebaAbcdefghijklmn';
const TOKEN = 'TokenDelCobroDeMaKo0123456789abc';
const base = {
  idem: 'mako-cobro-7', concepto: 'Plan Pro', email: 'a@b.com', token: TOKEN, ws: 9, cobroId: 7,
  successUrl: 'https://mako.test/pagar/x/listo', cancelUrl: 'https://mako.test/pagar/x/listo?cancelado=1',
};
const sesionCreada = (l: Llamada) => {
  const exp = Number(form(l).get('expires_at'));
  return json(200, { id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1', expires_at: exp });
};

// ── Checkout ──────────────────────────────────────────────────────────────────

test('crear el checkout: POST form-urlencoded, versión fijada e Idempotency-Key', async () => {
  const { crearCheckoutStripe, STRIPE_VERSION } = await api();
  preparar(sesionCreada);
  const r = await crearCheckoutStripe(KEY, { ...base, tipo: 'unico', monto: 47, moneda: 'USD' });
  assert.equal(llamadas.length, 1);
  const l = llamadas[0];
  assert.equal(l.url.href, 'https://api.stripe.com/v1/checkout/sessions');
  assert.equal(l.metodo, 'POST');
  assert.equal(l.headers.get('Authorization'), `Bearer ${KEY}`);
  assert.equal(STRIPE_VERSION, '2026-09-30.endive');
  assert.equal(l.headers.get('Stripe-Version'), STRIPE_VERSION);
  assert.equal(l.headers.get('Idempotency-Key'), 'mako-cobro-7');
  assert.equal(l.headers.get('Content-Type'), 'application/x-www-form-urlencoded');
  assert.ok(l.cuerpo && !l.cuerpo.trimStart().startsWith('{'), 'Stripe no recibe JSON');
  assert.ok(r.ok);
  assert.equal(r.ok && r.url, 'https://checkout.stripe.com/c/pay/cs_test_1');
  assert.equal(r.ok && r.venceAt, new Date(Number(form(l).get('expires_at')) * 1000).toISOString());
});

test('pago único: la metadata del cobro va TAMBIÉN en payment_intent_data, y nada de suscripción', async () => {
  const { crearCheckoutStripe } = await api();
  preparar(sesionCreada);
  await crearCheckoutStripe(KEY, { ...base, tipo: 'unico', monto: 47, moneda: 'USD' });
  const f = form(llamadas[0]);
  assert.equal(f.get('mode'), 'payment');
  assert.equal(f.get('client_reference_id'), TOKEN);
  assert.equal(f.get('customer_email'), 'a@b.com');
  for (const donde of ['metadata', 'payment_intent_data[metadata]']) {
    assert.equal(f.get(`${donde}[mako_cobro]`), TOKEN, donde);
    assert.equal(f.get(`${donde}[mako_ws]`), '9', donde);
    assert.equal(f.get(`${donde}[mako_cobro_id]`), '7', donde);
  }
  assert.ok(![...f.keys()].some((k) => k.startsWith('subscription_data')), 'un pago único con subscription_data');
  assert.equal(f.get('line_items[0][price_data][recurring][interval]'), null);
});

test('suscripción: mode=subscription, recurrente mensual y la metadata en subscription_data (llega a cada factura)', async () => {
  const { crearCheckoutStripe } = await api();
  preparar(sesionCreada);
  await crearCheckoutStripe(KEY, { ...base, tipo: 'suscripcion', monto: 47, moneda: 'USD', email: null });
  const f = form(llamadas[0]);
  assert.equal(f.get('mode'), 'subscription');
  assert.equal(f.get('line_items[0][price_data][recurring][interval]'), 'month');
  assert.equal(f.get('subscription_data[metadata][mako_cobro]'), TOKEN);
  assert.equal(f.get('subscription_data[metadata][mako_cobro_id]'), '7');
  assert.ok(![...f.keys()].some((k) => k.startsWith('payment_intent_data')), 'una suscripción con payment_intent_data');
  assert.equal(f.get('customer_email'), null, 'sin email no se manda el campo');
});

test('unit_amount en unidad mínima: USD con centavos, CLP entero', async () => {
  const { crearCheckoutStripe } = await api();
  preparar(sesionCreada);
  await crearCheckoutStripe(KEY, { ...base, tipo: 'unico', monto: 19.99, moneda: 'USD' });
  await crearCheckoutStripe(KEY, { ...base, tipo: 'unico', monto: 49900, moneda: 'CLP' });
  assert.equal(form(llamadas[0]).get('line_items[0][price_data][unit_amount]'), '1999');
  assert.equal(form(llamadas[0]).get('line_items[0][price_data][currency]'), 'usd');
  assert.equal(form(llamadas[1]).get('line_items[0][price_data][unit_amount]'), '49900', 'un CLP ×100 cobra cien veces más');
  assert.equal(form(llamadas[1]).get('line_items[0][price_data][currency]'), 'clp');
});

test('expires_at: nunca más de 24 h ni menos de 30 min (lo que acepta Stripe)', async () => {
  const { crearCheckoutStripe } = await api();
  preparar(sesionCreada);
  const antes = Math.floor(Date.now() / 1000);
  await crearCheckoutStripe(KEY, { ...base, tipo: 'unico', monto: 47, moneda: 'USD' });
  await crearCheckoutStripe(KEY, { ...base, tipo: 'unico', monto: 47, moneda: 'USD', venceEnSeg: 48 * 3600 });
  await crearCheckoutStripe(KEY, { ...base, tipo: 'unico', monto: 47, moneda: 'USD', venceEnSeg: 60 });
  const despues = Math.floor(Date.now() / 1000) + 1;
  for (const l of llamadas) {
    const exp = Number(form(l).get('expires_at'));
    assert.ok(exp - antes <= 24 * 3600, `expires_at a ${exp - antes} s: más de 24 h`);
    assert.ok(exp - despues >= 30 * 60, `expires_at a ${exp - despues} s: menos de 30 min`);
  }
});

test('el error se lee de body.error.message; sin cuerpo, el status; sin url, no es un éxito', async () => {
  const { crearCheckoutStripe } = await api();
  const p = { ...base, tipo: 'unico' as const, monto: 47, moneda: 'USD' };
  preparar(() => json(400, { error: { type: 'invalid_request_error', message: 'Invalid currency: xyz' } }));
  assert.deepEqual(await crearCheckoutStripe(KEY, p), { ok: false, status: 400, error: 'Invalid currency: xyz' });
  preparar(() => new Response('<html>Bad Gateway</html>', { status: 502 }));
  assert.deepEqual(await crearCheckoutStripe(KEY, p), { ok: false, status: 502, error: 'Stripe respondió 502' });
  // 200 sin `url` (una sesión que ya no está abierta): no se devuelve un link vacío como si nada.
  preparar(() => json(200, { id: 'cs_1', url: null }));
  const sinUrl = await crearCheckoutStripe(KEY, p);
  assert.equal(sinUrl.ok, false);
  assert.equal(!sinUrl.ok && sinUrl.status, 502);
  // Un corte de red: status 0 (el pedido PUDO haber llegado; quien llama decide, y en plata no reintenta).
  preparar(() => { throw new TypeError('fetch failed'); });
  const corte = await crearCheckoutStripe(KEY, p);
  assert.equal(!corte.ok && corte.status, 0);
  assert.match(!corte.ok ? corte.error : '', /Stripe no contestó/);
});

test('un GET no lleva Idempotency-Key ni cuerpo, sí la versión; y un id no cambia la ruta', async () => {
  const { leerCheckoutStripe, STRIPE_VERSION } = await api();
  preparar(() => json(200, { id: 'cs_1', status: 'complete', payment_status: 'paid', amount_total: 4700, currency: 'usd', livemode: false, metadata: { mako_cobro: TOKEN, otro: 3 } }));
  const r = await leerCheckoutStripe(KEY, 'cs_1');
  assert.equal(que(llamadas[0]), 'GET /v1/checkout/sessions/cs_1');
  assert.equal(llamadas[0].headers.get('Idempotency-Key'), null);
  assert.equal(llamadas[0].headers.get('Stripe-Version'), STRIPE_VERSION);
  assert.equal(llamadas[0].cuerpo, null);
  assert.ok(r.ok);
  assert.equal(r.ok && r.monto, 47, 'amount_total vuelve de unidad mínima');
  assert.equal(r.ok && r.modo, 'prueba');
  assert.deepEqual(r.ok && r.metadata, { mako_cobro: TOKEN }, 'la metadata sólo trae strings');
  // Un id con barras no navega a otro recurso: va codificado.
  await leerCheckoutStripe(KEY, 'cs_1/../../account');
  assert.equal(llamadas[1].url.pathname, '/v1/checkout/sessions/cs_1%2F..%2F..%2Faccount');
});

test('lo que devuelve plata o da de baja lleva la clave de quien llama (reembolso y cancelación)', async () => {
  const { reembolsarStripe, cancelarSuscripcionStripe } = await api();
  preparar((l) => {
    if (que(l) === 'GET /v1/invoice_payments') return json(200, { data: [{ invoice: 'in_1', payment: { type: 'payment_intent', payment_intent: 'pi_1' } }] });
    if (que(l) === 'POST /v1/refunds') return json(200, { id: 're_1', status: 'succeeded' });
    return json(200, { id: 'sub_1', status: 'canceled' });
  });
  const r = await reembolsarStripe(KEY, { idem: 'mako-reembolso-7', invoice: 'in_1' });
  assert.deepEqual(r, { ok: true, id: 're_1', estado: 'succeeded' });
  assert.deepEqual(llamadas.map(que), ['GET /v1/invoice_payments', 'POST /v1/refunds']);
  assert.equal(llamadas[0].url.searchParams.get('invoice'), 'in_1');
  assert.equal(llamadas[1].headers.get('Idempotency-Key'), 'mako-reembolso-7');
  assert.equal(form(llamadas[1]).get('payment_intent'), 'pi_1');
  assert.equal(form(llamadas[1]).get('amount'), null, 'el reembolso es TOTAL: sin monto');
  await cancelarSuscripcionStripe(KEY, 'sub_1', 'mako-baja-7');
  assert.equal(que(llamadas[2]), 'DELETE /v1/subscriptions/sub_1');
  assert.equal(llamadas[2].headers.get('Idempotency-Key'), 'mako-baja-7');
});

// ── El aviso (webhook) ────────────────────────────────────────────────────────

const URL_AVISO = 'https://mako.test/api/webhooks/stripe?acct=acct_A';

test('asegurarWebhookStripe: borra el NUESTRO (misma url exacta) y crea uno con la versión y los eventos', async () => {
  const { asegurarWebhookStripe, EVENTOS_STRIPE, STRIPE_VERSION } = await api();
  preparar((l) => {
    if (que(l) === 'GET /v1/webhook_endpoints') {
      return json(200, { data: [
        { id: 'we_nuestro', url: URL_AVISO },
        { id: 'we_ajeno', url: 'https://otro-sistema.test/hook' },
        { id: 'we_parecido', url: `${URL_AVISO}&x=1` },
      ] });
    }
    if (l.metodo === 'DELETE') return json(200, { id: l.url.pathname.split('/').pop(), deleted: true });
    return json(200, { id: 'we_nuevo', secret: 'whsec_nuevo123' });
  });
  const r = await asegurarWebhookStripe(KEY, URL_AVISO);
  assert.deepEqual(r, { ok: true, endpointId: 'we_nuevo', secret: 'whsec_nuevo123', recreado: true });
  assert.deepEqual(llamadas.map(que), ['GET /v1/webhook_endpoints', 'DELETE /v1/webhook_endpoints/we_nuestro', 'POST /v1/webhook_endpoints'],
    'se borró algo que no es nuestro, o se creó antes de borrar');
  const f = form(llamadas[2]);
  assert.equal(f.get('url'), URL_AVISO);
  assert.equal(f.get('api_version'), STRIPE_VERSION, 'sin api_version cada cuenta manda los eventos con SU versión');
  assert.deepEqual(f.getAll('enabled_events[]'), [...EVENTOS_STRIPE]);
  assert.ok(!EVENTOS_STRIPE.includes('invoice.created' as never), 'invoice.created demora las facturas hasta 72 h si el aviso falla');
  // ⚠️ La EXCEPCIÓN a «Idempotency-Key en todo POST»: crear el aviso NO lleva una clave repetible.
  // Stripe guarda la respuesta de una clave 24 h; reconectar dentro de ese día borraría el aviso y
  // la misma clave devolvería el BORRADO con su whsec_ (guardado como si sirviera, y ningún aviso
  // llegaría). Si algún día lleva clave, tiene que ser distinta en cada conexión.
  await asegurarWebhookStripe(KEY, URL_AVISO);
  const claves = llamadas.filter((l) => que(l) === 'POST /v1/webhook_endpoints').map((l) => l.headers.get('Idempotency-Key'));
  assert.equal(claves.length, 2);
  assert.ok(claves[0] == null || claves[0] !== claves[1], `la creación del aviso repite la clave «${claves[0]}»`);
});

test('asegurarWebhookStripe: sin el secret en la respuesta falla; un 404 al borrar sigue; otro error corta antes de crear', async () => {
  const { asegurarWebhookStripe } = await api();
  preparar((l) => (l.metodo === 'GET' ? json(200, { data: [] }) : json(200, { id: 'we_1' })));
  const sinSecreto = await asegurarWebhookStripe(KEY, URL_AVISO);
  assert.equal(sinSecreto.ok, false, 'sin el whsec_ no hay cómo verificar ningún aviso: no es un éxito');
  assert.match(!sinSecreto.ok ? sinSecreto.error : '', /secreto/);

  preparar((l) => {
    if (l.metodo === 'GET') return json(200, { data: [{ id: 'we_viejo', url: URL_AVISO }] });
    if (l.metodo === 'DELETE') return json(404, { error: { message: 'No such webhook endpoint' } });
    return json(200, { id: 'we_2', secret: 'whsec_2' });
  });
  assert.equal((await asegurarWebhookStripe(KEY, URL_AVISO)).ok, true, 'el que ya no existe no frena');

  preparar((l) => {
    if (l.metodo === 'GET') return json(200, { data: [{ id: 'we_viejo', url: URL_AVISO }] });
    if (l.metodo === 'DELETE') return json(403, { error: { message: "Having the 'rak_webhook_write' permission would allow this request to continue." } });
    return json(200, { id: 'we_3', secret: 'whsec_3' });
  });
  const sinPermiso = await asegurarWebhookStripe(KEY, URL_AVISO);
  assert.equal(sinPermiso.ok, false);
  assert.match(!sinPermiso.ok ? sinPermiso.error : '', /rak_webhook_write/);
  assert.ok(!llamadas.some((l) => l.metodo === 'POST'), 'con el viejo sin borrar no se crea otro (quedarían dos avisos)');
});

test('asegurarWebhookStripe / borrarWebhooksStripe: se llevan el de MaKo en OTRO dominio (mismo camino y cuenta), nunca uno ajeno', async () => {
  const { asegurarWebhookStripe, borrarWebhooksStripe } = await api();
  const avisos = [
    { id: 'we_dominio_viejo', url: 'https://mako-viejo.test/api/webhooks/stripe?acct=acct_A', metadata: { mako: '1' } },
    { id: 'we_ajeno_mismo_camino', url: 'https://otro-sistema.test/api/webhooks/stripe?acct=acct_A', metadata: {} },
    { id: 'we_mako_otra_cuenta', url: 'https://mako-viejo.test/api/webhooks/stripe?acct=acct_B', metadata: { mako: '1' } },
    { id: 'we_mako_otro_camino', url: 'https://mako-viejo.test/api/webhooks/otra-cosa?acct=acct_A', metadata: { mako: '1' } },
  ];
  preparar((l) => {
    if (l.metodo === 'GET') return json(200, { data: avisos });
    if (l.metodo === 'DELETE') return json(200, { deleted: true });
    return json(200, { id: 'we_nuevo', secret: 'whsec_n' });
  });
  const r = await asegurarWebhookStripe(KEY, URL_AVISO);
  assert.equal(r.ok && r.recreado, true);
  const borrados = () => llamadas.filter((l) => l.metodo === 'DELETE').map((l) => l.url.pathname.split('/').pop());
  assert.deepEqual(borrados(), ['we_dominio_viejo'],
    'tras una mudanza de dominio el aviso viejo apunta a una url muerta (Stripe le manda mails de fallo al negocio); y el sin metadata.mako no es nuestro');

  const responder = contestar;
  preparar(responder);
  const d = await borrarWebhooksStripe(KEY, URL_AVISO);
  assert.deepEqual(d, { ok: true, borrados: 1 });
  assert.deepEqual(borrados(), ['we_dominio_viejo'], 'al desconectar se borra lo mismo que al reconectar');
  assert.ok(!llamadas.some((l) => l.metodo === 'POST'), 'desconectar no crea nada');
});

// ── La clave ──────────────────────────────────────────────────────────────────

test('modoDeClaveStripe: real / prueba por el prefijo; lo que no es una clave secreta no va a la red', async () => {
  const { modoDeClaveStripe, leerCuentaStripe } = await api();
  assert.equal(modoDeClaveStripe('sk_live_51AbcDefGhiJkl'), 'real');
  assert.equal(modoDeClaveStripe('rk_live_51AbcDefGhiJkl'), 'real');
  assert.equal(modoDeClaveStripe(' sk_test_51AbcDefGhiJkl '), 'prueba');
  assert.equal(modoDeClaveStripe('rk_test_51AbcDefGhiJkl'), 'prueba');
  for (const k of ['pk_live_51AbcDefGhiJkl', 'sk_org_51AbcDefGhiJkl', 'whsec_51AbcDefGhiJkl', 'sk_live_corta', '', null, undefined]) {
    assert.equal(modoDeClaveStripe(k), null, String(k));
  }
  preparar(() => json(200, { id: 'acct_1' }));
  const r = await leerCuentaStripe('pk_live_51AbcDefGhiJkl');
  assert.equal(!r.ok && r.status, 400);
  assert.equal(llamadas.length, 0, 'una clave publicable no se manda a Stripe');
});
