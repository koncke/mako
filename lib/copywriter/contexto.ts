// =============================================================================
// copywriter/contexto — lo que MaKo sabe del negocio al escribir un guion: SÓLO los nodos del Second Brain que hacen falta
// =============================================================================
// El encargo (28/10/2026): «El contexto del negocio (oferta, avatar, ángulos, funciones de MaKo) sale del Second Brain
// con `grafoParaChat`, sólo los nodos que hacen falta». Martín, ese día: «que sea eficiente justamente, por eso tenemos
// tipo grafo, sin gastar tantos tokens».
//
// La vista local del grafo (`recuperar`, lib/cerebro-recuperar.ts: las semillas que nombra el pedido, sus vecinos y un
// presupuesto de tokens) con un pedido que SIEMPRE nombra lo que un guion necesita (la oferta, el avatar, la promesa),
// más lo que escribió la persona.
//
// ⚠️ PUNTO DE ENGANCHE: el grafo hoy es `construirCerebro()` (lib/cerebro-grafo.ts), el mismo que lee la API de MaKo
//    (lib/api-mako/areas/negocio.run.ts). `grafoParaChat` (lib/cerebro-para-chat.ts: el negocio sin física, en caché por
//    workspace, y en la plataforma con «Lo que hace MaKo») vive en la rama mako-inteligente-2710-c4, en verificación al
//    escribir esto. Cuando llegue a main, se cambia UNA línea: `GRAFO` (abajo). Nada más depende de cuál es.
// Nunca tira: sin grafo, el guion se escribe igual y el prompt lo dice («no hay datos del negocio»).
// =============================================================================

import 'server-only';
import { construirCerebro } from '../cerebro-grafo';
import { recuperar } from '../cerebro-recuperar';

/** ⚠️ El punto de enganche (ver la cabecera): el grafo que lee el Copywriter. */
const GRAFO = () => construirCerebro();

/** Lo que un guion siempre necesita del negocio, en las palabras que encuentran esos nodos. */
export const LO_QUE_PIDE_UN_GUION = 'oferta producto precio promesa garantía avatar cliente ideal dolor deseo objeciones testimonios casos resultados';

/** Tokens estimados del paquete del negocio (el default de `recuperar` es 1.500). */
export const PRESUPUESTO_NEGOCIO = 1_800;

/** El paquete del negocio para el pedido, o '' si no se pudo leer (y lo deja en el log). */
export async function contextoDelNegocio(pedido: string): Promise<string> {
  try {
    const grafo = await GRAFO();
    const p = recuperar(grafo, { pregunta: `${LO_QUE_PIDE_UN_GUION} ${pedido}`.slice(0, 2_000), presupuesto: PRESUPUESTO_NEGOCIO, profundidad: 1 });
    return p.texto.trim();
  } catch (e) {
    console.warn('[copywriter] no pude leer el Second Brain', e instanceof Error ? e.message : e);
    return '';
  }
}
