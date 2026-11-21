// =============================================================================
// PANTALLA COMPLETA PARA UN VIDEO DEL CHAT (20/11/2026, el inventario de botones: no había en ningún reproductor del chat)
// =============================================================================
// La del navegador (`requestFullscreen`); en el iPhone, el <video> no la tiene y se usa la suya (`webkitEnterFullscreen`). Puro: lo
// prueba tests/inventario-videos-y-reto.test.ts con elementos de mentira. Devuelve si la pudo pedir.
// =============================================================================

type ConPantallaCompleta = { requestFullscreen?: () => Promise<void>; webkitEnterFullscreen?: () => void };

export function pantallaCompleta(v: ConPantallaCompleta | null | undefined): boolean {
  if (!v) return false;
  if (typeof v.requestFullscreen === 'function') { void v.requestFullscreen().catch(() => {}); return true; }
  if (typeof v.webkitEnterFullscreen === 'function') { v.webkitEnterFullscreen(); return true; }
  return false;
}
