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
 * APROBADA Y PUBLICADA el 28/08/2026. Verificado: la ficha devuelve 200 y trae
 * el botón de instalar.
 *
 * Queda en `true` y no se toca. Si alguna vez Google baja la extensión, esto
 * vuelve a `false` y la pantalla recupera sola el camino del zip — por eso el
 * camino viejo sigue en el código en vez de borrarse.
 */
export const EXTENSION_EN_TIENDA = true;

/**
 * La URL canónica, con el slug que le puso Google.
 *
 * Sin el slug también resuelve, pero con un redirect de por medio: un link que
 * rebota es un link que a veces no llega. Este es el que muestra la tienda.
 */
export const EXTENSION_URL_TIENDA = `https://chromewebstore.google.com/detail/mako/${EXTENSION_ID}`;

/** El zip que sirve Vercel, para instalar a mano mientras la tienda no esté. */
export const EXTENSION_URL_ZIP = '/mako-puente.zip';
