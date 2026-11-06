// =============================================================================
// El contenedor de los portales de Admin (la copia de Polar)
// =============================================================================
// Los menús, selects, diálogos y el ⌘K de radix se montan por defecto en <body>, FUERA de la raíz `.pl` donde viven los
// tokens del tema de Polar: se dibujarían sin colores (AGENTS.md → «Un tema limitado a una clase no llega a los
// PORTALES»). Todos los `Portal` de app/admin/_polar reciben este contenedor, que el layout de Admin dibuja adentro de
// `.pl` (app/admin/_polar/dashboard/DashboardLayout.tsx). Devuelve `undefined` (no `null`) cuando no existe: es lo que
// radix entiende como «usá el default».

export const ID_PORTAL_PL = 'pl-portal'

export function portalPl(): HTMLElement | undefined {
  if (typeof document === 'undefined') return undefined
  return document.getElementById(ID_PORTAL_PL) ?? undefined
}
