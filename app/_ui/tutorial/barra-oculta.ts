// =============================================================================
// LA BARRA OCULTA AL ENTRAR (onboarding V2, 19/11/2026)
// =============================================================================
// Martín, probándolo en producción: «apenas entro y sale la barra lateral, que habíamos quedado que justamente al principio estaba
// oculta». La maqueta: la barra aparece en el paso del recorrido que la presenta («Tu panel») y queda para siempre.
// «Entrar a MaKo» (app/onboarding/ChatArranqueV2.tsx) la esconde con un atributo en <html>, que sobrevive a la navegación de adentro
// de la app; el CSS (app/_ui/ui.css) la saca. El motor del tutorial (./MotorTutorial.tsx) la vuelve a mostrar en el paso que marca
// `aside[data-sidebar]`, al terminar el tutorial, o si en un rato no arrancó ninguno (nunca queda escondida sin salida). Al recargar,
// el atributo lo pone el layout raíz desde el server (app/layout.tsx, 20/11: OD-03) mientras el recorrido del Ops Center no se vio.
// Puro y sin React: lo importan la pantalla del onboarding y el motor.
// =============================================================================

export const ATTR_BARRA_OCULTA = 'data-barra-oculta';

export function esconderLaBarra(): void {
  try { document.documentElement.setAttribute(ATTR_BARRA_OCULTA, ''); } catch { /* sin document */ }
}

export function mostrarLaBarra(): void {
  try { document.documentElement.removeAttribute(ATTR_BARRA_OCULTA); } catch { /* sin document */ }
}

/**
 * «TU PANEL» LA MUESTRA ENTERA (20/11, OD-03: la maqueta, `barra: true, cajon: true`, y el paso siguiente la pliega). En el Ops
 * Center la barra arranca plegada a íconos; el motor le pide abrirse entera mientras marca el paso que la presenta, y plegarse al
 * pasar. La barra (app/_components/Sidebar.tsx) lo oye con este evento: como la flecha, sin tocar lo que la persona guardó.
 */
export const EVENTO_BARRA_ENTERA = 'mk-barra-entera';
export function barraEntera(si: boolean): void {
  try { window.dispatchEvent(new CustomEvent<boolean>(EVENTO_BARRA_ENTERA, { detail: si })); } catch { /* sin window */ }
}

/** El paso que presenta la barra: marca la barra misma. */
export const presentaLaBarra = (sel: string | null | undefined): boolean => !!sel && sel.includes('aside[data-sidebar]');
