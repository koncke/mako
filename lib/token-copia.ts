// =============================================================================
// token-copia — el TOKEN corto con que se comparte una copia de algo de MaKo («MAKO-DASH-…», «MAKO-FLUJO-…»)
// =============================================================================
// Nació en Automations (decimoquinta tanda, 12/10/2026, lib/flujo-copia.ts): «Copiar flujo» guarda la copia en el server
// y el portapapeles lleva sólo un token, que se pasa por WhatsApp y al pegarlo se lee «Flujo copiado: <nombre>». El
// Dashboard pidió lo mismo (Martín, 12/10/2026: «los dashboards también deberían poder copiarse y enviarse con ese
// token»), así que la mecánica del token sale acá, con el PREFIJO por parámetro: el prefijo dice qué es (también en un
// WhatsApp) y cada cosa tiene su tabla.
//
// ⚠️ lib/flujo-copia.ts todavía tiene su propia copia de esta mecánica (con `MAKO-FLUJO-`): la escribió otra sesión el
// mismo día y no se tocó para no pisarle el archivo. Cuando se toque, que delegue acá (mismo alfabeto, mismo largo,
// mismo regex: el check de la mig 0265 y el de la 0268 dicen lo mismo).
//
// Puro y sin `server-only`: lo usan la pantalla (reconocer un token pegado), la ruta (acuñarlo) y el test.
// =============================================================================

/** Crockford base 32: sin I, L, O ni U (no se confunden al dictarlo ni al copiarlo a mano). 32 letras = 5 bits cada una. */
const ALFABETO = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
/** Las letras al azar del token: 10 × 5 = 50 bits. */
export const LARGO_TOKEN_COPIA = 10;
/** El tope del texto que se mira: lo pegado puede ser un párrafo, no un libro. */
const TOPE_TEXTO = 400_000;

const reDe = (prefijo: string, flags = 'i') => new RegExp(`${prefijo}([0-9A-HJKMNP-TV-Z]{${LARGO_TOKEN_COPIA}})(?![0-9A-Z])`, flags);

/**
 * Un token desde bytes al azar (el server le pasa `randomBytes(LARGO_TOKEN_COPIA)`). `& 31` sobre un byte parejo es
 * parejo (256 es múltiplo de 32). Con menos bytes de los que hacen falta, tira.
 */
export function tokenDeBytesCon(prefijo: string, bytes: ArrayLike<number>): string {
  if (bytes.length < LARGO_TOKEN_COPIA) throw new Error(`tokenDeBytesCon: hacen falta ${LARGO_TOKEN_COPIA} bytes`);
  let s = prefijo;
  for (let i = 0; i < LARGO_TOKEN_COPIA; i++) s += ALFABETO[bytes[i] & 31];
  return s;
}

/** El token con ese prefijo que hay en un texto (pegado solo o en una frase), normalizado a mayúsculas. Si no, null. */
export function tokenEnTexto(prefijo: string, texto: unknown): string | null {
  if (typeof texto !== 'string' || texto.length > TOPE_TEXTO) return null;
  const m = reDe(prefijo).exec(texto);
  return m ? `${prefijo}${m[1].toUpperCase()}` : null;
}

/** Lo pegado SIN el token (lo demás que se escribió queda): `null` si no trae un token con ese prefijo. */
export function sacarToken(prefijo: string, texto: string): { token: string; resto: string } | null {
  const token = tokenEnTexto(prefijo, texto);
  if (!token) return null;
  const resto = texto.replace(reDe(prefijo, 'ig'), ' ').replace(/[ \t]{2,}/g, ' ').trim();
  return { token, resto };
}
