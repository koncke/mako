// =============================================================================
// zernio-firma — la firma del webhook de Zernio
// =============================================================================
// `X-Zernio-Signature` (alias viejo `X-Late-Signature`) = HMAC-SHA256 hex en minúsculas del body CRUDO,
// con el secreto que se le dio a Zernio al registrar el webhook (docs.zernio.com/webhooks, 09/10/2026).
// Aparte del route a propósito: un `route.ts` sólo exporta sus handlers, y el test la ejecuta.

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
