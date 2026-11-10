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

/**
 * Cuántas referencias conviene mandar. **UNA.**
 *
 * ⚠️ ESTE NÚMERO ERA 14 Y ESTABA MAL. Lo saqué del README de un proveedor («upload up to 14 reference images»),
 * que es lo que su API ACEPTA, no lo que funciona. Nuestra propia producción dice lo contrario, medida y escrita
 * en el curso del avatar de Mauricio (`app/conocimientos/curso-avatar-app.ts`, clase 1):
 *
 *   «**menos referencias es mejor.** Pasarle tres fotos distintas al modelo son tres encuadres distintos entre
 *   los que elige o promedia — por eso cada toma salía con otro ángulo. **Una sola referencia.**»
 *
 * Y de la misma clase, la regla que la explica: «la fuente de identidad es SIEMPRE una foto real de la persona»
 * y «cualquier flujo que encadene generación sobre generación acumula deriva en cada salto».
 */
export const REFERENCIAS_RECOMENDADAS = 1;

/** El tope duro. Entre 2 y esto se avisa; arriba se rechaza. */
export const TOPE_REFERENCIAS = 4;

/** Cómo se llama cada pieza cuando hay que nombrarla en pantalla. */
export const COMO_SE_LLAMA: Record<QueSeClona, string> = {
  carrusel: 'lámina de carrusel',
  anuncio: 'pieza de anuncio',
  thumbnail: 'miniatura de YouTube',
};

/** El nombre de la pieza EN INGLÉS, porque el preámbulo va en inglés: así se midió. */
const EN_INGLES: Record<QueSeClona, string> = {
  carrusel: 'carousel slide',
  anuncio: 'single-image ad',
  thumbnail: 'YouTube thumbnail',
};

/**
 * Qué modelo CONSERVA la imagen y cuál la redibuja. **Medido el 7/11/2026 con la misma referencia y el mismo
 * pedido**, no leído de una lista.
 *
 * | modelo | US$ | qué hizo |
 * |---|---|---|
 * | `gemini-nano-banana-2.1-ext` | 0,0120 | conservó tipografía, encabezado, encuadre, fondo y la otra persona |
 * | `seedream-5-0-flash` | 0,0137 | la cara salió mejor, pero **redibujó todo y rompió el texto del encabezado** |
 *
 * ⚠️ La diferencia no es «calidad»: es **obediencia**. El segundo hace mejores caras y peores copias, y en una
 * copia el texto roto se nota antes que una cara un 10 % mejor — «GREATINE STRATEOIST» es inusable y una cara
 * apenas distinta, no.
 */
export const MODELO_QUE_CONSERVA = 'gemini-nano-banana-2.1-ext';

/** Lo que cuesta, medido: una lámina clonada sale un centavo. */
export const USD_POR_LAMINA_CLONADA = 0.0120;

/**
 * El prompt para clonar, armado para que la REFERENCIA mande.
 *
 * `pedido` es lo único que cambia: lo que el negocio quiere distinto del ejemplo («que diga X», «con mi logo»).
 * Todo lo que el ejemplo ya muestra —el estilo, el color, la composición— NO se escribe: está en la imagen.
 */
/**
 * Lo que NO se toca, dicho ANTES de lo que cambia. Es la mitad que faltaba.
 *
 * ⚠️ SALIÓ DE UNA COMPARACIÓN MEDIDA EL 7/11/2026, y el antes/después es brutal. La versión anterior decía
 * «con el mismo estilo visual que la imagen de referencia», y eso **le pide al modelo que reinterprete**: le
 * describís un estilo en vez de pedirle que conserve una imagen. Martín lo rechazó mirando el resultado: «ni
 * siquiera la tipografía es igual, ni cómo se acomoda la letra».
 *
 * Con la MISMA referencia (la portada de un carrusel real) y el MISMO pedido —cambiar a UNA persona—:
 *   · con este preámbulo → se conservaron la tipografía, el encabezado, el encuadre, el fondo y la otra
 *     persona; cambió sólo la cara pedida. **US$0,012.**
 *   · sin él, el modelo libre → redibujó todo y **rompió el texto del encabezado**: «CREATIVE STRATEGIST»
 *     salió «GREATINE STRATEOIST» y «©2026» salió «©2023».
 *
 * Va en inglés porque así se midió. No es una preferencia: es el texto que produjo el resultado bueno.
 */
const NO_TOQUES = (que: string, conserva: readonly string[] = CONSERVA_TODO) => [
  `This reference image is a ${que} and it is the only source of truth.`,
  'Keep it exactly as it is. Do not redraw it, do not restyle it, do not change the layout.',
  `Keep ${enumerar(conserva)} unchanged.`,
  'ONE change only:',
].join(' ');

/**
 * Lo que se conserva por defecto: TODO. El orden y las palabras son las del prompt medido el 7/11 (no se tocan sin medir).
 *
 * ⚠️ Un paso que CAMBIA una de estas cosas (la plancha saca el TEXTO, el avatar cambia a la PERSONA: lib/carruseles/plancha.ts)
 * no puede pedir que se conserve lo mismo que cambia: «Keep the text unchanged. ONE change only: remove the text» es una orden
 * que se contradice, y el modelo elige una de las dos. Por eso `promptDeClon` recibe qué se conserva.
 */
export const CONSERVA_TODO = ['the typography', 'the text', 'the colours', 'the framing', 'the background', 'the people'] as const;

/** «a, b and c», como lo dice el prompt medido. */
const enumerar = (xs: readonly string[]): string => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/**
 * El prompt del clonado: primero lo que se conserva, después el único cambio.
 *
 * ⚠️ Y el largo NO es el enemigo, que era lo que yo creía. Lo que compite con la referencia es DESCRIBIR EL
 * ESTILO con palabras; enumerar lo que hay que dejar quieto **ancla** en vez de competir. El prompt que
 * funcionó tenía ~470 caracteres y el que falló, menos.
 */
export function promptDeClon(que: QueSeClona, pedido: string, conserva: readonly string[] = CONSERVA_TODO): string {
  const p = pedido.replace(/\s+/g, ' ').trim();
  return `${NO_TOQUES(EN_INGLES[que], conserva)} ${p}`.trim();
}

/** Sólo para los tests y para explicarlo en pantalla: el preámbulo que conserva la imagen. */
export const PREAMBULO_CLON = NO_TOQUES('carousel slide');

/**
 * Por qué un pedido de clonado no sirve, o `null` si sirve.
 *
 * ⚠️ RECIBE EL PEDIDO DE LA PERSONA, **no** el prompt armado por `promptDeClon`. Lo digo fuerte porque me
 * equivoqué el 7/11 y el test me lo cazó: el preámbulo que conserva la imagen son 211 caracteres, así que
 * validando el prompt ENTERO contra el tope de 240 quedaba rechazado **cualquier** pedido — el clonado no
 * habría dejado pasar ni uno.
 *
 * El tope sigue valiendo para el pedido, por el motivo de siempre: con una imagen enfrente, describir con
 * palabras compite con ella. Lo que NO compite es enumerar qué dejar quieto, y por eso el preámbulo no cuenta.
 */
export function porQueNoSirveElClon(pedido: string, referencias: number): string | null {
  const p = pedido.replace(/\s+/g, ' ').trim();
  if (!referencias) {
    return 'Para clonar hace falta al menos una imagen de referencia: sin ella esto es generar desde cero.';
  }
  if (referencias > TOPE_REFERENCIAS) {
    // ⚠️ No es un tope administrativo: con varias referencias el modelo PROMEDIA encuadres. Medido en la
    // producción de los anuncios de Mauricio: con tres fotos, cada toma salió con otro ángulo.
    return `Son ${referencias} referencias y lo que funciona es ${REFERENCIAS_RECOMENDADAS}: con varias, el modelo promedia encuadres y cada pieza sale con otro ángulo.`;
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
