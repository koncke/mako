// =============================================================================
// Lo que ESCRIBE la persona en el onboarding: cómo dice que sí, que no, y en qué moneda (21/10/2026)
// =============================================================================
// Detectores, no copy: nada de acá se muestra. Viven aparte de lib/onboarding-arranque.ts (que SÍ tiene el copy del chat)
// porque reconocen formas de todas partes —«ándale» de México, «soles» de Perú, «lucas» y «palos» del Río de la Plata—
// y el guard de voseo (tests/puente-panel-copy.test.ts) va por archivo: este queda en su FUERA_DE_ALCANCE, como
// lib/onboarding-troleo.ts. Lo usan `siONo` y `monedaLocal` (lib/onboarding-arranque.ts). Sin tildes: se compara contra el
// texto normalizado.
// =============================================================================

/**
 * Lo que dice que sí, solo o en fila («Sí, está bien», «Correcto, así se llama», «Siii», «Claro que sí»). Con la tercera
 * revisión del Cerebro (21/10): «Sí, es así», «sisi», «Vale», «Listo», «Ajá», «Simón», «Ándale» y «Eso mismo» también son
 * un sí al nombre que espera; antes se volvían el nombre propuesto.
 */
export const DICE_SI = [
  '(?:s+i+)+', 'sip', 'claro', 'claro que si', 'correcto', 'es correcto', 'exacto', 'exactamente', 'asi es', 'asi', 'eso',
  'eso es', 'eso mismo', 'asi mismo', 'ese', 'esa', 'ese es', 'esa es', 'es ese', 'es esa', 'ese mismo', 'esa misma', 'el mismo',
  'es asi', 'es eso', 'es exacto', 'es perfecto', 'mejor asi', 'en realidad si', 'dale', 'ok', 'okay', 'okey', 'oki',
  'perfecto', 'esta bien', 'esta perfecto', 'de acuerdo', 'de una', 'obvio', 'por supuesto', 'por favor', 'gracias',
  'tal cual', 'asi se llama', 'se llama asi', 'confirmo', 'afirmativo', 'va', 'sale', 'genial', 'bien', 'muy bien', 'vale',
  'venga', 'listo', 'aja', 'simon', 'andale', 'orale', '👍', '✅', '👌', '🙌',
];

/**
 * Lo que NOMBRA lo que se pregunta sin decir que sí: «es», «el nombre», «mi negocio», «mi marca personal». Vale como sí
 * SÓLO detrás de un sí explícito («Sí, es mi negocio»). Suelto no confirma nada (cuarta revisión, 21/10: con el pendiente
 * mal leído «Vendo ropa», «Es mi marca personal» —que quiere decir «uso mi nombre»— guardaba «Vendo ropa»), y tampoco es
 * un nombre: lib/onboarding-arranque.ts vuelve a preguntar, o propone el de la persona si dice que usa el suyo.
 */
export const NOMBRA_LO_PREGUNTADO = ['es', 'el nombre', 'ese nombre', 'mi negocio', 'mi emprendimiento', 'mi marca', 'mi marca personal', 'es mi negocio',
  'es mi emprendimiento', 'es mi marca', 'es mi marca personal', 'es el nombre'];

/** Lo que dice que no. */
export const DICE_NO = ['no+', 'nop', 'nope', 'incorrecto', 'para nada', 'no es asi', 'no es', 'no se llama asi', 'esta mal', 'negativo', 'nada que ver', '👎'];

/** Lo que puede venir detrás de un no: «gracias», «ese no» o el texto del botón («No, lo escribo de nuevo»). */
export const TRAS_EL_NO = [...DICE_NO, 'gracias', 'ese no', 'esa no', 'ese', 'esa', 'lo escribo de nuevo', 'te lo escribo', 'lo cambio'];

/** Una cifra dicha en dólares (o euros, que se toman como tales): los tramos del diagnóstico son en dólares. */
export const MONEDA_DOLAR = /usd|us\$|u\$s|dolar|\bdls\b|\bverdes\b|euro/;

/** Una cifra dicha en una moneda que no es el dólar: pesos, soles, «lucas» o «palos» (miles y millones de pesos). */
export const MONEDA_LOCAL = /\b(?:pesos?|ars|mxn|cop|clp|pen|soles|bolivianos|guaranies|quetzales|lempiras|colones|lucas?|palos?|mangos?)\b/;
