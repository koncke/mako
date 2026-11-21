// =============================================================================
// EL HUECO DE LA ENTRADA: LA FOTO Y EL GLOBO DE QUIEN ESCRIBE, CON SU AIRE (21/11/2026, Martín: «la marca sobre los puntitos está corrida»)
// =============================================================================
// La entrada de cada día del reto y de cada coach (./EntradaEscribiendo.tsx) oscurece todo menos la fila de quien escribe. El hueco se
// armaba con la foto y los PUNTITOS: el globo blanco que los tiene (con su padding) quedaba medio afuera, el hueco se veía corrido y la
// foto encima. Ahora, la foto y el GLOBO. Puro: tests/marcas-centradas-y-sin-siguiente.test.ts.
// =============================================================================

export const AIRE_ENTRADA = 6;
type Rect = { left: number; top: number; right: number; bottom: number };

/** La caja que contiene todos los rectángulos, con `aire` de cada lado. */
export function cajaDeLaFila(rs: readonly Rect[], aire = AIRE_ENTRADA): { x: number; y: number; ancho: number; alto: number } {
  const x0 = Math.min(...rs.map((r) => r.left)), y0 = Math.min(...rs.map((r) => r.top));
  const x1 = Math.max(...rs.map((r) => r.right)), y1 = Math.max(...rs.map((r) => r.bottom));
  return { x: x0 - aire, y: y0 - aire, ancho: x1 - x0 + aire * 2, alto: y1 - y0 + aire * 2 };
}
