// =============================================================================
// LA BARRA OCULTA AL ENTRAR (onboarding V2, 19/11/2026)
// =============================================================================
// Martín, probándolo en producción: «apenas entro y sale la barra lateral, que habíamos quedado que justamente al principio estaba
// oculta». La maqueta: la barra aparece en el paso del recorrido que la presenta («Tu panel») y queda para siempre.
// «Entrar a MaKo» (app/onboarding/ChatArranqueV2.tsx) la esconde con un atributo en <html>, que sobrevive a la navegación de adentro
// de la app; el CSS (app/_ui/ui.css) la saca. El motor del tutorial (./MotorTutorial.tsx) la vuelve a mostrar en el paso que marca
// `aside[data-sidebar]`, al terminar el tutorial, o si en un rato no arrancó ninguno (nunca queda escondida sin salida). Al recargar,
// el atributo no está: la barra, como siempre.
// Puro y sin React: lo importan la pantalla del onboarding y el motor.
// =============================================================================

export const ATTR_BARRA_OCULTA = 'data-barra-oculta';

export function esconderLaBarra(): void {
  try { document.documentElement.setAttribute(ATTR_BARRA_OCULTA, ''); } catch { /* sin document */ }
}

export function mostrarLaBarra(): void {
  try { document.documentElement.removeAttribute(ATTR_BARRA_OCULTA); } catch { /* sin document */ }
}

/** El paso que presenta la barra: marca la barra misma. */
export const presentaLaBarra = (sel: string | null | undefined): boolean => !!sel && sel.includes('aside[data-sidebar]');
