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

/**
 * La URL que se ESCRIBE con `history.replaceState` al cambiar de diseño sin navegar (27/10/2026, Martín: «que no cambie
 * de ruta»): la de AHORA con el último tramo cambiado por el id (o sin tramo, `null`). Se parte de la URL actual y no se
 * arma de cero (AGENTS.md, «LAS MISMAS RUTAS»): ahí vienen el `?ws=` del super admin y lo que traiga el link, y un
 * teléfono también dice `/image-editor/…` aunque el server le sirva la página de /m.
 */
export function rutaEnLugar(href: string, id: string | null): string {
  const u = new URL(href, 'http://x');
  // `?propuesta=` (el link de una propuesta de la API, mako/chat/propuestas.ts) es del diseño que abrió ese link: en OTRO
  // diseño enfocaría una propuesta ajena («ya no está abierta»). Se va con el cambio; el `?ws=` y lo demás se quedan.
  if (u.searchParams.has('propuesta')) u.searchParams.delete('propuesta');
  const base = /^(.*?\/image-editor)(?:\/[^/]*)?\/?$/.exec(u.pathname)?.[1] ?? RUTA_INICIO;
  return `${id ? `${base}/${encodeURIComponent(id)}` : base}${u.search}${u.hash}`;
}

/** Escribe en la barra del navegador el diseño que se ve, sin navegar (un F5 o un link copiado lo reabren). */
export function marcarEnUrl(id: string | null): void {
  if (typeof window === 'undefined') return;
  const destino = rutaEnLugar(window.location.href, id);
  if (destino !== window.location.pathname + window.location.search + window.location.hash) window.history.replaceState(null, '', destino);
}
