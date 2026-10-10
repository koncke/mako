// =============================================================================
// Dónde y de qué ancho se abre el panel de «Filtrar» del CRM
// =============================================================================
// Pedido de Martín (10/10/2026), sobre el árbol de campañas y anuncios: «El ancho del
// desplegable debe ser más grande. Bajo ningún motivo debe tener scroll hacia la derecha».
//
// Un panel más ancho que abre pegado al botón puede pasar el borde derecho de la ventana, y
// eso es exactamente el scroll lateral que se pidió que no exista. Así que el ancho sale de
// lo que hay: el deseado si entra, y si no se corre a la izquierda lo justo. Puro y sin
// 'use client' para que el test lo EJECUTE (tests/crm-filtro-ads.test.ts).
//
// ⚠️ Y el tope de la IZQUIERDA no es el borde de la ventana: es el del CONTENIDO. La barra
// lateral (68 px, fija) queda encima de todo; medido el 10/10/2026 a 390 px de ancho, un
// panel corrido hasta x=16 quedaba con su primer tercio debajo de ella.
// =============================================================================

/** El ancho del panel cuando entra: con 262 px los nombres de anuncio se cortaban a la mitad. */
export const ANCHO_PANEL = 360;
/** Lo que queda libre entre el panel y cada borde. */
export const MARGEN_VENTANA = 16;

/**
 * `izqBoton` es la x del botón; `izqMin`, la x más a la izquierda que el panel puede ocupar
 * (el borde del contenido más el margen). Devuelve el ancho y el corrimiento respecto del
 * botón (0 = alineado con él, negativo = hacia la izquierda). El borde derecho nunca pasa
 * `anchoVentana - MARGEN_VENTANA` y el izquierdo nunca baja de `izqMin`: el ancho ya viene
 * topeado a lo que entra entre los dos.
 */
export function lugarDelPanel(izqBoton: number, anchoVentana: number, izqMin = MARGEN_VENTANA): { ancho: number; izq: number } {
  const ancho = Math.max(0, Math.min(ANCHO_PANEL, anchoVentana - MARGEN_VENTANA - izqMin));
  const sobra = izqBoton + ancho - (anchoVentana - MARGEN_VENTANA);
  return { ancho, izq: sobra > 0 ? -sobra : 0 };
}
