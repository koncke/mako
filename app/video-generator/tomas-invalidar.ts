/**
 * Cuándo un fallo de una toma deja de valer.
 *
 * ── Por qué vive en su propio módulo ────────────────────────────────────────
 * `video-action.ts` es `'use server'`, y ahí TODO export tiene que ser una
 * función async: una regla pura no puede exportarse, y lo que no se exporta no
 * lo puede importar ningún test. Es el mismo criterio que `exigirClienteDePrueba`
 * —la condición que gobierna algo caro va en un módulo sin `server-only`— y acá
 * lo caro son ~15 créditos por clip.
 */

import type { PlanGuardado, MarcaVideo } from './video-datos';

/**
 * Olvida las tomas FALLIDAS que salían del escenario que se acaba de cambiar.
 *
 * ⚠️ SIN ESTO, EL RECHAZO SOBREVIVE A SU PROPIA CURA — y eso fue un bucle sin
 * salida, medido en producción el 31/08/2026:
 *
 *   la toma 1 falla → la pantalla ofrece arreglar el escenario → se arregla →
 *   se aprieta Continuar → `pasoDe` vuelve a la toma 1, que sigue con el error
 *   del intento viejo → la pantalla ofrece arreglar el escenario → …
 *
 * Ninguna de las dos pantallas estaba rota por su cuenta: cada una hacía lo
 * suyo. Lo que faltaba era que rehacer la ENTRADA invalidara el resultado que
 * esa entrada había producido. Es «rechazar deja una deuda»: si un control dice
 * que no, alguien tiene que producir lo bueno — y acá nadie borraba lo malo.
 *
 * El dueño lo vio como lo único que se podía ver desde afuera: «entra en un
 * bucle infinito de "La toma 1 no salió"… y me vuelve a la tab anterior».
 *
 * Dos cosas que NO se tocan nunca, y las dos cuestan si se tocan:
 *  · una toma FILMADA (`url`) son créditos ya pagados;
 *  · una toma EN VUELO (sin error) dejaría el trabajo huérfano y su resultado
 *    sin dónde caer.
 */
export function olvidarTomasFallidas(item: PlanGuardado, escenaN: number): PlanGuardado {
  const e = (item.escenas ?? []).find((x) => x.n === escenaN);
  // Sin la escena no se sabe qué tomas dependían de ella: no se borra a ciegas.
  if (!e) return item;

  const antes = (item.video ?? {}) as Record<string, MarcaVideo>;
  const quedan: Record<string, MarcaVideo> = {};
  let saco = false;
  for (const [k, v] of Object.entries(antes)) {
    const t = Number(k);
    if (v?.error && !v?.url && t >= e.desde && t <= e.hasta) { saco = true; continue; }
    quedan[k] = v;
  }
  return saco ? { ...item, video: quedan } : item;
}

/**
 * Cambiar la FOTO invalida las imágenes que salieron de la anterior.
 *
 * ⚠️ SIN ESTO, EL SELECTOR DE FOTOS NO GOBIERNA NADA una vez que la imagen
 * existe. La persona cambia la foto, aprieta Continuar… y «Continuar» CONFIRMA la
 * imagen vieja —la de la cara anterior— porque la pantalla ofrece confirmar
 * cuando ya hay opciones. Y esa imagen confirmada es el cuadro del que sale el
 * clip pagado.
 *
 * Es especialmente caro porque cambiar de foto es la cura DOCUMENTADA del rechazo
 * por persona pública: el mensaje le dice que pruebe con otra foto, ella la
 * cambia, y el sistema sigue usando la anterior.
 *
 * ⚠️ Y NO SE TOCA LA ESCENA QUE YA TIENE UN CLIP FILMADO. Ese clip salió de esa
 * imagen: borrarla dejaría al anuncio mostrando un video cuyo cuadro de origen ya
 * no existe, y encima invitaría a regenerar algo que ya se pagó.
 */
export function olvidarImagenesDeLaFoto(item: PlanGuardado): PlanGuardado {
  const escenas = item.escenas ?? [];
  if (!escenas.length) return item;

  const filmada = (n: number) => !!(item.video ?? {})[String(n)]?.url;
  const imgs = (item.imagenes ?? {}) as Record<string, Record<string, unknown>>;

  const quedan: Record<string, Record<string, unknown>> = {};
  let saco = false;
  for (const e of escenas) {
    const k = String(e.n);
    const marca = imgs[k];
    if (!marca) continue;
    let tieneClip = false;
    for (let t = e.desde; t <= e.hasta; t++) if (filmada(t)) tieneClip = true;
    if (tieneClip) { quedan[k] = marca; continue; }
    // Se conserva el intento —para que la semilla siga avanzando— y se tira lo
    // que describe a la cara vieja.
    quedan[k] = { intento: marca.intento };
    saco = true;
  }
  // Las que no son de ninguna escena viva se dejan como estaban: este arreglo es
  // sobre la foto, no una limpieza general.
  for (const [k, v] of Object.entries(imgs)) if (!(k in quedan)) quedan[k] = v;

  return saco ? { ...item, imagenes: quedan } : item;
}
