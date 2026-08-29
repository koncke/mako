// =============================================================================
// flow-clip-referencias — el pedido de clip que Flow hace DE VERDAD
// =============================================================================
// SIN `server-only`: es armado de un objeto y necesita test. Lo que no puede
// pasar acá es equivocarse en un nombre de campo, porque el error no vuelve como
// error: vuelve como un clip que no se parece a la persona.
//
// ── Por qué existe, si ya estaba `generarClip` en lib/flow.ts ───────────────
// Ese builder salió del relevamiento de useapi y arma `startImage` +
// `textInput.prompt` contra `batchAsyncGenerateVideoStartImage`. El pedido que
// Flow hace HOY, medido copiándolo de su propio tráfico el 29/08, es otro:
//
//   endpoint : /v1/video:batchAsyncGenerateVideoReferenceImages
//   prompt   : textInput.structuredPrompt.parts[].text   (no `textInput.prompt`)
//   la cara  : referenceImages[{ mediaId, imageUsageType }]   (no `startImage`)
//   + outputSpec.resolution, + seed, + metadata
//
// No es que el otro esté mal: es OTRO endpoint, el de encadenar por frames. El de
// referencias es el que usa el avatar, y es el que el dueño usó a mano.
//
// ── El contrato con el espejo ───────────────────────────────────────────────
// La extensión manda nuestro cuerpo FUNDIDO sobre la plantilla que copió del
// tráfico de Flow (extension/injected.js). Y `fundir` REEMPLAZA los arrays —solo
// funde objeto con objeto—, así que `requests` hay que mandarlo ENTERO: si se
// manda a medias, se pierde la cara.
//
// Lo que NO se manda es `clientContext`: ahí viven el projectId, el sessionId y
// el token de reCAPTCHA, y los tres los pone la propia página. Mandarlos sería
// inventar credenciales que ya existen y están frescas.

/** El modelo de video. Sale del pedido real de Flow, no de una lista nuestra. */
export const MODELO_CLIP_REFERENCIAS = 'abra_r2v_10s';

export type PedidoClipReferencias = {
  /** Lo que se dice y cómo se filma, en un solo texto: es lo que ve el modelo. */
  prompt: string;
  /** El id de la foto de marca DENTRO de Flow. Sin esto, cada clip inventa una cara. */
  mediaId: string;
  /**
   * La semilla. Va explícita y no al azar para que reintentar la misma toma dé
   * el mismo clip: si cambia sola, «volvé a generarlo igual» es imposible y no
   * se puede comparar un cambio de prompt contra nada.
   */
  seed: number;
  /** Vertical salvo que se diga lo contrario: son anuncios para el feed. */
  vertical?: boolean;
};

export function cuerpoClipReferencias(p: PedidoClipReferencias, batchId: string): Record<string, unknown> {
  return {
    mediaGenerationContext: {
      batchId,
      // Lo que Flow manda: un clip que salió mudo se bloquea en vez de entregarse.
      // Un clip sin audio no es un clip más barato, es un clip que hay que rehacer.
      audioFailurePreference: 'BLOCK_SILENCED_VIDEOS',
    },
    requests: [{
      outputSpec: { resolution: 'VIDEO_RESOLUTION_720P' },
      aspectRatio: p.vertical === false ? 'VIDEO_ASPECT_RATIO_LANDSCAPE' : 'VIDEO_ASPECT_RATIO_PORTRAIT',
      textInput: { structuredPrompt: { parts: [{ text: p.prompt }] } },
      videoModelKey: MODELO_CLIP_REFERENCIAS,
      seed: p.seed,
      metadata: {},
      referenceImages: [{ mediaId: p.mediaId, imageUsageType: 'IMAGE_USAGE_TYPE_ASSET' }],
    }],
    useV2ModelConfig: true,
  };
}

/**
 * Una semilla estable para una toma.
 *
 * Del id del plan y el número de toma, no del reloj: pedir dos veces la misma
 * toma sin cambiar nada tiene que dar el mismo video. Si la semilla fuera al
 * azar, «lo generé de nuevo y salió distinto» sería indistinguible de «cambié el
 * prompt y salió distinto», y no habría forma de saber si un cambio sirvió.
 */
export function semillaDeToma(planId: string, n: number): number {
  let h = 2166136261;
  for (const c of `${planId}:${n}`) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  // Positivo y dentro del rango que Flow usa en sus propios pedidos.
  return Math.abs(h) % 100000;
}

/**
 * Dónde queda guardada la cara una vez que se aprendió.
 *
 * Se guarda porque las plantillas del espejo viven en la MEMORIA de la pestaña de
 * Flow: un F5 las borra. Un dato que se descubre una vez y no cambia no puede
 * depender de que una pestaña siga abierta.
 */
export const KEY_CARA_FLOW = 'video-generator.cara-flow';

/**
 * El `mediaId` de la foto de marca, leído del tráfico que la extensión copió.
 *
 * ⚠️ Esto es una LECTURA DE DIAGNÓSTICO usada como dato, y hay que saberlo: el
 * espejo reporta las plantillas para que el server pueda decir qué falta, y de
 * ahí sale el id de la imagen que la propia persona eligió en Flow.
 *
 * Es provisional a propósito. Lo correcto es subir la foto con `subir_imagen` y
 * quedarse con el id que devuelva — pero eso necesita que el espejo haya visto
 * un `uploadImage`, y hoy no lo vio. Mientras tanto, esto usa exactamente la
 * misma cara que el dueño usó a mano, que es la respuesta correcta aunque el
 * camino sea el provisorio.
 */
export function mediaIdDeReferencia(detalle: string): string | null {
  if (!detalle) return null;
  // El detalle viene como texto JSON (a veces escapado dos veces) y puede llegar
  // CORTADO: el token de reCAPTCHA se come miles de caracteres. Por eso se busca
  // el campo con una expresión y no parseando — un JSON truncado no parsea, pero
  // el id sigue estando ahí.
  const m = /referenceImages\\*"?\s*:\s*\[\s*\{[^}]*?mediaId\\*"?\s*:\s*\\*"([0-9a-f-]{16,})/i.exec(detalle);
  return m ? m[1] : null;
}
