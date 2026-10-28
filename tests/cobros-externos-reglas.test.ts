// =============================================================================
// La venta de un Payment Link PROPIO: qué sesión lo es, cómo se lee y qué cobro deja (27/10/2026, MAU-10)
// =============================================================================
// Mauricio vende el Sprint con un Payment Link de SU Stripe y la venta se ignoraba («no es un cobro de MaKo»). Ahora entra como un
// cobro externo ya pagado. Las reglas son puras (lib/cobros-externos-reglas.ts): acá, con una sesión con la forma que devuelve
// `GET /v1/checkout/sessions/:id?expand[]=line_items`. El diseño: docs/diseno-venta-externa-stripe.md.
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  esCobroExterno, esVentaExterna, filaDeVentaExterna, lineaCompraEnMeta, MOTIVO_APAGADO, sesionExternaDe, ventasExternasPrendidas,
  type SesionExterna,
} from '../lib/cobros-externos-reglas';
import { planLeadAuto, AUTO_UMBRALES, type AutoLead } from '../lib/crm-auto-plan';

/** Una sesión pagada de un Payment Link, como la manda Stripe (los montos en centavos). */
const CRUDA = {
  id: 'cs_live_a1B2c3D4e5F6', object: 'checkout.session', livemode: true, status: 'complete', payment_status: 'paid',
  payment_link: 'plink_1Sprint', payment_intent: 'pi_3Abc', subscription: null, invoice: null,
  amount_total: 27000, currency: 'usd', metadata: {},
  customer_details: { email: 'Comprador@Ejemplo.com', phone: '+5491112345678', name: 'Ana Pérez' },
  line_items: { object: 'list', data: [{ description: 'Sprint 3 días', amount_total: 27000, price: { unit_amount: 27000, currency: 'usd', recurring: null } }] },
};
const S = sesionExternaDe(CRUDA);
const QUIEN = { cuenta: 'principal', ref: 'acct_1Mau' };

test('la sesión se lee con el monto en su moneda, el comprador y el ítem con su precio de lista', () => {
  assert.equal(S.id, 'cs_live_a1B2c3D4e5F6');
  assert.equal(S.modo, 'real');
  assert.deepEqual([S.monto, S.moneda, S.montoUsd], [270, 'USD', 270]);
  assert.deepEqual([S.email, S.telefono, S.nombre], ['comprador@ejemplo.com', '+5491112345678', 'Ana Pérez']);
  assert.deepEqual(S.item, { nombre: 'Sprint 3 días', montoLista: 270, monedaLista: 'USD', recurrente: false });
  assert.equal(S.paymentLink, 'plink_1Sprint');
  // Pagó en pesos mexicanos un link en dólares (Stripe convirtió): el USD sale del origen, nunca del precio del producto.
  const mx = sesionExternaDe({ ...CRUDA, amount_total: 486000, currency: 'mxn', currency_conversion: { amount_total: 27000, source_currency: 'usd', fx_rate: '18' } });
  assert.deepEqual([mx.monto, mx.moneda, mx.montoUsd], [4860, 'MXN', 270]);
  // Otra moneda sin conversión: sin USD (no se inventa una tasa).
  assert.equal(sesionExternaDe({ ...CRUDA, currency: 'jpy', amount_total: 5000 }).montoUsd, null);
  assert.equal(sesionExternaDe({ ...CRUDA, currency: 'jpy', amount_total: 5000 }).monto, 5000, 'el yen no tiene centavos');
  // Sin ítems (no se pidió el expand): sin concepto inventado.
  assert.equal(sesionExternaDe({ ...CRUDA, line_items: undefined }).item, null);
});

const base = { esPlataforma: false, prendido: true, s: S, livemodeEvento: true as boolean | null };
const motivo = (p: Partial<typeof base> & { s?: SesionExterna }) => {
  const r = esVentaExterna({ ...base, ...p });
  return r.ok ? null : r.motivo;
};

test('es una venta externa sólo con las cinco condiciones; apagar cualquiera la saca', () => {
  assert.equal(motivo({}), null);
  assert.match(motivo({ esPlataforma: true })!, /cuenta de MaKo/);
  assert.match(motivo({ s: { ...S, metadata: { mako_cobro: 'x' } } })!, /checkout de MaKo/);
  assert.match(motivo({ s: { ...S, metadata: { mako: '1' } } })!, /checkout de MaKo/);
  assert.equal(motivo({ s: { ...S, paymentLink: null } }), 'no es un cobro de MaKo');
  assert.match(motivo({ s: { ...S, pagoEstado: 'unpaid' } })!, /no está pagada/);
  assert.match(motivo({ s: { ...S, estado: 'open' } })!, /no está pagada/);
  assert.match(motivo({ livemodeEvento: false })!, /modo del aviso/);
  assert.match(motivo({ livemodeEvento: null })!, /modo del aviso/);
  assert.equal(motivo({ prendido: false }), MOTIVO_APAGADO);
  // El apagado va ÚLTIMO: con otra razón, gana la otra (el webhook avisa la compra sólo cuando es una venta y está apagado).
  assert.match(motivo({ prendido: false, esPlataforma: true })!, /cuenta de MaKo/);
  assert.equal(ventasExternasPrendidas('1'), true);
  for (const v of [null, '', '0', 'true', 'si']) assert.equal(ventasExternasPrendidas(v), false, String(v));
});

test('la fila: ya pagada, marcada externa, con el pago correcto y SIN la cuenta principal escrita', () => {
  const r = filaDeVentaExterna(S, QUIEN, '2026-10-27T18:00:00.000Z');
  assert.ok(r.ok);
  const f = r.fila;
  assert.deepEqual([f.estado, f.tipo, f.proveedor_ref, f.proveedor_pago_id, f.proveedor_suscripcion_id], ['pagado', 'unico', 'cs_live_a1B2c3D4e5F6', 'pi_3Abc', null]);
  assert.deepEqual([f.monto, f.moneda, f.monto_usd, f.concepto], [270, 'USD', 270, 'Sprint 3 días']);
  assert.equal(f.creado_por, 'externo:stripe:plink_1Sprint');
  assert.ok(esCobroExterno(f));
  assert.ok(!esCobroExterno({ creado_por: 'empezar-ya:12' }) && !esCobroExterno({ creado_por: null }));
  // ⚠️ 'principal' viola cobros_cuenta_check (0328): no se escribe. Otra cuenta, sí.
  assert.ok(!('cuenta' in f));
  assert.equal(f.cuenta_ref, 'acct_1Mau');
  const c2 = filaDeVentaExterna(S, { cuenta: 'c2', ref: 'acct_2' }, '2026-10-27T18:00:00.000Z');
  assert.ok(c2.ok && c2.fila.cuenta === 'c2');
});

test('una suscripción va con su factura y su sub_; sin factura, sin monto o en cero, no se registra', () => {
  const sus = filaDeVentaExterna({ ...S, subscription: 'sub_1', invoice: 'in_1', paymentIntent: null }, QUIEN, 'x');
  assert.ok(sus.ok);
  assert.deepEqual([sus.fila.tipo, sus.fila.proveedor_pago_id, sus.fila.proveedor_suscripcion_id, sus.fila.suscripcion_estado], ['suscripcion', 'in_1', 'sub_1', 'activa']);
  const sinFactura = filaDeVentaExterna({ ...S, subscription: 'sub_1', invoice: null }, QUIEN, 'x');
  assert.ok(!sinFactura.ok && /no trae factura/.test(sinFactura.motivo));
  for (const m of [0, null]) assert.ok(!filaDeVentaExterna({ ...S, monto: m }, QUIEN, 'x').ok);
  assert.ok(!filaDeVentaExterna({ ...S, moneda: 'usd' }, QUIEN, 'x').ok, 'la moneda va en mayúsculas (cobros_moneda)');
  const largo = filaDeVentaExterna({ ...S, item: { nombre: 'x'.repeat(300), montoLista: 1, monedaLista: 'USD', recurrente: false } }, QUIEN, 'x');
  assert.ok(largo.ok && largo.fila.concepto.length === 200);
});

test('la marca de la compra en Meta es fija y lleva el id del evento', () => {
  assert.equal(lineaCompraEnMeta('purchase:cs_live_x'), 'Meta recibió la compra (purchase:cs_live_x)');
});

test('T2 no le escribe «no agendaste» a quien ya pagó', () => {
  const HOY = '2026-07-05';
  const NOW = Date.parse('2026-07-05T20:00:00Z');
  const lead = (p: Partial<AutoLead>): AutoLead => ({
    id: 1, nombre: 'Comprador', estado_lead: 'abierto', pipeline_stage: 'lead', fecha_agenda: null, fecha_junta_1: null, fecha_junta_2: null,
    junta_1_at: null, junta_2_at: null, asistio_j1: null, asistio_j2: null, nutricion_realizada: false, nutricion_manual_deadline: null,
    created_at: new Date(Date.UTC(2026, 6, 5) - (AUTO_UMBRALES.diasLeadSinAgenda + 1) * 86400000).toISOString(), updated_at: null, ...p,
  });
  assert.deepEqual(planLeadAuto(lead({ total_cobrado_usd: 0 }), HOY, NOW).map((a) => a.regla), ['T2']);
  assert.deepEqual(planLeadAuto(lead({ total_cobrado_usd: null }), HOY, NOW).map((a) => a.regla), ['T2']);
  assert.deepEqual(planLeadAuto(lead({ total_cobrado_usd: 270 }), HOY, NOW).map((a) => a.regla), []);
});
