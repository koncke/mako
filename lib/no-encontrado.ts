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

// =============================================================================
// QUE EL TÍTULO DE LA PESTAÑA SEPA QUE ESTÁ EN UN 404 (9/11/2026)
// =============================================================================
// `TituloTab` (app/_components/TituloTab.tsx) vive en el layout RAÍZ y se titula a partir de la ruta. En una
// dirección que no existe eso no tiene arreglo posible desde la ruta: la ruta es justamente lo que está mal.
//
// ⚠️ Y ESCRIBIR `document.title` DESDE LA PANTALLA DE 404 NO ALCANZA — está medido. `TituloTab` monta un
// `MutationObserver` sobre el `<head>` que REAFIRMA su título cada vez que alguien lo pisa (lo necesita por
// `/crm`, que tiene `loading.tsx` y llega con su `<title>` en streaming, pisando al nuestro). O sea que el
// 404 escribiría el título y el observador se lo revertiría en el acto.
//
// Por eso el 404 no escribe el título: AVISA. Un aviso chico, sin React, para que `TituloTab` lo lea con
// `useSyncExternalStore` y vuelva a titular. El sentido de la flecha importa: el que sabe que la dirección no
// existe es el 404, y el que manda en el `<head>` es `TituloTab`. Cada uno hace lo suyo.
// =============================================================================

let enUn404 = false;
const oyentes = new Set<() => void>();

/** La pantalla de 404 lo prende al montarse y lo apaga al irse. Sin lo segundo, el título queda pegado. */
export function marcarNoEncontrado(si: boolean): void {
  if (enUn404 === si) return;
  enUn404 = si;
  // Copia: un oyente que se desuscribe mientras se avisa no tiene por qué saltearle el turno al siguiente.
  for (const avisar of [...oyentes]) avisar();
}

export function suscribirNoEncontrado(oyente: () => void): () => void {
  oyentes.add(oyente);
  return () => { oyentes.delete(oyente); };
}

/** En el servidor siempre es `false`: el 404 lo prende al MONTAR, o sea ya en el navegador. */
export const hayNoEncontrado = (): boolean => enUn404;
