// =============================================================================
// negocio-para-crear — lo que el experto de cada tab de Create sabe del negocio y de su voz (29/10/2026)
// =============================================================================
// Martín, 29/10/2026: «así MaKo al entrar te da el template y te puede ir ayudando a crearlo». El experto de cada tab
// (Copywriter, Video, Image, AI Avatar; docs/plantillas-reales/README.md, 2.4) adapta la plantilla al negocio de quien la
// abre, y lee de acá:
//   · `contextoDelNegocio(pedido)`: SÓLO los nodos del Second Brain que hacen falta (la vista local de `recuperar`, con un
//     pedido que siempre nombra lo que una pieza necesita: la oferta, el avatar, la promesa), sobre el grafo de los chats
//     (`grafoParaChat`, lib/cerebro-para-chat.ts: sin física, en caché por workspace). Martín, 28/10: «que sea eficiente
//     justamente, por eso tenemos tipo grafo, sin gastar tantos tokens». Antes vivía en lib/copywriter/contexto.ts y leía
//     `construirCerebro()` entero, con la física; Video e Image no leían el negocio.
//   · `vozDelNegocio()`: la guía de voz destilada o la marca declarada. Se RE-EXPORTA y no se muda: sus dos fuentes viven
//     en lib/nutricion-generator.ts, y mudarla armaba un ciclo con ese archivo. Para el prompt, `vozParaPrompt`
//     (lib/offer-ia.ts) la envuelve como dato no confiable.
// ⚠️ `contextoDelNegocio` de lib/plan-senales.ts es OTRA función (la fase y el canal del negocio, sin pedido): mismo nombre,
//    otra firma. Se importa de acá o de allá con la ruta, nunca a ciegas.
// Nunca tira: sin grafo, la pieza se escribe igual y el prompt lo dice («no hay datos del negocio»).
// =============================================================================

import 'server-only';
import { grafoParaChat } from './cerebro-para-chat';
import { recuperar } from './cerebro-recuperar';

export { vozDelNegocio } from './nutricion-generator';

/** Lo que una pieza siempre necesita del negocio, en las palabras que encuentran esos nodos. */
export const LO_QUE_PIDE_UNA_PIEZA = 'oferta producto precio promesa garantía avatar cliente ideal dolor deseo objeciones testimonios casos resultados';

/** Tokens estimados del paquete del negocio (el default de `recuperar` es 1.500). */
export const PRESUPUESTO_NEGOCIO = 1_800;

/** El paquete del negocio para el pedido, o '' si no se pudo leer (y lo deja en el log). */
export async function contextoDelNegocio(pedido: string): Promise<string> {
  try {
    const grafo = await grafoParaChat();
    const p = recuperar(grafo, { pregunta: `${LO_QUE_PIDE_UNA_PIEZA} ${pedido}`.slice(0, 2_000), presupuesto: PRESUPUESTO_NEGOCIO, profundidad: 1 });
    return p.texto.trim();
  } catch (e) {
    console.warn('[crear] no pude leer el Second Brain', e instanceof Error ? e.message : e);
    return '';
  }
}
