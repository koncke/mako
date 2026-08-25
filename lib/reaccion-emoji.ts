// =============================================================================
// reaccion-emoji — con qué reacciona MaKo. Sin `server-only`, testeable.
// =============================================================================
// PEDIDO DEL DUEÑO (2026-08-25), en dos partes:
//
//   1. «Que MaKo SIEMPRE reaccione con un emoji de risas o corazón a todos los
//      stickers o emojis o gifs que suelten. Corazón si amerita, como un sticker
//      de gracias o cosas así, y risa para todo el resto».
//   2. «Que también reaccione con un Like pulgar arriba a todas las peticiones,
//      para afirmar que la recibió».
//
// Las dos resuelven lo mismo desde ángulos distintos: **un chat donde el otro no
// acusa recibo se siente muerto**. Hasta hoy un sticker caía en el `skip` de «sin
// texto ni audio ni adjunto» y MaKo no hacía absolutamente nada — indistinguible
// de estar caída, que es justo la sensación que este cliente ya tuvo tres veces.
//
// Una reacción es el acuse MÁS BARATO que existe: no ocupa un renglón del chat, no
// interrumpe, y se ve al instante.
// =============================================================================

/** El acuse de recibo. Va en TODA petición que MaKo se va a poner a procesar. */
export const EMOJI_RECIBIDO = '👍';

export const EMOJI_RISA = '😂';
export const EMOJI_CORAZON = '❤️';

/**
 * Emojis que piden corazón y no risa: agradecer, celebrar, querer.
 *
 * ⚠️ Reírse de un «gracias» es exactamente el error que hay que evitar — queda
 * como burla. Por eso la lista del corazón se mira PRIMERO y el resto cae a risa,
 * que es el default que el dueño pidió.
 */
const CORAZON = /[\u2764\u{1F970}\u{1F60D}\u{1F618}\u{1F617}\u{1F619}\u{1F61A}\u{1F496}-\u{1F49F}\u{1F91F}\u{1F64F}\u{1F44F}\u{1F929}\u{1F917}\u{1F31F}\u{2728}\u{1F38A}\u{1F389}\u{1F44C}]/u;
/** Palabras de agradecimiento, para stickers que traen texto encima. */
const GRACIAS = /\b(gracias|graciass+|thank|thanks|te (lo )?agradezco|genio|crack|capo|sos un (genio|crack|capo)|abrazo|bravo|felicit)/i;

/**
 * Con qué reaccionar a un sticker, gif o emoji suelto.
 *
 * `pista` es lo que se pueda sacar del mensaje: el emoji si vino como texto, o la
 * etiqueta del sticker si el proveedor la manda. Vacío → risa, que es el default.
 */
export function reaccionPara(pista: string | null | undefined): string {
  const p = (pista ?? '').trim();
  if (!p) return EMOJI_RISA;
  if (CORAZON.test(p) || GRACIAS.test(p)) return EMOJI_CORAZON;
  return EMOJI_RISA;
}

/**
 * ¿Este mensaje es SOLO emojis? (uno o varios, sin palabras).
 *
 * Se pide "solo": «jaja 😂» es un mensaje con texto y se contesta, no se reacciona.
 * El tope de largo evita que un párrafo lleno de emojis cuente como emoji suelto.
 */
export function esSoloEmoji(texto: string | null | undefined): boolean {
  const t = (texto ?? '').trim();
  if (!t || t.length > 24) return false;
  // Sin letras ni dígitos: lo que queda son emojis, símbolos y espacios.
  return !/[\p{L}\p{N}]/u.test(t) && /\p{Extended_Pictographic}/u.test(t);
}
