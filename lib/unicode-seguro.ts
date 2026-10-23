// =============================================================================
// unicode-seguro — un texto que va a la base no puede llevar MEDIO emoji
// =============================================================================
// Medido el 23/10/2026 en el ws13 (Código Inmobiliario): 20 avisos seguidos en 'fallo' del 13/10 al 22/10 con «No se
// pudo registrar la acción pendiente.», y cada lead nuevo cerrado sin aviso. El resumen de `avisar_al_equipo` cortaba el
// mensaje con `mensaje.slice(0, 120)`, y en ese texto la unidad 119 era la primera mitad de un emoji (U+D83D). Un `slice`
// cuenta unidades UTF-16, no caracteres: deja un surrogate SUELTO. `JSON.stringify` lo manda escapado («\ud83d») y Postgres
// rechaza el pedido entero: «invalid input syntax for type json» (medido contra producción con un `select …::jsonb`, sin
// tocar ninguna tabla). El payload iba entero y entraba: por eso probar el insert con el payload exacto daba verde.
//
// Sin `server-only` ni imports, a propósito: lo usan los runners, `crearPendiente` y los tests.
// =============================================================================

/** Un surrogate alto sin su bajo, o un bajo sin su alto. */
const RE_SUELTO = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/** El texto sin mitades de emoji (se sacan: un «?» o un «�» en el medio de un aviso se lee peor que nada). */
export function sinMediosEmojis(s: string): string {
  return s.replace(RE_SUELTO, '');
}

/** Los primeros `tope` caracteres como `slice(0, tope)`, sin dejar medio emoji al final. */
export function cortarSinPartir(s: string, tope: number): string {
  return sinMediosEmojis(String(s ?? '').slice(0, Math.max(0, tope)));
}

/** Un objeto de datos con TODOS sus textos sin mitades de emoji (para un jsonb: el mismo rechazo). Lo que no es texto, igual. */
export function datosSinMediosEmojis<T>(v: T): T {
  if (typeof v === 'string') return sinMediosEmojis(v) as T;
  if (Array.isArray(v)) return v.map((x) => datosSinMediosEmojis(x)) as T;
  if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) {
    return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [sinMediosEmojis(k), datosSinMediosEmojis(x)])) as T;
  }
  return v;
}
