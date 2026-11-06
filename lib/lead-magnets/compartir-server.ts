// =============================================================================
// lead-magnets/compartir-server — lo que dibuja el link público de un lead magnet
// =============================================================================
// La página del Copywriter que deja leer el link (./compartir.ts decide cuál), leída en el workspace DEL LINK. Una página en
// la Papelera, o que ya no existe, es un 404. Viajan sólo el título, el emoji y el documento: ni dónde cuelga en el árbol del
// negocio ni sus propiedades.
// =============================================================================

import 'server-only';
import { runWithWorkspace } from '../workspace';
import { abrir } from '../copywriter/server';
import type { JsonNodo } from '../copywriter/tipos';

export async function abrirLeadMagnetCompartido(a: { ws: number; id: string }): Promise<{ titulo: string; emoji: string | null; doc: JsonNodo } | null> {
  try {
    return await runWithWorkspace(a.ws, async () => {
      const r = await abrir(a.id);
      if (!r.ok || r.pagina.papelera) return null;
      return { titulo: r.pagina.titulo, emoji: r.pagina.emoji ?? null, doc: r.doc.contenido };
    });
  } catch {
    return null;
  }
}
