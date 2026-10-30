// =============================================================================
// La prueba gratis de MaKo por Stripe y la venta por un Payment Link propio no se cruzan (28/10/2026)
// =============================================================================
// Las dos llegan al MISMO webhook de Stripe con `checkout.session.completed` y después con `invoice.paid`, y las dos son plata:
//   · la prueba de un plan de MaKo (lib/cobros.ts, `pruebaAutorizadaStripe`): checkout `no_payment_required` con la metadata de
//     MaKo; el día 8 cobra una factura de la suscripción;
//   · la venta de un link armado en el Stripe del negocio (MAU-10, `ventaExternaStripe` en lib/cobros-webhook.ts): checkout
//     pagado, de un Payment Link, sin metadata de MaKo; entra como un cobro externo (`creado_por = externo:stripe:<link>`).
// Si la prueba entrara por la venta externa, sería un cobro duplicado (y un lead nuevo) en el negocio; si una venta externa se
// tomara por la prueba de un plan, el cron le buscaría facturas y la activaría como un plan de MaKo. Lo que se cuida:
//   · el checkout de una prueba se IGNORA en el aviso (no llega a la rama del checkout), y aunque llegara, no es venta externa;
//   · el `invoice.paid` del día 8 va por la rama de FACTURAS (la venta externa sólo tiene puerta en la de checkout:
//     tests/venta-externa-no-toca-mako.test.ts), buscando el cobro de MaKo por su metadata;
//   · un cobro externo nunca es «la prueba de un plan» y una prueba nunca es «externa».
//
// Probado rompiéndolo (28/10/2026): al pie del archivo.
// Correr: node --import tsx --test tests/prueba-stripe-no-es-venta-externa.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avisoStripe, eventoStripe } from '../lib/cobros-eventos';
import { esCobroExterno, esVentaExterna, filaDeVentaExterna, PREFIJO_EXTERNO, sesionExternaDe } from '../lib/cobros-externos-reglas';
import { esPruebaDePlan } from '../lib/prueba-plan-reglas';

const TOKEN = 'TokenDelCobroDeMaKo0123456789abc';
const evento = (type: string, object: Record<string, unknown>, livemode = false) => ({
  id: 'evt_1NG8Du2eZvKYlo2CUI79vXWy', object: 'event', api_version: '2026-09-30.endive', created: 1761600000,
  data: { object }, livemode, pending_webhooks: 1, request: { id: null, idempotency_key: null }, type,
});
const aviso = (type: string, object: Record<string, unknown>) => {
  const ev = eventoStripe(evento(type, object));
  assert.ok(ev, `${type}: no se leyó el sobre del evento`);
  return avisoStripe(ev!);
};

/** El checkout de la prueba de un plan de MaKo, como lo deja Stripe al completarlo: la tarjeta cargada, nada cobrado. */
const checkoutDePrueba = (extra: Record<string, unknown> = {}) => ({
  id: 'cs_test_prueba', object: 'checkout.session', mode: 'subscription', status: 'complete', payment_status: 'no_payment_required',
  amount_total: 0, currency: 'usd', client_reference_id: TOKEN, customer_email: 'ana@mx.com', customer_details: { email: 'ana@mx.com' },
  metadata: { mako_cobro: TOKEN, mako_ws: '9', mako_cobro_id: '7' }, payment_intent: null, subscription: 'sub_prueba',
  invoice: 'in_cero', payment_link: null, livemode: false, ...extra,
});

/** La venta de un Payment Link propio del negocio: pagada, sin metadata de MaKo. */
const checkoutExterno = (extra: Record<string, unknown> = {}) => ({
  id: 'cs_test_link', object: 'checkout.session', mode: 'subscription', status: 'complete', payment_status: 'paid',
  amount_total: 9700, currency: 'usd', client_reference_id: null, customer_email: null,
  customer_details: { email: 'juan@ejemplo.com', name: 'Juan', phone: null }, metadata: {}, payment_intent: null,
  subscription: 'sub_link', invoice: 'in_link', payment_link: 'plink_1AbC', livemode: false, ...extra,
});

test('el checkout de una prueba de MaKo se ignora en el aviso, y aunque llegara a la rama del checkout no es una venta externa', () => {
  assert.equal(aviso('checkout.session.completed', checkoutDePrueba()).accion, 'ignorar', 'no hay plata que asentar: entra por la activación');
  const s = sesionExternaDe(checkoutDePrueba());
  const d = esVentaExterna({ esPlataforma: false, prendido: true, s, livemodeEvento: false });
  assert.ok(!d.ok, 'una prueba no se registra como venta externa');
  // Aunque viniera de un Payment Link, la metadata de MaKo la frena primero.
  assert.ok(!esVentaExterna({ esPlataforma: false, prendido: true, s: sesionExternaDe(checkoutDePrueba({ payment_link: 'plink_x', payment_status: 'paid' })), livemodeEvento: false }).ok);
  // La venta externa de verdad sí pasa (el control: el test no da verde por un filtro que rechaza todo).
  assert.deepEqual(esVentaExterna({ esPlataforma: false, prendido: true, s: sesionExternaDe(checkoutExterno()), livemodeEvento: false }), { ok: true });
});

test('el invoice.paid del día 8 de una prueba va por la rama de FACTURAS, buscando el cobro de MaKo por su metadata', () => {
  const dia8 = {
    id: 'in_dia8', object: 'invoice', amount_due: 9700, amount_paid: 9700, amount_remaining: 0, billing_reason: 'subscription_cycle',
    currency: 'usd', customer_email: 'ana@mx.com', livemode: false, status: 'paid',
    parent: { type: 'subscription_details', subscription_details: { metadata: { mako_cobro: TOKEN }, subscription: 'sub_prueba' } },
  };
  const a = aviso('invoice.paid', dia8);
  assert.equal(a.accion, 'aprobado');
  assert.ok(a.accion === 'aprobado');
  assert.deepEqual(a.leer, { objeto: 'factura', id: 'in_dia8' }, 'la factura, nunca la sesión (la de la venta externa)');
  assert.deepEqual(a.buscar, { token: TOKEN, suscripcionId: 'sub_prueba' }, 'el cobro de MaKo, por su token');
});

test('un cobro externo nunca es «la prueba de un plan», y la prueba de un plan nunca es «externa»', () => {
  const f = filaDeVentaExterna(sesionExternaDe(checkoutExterno()), { cuenta: 'principal', ref: null }, '2026-10-28T12:00:00.000Z');
  assert.ok(f.ok);
  assert.ok(f.fila.creado_por.startsWith(PREFIJO_EXTERNO));
  assert.equal(esCobroExterno(f.fila), true);
  assert.equal(esPruebaDePlan({ ...f.fila, alta_capa: null }), false, 'el cron no le busca facturas de prueba ni la activa como un plan');
  const prueba = { tipo: 'suscripcion', alta_capa: 'pro', creado_por: 'planes:pro:prueba' };
  assert.equal(esPruebaDePlan(prueba), true);
  assert.equal(esCobroExterno(prueba), false, 'la puerta de la venta externa no la toma por un cobro a medias');
});

// Probado rompiéndolo (28/10/2026), una rotura por vez sobre la base en verde (3 pases, 0 fallos), restaurando el archivo
// desde una copia (nunca git). Rota (pases / fallos):
//   · `esVentaExterna` sin el corte por la metadata de MaKo                             → 2 / 1
//   · el aviso aprueba el checkout `no_payment_required`                                → 2 / 1
//   · `esCobroExterno` que acepta cualquier `creado_por` de Stripe («planes:»)          → 2 / 1
