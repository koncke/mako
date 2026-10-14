// =============================================================================
// Las rutas del Image Editor, con el `?ws=` de la pestaña
// =============================================================================
// Un `router.push` sin el `?ws=` no falla: te deja mirando OTRA cuenta (AGENTS.md →
// «Hay CINCO formas de navegar, y las cinco llevan el `?ws=`»). Se lee el `ws` de la
// URL ACTUAL en el momento de navegar. Molde: app/video-editor/ruta.ts.

import { conWs, parseWs, WS_PARAM } from '@/lib/ws-tab';

export const RUTA_INICIO = '/image-editor';

/** `/image-editor/<id>` → `/image-editor/<id>?ws=N` si la pestaña mira un cliente. */
export function rutaEditor(href: string): string {
  if (typeof window === 'undefined') return href;
  const ws = parseWs(new URLSearchParams(window.location.search).get(WS_PARAM));
  return conWs(href, ws);
}

export function rutaDiseno(id: string): string {
  return rutaEditor(`${RUTA_INICIO}/${encodeURIComponent(id)}`);
}
