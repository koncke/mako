// =============================================================================
// Las rutas del Video Editor, con el `?ws=` de la pestaña
// =============================================================================
// El motor portado de OpenCut navega con `router.push("/...")` a pelo. Acá esa
// navegación pasa por `conWs`: un `router.push` sin el `?ws=` no falla, te deja
// mirando OTRA cuenta (AGENTS.md → «Hay CINCO formas de navegar, y las cinco
// llevan el `?ws=`»).
//
// Se lee el `ws` de la URL ACTUAL en el momento de navegar, no de un contexto
// de React: el motor llama a esto desde managers que viven fuera del árbol.

import { conWs, parseWs, WS_PARAM } from '@/lib/ws-tab';

/** `/video-editor/<id>` → `/video-editor/<id>?ws=N` si la pestaña mira un cliente. */
export function rutaEditor(href: string): string {
  if (typeof window === 'undefined') return href;
  const ws = parseWs(new URLSearchParams(window.location.search).get(WS_PARAM));
  return conWs(href, ws);
}
