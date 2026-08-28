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
 * ⚠️ EN `false` A PROPÓSITO, aunque la extensión SÍ esté aprobada y pública.
 *
 * Aprobada el 28/08/2026 (verificado: la ficha devuelve 200 y trae el botón de
 * instalar). Y aun así el camino que se ofrece es el zip, porque **cada versión
 * nueva pasa por revisión** y esto todavía se está descubriendo: en un solo día
 * la extensión fue de 0.1.0 a 0.5.0, y cuatro de esos cinco cambios eran la
 * diferencia entre funcionar y no.
 *
 * El zip NO tiene ese problema: `scripts/zip-extension.mjs` lo regenera y el
 * pre-push falla si quedó viejo, así que lo que Vercel sirve es siempre lo último
 * que se pusheó. La tienda, mientras tanto, tiene la versión del día que se
 * aprobó — que hoy es la 0.1.0, o sea la que fallaba TODO.
 *
 * **Cuándo pasarlo a `true`:** cuando una versión aguante unos días sin cambios y
 * se suba ESA a la tienda. La ventaja de la tienda es real (se instala con un
 * clic y se actualiza sola); solo que llega después de la estabilidad, no antes.
 */
export const EXTENSION_EN_TIENDA = false;

/**
 * La URL canónica, con el slug que le puso Google.
 *
 * Sin el slug también resuelve, pero con un redirect de por medio: un link que
 * rebota es un link que a veces no llega. Este es el que muestra la tienda.
 */
export const EXTENSION_URL_TIENDA = `https://chromewebstore.google.com/detail/mako/${EXTENSION_ID}`;

/** El zip que sirve Vercel, para instalar a mano mientras la tienda no esté. */
export const EXTENSION_URL_ZIP = '/mako-puente.zip';
