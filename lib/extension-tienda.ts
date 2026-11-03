// =============================================================================
// extension-tienda — de dónde sale la extensión que instala el cliente
// =============================================================================
// SIN `server-only`: lo lee la pantalla del Video Generator, que es un client
// component.

import { EXTENSION_VERSION } from './extension-version';
import { esMasVieja } from './version-comparar';
//
// UN SOLO CAMINO: LA CHROME WEB STORE. Martín, 3/11/2026: «dijimos que ya no se
// descarga nada, solo por el instalador de extensiones de chrome». Toda pantalla
// lleva a «Agregar a Chrome» (`EXTENSION_URL_TIENDA`), también con la tienda atrás
// del repo.
//
// ⚠️ ACA HUBO UN FLAG, `EXTENSION_EN_TIENDA`, Y NO VUELVE. Decía «la tienda no va
// atras del zip» y de eso colgaba QUE se ofrecia. Pero el repo avanza en cada push y
// la tienda sube solo cuando alguien publica Y Google aprueba, asi que «repo adelante
// de la tienda» es el estado normal: bastaba una version nueva, por chica que fuera,
// para que a cada cliente le volviera a aparecer «Descargar» (la 0.74.4 contra la
// 0.74.3, 3/11/2026). Y el zip no es un plan B para un cliente: pide Modo de
// desarrollador y una carpeta que no se puede borrar, y despues no se actualiza nunca.
//
// Lo que el flag protegia sigue protegido, pero ya no decide que se ofrece:
//   · la version de la TIENDA no se recuerda, se mide (`VERSION_EN_TIENDA`);
//   · una funcion que necesita mas version lo dice en una linea (`lineaDeVersion`);
//   · el aviso «quedo vieja» compara contra lo que la persona PUEDE tener hoy
//     (`copiaQuedoVieja`), no contra el repo.

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
 * apenas termina el PUT, no cuando Google aprueba.
 *
 * Medido el 02/09/2026: la ficha declara «Versión 0.5.0 · Fecha de actualización:
 * 28 de agosto de 2026», y el manifest que trae embebido dice lo mismo.
 * Medido otra vez el 27/10/2026 (`node scripts/version-en-tienda.mjs`): publica la 0.39.1.
 */
// Medido el 2/11/2026 con `node scripts/version-en-tienda.mjs`: decía 0.39.1, o sea TREINTA Y
// CINCO versiones atrás de lo que Google publica. Medido otra vez el 3/11/2026: 0.74.3.
export const VERSION_EN_TIENDA = '0.74.3';
export const EXTENSION_URL_TIENDA = `https://chromewebstore.google.com/detail/mako/${EXTENSION_ID}`;

/**
 * ¿Esta extensión quedó vieja Y HAY ALGO QUE HACER?
 *
 * Solo si es una COPIA (no vino de la tienda: ahí la actualiza Chrome, y `null` es «no sé»,
 * no «no») y la tienda ya tiene algo más nuevo. Contra `EXTENSION_VERSION` no se compara: esa
 * es la del repo, y pedirle a alguien una versión que no puede conseguir es un aviso sin salida.
 */
export function copiaQuedoVieja(instalada: string, deLaTienda: boolean | null): boolean {
  return deLaTienda !== true && esMasVieja(instalada, VERSION_EN_TIENDA);
}

/** La línea de una función que pide más versión que la que la tienda ya publica: actualizar no la traería. */
export const LLEGA_CON_LA_PROXIMA = 'Llega con la próxima versión de la extensión de MaKo: Chrome la actualiza sola.';

/**
 * Lo que dice una función cuando la extensión de esta persona no le alcanza: UNA línea.
 * `minima` es la versión que pide la función y `frase`, lo que dice siempre, que vale mientras
 * la tienda ya la tenga. Si la tienda no llegó, mandar a actualizar no serviría.
 */
export function lineaDeVersion(minima: string, frase: string): string {
  return esMasVieja(VERSION_EN_TIENDA, minima) ? LLEGA_CON_LA_PROXIMA : frase;
}

/**
 * Lo que el puente le contesta a la extensión como «la versión esperada»: ninguna.
 *
 * Con la versión de verdad, el desplegable de una copia que quedara atrás se TRABA en
 * «Actualiza la extensión… vuelve a cargarla descomprimida» (extension/popup.js) y ese texto vive
 * en la carpeta de la persona: desde acá no se puede cambiar. `'0'` y no vacío: el vacío no pisa
 * lo que ya guardó (`anotarVersionEsperada`) y seguiría trabada. La avisa la web, que sí se puede.
 */
export const VERSION_ESPERADA_DEL_PUENTE = '0';

/**
 * ⚠️ SOLO PARA DESARROLLO: la carpeta de Martín y `/mako-puente.zip`. Ninguna pantalla de
 * usuario la enlaza (lo frena tests/extension-sin-zip-con-tienda.test.ts).
 *
 * ⚠️ LA URL LLEVA LA VERSION, Y SE DERIVA — no se escribe.
 *
 * Una URL fija puede servir bytes viejos desde tres caches distintos y, peor, deja
 * dos archivos con el mismo nombre en la carpeta de Descargas de quien ya bajo una
 * vez. Con la version adentro, cada release es una direccion nueva: no hay cache que
 * pueda contestar la anterior, y el archivo dice cual es sin abrirlo.
 *
 * Derivada de `EXTENSION_VERSION` y no escrita a mano por lo mismo que esa constante
 * se genera: un numero copiado se queda viejo el dia que alguien suba el manifest y
 * no lo toque, y el sintoma seria un 404.
 */
export const EXTENSION_URL_ZIP = `/mako-puente-${EXTENSION_VERSION}.zip`;
