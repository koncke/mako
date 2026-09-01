// =============================================================================
// La plantilla de fábrica: el pedido de imagen que ya sabemos hacer
// =============================================================================
// ── Qué problema cierra ────────────────────────────────────────────────────
// Hasta hoy, un cliente nuevo NO podía generar una imagen hasta hacer una a mano
// en Google Flow, con la pestaña abierta, para que el espejo copiara el pedido.
// Le costó la tarde a una clienta y el dueño lo cortó con la pregunta correcta:
// «¿por qué hacemos eso cada vez que uno quiere generar? Si tú ya sabes cómo es».
//
// Y tiene razón: la FORMA del pedido es universal. Medida sobre el pedido real de
// un cliente, lo único que de verdad es suyo es el `projectId` —que aparece dos
// veces— y dos cosas que se rehacen solas en cada llamada: el token del captcha
// (que la extensión vuelve a acuñar) y el `sessionId`.
//
// ── Por qué NO alcanza con esto, y el espejo sigue existiendo ──────────────
// Este archivo es una FOTO de un contrato privado de Google que cambia sin
// avisar. La prueba está adentro: el modelo hoy se llama `GEM_PIX_2`, y los
// comentarios de este repo escritos hace unas semanas dicen `NARWHAL`. Ya derivó
// una vez. Si esto fuera la única fuente, el día que Google cambie un campo se
// rompe para TODOS a la vez y nadie sabe por qué.
//
// Por eso es un PISO, no un reemplazo: se usa sólo cuando el workspace no tiene
// una plantilla medida de esa clase, se guarda con `cuando: 0` para que
// cualquier pedido real —que trae su fecha— la desplace sola en `fundirPlantillas`,
// y queda marcada `deFabrica` para que el que investigue pueda distinguir «esto
// lo vimos» de «esto lo asumimos».
//
// Es la regla de la casa con las dos capas: el espejo mide, y esto es el default
// que evita que el cliente pague la medición con su tiempo.

import type { PlantillaEspejo } from './flow-plantillas';

/** Un projectId de Flow es un uuid. Sin uno válido no hay plantilla que armar. */
const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const CLASE_IMAGEN = 'flowMedia:batchGenerateImages';
/** El pedido que FILMA. Es el que le faltaba a una clienta y le dijo «genera uno a mano». */
export const CLASE_CLIP = 'video:batchAsyncGenerateVideoReferenceImages';
/** Y el que pregunta si ya salió. Sin éste, el clip se genera y nadie lo va a buscar. */
export const CLASE_ESTADO_CLIP = 'video:batchCheckAsyncVideoGenerationStatus';

/** La API de generación. Las de video NO cuelgan de `/projects/<id>/`. */
const API = 'https://aisandbox-pa.googleapis.com/v1';

/**
 * El pedido de imagen, con el proyecto del cliente adentro.
 *
 * ⚠️ Los valores NO se inventaron: son los del pedido real que hace la página de
 * Flow, leídos del espejo de un cliente. `GEM_PIX_2`,
 * `IMAGE_ASPECT_RATIO_PORTRAIT`, `IMAGE_INPUT_TYPE_REFERENCE`, `PINHOLE` y
 * `useNewMedia: true` están copiados, no deducidos — reconstruir un contrato
 * privado a partir de documentación ajena ya costó caro en este repo.
 *
 * Lo que queda como hueco lo llena `parchesImagenEscena` en cada generación: el
 * prompt, la semilla, el `batchId` y el `name` de la cara. Van vacíos y no
 * ausentes porque `fundir()` reemplaza arrays enteros: un `imageInputs` que no
 * exista se crearía sin su `imageInputType`, y saldría un pedido mal formado
 * hecho por nosotros — con una imagen de resultado y sin ningún error.
 */
export function plantillaImagenDeFabrica(projectId: string): PlantillaEspejo | null {
  const proj = String(projectId || '').trim();
  if (!ES_UUID.test(proj)) return null;

  const cuerpo = {
    clientContext: {
      recaptchaContext: { applicationType: 'RECAPTCHA_APPLICATION_TYPE_WEB' },
      projectId: proj,
      tool: 'PINHOLE',
    },
    mediaGenerationContext: { batchId: '' },
    useNewMedia: true,
    requests: [
      {
        clientContext: {
          recaptchaContext: { applicationType: 'RECAPTCHA_APPLICATION_TYPE_WEB' },
        },
        imageModelName: 'GEM_PIX_2',
        imageAspectRatio: 'IMAGE_ASPECT_RATIO_PORTRAIT',
        structuredPrompt: { parts: [{ text: '' }] },
        seed: 0,
        imageInputs: [{ imageInputType: 'IMAGE_INPUT_TYPE_REFERENCE', name: '' }],
      },
    ],
  };

  return {
    clase: CLASE_IMAGEN,
    url: `https://aisandbox-pa.googleapis.com/v1/projects/${proj}/${CLASE_IMAGEN}`,
    metodo: 'POST',
    headers: {},
    cuerpo: JSON.stringify(cuerpo),
    // ⚠️ CERO, y es lo que hace que se desplace sola. `fundirPlantillas` prefiere
    // la más reciente entre dos que sirven, así que cualquier pedido real —que
    // trae su timestamp— gana sin que nadie tenga que acordarse de borrar ésta.
    cuando: 0,
    deFabrica: true,
  };
}


// ── Las dos de VIDEO ────────────────────────────────────────────────────────
// ⚠️ SON LAS QUE ROMPIERON A UNA CLIENTA. La fábrica cubría sólo la imagen, así
// que un usuario nuevo llegaba hasta el escenario y ahí se encontraba con
// «Todavía no vi a Google Flow generar un video con tu foto de referencia. Abre
// Flow, genera UNO a mano usando tu foto» — el paso manual que todo esto viene a
// borrar, apareciendo en el último lugar del recorrido.
//
// ── Por qué esto se puede sintetizar y es poco ─────────────────────────────
// El cuerpo del pedido de clip ya lo arma el código entero
// (`cuerpoClipReferencias`): el prompt, la cara, la semilla, el modelo y el
// aspecto salen de nuestro lado. Lo ÚNICO que la plantilla aporta es el
// `clientContext`, que es lo que su propio comentario dice que no mandamos
// porque «lo pone la propia página». Con el `projectId` —que ya viaja en cada
// latido— eso se arma acá.
//
// ── Los dos campos que NO se ponen, y por qué ──────────────────────────────
// El pedido real de Flow trae además `sessionId` y `userPaygateTier`:
//
// · `sessionId` es del navegador y cambia en cada sesión. La fábrica de imagen ya
//   lo omite y funciona en producción —está generando imágenes hoy—, así que la
//   evidencia dice que no es obligatorio.
// · `userPaygateTier` afirma en qué plan está la cuenta del cliente, y eso NO LO
//   SABEMOS. Copiar el `PAYGATE_TIER_NOT_PAID` del espejo de otro sería afirmar
//   un hecho ajeno sobre la cuenta de alguien; omitirlo deja que lo resuelva
//   Google, que sí lo sabe. Es la regla de la casa: no se afirma lo que no se
//   verificó.
//
// Y las dos se desplazan solas: `cuando: 0` hace que el primer pedido REAL que la
// extensión copie del tráfico de Flow las reemplace sin que nadie se acuerde.

/** El contexto que la página pone y nosotros no mandamos. Es todo el aporte. */
function contexto(proj: string) {
  return {
    projectId: proj,
    tool: 'PINHOLE',
    recaptchaContext: { applicationType: 'RECAPTCHA_APPLICATION_TYPE_WEB' },
  };
}

/**
 * El pedido que filma un clip a partir de la foto de referencia.
 *
 * El resto del cuerpo va con los mismos huecos que el pedido real tiene: no se
 * usan —`cuerpoClipReferencias` los manda enteros y `fundir` reemplaza arrays—
 * pero dejan la plantilla legible para quien la mire buscando qué se parchea.
 */
export function plantillaClipDeFabrica(projectId: string): PlantillaEspejo | null {
  const proj = String(projectId || '').trim();
  if (!ES_UUID.test(proj)) return null;

  return {
    clase: CLASE_CLIP,
    url: `${API}/${CLASE_CLIP}`,
    metodo: 'POST',
    headers: {},
    cuerpo: JSON.stringify({
      mediaGenerationContext: { batchId: '', audioFailurePreference: 'BLOCK_SILENCED_VIDEOS' },
      clientContext: contexto(proj),
      requests: [{
        outputSpec: { resolution: 'VIDEO_RESOLUTION_720P' },
        aspectRatio: 'VIDEO_ASPECT_RATIO_PORTRAIT',
        textInput: { structuredPrompt: { parts: [{ text: '' }] } },
        videoModelKey: 'abra_r2v_10s',
        seed: 0,
        metadata: {},
        referenceImages: [{ mediaId: '', imageUsageType: 'IMAGE_USAGE_TYPE_ASSET' }],
      }],
      useV2ModelConfig: true,
    }),
    cuando: 0,
    deFabrica: true,
  };
}

/**
 * El pedido que pregunta si el clip ya salió.
 *
 * ⚠️ HACE FALTA TANTO COMO EL OTRO. Sin ésta el clip se genera igual y nadie va a
 * buscarlo: la toma se queda «filmando» hasta que alguien mire el proyecto de
 * Flow a mano. Es la clase que la app consulta más veces por anuncio.
 *
 * `parchesEstadoClip` pisa `media.0.name` con la operación; el `projectId` de al
 * lado es el que esta plantilla aporta.
 */
export function plantillaEstadoClipDeFabrica(projectId: string): PlantillaEspejo | null {
  const proj = String(projectId || '').trim();
  if (!ES_UUID.test(proj)) return null;

  return {
    clase: CLASE_ESTADO_CLIP,
    url: `${API}/${CLASE_ESTADO_CLIP}`,
    metodo: 'POST',
    headers: {},
    cuerpo: JSON.stringify({ media: [{ name: '', projectId: proj }] }),
    cuando: 0,
    deFabrica: true,
  };
}

/**
 * Le suma las de fábrica a lo que el workspace tenga, por las que le falten.
 *
 * ⚠️ SÓLO SI FALTA. Una plantilla medida describe lo que Google acepta HOY en la
 * cuenta de ESE cliente; la de fábrica describe lo que aceptaba cuando se copió.
 * Pisar una medida con ésta sería cambiar un hecho por un recuerdo.
 */
export function conPlantillaDeFabrica(
  guardadas: PlantillaEspejo[],
  projectId: string,
): PlantillaEspejo[] {
  // ⚠️ CLASE POR CLASE, no «si falta alguna». Cubría sólo la imagen y salía
  // temprano en cuanto la encontraba, así que un cliente que ya había generado
  // una imagen —o sea el que YA tenía la de imagen— nunca recibía las de video.
  // Eran justo las que le faltaban.
  const fabricas: Array<[string, (p: string) => PlantillaEspejo | null]> = [
    [CLASE_IMAGEN, plantillaImagenDeFabrica],
    [CLASE_CLIP, plantillaClipDeFabrica],
    [CLASE_ESTADO_CLIP, plantillaEstadoClipDeFabrica],
  ];
  let out = guardadas;
  for (const [clase, hacer] of fabricas) {
    if (out.some((p) => p.clase === clase)) continue;
    const f = hacer(projectId);
    if (f) out = [...out, f];
  }
  return out;
}
