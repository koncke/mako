// =============================================================================
// Las medidas de la ficha del lead, en UN lugar
// =============================================================================
// Las lee más de una pieza: el pop-up (app/crm/LeadSheet.tsx), la ruta (app/crm/[id]/page.tsx) y
// el esqueleto que se pinta mientras la ficha carga (app/crm/LeadEditModal.tsx). Con un número por
// archivo, el esqueleto de 760 abría y medio segundo después la ficha saltaba a otro ancho.
// Sin 'use client' ni 'use server': son datos, los importa cualquiera.
// =============================================================================

/**
 * El ancho del pop-up de la ficha. Pedido de Martín (12/10/2026, punto 14): «Quiero que el modal
 * del detalle del lead sea bastante más ancho, para aprovechar más el espacio». Eran 760; en una
 * pantalla chica el pop-up igual se topea al viewport (`width: 100%` + este máximo).
 */
export const ANCHO_FICHA_LEAD = 1100;

/**
 * El margen del pop-up contra el borde de la ventana, arriba y abajo. Pedido de Martín (12/10/2026,
 * tercer feedback del CRM, punto 8): «todo lo que está abajo de las tabs, siento que esta muy
 * compacto… le falta "largo", tengo que hacer mucho scroll». Eran hasta 48 px por lado
 * (`clamp(16px,4vw,48px)`) y el panel tenía un alto MÁXIMO, así que encima se achicaba con poco
 * contenido. Ahora es de 12 px y el alto es FIJO (`ALTO_FICHA_LEAD`): la ficha ocupa la ventana
 * entera, y no cambia de tamaño según la tab (AGENTS.md → «Una caja cuyo alto es un TOPE…»).
 */
export const MARGEN_FICHA_LEAD = 12;

/** El alto del pop-up: la ventana menos el margen de arriba y el de abajo. */
export const ALTO_FICHA_LEAD = `calc(100dvh - ${MARGEN_FICHA_LEAD * 2}px)`;

/**
 * El alto del chat de MaKo Analyst adentro del pop-up: lo que queda visible del cuerpo debajo de la
 * cabecera fija y la fila de pestañas, con un piso para que en una ventana baja siga siendo un chat.
 * El chat «ocupa el alto que le den» (app/crm/lead-view/MakoAnalystLead.tsx): éste es el que se le da.
 * El piso es el mismo `minHeight` de 420 que el chat se pone a sí mismo: con uno menor, el chat se
 * salía de su caja por abajo.
 */
// ⚠️ Era `100dvh - 470px` con el margen de hasta 96 px (arriba + abajo); con el de 24 px del punto 8
// el cuerpo ganó ~72 px, y el chat los gana con él.
export const ALTO_CHAT_EN_EL_POPUP = 'max(420px, calc(100dvh - 398px))';

/** El mismo chat en la ruta /crm/[id], donde scrollea la página entera. */
export const ALTO_CHAT_EN_LA_RUTA = 'clamp(420px, 70vh, 680px)';
