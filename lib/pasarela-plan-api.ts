// =============================================================================
// pasarela-plan-api — lo que la suscripción de MaKo le pide a Stripe y a Mercado Pago (además de cobrar)
// =============================================================================
// La deuda (¿la renovación se cobró de verdad?, ¿qué factura está abierta para pagarla?) y la retención (un descuento
// antes de darse de baja). Usa el mismo `llamar` de lib/stripe-api.ts y lib/mercadopago-api.ts: la misma versión fijada
// de Stripe y los mismos errores sin datos. Cada función RECIBE la clave: no la lee sola.
//
// Lo que muerde (docs.stripe.com, mercadopago.com.ar/developers; verificado el 23/10/2026):
//   · Stripe: con la renovación rechazada la suscripción pasa a `past_due` y Smart Retries la reintenta (por defecto 8
//     veces en 2 semanas); después queda como diga el panel (cancelada, `unpaid` o `past_due`). La factura abierta se
//     paga en su `hosted_invoice_url` (una página de Stripe que acepta otra tarjeta).
//   · Stripe: un cupón `repeating` con `duration_in_months` vuelve solo al precio de lista: no hay que acordarse.
//   · Mercado Pago: cada cuota rechazada se reintenta hasta 4 veces en 10 días; con 3 cuotas rechazadas la suscripción se
//     da de baja sola. El monto de una suscripción se cambia con PUT /preapproval/{id} (`auto_recurring.transaction_amount`),
//     y vale para las cuotas que vienen. ⚠️ No está medido con una cuenta real (las claves de prueba de Martín).
// =============================================================================

import 'server-only';
import { llamar as llamarStripe } from './stripe-api';
import { llamar as llamarMp } from './mercadopago-api';
import { aUnidadMinima, deUnidadMinima } from './pasarela-moneda';

type Json = Record<string, unknown>;
type R<T> = ({ ok: true } & T) | { ok: false; status: number; error: string };
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {});
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : null);
const fallo = <T>(x: { status: number; error: string }): R<T> => ({ ok: false, status: x.status, error: x.error });
const fecha = (seg: unknown): string | null => (Number(seg) > 0 ? new Date(Number(seg) * 1000).toISOString() : null);
const SUB_RE = /^sub_[A-Za-z0-9]{6,}$/;

export type SuscripcionStripe = { id: string; estado: string | null; periodoFin: string | null; cliente: string | null; motivoBaja: string | null };

/** GET /v1/subscriptions/{id}: el estado (active, past_due, unpaid, canceled…), el fin del período y el cliente. */
export async function suscripcionStripe(key: string, id: string): Promise<R<SuscripcionStripe>> {
  if (!SUB_RE.test(id)) return { ok: false, status: 400, error: 'id de suscripción inválido' };
  const r = await llamarStripe(key, 'GET', `/v1/subscriptions/${encodeURIComponent(id)}`);
  if (!r.ok) return fallo(r);
  const b = r.body;
  // Desde basil el período vive en cada ítem; antes, en la suscripción. Se lee de los dos lados.
  const item = obj((Array.isArray(obj(b.items).data) ? (obj(b.items).data as unknown[]) : [])[0]);
  return {
    ok: true, id: str(b.id) ?? id, estado: str(b.status),
    periodoFin: fecha(item.current_period_end ?? b.current_period_end),
    cliente: str(b.customer), motivoBaja: str(obj(b.cancellation_details).reason),
  };
}

export type FacturaDePlan = { id: string; estado: string | null; monto: number | null; moneda: string | null; motivo: string | null; pagadaAt: string | null; urlPagar: string | null };

/** Las facturas de una suscripción con ese estado (`paid` u `open`), las más nuevas primero (hasta 24). */
export async function facturasStripe(key: string, subId: string, estado: 'paid' | 'open'): Promise<R<{ facturas: FacturaDePlan[] }>> {
  if (!SUB_RE.test(subId)) return { ok: false, status: 400, error: 'id de suscripción inválido' };
  const r = await llamarStripe(key, 'GET', '/v1/invoices', { subscription: subId, status: estado, limit: 24 });
  if (!r.ok) return fallo(r);
  const facturas = (Array.isArray(r.body.data) ? (r.body.data as unknown[]) : []).map(obj).map((f): FacturaDePlan => {
    const moneda = str(f.currency)?.toUpperCase() ?? null;
    const cuanto = Number(estado === 'paid' ? f.amount_paid : f.amount_due);
    return {
      id: str(f.id) ?? '', estado: str(f.status), moneda,
      monto: moneda && Number.isFinite(cuanto) ? deUnidadMinima(cuanto, moneda) : null,
      motivo: str(f.billing_reason), pagadaAt: fecha(obj(f.status_transitions).paid_at), urlPagar: str(f.hosted_invoice_url),
    };
  }).filter((f) => f.id.startsWith('in_'));
  return { ok: true, facturas };
}

/**
 * LA RETENCIÓN EN STRIPE: un cupón de `pct`% por `meses` meses y aplicarlo a la suscripción. El cupón se crea con
 * clave de idempotencia (dos clics no crean dos) y vuelve solo al precio de lista al terminar (`repeating`).
 */
export async function descuentoStripe(key: string, subId: string, p: { pct: number; meses: number; idem: string }): Promise<R<{ cupon: string }>> {
  if (!SUB_RE.test(subId)) return { ok: false, status: 400, error: 'id de suscripción inválido' };
  const c = await llamarStripe(key, 'POST', '/v1/coupons', {
    percent_off: p.pct, duration: 'repeating', duration_in_months: p.meses, name: `MaKo: ${p.pct}% por ${p.meses} meses`,
    metadata: { mako: '1', mako_retencion: '1' },
  }, `${p.idem}-cupon`);
  if (!c.ok) return fallo(c);
  const cupon = str(c.body.id);
  if (!cupon) return { ok: false, status: 502, error: 'Stripe no devolvió el cupón.' };
  const s = await llamarStripe(key, 'POST', `/v1/subscriptions/${encodeURIComponent(subId)}`, { discounts: [{ coupon: cupon }] }, `${p.idem}-aplicar`);
  if (!s.ok) return fallo(s);
  return { ok: true, cupon };
}

/** LA RETENCIÓN EN MERCADO PAGO: el monto de las próximas cuotas (PUT /preapproval/{id}). Vuelve al de lista con otra llamada. */
export async function montoSuscripcionMp(token: string, id: string, monto: number, idem: string): Promise<R<{ monto: number }>> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return { ok: false, status: 400, error: 'id de suscripción inválido' };
  if (!(monto > 0)) return { ok: false, status: 400, error: 'monto inválido' };
  const r = await llamarMp(token, 'PUT', `/preapproval/${id}`, { auto_recurring: { transaction_amount: Math.round(monto * 100) / 100 } }, idem);
  if (!r.ok) return fallo(r);
  const nuevo = Number(obj(r.body.auto_recurring).transaction_amount);
  return { ok: true, monto: Number.isFinite(nuevo) ? nuevo : monto };
}


/**
 * PAUSAR UN MES GRATIS EN STRIPE: `pause_collection` con `void` (las facturas del período se anulan, la suscripción sigue)
 * y `resumes_at` (vuelve sola a cobrar). La clave de idempotencia la arma quien llama.
 */
export async function pausarStripe(key: string, subId: string, p: { hastaMs: number; idem: string }): Promise<R<{ hasta: string }>> {
  if (!SUB_RE.test(subId)) return { ok: false, status: 400, error: 'id de suscripción inválido' };
  const r = await llamarStripe(key, 'POST', `/v1/subscriptions/${encodeURIComponent(subId)}`, {
    pause_collection: { behavior: 'void', resumes_at: Math.floor(p.hastaMs / 1000) },
  }, p.idem);
  if (!r.ok) return fallo(r);
  return { ok: true, hasta: new Date(p.hastaMs).toISOString() };
}

/**
 * PASAR A UN PLAN MÁS BARATO EN STRIPE: el ítem de la suscripción con el precio nuevo desde el PRÓXIMO período
 * (`proration_behavior: none`: lo de este mes ya está pago). `price_data` de un ítem pide el `product`: se reusa el del ítem.
 */
export async function cambiarPrecioStripe(key: string, subId: string, p: { monto: number; moneda: string; idem: string }): Promise<R<{ ok: true }>> {
  if (!SUB_RE.test(subId)) return { ok: false, status: 400, error: 'id de suscripción inválido' };
  const s = await llamarStripe(key, 'GET', `/v1/subscriptions/${encodeURIComponent(subId)}`);
  if (!s.ok) return fallo(s);
  const item = obj((Array.isArray(obj(s.body.items).data) ? (obj(s.body.items).data as unknown[]) : [])[0]);
  const itemId = str(item.id);
  const prod = str(obj(item.price).product) ?? str(obj(obj(item.price).product).id);
  if (!itemId || !prod) return { ok: false, status: 502, error: 'Stripe no devolvió el ítem de la suscripción.' };
  const r = await llamarStripe(key, 'POST', `/v1/subscriptions/${encodeURIComponent(subId)}`, {
    items: [{ id: itemId, price_data: { currency: p.moneda.toLowerCase(), product: prod, unit_amount: aUnidadMinima(p.monto, p.moneda), recurring: { interval: 'month' } } }],
    proration_behavior: 'none',
  }, p.idem);
  if (!r.ok) return fallo(r);
  return { ok: true };
}

/** PAUSAR / REANUDAR EN MERCADO PAGO: PUT /preapproval/{id} { status: 'paused' | 'authorized' }. ⚠️ Sin medir con claves de prueba. */
export async function estadoSuscripcionMp(token: string, id: string, estado: 'paused' | 'authorized', idem: string): Promise<R<{ estado: string | null }>> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return { ok: false, status: 400, error: 'id de suscripción inválido' };
  const r = await llamarMp(token, 'PUT', `/preapproval/${id}`, { status: estado }, idem);
  if (!r.ok) return fallo(r);
  return { ok: true, estado: str(r.body.status) };
}

/** Lo que dice Stripe de la retención de una suscripción (para conciliar una marca trabada): pausa, descuento y precio. */
export async function retencionEnStripe(key: string, subId: string): Promise<R<{ pausada: boolean; conDescuento: boolean; montoItem: number | null; moneda: string | null; periodoFin: string | null }>> {
  if (!SUB_RE.test(subId)) return { ok: false, status: 400, error: 'id de suscripción inválido' };
  const r = await llamarStripe(key, 'GET', `/v1/subscriptions/${encodeURIComponent(subId)}`);
  if (!r.ok) return fallo(r);
  const b = r.body;
  const item = obj((Array.isArray(obj(b.items).data) ? (obj(b.items).data as unknown[]) : [])[0]);
  const precio = obj(item.price);
  const moneda = str(precio.currency)?.toUpperCase() ?? null;
  const unidad = Number(precio.unit_amount);
  const descuentos = Array.isArray(b.discounts) ? b.discounts.length : 0;
  return {
    ok: true, pausada: b.pause_collection != null && typeof b.pause_collection === 'object', conDescuento: descuentos > 0 || b.discount != null,
    montoItem: moneda && Number.isFinite(unidad) ? deUnidadMinima(unidad, moneda) : null, moneda,
    periodoFin: fecha(item.current_period_end ?? b.current_period_end),
  };
}

/** GET /preapproval/{id}: estado, monto de las próximas cuotas y el próximo cobro (para conciliar y para la pausa). */
export async function suscripcionMpDetalle(token: string, id: string): Promise<R<{ estado: string | null; monto: number | null; proximo: string | null }>> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return { ok: false, status: 400, error: 'id de suscripción inválido' };
  const r = await llamarMp(token, 'GET', `/preapproval/${id}`);
  if (!r.ok) return fallo(r);
  const m = Number(obj(r.body.auto_recurring).transaction_amount);
  return { ok: true, estado: str(r.body.status), monto: Number.isFinite(m) ? m : null, proximo: str(r.body.next_payment_date) };
}
