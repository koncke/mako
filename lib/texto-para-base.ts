// =============================================================================
// texto-para-base — saca del texto lo que Postgres no acepta guardar
// =============================================================================
// Un PDF, un .docx o una página web pueden traer caracteres de control adentro del texto
// extraído; el más común es el NUL (U+0000). Postgres no lo acepta en un `text` ni en un
// `jsonb`: el guardado entero falla con «unsupported Unicode escape sequence» (22P05).
// Medido el 11/10/2026: un PDF subido a la tab Offer («DOC_2__OFERTA_Y_AVATAR.pdf») tiró
// «guardar la conversación #1 falló: unsupported Unicode escape sequence», y la persona no
// tenía forma de saber que el problema era un carácter invisible de su archivo.
//
// Lo mismo pasa con un sustituto UTF-16 suelto (la mitad de un emoji cortado): JSON.stringify
// lo escribe como `\udXXX` y la base lo rechaza.
//
// Se conservan \t, \n y \r (son texto) y los pares de sustitutos válidos (los emoji).
// Sin `server-only`: es puro y lo importa un test.
// =============================================================================

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const SUSTITUTO_SUELTO = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/** El texto sin los caracteres que la base rechaza. */
export function textoParaBase(s: string): string {
  return s.replace(CONTROL, '').replace(SUSTITUTO_SUELTO, '');
}

/** Lo mismo, recorriendo un objeto o una lista entera (para una fila que va a un `jsonb`). */
export function limpiarParaBase<T>(v: T): T {
  if (typeof v === 'string') return textoParaBase(v) as T;
  if (Array.isArray(v)) return v.map((x) => limpiarParaBase(x)) as T;
  if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[k] = limpiarParaBase(x);
    return out as T;
  }
  return v;
}
