// =============================================================================
// Cuánto dura cada toma de un anuncio: una LISTA, nunca un número
// =============================================================================
// Vive aparte del bucle (`worker/montar-cola.mjs`) por una razón sola: el bucle
// arranca `main()` al importarse, así que no se puede probar sin levantar el
// contenedor. Un módulo que no arranca nada sí se importa desde un test.
//
// ⚠️ LAS TOMAS DE UN ANUNCIO NO DURAN TODAS LO MISMO — medido: 10, 8 y 10.
//
// `scripts/plan-cortes-anuncio.mjs` topea cada toma en el número que recibe, y el
// worker le pasaba SÓLO el de la primera (`seg[0] ?? 10.005`), con un comentario
// que afirmaba que todas duraban igual. Consecuencia: en una toma más larga que la
// primera, lo que se decía después de ese tope no entraba en ningún tramo y se iba
// del anuncio **sin un error** — mientras la pantalla le aseguraba al cliente «Se
// fue el silencio, no una palabra».
//
// La ruta de Vercel (`lib/montaje/pipeline.ts`) ya armaba la lista entera; esta es
// la misma cuenta para la ruta del contenedor. El código no se comparte porque el
// worker no puede importar TypeScript: se copia suelto en `worker/Dockerfile`.

/** El largo de un clip de Flow cuando el pedido no lo dice. */
export const DUR_POR_DEFECTO = 10.005;

/**
 * La duración de CADA toma, en orden, una por clip.
 *
 * El largo lo manda la cantidad de tomas, no la lista: una lista corta —o con un
 * agujero— completa con el default, y una lista más larga que las tomas se recorta.
 * Lo que no es un número positivo (null, '', 0, NaN, un texto) también cae al
 * default: un cero topearía la toma en nada y la perdería entera.
 *
 * @param {unknown} segundosPorToma lo que vino en el pedido, sin limpiar
 * @param {number} nTomas cuántos clips tiene el anuncio
 * @returns {number[]} una duración por toma, en segundos
 */
export function duracionesDeTomas(segundosPorToma, nTomas) {
  const seg = Array.isArray(segundosPorToma) ? segundosPorToma : [];
  const n = Number.isFinite(nTomas) && nTomas > 0 ? Math.floor(nTomas) : 0;
  return Array.from({ length: n }, (_, i) => {
    const d = Number(seg[i]);
    return Number.isFinite(d) && d > 0 ? d : DUR_POR_DEFECTO;
  });
}
