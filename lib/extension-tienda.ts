// =============================================================================
// extension-tienda — de dónde sale la extensión que instala el cliente
// =============================================================================
// SIN `server-only`: lo lee la pantalla del Video Generator, que es un client
// component.
//
// Hay dos caminos y el que vale depende de un hecho externo que ningún código
// puede consultar: si la Chrome Web Store ya aprobó la extensión.
//
//   - APROBADA   → «Añadir a Chrome» desde la tienda. Un clic.
//   - NO APROBADA → descargar el ZIP e instalarlo en modo desarrollador.
//
// Por eso es un flag a mano y no una detección: el link de la tienda **da 404
// hasta que la revisión termina**, así que mostrarlo antes de tiempo es mandar
// al cliente a una página rota. Y no hay forma de preguntarle a Google si ya
// aprobó sin scrapear su HTML, que se rompería en silencio el día que cambien la
// página — peor que un booleano que alguien mueve una vez.
//
// Enviada a revisión el 26/08/2026.

/** El id que asignó la Chrome Web Store al subir el paquete. No cambia. */
export const EXTENSION_ID = 'gapbemdaaghomjbnggechglkpmbgplle';

/**
 * ⚠️ PONER EN `true` CUANDO LA REVISIÓN APRUEBE, y no antes.
 *
 * Es el único cambio que hace falta: la pantalla pasa sola de «descargar el zip»
 * a «añadir a Chrome», y el instructivo de instalación manual desaparece.
 */
export const EXTENSION_EN_TIENDA = false;

export const EXTENSION_URL_TIENDA = `https://chromewebstore.google.com/detail/${EXTENSION_ID}`;

/** El zip que sirve Vercel, para instalar a mano mientras la tienda no esté. */
export const EXTENSION_URL_ZIP = '/mako-puente.zip';
