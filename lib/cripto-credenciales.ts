// =============================================================================
// cripto-credenciales — el cifrado de las credenciales BYOK, y nada más
// =============================================================================
// Vive aparte de lib/credenciales.ts a propósito: acá NO se importa 'server-only'
// ni nada de Next, así que se puede correr suelto y testear de verdad
// (scripts/test-cripto.mjs). Es el código donde un error se paga más caro; que
// solo se pueda probar levantando la app entera era parte del problema.
//
// Dos formatos conviviendo (migración sin downtime). El criptograma es
// autodescriptivo, así que se puede LEER los dos y ESCRIBIR uno solo:
//
//   gcm1.<iv>.<tag>.<ct>          — viejo. Clave = sha256(secreto), una sola para
//                                   toda la plataforma, sin sal ni AAD.
//   gcm2.<salt>.<iv>.<tag>.<ct>   — nuevo. Clave = HKDF-SHA256 por (workspace,
//                                   clave) con sal por fila, y AAD que ata el
//                                   criptograma a SU fila.
//
// Qué compra v2, concretamente:
//  · Clave por workspace: reventar la de un cliente no da las de los demás.
//  · AAD: un criptograma copiado a otra fila/workspace NO abre. Antes era
//    portable — nada lo ataba a su lugar.
//  · Sal por fila: dos filas con el mismo valor no comparten clave derivada.
//  · Secreto propio: deja de ser el mismo que firma las sesiones.

import crypto from 'node:crypto';

export type VersionCripto = 'gcm1' | 'gcm2' | 'otro';

const V2_INFO = (ws: number, clave: string) => `mako:cred:v2|ws=${ws}|k=${clave}`;
const V2_AAD = (ws: number, clave: string) => Buffer.from(`${ws}:${clave}`, 'utf8');

/** Secreto del cifrado. SOLO CREDENCIALES_SECRET: sin cadena de fallbacks. */
function secretoV2(): string | null {
  const sec = process.env.CREDENCIALES_SECRET;
  return sec && sec.trim() ? sec.trim() : null;
}

function claveV2(salt: Buffer, ws: number, clave: string): Buffer | null {
  const sec = secretoV2();
  if (!sec) return null;
  return Buffer.from(crypto.hkdfSync('sha256', Buffer.from(sec, 'utf8'), salt, Buffer.from(V2_INFO(ws, clave), 'utf8'), 32));
}

/** ¿Con qué formato está escrita esta fila? Lo usa el backfill. */
export function versionCripto(valorEnc: string): VersionCripto {
  const v = valorEnc.split('.')[0];
  return v === 'gcm1' || v === 'gcm2' ? v : 'otro';
}

export function cifrarV2(valor: string, ws: number, clave: string): string {
  const salt = crypto.randomBytes(16);
  const key = claveV2(salt, ws, clave);
  if (!key) throw new Error('credenciales: falta CREDENCIALES_SECRET');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(V2_AAD(ws, clave));
  const enc = Buffer.concat([cipher.update(valor, 'utf8'), cipher.final()]);
  return `gcm2.${salt.toString('base64url')}.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${enc.toString('base64url')}`;
}

/**
 * Cifra para la fila (ws, clave). El (ws, clave) NO es decorativo: entra en la
 * derivación de la clave y en el AAD, así que el criptograma solo abre en su
 * propia fila.
 */
export function cifrar(valor: string, ws: number, clave: string): string {
  return cifrarV2(valor, ws, clave);
}

/**
 * Descifra. SOLO gcm2: la rama que leía el formato viejo se fue.
 *
 * Por qué se fue y no quedó "por las dudas": mientras se aceptara gcm1, el AAD no
 * garantizaba nada. El formato lo elige el criptograma, así que a una fila ya
 * migrada se le podía plantar un blob gcm1 forjado —sin AAD, sin clave por
 * workspace— y el lector lo tomaba. Y la clave de gcm1 salía de
 * AUTH_COOKIE_VALUE, que viajaba al browser de cualquiera que usara el login
 * compartido. Aceptar el formato viejo era aceptar un downgrade con una llave
 * repartida.
 *
 * OJO si restaurás un backup anterior al 2026-07-16: sus filas son gcm1 y NO
 * abren. Se re-pegan las credenciales desde /integraciones (o
 * scripts/recifrar-credenciales.mjs con la llave vieja, resucitando esta rama a
 * mano en una branch).
 */
export function descifrar(valorEnc: string, ws: number, clave: string): string | null {
  const partes = valorEnc.split('.');
  if (partes[0] !== 'gcm2' || partes.length !== 5) return null;
  try {
    const [, salt, iv, tag, cuerpo] = partes;
    const key = claveV2(Buffer.from(salt, 'base64url'), ws, clave);
    if (!key) return null;
    const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
    d.setAAD(V2_AAD(ws, clave));
    d.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([d.update(Buffer.from(cuerpo, 'base64url')), d.final()]).toString('utf8');
  } catch {
    return null; // secret rotado, fila corrupta, o criptograma movido de fila (AAD)
  }
}
