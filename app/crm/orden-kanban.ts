// =============================================================================
// orden-kanban — cómo se ordenan las tarjetas de cada columna del CRM (puro)
// =============================================================================
// Pedido de Martín (06/10/2026), por el chat de Customer Success: el hueco del arrastre
// seguía al cursor también en la MISMA columna, y soltar ahí no movía nada.
//   «cuando se hace esto, es como poner un "ORDENAMIENTO" dentro de filtros... normalmente
//   se ordena por orden de llegada. Para quitar eso y volver a antes, simplemente es volver
//   a ordenar por fecha y listo. Y luego si quiero volver a la posición que había dejado las
//   tarjetas es simplemente quitar filtros.»
//
// O sea: arrastrar guarda la posición (mig 0200) y deja «Ordenar» en «Manual»; «Fecha de
// llegada» vuelve al orden de siempre SIN borrar lo manual; y con un orden manual guardado,
// «Manual» es la BASE — «Limpiar filtros» vuelve a él.
//
// Dónde cae una tarjeta y cómo queda la columna después (`antesDeQuien`,
// `columnaConInsercion`, `mismaLista`) son la MISMA pieza que Customer Success
// (app/customer-success/orden-manual.ts): se importan de ahí, no se copian.
//
// Sin 'use client' ni 'server-only': lo usan el tablero y la barra, y un test lo EJECUTA
// (tests/crm-orden-manual.test.ts).

export type OrdenKanban = 'manual' | 'llegada';

/** Los rótulos de «Ordenar». El orden de llegada es el de siempre: el más nuevo arriba. */
export const ORDEN_KANBAN: Record<OrdenKanban, string> = { manual: 'Manual', llegada: 'Fecha de llegada' };

/**
 * Ordena cada columna por SU lista manual. La entrada viene en orden de llegada y el sort es
 * estable.
 *
 * ⚠️ LOS QUE LA LISTA NO NOMBRA VAN ARRIBA, no al final como en Customer Success. La lista se
 * guarda con la columna ENTERA al arrastrar, así que los únicos que no figuran son los que
 * llegaron DESPUÉS del último arrastre — y al CRM llegan leads nuevos todos los días. Al
 * final, un lead recién entrado a una columna que alguien ordenó una vez quedaría debajo de
 * todo, donde nadie lo ve; arriba es donde el orden de llegada ya los pone.
 *
 * ⚠️ Y LA LISTA PUEDE NOMBRAR A QUIEN YA NO ESTÁ EN ESA COLUMNA (se movió, se borró): se
 * ignora. Por eso la clave es la posición en la lista de SU etapa actual.
 */
export function ordenarKanbanManual<T>(
  cs: readonly T[],
  idDe: (c: T) => number,
  etapaDe: (c: T) => string,
  listaDe: (etapa: string) => readonly number[] | undefined,
): T[] {
  const pos = new Map<string, Map<number, number>>();
  const posEn = (etapa: string) => {
    let m = pos.get(etapa);
    if (!m) { m = new Map((listaDe(etapa) ?? []).map((id, i) => [id, i])); pos.set(etapa, m); }
    return m;
  };
  return cs
    .map((c, i) => ({ c, i, k: posEn(etapaDe(c)).get(idDe(c)) ?? -1 }))
    .sort((a, b) => a.k - b.k || a.i - b.i)
    .map((x) => x.c);
}
