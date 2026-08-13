// =============================================================================
// cron-ronda — quién entra en UNA corrida de un cron multi-workspace, y en qué orden
// =============================================================================
// Vive SIN `server-only` a propósito: acá está la condición que decide si un cliente
// recibe el servicio o no. Si viviera adentro del módulo que hace el trabajo sucio,
// ningún test la podría importar y sería lo único sin red justo donde más duele —
// el mismo criterio que `exigirClienteDePrueba` y `lib/model-catalogo.ts`.
//
// EL BUG QUE ESTO VIENE A CERRAR: el cron recorría los workspaces en orden fijo, cada
// uno reservándose 150 s de los 300 del maxDuration. Entraban DOS y siempre los mismos
// dos; del tercero en adelante nadie recibía análisis. Y como la respuesta listaba solo
// a los que corrieron, un cliente sin servicio era indistinguible de uno que no existe.
// =============================================================================

/**
 * ¿Le alcanza a este workspace para hacer algo ÚTIL con lo que queda de la corrida?
 *
 * Escrito en POSITIVO (AGENTS.md): «entra si entra ENTERO el trabajo mínimo», no
 * «no entra si falta poco». `minimoMs` lo pone cada cron: para closing-sync es el
 * barrido de Fathom más UNA llamada a Opus. Con menos que eso se paga el barrido
 * para no analizar nada — o peor, se arranca una llamada que la plataforma mata a
 * mitad, después de que el modelo ya cobró.
 */
export function entraEnLaRonda(ahoraMs: number, deadlineMs: number, minimoMs: number): boolean {
  return ahoraMs + minimoMs <= deadlineMs;
}

/**
 * La ronda arranca en el workspace SIGUIENTE al último servido, y da la vuelta.
 *
 * Por ID y no por índice: la lista cambia de largo cuando entra o se pausa un
 * cliente, y un índice guardado terminaría apuntando a otro. Un cursor que ya no
 * existe (el cliente se pausó) tampoco rompe: el orden sale igual del «mayor que».
 */
export function ordenRotado(ids: number[], ultimoServido: number | null): number[] {
  if (ultimoServido == null) return [...ids];
  return [...ids.filter((id) => id > ultimoServido), ...ids.filter((id) => id <= ultimoServido)];
}
