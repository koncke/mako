// =============================================================================
// copywriter/compartir — abrir y guardar un guion con un link para EDITAR (docs/diseno-copywriter.md, D9)
// =============================================================================
// Lo usan la página pública (app/compartido/[token]/page.tsx) y la ruta que guarda (app/api/compartido/guion). Las dos
// preguntan lo MISMO (`guionDelShare`, lib/copywriter/compartir-reglas.ts) y corren en el workspace DEL LINK: sin
// sesión, `getWorkspaceActual()` cae al dueño de la plataforma, y los guiones viven en el de cada negocio.
//
// Un guion en la Papelera no se abre por el link (404, como si no existiera); si vuelve, el link vuelve a andar. Para
// cortar un link, se revoca en «Compartir para editar».
// ⚠️ «EN LA PAPELERA» ES TAMBIÉN «CUELGA DE UNA QUE ESTÁ» (18/11/2026, B6 de la verificación de la mudanza): mandar una página
//    a la Papelera se lleva sus subpáginas (la tab ya no las dibuja, lib/copywriter/arbol.ts → `escondida`), y las puertas del
//    link miraban sólo `pagina.papelera`: el link de una HIJA seguía abriendo y editando. Las tres puertas (la página pública,
//    la ruta que guarda y /api/compartir al acuñar el link) preguntan `guionALaVista`, la misma pregunta que la tab.
// =============================================================================

import 'server-only';
import { runWithWorkspace } from '../workspace';
import type { Acceso } from '../shares';
import { guionDelShare, loQueViajaConElLink } from './compartir-reglas';
import { abrir, listar } from './server';
import { escondida } from './arbol';
import { catalogosDelCopywriter } from './catalogos-server';
import type { GuionAbierto } from './tipos';
import type { CatalogosCopy } from './catalogos';

export type AccesoGuion = { ws: number; id: string };

/** El guion que este link deja editar, con su workspace; null = 404. Sin leer nada todavía. */
export function accesoDeGuion(acceso: Acceso | null): AccesoGuion | null {
  if (!acceso) return null;
  const id = guionDelShare(acceso.share);
  return id ? { ws: Number(acceso.share.workspace_id), id } : null;
}

/** Corre `fn` en el workspace del link. */
export const enSuWorkspace = <T,>(a: AccesoGuion, fn: () => Promise<T>): Promise<T> => runWithWorkspace(a.ws, fn);

/**
 * El guion vivo y A LA VISTA del negocio en curso: existe, y ni él ni una página de arriba está en la Papelera (la misma
 * pregunta que la tab, `escondida`). null = 404. Un índice que no se pudo leer también es null: un link que ESCRIBE no se
 * abre por las dudas.
 */
export async function guionALaVista(id: string): Promise<GuionAbierto | null> {
  const [r, l] = await Promise.all([abrir(id), listar()]);
  if (!r.ok || !l.ok || escondida(l.paginas, id)) return null;
  return { pagina: r.pagina, doc: r.doc };
}

/** Lo que dibuja la página pública: el guion (vivo, a la vista) y lo justo de la biblioteca. null = 404. */
export async function abrirCompartido(a: AccesoGuion): Promise<{ guion: GuionAbierto; catalogos: CatalogosCopy } | null> {
  return enSuWorkspace(a, async () => {
    const g = await guionALaVista(a.id);
    if (!g) return null;
    return loQueViajaConElLink(g, await catalogosDelCopywriter());
  });
}
