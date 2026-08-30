// =============================================================================
// flow-imagen — el pedido de IMAGEN que Flow hace de verdad
// =============================================================================
// SIN `server-only`: es armado de un objeto y necesita test.
//
// ── Por qué existe: el orden es IMAGEN → VIDEO ─────────────────────────────
// El primer clip que salió de punta a punta salió mal, y no por el prompt de
// video: salió en un ángulo que nadie pidió y con una cara que no se parecía. La
// causa es de método, no de código — se estaba animando sobre la nada. El
// proceso real, el que se usó a mano para los cuatro anuncios que sí funcionaron,
// es primero fijar la imagen del escenario y recién después animarla.
//
// ── El contrato, MEDIDO ────────────────────────────────────────────────────
// Leído del bundle de Flow el 30/08/2026, no de la documentación de un tercero
// —que es lo que hizo perder cinco vueltas con el endpoint de video—:
//
//   endpoint : /v1/projects/<projectId>/flowMedia:batchGenerateImages
//   captcha  : accion IMAGE_GENERATION  (no la derivada del path)
//   cuerpo   : { clientContext, modelInput, modelSettings, userInput }
//   el prompt: userInput.prompts[]          (un string por imagen pedida)
//   la cara  : userInput.referenceImageInput.referenceImages[]
//              { mediaId, useMediaId: true, isLikeness: true }
//   respuesta: { imagePanels: [ { generatedImages: [...], prompt } ] }
//
// `isLikeness` es el campo que dice «esto es la persona»: es el mismo mecanismo
// que usa el clip con `referenceImages`, y por eso se puede reusar el MISMO
// mediaId que ya aprendió el paso de video (KEY_CARA_FLOW). Una cara, un lugar.
//
// ── Lo que NO se manda, a propósito ────────────────────────────────────────
// `clientContext` (projectId, sessionId, token), `modelInput` (qué modelo de
// imagen) y `modelSettings`. Los tres los pone la plantilla que la extensión
// copió del tráfico real. Elegir el modelo nosotros sería inventar justo donde
// ya tenemos el dato — y el día que Google cambie de modelo, la plantilla cambia
// sola porque sale del tráfico de hoy.

import { semillaDeToma } from './flow-clip-referencias';

export { semillaDeToma };

/**
 * Cuántas variantes se piden por escenario.
 *
 * Dos, no una: elegir entre dos cuesta un segundo y ahorra una vuelta entera de
 * «regenerar». Y no cuatro —que es lo que pide Flow en su propio diálogo—
 * porque una grilla de cuatro convierte una confirmación en una elección, y lo
 * que hay que confirmar acá es si el escenario está bien, no cuál es la más
 * linda.
 */
export const VARIANTES_POR_ESCENA = 2;

export type PedidoImagenEscena = {
  /** La composición: dónde está, con qué luz, desde qué ángulo. Nunca la cara. */
  prompt: string;
  /**
   * El id de la foto real de la persona DENTRO de Flow.
   *
   * Opcional: sin él la imagen sale igual, con una persona inventada. Se manda
   * cuando se sabe, y cuando no, la plantilla decide — que es lo mismo que hizo
   * la persona a mano la última vez.
   */
  mediaIdCara?: string | null;
  seed: number;
  variantes?: number;
};

export function cuerpoImagenEscena(p: PedidoImagenEscena): Record<string, unknown> {
  const userInput: Record<string, unknown> = {
    candidatesCount: p.variantes ?? VARIANTES_POR_ESCENA,
    // ⚠️ `fundir()` REEMPLAZA arrays enteros (extension/injected.js). Para
    // `prompts` eso es lo correcto y hay que saberlo: mandar uno no agrega un
    // prompt a los de la plantilla, los pisa. Que es exactamente lo que se
    // quiere.
    prompts: [p.prompt],
    seed: p.seed,
  };
  if (p.mediaIdCara) {
    userInput.referenceImageInput = {
      referenceImages: [{
        mediaId: p.mediaIdCara,
        useMediaId: true,
        // El campo que dice «esto es la PERSONA», no un estilo ni un contexto.
        // Sin él, la foto entra como referencia estética y la cara se reinventa.
        isLikeness: true,
        imageInputType: 'IMAGE_INPUT_TYPE_REFERENCE',
      }],
    };
  }
  return { userInput };
}

/**
 * Las URLs de las imágenes que devolvió Flow.
 *
 * La respuesta viene anidada (`imagePanels[].generatedImages[]`) y el campo que
 * trae el archivo cambió de nombre entre versiones del contrato. Por eso se
 * buscan varios y se devuelve lo que haya, en vez de exigir uno: un campo que
 * cambia de nombre no puede dejar la pantalla en blanco.
 */
export function imagenesDeRespuesta(data: unknown): { url: string; mediaId?: string }[] {
  const out: { url: string; mediaId?: string }[] = [];
  const paneles = (data as { imagePanels?: unknown[] } | null)?.imagePanels;
  if (!Array.isArray(paneles)) return out;
  for (const panel of paneles) {
    const gen = (panel as { generatedImages?: unknown[] } | null)?.generatedImages;
    if (!Array.isArray(gen)) continue;
    for (const g of gen) {
      const o = (g ?? {}) as Record<string, unknown>;
      const url = [o.fifeUrl, o.servingBaseUri, o.uri, o.url].find((v) => typeof v === 'string' && v);
      const bytes = typeof o.encodedImage === 'string' ? o.encodedImage : '';
      const mediaId = typeof o.mediaId === 'string' ? o.mediaId
        : typeof o.mediaGenerationId === 'string' ? o.mediaGenerationId : undefined;
      if (typeof url === 'string' && url) out.push({ url, mediaId });
      // Cuando viene el binario y no una URL, se sirve como data: URI. No es lo
      // ideal —pesa en el JSON del historial— pero una imagen que no se puede
      // mirar no se puede confirmar, y confirmarla es todo el paso.
      else if (bytes) out.push({ url: `data:image/png;base64,${bytes}`, mediaId });
    }
  }
  return out;
}

/**
 * Una semilla estable por escenario.
 *
 * Del id del plan y el número de escenario: pedir dos veces la misma escena sin
 * cambiar el prompt tiene que dar la misma imagen. Si la semilla fuera al azar,
 * «cambié el prompt y salió distinto» sería indistinguible de «salió distinto
 * porque sí», y no habría forma de saber si una corrección sirvió.
 */
export function semillaDeEscena(planId: string, escena: number): number {
  return semillaDeToma(`${planId}#img`, escena);
}
