// =============================================================================
// standard-webhooks — la firma que usan Fathom, Resend y Whop
// =============================================================================
// Es el estándar de Svix (standardwebhooks.com), y tres proveedores del sistema
// lo usan igual:
//
//   headers  webhook-id · webhook-timestamp · webhook-signature
//   firmado  `${id}.${timestamp}.${rawBody}`
//   clave    base64decode(secret sin el prefijo `whsec_`)
//   firma    base64( HMAC_SHA256(clave, firmado) )
//   header   una o más firmas `v1,<sig>` separadas por ESPACIO
//
// ⚠️ POR QUÉ VIVE ACÁ Y NO EN CADA LIB. Estaba escrito DOS veces —`lib/fathom.ts`
// y `lib/resend.ts`, el mismo algoritmo con dos redacciones— y agregar a Whop
// habría sido la tercera. Es exactamente lo que AGENTS.md → «Una cosa, un lugar»
// dice que se queda viejo: el día que uno se corrija, los otros dos no.
//
// TRES DETALLES QUE FALLAN SIEMPRE SI SE HACEN MAL, y ninguno da un síntoma que
// apunte al lugar correcto (todos dan «firma no coincide»):
//   1. El secreto NO es la clave. Va base64-decodificado, sin `whsec_`.
//   2. La salida es BASE64, no hex.
//   3. El body tiene que ser el TEXTO CRUDO. Un JSON.parse + JSON.stringify
//      cambia orden y espaciado, y el HMAC deja de dar.
//
// SIN `server-only` a propósito: es criptografía pura sobre strings y tiene que
// poder testearse. Mismo criterio que `lib/rutas-publicas.ts`.
// =============================================================================

import crypto from 'node:crypto';

export type SvixHeaders = { id: string | null; timestamp: string | null; signature: string | null };

/** Motivo por el que una firma no pasó. Se devuelve en vez de un booleano pelado
 *  porque los tres motivos se diagnostican distinto, y un `false` a secas manda
 *  a revisar el secreto cuando el problema era el reloj. */
export type FalloFirma = 'sin-secreto' | 'faltan-headers' | 'timestamp-invalido' | 'timestamp-viejo' | 'no-coincide';

export const TOLERANCIA_SEG = 5 * 60; // ventana anti-replay

/** Verifica la firma. Devuelve null si está bien, o el motivo del rechazo.
 *  Fail-closed: cualquier duda es un motivo, nunca un pase. */
export function verificarFirmaSvix(
  rawBody: string,
  headers: SvixHeaders,
  secret: string | null | undefined,
  toleranciaSeg = TOLERANCIA_SEG,
): FalloFirma | null {
  if (!secret) return 'sin-secreto';
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) return 'faltan-headers';

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return 'timestamp-invalido';
  const ahora = Math.floor(Date.now() / 1000);
  if (Math.abs(ahora - ts) > toleranciaSeg) return 'timestamp-viejo';

  const b64 = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret;
  let clave: Buffer;
  try { clave = Buffer.from(b64, 'base64'); } catch { return 'sin-secreto'; }

  const firmado = `${id}.${timestamp}.${rawBody}`;
  const esperado = crypto.createHmac('sha256', clave).update(firmado).digest('base64');
  const esperadoBuf = Buffer.from(esperado);

  // El header trae UNA O MÁS firmas separadas por espacio. Aceptar cualquiera no
  // es laxitud: durante una rotación de secreto el proveedor manda la vieja y la
  // nueva juntas, y comparar el header entero contra una sola rechaza todo el
  // tráfico mientras dura la rotación.
  for (const parte of signature.split(' ')) {
    const coma = parte.indexOf(',');
    const sig = coma >= 0 ? parte.slice(coma + 1) : parte;
    const sigBuf = Buffer.from(sig);
    if (sigBuf.length === esperadoBuf.length && crypto.timingSafeEqual(sigBuf, esperadoBuf)) return null;
  }
  return 'no-coincide';
}

/** Lee los tres headers de un Request. Los nombres son del estándar y van en
 *  minúscula; `Headers` los normaliza igual, pero se centraliza acá para que
 *  ningún receptor se invente una variante. */
export function headersSvix(req: Request): SvixHeaders {
  return {
    id: req.headers.get('webhook-id'),
    timestamp: req.headers.get('webhook-timestamp'),
    signature: req.headers.get('webhook-signature'),
  };
}

/** El texto que se le muestra a quien depura. Cada motivo manda a mirar un lugar
 *  distinto, que es de lo que se trata devolver el motivo y no un booleano. */
export const MOTIVO_FIRMA: Record<FalloFirma, string> = {
  'sin-secreto': 'No hay secreto de webhook configurado para este workspace.',
  'faltan-headers': 'Faltan los headers de firma (webhook-id / webhook-timestamp / webhook-signature).',
  'timestamp-invalido': 'El webhook-timestamp no es un número.',
  'timestamp-viejo': 'El webhook-timestamp está fuera de tolerancia (¿reloj desfasado, o un reenvío viejo?).',
  'no-coincide': 'La firma no coincide: el secreto pegado no es el de este webhook.',
};
