// =============================================================================
// ai-step-voz — cómo una respuesta de un AI Step pasa a ser una NOTA DE VOZ (AI Step v2, décima tanda)
// =============================================================================
// Pedido de Martín (11/10/2026, FEEDBACK AI STEP 1): «Agrega la opción de responder con audios, ya que se
// puede gracias a que tenemos elevenlabs conectado». El diseño, en docs/diseno-ai-step-v2.md §5.
//
//   · El redactor escribe para ser DICHO (`REGLA_NOTA_DE_VOZ`, lib/setter-conversacion.ts) y las puertas de
//     siempre (`puedeContestarSolo`: la plata, el link sin completar, el tope) miran ese TEXTO.
//   · La voz dice el texto SIN los links (`partirTextoParaVoz`): un link leído en voz alta no sirve, así que
//     va debajo del audio como texto (`enviarBorrador` manda la nota de voz y después el pie).
//   · `TOPE_TEXTO_AUDIO` es el tope de `decirConVoz` con `tope`: lo que no entra NO se corta (el `slice` de
//     antes cortaba en silencio, a mitad de frase); sale el borrador en texto y el aviso dice por qué.
//
// ⚠️ PURO Y SIN `server-only`: lo usan el motor (lib/nutricion.ts), la ruta de «Escuchar» y el test.
// =============================================================================

import { esPasoIA, medioDe, contestaElCaso, type PasoGrafo } from './flujo-grafo';

/** Lo más largo que se le pide a la voz: ~70 palabras con aire (el redactor tiene el pedido de 70). */
export const TOPE_TEXTO_AUDIO = 700;

/**
 * ¿UN AI STEP CONTESTA EN AUDIO CON UNA VOZ QUE NO HAY? (§1: «que la voz exista no es puro: va en el freno async
 * de Publicar»). `voces`: si hay clon propio y los voiceId de las otras. El motivo, corto (va al lado de Publicar),
 * o null. Sólo los que escuchan por WhatsApp (el audio no sale por otro medio) y contestan.
 */
export function vozQueFalta(pasos: readonly PasoGrafo[], voces: { propia: boolean; otras: readonly string[] }): string | null {
  for (const p of pasos) {
    if (!esPasoIA(p) || p.suelta === true || medioDe(p) !== 'whatsapp') continue;
    for (const c of p.casos ?? []) {
      if (!c.audio || !contestaElCaso(c)) continue;
      const propia = c.audio.voz === 'propia';
      if (propia ? !voces.propia : !voces.otras.includes(c.audio.voz)) {
        return `«${(c.titulo ?? '').trim() || 'Un caso'}» contesta en audio y ${propia ? 'todavía no clonaste tu voz' : 'esa voz ya no está'}`;
      }
    }
  }
  return null;
}

/** Un link (con o sin protocolo `http`): no se lee, va debajo. Los placeholders `[tu link …]` también. */
const LINK = /(?:https?:\/\/\S+|www\.\S+|\[tu link[^\]]*\])/gi;

/** El texto que dice la voz (sin links, sin emojis) y lo que va debajo como texto (los links, uno por renglón). */
export function partirTextoParaVoz(texto: string): { hablado: string; pie: string } {
  const t = (texto ?? '').trim();
  const links = [...new Set(t.match(LINK) ?? [])].map((l) => l.replace(/[).,;:!?]+$/, ''));
  const hablado = t
    .replace(LINK, '')
    // Los emojis no se dicen (y ElevenLabs los lee como ruido o los saltea de mala manera).
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim();
  return { hablado, pie: links.join('\n') };
}
