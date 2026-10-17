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
 * LAS FUENTES QUE SE PRESTAN, EN POSITIVO: sólo lo que sembró MaKo como MÉTODO (`mako`).
 *
 * ⚠️ HASTA EL 17/10/2026 TAMBIÉN `manual`, y era la fuga que quedaba: «lo cargado a mano» en el ws1
 * no era sólo método. Medido ese día en producción: de las 13 entradas `manual` del ws1, 6 eran del
 * NEGOCIO de Mauricio —«Dolores del avatar (Carlos)», su CPM en México, el play de SU VSL— y se
 * prestaban al RAG de todos los clientes. Lo que alguien carga a mano es de su negocio; el método de
 * la plataforma lo marca la plataforma (`mako`). Las 7 de «Levanta Muertos», que sí eran método de la
 * agencia, se re-marcaron `mako` ese día (scripts/metodo-a-mako.mjs, en seco y después aplicado).
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
export const FUENTES_PRESTABLES: readonly string[] = ['mako'];

const PRESTABLES = new Set(FUENTES_PRESTABLES);

/** ¿Esta entrada del DUEÑO se le puede prestar a otro workspace? */
export const sePresta = (fuente: unknown): boolean => PRESTABLES.has(String(fuente));

/**
 * Saca del resultado lo AJENO que no es método. Lo propio nunca se filtra: un negocio ve su
 * glosario entero y lo que cargó a mano. De los demás workspaces que presta `wsParaRag` (el ws1,
 * donde vive hoy el método sembrado, y la PLATAFORMA) sólo entra lo que `sePresta`.
 *
 * ⚠️ Hasta el 17/10/2026 se llamaba `sinLoAjenoDelDueno` y con `wsPropio === wsDueno` devolvía la
 * lista intacta. Con la plataforma sumada al préstamo eso le daba a Mauricio el ws9 ENTERO, que es
 * también el negocio real de Martín: el filtro va SIEMPRE.
 */
export function sinLoAjeno<T extends { workspace_id?: unknown; fuente?: unknown }>(filas: T[], wsPropio: number): T[] {
  return filas.filter((r) => Number(r.workspace_id) === wsPropio || sePresta(r.fuente));
}
