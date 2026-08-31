// =============================================================================
// Lo que cuesta un clip — exacto, por duración
// =============================================================================
// ⚠️ NO ES UNA ESTIMACIÓN, y decirlo así era el problema. La pantalla mostraba
// «~15 (estimado) créditos» para toda toma, viniera de un clip de 4 segundos o de
// uno de 10. Martín lo corrigió con la tabla medida: «no es costo ESTIMADO, es
// exacto — 15 si son 10s, 12 para 8s, 10 para 6s y 7 para 4s».
//
// Un número acompañado de «~» y de «(estimado)» le pide a la persona que
// desconfíe de un dato que sí conocemos, y encima cobra de más en los clips
// cortos: 15 sobre uno de 4 segundos es más del doble de lo que sale.
//
// SIN `server-only`: es una tabla y necesita test.

/**
 * Créditos por clip, según cuántos segundos dura. Medido contra Flow.
 *
 * ⚠️ El precio NO es lineal: 4 s cuesta 7 y 10 s cuesta 15, o sea que el segundo
 * de un clip corto sale casi el doble que el de uno largo. Por eso es una TABLA y
 * no una multiplicación — una regla de tres acá daría 17,5 para 10 s y estaría
 * cobrando de más justo en el caso normal.
 */
export const CREDITOS_POR_DURACION: Record<number, number> = {
  4: 7,
  6: 10,
  8: 12,
  10: 15,
};

/**
 * Los créditos de un clip de esa duración, o `null` si no está en la tabla.
 *
 * ⚠️ `null` y no «el más parecido». Devolver el precio de otra duración sería
 * inventar un número exacto, que es peor que admitir una estimación: quien llama
 * puede caer al costo global y decir «~15 (estimado)», que al menos es honesto
 * sobre lo que sabe.
 */
export function creditosDeClip(segundos: number): number | null {
  const c = CREDITOS_POR_DURACION[Math.round(segundos)];
  return typeof c === 'number' ? c : null;
}
