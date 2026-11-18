// Dónde va un `Menu` (MaKo, 18/11/2026): puro, fuera de Menu.tsx para que un test lo pueda correr (Menu.tsx carga su CSS module).

const MARGEN = 8
const SEPARACION = 6

/**
 * Dónde va el menú (18/11/2026, MaKo; F46 de docs/pendientes-verificados-17-11.md): debajo del ancla y, si abajo no entra y
 * arriba sí, ARRIBA (abierto desde la barra inferior, debajo tapaba su propio botón); después se encaja en la ventana. Sin ancla,
 * en el punto (`at`, un clic derecho). Puro: lo prueba tests/image-editor-menu-y-pagina.test.ts.
 */
export function posicionMenu(p: {
  panel: { width: number; height: number }
  at?: { x: number; y: number }
  anchor?: { left: number; top: number; bottom: number } | null
  vw: number
  vh: number
}): { left: number; top: number } {
  let left = p.at?.x ?? 0
  let top = p.at?.y ?? 0
  if (p.anchor) {
    left = p.anchor.left
    top = p.anchor.bottom + SEPARACION
    const arriba = p.anchor.top - SEPARACION - p.panel.height
    if (top + p.panel.height > p.vh - MARGEN && arriba >= MARGEN) top = arriba
  }
  left = Math.max(MARGEN, Math.min(left, p.vw - p.panel.width - MARGEN))
  top = Math.max(MARGEN, Math.min(top, p.vh - p.panel.height - MARGEN))
  return { left, top }
}
