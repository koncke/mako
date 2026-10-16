// =============================================================================
// info-principal-grilla — cuántas columnas tiene «Información principal» (InfoPrincipalCard), PURO
// =============================================================================
// Era un 2×2 fijo. Con la ficha por bloques la tarjeta también va de ½, en la tablet y en la vista
// «Celular» de «Personalizar», y medido el 16/10/2026 en el banco de la ficha (Chrome sin ventana, las dos
// puertas reales) quedaba así: a ½ en el pop-up cada celda medía ~200 px y el email se partía letra por letra;
// en la tablet y en el celular, una letra por renglón.
//
// La regla: DOS COLUMNAS COMO MUCHO (nunca 3 arriba y 1 abajo, que era lo que cuidaba el 2×2) y UNA cuando la
// tarjeta es angosta. Lo decide el ancho de la TARJETA y no el de la ventana, sin @container: un
// `container-type` en un ancestro ataría el modal fijo del WhatsApp no oficial (ficha/ficha-css.ts). Cada
// columna mide como mínimo COLUMNA_MIN_INFO o la mitad del ancho, así que con `auto-fit` entran dos o una.
// Lo fija tests/ficha-navegador.test.ts.
// =============================================================================

/** El ancho mínimo de una celda: el email con sus dos botones (copiar, escribir) entra en una línea. */
export const COLUMNA_MIN_INFO = 300;
/** El hueco entre las dos columnas (el `gap` de la grilla). */
export const HUECO_COLUMNAS_INFO = 24;

// El «+ 1» deja medio píxel de aire: con la mitad exacta, el redondeo del navegador puede no meter la segunda.
export const GRILLA_INFO_PRINCIPAL =
  `repeat(auto-fit, minmax(min(100%, max(${COLUMNA_MIN_INFO}px, calc((100% - ${HUECO_COLUMNAS_INFO + 1}px) / 2))), 1fr))`;

/**
 * Las columnas que dibuja `GRILLA_INFO_PRINCIPAL` en un ancho de contenido: la cuenta de `auto-fit` de CSS Grid
 * (cuántas pistas de su mínimo, con su hueco, entran), con los mismos números.
 */
export function columnasInfoPrincipal(ancho: number): number {
  const min = Math.min(ancho, Math.max(COLUMNA_MIN_INFO, (ancho - HUECO_COLUMNAS_INFO - 1) / 2));
  if (min <= 0) return 1;
  return Math.max(1, Math.floor((ancho + HUECO_COLUMNAS_INFO) / (min + HUECO_COLUMNAS_INFO)));
}
