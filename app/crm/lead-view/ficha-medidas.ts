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
 * El alto del chat de MaKo Analyst adentro del pop-up: lo que queda visible del cuerpo debajo de la
 * cabecera fija y la fila de pestañas, con un piso para que en una ventana baja siga siendo un chat.
 * El chat «ocupa el alto que le den» (app/crm/lead-view/MakoAnalystLead.tsx): éste es el que se le da.
 * El piso es el mismo `minHeight` de 420 que el chat se pone a sí mismo: con uno menor, el chat se
 * salía de su caja por abajo.
 */
export const ALTO_CHAT_EN_EL_POPUP = 'max(420px, calc(100dvh - 470px))';

/** El mismo chat en la ruta /crm/[id], donde scrollea la página entera. */
export const ALTO_CHAT_EN_LA_RUTA = 'clamp(420px, 70vh, 680px)';
