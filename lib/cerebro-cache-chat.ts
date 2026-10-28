// =============================================================================
// cerebro-cache-chat — la caché del grafo de los chats (lib/cerebro-para-chat.ts), aparte y sin dependencias (28/10/2026)
// =============================================================================
// El grafo de un chat son 21 lecturas: se guarda unos minutos por negocio. Pero lo que la persona acaba de cambiar tiene
// que verse en el turno siguiente (la verificación de 0c80dd3ce: después de guardar la oferta, el chat seguía contestando
// con la vieja hasta 3 minutos). Por eso cada acción EJECUTADA la borra (`invalidarGrafoChat`, en lib/api-mako/acciones.ts
// y flujo.ts), y vive en este módulo chico: las acciones no pueden importar el armado del grafo, que importa medio repo y
// cerraría un ciclo (acciones → grafo → leads → nutrición → flujo → acciones).
//
// Por proceso: en Vercel cada instancia tiene la suya. Lo que cambia una pantalla (no una acción de MaKo) se ve al vencer.
// =============================================================================

export const CACHE_GRAFO_MS = 3 * 60_000;

const cache = new Map<number, { hasta: number; grafo: Promise<unknown> }>();

/** El grafo guardado de este negocio, si no venció. */
export function grafoGuardado<T>(ws: number, ahora = Date.now()): Promise<T> | undefined {
  const ya = cache.get(ws);
  return ya && ya.hasta > ahora ? (ya.grafo as Promise<T>) : undefined;
}

/**
 * Guarda el grafo de este negocio mientras se arma (los pedidos que llegan en el medio comparten el armado). Si el armado
 * tira, o sale INCOMPLETO (una lectura se cayó y el grafo se degradó a vacío en esa parte), no queda: el pedido siguiente
 * lo vuelve a leer.
 */
export function guardarGrafo<T>(ws: number, armado: Promise<{ grafo: T; completo: boolean }>, ahora = Date.now()): Promise<T> {
  const grafo = armado.then((a) => a.grafo);
  const entrada = { hasta: ahora + CACHE_GRAFO_MS, grafo: grafo as Promise<unknown> };
  cache.set(ws, entrada);
  const sacar = () => { if (cache.get(ws) === entrada) cache.delete(ws); };
  armado.then((a) => { if (!a.completo) sacar(); }, sacar);
  return grafo;
}

/** Lo que este negocio acaba de cambiar se lee en el turno siguiente: lo llaman las acciones al ejecutarse. */
export function invalidarGrafoChat(ws: number | null | undefined): void {
  if (ws != null) cache.delete(ws);
}
