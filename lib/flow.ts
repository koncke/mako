// =============================================================================
// flow — el cliente del backend de Google Flow (aisandbox-pa.googleapis.com)
// =============================================================================
// Reemplaza a useapi.net, que no vende capacidad sino una sesión de navegador
// prestada por US$15/mes: los créditos los pone igual la suscripción de Google.
// El protocolo está relevado del código de FlowKit (MIT); el análisis completo,
// con la auditoría de su extensión, en docs/hallazgos-generativa.md → «Replicar
// useapi».
//
// ⚠️ ESTE MÓDULO NO CONSIGUE EL TOKEN. Lo recibe.
//
// No hay API key que pedirle al cliente en /integraciones: Flow no tiene API
// pública, y lo único que autoriza una llamada es el `Bearer ya29.…` que la
// propia web de Flow manda desde una sesión iniciada. Ese token —y el del
// reCAPTCHA— los entrega el PUENTE (la extensión del navegador). Por eso acá no
// hay `credWs`: entran por parámetro, y este archivo se ocupa solo de hablar el
// protocolo bien.
//
// ⚠️ Y LO QUE ESTE MÓDULO NO HACE, A PROPÓSITO: FlowKit incluye un
// `sendTelemetry()` que cada 45-120 s le manda a Google eventos de uso
// INVENTADOS —latencias, scroll, aperturas de proyecto— con el comentario
// textual «to mimic normal browser behavior». Eso no es usar el mecanismo: es
// fabricar señales para que la detección de bots no vea la automatización. Acá
// no se replica. La contención es el RITMO: `LIMITES` de abajo mantiene el
// pulso dentro de lo que hace una persona, así que no hay nada que disimular.

import 'server-only';
import {
  ENDPOINTS, clasificarFalla, extraerMediaId, str, obj, arr,
  type FlowOut, type SesionFlow,
} from './flow-protocolo';

// Se re-exporta el contrato: quien usa el cliente no tiene que saber que está
// partido en dos, pero los tests importan del puro.
export * from './flow-protocolo';

const BASE = 'https://aisandbox-pa.googleapis.com';

// ── El fetch ─────────────────────────────────────────────────────────────────

/**
 * Una llamada al backend de Flow.
 *
 * El token del captcha se inyecta en `clientContext.recaptchaContext.token`, que
 * es donde lo espera el backend — no en un header.
 */
async function flowFetch<T>(
  path: string,
  sesion: SesionFlow,
  body: Record<string, unknown>,
  parsear: (data: unknown) => T,
): Promise<FlowOut<T>> {
  const ctx = obj(body.clientContext);
  const conCaptcha: Record<string, unknown> = {
    ...body,
    clientContext: {
      projectId: sesion.projectId,
      tool: 'PINHOLE',
      ...ctx,
      recaptchaContext: { token: sesion.captcha },
    },
  };

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${sesion.bearer}`,
      },
      body: JSON.stringify(conCaptcha),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, motivo: 'transitorio', error: `no se pudo llegar a Flow: ${msg}`, reintentable: true };
  }

  const texto = await res.text();
  let data: unknown = null;
  try { data = texto ? JSON.parse(texto) : null; } catch { /* abajo se trata */ }

  // ⚠️ Un 200 NO alcanza: Flow devuelve el fallo ADENTRO del cuerpo, en
  // `error` o `data.error`. Es la regla del repo sobre `res.ok`, que ya mordió
  // en Meta y en Evolution.
  const raiz = obj(data);
  const tieneErrorAdentro = !!raiz.error || !!obj(raiz.data).error;
  if (!res.ok || tieneErrorAdentro) {
    return { ok: false, ...clasificarFalla(res.status, data) };
  }
  if (data === null) {
    return { ok: false, motivo: 'transitorio', error: 'Flow devolvió un cuerpo vacío', reintentable: true };
  }

  try {
    return { ok: true, data: parsear(data) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, motivo: 'transitorio', error: `respuesta de Flow con forma inesperada: ${msg}`, reintentable: true };
  }
}

// ── Las operaciones ──────────────────────────────────────────────────────────

/**
 * Sube una imagen y devuelve su `mediaId`.
 *
 * ⚠️ Lo que sube VENCE en ~1 hora. Si entre la subida y la generación pasa más
 * que eso, Flow contesta «Requested entity was not found» y hay que resubir —
 * por eso `clasificarFalla` le da motivo propio.
 */
export async function subirImagen(
  sesion: SesionFlow,
  imagenBase64: string,
  mime = 'image/jpeg',
): Promise<FlowOut<{ mediaId: string }>> {
  return flowFetch(ENDPOINTS.subirImagen, sesion, {
    imageBytes: imagenBase64,
    mimeType: mime,
  }, (data) => {
    const id = extraerMediaId(obj(data)) ?? extraerMediaId(obj(obj(data).media));
    if (!id) throw new Error('sin mediaId en la respuesta de uploadImage');
    return { mediaId: id };
  });
}

export type PedidoClip = {
  /** El frame donde arranca el clip. */
  imagenInicial: string;
  /**
   * El frame donde termina.
   *
   * Es lo que resuelve la consistencia entre clips: el último frame de uno es el
   * primero del siguiente. Sin esto, la identidad deriva en cada salto y no hay
   * prompt que lo arregle.
   */
  imagenFinal?: string;
  prompt: string;
  /** Del catálogo de MODELOS. El tier de la cuenta decide cuál sirve. */
  modelo: string;
  /** Vertical salvo que se diga lo contrario: son anuncios. */
  vertical?: boolean;
};

/**
 * Encola un clip. NO devuelve el video: devuelve la operación a la que hay que
 * preguntarle después con `estadoClips`.
 *
 * La primitiva es ésta y no `generarVideo(prompt)`: el par de frames es parte
 * del contrato del modelo, no un extra.
 */
export async function generarClip(
  sesion: SesionFlow,
  pedido: PedidoClip,
): Promise<FlowOut<{ operacion: string }>> {
  const conFinal = !!pedido.imagenFinal;
  const path = conFinal ? ENDPOINTS.clipEntreImagenes : ENDPOINTS.clipDesdeImagen;

  const request: Record<string, unknown> = {
    aspectRatio: pedido.vertical === false ? 'VIDEO_ASPECT_RATIO_LANDSCAPE' : 'VIDEO_ASPECT_RATIO_PORTRAIT',
    videoModelKey: pedido.modelo,
    textInput: { prompt: pedido.prompt },
    startImage: { mediaId: pedido.imagenInicial },
    ...(conFinal ? { endImage: { mediaId: pedido.imagenFinal } } : {}),
  };

  return flowFetch(path, sesion, {
    mediaGenerationContext: { batchId: crypto.randomUUID() },
    requests: [request],
    useV2ModelConfig: true,
  }, (data) => {
    const op = arr(obj(data).operations)[0];
    const nombre = str(obj(obj(op).operation).name) || str(obj(op).name);
    if (!nombre) throw new Error('sin nombre de operación en batchAsyncGenerateVideo');
    return { operacion: nombre };
  });
}

export type EstadoClip =
  | { estado: 'en_curso' }
  | { estado: 'listo'; mediaId: string; url: string | null };

/**
 * Pregunta por los clips en vuelo.
 *
 * ⚠️ Una operación que contesta sin video NO falló: todavía no terminó. Tratarla
 * como fallo es el mismo modo de falla del pipeline de reuniones — se reencola,
 * no se descarta.
 */
export async function estadoClips(
  sesion: SesionFlow,
  operaciones: string[],
): Promise<FlowOut<Record<string, EstadoClip>>> {
  return flowFetch(ENDPOINTS.estadoVideo, sesion, {
    operations: operaciones.map((name) => ({ operation: { name } })),
  }, (data) => {
    const out: Record<string, EstadoClip> = {};
    for (const item of arr(obj(data).operations)) {
      const op = obj(obj(item).operation);
      const nombre = str(op.name);
      if (!nombre) continue;
      const video = obj(obj(op.metadata).video);
      const mediaId = extraerMediaId(video);
      out[nombre] = mediaId
        ? { estado: 'listo', mediaId, url: str(video.fifeUrl) || str(video.videoUri) || null }
        : { estado: 'en_curso' };
    }
    return out;
  });
}

/**
 * El saldo, que es el único número de créditos que vale.
 *
 * Toda tabla de costos que circula por internet sobre Flow estuvo mal alguna vez
 * —este proyecto ya planificó con una que estaba al doble—. El saldo se lee acá.
 */
export async function creditos(sesion: SesionFlow): Promise<FlowOut<{ saldo: number | null; tier: string }>> {
  return flowFetch(ENDPOINTS.creditos, sesion, {}, (data) => {
    const d = obj(data);
    const saldo = Number(d.credits ?? d.remainingCredits ?? d.balance);
    return {
      saldo: Number.isFinite(saldo) ? saldo : null,
      tier: str(d.paygateTier) || str(d.tier) || 'desconocido',
    };
  });
}
