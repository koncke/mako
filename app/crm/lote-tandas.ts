// =============================================================================
// Un lote que se escribe LEAD POR LEAD, de a tandas (24/10/2026)
// =============================================================================
// Martín trajo 221 de un grupo, los tildó con la casilla de la columna y los movió a «Lead entrante»: se movieron 121. MEDIDO
// en su historial: la primera vez, 121 en 67 s y se cortó; la segunda, los 100 que quedaban en 50 s (~0,5 s por lead).
// `moverLeadsDeEtapaAction` mueve de a uno y en serie (es el único camino que escribe la etapa con su historial y lo que la
// etapa dispara: ver su cabecera), y la pantalla le mandaba los 221 en UNA acción del server, que tiene 60 s. Vercel la mató a
// mitad: lo movido quedó movido, el resto no, y la pantalla dijo un error genérico. Él creyó que se le había partido la base.
// El diagnóstico obvio («la casilla tilda sólo lo dibujado») era el equivocado: tildaba los 221.
//
// LA REGLA: un lote que se escribe de a uno va de a TANDAS chicas desde la pantalla, en serie, con su avance; el server corta
// por tiempo y devuelve lo que no llegó (`pendientes`), que vuelve a la cola; y si algo se corta, se dice cuántos sí y cuántos
// no. Nunca un corte callado. Puro: lo prueba tests/crm-lote-tandas.test.ts sin server.

/** De a cuántos manda la pantalla un lote que se escribe lead por lead: ~0,5 s por lead (medido), lejos de los 60 s. */
export const TANDA_LOTE = 25;
/** Cuánto se da el server por llamada antes de devolver lo que falta: deja aire para lo que corre al final (las etiquetas). */
export const PRESUPUESTO_LOTE_MS = 40_000;

export type ResultadoTandas<T> = {
  /** Lo que devolvió cada tanda, en orden. */
  resultados: T[];
  /** Los que no se llegaron a procesar: siguen como estaban. */
  quedan: number[];
  /** Los de una tanda que se cortó sin contestar: pudieron quedar a medias (la pantalla relee al terminar). */
  inciertos: number[];
  /** Por qué se cortó, o null si terminó. */
  error: string | null;
};

/**
 * Corre `llamar` sobre `ids` de a `tanda`, en serie. Lo que una tanda devuelve en `pendientes` vuelve a la cola, ADELANTE. Si
 * una tanda tira, se para: sus ids son `inciertos` y el resto `quedan`. Si una tanda no avanza nada (todo pendiente), también
 * se para: repetir no lo arregla. `alAvanzar(cuantos)`: cuántos van a quedar procesados al terminar la tanda que arranca.
 */
export async function correrEnTandas<T extends { pendientes?: number[] }>(
  ids: readonly number[], tanda: number, llamar: (lote: number[]) => Promise<T>, alAvanzar?: (cuantos: number) => void,
): Promise<ResultadoTandas<T>> {
  const cola = [...ids];
  const resultados: T[] = [];
  let hechos = 0;
  while (cola.length) {
    const lote = cola.splice(0, Math.max(1, tanda));
    alAvanzar?.(Math.min(hechos + lote.length, ids.length));
    let r: T;
    try {
      r = await llamar(lote);
    } catch (e) {
      return { resultados, quedan: cola, inciertos: lote, error: e instanceof Error ? e.message : String(e) };
    }
    resultados.push(r);
    const pendientes = (r.pendientes ?? []).filter((id) => lote.includes(id));
    const procesados = lote.length - pendientes.length;
    if (procesados <= 0) return { resultados, quedan: [...pendientes, ...cola], inciertos: [], error: 'El servidor no llegó a procesar ninguno.' };
    hechos += procesados;
    cola.unshift(...pendientes);
  }
  return { resultados, quedan: [], inciertos: [], error: null };
}

/**
 * El final del aviso cuando el lote no terminó: cuántos no se tocaron y cuántos quedaron en duda. Vacío si terminó.
 * `verbo`: [singular, plural] («movió», «movieron»).
 */
export function colaDelAviso(r: Pick<ResultadoTandas<unknown>, 'quedan' | 'inciertos' | 'error'>, verbo: readonly [string, string]): string {
  if (!r.error) return '';
  const partes = [
    r.quedan.length ? `${r.quedan.length} no se ${verbo[r.quedan.length === 1 ? 0 : 1]} (siguen como estaban)` : '',
    r.inciertos.length ? `${r.inciertos.length} quedaron sin confirmar: revísalos` : '',
  ].filter(Boolean);
  return partes.length ? ` · se cortó: ${partes.join(' · ')}` : ` · se cortó (${r.error})`;
}
