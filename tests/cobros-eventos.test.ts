// =============================================================================
// Qué dice un aviso de Stripe o de Mercado Pago (lib/cobros-eventos.ts)
// =============================================================================
// Los cuerpos son los de la DOCUMENTACIÓN DEL WEBHOOK de cada uno, no los de su API REST (AGENTS.md
// «la forma de un webhook se mide en el webhook»):
//   · Stripe: el `Event` (`{ id: 'evt_…', object: 'event', type, livemode, data: { object } }`) de
//     docs.stripe.com/webhooks, con los objetos de docs.stripe.com/api (Checkout Session, Invoice
//     desde basil con `parent.subscription_details`, Subscription, Charge sin `invoice`).
//   · Mercado Pago: la notificación de mercadopago.com.ar/developers («Webhooks»):
//     `{ id, live_mode, type, date_created, user_id, api_version, action, data: { id } }` con `data.id`
//     también en el query, y el IPN viejo `?topic=payment&id=…`. ⚠️ Los de suscripción
//     (`subscription_preapproval`, `subscription_authorized_payment`) están armados con esa misma
//     forma genérica y su `type`: falta medirlos con un cuerpo real.
//
// Probado rompiéndolo (11/10/2026), una rotura por vez y restaurando de memoria (los números al pie).
//
// Correr: node --import tsx --test tests/cobros-eventos.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  acctDelWebhook, avisoStripe, buscarDePagoMp, claveEventoMp, confirmarCargo, confirmarCheckout, confirmarFactura,
  conPresupuesto, esDelCobro, eventoStripe, mismoModo, motivoRechazoMp, motivoSinDatos, notificacionMp, planDePagoMp,
  suscripcionMpCancelada, tokenReleido, type AvisoStripe,
} from '../lib/cobros-eventos';

const TOKEN = 'AbCdEfGhIjKlMnOpQrStUvWxYz012345'; // 32 base64url, como nuevoTokenCobro
const OTRO = 'ZZZdEfGhIjKlMnOpQrStUvWxYz012345';

/** Un Event de Stripe como lo manda el webhook. */
const evento = (type: string, object: Record<string, unknown>, livemode = false) => ({
  id: 'evt_1NG8Du2eZvKYlo2CUI79vXWy', object: 'event', api_version: '2026-09-30.endive', created: 1686089970,
  data: { object }, livemode, pending_webhooks: 1, request: { id: null, idempotency_key: null }, type,
});

const sesion = (extra: Record<string, unknown> = {}) => ({
  id: 'cs_test_a1b2c3', object: 'checkout.session', mode: 'payment', status: 'complete', payment_status: 'paid',
  amount_total: 4900, currency: 'usd', client_reference_id: TOKEN, customer_email: null,
  customer_details: { email: 'quien@ejemplo.com' }, metadata: { mako_cobro: TOKEN, mako_ws: '13', mako_cobro_id: '7' },
  payment_intent: 'pi_3MtwBwLkdIwHu7ix28a3tqPa', subscription: null, invoice: null, livemode: false, ...extra,
});

const factura = (billing_reason: string, extra: Record<string, unknown> = {}) => ({
  id: 'in_1MtHbELkdIwHu7ixl4OzzPMv', object: 'invoice', amount_due: 4900, amount_paid: 4900, amount_remaining: 0,
  billing_reason, currency: 'usd', customer: 'cus_NeZwdNtLEOXuvB', customer_email: 'quien@ejemplo.com', livemode: false,
  status: 'paid',
  parent: { type: 'subscription_details', quote_details: null, subscription_details: { metadata: { mako_cobro: TOKEN }, subscription: 'sub_1MowQVLkdIwHu7ixeRlqHVzs' } },
  ...extra,
});

const st = (type: string, object: Record<string, unknown>, livemode = false) => {
  const ev = eventoStripe(evento(type, object, livemode));
  assert.ok(ev, `${type}: no se leyó el sobre del evento`);
  return avisoStripe(ev!);
};

// ── Stripe: el sobre ──────────────────────────────────────────────────────────

test('Stripe: el sobre del evento se lee y lo que no es un evento no', () => {
  const ev = eventoStripe(evento('checkout.session.completed', sesion()));
  assert.equal(ev?.id, 'evt_1NG8Du2eZvKYlo2CUI79vXWy');
  assert.equal(ev?.livemode, false);
  assert.equal(eventoStripe({ ...evento('x', {}), id: 'cs_123' }), null, 'un id que no es evt_ no es un evento');
  assert.equal(eventoStripe({ ...evento('x', {}), object: 'checkout.session' }), null);
  assert.equal(eventoStripe('no'), null);
  assert.equal(eventoStripe({ ...evento('x', {}), id: `evt_${'a'.repeat(300)}` }), null, 'sin tope de largo, la fila de dedup rechaza el insert');
});

test('Stripe: el ?acct= se lee con tope y alfabeto (va ANTES de la firma)', () => {
  assert.equal(acctDelWebhook('acct_1Nv0FGQ9RKHgCVdK'), 'acct_1Nv0FGQ9RKHgCVdK');
  assert.equal(acctDelWebhook(null), null);
  assert.equal(acctDelWebhook(''), null);
  assert.equal(acctDelWebhook(`acct_${'x'.repeat(60)}`), null, 'más de 64: una consulta de ruteo por pedido sin firmar');
  assert.equal(acctDelWebhook("acct_1'; drop"), null);
});

// ── Stripe: qué cobro buscar y qué acción ─────────────────────────────────────

/** El aviso, que NO se ignoró y es de esta acción (y TypeScript lo sabe de acá en más). */
function accionable(a: AvisoStripe, accion: Exclude<AvisoStripe['accion'], 'ignorar'>) {
  if (a.accion === 'ignorar') assert.fail(`se ignoró: ${a.motivo}`);
  assert.equal(a.accion, accion);
  return a;
}

test('checkout.session.completed PAGADO: aprobado, buscando por mako_cobro y por la sesión', () => {
  const a = accionable(st('checkout.session.completed', sesion()), 'aprobado');
  assert.deepEqual(a.leer, { objeto: 'checkout', id: 'cs_test_a1b2c3' });
  assert.deepEqual(a.buscar, { token: TOKEN, ref: 'cs_test_a1b2c3' });
  // Sin metadata, el client_reference_id.
  assert.equal(accionable(st('checkout.session.completed', sesion({ metadata: {} })), 'aprobado').buscar.token, TOKEN);
});

test('checkout.session.completed SIN PAGAR (medio diferido): se ignora y espera al async', () => {
  const a = st('checkout.session.completed', sesion({ payment_status: 'unpaid', payment_intent: 'pi_x' }));
  assert.equal(a.accion, 'ignorar');
  assert.match(a.accion === 'ignorar' ? a.motivo : '', /async_payment_succeeded/);
  assert.equal(st('checkout.session.completed', sesion({ payment_status: 'no_payment_required' })).accion, 'ignorar');
});

test('async_payment_succeeded aprueba y async_payment_failed falla, sobre la misma sesión', () => {
  accionable(st('checkout.session.async_payment_succeeded', sesion({ payment_status: 'paid' })), 'aprobado');
  const mal = accionable(st('checkout.session.async_payment_failed', sesion({ payment_status: 'unpaid' })), 'fallido');
  assert.deepEqual(mal.leer, { objeto: 'checkout', id: 'cs_test_a1b2c3' });
  assert.equal(st('checkout.session.expired', sesion({ status: 'expired', payment_status: 'unpaid' })).accion, 'ignorar');
});

test('invoice.paid de la PRIMERA factura y de una RENOVACIÓN: aprobado, por parent.subscription_details', () => {
  for (const motivo of ['subscription_create', 'subscription_cycle']) {
    const a = accionable(st('invoice.paid', factura(motivo)), 'aprobado');
    assert.deepEqual(a.leer, { objeto: 'factura', id: 'in_1MtHbELkdIwHu7ixl4OzzPMv' }, motivo);
    assert.deepEqual(a.buscar, { token: TOKEN, suscripcionId: 'sub_1MowQVLkdIwHu7ixeRlqHVzs' }, motivo);
  }
  // La suscripción como objeto expandido también sirve.
  const exp = st('invoice.paid', factura('subscription_cycle', { parent: { type: 'subscription_details', subscription_details: { metadata: {}, subscription: { id: 'sub_9' } } } }));
  assert.equal(accionable(exp, 'aprobado').buscar.suscripcionId, 'sub_9');
  // Una factura suelta (sin suscripción) o de un cambio de plan no es un pago de MaKo.
  assert.equal(st('invoice.paid', factura('manual', { parent: null })).accion, 'ignorar');
  assert.equal(st('invoice.paid', factura('subscription_update')).accion, 'ignorar');
});

test('invoice.payment_failed: fallido, buscando por la suscripción', () => {
  const a = accionable(st('invoice.payment_failed', factura('subscription_cycle', { status: 'open', amount_paid: 0 })), 'fallido');
  assert.equal(a.buscar.suscripcionId, 'sub_1MowQVLkdIwHu7ixeRlqHVzs');
});

test('customer.subscription.deleted: cancelada, por la metadata y el id de la suscripción', () => {
  const a = st('customer.subscription.deleted', { id: 'sub_1MowQVLkdIwHu7ixeRlqHVzs', object: 'subscription', status: 'canceled', metadata: { mako_cobro: TOKEN }, livemode: false });
  assert.deepEqual(accionable(a, 'suscripcion_cancelada').buscar, { token: TOKEN, suscripcionId: 'sub_1MowQVLkdIwHu7ixeRlqHVzs' });
});

test('charge.refunded: reembolso, buscando por el payment intent (el cargo ya no trae invoice)', () => {
  const a = accionable(st('charge.refunded', { id: 'ch_3MmlLrLkdIwHu7ix0snN0B15', object: 'charge', amount: 4900, amount_refunded: 4900, currency: 'usd', payment_intent: 'pi_3MtwBwLkdIwHu7ix28a3tqPa', refunded: true, metadata: {}, livemode: false }), 'reembolso');
  assert.deepEqual(a.leer, { objeto: 'cargo', id: 'ch_3MmlLrLkdIwHu7ix0snN0B15' });
  assert.equal(a.buscar.pagoId, 'pi_3MtwBwLkdIwHu7ix28a3tqPa');
  assert.equal(a.buscar.token, null);
});

test('un evento que MaKo no escucha, o sin objeto, se ignora con motivo', () => {
  assert.equal(st('payment_intent.succeeded', { id: 'pi_1' }).accion, 'ignorar');
  assert.equal(st('checkout.session.completed', { object: 'checkout.session' }).accion, 'ignorar');
});

test('NADA del cuerpo es un monto: el aviso dice qué releer, no cuánto', () => {
  const a = st('invoice.paid', factura('subscription_cycle', { amount_paid: 999999 }));
  assert.ok(!JSON.stringify(a).includes('999999'), 'un monto del cuerpo se coló en lo que se aplica');
});

// ── Stripe: la relectura confirma ─────────────────────────────────────────────

test('la sesión releída: el pago único va con el payment intent y la suscripción con su FACTURA', () => {
  const base = { estado: 'complete', pagoEstado: 'paid', paymentIntent: 'pi_1', subscription: null, invoice: null };
  assert.deepEqual(confirmarCheckout('aprobado', base), { ok: true, proveedorPagoId: 'pi_1', suscripcionId: null });
  // La primera factura llega DOS veces (esta sesión e invoice.paid subscription_create): el mismo id.
  const sus = confirmarCheckout('aprobado', { ...base, paymentIntent: null, subscription: 'sub_1', invoice: 'in_1' });
  const fac = confirmarFactura('aprobado', { id: 'in_1', estado: 'paid', montoPagado: 49, moneda: 'USD', motivo: 'subscription_create', suscripcion: 'sub_1' });
  assert.ok(sus.ok && fac.ok);
  assert.equal(sus.ok && sus.proveedorPagoId, fac.ok && fac.proveedorPagoId, 'los dos caminos de la primera factura tienen que dar el MISMO proveedorPagoId');
  // Sin factura todavía, la suscripción espera su invoice.paid (con el id de la sesión sería una «renovación»).
  assert.equal(confirmarCheckout('aprobado', { ...base, paymentIntent: null, subscription: 'sub_1', invoice: null }).ok, false);
  assert.equal(confirmarCheckout('aprobado', { ...base, pagoEstado: 'unpaid' }).ok, false, 'el cuerpo decía paid y la relectura no');
  assert.equal(confirmarCheckout('fallido', { ...base, pagoEstado: 'unpaid' }).ok, true);
  assert.equal(confirmarCheckout('fallido', base).ok, false, 'un «falló» que la relectura ve pagado no se aplica');
});

test('la factura releída: renovación con el id de ESA factura y su monto; en cero o sin pagar, no', () => {
  const ren = confirmarFactura('aprobado', { id: 'in_2', estado: 'paid', montoPagado: 59, moneda: 'USD', motivo: 'subscription_cycle', suscripcion: 'sub_1' });
  assert.deepEqual(ren, { ok: true, proveedorPagoId: 'in_2', monto: 59, moneda: 'USD', suscripcionId: 'sub_1' });
  assert.equal(confirmarFactura('aprobado', { id: 'in_3', estado: 'paid', montoPagado: 0, moneda: 'USD', motivo: 'subscription_cycle', suscripcion: 'sub_1' }).ok, false);
  assert.equal(confirmarFactura('aprobado', { id: 'in_3', estado: 'open', montoPagado: 59, moneda: 'USD', motivo: 'subscription_cycle', suscripcion: 'sub_1' }).ok, false);
  assert.equal(confirmarFactura('fallido', { id: 'in_3', estado: 'open', montoPagado: 0, moneda: 'USD', motivo: 'subscription_cycle', suscripcion: 'sub_1' }).ok, true);
  assert.equal(confirmarFactura('fallido', { id: 'in_3', estado: 'paid', montoPagado: 59, moneda: 'USD', motivo: 'subscription_cycle', suscripcion: 'sub_1' }).ok, false);
});

test('el cargo releído dice si el reembolso fue total o parcial', () => {
  assert.deepEqual(confirmarCargo({ paymentIntent: 'pi_1', reembolsado: true, montoReembolsado: 49 }), { ok: true, total: true, paymentIntent: 'pi_1' });
  assert.deepEqual(confirmarCargo({ paymentIntent: 'pi_1', reembolsado: false, montoReembolsado: 10 }), { ok: true, total: false, paymentIntent: 'pi_1' });
  assert.equal(confirmarCargo({ paymentIntent: 'pi_1', reembolsado: false, montoReembolsado: 0 }).ok, false);
});

test('modo y pertenencia: otro modo u otro token no se aplican', () => {
  assert.equal(mismoModo(true, 'real'), true);
  assert.equal(mismoModo(false, 'prueba'), true);
  assert.equal(mismoModo(true, 'prueba'), false, 'un evento real sobre un cobro de prueba');
  assert.equal(mismoModo(false, 'real'), false);
  assert.equal(mismoModo(null, 'real'), true);
  assert.equal(tokenReleido({ metadata: { mako_cobro: TOKEN } }), TOKEN);
  assert.equal(tokenReleido({ referencia: 'no-es-un-token' }), null);
  assert.equal(esDelCobro(TOKEN, OTRO), false);
  assert.equal(esDelCobro(TOKEN, null), true, 'una renovación no siempre trae el token');
});

// ── Mercado Pago ──────────────────────────────────────────────────────────────

const query = (o: Record<string, string>) => new URLSearchParams(o);
/** El ejemplo de la doc de MP («Webhooks»), con el tipo que se quiera. */
const notif = (type: string, id: string, extra: Record<string, unknown> = {}) => ({
  id: 12345, live_mode: true, type, date_created: '2015-03-25T10:04:58.396-04:00', user_id: 44444,
  api_version: 'v1', action: `${type}.created`, data: { id }, ...extra,
});

test('MP payment: data.id del CUERPO y del QUERY, user_id del cuerpo', () => {
  const cuerpo = notificacionMp({ query: query({}), cuerpo: notif('payment', '999999999') });
  assert.deepEqual(cuerpo, { ok: true, formato: 'webhook', tipo: 'payment', procesable: true, id: '999999999', userId: '44444' });
  const deQuery = notificacionMp({ query: query({ 'data.id': '999999999', type: 'payment' }), cuerpo: { ...notif('payment', '1'), data: {} } });
  assert.equal(deQuery.ok && deQuery.id, '999999999');
  // El del query gana: es el que entra en el manifiesto que MP firma.
  const ambos = notificacionMp({ query: query({ 'data.id': '222' }), cuerpo: notif('payment', '111') });
  assert.equal(ambos.ok && ambos.id, '222');
});

test('MP: el user_id sale del cuerpo o del ?u= de la notification_url', () => {
  const sinUser = { ...notif('payment', '5'), user_id: undefined };
  const u = notificacionMp({ query: query({ u: '777' }), cuerpo: sinUser });
  assert.equal(u.ok && u.userId, '777');
  const nada = notificacionMp({ query: query({}), cuerpo: sinUser });
  assert.equal(nada.ok && nada.userId, null);
  const roto = notificacionMp({ query: query({ u: '77a' }), cuerpo: sinUser });
  assert.equal(roto.ok && roto.userId, null, 'un user_id que no es numérico no rutea');
});

test('MP subscription_preapproval y subscription_authorized_payment (y sus nombres viejos)', () => {
  const pre = notificacionMp({ query: query({}), cuerpo: notif('subscription_preapproval', '2c938084726fca480172750000000000') });
  assert.equal(pre.ok && pre.tipo, 'subscription_preapproval');
  assert.equal(pre.ok && pre.procesable, true);
  const cuota = notificacionMp({ query: query({}), cuerpo: notif('subscription_authorized_payment', '6114264375') });
  assert.equal(cuota.ok && cuota.tipo, 'subscription_authorized_payment');
  assert.equal(notificacionMp({ query: query({ topic: 'preapproval', id: 'abc123' }), cuerpo: null }).ok && 'ok', 'ok');
  const viejo = notificacionMp({ query: query({ topic: 'authorized_payment', id: '61' }), cuerpo: null });
  assert.equal(viejo.ok && viejo.tipo, 'subscription_authorized_payment');
  // Un id de cuota alfanumérico no es una cuota (los de pago y cuota son numéricos).
  assert.equal(notificacionMp({ query: query({}), cuerpo: notif('subscription_authorized_payment', 'abc') }).ok, false);
});

test('MP IPN viejo ?topic=&id=: se lee, y queda marcado como IPN (su firma no se puede validar)', () => {
  const ipn = notificacionMp({ query: query({ topic: 'payment', id: '123456789', u: '44444' }), cuerpo: null });
  assert.deepEqual(ipn, { ok: true, formato: 'ipn', tipo: 'payment', procesable: true, id: '123456789', userId: '44444' });
  const mo = notificacionMp({ query: query({ topic: 'merchant_order', id: '987' }), cuerpo: null });
  assert.equal(mo.ok && mo.procesable, false, 'merchant_order no lo procesa MaKo');
});

test('MP: lo que no trae tipo e id, o un id de 20 KB, no pasa', () => {
  assert.equal(notificacionMp({ query: query({}), cuerpo: {} }).ok, false);
  assert.equal(notificacionMp({ query: query({}), cuerpo: notif('payment', '1'.repeat(30)) }).ok, false);
  assert.equal(notificacionMp({ query: query({}), cuerpo: notif('payment', '12; drop') }).ok, false);
});

test('MP: la clave de dedup es <tipo>:<id>:<estado resultante>', () => {
  assert.equal(claveEventoMp('payment', '999', 'approved'), 'payment:999:approved');
  assert.notEqual(claveEventoMp('payment', '999', 'approved'), claveEventoMp('payment', '999', 'refunded'), 'el reembolso del mismo pago chocaría con su aprobación');
  assert.ok(claveEventoMp('x', 'y'.repeat(300), 'z').length <= 200);
});

test('MP: el pago releído decide la acción', () => {
  assert.deepEqual(planDePagoMp({ estado: 'approved', detalle: 'accredited', reembolsado: 0 }), { accion: 'aprobado', estadoResultante: 'approved', reembolsoParcial: false });
  const parcial = planDePagoMp({ estado: 'approved', detalle: 'partially_refunded', reembolsado: 5 });
  assert.equal(parcial.accion, 'aprobado', 'un aprobado con devolución parcial igual registra el pago (por si el aviso del aprobado se perdió)');
  assert.equal(parcial.accion === 'aprobado' && parcial.reembolsoParcial, true);
  assert.notEqual(parcial.estadoResultante, 'approved', 'la devolución parcial chocaría con la aprobación y no quedaría en el historial');
  assert.deepEqual(planDePagoMp({ estado: 'refunded', detalle: 'refunded', reembolsado: 49 }), { accion: 'reembolso', estadoResultante: 'refunded', total: true });
  const rech = planDePagoMp({ estado: 'rejected', detalle: 'cc_rejected_insufficient_amount', reembolsado: 0 });
  assert.equal(rech.accion, 'fallido');
  assert.equal(rech.accion === 'fallido' && rech.motivo, 'La tarjeta no tiene fondos suficientes.');
  assert.equal(planDePagoMp({ estado: 'pending', detalle: 'pending_waiting_payment', reembolsado: 0 }).accion, 'ignorar');
  assert.equal(planDePagoMp({ estado: 'charged_back', detalle: 'settled', reembolsado: 0 }).accion, 'ignorar', 'un contracargo no se aplica solo');
  assert.equal(motivoRechazoMp('cc_rejected_bad_filled_security_code'), 'Los datos de la tarjeta estaban mal.');
  assert.equal(suscripcionMpCancelada('cancelled'), true);
  assert.equal(suscripcionMpCancelada('canceled'), true);
  assert.equal(suscripcionMpCancelada('authorized'), false);
  assert.deepEqual(buscarDePagoMp({ id: '9', referencia: TOKEN, preapprovalId: 'pre1' }), { token: TOKEN, ref: 'pre1', suscripcionId: 'pre1', pagoId: '9' });
  assert.equal(buscarDePagoMp({ id: '9', referencia: 'ws13_lead987', preapprovalId: null }).token, null, 'una referencia que no es un token de MaKo no busca nada');
});

// ── Lo que se guarda y el tiempo ──────────────────────────────────────────────

test('el motivo que se guarda no lleva datos personales ni claves, y topea en 300', () => {
  const m = motivoSinDatos('duplicate key (email)=(quien@ejemplo.com) tel +52 664 123 4567 Invalid API Key provided: sk_live_****abcd APP_USR-1234-abcd');
  assert.ok(!m.includes('quien@ejemplo.com'), m);
  assert.ok(!m.includes('664 123 4567'), m);
  assert.ok(!m.includes('sk_live'), m);
  assert.ok(!m.includes('APP_USR-1234'), m);
  assert.equal(motivoSinDatos('x'.repeat(500)).length, 300);
  assert.equal(motivoSinDatos('Stripe 404 releyendo la sesión de pago: No such checkout.session'), 'Stripe 404 releyendo la sesión de pago: No such checkout.session');
});

test('el presupuesto de tiempo: lo rápido contesta, lo lento sigue, y un error tardío no queda suelto', async () => {
  assert.deepEqual(await conPresupuesto(Promise.resolve(7), 50), { listo: true, valor: 7 });
  await assert.rejects(conPresupuesto(Promise.reject(new Error('base caída')), 50), /base caída/);
  let soltar!: (v: number) => void;
  const lento = new Promise<number>((r) => { soltar = r; });
  assert.deepEqual(await conPresupuesto(lento, 5), { listo: false });
  soltar(3);
  assert.equal(await lento, 3, 'el trabajo siguió después del tope');
  // Un rechazo DESPUÉS del tope no es un unhandledRejection (lo maneja quien lo siguió en after()).
  const tardio = new Promise<number>((_, rej) => setTimeout(() => rej(new Error('tarde')), 10));
  assert.deepEqual(await conPresupuesto(tardio, 1), { listo: false });
  await assert.rejects(tardio, /tarde/);
});

// ── Las roturas (11/10/2026) ───────────────────────────────────────────────────
// Una por vez sobre lib/cobros-eventos.ts, restaurando de memoria (un script que guarda el texto y lo
// vuelve a escribir, nunca git). Sin romper: 24 pasan / 0 fallan. Cada rotura → 23 / 1:
//   · la sesión de una suscripción con el id de la SUSCRIPCIÓN y no el de su factura (duplicaría la
//     primera cuota) → «la sesión releída…»
//   · `checkout.session.completed` unpaid sin su rama propia → «… SIN PAGAR»
//   · la devolución parcial de MP con la clave del aprobado → «MP: el pago releído…»
//   · el contracargo de MP aplicado como reembolso → «MP: el pago releído…»
//   · el `data.id` del cuerpo antes que el del query → «MP payment: data.id…»
//   · el motivo sin tapar el email → «el motivo que se guarda…»
//   · el `?acct=` sin tope de largo → «Stripe: el ?acct=…»
//   · `mismoModo` que no mira el livemode → «modo y pertenencia…»
