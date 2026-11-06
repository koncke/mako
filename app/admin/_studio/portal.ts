// =============================================================================
// El contenedor de los portales de Admin (el porte de Studio Admin)
// =============================================================================
// Los menús, selects y diálogos de radix se montan por default en <body>, que queda FUERA de la raíz `.sa` donde viven
// los tokens del tema de Studio: se dibujarían sin colores (AGENTS.md → «Un tema limitado a una clase no llega a los
// PORTALES»). Por eso todos los `Portal` de app/admin/_studio/components/ui reciben este contenedor, que la raíz de Admin
// dibuja adentro de sí misma (app/admin/_studio/shell/AdminShell.tsx). Es el mismo molde que app/video-editor/portal.ts.
//
// Devuelve `undefined` (no `null`) cuando no existe: es lo que radix entiende como «usá el default».

export const ID_PORTAL_SA = 'sa-portal';

export function portalSa(): HTMLElement | undefined {
  if (typeof document === 'undefined') return undefined;
  return document.getElementById(ID_PORTAL_SA) ?? undefined;
}
