// =============================================================================
// La grilla de tarjetas de distinto alto (12/11/2026): las reglas puras de ./../app/_crear/GrillaMixta.tsx
// =============================================================================
// Con la forma de su plataforma (Martín: «Si es en YouTube, que sea más horizontal, si es en Reels, que sea más vertical, si es
// en Carrusel, que sea más cuadrado»), los outliers de Copywriting tienen altos muy distintos: un reel (9:16) mide 3,2 veces lo
// que un video de YouTube (16:9) del mismo ancho. En una grilla de filas, cada reel dejaba un hueco al lado de los de YouTube.
// Van en COLUMNAS: cada tarjeta, en orden, a la columna más baja. El orden de la lista (el mayor outlier primero) se lee de
// izquierda a derecha y de arriba abajo, y sumar una tanda abajo («Ver más») no mueve las que ya estaban.
// =============================================================================

/** Cuántas columnas entran en `ancho` con un mínimo por columna y el hueco entre ellas. Sin ancho medido, `porDefecto`. */
export function columnasPara(ancho: number, minimo: number, hueco: number, porDefecto = 4): number {
  if (!(ancho > 0)) return porDefecto;
  return Math.max(1, Math.floor((ancho + hueco) / (minimo + hueco)));
}

/** Reparte en `n` columnas: cada una, en orden, a la más baja hasta ahí (la primera si empatan). `alto` en cualquier unidad. */
export function repartirEnColumnas<T>(items: readonly T[], n: number, alto: (x: T) => number): T[][] {
  const k = Math.max(1, Math.floor(n));
  const cols: T[][] = Array.from({ length: k }, () => []);
  const altos = new Array<number>(k).fill(0);
  for (const x of items) {
    let j = 0;
    for (let i = 1; i < k; i++) if (altos[i] < altos[j] - 0.5) j = i;
    cols[j].push(x);
    altos[j] += Math.max(0, alto(x));
  }
  return cols;
}
