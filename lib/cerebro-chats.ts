// =============================================================================
// Los chats con MaKo de QUIEN MIRA, para el grafo del Second Brain (17/10/2026)
// =============================================================================
// Son de la persona, no del negocio: los pide la pantalla (escritorio y teléfono) y se los pasa a `construirCerebro`.
// El ZIP y la API arman el grafo sin ellos (no tienen persona). Un fallo devuelve `undefined`: el grafo sale igual,
// sin chats, que es lo mismo que pasa con cualquier fuente secundaria (lib/cerebro-grafo.ts).
// =============================================================================

import 'server-only';
import { personaDelRequest, listarSesiones } from './mako-turno-app';
import type { ChatMakoVivo } from './cerebro-vivo';

export async function chatsMakoDeQuienMira(): Promise<ChatMakoVivo[] | undefined> {
  try {
    const p = await personaDelRequest();
    if ('error' in p) return undefined;
    const ss = await listarSesiones(p);
    return [...ss].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((s) => ({ id: s.id, titulo: s.titulo, updatedAt: s.updatedAt }));
  } catch {
    return undefined;
  }
}
