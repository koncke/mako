// =============================================================================
// El cuerpo form-urlencoded de Stripe (lib/stripe-form.ts), contra los ejemplos curl oficiales
// =============================================================================
// Stripe NO recibe JSON: recibe `application/x-www-form-urlencoded` con los objetos y las listas
// aplanados (`line_items[0][price_data][currency]=usd`, `enabled_events[]=…`, `metadata[x]=…`). Un
// `JSON.stringify` o un `URLSearchParams(obj)` pelado mandan `[object Object]`, y Stripe contesta
// un 400 que culpa al PARÁMETRO, no al formato. Los esperados de acá son los cuerpos de los
// ejemplos curl de docs.stripe.com (checkout/sessions, webhook_endpoints, metadata), copiados en
// relev/apis.md el 11/10/2026: si `formStripe` cambia de forma, el test lo compara contra lo que
// manda la doc y no contra sí mismo.
//
// Probado ROMPIÉNDOLO (11/10/2026), una rotura por vez sobre la base en verde y restaurando de
// memoria (un script que guarda el texto y lo repone, nunca git). Con el código como está:
// 5 pases, 0 fallos. Rota (pases / fallos):
//   · las listas de escalares con índice (`enabled_events[0]=`)                   → 4 / 1
//   · los corchetes de la clave codificados (`%5B`/`%5D`)                          → 2 / 3
//   · `null` mandado como texto (sin omitirlo)                                     → 4 / 1
//   · los booleanos como `1`/`0`                                                   → 4 / 1
// Correr: node --import tsx --test tests/stripe-form.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formStripe } from '../lib/stripe-form';

test('el ejemplo de POST /v1/checkout/sessions (relev/apis.md), byte por byte', () => {
  const esperado =
    'mode=payment&line_items[0][quantity]=1&line_items[0][price_data][currency]=usd' +
    '&line_items[0][price_data][unit_amount]=4900&line_items[0][price_data][product_data][name]=Plan%20MaKo' +
    '&customer_email=a%40b.com&client_reference_id=ws13_lead_987&metadata[ws]=13&metadata[lead]=987' +
    '&success_url=https%3A%2F%2Fapp%2Fok%3Fs%3D%7BCHECKOUT_SESSION_ID%7D&expires_at=1760300000';
  const cuerpo = formStripe({
    mode: 'payment',
    line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: 4900, product_data: { name: 'Plan MaKo' } } }],
    customer_email: 'a@b.com',
    client_reference_id: 'ws13_lead_987',
    metadata: { ws: '13', lead: '987' },
    success_url: 'https://app/ok?s={CHECKOUT_SESSION_ID}',
    expires_at: 1760300000,
  });
  assert.equal(cuerpo, esperado);
  // Y lo que leería Stripe de ese cuerpo: las claves anidadas, no un [object Object].
  const leido = new URLSearchParams(cuerpo);
  assert.equal(leido.get('line_items[0][price_data][product_data][name]'), 'Plan MaKo');
  assert.ok(!cuerpo.includes('object'), 'se coló un [object Object]');
});

test('el ejemplo de POST /v1/webhook_endpoints: una lista de escalares va como `enabled_events[]=`', () => {
  // docs.stripe.com/api/webhook_endpoints/create:
  //   -d "enabled_events[]"=charge.succeeded -d "enabled_events[]"=charge.failed --data-urlencode url=…
  const cuerpo = formStripe({ enabled_events: ['charge.succeeded', 'charge.failed'], url: 'https://example.com/my/webhook/endpoint' });
  assert.equal(cuerpo, 'enabled_events[]=charge.succeeded&enabled_events[]=charge.failed&url=https%3A%2F%2Fexample.com%2Fmy%2Fwebhook%2Fendpoint');
  assert.deepEqual(new URLSearchParams(cuerpo).getAll('enabled_events[]'), ['charge.succeeded', 'charge.failed']);
  // Una lista de OBJETOS sí lleva índice (line_items[0], line_items[1]).
  assert.equal(formStripe({ line_items: [{ quantity: 1 }, { quantity: 2 }] }), 'line_items[0][quantity]=1&line_items[1][quantity]=2');
});

test('el ejemplo de metadata: `metadata[order_id]=6735`, y los corchetes de un VALOR sí se codifican', () => {
  // docs.stripe.com/api/metadata: -d "metadata[order_id]"=6735
  assert.equal(formStripe({ metadata: { order_id: '6735' } }), 'metadata[order_id]=6735');
  // Sólo los corchetes de la CLAVE quedan crudos: los del valor viajan codificados.
  assert.equal(formStripe({ metadata: { nota: '[x] & y=z' } }), 'metadata[nota]=%5Bx%5D%20%26%20y%3Dz');
});

test('null y undefined se OMITEN (no viajan como «null»), y el 0 sí viaja', () => {
  assert.equal(formStripe({ a: null, b: undefined, c: 'x', d: { e: null, f: undefined }, g: 0 }), 'c=x&g=0');
  assert.equal(formStripe({ customer_email: null, expand: [] }), '');
});

test('los booleanos van como `true`/`false`', () => {
  assert.equal(formStripe({ allow_promotion_codes: true, livemode: false }), 'allow_promotion_codes=true&livemode=false');
});
