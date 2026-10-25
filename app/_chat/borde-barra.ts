// =============================================================================
// borde-barra — qué se mide de la barra de la app para poner la estrella de MaKo al lado (puro, 24/10/2026, f34)
// =============================================================================
// La barra (`[data-sidebar]`, app/_components/Sidebar.tsx) es un `<aside>` del ancho del riel cuando no está fija, y adentro
// un panel absoluto que se DESPLIEGA ENCIMA al pasar el cursor, sin que el `<aside>` cambie de ancho. La estrella de abajo
// (app/_chat/MakoEnLaTab.tsx) se medía con el `<aside>`: con la barra desplegada quedaba DEBAJO del panel (z 55 contra 60), y
// la criatura de un loader que volaba a ella (app/_ui/VueloDeCarga.tsx) «se oculta detrás y no se entiende a dónde se fue»
// (Martín, la llamada con Leandro, 59:33). La estrella se mide con el panel: lo que se ve.
// =============================================================================

/** El panel que se ve de la barra de la app: su primer hijo (el que se despliega encima); sin él, la barra. */
export function panelDeLaBarra(barra: Pick<Element, 'firstElementChild'> | null): Element | null {
  return barra?.firstElementChild ?? (barra as Element | null);
}
