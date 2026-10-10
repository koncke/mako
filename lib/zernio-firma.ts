// =============================================================================
// zernio-firma — la firma del webhook de Zernio, y a QUÉ negocio la ata
// =============================================================================
// `X-Zernio-Signature` (alias viejo `X-Late-Signature`) = HMAC-SHA256 hex en minúsculas del body CRUDO,
// con el secreto que se le dio a Zernio al registrar el webhook (docs.zernio.com/webhooks, 09/10/2026).
// Aparte del route a propósito: un `route.ts` sólo exporta sus handlers, y el test la ejecuta.
//
// ⚠️ UN SECRETO POR NEGOCIO CON CUENTA PROPIA, Y LA FIRMA LO NOMBRA (10/10/2026). Con key propia, el
// webhook vive en la cuenta de Zernio DEL NEGOCIO, y lo que se le da a Zernio ahí lo puede LEER quien
// tenga esa key: `GET /v1/webhooks/settings` devuelve el `secret` en claro (medido el 10/10/2026 sobre
// la cuenta de la plataforma: el campo viene y es el maestro). Con UN solo secreto para todos, un
// cliente lo leía de su cuenta y firmaba eventos de cualquier otro negocio — un `message.received` con
// el profile ajeno creaba leads en otro CRM. Por eso:
//   · la cuenta de la PLATAFORMA (la de la agencia, que no ve ningún cliente) recibe el maestro
//     (`ZERNIO_WEBHOOK_SECRET`) y la URL pelada;
//   · la cuenta PROPIA de un negocio recibe `secretoDeWorkspace(maestro, ws)` y la URL con `?w=<ws>`;
//   · el webhook verifica con el secreto que nombra el `?w=` y después exige que el evento sea de ESE
//     negocio (`aceptaElWorkspace`). Con su propio secreto, un cliente sólo puede firmar eventos suyos.

import crypto from 'node:crypto';

/** Fail-closed: sin secreto o sin firma, false. Con `timingSafeEqual` y guarda de largo. */
export function verificarFirmaZernio(raw: string, header: string | null, secret: string | null): boolean {
  if (!secret || !header) return false;
  const esperada = crypto.createHmac('sha256', secret).update(raw, 'utf8').digest('hex');
  const a = Buffer.from(esperada, 'utf8');
  const b = Buffer.from(header.trim().toLowerCase(), 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** La firma que Zernio pondría (para los tests). */
export const firmarZernio = (raw: string, secret: string): string => crypto.createHmac('sha256', secret).update(raw, 'utf8').digest('hex');

/**
 * El secreto del webhook en la cuenta de Zernio PROPIA de un negocio: derivado del maestro, así que no
 * hay nada nuevo que guardar ni que rotar aparte. Del derivado no se puede volver al maestro (HMAC), y
 * el de un negocio no firma eventos de otro.
 */
export function secretoDeWorkspace(maestro: string, ws: number): string {
  return crypto.createHmac('sha256', maestro).update(`zernio-ws:${ws}`, 'utf8').digest('hex');
}

/**
 * Lo que se registra en la cuenta de Zernio de un negocio (`asegurarWebhook`): la ruta del webhook y el
 * secreto. El maestro, sólo en la cuenta de la plataforma.
 */
export function webhookDeLaCuenta(maestro: string, ws: number, cuentaPropia: boolean): { ruta: string; secret: string } {
  return cuentaPropia
    ? { ruta: `/api/webhooks/zernio?w=${ws}`, secret: secretoDeWorkspace(maestro, ws) }
    : { ruta: '/api/webhooks/zernio', secret: maestro };
}

/**
 * El `?w=` de la URL del webhook. Ausente → `null` (la cuenta de la plataforma); un entero positivo
 * escrito como lo escribe `asegurarWebhook` → ese workspace; cualquier otra cosa → `'invalido'`, que
 * se rechaza: un `?w=` roto no cae al maestro.
 */
export function wsDelWebhook(raw: string | null): number | null | 'invalido' {
  if (raw == null) return null;
  return /^[1-9]\d{0,9}$/.test(raw) ? Number(raw) : 'invalido';
}

/** Con qué secreto se verifica un evento que llegó con este `?w=`. Fail-closed: sin maestro o con un `?w=` roto, null. */
export function secretoParaVerificar(maestro: string | null, w: number | null | 'invalido'): string | null {
  if (!maestro || w === 'invalido') return null;
  return w == null ? maestro : secretoDeWorkspace(maestro, w);
}

/**
 * ¿Este evento, ya ruteado al workspace `ws`, le toca a ese workspace?
 *   · Firmado con el secreto de un negocio (`w`): sólo si es de ESE negocio. El secreto lo puede leer
 *     quien tenga la key de esa cuenta, así que no autoriza nada fuera de ella.
 *   · Firmado con el maestro (`w` null): sólo para un negocio que NO tiene cuenta propia — sus eventos
 *     llegan por SU webhook, con su secreto, y el maestro no tiene nada que decir sobre ellos.
 */
export function aceptaElWorkspace(w: number | null, ws: number, cuentaPropia: boolean): boolean {
  // Number(): `ws` sale de una columna BIGINT. Hoy supabase-js la devuelve como número, pero contra un
  // string el `===` daría false SIEMPRE y ningún evento de una cuenta propia entraría nunca, en silencio.
  if (w != null) return Number(ws) === w;
  return !cuentaPropia;
}
