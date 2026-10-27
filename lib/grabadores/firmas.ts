// =============================================================================
// grabadores/firmas — cómo firma sus avisos cada grabador (PURO: lo prueban los tests con vectores conocidos)
// =============================================================================
// Medido el 26/10/2026 en la documentación de cada uno (docs/hallazgos-integraciones.md → «Los grabadores de reuniones»):
//   · Fireflies: `X-Hub-Signature: sha256=<hex>` = HMAC-SHA256 del cuerpo CRUDO con el «Signing Secret». Sin reloj.
//   · Zoom: `x-zm-signature: v0=<hex>` = HMAC-SHA256 de «v0:<x-zm-request-timestamp>:<cuerpo>» con el «Secret Token»; y
//     la validación de la dirección se contesta con el plainToken en HMAC con el mismo secreto.
//   · tl;dv: NO firma (sólo deja agregar headers propios): su aviso no se lee como contenido (app/api/webhooks/tldv).
//   · Fathom: Svix, en lib/standard-webhooks.ts.
// =============================================================================

import { createHmac, timingSafeEqual } from 'node:crypto';

/** HMAC-SHA256 en hex. */
export const hmacHex = (secreto: string | Buffer, mensaje: string): string => createHmac('sha256', secreto).update(mensaje, 'utf8').digest('hex');

/** ¿Son iguales, en tiempo constante? (Distinto largo = distintos, sin comparar.) */
export function igualesSeguro(a: string, b: string): boolean {
  const x = Buffer.from(a, 'utf8');
  const y = Buffer.from(b, 'utf8');
  return x.length === y.length && timingSafeEqual(x, y);
}

/** ¿La firma de un aviso de Fireflies («sha256=<hex>» o el hex solo) sale del cuerpo crudo con este secreto? */
export function firmaFirefliesValida(cuerpo: string, firma: string | null | undefined, secreto: string): boolean {
  const f = String(firma ?? '').trim().replace(/^sha256=/i, '').toLowerCase();
  return !!f && !!secreto && igualesSeguro(f, hmacHex(secreto, cuerpo));
}

/** Lo que firma Zoom: «v0=» + hex(HMAC(«v0:<timestamp>:<cuerpo>»)). */
export const firmaZoom = (cuerpo: string, timestamp: string, secreto: string): string => `v0=${hmacHex(secreto, `v0:${timestamp}:${cuerpo}`)}`;

/** ¿La firma de un aviso de Zoom sale de este secreto? */
export function firmaZoomValida(cuerpo: string, timestamp: string | null | undefined, firma: string | null | undefined, secreto: string): boolean {
  if (!timestamp || !firma || !secreto) return false;
  return igualesSeguro(String(firma).trim(), firmaZoom(cuerpo, timestamp, secreto));
}

/** La respuesta a `endpoint.url_validation` de Zoom. */
export const respuestaValidacionZoom = (plainToken: string, secreto: string): { plainToken: string; encryptedToken: string } =>
  ({ plainToken, encryptedToken: hmacHex(secreto, plainToken) });
