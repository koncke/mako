// =============================================================================
// mercadopago-api — el cliente HTTP de Mercado Pago para la pasarela (BYOK: el token es del negocio)
// =============================================================================
// fetch crudo, sin SDK. Cada función RECIBE el access token: no lo lee sola.
//
// Lo que no se ve en el código y muerde (mercadopago.com.ar/developers, verificado el 11/10/2026):
//   · LA NOTIFICACIÓN NO TRAE EL PAGO: trae un id. El estado se pide SIEMPRE con GET /v1/payments/{id}
//     y el token del negocio, y `payer` viene con los datos personales en null «por seguridad»: para
//     cruzar con el CRM sirve `external_reference` (el token del cobro de MaKo), no el email.
//   · `unit_price` es DECIMAL, no unidades mínimas (al revés que Stripe).
//   · `X-Idempotency-Key` es OBLIGATORIO en un reembolso (sin él, error 4292) y el SDK oficial lo manda
//     en todo POST/PUT. Lo arma quien llama, determinístico.
//   · El prefijo del token NO dice si es de prueba: en Checkout Pro el token de prueba también empieza
//     con APP_USR (es el de una cuenta vendedora de prueba). El modo sale de `tags` de /users/me.
//   · Una suscripción se cancela con `status: 'canceled'` (UNA ele); el pago cancelado es `cancelled`.
//   · `sandbox_init_point` dice textual «Do not use this parameter»: el link es `init_point`.

import 'server-only';
import { monedaDeSitioMp } from './pasarela-moneda';

export const MP_API = 'https://api.mercadopago.com';

export type R<T> = ({ ok: true } & T) | { ok: false; status: number; error: string };

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {});
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : null);
const num = (v: unknown): number | null => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const fallo = <T>(x: { status: number; error: string }): R<T> => ({ ok: false, status: x.status, error: x.error });

async function llamar(
  token: string,
  metodo: 'GET' | 'POST' | 'PUT',
  ruta: string,
  body?: unknown,
  idem?: string | null,
): Promise<{ ok: true; body: Json; lista?: unknown[] } | { ok: false; status: number; error: string }> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (idem && metodo !== 'GET') headers['X-Idempotency-Key'] = idem.slice(0, 64);
  let r: Response;
  try {
    r = await fetch(`${MP_API}${ruta}`, {
      method: metodo, headers, body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store', signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    // Sin `e.message`: con un header inválido fetch tira con el TOKEN entero adentro (ver lib/stripe-api.ts).
    return { ok: false, status: 0, error: `Mercado Pago no contestó (${e instanceof Error ? e.name : 'error de red'})` };
  }
  let crudo: unknown = null;
  try { crudo = await r.json(); } catch { /* respuesta no-JSON */ }
  const j = obj(crudo);
  if (!r.ok) {
    const causa = Array.isArray(j.cause) ? obj(j.cause[0]) : {};
    const msg = str(j.message) ?? str(causa.description) ?? str(j.error) ?? `Mercado Pago respondió ${r.status}`;
    return { ok: false, status: r.status, error: msg };
  }
  return { ok: true, body: j, lista: Array.isArray(crudo) ? crudo : undefined };
}

export type CuentaMp = { id: string; sitio: string | null; moneda: string | null; nombre: string | null; modo: 'real' | 'prueba' };

/** GET /users/me. `id` es el `user_id` que llega en cada notificación (= collector_id de sus pagos). */
export async function leerCuentaMp(token: string): Promise<R<CuentaMp>> {
  const t = String(token ?? '').trim();
  if (!/^(APP_USR|TEST)-[A-Za-z0-9-]{20,}$/.test(t)) return { ok: false, status: 400, error: 'Eso no parece un access token de Mercado Pago (empieza con APP_USR-).' };
  const r = await llamar(t, 'GET', '/users/me');
  if (!r.ok) return fallo(r);
  const b = r.body;
  const id = str(b.id);
  if (!id) return { ok: false, status: 502, error: 'Mercado Pago no devolvió el id de la cuenta.' };
  const tags = Array.isArray(b.tags) ? b.tags.map(String) : [];
  const sitio = str(b.site_id);
  return { ok: true, id, sitio, moneda: monedaDeSitioMp(sitio), nombre: str(b.nickname) ?? str(b.email), modo: tags.includes('test_user') || t.startsWith('TEST-') ? 'prueba' : 'real' };
}

/** Checkout Pro: POST /checkout/preferences. El link es `init_point` (nunca `sandbox_init_point`). */
export async function crearPreferenciaMp(
  token: string,
  p: { idem: string; concepto: string; monto: number; moneda: string; email?: string | null; token: string; notificationUrl: string; volverUrl: string; venceAt?: string | null },
): Promise<R<{ id: string; url: string }>> {
  const body: Json = {
    items: [{ id: 'mako', title: p.concepto.slice(0, 200), quantity: 1, currency_id: p.moneda.toUpperCase(), unit_price: Math.round(p.monto * 100) / 100 }],
    external_reference: p.token,
    notification_url: p.notificationUrl,
    back_urls: { success: p.volverUrl, pending: p.volverUrl, failure: p.volverUrl },
    auto_return: 'approved',
    metadata: { mako_cobro: p.token },
    ...(p.email ? { payer: { email: p.email } } : {}),
    ...(p.venceAt ? { expires: true, expiration_date_to: p.venceAt } : {}),
  };
  const r = await llamar(token, 'POST', '/checkout/preferences', body, p.idem);
  if (!r.ok) return fallo(r);
  const id = str(r.body.id);
  const url = str(r.body.init_point);
  if (!id || !url) return { ok: false, status: 502, error: 'Mercado Pago no devolvió el link del pago.' };
  return { ok: true, id, url };
}

/**
 * Suscripción sin plan: POST /preapproval con `status: 'pending'` (el comprador carga la tarjeta en
 * el checkout de MP). ⚠️ `payer_email` TIENE que ser el de la cuenta de MP de quien paga: si no
 * coincide, MP rechaza el pago. Y el body NO acepta `notification_url`: los avisos de suscripción
 * llegan por la URL configurada en el panel del negocio (el paso externo de la integración).
 */
export async function crearSuscripcionMp(
  token: string,
  p: { idem: string; concepto: string; monto: number; moneda: string; email: string; token: string; volverUrl: string },
): Promise<R<{ id: string; url: string }>> {
  const r = await llamar(token, 'POST', '/preapproval', {
    reason: p.concepto.slice(0, 200),
    external_reference: p.token,
    payer_email: p.email,
    back_url: p.volverUrl,
    auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: Math.round(p.monto * 100) / 100, currency_id: p.moneda.toUpperCase() },
    status: 'pending',
  }, p.idem);
  if (!r.ok) return fallo(r);
  const id = str(r.body.id);
  const url = str(r.body.init_point);
  if (!id || !url) return { ok: false, status: 502, error: 'Mercado Pago no devolvió el link de la suscripción.' };
  return { ok: true, id, url };
}

export type PagoMp = {
  id: string; estado: string | null; detalle: string | null; monto: number | null; moneda: string | null;
  referencia: string | null; cobradorId: string | null; preapprovalId: string | null; fecha: string | null;
  reembolsado: number | null; modo: 'real' | 'prueba'; recurrente: boolean;
};

function pagoDe(b: Json): PagoMp {
  const meta = obj(b.metadata);
  const poi = obj(obj(b.point_of_interaction).transaction_data);
  return {
    id: str(b.id) ?? '',
    estado: str(b.status),
    detalle: str(b.status_detail),
    monto: num(b.transaction_amount),
    moneda: str(b.currency_id)?.toUpperCase() ?? null,
    referencia: str(b.external_reference),
    cobradorId: str(b.collector_id) ?? str(obj(b.collector).id),
    preapprovalId: str(meta.preapproval_id) ?? str(poi.subscription_id) ?? null,
    fecha: str(b.date_approved) ?? str(b.date_created),
    reembolsado: num(b.transaction_amount_refunded),
    modo: b.live_mode === false ? 'prueba' : 'real',
    recurrente: str(b.operation_type) === 'recurring_payment',
  };
}

export async function leerPagoMp(accessToken: string, pagoId: string): Promise<R<PagoMp>> {
  if (!/^\d{1,20}$/.test(pagoId)) return { ok: false, status: 400, error: 'id de pago inválido' };
  const r = await llamar(accessToken, 'GET', `/v1/payments/${pagoId}`);
  if (!r.ok) return fallo(r);
  return { ok: true, ...pagoDe(r.body) };
}

/** Los pagos de un cobro (por su external_reference), más nuevos primero. La usa la reconciliación. */
export async function buscarPagosMp(accessToken: string, referencia: string): Promise<R<{ pagos: PagoMp[] }>> {
  const q = new URLSearchParams({ external_reference: referencia, sort: 'date_created', criteria: 'desc', limit: '20' });
  const r = await llamar(accessToken, 'GET', `/v1/payments/search?${q.toString()}`);
  if (!r.ok) return fallo(r);
  const res = Array.isArray(r.body.results) ? r.body.results : [];
  return { ok: true, pagos: res.map((x) => pagoDe(obj(x))) };
}

export async function leerSuscripcionMp(accessToken: string, id: string): Promise<R<{ id: string; estado: string | null; referencia: string | null; cobradorId: string | null }>> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return { ok: false, status: 400, error: 'id de suscripción inválido' };
  const r = await llamar(accessToken, 'GET', `/preapproval/${id}`);
  if (!r.ok) return fallo(r);
  const b = r.body;
  return { ok: true, id: str(b.id) ?? id, estado: str(b.status), referencia: str(b.external_reference), cobradorId: str(b.collector_id) };
}

/** Una cuota cobrada de una suscripción: GET /authorized_payments/{id} → a qué preapproval y qué pago. */
export async function leerCuotaSuscripcionMp(accessToken: string, id: string): Promise<R<{ preapprovalId: string | null; pagoId: string | null; estado: string | null; pagoEstado: string | null; referencia: string | null }>> {
  if (!/^\d{1,20}$/.test(id)) return { ok: false, status: 400, error: 'id de cuota inválido' };
  const r = await llamar(accessToken, 'GET', `/authorized_payments/${id}`);
  if (!r.ok) return fallo(r);
  const b = r.body;
  const pago = obj(b.payment);
  return { ok: true, preapprovalId: str(b.preapproval_id), pagoId: str(pago.id), estado: str(b.status), pagoEstado: str(pago.status), referencia: str(b.external_reference) };
}

/** Reembolso TOTAL (sin body). `X-Idempotency-Key` obligatorio: lo arma quien llama, determinístico. */
export async function reembolsarMp(accessToken: string, pagoId: string, idem: string): Promise<R<{ id: string; estado: string | null }>> {
  if (!/^\d{1,20}$/.test(pagoId)) return { ok: false, status: 400, error: 'id de pago inválido' };
  const r = await llamar(accessToken, 'POST', `/v1/payments/${pagoId}/refunds`, {}, idem);
  if (!r.ok) return fallo(r);
  const id = str(r.body.id);
  if (!id) return { ok: false, status: 502, error: 'Mercado Pago no devolvió el reembolso.' };
  return { ok: true, id, estado: str(r.body.status) };
}

/** Un instante como lo escribe la documentación de MP: ISO 8601 con milisegundos y el desfase («…T23:59:59.000+00:00»). */
export const instanteMp = (ms: number): string => new Date(ms).toISOString().replace(/Z$/, '+00:00');

/**
 * CIERRA un link de Checkout Pro (al anular un cobro): PUT /checkout/preferences/{id} con `expires` y un
 * `expiration_date_to` de AHORA, los mismos campos con los que una preferencia nace con vencimiento. Hasta el
 * 15/10/2026 se daba por hecho que MP «no cierra una preferencia ya abierta», y un link anulado se podía pagar igual.
 * ⚠️ No está medido con una cuenta real (las claves de prueba de Martín): si MP lo ignora, la red es el aviso de
 * `aplicarPagoAprobado` (lib/cobros.ts) cuando entra un pago por un link anulado.
 */
export async function vencerPreferenciaMp(accessToken: string, id: string, idem: string): Promise<R<{ id: string }>> {
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) return { ok: false, status: 400, error: 'id de preferencia inválido' };
  const r = await llamar(accessToken, 'PUT', `/checkout/preferences/${id}`, { expires: true, expiration_date_to: instanteMp(Date.now()) }, idem);
  if (!r.ok) return fallo(r);
  return { ok: true, id };
}

/** PUT /preapproval/{id} { status: 'canceled' } (UNA ele). Irreversible. */
export async function cancelarSuscripcionMp(accessToken: string, id: string, idem: string): Promise<R<{ estado: string | null }>> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return { ok: false, status: 400, error: 'id de suscripción inválido' };
  const r = await llamar(accessToken, 'PUT', `/preapproval/${id}`, { status: 'canceled' }, idem);
  if (!r.ok) return fallo(r);
  return { ok: true, estado: str(r.body.status) };
}
