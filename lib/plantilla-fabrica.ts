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

/**
 * Le suma la de fábrica a lo que el workspace tenga, si le falta la de imagen.
 *
 * ⚠️ SÓLO SI FALTA. Una plantilla medida describe lo que Google acepta HOY en la
 * cuenta de ESE cliente; la de fábrica describe lo que aceptaba cuando se copió.
 * Pisar una medida con ésta sería cambiar un hecho por un recuerdo.
 */
export function conPlantillaDeFabrica(
  guardadas: PlantillaEspejo[],
  projectId: string,
): PlantillaEspejo[] {
  if (guardadas.some((p) => p.clase === CLASE_IMAGEN)) return guardadas;
  const fabrica = plantillaImagenDeFabrica(projectId);
  return fabrica ? [...guardadas, fabrica] : guardadas;
}
