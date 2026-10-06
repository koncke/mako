// =============================================================================
// orden-manual — dónde cae una tarjeta y cómo queda la columna (puro)
// =============================================================================
// Pedido de Martín (06/10/2026): «si a un cliente lo arrastro abajo de otro, no se ve esa
// animación» — y al preguntarle si esa posición se guarda: «Se guarda + "Manual"».
//
// ⚠️ HASTA ESE DÍA EL HUECO NO SEGUÍA AL CURSOR, A PROPÓSITO: la columna no tenía orden
// propio (se dibujaba en el de «Ordenar»), así que dibujar «acá» y dejarla «allá» era
// mentir (`dondeCae`, que se fue con esta tanda). Ahora la columna SÍ tiene orden —la lista
// que se guarda en `cliente_entrega_orden`, mig 0196— y el hueco puede seguir al cursor
// porque soltar ahí es donde la tarjeta queda.
//
// ⚠️ El CRM dibuja el mismo hueco y NO guarda la posición (soltar en la misma columna no hace
// nada, `handleDrop` en app/crm/CrmBoard.tsx). Acá se eligió guardarla.
//
// Sin 'use client' ni 'server-only': lo usan el kanban y la pantalla, y un test lo EJECUTA
// (tests/cs-orden-manual.test.ts).

/**
 * El índice de la columna donde cae, según la altura del cursor contra los puntos medios de
 * sus tarjetas, MEDIDOS UNA VEZ al agarrar. Es la cuenta del CRM y del Plan: con el hueco
 * abierto las tarjetas de abajo se corren, y medir en cada `dragover` haría que el índice
 * oscile entre dos valores.
 */
export function indiceEnColumna(medios: readonly number[], y: number): number {
  for (let i = 0; i < medios.length; i++) if (y < medios[i]) return i;
  return medios.length;
}

/**
 * Antes de QUIÉN se inserta lo que viaja, dado el índice del hueco entre las tarjetas que se
 * dibujan (incluidas las que viajan, que siguen en su lugar mientras dura el gesto). `null` =
 * al final.
 *
 * ⚠️ SE GUARDA UN VECINO Y NO UN NÚMERO: la columna que se dibuja puede ser una parte de la
 * columna entera (un buscador, un filtro), así que «el tercero» de lo que se ve no es el
 * tercero de la lista guardada. «Antes de Juan» sí es lo mismo en las dos.
 */
export function antesDeQuien(dibujadas: readonly number[], idx: number, viajan: readonly number[]): number | null {
  const mueven = new Set(viajan);
  for (let i = Math.max(0, idx); i < dibujadas.length; i++) if (!mueven.has(dibujadas[i])) return dibujadas[i];
  return null;
}

/**
 * La columna ENTERA después de soltar: sin los que viajan, y ellos insertados antes de
 * `antesDe` (o al final), en el orden en que viajaban.
 */
export function columnaConInsercion(columna: readonly number[], viajan: readonly number[], antesDe: number | null): number[] {
  const mueven = new Set(viajan);
  const resto = columna.filter((id) => !mueven.has(id));
  const i = antesDe == null ? -1 : resto.indexOf(antesDe);
  return i < 0 ? [...resto, ...viajan] : [...resto.slice(0, i), ...viajan, ...resto.slice(i)];
}

/**
 * Ordena por la lista manual DE LA COLUMNA de cada uno. Los que la lista no nombra van
 * después, en el orden en que llegaron (el de «Ordenar»): el sort es estable.
 *
 * ⚠️ LA LISTA PUEDE NOMBRAR A QUIEN YA NO ESTÁ EN ESA COLUMNA (se movió, se quitó del
 * producto): no se poda al guardar, se ignora acá. Por eso la clave es la posición en la
 * lista de SU etapa actual, nunca una posición global.
 */
export function ordenarManual<T>(
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
    .map((c, i) => ({ c, i, k: posEn(etapaDe(c)).get(idDe(c)) ?? Number.MAX_SAFE_INTEGER }))
    .sort((a, b) => a.k - b.k || a.i - b.i)
    .map((x) => x.c);
}

/** ¿Dos listas iguales? Soltar donde ya estaba no es un cambio, y no se guarda ni se anuncia. */
export const mismaLista = (a: readonly number[], b: readonly number[]): boolean =>
  a.length === b.length && a.every((x, i) => x === b[i]);
