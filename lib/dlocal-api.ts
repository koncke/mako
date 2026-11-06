// =============================================================================
// dlocal-api — el cliente HTTP de dLocal Go para la pasarela (BYOK: las claves son del negocio)
// =============================================================================
// fetch crudo, sin SDK. Cada función RECIBE las claves: no las lee sola (la lectura es
// `credDelCliente(clave, ws)` y nada más — lib/cobros.ts lo explica y tests/pasarela-sin-env.test.ts
// lo barre). El molde es lib/mercadopago-api.ts; lo que se decide sin red vive en
// lib/dlocal-reglas.ts, que es puro y tiene test.
//
// Lo que no se ve en el código y muerde (docs.dlocalgo.com, leído el 06/11/2026):
//   · LA NOTIFICACIÓN TRAE UN SOLO CAMPO: `{"payment_id": "..."}`. No trae el estado, ni el monto,
//     ni de qué cuenta es. Todo sale de RELEER con las claves del negocio — el mismo molde que
//     Mercado Pago, y por eso la seguridad del webhook es la relectura y no sólo la firma.
//   · Y ESE `payment_id` PUEDE SER EL DE UNA DEVOLUCIÓN. La doc dice «the ID of the payment or
//     refund»: releerlo como pago da 404. Por eso están las dos lecturas.
//   · `redirect_url` ES DE UN SOLO USO Y VENCE A LAS 24 h. Por eso el link que se MANDA es
//     /pagar/<token> (de MaKo) y la sesión de dLocal se crea al abrirlo, igual que en Stripe.
//   · EL REEMBOLSO NO ES `/v1/payments/{id}/refund`: es `POST /v1/refunds` con `payment_id` en el
//     CUERPO. La forma anidada es la que uno adivina copiando a Stripe, y da 404 — que se lee como
//     «ese pago no existe» en vez de «esa ruta no existe». Se escribió mal una vez antes de leer la
//     página, el 06/11/2026.
//
// ⚠️ SmartFields (el formulario de tarjeta embebido) NO se usa, y es una decisión: MaKo cobra por el
// LINK (`redirect_url`). El porqué, en docs/diseno-pasarela-pagos.md → «dLocal Go: el link, no
// SmartFields». En una línea: el link reusa /pagar/<token> tal como está, y SmartFields pondría el
// formulario de tarjeta adentro de MaKo (otra pantalla, 3DS y tokenización propias, y MaKo en
// alcance de PCI) sin ganar nada para vender un plan. Por eso `DLOCAL_SMARTFIELDS_KEY` NO es una
// credencial de esta integración: si algún día se usa Transparent Checkout, entra como campo nuevo
// y opcional.

import 'server-only';
import {
  authDlocal, baseDlocal, cuentaDlocalDeCuerpo, decimalDlocal, num, obj, pagoDlocalDeCuerpo,
  reembolsoDlocalDeCuerpo, str, type ClavesDlocal, type CuentaDlocal, type Json, type ModoDlocal,
  type PagoDlocal, type ReembolsoDlocal,
} from './dlocal-reglas';

export type R<T> = ({ ok: true } & T) | { ok: false; status: number; error: string };

const fallo = <T>(x: { status: number; error: string }): R<T> => ({ ok: false, status: x.status, error: x.error });

async function llamar(
  c: ClavesDlocal,
  modo: ModoDlocal,
  metodo: 'GET' | 'POST',
  ruta: string,
  body?: unknown,
): Promise<{ ok: true; body: Json; lista?: unknown[] } | { ok: false; status: number; error: string }> {
  const headers: Record<string, string> = { Authorization: authDlocal(c) };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let r: Response;
  try {
    r = await fetch(`${baseDlocal(modo)}${ruta}`, {
      method: metodo,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    // Sin `e.message`: con un header inválido fetch tira con las CLAVES adentro del mensaje (es la
    // misma trampa que anota lib/stripe-api.ts). Sólo el NOMBRE del error.
    return { ok: false, status: 0, error: `dLocal Go no contestó (${e instanceof Error ? e.name : 'error de red'})` };
  }
  let crudo: unknown = null;
  try { crudo = await r.json(); } catch { /* respuesta no-JSON */ }
  const j = obj(crudo);
  if (!r.ok) {
    // dLocal contesta `{ code, message }`; `param` aparece cuando el que falla es un campo.
    const campo = str(j.param);
    const msg = str(j.message) ?? str(j.error) ?? `dLocal Go respondió ${r.status}`;
    return { ok: false, status: r.status, error: campo ? `${msg} (${campo})` : msg };
  }
  return { ok: true, body: j, lista: Array.isArray(crudo) ? crudo : undefined };
}

// ─────────────────────────────────────────────────────────────────────────────
// La cuenta (GET /v1/me): lo único que dice si puede cobrar de verdad
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `GET /v1/me`, probando PRODUCCIÓN y después SANDBOX.
 *
 * Las claves no dicen de qué cuenta son (32 y 40 caracteres sin prefijo, al revés de
 * `sk_live_`/`rk_test_` de Stripe), así que el modo sólo se sabe preguntando. Y el 403 de producción
 * con claves de sandbox es INDISTINGUIBLE de una clave inválida: por eso se prueba el otro lado
 * antes de decirle a alguien «esa clave no sirve».
 */
export async function leerCuentaDlocal(c: { apiKey: string; secret: string }): Promise<R<CuentaDlocal>> {
  const apiKey = String(c.apiKey ?? '').trim();
  const secret = String(c.secret ?? '').trim();
  if (!apiKey || !secret) return { ok: false, status: 400, error: 'Faltan la API key o la secret key de dLocal Go.' };
  // Un `:` adentro de una clave rompería el header en silencio (dLocal parte por el primero).
  if (apiKey.includes(':') || secret.includes(':')) {
    // ⚠️ El copy va en castellano neutro con «tú», nunca en voseo: lo lee un cliente, y lo barre
    // tests/puente-panel-copy.test.ts. Este mensaje salió con «copialas» y frenó la punta — pasa
    // fácil porque los comentarios y los documentos del repo SÍ están en voseo.
    return { ok: false, status: 400, error: 'Esas claves de dLocal Go traen dos puntos: cópialas de nuevo, son dos valores por separado.' };
  }
  const claves = { apiKey, secret };

  const real = await llamar(claves, 'real', 'GET', '/v1/me');
  if (real.ok) {
    const cuenta = cuentaDlocalDeCuerpo(real.body, 'real');
    return cuenta ? { ok: true, ...cuenta } : { ok: false, status: 502, error: 'dLocal Go no devolvió el id de la cuenta.' };
  }
  // Sólo si el rechazo fue de CREDENCIALES vale la pena probar sandbox; un 500 o un timeout, no.
  if (real.status !== 401 && real.status !== 403) return fallo(real);
  const prueba = await llamar(claves, 'prueba', 'GET', '/v1/me');
  if (!prueba.ok) return fallo(real); // el error que se le muestra es el de PRODUCCIÓN
  const cuenta = cuentaDlocalDeCuerpo(prueba.body, 'prueba');
  return cuenta ? { ok: true, ...cuenta } : { ok: false, status: 502, error: 'dLocal Go no devolvió el id de la cuenta.' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Las monedas habilitadas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `GET /v1/currency-exchanges`: las tasas contra USD de las monedas habilitadas en la cuenta.
 *
 * ⚠️ UNA TASA NO ES UN PERMISO DE PAÍS. La lista de la cuenta de MaKo trae EUR y GBP (32 monedas,
 * medido el 06/11/2026) y dLocal Go no recibe pagos de Europa ni de EE.UU. De dónde puede pagar
 * alguien lo decide `PAISES_DLOCAL` (lib/dlocal-reglas.ts), nunca esta lista.
 */
export async function monedasDlocal(c: ClavesDlocal, modo: ModoDlocal): Promise<R<{ tasas: Array<{ moneda: string; porUsd: number }> }>> {
  const r = await llamar(c, modo, 'GET', '/v1/currency-exchanges');
  if (!r.ok) return fallo(r);
  const tasas: Array<{ moneda: string; porUsd: number }> = [];
  for (const x of r.lista ?? []) {
    const o = obj(x);
    const moneda = str(o.target_currency);
    const valor = num(o.value);
    if (moneda && valor != null && valor > 0) tasas.push({ moneda: moneda.toUpperCase(), porUsd: valor });
  }
  return { ok: true, tasas };
}

// ─────────────────────────────────────────────────────────────────────────────
// Cobrar (el LINK, no SmartFields)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `POST /v1/payments`: crea el checkout y devuelve su `redirect_url` (de un solo uso, 24 h).
 *
 * `order_id` lleva el token del cobro de MaKo: es lo que después cruza el aviso con la fila de
 * `cobros`. `notification_url` lleva el merchant_id en el query (`?m=`) porque la notificación NO
 * dice de qué cuenta es — es lo único que le permite al webhook saber de quién es antes de verificar
 * la firma (el mismo molde que `?acct=` en Stripe).
 */
export async function crearPagoDlocal(
  c: ClavesDlocal,
  modo: ModoDlocal,
  p: {
    monto: number; moneda: string; pais?: string | null; concepto: string;
    token: string; notificationUrl: string; volverUrl: string;
    email?: string | null; nombre?: string | null;
  },
): Promise<R<{ id: string; url: string; estado: string | null }>> {
  const body: Json = {
    amount: decimalDlocal(p.monto),
    currency: p.moneda.toUpperCase(),
    order_id: p.token,
    description: p.concepto.slice(0, 100), // dLocal corta en 100 y rechaza más largo
    notification_url: p.notificationUrl,
    success_url: p.volverUrl,
    back_url: p.volverUrl,
    ...(p.pais ? { country: p.pais.toUpperCase() } : {}),
    ...(p.email || p.nombre
      ? { payer: { ...(p.email ? { email: p.email } : {}), ...(p.nombre ? { name: p.nombre.slice(0, 100) } : {}) } }
      : {}),
  };
  const r = await llamar(c, modo, 'POST', '/v1/payments', body);
  if (!r.ok) return fallo(r);
  const id = str(r.body.id);
  const url = str(r.body.redirect_url);
  if (!id || !url) return { ok: false, status: 502, error: 'dLocal Go no devolvió el link del pago.' };
  return { ok: true, id, url, estado: str(r.body.status) };
}

/** `GET /v1/payments/{id}`: la RELECTURA. El estado y la plata salen de acá, nunca del aviso. */
export async function leerPagoDlocal(c: ClavesDlocal, modo: ModoDlocal, id: string): Promise<R<{ pago: PagoDlocal }>> {
  const pid = String(id ?? '').trim();
  if (!pid) return { ok: false, status: 400, error: 'Falta el id del pago de dLocal Go.' };
  const r = await llamar(c, modo, 'GET', `/v1/payments/${encodeURIComponent(pid)}`);
  if (!r.ok) return fallo(r);
  const pago = pagoDlocalDeCuerpo(r.body);
  if (!pago) return { ok: false, status: 502, error: 'dLocal Go no devolvió el pago.' };
  return { ok: true, pago };
}

// ─────────────────────────────────────────────────────────────────────────────
// Devolver
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `POST /v1/refunds`: devolución TOTAL (sin `monto`) o parcial.
 *
 * ⚠️ NO ES `/v1/payments/{id}/refund`: el pago va en el CUERPO y la ruta es de primer nivel.
 */
export async function reembolsarDlocal(
  c: ClavesDlocal, modo: ModoDlocal, pagoId: string, p: { monto?: number | null; notificationUrl?: string | null } = {},
): Promise<R<{ reembolso: ReembolsoDlocal }>> {
  const pid = String(pagoId ?? '').trim();
  if (!pid) return { ok: false, status: 400, error: 'Falta el id del pago de dLocal Go.' };
  const body: Json = {
    payment_id: pid,
    ...(p.monto != null ? { amount: decimalDlocal(p.monto) } : {}),
    ...(p.notificationUrl ? { notification_url: p.notificationUrl } : {}),
  };
  const r = await llamar(c, modo, 'POST', '/v1/refunds', body);
  if (!r.ok) return fallo(r);
  const reembolso = reembolsoDlocalDeCuerpo(r.body);
  if (!reembolso) return { ok: false, status: 502, error: 'dLocal Go no devolvió la devolución.' };
  return { ok: true, reembolso };
}

/** `GET /v1/refunds/{id}`: la relectura de una devolución (el OTRO id que puede traer un aviso). */
export async function leerReembolsoDlocal(c: ClavesDlocal, modo: ModoDlocal, id: string): Promise<R<{ reembolso: ReembolsoDlocal }>> {
  const rid = String(id ?? '').trim();
  if (!rid) return { ok: false, status: 400, error: 'Falta el id de la devolución de dLocal Go.' };
  const r = await llamar(c, modo, 'GET', `/v1/refunds/${encodeURIComponent(rid)}`);
  if (!r.ok) return fallo(r);
  const reembolso = reembolsoDlocalDeCuerpo(r.body);
  if (!reembolso) return { ok: false, status: 502, error: 'dLocal Go no devolvió la devolución.' };
  return { ok: true, reembolso };
}
