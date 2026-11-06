// =============================================================================
// Media Buyer — preparar las VARIACIONES de un ganador con la IA del negocio
// =============================================================================
// Cada negocio paga SU IA (Martín, 22/10/2026: «Cada usuario debe poder pagar su token, su propia IA»): esto corre por
// `chatCheapCascade` adentro del negocio, que usa su Claude, su GPT o su Gemini, y nunca la de la plataforma. Sin su
// IA no hay variaciones, y la decisión lo dice.
//
// Las variaciones se escriben UNA vez, cuando el motor propone «Variaciones del ganador», y quedan en la decisión:
// la persona las lee, tilda las que quiere y lanza. Así lo que se aprueba es exactamente lo que sale.
// =============================================================================

import 'server-only';
import { runWithWorkspace } from '@/lib/workspace';
import { chatCheapCascade, CASCADA_DOCS } from '@/lib/ai-cheap';
import { getAdForEdit } from '@/lib/meta-ads-create';
import { transcriptDeAnuncio } from '@/lib/api-mako/areas/ads.helpers';
import { perfilNegocioTexto } from '@/lib/onboarding';
import { leerAnuncioPorZernio } from '@/lib/zernio-ads';
import { promptVariaciones, parsearVariaciones } from './variaciones-prompt';
import { variacionDeBoton } from './variacion-boton';
import type { Decision, Propuesta, Variacion } from './tipos';

export const FEATURE_VARIACIONES = 'media-buyer-variaciones';

/**
 * Los textos actuales del ganador, y su botón: con el token de Meta del negocio, o por Zernio si no lo tiene. Zernio no
 * devuelve el botón (`cta: null`): sin saber cuál tiene, no se arma la variación de botón (variacion-boton.ts).
 */
async function textosDelGanador(ws: number, adId: string): Promise<{ textoPrincipal: string | null; titulo: string | null; cta: string | null; conFormulario: boolean }> {
  try {
    const a = await runWithWorkspace(ws, () => getAdForEdit(adId));
    if (a.creative) {
      return { textoPrincipal: a.creative.primary_text ?? null, titulo: a.creative.headline ?? null, cta: a.creative.cta_type ?? null, conFormulario: !!a.creative.lead_form_id };
    }
  } catch { /* sin token propio o sin permiso: se prueba Zernio */ }
  const z = await leerAnuncioPorZernio(ws, adId).catch(() => null);
  return { textoPrincipal: z?.body ?? null, titulo: null, cta: null, conFormulario: false };
}

/**
 * Escribe las variaciones de una propuesta de «Ganador». Devuelve [] (y el porqué en `motivo`) si no se pudo: sin IA
 * del negocio, o una respuesta sin nada usable. Nunca tira: el resto de la corrida sigue.
 */
export async function prepararVariaciones(ws: number, p: Propuesta | Decision): Promise<{ variaciones: Variacion[]; motivo: string | null }> {
  const adId = p.anuncioBase?.id ?? p.entidadId;
  const esVideo = p.tipo === 'variaciones_hook';
  try {
    const [textos, transcripcion, perfil] = await Promise.all([
      textosDelGanador(ws, adId),
      esVideo ? runWithWorkspace(ws, () => transcriptDeAnuncio(adId)).then((t) => t?.transcript ?? null).catch(() => null) : Promise.resolve(null),
      runWithWorkspace(ws, () => perfilNegocioTexto()).catch(() => ''),
    ]);
    if (!textos.textoPrincipal && !transcripcion) return { variaciones: [], motivo: 'No pude leer los textos del anuncio ganador.' };
    const { system, user } = promptVariaciones({
      tipo: esVideo ? 'hook' : 'texto', textoPrincipal: textos.textoPrincipal, titulo: textos.titulo,
      transcripcion, porQueGana: p.titular, perfilNegocio: perfil,
    });
    const errores: string[] = [];
    const crudo = await runWithWorkspace(ws, () => chatCheapCascade({
      system, user, json: true, maxTokens: 2500, temperature: 0.8, feature: FEATURE_VARIACIONES,
      motivo: 'Media Buyer: variaciones del anuncio ganador', provs: CASCADA_DOCS, erroresOut: errores,
    }));
    if (!crudo) return { variaciones: [], motivo: `Tu IA no contestó: ${errores[0] ?? 'sin respuesta'}. Conéctala en Integraciones.` };
    const variaciones = parsearVariaciones(crudo, textos, adId);
    if (!variaciones.length) return { variaciones: [], motivo: 'Tu IA contestó, pero ninguna variación servía (repetidas o con voseo). MaKo lo vuelve a intentar mañana.' };
    // Y una más, que no escribe la IA: el mismo texto con otro botón (lo prometido a Thiago: variar el CTA).
    const boton = variacionDeBoton(textos, adId);
    return { variaciones: boton ? [...variaciones, boton] : variaciones, motivo: null };
  } catch (e) {
    return { variaciones: [], motivo: e instanceof Error ? e.message : String(e) };
  }
}
