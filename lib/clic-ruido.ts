// =============================================================================
// Los clics que NO son de la persona: el sello del constructor de la landing
// =============================================================================
// El Pixel captura todo clic de la página, y una landing hecha con un constructor
// lleva pegado SU PROPIO badge («Edit with Lovable», el banner de Wix, la marca de
// Framer). Ese clic no lo da el lead sobre el contenido del negocio: lo da sobre
// una herramienta nuestra-ajena que viaja encima de la página.
//
// MEDIDO el 05/10/2026 contra producción: de los 441 clics del ws1, **208 son el
// badge de Lovable** — casi la mitad. El primer renglón del recorrido de un lead
// decía «Hizo clic en "Edit with" — lovable.dev/projects/…», o sea que lo primero
// que se lee de lo que hizo una persona era el cartelito del editor. En el ws11 y
// el ws13 el mismo patrón da 0: no es un problema de todos, es de quien usa ese
// constructor, y por eso no se puede descartar «lo raro» a ojo.
//
// SE FILTRA AL LEER Y NO AL CAPTURAR, a propósito: el snippet vive en la página del
// cliente, así que un arreglo allá sólo vale para quien vuelva a pegar el código —
// y no limpia los 208 que ya están guardados. Acá vale para los dos.
//
// ⚠️ Y el evento NO se borra de la base. Lo que se saca es el renglón de la ficha:
// si mañana hace falta medir cuánta gente toca el badge, el dato está. Es la regla
// de la casa — una política puede rechazar, no puede no dejar rastro.
//
// Sin `server-only` a propósito: lo leen el lector de eventos (server) y el test.

/**
 * Marcas de un constructor de páginas en el destino o el texto de un clic.
 *
 * ⚠️ Cada patrón apunta al SELLO, no al producto. `lovable.dev` sólo aparece en el
 * badge —la landing del negocio vive en su propio dominio—, y por eso alcanza con
 * el host. Donde el host es ambiguo (un sitio de Wix publicado vive en wix.com), se
 * pide además la marca del editor, o el filtro se llevaría puesto el contenido real.
 */
const SELLOS: readonly RegExp[] = [
  /\blovable\.dev\b/i,
  /\bedit\s+with\b/i,
  /\bwix\.com\/(editor|website-builder)\b/i,
  /\bframer\.com\/projects\b/i,
  /\bwebflow\.io\/\?edit\b/i,
  /\bmade\s+(in|with)\s+(webflow|framer|wix|lovable)\b/i,
  /\bbuilt\s+with\s+(webflow|framer|wix|lovable)\b/i,
];

/**
 * ¿Este clic es del sello del constructor y no de la persona?
 *
 * Recibe lo que el evento trae como detalle (el destino y/o el texto del elemento).
 * Un detalle vacío NO es ruido: un clic sin destino es un clic sobre algo del
 * negocio que el snippet no supo nombrar, y esconderlo sería tirar un dato real.
 */
export function esClicDelConstructor(detalle: string | null | undefined): boolean {
  const t = (detalle ?? '').trim();
  if (!t) return false;
  return SELLOS.some((re) => re.test(t));
}
