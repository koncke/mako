// =============================================================================
// La venta de un Payment Link propio le avisa la COMPRA a Meta (27/10/2026, MAU-10)
// =============================================================================
// Mauricio vende el Sprint con un Payment Link de SU Stripe. El webhook de Stripe ignoraba esa venta («no es un cobro de MaKo») y a
// Meta no le llegaba ninguna compra. Ahora, si la sesión releída está pagada y vino de un link, sale el Purchase por CAPI con el id de
// la sesión de Stripe como `event_id`: el mismo que puede mandar el navegador en la página de gracias, así Meta cuenta UNA compra.
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compraDeLaSesion, eventIdCompra, EVENTO_COMPRA } from '../lib/meta-capi-payload';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sesion = { id: 'cs_test_123', pagoEstado: 'paid', paymentLink: 'plink_1', monto: 297, moneda: 'USD', email: 'a@b.com', telefono: '+5491100000000', modo: 'real' as const };

test('una sesión pagada de un Payment Link es una compra, con el id de la sesión como event_id', () => {
  assert.equal(EVENTO_COMPRA, 'Purchase');
  assert.equal(eventIdCompra('cs_test_123'), 'purchase:cs_test_123');
  assert.deepEqual(compraDeLaSesion(sesion), { eventId: 'purchase:cs_test_123', value: 297, currency: 'USD', email: 'a@b.com', phone: '+5491100000000' });
});

test('no es una compra para avisar: sin pagar, sin link, o sin monto o moneda', () => {
  assert.equal(compraDeLaSesion({ ...sesion, pagoEstado: 'unpaid' }), null);
  assert.equal(compraDeLaSesion({ ...sesion, paymentLink: null }), null);
  assert.equal(compraDeLaSesion({ ...sesion, monto: null }), null);
  assert.equal(compraDeLaSesion({ ...sesion, monto: 0 }), null);
  assert.equal(compraDeLaSesion({ ...sesion, moneda: null }), null);
  // Una venta de prueba no entra al píxel como una compra de verdad.
  assert.equal(compraDeLaSesion({ ...sesion, modo: 'prueba' }), null);
  assert.equal(compraDeLaSesion({ ...sesion, modo: undefined }), null);
});

test('el webhook manda el Purchase SÓLO para la venta que no es de MaKo, y con lo releído de Stripe', () => {
  const w = leer('../lib/cobros-webhook.ts');
  const rama = w.slice(w.indexOf("if (objeto === 'checkout') {"), w.indexOf("if (objeto === 'factura') {"));
  // Antes de devolver «ignorado», y sólo cuando el aviso no es de ningún cobro de MaKo (desde la pieza 1: `noEsDeMako`).
  assert.ok(rama.indexOf('b.noEsDeMako') > 0 && rama.indexOf('b.noEsDeMako') < rama.indexOf("if ('ignorar' in b) return b.ignorar;"));
  const v = w.slice(w.indexOf('async function ventaExternaStripe('), w.indexOf('async function avisarCompraAMeta('));
  const iRelee = v.indexOf('leerCheckoutExternoStripe(key, sesionId)');
  assert.ok(iRelee > 0 && iRelee < v.indexOf('compraDeLaSesion(s)'), 'el Purchase sale de la sesión RELEÍDA, no del evento');
  const f = w.slice(w.indexOf('async function avisarCompraAMeta('), w.indexOf('export async function procesarEventoStripe('));
  assert.match(f, /eventName: EVENTO_COMPRA[\s\S]*eventId: compra\.eventId[\s\S]*customData: \{ value: compra\.value, currency: compra\.currency \}/);
  // Al píxel del sitio, nunca al conjunto de datos de CRM, y como evento de la página (deduplica con el del navegador).
  assert.match(f, /soloPixel: true, actionSource: 'website',/);
  const capi = leer('../lib/meta-capi.ts');
  assert.match(capi, /destinoCAPI\(soloPixel \? null : await credWs\('META_CRM_DATASET_ID'\), await credWs\('META_PIXEL_ID'\)\)/);
  // La relectura trae el link y el teléfono.
  const s = leer('../lib/stripe-api.ts');
  assert.match(s, /paymentLink: idDe\(b\.payment_link\),/);
  assert.match(s, /telefono: str\(obj\(b\.customer_details\)\.phone\),/);
});
