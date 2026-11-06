// =============================================================================
// Las rutas del Image Editor, con el `?ws=` de la pestaña
// =============================================================================
// Un `router.push` sin el `?ws=` no falla: te deja mirando OTRA cuenta (AGENTS.md →
// «Hay CINCO formas de navegar, y las cinco llevan el `?ws=`»). Se lee el `ws` de la
// URL ACTUAL en el momento de navegar. Molde: app/video-editor/ruta.ts.
//
// Desde el 6/11/2026 la portada de Image son los EJEMPLOS (Martín: «La tab de "Encuentra tu siguiente OUTLIER" tiene que ser la
// principal»): `/image-editor`. Las plantillas de «Crear desde cero» son `?ver=crear` (RUTA_CREAR), y `?ver=carruseles` (el
// link de antes) redirige a la portada con sus filtros.

import { conWs, parseWs, WS_PARAM } from '@/lib/ws-tab';

export const RUTA_INICIO = '/image-editor';
/** «Crear desde cero»: la pantalla de Create con las plantillas y los diseños del negocio. */
export const RUTA_CREAR = '/image-editor?ver=crear';

type Query = Record<string, string | string[] | undefined>;
const primero = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Qué muestra `/image-editor` según su `?ver=`: los ejemplos (sin `ver`), las plantillas (`crear`) o el link viejo. */
export function vistaDeImage(q: Query): 'ejemplos' | 'crear' | 'redirigir' {
  const ver = primero(q.ver);
  if (ver === 'crear') return 'crear';
  if (ver === 'carruseles') return 'redirigir';
  return 'ejemplos';
}

/** La query sin `ver` ni `ws` (el `?ws=` lo vuelve a poner `rutaConWs`): lo que conserva la redirección del link viejo. */
export function querySinVer(q: Query): string {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (k === 'ver' || k === WS_PARAM || v == null) continue;
    for (const x of Array.isArray(v) ? v : [v]) out.append(k, x);
  }
  return out.toString();
}

/** `/image-editor/<id>` → `/image-editor/<id>?ws=N` si la pestaña mira un cliente. */
export function rutaEditor(href: string): string {
  if (typeof window === 'undefined') return href;
  const ws = parseWs(new URLSearchParams(window.location.search).get(WS_PARAM));
  return conWs(href, ws);
}

export function rutaDiseno(id: string): string {
  return rutaEditor(`${RUTA_INICIO}/${encodeURIComponent(id)}`);
}
