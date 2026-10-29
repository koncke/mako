// =============================================================================
// copywriter/compartir — abrir y guardar un guion con un link para EDITAR (docs/diseno-copywriter.md, D9)
// =============================================================================
// Lo usan la página pública (app/compartido/[token]/page.tsx) y la ruta que guarda (app/api/compartido/guion). Las dos
// preguntan lo MISMO (`guionDelShare`, lib/copywriter/compartir-reglas.ts) y corren en el workspace DEL LINK: sin
// sesión, `getWorkspaceActual()` cae al dueño de la plataforma, y los guiones viven en el de cada negocio.
//
// Un guion en la Papelera no se abre por el link (404, como si no existiera); si vuelve, el link vuelve a andar. Para
// cortar un link, se revoca en «Compartir para editar».
// =============================================================================

import 'server-only';
import { runWithWorkspace } from '../workspace';
import type { Acceso } from '../shares';
import { guionDelShare, loQueViajaConElLink } from './compartir-reglas';
import { abrir } from './server';
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

/** Lo que dibuja la página pública: el guion (vivo, fuera de la Papelera) y lo justo de la biblioteca. null = 404. */
export async function abrirCompartido(a: AccesoGuion): Promise<{ guion: GuionAbierto; catalogos: CatalogosCopy } | null> {
  return enSuWorkspace(a, async () => {
    const r = await abrir(a.id);
    if (!r.ok || r.pagina.papelera) return null;
    return loQueViajaConElLink({ pagina: r.pagina, doc: r.doc }, await catalogosDelCopywriter());
  });
}
