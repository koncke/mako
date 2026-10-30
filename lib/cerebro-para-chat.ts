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
  CAPA_FUNCIONES, catalogoCorto, esPreguntaDeProducto, funcionEntera, funcionesDeMako, funcionQueVende, ID_RAIZ_FUNCIONES, PUENTE_FUNCIONES,
  sinFunciones,
} from './cerebro-funciones';
import { bloqueDelSecondBrain, conCapa, preguntaDelTurno, PRESUPUESTO_TURNO, sinLaPlata } from './cerebro-union';
import { recuperar } from './cerebro-recuperar';
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

/** Cuánto espera el turno al grafo la primera vez (después sale de la caché): si no llegó, el turno sigue sin el paquete. */
export const ESPERA_GRAFO_TURNO_MS = 2_500;

/**
 * Lo que el turno de MaKo trae del Second Brain ANTES del modelo (la tanda 3 del relevamiento, 28/10/2026): la vista local de
 * lo que nombra la pregunta, sin IA y con su presupuesto (`bloqueDelSecondBrain`). Si la pregunta no nombra nada del grafo,
 * nada (el índice no viaja en cada turno). Con `sinPlata` (un closer o un setter, como `sinNumerosDelNegocio` de
 * lib/mako-context.ts), sin los objetivos, los KPIs ni los clientes del negocio: el grafo en caché es del NEGOCIO, no de la
 * persona. Espera al grafo hasta `ESPERA_GRAFO_TURNO_MS` y nunca tira: sin grafo, el turno sigue como antes. Busca con las
 * primeras letras del mensaje (`preguntaDelTurno`): `recuperar` corre DESPUÉS de la espera, sincrónico y sin tope propio.
 */
export async function paqueteParaElTurno(pregunta: string, o: { sinPlata: boolean; presupuesto?: number }): Promise<string> {
  const q = preguntaDelTurno(pregunta);
  if (!q) return '';
  try {
    const grafo = await Promise.race([
      grafoParaChat(),
      new Promise<null>((r) => setTimeout(() => r(null), ESPERA_GRAFO_TURNO_MS)),
    ]);
    if (!grafo) return '';
    // La capa de las funciones (sólo existe en la plataforma) entra sólo si la pregunta es de producto: «¿cuál es mi meta?» no
    // habla del Ads Manager de Meta.
    const delRol = o.sinPlata ? sinLaPlata(grafo) : grafo;
    const g = esPreguntaDeProducto(q) ? delRol : sinFunciones(delRol);
    return bloqueDelSecondBrain(recuperar(g, { pregunta: q, presupuesto: o.presupuesto ?? PRESUPUESTO_TURNO }));
  } catch {
    return '';
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
