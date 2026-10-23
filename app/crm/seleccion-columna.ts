// =============================================================================
// La casilla del encabezado de una columna del Kanban: tildar a todos los de esa columna
// =============================================================================
// Martín (22/10/2026): «En la selección multiple, me falta el checkbox en la columna, para poder seleccionar a todos los
// de esa columna». Tilda lo que SE VE de la columna: con un filtro puesto, sólo lo que el filtro dejó, la misma regla que
// la casilla de «todas» de la Lista (CrmBoard.tsx: «seleccionar en silencio 1.100 leads que no están en pantalla y
// después ofrecer "Eliminar" es el botón que nadie puede auditar»). El rótulo dice cuántos son.
// Puro: lo prueba tests/crm-feedback-22-10.test.ts sin dibujar nada.

export type EstadoColumna = {
  /** cuántos se ven en la columna */
  n: number;
  /** cuántos de ésos están tildados */
  marcados: number;
  /** todos los que se ven están tildados (y hay alguno) */
  todos: boolean;
  /** algunos sí y otros no: la casilla va a medias */
  parcial: boolean;
};

export function estadoDeColumna(ids: readonly number[], sel: ReadonlySet<number>): EstadoColumna {
  const marcados = ids.filter((id) => sel.has(id)).length;
  return { n: ids.length, marcados, todos: ids.length > 0 && marcados === ids.length, parcial: marcados > 0 && marcados < ids.length };
}

/** Con todos tildados, la casilla los QUITA (sólo los de esta columna); si no, los SUMA a lo que ya estaba tildado. */
export function alternarColumna(sel: ReadonlySet<number>, ids: readonly number[]): Set<number> {
  const q = new Set(sel);
  if (estadoDeColumna(ids, sel).todos) for (const id of ids) q.delete(id);
  else for (const id of ids) q.add(id);
  return q;
}

/** «Seleccionar los 8 de «Círculo ROJO»» · con filtro, «… los 3 que se ven …» · todos tildados, «Quitar los 8 …». */
export function rotuloDeColumna(e: EstadoColumna, etapa: string, filtrado: boolean): string {
  const quienes = e.n === 1 ? 'el lead' : `los ${e.n}`;
  const seVen = filtrado ? (e.n === 1 ? ' que se ve' : ' que se ven') : '';
  return `${e.todos ? 'Quitar' : 'Seleccionar'} ${quienes}${seVen} de «${etapa}»`;
}
