// =============================================================================
// El contenedor de los portales del Video Editor
// =============================================================================
// Los menús, popovers y diálogos de radix se montan por default en <body>, que
// queda FUERA de la raíz `.ce` donde viven los tokens del tema de CapCut: se
// dibujarían sin colores. Por eso todos los `Portal` del motor reciben este
// contenedor, que la raíz del editor dibuja adentro de sí misma.
//
// Devuelve `undefined` (no `null`) cuando no existe: es lo que radix entiende
// como «usá el default», así un componente montado fuera del editor sigue andando.

export const ID_PORTAL_CE = 'ce-portal';

export function portalCe(): HTMLElement | undefined {
  if (typeof document === 'undefined') return undefined;
  return document.getElementById(ID_PORTAL_CE) ?? undefined;
}
