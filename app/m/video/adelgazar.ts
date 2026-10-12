// =============================================================================
// /m/video — el plan de escritorio, ADELGAZADO para bajar al teléfono (puro, con test)
// =============================================================================
// Sin server-only a propósito: es una función pura y tiene que poder testearse
// (tests/m-video.test.ts fija que `estadoDeToma` de escritorio lee lo mismo antes y después).
// =============================================================================

import type { MarcaVideo, PlanGuardado } from '@/app/video-generator/video-datos';

/** El nombre que se dibuja: el título del plan, o lo que se pidió. */
export function tituloDe(p: PlanGuardado): string {
  return (p.plan.titulo || p.pedido || '').trim() || 'Anuncio';
}

/**
 * El plan SIN lo que el teléfono no usa, con la MISMA forma (`PlanGuardado`) para que
 * `estadoDeToma` de escritorio lo lea tal cual en el cliente.
 *
 * Se van: los prompts, la cámara y la acción de cada toma, las escenas y sus imágenes (urls de
 * Google que vencen a las ~6 h), y de cada marca la evidencia cruda de Google (`errorCrudo`, hasta
 * 1.600 caracteres de JSON con el prompt adentro) y el archivo de clips descartados. Quedan los
 * campos que deciden el estado (`url`, `error`, `trabajoId`, `operacion`) y los que lo explican.
 */
export function adelgazar(p: PlanGuardado): PlanGuardado {
  const video: Record<string, MarcaVideo> = {};
  for (const [k, m] of Object.entries(p.video ?? {})) {
    if (!m) continue;
    video[k] = {
      url: m.url, error: m.error, errorCausa: m.errorCausa, errorDetalle: m.errorDetalle, errorAt: m.errorAt,
      trabajoId: m.trabajoId, operacion: m.operacion,
    };
  }
  return {
    id: p.id,
    pedido: p.pedido,
    at: p.at,
    guionId: p.guionId,
    plan: {
      ...p.plan,
      deCorrido: '',
      clips: p.plan.clips.map((c) => ({ ...c, prompt: '', camara: '', queSeVe: '', original: undefined, ctaInventado: undefined })),
    },
    video,
  };
}
