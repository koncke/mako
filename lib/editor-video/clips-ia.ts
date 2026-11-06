// =============================================================================
// editor-video/clips-ia — «Clips mágicos»: la IA del negocio elige los mejores momentos
// =============================================================================
// La transcripción va a la IA en bloques de hasta 20 minutos (`bloquesParaIA`, lib/editor-video/clips.ts); cada bloque
// devuelve sus clips por número de frase, el código los valida (`clipsDeIA`) y al final quedan los de más puntaje que no
// se pisan más de la mitad. Se llama como el B-roll (./broll-ia.ts): `chatClaude` con su feature (`video-editor-clips`,
// default GEMINI con la key del cliente; Claude vetado), con plazo y una reparación del JSON. La ruta lo corre adentro de
// «sólo su IA».
//
// ⚠️ SIN IA, O SI NO ELIGIÓ NADA QUE SIRVA, SALE EL RESPALDO por las reglas (`clipsDeRespaldo`) con el motivo: los clips
// salen igual. Si un bloque falla y otro no, quedan los que llegaron (y se dice).
// =============================================================================

import 'server-only';
import { chatClaude } from '../anthropic';
import { chatCheapCascade, errorDeCascada } from '../ai-cheap';
import { renderPrompt } from '../prompt-render';
import { contenidoNoConfiable } from '../prompt-render-pure';
import { parseJsonObject } from '../json-del-modelo';
import { objetoConUnaReparacion, SYSTEM_REPARAR_JSON } from '../editor-landing/ia-reglas';
import { contextoDelNegocio } from '../negocio-para-crear';
import {
  bloquesParaIA,
  clipsDeIA,
  clipsDeRespaldo,
  cuantosClips,
  elegirSinSolape,
  frasesDeClips,
  transcripcionParaIA,
  type ClipElegido,
  type Frase,
} from './clips';
import { CLIPS_SYSTEM_TEMPLATE, CLIPS_USER_TEMPLATE, FORMATO_CLIPS, PROMPTS_CLIPS } from './clips-prompts';

export const FEATURE_CLIPS = 'video-editor-clips';

/** Todo el trabajo de la IA, con todos los bloques: la ruta corta a 180 s. */
const PLAZO_IA_MS = 150_000;

export type EleccionClips = { clips: ClipElegido[]; conIA: boolean; aviso: string | null };

const reloj = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function reparador(hastaMs: number) {
  return async (crudo: string): Promise<string> =>
    chatCheapCascade({
      system: SYSTEM_REPARAR_JSON,
      user: crudo,
      json: true,
      maxTokens: 3000,
      temperature: 0,
      feature: FEATURE_CLIPS,
      motivo: 'reparar el JSON (clips mágicos del Video Editor)',
      erroresOut: [],
      hastaMs: Math.max(hastaMs, Date.now() + 10_000),
      validar: (t: string) => { try { parseJsonObject(t); return true; } catch { return false; } },
    }).catch(() => '');
}

/** Los mejores momentos de estas frases. Nunca tira: sin IA o con la IA caída vuelve el respaldo y el porqué. */
export async function elegirClips(frasesCrudas: readonly Frase[], pedidos: number): Promise<EleccionClips> {
  const frases = frasesDeClips(frasesCrudas);
  const cuantos = cuantosClips(pedidos);
  const respaldo = (aviso: string): EleccionClips => ({ clips: clipsDeRespaldo(frases, cuantos), conIA: false, aviso });
  if (!frases.length) return { clips: [], conIA: false, aviso: null };
  const t0 = Date.now();
  const hasta = t0 + PLAZO_IA_MS;
  const juntados: ClipElegido[] = [];
  let fallo: string | null = null;
  try {
    const negocio = (await contextoDelNegocio('los mejores momentos de un video del negocio para redes')).slice(0, 1_500);
    const system = await renderPrompt(PROMPTS_CLIPS.system.key, CLIPS_SYSTEM_TEMPLATE, { cuantos: String(cuantos), formato: FORMATO_CLIPS });
    for (const bloque of bloquesParaIA(frases)) {
      if (Date.now() > hasta - 10_000) { fallo = 'El video es muy largo para revisarlo entero de una vez.'; break; }
      const user = await renderPrompt(PROMPTS_CLIPS.user.key, CLIPS_USER_TEMPLATE, {
        negocio: negocio || '(sin datos del negocio)',
        rango: `de ${reloj(frases[bloque.desde].inicio)} a ${reloj(frases[bloque.hasta].fin)}`,
        // Lo que se dice en el video lo dijo una persona: va como dato, no como instrucción.
        transcripcion: contenidoNoConfiable(transcripcionParaIA(frases, bloque), 'transcripcion'),
      });
      try {
        const salida = await chatClaude(system, [{ role: 'user', content: user }], {
          feature: FEATURE_CLIPS,
          motivo: 'Elegir los mejores momentos del video',
          maxTokens: 2_500,
          hastaMs: hasta,
        });
        const raw = await objetoConUnaReparacion(salida, reparador(hasta));
        const { clips, descartes } = clipsDeIA(frases, raw, bloque);
        if (descartes.length) console.warn(`[video-editor:clips] descartes: ${descartes.slice(0, 20).join(' · ')}`);
        juntados.push(...clips);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[video-editor:clips] ${msg}`);
        fallo = await errorDeCascada(/Claude vetado/i.test(msg) ? [] : [msg], 'elegir los clips').catch(() => 'MaKo no pudo revisar el video.');
        if (!juntados.length) break;
      }
    }
  } catch (e) {
    console.error('[video-editor:clips] no se pudo armar el pedido', e);
    fallo = 'MaKo no pudo revisar el video.';
  }
  const elegidos = elegirSinSolape(juntados, cuantos);
  if (!elegidos.length) return respaldo(`${fallo ?? 'MaKo no eligió ningún momento que sirva.'} Van los mejores por las reglas.`);
  return { clips: elegidos, conIA: true, aviso: fallo ? `${fallo} Revisó una parte.` : null };
}
