// =============================================================================
// flow-imagen — el pedido de IMAGEN que Flow hace de verdad
// =============================================================================
// SIN `server-only`: es armado de un objeto y necesita test.
//
// ── Por qué existe: el orden es IMAGEN → VIDEO ─────────────────────────────
// El primer clip que el generador produjo de punta a punta salió con el ángulo
// equivocado y sin parecerse a la persona. La causa no fue el prompt: fue el
// ORDEN. Se animaba sobre la nada. El proceso real, el que produjo los cuatro
// anuncios que sí funcionaron, fija primero la imagen del escenario.
//
// ── ⚠️ EL ESQUEMA NO ALCANZÓ, Y ESTO COSTÓ UN 400 ──────────────────────────
// La primera versión de este archivo mandaba `{ userInput: { prompts, seed, … } }`,
// leído del bundle. Google contestó:
//
//     HTTP 400 · Invalid JSON payload received.
//     Unknown name "userInput": Cannot find field.
//
// El esquema existía, era real, y era de OTRO mensaje: el bundle define varias
// formas parecidas y elegir por parecido es adivinar con pasos extra. Lo que
// decide es el CALL SITE — quién construye el objeto que se serializa. Medido ahí,
// el cuerpo verdadero resultó ser casi gemelo del de video:
//
//   {
//     clientContext, mediaGenerationContext: { batchId }, useNewMedia: true,
//     requests: [{
//       clientContext, imageModelName, imageAspectRatio, structuredPrompt, seed,
//       imageInputs: [{ imageInputType: 'IMAGE_INPUT_TYPE_REFERENCE', name }],
//       requestContext, referenceEntities?, referenceLikenesses?,
//     }]
//   }
//
// La regla que queda: **un esquema dice qué campos EXISTEN; sólo el call site dice
// cuáles van en ESTE pedido.** Cuando hay varios mensajes con la misma forma, el
// esquema no desempata — y este proyecto ya tenía escrito que si hay que
// desempatar, todavía estás adivinando.
//
// ── Por qué esto se manda como PARCHES y no como cuerpo ────────────────────
// `fundir()` del espejo reemplaza los arrays enteros, a propósito. Para el clip
// alcanzaba con mandar `requests` completo porque sabíamos armarlo. Acá NO:
// adentro de `requests[0]` conviven lo que decidimos nosotros —el prompt, la
// semilla— con lo que **sólo sabe la plantilla**: `imageModelName`, que es el
// modelo de imagen que Flow eligió, y los `imageInputs`, que traen la cara.
//
// Mandar el array a medias pierde el modelo y la cara. Mandarlo entero exige
// inventar los dos, que es exactamente lo que el espejo existe para no hacer. Por
// eso se manda un PARCHE POR CAMINO: se copia todo el pedido de Flow y se cambia
// sólo la hoja. Es el espejo llevado un paso más adentro.

import { semillaDeToma } from './flow-clip-referencias';

export { semillaDeToma };

/** Vertical: son anuncios para el feed. El mismo formato que el clip. */
export const ASPECTO_VERTICAL = 'IMAGE_ASPECT_RATIO_PORTRAIT';

export type PedidoImagenEscena = {
  /** La composición: dónde está, con qué luz, desde qué ángulo. Nunca la cara. */
  prompt: string;
  seed: number;
  /** El lote. Va uno por escena, como el `batchId` del clip. */
  batchId: string;
};

/**
 * Los parches que se aplican sobre el pedido que Flow hizo de verdad.
 *
 * Las claves son CAMINOS dentro del cuerpo copiado. Todo lo que no está acá se
 * conserva de la plantilla: el modelo, la cara, el `clientContext`, el
 * `requestContext` y lo que Google agregue mañana sin avisar.
 *
 * ⚠️ NO se parchea `imageInputs`. La cara sale de la plantilla —de la imagen que
 * la persona generó a mano con su foto— y por eso es la misma cara que ya usa el
 * paso de video. El día que haga falta cambiarla, se parchea ese camino con la
 * forma medida: `{ imageInputType: 'IMAGE_INPUT_TYPE_REFERENCE', name: <id> }`.
 */
export function parchesImagenEscena(p: PedidoImagenEscena): Record<string, unknown> {
  return {
    // El prompt viaja igual que en el clip: partes de texto, no un string suelto.
    'requests.0.structuredPrompt': { parts: [{ text: p.prompt }] },
    // La semilla explícita: reintentar la misma escena tiene que dar la misma
    // imagen, o «cambié el prompt y salió distinto» sería indistinguible de
    // «salió distinto porque sí».
    'requests.0.seed': p.seed,
    'requests.0.imageAspectRatio': ASPECTO_VERTICAL,
    // El lote propio, para que nuestras imágenes no se mezclen con las que la
    // persona genera a mano en la misma sesión.
    'mediaGenerationContext.batchId': p.batchId,
  };
}

/**
 * Las imágenes que devolvió Flow.
 *
 * La respuesta viene anidada y el campo que trae el archivo cambió de nombre
 * entre versiones del contrato. Por eso se buscan varios y se devuelve lo que
 * haya, en vez de exigir uno: un campo que cambia de nombre no puede dejar la
 * pantalla en blanco.
 */
export function imagenesDeRespuesta(data: unknown): { url: string; mediaId?: string }[] {
  const out: { url: string; mediaId?: string }[] = [];
  const vistos = new Set<unknown>();

  // Búsqueda recursiva en vez de un camino fijo: la respuesta de este endpoint
  // todavía no se midió con una corrida real, y un camino fijo que no acierta
  // devuelve cero imágenes con la misma cara que «Flow no generó nada».
  const recorrer = (v: unknown) => {
    if (!v || typeof v !== 'object' || vistos.has(v)) return;
    vistos.add(v);
    if (Array.isArray(v)) { v.forEach(recorrer); return; }

    const o = v as Record<string, unknown>;
    const url = [o.fifeUrl, o.fifeUri, o.servingBaseUri, o.uri, o.url]
      .find((x) => typeof x === 'string' && /^https?:\/\//.test(x));
    const bytes = [o.encodedImage, o.rawImageBytes].find((x) => typeof x === 'string' && x.length > 100);
    const mediaId = [o.mediaId, o.mediaGenerationId, o.name]
      .find((x) => typeof x === 'string' && x) as string | undefined;

    if (typeof url === 'string') out.push({ url, mediaId });
    // Cuando viene el binario y no una URL, se sirve como data: URI. No es lo
    // ideal —pesa en el historial— pero una imagen que no se puede mirar no se
    // puede confirmar, y confirmarla es todo el paso.
    else if (typeof bytes === 'string') out.push({ url: `data:image/png;base64,${bytes}`, mediaId });

    Object.values(o).forEach(recorrer);
  };
  recorrer(data);
  return out;
}

/**
 * Una semilla estable por escenario.
 *
 * ⚠️ El multiplicador es 1000 y no 100 a propósito: con `n * 100 + intento`, la
 * escena 1 en el intento 101 y la escena 2 en el intento 1 dan el mismo número.
 * Es improbable y es gratis evitarlo; una colisión de semillas produce dos
 * escenas con la misma imagen y eso se lee como un error del modelo.
 */
export function semillaDeEscena(planId: string, escena: number, intento: number): number {
  return semillaDeToma(`${planId}#img`, escena * 1000 + intento);
}
