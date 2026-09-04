// =============================================================================
// extension-tienda — de dónde sale la extensión que instala el cliente
// =============================================================================
// SIN `server-only`: lo lee la pantalla del Video Generator, que es un client
// component.

import { EXTENSION_VERSION } from './extension-version';
import { esMasVieja } from './version-comparar';
//
// Hay dos caminos y el que vale depende de un hecho externo: QUE VERSION tiene
// publicada la Chrome Web Store.
//
//   - la tienda esta AL DIA  → «Añadir a Chrome». Un clic, y se actualiza sola.
//   - la tienda va ATRAS     → el zip, que Vercel sirve siempre al dia.
//
// ⚠️ ACA HABIA UN BOOLEANO QUE ALGUIEN MOVIA A MANO, Y SE PODIA MOVER MAL.
//
// Su comentario decia «la tienda tiene la 0.1.0». Medido el 02/09/2026: tiene la
// 0.5.0, publicada el 28/08. O sea que el dato que alguien iba a leer antes de
// decidir estaba mal — y con el booleano nada lo impedia: ponerlo en true habria
// mandado a TODO cliente nuevo a instalar un paquete 33 versiones atras, sin
// dejar ningun camino en la pantalla al zip que si funciona.
//
// Y el problema de fondo no era el comentario viejo: es que un booleano hay que
// DESHACERLO en cada version nueva. El repo avanza en cada push y la tienda sube
// solo cuando alguien publica Y Google aprueba, asi que la ventana «repo adelante
// de la tienda» no es una excepcion: es el estado normal.
//
// Ahora se declara EL HECHO —que version tiene la tienda— y el permiso se DERIVA.
// Ofrecerla con una version vieja pasa a ser imposible de escribir.

/** El id que asignó la Chrome Web Store al subir el paquete. No cambia. */
export const EXTENSION_ID = 'gapbemdaaghomjbnggechglkpmbgplle';

/**
 * La versión que la Chrome Web Store tiene PUBLICADA hoy.
 *
 * ⚠️ ES UNA MEDICION, NO UN RECUERDO. Se saca corriendo:
 *
 *     node scripts/version-en-tienda.mjs
 *
 * que lee la ficha publica y devuelve lo que Google le muestra a cualquiera.
 *
 * ⚠️ Y NO SIRVE el `crxVersion` de `publicar-extension.mjs --estado`: ese pega a
 * `?projection=DRAFT`, o sea que devuelve lo ULTIMO QUE SE SUBIO y se pone al dia
 * apenas termina el PUT, no cuando Google aprueba. Creerle habria prendido la
 * tienda mientras la tienda publica seguia sirviendo la version vieja — que es
 * exactamente el daño que este archivo viene a evitar.
 *
 * Medido el 02/09/2026: la ficha declara «Versión 0.5.0 · Fecha de actualización:
 * 28 de agosto de 2026», y el manifest que trae embebido dice lo mismo.
 */
export const VERSION_EN_TIENDA = '0.5.0';

/**
 * ¿Se le puede ofrecer la tienda a alguien que instala hoy?
 *
 * Solo si lo que Google publica NO va atras de lo que sirve el zip. Se compara
 * con `esMasVieja`, que ya existe, esta testeada y tiene una gemela en la propia
 * extension: escribir otra comparacion acá recrearia la falla que el repo ya pagó
 * —comparar versiones como TEXTO— y justo en el caso que hay hoy, donde «0.5.0» es
 * MAYOR que «0.38.7» como número y MENOR como versión.
 *
 * ⚠️ EL MODO DE FALLA POR OLVIDO ES SEGURO, y conviene dejarlo escrito para que
 * nadie lo «arregle» despues: si alguien publica en la tienda y se olvida de
 * actualizar `VERSION_EN_TIENDA`, esto queda en `false` y se sigue ofreciendo el
 * zip — que siempre está al día. Desactualizar esta constante solo puede APAGAR la
 * tienda, nunca prenderla de más.
 *
 * Se mantiene el nombre exportado para no tocar a los tres consumidores
 * (`next.config.ts`, `app/extension/instalar/page.tsx`, `puente-avisos.tsx`).
 */
export const EXTENSION_EN_TIENDA = !esMasVieja(VERSION_EN_TIENDA, EXTENSION_VERSION);
export const EXTENSION_URL_TIENDA = `https://chromewebstore.google.com/detail/mako/${EXTENSION_ID}`;

/** El zip que sirve Vercel, para instalar a mano mientras la tienda no esté. */
/**
 * ⚠️ LA URL LLEVA LA VERSION, Y SE DERIVA — no se escribe.
 *
 * Una URL fija puede servir bytes viejos desde tres caches distintos y, peor, deja
 * dos archivos con el mismo nombre en la carpeta de Descargas de quien ya bajo una
 * vez. Con la version adentro, cada release es una direccion nueva: no hay cache que
 * pueda contestar la anterior, y el archivo dice cual es sin abrirlo.
 *
 * Derivada de `EXTENSION_VERSION` y no escrita a mano por lo mismo que esa constante
 * se genera: un numero copiado se queda viejo el dia que alguien suba el manifest y
 * no lo toque, y el sintoma seria un 404 en el unico boton que instala el producto.
 */
export const EXTENSION_URL_ZIP = `/mako-puente-${EXTENSION_VERSION}.zip`;
