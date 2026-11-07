// =============================================================================
// no-encontrado — las reglas de la pantalla de «esta dirección no existe» (7/11/2026)
// =============================================================================
// Puro, sin React y sin `server-only`: lo usa `app/not-found.tsx`, que es un componente CLIENTE, y lo prueba
// `tests/no-encontrado.test.ts`. Acá está lo único de esa pantalla que puede romperse sin que se note.
// =============================================================================

/** El inicio de la app: la key `graphics` del nav (app/_components/nav.ts → `{ key: 'graphics', href: '/dashboard' }`). */
export const INICIO = '/dashboard';

/**
 * El link al inicio, conservando el negocio que se está mirando.
 *
 * ⚠️ POR QUÉ NO ES `rutaConWs`. Esa función (lib/workspace.ts) es de SERVIDOR —lee cookies— y la pantalla de
 * 404 es cliente, así que el `?ws=` se conserva a mano desde la URL.
 *
 * ⚠️ Y POR QUÉ IMPORTA. Un super admin mirando el negocio de un cliente tiene `?ws=3` en la barra. Si el botón
 * del 404 fuera `/dashboard` pelado, lo sacaría de ese negocio y lo dejaría en el suyo **sin decírselo**: la
 * pantalla se ve igual y los datos son otros. Es el mismo salto silencioso que el repo ya cuida en cada link
 * con `rutaConWs`.
 *
 * Un `ws` que no sea un número se descarta: viene de la URL, o sea de cualquiera.
 */
export function inicioDesde(search: string): string {
  let ws: string | null = null;
  try {
    ws = new URLSearchParams(search || '').get('ws');
  } catch {
    ws = null;
  }
  // Sólo dígitos: un `ws` inventado no tiene por qué viajar al link que ofrecemos.
  if (!ws || !/^\d{1,9}$/.test(ws)) return INICIO;
  return `${INICIO}?ws=${ws}`;
}

/**
 * El atajo del buscador de pantallas, como lo escribe ESE teclado.
 *
 * Decirle «Ctrl K» a alguien en una Mac es decirle una tecla que no existe para él: la combinación es ⌘ K
 * (app/_components/BuscadorNav.tsx la escucha con `metaKey || ctrlKey`).
 */
export const atajoBuscador = (plataforma: string): string =>
  /Mac|iPhone|iPad|iPod/i.test(plataforma || '') ? '⌘ K' : 'Ctrl K';
