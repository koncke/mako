// =============================================================================
// cerebro-para-chat — el ÚNICO grafo que lee un chat de MaKo (28/10/2026)
// =============================================================================
// Martín (28/10/2026): «Supongo que todos los chats ya extraen data del second brain, si no lo hacen está mal... y que sea
// eficiente justamente, por eso tenemos tipo grafo, sin gastar tantos tokens». El relevamiento (C:/dev/revisiones/
// 2810-second-brain-relevamiento.md) encontró que lo que los prompts llaman «Second Brain» era el RAG de `mako_knowledge`,
// que las herramientas del grafo rearmaban el mapa entero CON su física en cada pedido, y que la capa de las funciones de
// MaKo sólo se dibujaba.
//
// LA REGLA: un chat que necesita el Second Brain lo pide acá, y de lo que devuelve saca sólo lo que le sirve con
// lib/cerebro-recuperar.ts (el índice y la vista local). Nunca `construirCerebro()` a secas:
//   · el negocio SIN física (los chats no usan posiciones);
//   · en el workspace de la plataforma, más «Lo que hace MaKo» (lib/cerebro-funciones.ts), colgado de la raíz;
//   · la capa Construcción NO entra: es la obra, no lo que se vende;
//   · en caché por workspace unos minutos: un turno lo pide varias veces y el grafo son 21 lecturas.
// =============================================================================

import 'server-only';
import { construirCerebro } from './cerebro-grafo';
import { CAPA_FUNCIONES, funcionesDeMako, ID_RAIZ_FUNCIONES, PUENTE_FUNCIONES } from './cerebro-funciones';
import { conCapa } from './cerebro-union';
import type { Cerebro } from './cerebro-modelo';
import { getWorkspaceActual, wsSuperAdmin } from './workspace';

const CACHE_MS = 3 * 60_000;
const cache = new Map<number, { hasta: number; grafo: Promise<Cerebro<string>> }>();

/** El grafo del negocio de este pedido para un chat; con las funciones de MaKo si es la plataforma. Nunca tira. */
export async function grafoParaChat(): Promise<Cerebro<string>> {
  const ws = await getWorkspaceActual().catch(() => null);
  const ahora = Date.now();
  const ya = ws == null ? undefined : cache.get(ws);
  if (ya && ya.hasta > ahora) return ya.grafo;
  const grafo = armar(ws);
  if (ws != null) {
    cache.set(ws, { hasta: ahora + CACHE_MS, grafo });
    // Un grafo que falló no queda en la caché: el pedido siguiente lo vuelve a intentar.
    grafo.catch(() => cache.delete(ws));
  }
  return grafo;
}

async function armar(ws: number | null): Promise<Cerebro<string>> {
  const [negocio, plataforma] = await Promise.all([
    construirCerebro({ sinLayout: true }) as Promise<Cerebro<string>>,
    ws == null ? false : wsSuperAdmin().then((s) => s === ws, () => false),
  ]);
  return plataforma ? conCapa(negocio, funcionesDeMako(), { id: CAPA_FUNCIONES, nombre: 'Lo que hace MaKo', raiz: ID_RAIZ_FUNCIONES, motivo: PUENTE_FUNCIONES }) : negocio;
}
