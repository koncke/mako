// =============================================================================
// detalle-fusion — sumar contexto a una descripción sin pisar lo que ya decía
// =============================================================================
// El Perro (checklist-coach) reescribe el `detalle` de una tarjeta para que deje de
// ser un renglón y pase a explicarse sola. El prompt le pide ampliar y NUNCA acortar,
// pero un prompt no es una garantía: el código escribía `patch.detalle = enr.detalle`
// y con eso una pasada del Perro podía tirar a la basura lo que había escrito una
// persona, o el contenido literal de una reunión.
//
// Función pura, sin dependencias: la usan los dos tableros (el del dueño y el del
// cliente) para que la regla sea UNA sola y no dos copias que se desincronizan.
// =============================================================================

const norm = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * Devuelve la descripción que hay que guardar.
 * · Si el texto nuevo YA CONTIENE el arranque del viejo, es una ampliación de verdad
 *   → gana el nuevo (si no, quedaría el mismo párrafo dos veces).
 * · Si no, se conservan los dos: primero lo que ya estaba, después lo que sumó MaKo.
 * · Si el nuevo viene vacío, no se toca nada.
 */
export function fusionarDetalle(original: string, delPerro: string): string {
  const o = (original ?? '').trim();
  const p = (delPerro ?? '').trim();
  if (!p) return o;
  if (!o) return p;
  const cabeza = norm(o).slice(0, 60);
  if (cabeza.length >= 20 && norm(p).includes(cabeza)) return p;
  return `${o}\n\n${p}`;
}
