// =============================================================================
// Clonar un diseño DESDE SU IMAGEN de referencia — la regla, sin servidor (7/11/2026)
// =============================================================================
// Martín, 7/11: «que se puedan clonar, literalmente, con prompting las imágenes mediante el ejemplo de referencia
// de la competencia… no sólo carruseles, ads y thumbnails también».
//
// QUÉ ES, Y QUÉ NO. Esto NO reemplaza a `replica-servidor.ts`. Son dos caminos distintos y los dos sirven:
//   · `replicarEjemplo` devuelve un DISEÑO EDITABLE: estructura + textos en JSON, reescritos con la voz del
//     negocio. Es el norte que fijó Martín el 7/11 («lo único full editable es el texto»).
//   · Esto devuelve el PARECIDO VISUAL: la imagen de referencia va a la IA de imagen y vuelve algo similar.
// La pantalla ofrece los dos y el usuario elige. Ver docs/hallazgos-carruseles.md.
//
// ⚠️ LA LECCIÓN QUE GOBIERNA TODO ESTE ARCHIVO, y ya se pagó una vez (lib/curso-avatar.ts:65):
// **«la descripción textual COMPITE con la imagen de referencia, y el modelo prefiere el texto»**. O sea que
// cuanto MÁS se describe con palabras lo que la imagen ya muestra, MENOS se parece el resultado. Con una
// referencia enfrente, un prompt largo no es "más detalle": es ruido que tapa la referencia.
//
// Por eso acá el prompt es CORTO a propósito, y hay una validación determinista que lo exige. Es la regla de la
// casa, escrita en lib/formato-prompt.ts: «el texto en el prompt para que el modelo acierte, Y una validación
// determinista para cuando no acierte. Sin esto, "no describas la cara" es una expresión de deseo».
//
// ⚠️ Y POR QUÉ LA VALIDACIÓN NO BUSCA PALABRAS. La guarda hermana (`porQueNoSirveElPrompt`) ya intentó una lista
// de 25 palabras y, medida contra el único prompt real que existía, dio **10 coincidencias y las 10 falsas**;
// está anotado ahí mismo que «una guarda que rechaza todo se apaga a la semana». Describir una imagen se puede
// hacer con cualquier palabra, así que una lista nunca va a cubrirlo y siempre va a marcar de más. Lo que sí es
// medible sin equivocarse es **cuánto texto hay**: ése es el que compite con la referencia.
// =============================================================================

/** Lo que se puede clonar. Los tres salen del mismo lugar: `replicarEjemplo` ya los distingue. */
export type QueSeClona = 'carrusel' | 'anuncio' | 'thumbnail';

/**
 * Cuántos caracteres puede tener el prompt cuando hay una imagen de referencia.
 *
 * ⚠️ NO es un número redondo elegido a ojo: es el largo del prompt de video del formato
 * (`promptVideoDeFormato`), que es el único prompt con referencia que ya funciona en producción —«Esta persona
 * dice: "{{voz}}", <movimiento> Todo natural.»—, con lugar para un pedido concreto. Si alguna vez se mide que
 * uno más largo anda mejor, se sube ACÁ y se dice qué se midió.
 */
export const TOPE_PROMPT_CON_REFERENCIA = 240;

/**
 * Debajo de esto el pedido no dice nada y el modelo improvisa: devuelve la referencia cambiada al azar.
 *
 * ⚠️ EMPECÉ EN 12 Y ESTABA MAL: **«con mi logo» tiene 11 caracteres** y es un pedido perfectamente válido. Lo
 * cazó el test al probar una frase real, no un `'x'.repeat(n)`. Es exactamente lo que advierte la guarda hermana
 * (`porQueNoSirveElPrompt`): «una guarda que rechaza todo se apaga a la semana». El piso existe para frenar un
 * pedido VACÍO, no para exigir que sea largo — exigir largo es lo contrario de lo que este archivo defiende.
 */
export const PISO_PROMPT = 4;

/** El tope de referencias por pedido. Más de esto y el modelo promedia estéticas en vez de copiar una. */
export const TOPE_REFERENCIAS = 14;

const COMO_SE_LLAMA: Record<QueSeClona, string> = {
  carrusel: 'lámina de carrusel',
  anuncio: 'pieza de anuncio',
  thumbnail: 'miniatura de YouTube',
};

/**
 * El prompt para clonar, armado para que la REFERENCIA mande.
 *
 * `pedido` es lo único que cambia: lo que el negocio quiere distinto del ejemplo («que diga X», «con mi logo»).
 * Todo lo que el ejemplo ya muestra —el estilo, el color, la composición— NO se escribe: está en la imagen.
 */
export function promptDeClon(que: QueSeClona, pedido: string): string {
  const p = pedido.replace(/\s+/g, ' ').trim();
  return `Una ${COMO_SE_LLAMA[que]} con el mismo estilo visual que la imagen de referencia. ${p}`.trim();
}

/** Por qué un pedido de clonado no sirve, o `null` si sirve. */
export function porQueNoSirveElClon(prompt: string, referencias: number): string | null {
  const p = prompt.replace(/\s+/g, ' ').trim();
  if (!referencias) {
    return 'Para clonar hace falta al menos una imagen de referencia: sin ella esto es generar desde cero.';
  }
  if (referencias > TOPE_REFERENCIAS) {
    return `Son ${referencias} referencias y el tope es ${TOPE_REFERENCIAS}: con más, el modelo promedia estéticas en vez de copiar una.`;
  }
  if (p.length < PISO_PROMPT) {
    // ⚠️ Los mensajes de este archivo los LEE EL CLIENTE: van en español neutro con «tú», nunca en voseo.
    // Lo fija `tests/puente-panel-copy.test.ts`, y me lo cazó a mí el 7/11: la prosa del repo es toda voseo y se
    // arrastra sin darse cuenta, porque la frase suena perfecta igual.
    return 'El pedido está vacío: indica qué quieres distinto del ejemplo, o el modelo improvisa.';
  }
  // ⚠️ ACÁ VIVE LA LECCIÓN. No se buscan palabras —eso ya se probó y marcaba de más—: se mide el TEXTO, que es
  // lo que compite con la referencia.
  if (p.length > TOPE_PROMPT_CON_REFERENCIA) {
    return `El pedido tiene ${p.length} caracteres y el tope con una referencia es ${TOPE_PROMPT_CON_REFERENCIA}. `
      + 'Con una imagen enfrente, el texto largo compite con ella y el resultado se parece menos, no más: '
      + 'escribe sólo lo que quieres DISTINTO del ejemplo.';
  }
  return null;
}
