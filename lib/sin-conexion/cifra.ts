// =============================================================================
// MaKo sin conexión — el cifrado de lo guardado en la computadora (WebCrypto, 28/10/2026)
// =============================================================================
// Corre igual en el navegador (la app y el cascarón) y en Node (los tests): sólo `crypto.subtle`, `btoa` y `atob`.
//
//   · La DEK: AES-GCM de 256 bits, una por persona y por computadora. La da el servidor a la sesión de esa persona
//     (lib/sin-conexion/llave-server.ts): con conexión, la copia se guarda sin preguntar nada.
//   · La KEK: PBKDF2-SHA256 de la clave de esta computadora, con su sal y `VUELTAS`. Envuelve la DEK, que queda guardada así:
//     sin conexión, la copia abre SÓLO con esa clave.
//   · Cada cifrado lleva su AAD (lib/sin-conexion/reglas.ts → aadDeCopia / aadDeLlave): la copia de una persona, pasada a otra,
//     no abre aunque alguien tuviera la misma llave.
// =============================================================================

const subtle = (): SubtleCrypto => {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error('Este navegador no puede cifrar (falta WebCrypto).');
  return s;
};
const enc = new TextEncoder();
const dec = new TextDecoder();

export function aBase64url(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function deBase64url(s: string): Uint8Array {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}

export const alAzar = (n: number): Uint8Array => globalThis.crypto.getRandomValues(new Uint8Array(n));

/** La DEK que dio el servidor (32 bytes), lista para cifrar. No se puede volver a sacar del navegador. */
export async function importarLlave(cruda: Uint8Array): Promise<CryptoKey> {
  if (cruda.length !== 32) throw new Error('La llave tiene que medir 32 bytes.');
  return subtle().importKey('raw', cruda as BufferSource, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

/** La KEK de la clave de esta computadora. */
export async function llaveDeLaClave(clave: string, sal: Uint8Array, vueltas: number): Promise<CryptoKey> {
  const base = await subtle().importKey('raw', enc.encode(clave) as BufferSource, 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: sal as BufferSource, iterations: vueltas },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
}

export type Cifrado = { iv: string; datos: string };

export async function cifrarBytes(bytes: Uint8Array, llave: CryptoKey, aad: string): Promise<Cifrado> {
  const iv = alAzar(12);
  const datos = new Uint8Array(await subtle().encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource, additionalData: enc.encode(aad) as BufferSource }, llave, bytes as BufferSource));
  return { iv: aBase64url(iv), datos: aBase64url(datos) };
}

/** Tira si la llave o el AAD no son los de quien lo cifró (AES-GCM no devuelve basura: falla). */
export async function descifrarBytes(c: Cifrado, llave: CryptoKey, aad: string): Promise<Uint8Array> {
  return new Uint8Array(await subtle().decrypt(
    { name: 'AES-GCM', iv: deBase64url(c.iv) as BufferSource, additionalData: enc.encode(aad) as BufferSource },
    llave, deBase64url(c.datos) as BufferSource));
}

export const cifrarJson = (x: unknown, llave: CryptoKey, aad: string): Promise<Cifrado> =>
  cifrarBytes(enc.encode(JSON.stringify(x)), llave, aad);

export async function descifrarJson<T>(c: Cifrado, llave: CryptoKey, aad: string): Promise<T> {
  return JSON.parse(dec.decode(await descifrarBytes(c, llave, aad))) as T;
}

/** La huella de una DEK: SHA-256 en base64url. Dice si dos llaves son la misma sin guardar ninguna en claro. */
export async function huellaDe(llave: Uint8Array): Promise<string> {
  return aBase64url(new Uint8Array(await subtle().digest('SHA-256', llave as BufferSource)));
}

/** El nombre de la base de una persona: un hash de su email. No hay una lista de quién guardó en esta computadora. */
export async function nombreDeBase(emailNormalizado: string): Promise<string> {
  const h = new Uint8Array(await subtle().digest('SHA-256', enc.encode(`mako-sin-conexion|v1|${emailNormalizado}`) as BufferSource));
  return `mako-sc-${Array.from(h.subarray(0, 16), (b) => b.toString(16).padStart(2, '0')).join('')}`;
}
