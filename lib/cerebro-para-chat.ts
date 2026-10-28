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
//   · en caché por workspace unos minutos (lib/cerebro-cache-chat.ts): un turno lo pide varias veces y el grafo son 21
//     lecturas. Una acción ejecutada la borra, y un grafo con una lectura caída no se guarda.
// =============================================================================

import 'server-only';
import { construirCerebro } from './cerebro-grafo';
import {
  CAPA_FUNCIONES, catalogoCorto, funcionEntera, funcionesDeMako, funcionQueVende, ID_RAIZ_FUNCIONES, PUENTE_FUNCIONES,
} from './cerebro-funciones';
import { conCapa } from './cerebro-union';
import { grafoGuardado, guardarGrafo } from './cerebro-cache-chat';
import type { Cerebro } from './cerebro-modelo';
import { getWorkspaceActual, wsSuperAdmin } from './workspace';

/** El grafo del negocio de este pedido para un chat; con las funciones de MaKo si es la plataforma. Tira si una lectura
 *  principal tira (quien llama lo envuelve: lib/api-mako/ejecutar.ts). */
export async function grafoParaChat(): Promise<Cerebro<string>> {
  const ws = await getWorkspaceActual().catch(() => null);
  if (ws == null) return (await armar(null)).grafo;
  return grafoGuardado<Cerebro<string>>(ws) ?? guardarGrafo(ws, armar(ws));
}

/**
 * Para el Web Generator (lib/landing-writer.ts → `buildLandingBrief`): en la plataforma, todas las funciones en una línea y
 * la que vende esta landing ENTERA (por id, con profundidad 0: «Hace» y «No hace» incluidos), sacadas de la capa sin armar el
 * negocio. En un cliente, null: sus landings venden SU negocio. Nunca tira.
 */
export async function funcionesParaLanding(p: { pedido: string; pagina?: string }): Promise<{ catalogo: string; funcion: string } | null> {
  try {
    const ws = await getWorkspaceActual();
    if (ws == null || ws !== (await wsSuperAdmin())) return null;
    const f = funcionQueVende(p);
    return { catalogo: catalogoCorto(), funcion: f ? funcionEntera(funcionesDeMako(), f) : '' };
  } catch {
    return null;
  }
}

async function armar(ws: number | null): Promise<{ grafo: Cerebro<string>; completo: boolean }> {
  // Las lecturas que se caen se degradan a vacío (el grafo no se cae), pero AVISAN: un grafo así no se guarda.
  const cayeron: string[] = [];
  const [negocio, plataforma] = await Promise.all([
    construirCerebro({ sinLayout: true, alFallar: (fuente) => cayeron.push(fuente) }) as Promise<Cerebro<string>>,
    ws == null ? false : wsSuperAdmin().then((s) => s === ws, () => false),
  ]);
  const grafo = plataforma ? conCapa(negocio, funcionesDeMako(), { id: CAPA_FUNCIONES, nombre: 'Lo que hace MaKo', raiz: ID_RAIZ_FUNCIONES, motivo: PUENTE_FUNCIONES }) : negocio;
  return { grafo, completo: cayeron.length === 0 };
}
