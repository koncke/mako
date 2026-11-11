// =============================================================================
// doer-modelo — con qué modelo contesta MaKo en WhatsApp cuando corre por la capa barata (27/10/2026)
// =============================================================================
// La lectura del Cerebro de los grupos del 20 al 27/10: 38 de 42 turnos con Gemini fueron flash-lite, un negocio fijo en
// `gpt-4o-mini` y otro en Groq. Lo decidido: el doer usa la IA y el modelo que eligió el admin del negocio. Para su ChatGPT
// la app ya no corre `gpt-4o-mini` desde el 23/10 (903f79543): el admin elige y, si no eligió, `MODELO_SU_OPENAI_DEFAULT`, uno
// que sabe orquestar herramientas. El doer seguía con `gpt-4o-mini` fijo.
//
// PURO y sin `server-only`: lo usan lib/mako-doer-in.ts y tests/doer-modelo.test.ts.
// =============================================================================

import { MODELO_SU_OPENAI_DEFAULT } from './chat-ia-reglas';

/** El pin que manda en /modelos-ia para `mako-doer-in`, como lo devuelve `overrideDeFeature`. */
export type PinDeFeature = { provider: string; model: string } | null;

/** Los proveedores que NO contestan texto en el doer: Groq sólo escucha las notas de voz (IA16, `PROVS_SOLO_AUDIO`), y
 *  Claude va por su propio camino (no por la capa barata). */
const NO_SON_DE_LA_CAPA_BARATA = new Set(['anthropic', 'groq']);

/**
 * Sin su IA y sin pin, el OpenAI barato (11/11/2026). Antes era `null`, y el turno caía en una rama que le pedía Sonnet u Opus a la
 * puerta 1, que el veto corta: el grupo de un negocio sin su IA se quedaba sin el «Claude primero» (el crédito de los grupos)
 * el día que alguien sacara el pin de /modelos-ia. Con un pin siempre, ese camino corre siempre; el OpenAI sólo lo usa quien
 * tiene una clave suya (en el ws 9, la de la plataforma).
 */
export const OPENAI_BARATO_DEL_DOER = { provider: 'openai', model: 'gpt-4o-mini' } as const;

/**
 * El pin de la capa barata del doer: el de /modelos-ia si es de un proveedor que contesta texto ahí; si no, con su IA, su
 * OpenAI con el modelo por defecto de la app (`MODELO_SU_OPENAI_DEFAULT`), nunca `gpt-4o-mini`; sin su IA, el OpenAI barato
 * (`OPENAI_BARATO_DEL_DOER`), NUNCA ninguno. Un pin a Groq (lo que tenía un negocio el 27/10) se ignora: Groq no contesta texto
 * desde IA16.
 */
export function pinDelDoer(pin: PinDeFeature, suIA: boolean): { provider: string; model: string } {
  if (pin && !NO_SON_DE_LA_CAPA_BARATA.has(pin.provider)) {
    // Un pin viejo a gpt-4o-mini con su IA: el de la app (el admin no lo eligió en la app; es el default de antes).
    if (suIA && pin.provider === 'openai' && pin.model === 'gpt-4o-mini') return { provider: 'openai', model: MODELO_SU_OPENAI_DEFAULT };
    return pin;
  }
  return suIA ? { provider: 'openai', model: MODELO_SU_OPENAI_DEFAULT } : { ...OPENAI_BARATO_DEL_DOER };
}
