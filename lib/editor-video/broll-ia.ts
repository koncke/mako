// =============================================================================
// editor-video/broll-ia — qué B-roll poner: la IA del negocio elige entre los huecos del código
// =============================================================================
// El código arma DÓNDE (lib/editor-video/broll.ts → `huecosParaBroll`); acá la IA del negocio elige cuáles y escribe
// la búsqueda de cada uno. Se llama como el chat del editor (lib/editor-video/ia.ts): `chatClaude` con su propia feature
// (`video-editor-broll`, default GEMINI con la key del cliente; Claude vetado), con plazo, una reparación del JSON y nada
// más. Corre adentro de «sólo su IA» (la ruta lo prende con `conSuIADelNegocio`).
//
// ⚠️ SI LA IA NO ESTÁ O FALLA, EL B-ROLL SALE IGUAL, con el respaldo sin IA (`eleccionDeRespaldo`: la palabra más
// fuerte de cada frase), y `conIA: false` con el motivo, para que la pantalla lo diga en una línea. Un B-roll que no sale
// porque la IA tuvo un mal minuto es peor que uno un poco más genérico.
// =============================================================================

import 'server-only';
import { chatClaude } from '../anthropic';
import { chatCheapCascade, errorDeCascada } from '../ai-cheap';
import { renderPrompt } from '../prompt-render';
import { contenidoNoConfiable } from '../prompt-render-pure';
import { parseJsonObject } from '../json-del-modelo';
import { objetoConUnaReparacion, SYSTEM_REPARAR_JSON } from '../editor-landing/ia-reglas';
import { contextoDelNegocio } from '../negocio-para-crear';
import { eleccionDeIA, eleccionDeRespaldo, TOPES_BROLL, type BrollElegido, type HuecoBroll } from './broll';

export { huecosDelPedido } from './broll';
import { BROLL_SYSTEM_TEMPLATE, BROLL_USER_TEMPLATE, FORMATO_BROLL, PROMPTS_BROLL } from './broll-prompts';

export const FEATURE_BROLL = 'video-editor-broll';

/** La IA tiene hasta acá; la ruta corta a 120 s. */
const PLAZO_IA_MS = 45_000;

export type EleccionBroll = { elegidos: BrollElegido[]; conIA: boolean; aviso: string | null };

function reparador(hastaMs: number) {
  return async (crudo: string): Promise<string> =>
    chatCheapCascade({
      system: SYSTEM_REPARAR_JSON,
      user: crudo,
      json: true,
      maxTokens: 2000,
      temperature: 0,
      feature: FEATURE_BROLL,
      motivo: 'reparar el JSON (B-roll del Video Editor)',
      erroresOut: [],
      hastaMs: Math.max(hastaMs, Date.now() + 10_000),
      validar: (t: string) => { try { parseJsonObject(t); return true; } catch { return false; } },
    }).catch(() => '');
}

/** Qué B-roll poner en estos huecos. Nunca tira: sin IA o con la IA caída vuelve el respaldo y el porqué. */
export async function elegirBroll(huecos: readonly HuecoBroll[], objetivo: number): Promise<EleccionBroll> {
  const tope = Math.max(0, Math.min(objetivo, TOPES_BROLL.maxPropuestas, huecos.length));
  if (!tope) return { elegidos: [], conIA: false, aviso: null };
  const respaldo = (aviso: string): EleccionBroll => ({ elegidos: eleccionDeRespaldo(huecos, tope), conIA: false, aviso });
  const t0 = Date.now();
  try {
    const negocio = (await contextoDelNegocio('imágenes para un video corto del negocio')).slice(0, 1_500);
    const [system, user] = await Promise.all([
      renderPrompt(PROMPTS_BROLL.system.key, BROLL_SYSTEM_TEMPLATE, { objetivo: String(tope), formato: FORMATO_BROLL }),
      renderPrompt(PROMPTS_BROLL.user.key, BROLL_USER_TEMPLATE, {
        negocio: negocio || '(sin datos del negocio)',
        // Lo que se dice en el video lo dijo una persona: va como dato, no como instrucción.
        huecos: contenidoNoConfiable(JSON.stringify(huecos.map((h) => ({ hueco: h.i, frase: h.frase, palabras: h.palabras }))), 'huecos'),
      }),
    ]);
    const hasta = t0 + PLAZO_IA_MS;
    const salida = await chatClaude(system, [{ role: 'user', content: user }], {
      feature: FEATURE_BROLL,
      motivo: 'Elegir el B-roll del video',
      maxTokens: 1_500,
      hastaMs: hasta,
    });
    const raw = await objetoConUnaReparacion(salida, reparador(hasta));
    const { elegidos, descartes } = eleccionDeIA(huecos, raw, tope);
    if (descartes.length) console.warn(`[video-editor:broll] descartes: ${descartes.slice(0, 20).join(' · ')}`);
    if (!elegidos.length) return respaldo('MaKo no eligió ninguna imagen: van las palabras de cada frase.');
    return { elegidos, conIA: true, aviso: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[video-editor:broll] ${msg}`);
    const porque = await errorDeCascada(/Claude vetado/i.test(msg) ? [] : [msg], 'elegir las imágenes').catch(() => 'MaKo no pudo elegir las imágenes.');
    return respaldo(`${porque} Van las palabras de cada frase.`);
  }
}
