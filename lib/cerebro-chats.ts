// =============================================================================
// Los chats con MaKo de QUIEN MIRA, para el grafo del Second Brain (17/10/2026)
// =============================================================================
// Son de la persona, no del negocio: los pide la pantalla (escritorio y teléfono) y se los pasa a `construirCerebro`.
// El ZIP y la API arman el grafo sin ellos (no tienen persona). Un fallo devuelve `undefined`: el grafo sale igual,
// sin chats, que es lo mismo que pasa con cualquier fuente secundaria (lib/cerebro-grafo.ts).
//
// Desde el 23/10/2026 también las charlas de las TABS (lib/cerebro-chats-tabs.ts): las MISMAS lecturas con las que el Ops
// Center arma su lista (lib/chat-mako-indice.ts, con su regla de quién ve qué), así que en el grafo aparece lo que la persona ve
// en su Ops Center y nada más. Cada fuente que falla se queda afuera sola: el grafo sale con las demás.
// =============================================================================

import 'server-only';
import { personaDelRequest, listarSesiones } from './mako-turno-app';
import {
  chatsDeAntes, chatsDeAutomations, chatsDeLasTabs, chatsDeLosEditores, quienChateaDelRequest,
  type ChatDeAntes, type ChatDeAutomatizacion, type ChatDeEditor,
} from './chat-mako-indice';
import { chatsDeTabParaElGrafo } from './cerebro-chats-tabs';
import type { ChatMakoVivo } from './cerebro-vivo';

export async function chatsMakoDeQuienMira(): Promise<ChatMakoVivo[] | undefined> {
  try {
    const p = await personaDelRequest();
    if ('error' in p) return undefined;
    const [ss, deTabs] = await Promise.all([listarSesiones(p), chatsDeTabsDeQuienMira(p)]);
    const propios = [...ss].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((s) => ({ id: s.id, titulo: s.titulo, updatedAt: s.updatedAt }));
    return [...propios, ...deTabs];
  } catch {
    return undefined;
  }
}

/** Las charlas de las tabs que esta persona ve en su Ops Center. Nunca tira: lo que no se pudo leer no entra. */
async function chatsDeTabsDeQuienMira(p: { ws: number; chartKey: string }): Promise<ChatMakoVivo[]> {
  const q = await quienChateaDelRequest().catch(() => null);
  const [antes, tabs, automations, editores] = await Promise.all([
    q ? chatsDeAntes(q).catch((): ChatDeAntes[] => []) : [],
    chatsDeLasTabs(p).catch((): ChatDeAntes[] => []),
    chatsDeAutomations().catch((): ChatDeAutomatizacion[] => []),
    q ? chatsDeLosEditores(q).catch((): ChatDeEditor[] => []) : [],
  ]);
  return chatsDeTabParaElGrafo({ antes: [...antes, ...tabs], automations, editores });
}
