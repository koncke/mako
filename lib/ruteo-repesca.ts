// =============================================================================
// La repesca del ruteo: qué tarea quedó sin destino, y cómo volver del sub-lote
// =============================================================================
// Cuando el Perro rechaza un proyecto nuevo, las tareas que lo pedían se quedan sin
// ningún destino: el `asign` que las acompañaba nombraba justo el proyecto rechazado,
// así que tampoco resuelve. Ese hueco es el que costó cinco proyectos inventados entre
// el 11 y el 12/8/2026 — el detalle completo está en `plan-board.ts`, en la compuerta.
//
// La respuesta es una segunda pasada SOLO con las huérfanas y con `nuevos` prohibido.
// Y ahí aparece la trampa que justifica este archivo: la segunda pasada ve un sub-lote,
// así que devuelve índices 0..n-1 que NO son los del lote original. Sumar mal ese
// mapeo no rompe nada visible — asigna la tarea equivocada al proyecto equivocado, en
// silencio, y con toda la pinta de haber funcionado.
//
// Sin `server-only` a propósito, para que se pueda testear solo. Mismo criterio que
// `lib/respuesta-doer.ts` y `lib/link-borrador.ts`: `mako-guardian` no se puede
// importar desde un test, y esta aritmética es justo la que hay que cubrir.
// =============================================================================

/**
 * Los índices del lote que NO recibieron ningún destino en una pasada de ruteo.
 *
 * Cuentan las dos formas de tener destino, y las dos hacen falta: `asign` es la
 * asignación directa, y `nuevos[].tareas` es la que llega cuando el modelo propone un
 * proyecto y se olvida de repetir el nombre en `asign`. Mirando solo `asign`, las
 * tareas de un proyecto nuevo APROBADO se leerían como huérfanas y se rutearían dos
 * veces, la segunda a un lugar de la lista — vaciando el proyecto que se acababa de
 * aprobar.
 */
export function huerfanasDeRuteo(
  total: number,
  out: { asign: Array<{ i: number }>; nuevos?: Array<{ tareas: number[] }> },
): number[] {
  const con = new Set<number>();
  for (const a of out.asign) con.add(a.i);
  for (const n of out.nuevos ?? []) for (const i of n.tareas) con.add(i);
  const fuera: number[] = [];
  for (let i = 0; i < total; i++) if (!con.has(i)) fuera.push(i);
  return fuera;
}

/**
 * Devuelve al índice ORIGINAL las asignaciones que vinieron del sub-lote de la repesca.
 *
 * `huerfanas` es el mapa: la posición k del sub-lote es la tarea `huerfanas[k]` del lote
 * entero. Lo que caiga fuera de rango se descarta — un índice inventado por el modelo
 * apuntaría a una tarea que nadie pidió rutear, y una asignación de más es peor que
 * una de menos.
 */
export function remapearRepesca<T extends { i: number }>(asign: T[], huerfanas: number[]): T[] {
  return asign
    .filter((a) => Number.isInteger(a.i) && a.i >= 0 && a.i < huerfanas.length)
    .map((a) => ({ ...a, i: huerfanas[a.i] }));
}
