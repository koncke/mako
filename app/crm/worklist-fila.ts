// =============================================================================
// worklist-fila — cómo se LEE una fila de «Datos sin marcar»
// =============================================================================
// El dato que llega del server (`PendienteItem.mensaje`) es una frase larga con el
// detalle adentro:
//
//   «La Reunión 1 del 12/09 ya pasó y todavía no se marcó cómo salió · pendiente:
//    Setter asignado · Empresa · Link de Fathom (R1)»
//
// Eso es correcto COMO DATO —lo consume Vista General, los avisos y «Marcar en
// lote»— y es ilegible como fila: con 20 leads pendientes son 20 párrafos, y lo
// único que cambia entre uno y otro está al final.
//
// Acá se PARTE en sus dos mitades sin tocar el dato: el motivo (qué pasó) y los
// faltantes (qué datos). El motivo va como texto; los faltantes ya viajan
// estructurados en `faltantes[]` y se dibujan como chips.
//
// ⚠️ NO SE TOCA `mensaje` EN EL SERVER. El detalle tiene que seguir adentro del
// dato: si se lo saca de ahí, «Marcar en lote» pierde esos leads y los avisos
// pierden su texto. Esto es una decisión de LECTURA, y por eso vive del lado del
// que dibuja.
//
// Sin `server-only` a propósito: lo importa un componente cliente y lo importa un
// test.

/** El separador con el que el server pega el detalle al final del motivo. */
const SEPARADOR = ' · pendiente:';

/**
 * El motivo, sin el detalle que los chips ya dicen.
 *
 * Devuelve `''` cuando el mensaje entero ERA el detalle (los items de tipo 'A'
 * dicen «Faltan: a · b · c» y nada más): ahí el motivo es redundante con los chips
 * y una fila que repite dos veces lo mismo es la que se lee como un párrafo.
 */
export function motivoCorto(mensaje: string): string {
  const m = mensaje.trim();
  if (m.startsWith('Faltan:')) return '';
  const i = m.indexOf(SEPARADOR);
  return (i >= 0 ? m.slice(0, i) : m).trim();
}

/**
 * Los faltantes que se dibujan y cuántos quedan afuera.
 *
 * El tope existe porque un lead puede tener seis o siete, y siete chips vuelven a
 * ser el párrafo que esto viene a sacar. El resto no se esconde: se cuenta.
 */
export function chipsFaltantes<T>(faltantes: T[] | undefined, tope = 3): { chips: T[]; resto: number } {
  const f = faltantes ?? [];
  return { chips: f.slice(0, tope), resto: Math.max(0, f.length - tope) };
}
