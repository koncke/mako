// =============================================================================
// rag-prestamo — qué le presta el workspace del DUEÑO al RAG de los demás
// =============================================================================
// `wsParaRag()` (lib/mako-knowledge.ts) deja que cada cliente lea su conocimiento MÁS el
// del `OWNER_WS`, con la idea de compartir el método curado de la agencia. El problema es
// que **`OWNER_WS` es Mauricio, un cliente** (AGENTS.md → «`OWNER_WS` NO es la
// plataforma»), así que lo que se presta no es «el método»: es su workspace entero.
//
// MEDIDO EL 04/10/2026 CONTRA PRODUCCIÓN, antes de escribir una línea: de las 54 entradas
// servibles del ws1, **42 entraban al RAG general de los otros workspaces** y 22 de ésas
// son un glosario de NOMBRES PROPIOS sacado de sus reuniones — «Patricia Muñoz»,
// «Francisco Hernandez», «Rogelio», «Zulema», «Anel», «Rocío»…
//
// Y no era teórico: Leila abrió el editor de una secuencia el 01/10 (00:29:00), leyó un
// nombre que no conocía y preguntó **«¿quién es este?»**. Martín contestó: «esos son
// ejemplos… **está tomando ejemplos de Mauricio siempre**».
//
// ⚠️ SIN `server-only` A PROPÓSITO. Es la regla del Reset: la condición de un guard vive
// donde un test la pueda importar. Adentro del módulo que hace el trabajo sucio termina
// siendo lo único sin red, justo donde más duele.
// =============================================================================

/**
 * LAS FUENTES QUE SE PRESTAN, EN POSITIVO: sólo lo que alguien cargó como MÉTODO — a mano
 * (`manual`) o lo que sembró MaKo (`mako`).
 *
 * ⚠️ VA POR `fuente` Y NO POR ÁREA, y la diferencia es la que hace que esto no envejezca.
 * Sacar `glosario` del préstamo cerraría el caso medido y dejaría abierto el próximo:
 * cualquier área nueva que una reunión escriba en el ws1 se prestaría sola, sin que nadie
 * se entere. La pregunta que decide no es «¿de qué habla esta entrada?» sino **«¿la curó
 * alguien para que la use todo el mundo, o se la encontró un transcript?»**.
 *
 * Y va en positivo por la regla de siempre: con «todas menos reunión», la fuente que se
 * invente mañana entra sin que nadie lo decida.
 */
export const FUENTES_PRESTABLES: readonly string[] = ['manual', 'mako'];

const PRESTABLES = new Set(FUENTES_PRESTABLES);

/** ¿Esta entrada del DUEÑO se le puede prestar a otro workspace? */
export const sePresta = (fuente: unknown): boolean => PRESTABLES.has(String(fuente));

/**
 * Saca del resultado lo que es del dueño y NO es método. Lo propio nunca se filtra: un
 * cliente ve su glosario entero, y el dueño ve el suyo.
 *
 * `wsPropio === wsDueno` devuelve la lista intacta — ahí no hay préstamo que filtrar, y
 * filtrarlo le escondería a Mauricio su propio material.
 */
export function sinLoAjenoDelDueno<T extends { workspace_id?: unknown; fuente?: unknown }>(
  filas: T[],
  wsPropio: number,
  wsDueno: number,
): T[] {
  if (wsPropio === wsDueno) return filas;
  return filas.filter((r) => Number(r.workspace_id) === wsPropio || sePresta(r.fuente));
}
