// =============================================================================
// graficos-acomodo — el acomodo de una hoja según el ancho, sin tocar lo guardado (1/11/2026)
// =============================================================================
// Martín: «le pusiste responsive como lo tienen los templates que copiamos? Porque veo que todos estan igual». No lo tenía: la grilla
// dibujaba las 12 columnas guardadas hasta 640, y entre 640 y 1320 todo salía igual pero más angosto. Las referencias cambian de
// acomodo: Corbel a 1320 y a 1100 (docs/diseno/tokens-corbel.json, `composicion_de_pagina`).
//
// Se calcula AL DIBUJAR y nunca se guarda: mirando, la grilla no escribe (`alMoverGrilla`, app/dashboard/EditorInforme.tsx), y editando
// se ve el acomodo de verdad, que es el que se edita. Por debajo de 640 sigue la pila del teléfono.
//
// ⚠️ LOS CORTES SON DEL ANCHO DE LA GRILLA, no de la ventana: Corbel tiene una barra de 240 y nosotros una de 68. Los valores salen de
//    restarle su barra y sus márgenes a sus 1320 y 1100.
// =============================================================================

/** Por debajo, los paneles van de a dos. Corbel a 1320: 1320 - 240 de barra y márgenes. */
export const GRILLA_MEDIANA = 1080;
/** Por debajo, una columna y los números de a dos. Corbel a 1100. */
export const GRILLA_ANGOSTA = 860;

type Caja = { i: string; x: number; y: number; w: number; h: number };

/**
 * El mismo orden, con otras columnas: cada pieza con el ancho que le toca, fila por fila. La fila que queda con hueco se estira, y todas
 * las de una fila miden lo mismo: un hueco a lo ancho o abajo de una tarjeta se lee como un error. Ancho de sobra, tal cual.
 */
export function acomodoPorAncho<T extends Caja>(layout: readonly T[], ancho: number, esNumero: (id: string) => boolean): readonly T[] {
  if (!(ancho > 0) || ancho >= GRILLA_MEDIANA) return layout;
  const angosta = ancho < GRILLA_ANGOSTA;
  const columnas = (c: T) => {
    if (esNumero(c.i)) return angosta ? 6 : Math.max(3, Math.min(c.w, 6));
    if (angosta || c.w >= 6) return 12;
    return 6;
  };
  const orden = [...layout].sort((a, b) => a.y - b.y || a.x - b.x);
  const filas: T[][] = [];
  let fila: T[] = [];
  let usadas = 0;
  for (const c of orden) {
    const w = columnas(c);
    if (usadas + w > 12) { filas.push(fila); fila = []; usadas = 0; }
    fila.push({ ...c, w });
    usadas += w;
  }
  if (fila.length) filas.push(fila);
  const out: T[] = [];
  let y = 0;
  for (const f of filas) {
    const h = Math.max(...f.map((c) => c.h));
    const total = f.reduce((s, c) => s + c.w, 0);
    let x = 0;
    f.forEach((c, i) => {
      // Lo que sobra de la fila se lo lleva el último.
      const w = i === f.length - 1 ? c.w + 12 - total : c.w;
      out.push({ ...c, x, y, w, h });
      x += w;
    });
    y += h;
  }
  return out;
}
