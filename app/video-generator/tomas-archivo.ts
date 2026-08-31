/**
 * Descartar un clip para rehacer la toma — sin perderlo.
 *
 * ── Por qué existe ──────────────────────────────────────────────────────────
 * «Rehacer la toma N» es `descartarTomaAction` + `generarTomaAction` en un solo
 * click, y el primero hacía `delete`. O sea: el clip pagado —~15 créditos— se
 * borraba ANTES de saber si el segundo podía filmar, y el segundo tiene cinco
 * motivos para devolver sin filmar nada (escenario sin confirmar, puente sin
 * conectar, sesión marcada por Google, sesión de Flow vencida, sin `mediaId`).
 * Con cualquiera de ellos se pagaba un clip a cambio de nada.
 *
 * El propio docstring de `descartarTomaAction` decía que los dos pasos están
 * separados a propósito «porque borrar un clip pagado no puede ser un efecto
 * lateral de apretar generar» — y los tres call-sites de la pantalla los volvían
 * a juntar en uno. Una intención escrita en un comentario no es una garantía.
 *
 * ── Por qué vive en su propio módulo ────────────────────────────────────────
 * `video-action.ts` es `'use server'` y ahí todo export tiene que ser async, así
 * que una regla pura no se puede exportar ni testear. Mismo criterio que
 * `tomas-invalidar.ts` y `variantes-imagen.ts`.
 */

import type { MarcaVideo } from './video-datos';

/** Lo que queda guardado de un intento: sin su propio archivo, para no anidar. */
const plano = (m: MarcaVideo): MarcaVideo => ({ ...m, descartadas: undefined });

/**
 * Saca el clip actual de la toma y lo guarda.
 *
 * ⚠️ Sólo se archiva lo que TIENE `url`: un intento a medias o fallado no es un
 * clip, y guardarlo llenaría el archivo de cosas que nadie puede recuperar —con
 * lo cual el pliegue «volver al anterior» aparecería prometiendo nada.
 *
 * La marca resultante queda SIN `trabajoId` ni `operacion` a propósito: la toma
 * vuelve a estar por filmar, que es lo que se pidió, y el sondeo no sale a
 * preguntar por un clip que ya nadie espera.
 */
export function archivarToma(actual: MarcaVideo | undefined): MarcaVideo {
  const previo = actual ?? {};
  const archivo = [...(previo.descartadas ?? [])];
  if (previo.url) archivo.push(plano(previo));
  return archivo.length ? { descartadas: archivo } : {};
}

/**
 * Vuelve al último clip descartado.
 *
 * ⚠️ Y lo que estuviera filmado AHORA pasa al archivo: recuperar tampoco puede
 * ser una forma de perder un clip. Sin esta línea, apretar «volver al anterior»
 * dos veces dejaría uno de los dos en la nada.
 *
 * Devuelve `null` cuando no hay nada que recuperar, para que quien llama pueda
 * decirlo en vez de escribir una marca vacía encima de la buena.
 */
export function recuperarToma(actual: MarcaVideo | undefined): MarcaVideo | null {
  const previo = actual ?? {};
  const archivo = [...(previo.descartadas ?? [])];
  const vuelve = archivo.pop();
  if (!vuelve?.url) return null;
  if (previo.url) archivo.push(plano(previo));
  return { ...vuelve, descartadas: archivo.length ? archivo : undefined };
}
