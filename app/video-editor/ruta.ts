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

/**
 * Abre el proyecto que se ACABA de crear al cargar la página (`/video-editor/nuevo`, un id que no está en este navegador,
 * `?plantilla=`, `?desde=`), con una carga entera y no con `router.replace` (ticket #91, 12/11/2026).
 *
 * «La pantalla Video se rompió»: React #310 («más hooks que en el render anterior») en el `Router` de Next (el `useMemo` de
 * `app-router`), dos veces seguidas: la recarga automática volvía a la misma URL y volvía a navegar sola. Es el bug de
 * vercel/next.js#63121: una navegación que se resuelve por promesa (la de una página `force-dynamic`, que pide al servidor)
 * deja al Router con otra cuenta de hooks. Arreglado en React (react#36911) y en Next DESPUÉS de la 16.2 que usa MaKo.
 *
 * El proyecto ya está guardado (createNewProject / saveCurrentProject) antes de llamar acá: la carga nueva lo abre de la
 * base local. Cuesta una carga de página, sólo al crear. Con Next ≥ 16.3, volver a `router.replace` (docs/hallazgos-video-editor.md).
 */
export function abrirProyectoCreado(id: string): void {
  window.location.replace(rutaEditor(`/video-editor/${id}`));
}
