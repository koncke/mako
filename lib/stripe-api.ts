// =============================================================================
// stripe-api — el cliente HTTP de Stripe para la pasarela (BYOK: la clave es del negocio)
// =============================================================================
// fetch crudo, sin SDK (la convención del repo: lib/meta-write.ts, lib/resend.ts). Cada función
// RECIBE la clave: no la lee sola, así nunca puede caer en la de otro negocio ni en process.env
// (la de MaKo se lee con credDelCliente(clave, await wsSuperAdmin()) en quien llama).
//
// Lo que no se ve en el código y muerde (docs.stripe.com, verificado el 11/10/2026):
//   · VERSIÓN FIJADA. Sin `Stripe-Version`, cada cuenta contesta con SU versión por defecto, que puede
//     ser vieja, y desde basil (2025-03-31) la factura ya no trae `subscription` ni `payment_intent`:
//     están en `parent.subscription_details`. Se fija acá y en el webhook (api_version al crearlo).
//   · `Idempotency-Key` en todo POST que cobra o devuelve plata: un reintento con la misma clave
//     devuelve la respuesta de la primera vez en vez de cobrar dos veces (AGENTS.md «Una clave de
//     idempotencia sale de la FIRMA de lo que se manda»). La clave la arma quien llama, determinística.
//   · El `whsec_` de un webhook vuelve SÓLO al crearlo. Si se pierde, se borra y se crea otro.
//   · Una Checkout Session VENCE (30 min a 24 h): por eso el link que se manda es /pagar/<token> de
//     MaKo, que crea una sesión nueva si la vieja venció (lib/cobros.ts, urlParaPagar).
//   · res.ok no es «salió bien»: una sesión `complete` puede venir `unpaid` (pago diferido, OXXO).

import 'server-only';
import type { TipoCobro } from './cobros-tipos';
import { aUnidadMinima, deUnidadMinima } from './pasarela-moneda';
import { formStripe } from './stripe-form';

export const STRIPE_API = 'https://api.stripe.com';
export const STRIPE_VERSION = '2026-09-30.endive';

/** Los eventos que escucha el webhook de MaKo en la cuenta del negocio. NO `invoice.created`: si su
 *  respuesta falla, Stripe demora la finalización de las facturas hasta 72 h. `refund.failed` existe desde
 *  2024-10-28.acacia (un nombre que Stripe no conoce hace fallar la CREACIÓN del aviso, o sea, conectar). Los
 *  cuatro de disputa (contracargos, 15/10/2026), verificados en docs.stripe.com/api/events/types: la plata SALE con
 *  `funds_withdrawn` y VUELVE con `funds_reinstated`; `created` y `closed` sólo se cuentan.
 *  ⚠️ Cambiar esta lista NO le llega a los avisos ya registrados: ver `asegurarEventosStripe`. */
export const EVENTOS_STRIPE = [
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed',
  'checkout.session.expired',
  'invoice.paid',
  'invoice.payment_failed',
  'customer.subscription.deleted',
  'charge.refunded',
  'refund.failed',
  'charge.dispute.created',
  'charge.dispute.funds_withdrawn',
  'charge.dispute.funds_reinstated',
  'charge.dispute.closed',
] as const;

export type R<T> = ({ ok: true } & T) | { ok: false; status: number; error: string };

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {});
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
/** Un campo expandible de Stripe llega como id (string) o como objeto con `id`. */
const idDe = (v: unknown): string | null => str(v) ?? str(obj(v).id);

/** `sk_live_`/`rk_live_` → real · `sk_test_`/`rk_test_` → prueba · lo demás (incluida una `sk_org_`, que exige otro header) → null. */
export function modoDeClaveStripe(key: string | null | undefined): 'real' | 'prueba' | null {
  const k = String(key ?? '').trim();
  if (/^(sk|rk)_live_[A-Za-z0-9]{10,}$/.test(k)) return 'real';
  if (/^(sk|rk)_test_[A-Za-z0-9]{10,}$/.test(k)) return 'prueba';
  return null;
}

async function llamar(
  key: string,
  metodo: 'GET' | 'POST' | 'DELETE',
  ruta: string,
  params?: Record<string, unknown>,
  idem?: string | null,
): Promise<{ ok: true; body: Json } | { ok: false; status: number; error: string }> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    'Stripe-Version': STRIPE_VERSION,
  };
  let url = `${STRIPE_API}${ruta}`;
  let body: string | undefined;
  if (params && metodo === 'GET') {
    const q = formStripe(params as never);
    if (q) url += (url.includes('?') ? '&' : '?') + q;
  } else if (params) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    body = formStripe(params as never);
  }
  if (idem && metodo !== 'GET') headers['Idempotency-Key'] = idem.slice(0, 255);
  let r: Response;
  try {
    r = await fetch(url, { method: metodo, headers, body, cache: 'no-store', signal: AbortSignal.timeout(15_000) });
  } catch (e) {
    // Un timeout o un corte de red: el pedido PUDO haber llegado. Quien llama decide (y en lo que
    // cobra, el default es NO reintentar: AGENTS.md «En lo que gasta plata ajena, el default es NO reintentar»).
    // Sin `e.message`: un header inválido (una clave pegada con un salto de línea) hace que fetch tire con la
    // CLAVE ENTERA adentro del mensaje, y este error termina en `cobros.motivo`, en pantalla y en el modelo.
    return { ok: false, status: 0, error: `Stripe no contestó (${e instanceof Error ? e.name : 'error de red'})` };
  }
  let j: Json = {};
  try { j = obj(await r.json()); } catch { /* respuesta no-JSON */ }
  if (!r.ok) {
    const err = obj(j.error);
    const msg = str(err.message) ?? `Stripe respondió ${r.status}`;
    return { ok: false, status: r.status, error: msg };
  }
  return { ok: true, body: j };
}

const fallo = <T>(x: { status: number; error: string }): R<T> => ({ ok: false, status: x.status, error: x.error });

export type CuentaStripe = { id: string; pais: string | null; moneda: string | null; nombre: string | null; modo: 'real' | 'prueba'; cobrosHabilitados: boolean };

/** GET /v1/account. Con una clave restringida sin «Accounts: Read» Stripe contesta 403 y el mensaje dice qué permiso falta. */
export async function leerCuentaStripe(key: string): Promise<R<CuentaStripe>> {
  const modo = modoDeClaveStripe(key);
  if (!modo) return { ok: false, status: 400, error: 'Eso no parece una clave secreta o restringida de Stripe (empieza con sk_ o rk_).' };
  const r = await llamar(key, 'GET', '/v1/account');
  if (!r.ok) return fallo(r);
  const b = r.body;
  const id = str(b.id);
  if (!id || !id.startsWith('acct_')) return { ok: false, status: 502, error: 'Stripe no devolvió el id de la cuenta.' };
  const nombre = str(obj(obj(b.settings).dashboard).display_name) ?? str(obj(b.business_profile).name) ?? str(b.email);
  return {
    ok: true,
    id,
    pais: str(b.country),
    moneda: str(b.default_currency)?.toUpperCase() ?? null,
    nombre,
    modo,
    cobrosHabilitados: b.charges_enabled === true,
  };
}

/** Lo que identifica a NUESTRO aviso sin mirar el dominio: el camino y la cuenta (`/api/webhooks/stripe?acct=…`). */
function firmaDelAviso(u: string | null): string | null {
  if (!u) return null;
  try {
    const x = new URL(u);
    return `${x.pathname}?acct=${x.searchParams.get('acct') ?? ''}`;
  } catch {
    return null;
  }
}

/**
 * Los avisos de MaKo para ESTA url en la cuenta del negocio: los de la url exacta y, además, los que MaKo creó
 * (`metadata.mako = '1'`) con el mismo camino y la misma cuenta en OTRO dominio. Sin lo segundo, después de una
 * mudanza de dominio el aviso viejo quedaba en la cuenta del cliente apuntando a una URL muerta, y Stripe le
 * manda mails de fallo durante días (revisión del 11/10/2026).
 */
async function avisosNuestros(key: string, url: string): Promise<R<{ ids: string[]; avisos: Array<{ id: string; eventos: string[] }> }>> {
  const lista = await llamar(key, 'GET', '/v1/webhook_endpoints', { limit: 100 });
  if (!lista.ok) return fallo(lista);
  const firma = firmaDelAviso(url);
  const avisos = (Array.isArray(lista.body.data) ? lista.body.data : []).map(obj)
    .filter((e) => str(e.url) === url || (!!firma && obj(e.metadata).mako === '1' && firmaDelAviso(str(e.url)) === firma))
    .map((e) => ({ id: str(e.id), eventos: (Array.isArray(e.enabled_events) ? e.enabled_events : []).map((x) => String(x)) }))
    .filter((a): a is { id: string; eventos: string[] } => !!a.id);
  return { ok: true, ids: avisos.map((a) => a.id), avisos };
}

async function borrarAvisos(key: string, ids: readonly string[]): Promise<R<{ borrados: number }>> {
  let borrados = 0;
  for (const id of ids) {
    const r = await llamar(key, 'DELETE', `/v1/webhook_endpoints/${encodeURIComponent(id)}`);
    if (!r.ok && r.status !== 404) return fallo(r);
    borrados++;
  }
  return { ok: true, borrados };
}

/** Saca de la cuenta del negocio los avisos de MaKo de esa url (al desconectar la pasarela). */
export async function borrarWebhooksStripe(key: string, url: string): Promise<R<{ borrados: number }>> {
  const nuestros = await avisosNuestros(key, url);
  if (!nuestros.ok) return fallo(nuestros);
  return borrarAvisos(key, nuestros.ids);
}

/**
 * ⚠️ LOS AVISOS YA REGISTRADOS NO SE ENTERAN CUANDO `EVENTOS_STRIPE` CAMBIA (15/10/2026): Stripe guarda la lista con la
 * que se creó cada uno, y sólo `asegurarWebhookStripe` (al conectar) la escribe. Esto la pone al día sin tocar el
 * secreto: actualizar un aviso (POST /v1/webhook_endpoints/{id}) no cambia su `whsec_`. Uno con `*` ya escucha todo.
 * Sin Idempotency-Key a propósito: repetir la actualización es inofensivo, y una clave reusada con OTRA lista (un
 * deploy que la cambia dentro de las 24 h) Stripe la rechaza.
 */
export async function asegurarEventosStripe(key: string, url: string): Promise<R<{ actualizados: number }>> {
  const nuestros = await avisosNuestros(key, url);
  if (!nuestros.ok) return fallo(nuestros);
  let actualizados = 0;
  for (const a of nuestros.avisos) {
    if (a.eventos.includes('*') || EVENTOS_STRIPE.every((e) => a.eventos.includes(e))) continue;
    const r = await llamar(key, 'POST', `/v1/webhook_endpoints/${encodeURIComponent(a.id)}`, { enabled_events: [...EVENTOS_STRIPE] });
    if (!r.ok) return fallo(r);
    actualizados++;
  }
  return { ok: true, actualizados };
}

/**
 * El aviso (webhook) de MaKo en la cuenta del negocio. El `secret` sólo vuelve al CREAR, así que si
 * ya hay uno nuestro (ver avisosNuestros) se borra y se crea de nuevo: es la única forma de tener su
 * secreto. Idempotente en el resultado (siempre queda UNO, con secreto conocido).
 */
export async function asegurarWebhookStripe(key: string, url: string): Promise<R<{ endpointId: string; secret: string; recreado: boolean }>> {
  const previos = await avisosNuestros(key, url);
  if (!previos.ok) return fallo(previos);
  const borrado = await borrarAvisos(key, previos.ids);
  if (!borrado.ok) return fallo(borrado);
  const nuestros = previos.ids;
  const creado = await llamar(key, 'POST', '/v1/webhook_endpoints', {
    url,
    enabled_events: [...EVENTOS_STRIPE],
    api_version: STRIPE_VERSION,
    description: 'MaKo: los pagos entran al CRM',
    metadata: { mako: '1' },
  });
  if (!creado.ok) return fallo(creado);
  const endpointId = str(creado.body.id);
  const secret = str(creado.body.secret);
  if (!endpointId || !secret) return { ok: false, status: 502, error: 'Stripe creó el aviso pero no devolvió su secreto.' };
  return { ok: true, endpointId, secret, recreado: nuestros.length > 0 };
}

export type CheckoutStripe = { id: string; url: string; venceAt: string | null };

/** POST /v1/checkout/sessions con el precio inline (sin producto previo en Stripe). */
export async function crearCheckoutStripe(
  key: string,
  p: {
    idem: string; tipo: TipoCobro; concepto: string; monto: number; moneda: string; email?: string | null;
    token: string; ws: number; cobroId: number; successUrl: string; cancelUrl: string; venceEnSeg?: number;
  },
): Promise<R<CheckoutStripe>> {
  const sus = p.tipo === 'suscripcion';
  const metadata = { mako_cobro: p.token, mako_ws: String(p.ws), mako_cobro_id: String(p.cobroId) };
  // Entre 30 min y 24 h (lo que acepta Stripe); 23 h por defecto para dejar margen de reloj.
  const vence = Math.min(Math.max(p.venceEnSeg ?? 23 * 3600, 31 * 60), 23 * 3600 + 59 * 60);
  const params: Record<string, unknown> = {
    mode: sus ? 'subscription' : 'payment',
    line_items: [{
      quantity: 1,
      price_data: {
        currency: p.moneda.toLowerCase(),
        unit_amount: aUnidadMinima(p.monto, p.moneda),
        product_data: { name: p.concepto.slice(0, 200) },
        ...(sus ? { recurring: { interval: 'month' } } : {}),
      },
    }],
    client_reference_id: p.token,
    metadata,
    // La metadata del Checkout NO baja sola a lo que crea: se repite en el pago o en la suscripción,
    // y de la suscripción llega a cada factura en `parent.subscription_details.metadata` (renovaciones).
    ...(sus ? { subscription_data: { metadata } } : { payment_intent_data: { metadata } }),
    success_url: p.successUrl,
    cancel_url: p.cancelUrl,
    expires_at: Math.floor(Date.now() / 1000) + vence,
    locale: 'es-419',
    ...(p.email ? { customer_email: p.email } : {}),
  };
  const r = await llamar(key, 'POST', '/v1/checkout/sessions', params, p.idem);
  if (!r.ok) return fallo(r);
  const id = str(r.body.id);
  const url = str(r.body.url);
  if (!id || !url) return { ok: false, status: 502, error: 'Stripe no devolvió el link del pago.' };
  const exp = Number(r.body.expires_at);
  return { ok: true, id, url, venceAt: Number.isFinite(exp) && exp > 0 ? new Date(exp * 1000).toISOString() : null };
}

export type SesionStripe = {
  id: string; estado: string | null; pagoEstado: string | null; paymentIntent: string | null;
  subscription: string | null; invoice: string | null; email: string | null; monto: number | null;
  moneda: string | null; metadata: Record<string, string>; modo: 'real' | 'prueba'; referencia: string | null;
};

const metadataDe = (v: unknown): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [k, x] of Object.entries(obj(v))) if (typeof x === 'string') out[k] = x;
  return out;
};

export async function leerCheckoutStripe(key: string, id: string): Promise<R<SesionStripe>> {
  const r = await llamar(key, 'GET', `/v1/checkout/sessions/${encodeURIComponent(id)}`);
  if (!r.ok) return fallo(r);
  const b = r.body;
  const moneda = str(b.currency)?.toUpperCase() ?? null;
  const total = Number(b.amount_total);
  return {
    ok: true,
    id: str(b.id) ?? id,
    estado: str(b.status),
    pagoEstado: str(b.payment_status),
    paymentIntent: idDe(b.payment_intent),
    subscription: idDe(b.subscription),
    invoice: idDe(b.invoice),
    email: str(obj(b.customer_details).email) ?? str(b.customer_email),
    monto: moneda && Number.isFinite(total) ? deUnidadMinima(total, moneda) : null,
    moneda,
    metadata: metadataDe(b.metadata),
    modo: b.livemode === true ? 'real' : 'prueba',
    referencia: str(b.client_reference_id),
  };
}

export async function expirarCheckoutStripe(key: string, id: string): Promise<R<{ estado: string | null }>> {
  const r = await llamar(key, 'POST', `/v1/checkout/sessions/${encodeURIComponent(id)}/expire`, {}, `mako-expirar-${id}`);
  if (!r.ok) return fallo(r);
  return { ok: true, estado: str(r.body.status) };
}

export type FacturaStripe = {
  id: string; estado: string | null; montoPagado: number | null; moneda: string | null; motivo: string | null;
  suscripcion: string | null; metadata: Record<string, string>; email: string | null; modo: 'real' | 'prueba';
};

/** GET /v1/invoices/{id}. Desde basil la suscripción vive en `parent.subscription_details`. */
export async function leerFacturaStripe(key: string, id: string): Promise<R<FacturaStripe>> {
  const r = await llamar(key, 'GET', `/v1/invoices/${encodeURIComponent(id)}`);
  if (!r.ok) return fallo(r);
  const b = r.body;
  const det = obj(obj(b.parent).subscription_details);
  const moneda = str(b.currency)?.toUpperCase() ?? null;
  const pagado = Number(b.amount_paid);
  return {
    ok: true,
    id: str(b.id) ?? id,
    estado: str(b.status),
    montoPagado: moneda && Number.isFinite(pagado) ? deUnidadMinima(pagado, moneda) : null,
    moneda,
    motivo: str(b.billing_reason),
    suscripcion: idDe(det.subscription),
    metadata: metadataDe(det.metadata),
    email: str(b.customer_email),
    modo: b.livemode === true ? 'real' : 'prueba',
  };
}

export async function leerSuscripcionStripe(key: string, id: string): Promise<R<{ id: string; estado: string | null; metadata: Record<string, string> }>> {
  const r = await llamar(key, 'GET', `/v1/subscriptions/${encodeURIComponent(id)}`);
  if (!r.ok) return fallo(r);
  return { ok: true, id: str(r.body.id) ?? id, estado: str(r.body.status), metadata: metadataDe(r.body.metadata) };
}

export async function leerCargoStripe(key: string, id: string): Promise<R<{ id: string; paymentIntent: string | null; reembolsado: boolean; montoReembolsado: number | null; monto: number | null; moneda: string | null; creado: string | null }>> {
  const r = await llamar(key, 'GET', `/v1/charges/${encodeURIComponent(id)}`);
  if (!r.ok) return fallo(r);
  const b = r.body;
  const moneda = str(b.currency)?.toUpperCase() ?? null;
  const conv = (n: unknown) => (moneda && Number.isFinite(Number(n)) ? deUnidadMinima(Number(n), moneda) : null);
  const creado = Number.isFinite(Number(b.created)) && Number(b.created) > 0 ? new Date(Number(b.created) * 1000).toISOString() : null;
  return { ok: true, id: str(b.id) ?? id, paymentIntent: idDe(b.payment_intent), reembolsado: b.refunded === true, montoReembolsado: conv(b.amount_refunded), monto: conv(b.amount), moneda, creado };
}

/**
 * GET /v1/disputes/{id}: una disputa (contracargo) — su estado, su motivo, cuánto y de qué cargo. Y si la plata SALIÓ y
 * si VOLVIÓ, por sus `balance_transactions` (un retiro es negativo, un reintegro positivo): eso dice dónde está la plata
 * aunque los avisos lleguen desordenados, y no el tipo del evento.
 */
export async function leerDisputaStripe(key: string, id: string): Promise<R<{ id: string; estado: string | null; cargo: string | null; paymentIntent: string | null; motivo: string | null; monto: number | null; moneda: string | null; retirada: boolean; reintegrada: boolean }>> {
  const r = await llamar(key, 'GET', `/v1/disputes/${encodeURIComponent(id)}`);
  if (!r.ok) return fallo(r);
  const b = r.body;
  const moneda = str(b.currency)?.toUpperCase() ?? null;
  const monto = moneda && Number.isFinite(Number(b.amount)) ? deUnidadMinima(Number(b.amount), moneda) : null;
  const movs = (Array.isArray(b.balance_transactions) ? b.balance_transactions : []).map((t) => Number(obj(t).amount)).filter((n) => Number.isFinite(n));
  return {
    ok: true, id: str(b.id) ?? id, estado: str(b.status), cargo: idDe(b.charge), paymentIntent: idDe(b.payment_intent), motivo: str(b.reason), monto, moneda,
    retirada: movs.some((n) => n < 0), reintegrada: movs.some((n) => n > 0),
  };
}

/** GET /v1/refunds/{id}: el estado de una devolución (`pending`, `succeeded`, `failed`, `canceled`…) y por qué falló. */
export async function leerReembolsoStripe(key: string, id: string): Promise<R<{ id: string; estado: string | null; cargo: string | null; paymentIntent: string | null; motivo: string | null }>> {
  const r = await llamar(key, 'GET', `/v1/refunds/${encodeURIComponent(id)}`);
  if (!r.ok) return fallo(r);
  const b = r.body;
  return { ok: true, id: str(b.id) ?? id, estado: str(b.status), cargo: idDe(b.charge), paymentIntent: idDe(b.payment_intent), motivo: str(b.failure_reason) };
}

export async function leerPaymentIntentStripe(key: string, id: string): Promise<R<{ id: string; estado: string | null; metadata: Record<string, string> }>> {
  const r = await llamar(key, 'GET', `/v1/payment_intents/${encodeURIComponent(id)}`);
  if (!r.ok) return fallo(r);
  return { ok: true, id: str(r.body.id) ?? id, estado: str(r.body.status), metadata: metadataDe(r.body.metadata) };
}

/**
 * La factura que pagó un payment intent (para un reembolso de una cuota de suscripción: el cargo ya
 * no trae `invoice` desde basil). GET /v1/invoice_payments filtrado por el payment intent.
 */
export async function facturaDePagoStripe(key: string, paymentIntent: string): Promise<R<{ invoice: string | null }>> {
  const r = await llamar(key, 'GET', '/v1/invoice_payments', {
    payment: { type: 'payment_intent', payment_intent: paymentIntent },
    status: 'paid',
    limit: 1,
  });
  if (!r.ok) return fallo(r);
  const p = obj((Array.isArray(r.body.data) ? r.body.data : [])[0]);
  return { ok: true, invoice: idDe(p.invoice) };
}

/** El payment intent con que se pagó una factura (al revés que la anterior). */
async function pagoDeFacturaStripe(key: string, invoice: string): Promise<R<{ paymentIntent: string | null }>> {
  const r = await llamar(key, 'GET', '/v1/invoice_payments', { invoice, status: 'paid', limit: 1 });
  if (!r.ok) return fallo(r);
  const p = obj((Array.isArray(r.body.data) ? r.body.data : [])[0]);
  return { ok: true, paymentIntent: idDe(obj(p.payment).payment_intent) };
}

/**
 * Devuelve el TOTAL de un pago (sin `amount`: un parcial necesitaría un monto que nadie de la
 * pantalla genérica puede vaciar sin que vuelva el viejo — docs/hallazgos-api-mako.md). La clave de
 * idempotencia la arma quien llama, DETERMINÍSTICA (`mako-reembolso-<cobro>`): una propuesta
 * confirmada dos veces no devuelve dos veces.
 */
export async function reembolsarStripe(key: string, p: { idem: string; paymentIntent?: string | null; invoice?: string | null }): Promise<R<{ id: string; estado: string | null }>> {
  let pi = p.paymentIntent ?? null;
  if (!pi && p.invoice) {
    const f = await pagoDeFacturaStripe(key, p.invoice);
    if (!f.ok) return fallo(f);
    pi = f.paymentIntent;
  }
  if (!pi) return { ok: false, status: 400, error: 'No encontré el pago en Stripe para devolverlo.' };
  const r = await llamar(key, 'POST', '/v1/refunds', { payment_intent: pi, reason: 'requested_by_customer', metadata: { mako: '1' } }, p.idem);
  if (!r.ok) return fallo(r);
  const id = str(r.body.id);
  if (!id) return { ok: false, status: 502, error: 'Stripe no devolvió el reembolso.' };
  return { ok: true, id, estado: str(r.body.status) };
}

/** DELETE /v1/subscriptions/{id}: cancela EN EL ACTO (status `canceled`). */
export async function cancelarSuscripcionStripe(key: string, subId: string, idem: string): Promise<R<{ estado: string | null }>> {
  const r = await llamar(key, 'DELETE', `/v1/subscriptions/${encodeURIComponent(subId)}`, undefined, idem);
  if (!r.ok) return fallo(r);
  return { ok: true, estado: str(r.body.status) };
}
