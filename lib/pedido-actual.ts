// =============================================================================
// pedidoActual — la ruta y la query del pedido, para un LAYOUT que redirige antes del loader (23/10/2026)
// =============================================================================
// Ticket #7: un `redirect()` adentro de una página con `loading.tsx` va adentro del stream (200 + meta refresh, no 307) y la
// carrera con la hidratación tiró «Minified React error #310» en el router de Next. El layout de un segmento queda AFUERA de
// su loading.tsx: redirigir ahí devuelve el 307 de siempre y el loader se queda. Pero un layout no recibe `searchParams` ni
// sabe qué ruta se pidió (envuelve también a sus hijas): las dos cosas las pone el proxy en headers propios, que pisa los
// que mande el cliente (HEADER_RUTA y HEADER_QUERY, lib/api-tab.ts). Lo usan app/plan/layout.tsx y app/second-brain/layout.tsx.
// =============================================================================

import 'server-only';
import { headers } from 'next/headers';
import { HEADER_QUERY, HEADER_RUTA } from './api-tab';
import { queryComoSearchParams, type QueryDelPedido } from './pedido-actual-reglas';
import { pedidoInterno } from './movil-desvio';

export { queryComoSearchParams, type QueryDelPedido };


/** La ruta pedida (`null` si el pedido no pasó por el proxy) y su query. */
export async function pedidoActual(): Promise<{ ruta: string | null; query: QueryDelPedido }> {
  const h = await headers();
  return { ruta: h.get(HEADER_RUTA), query: queryComoSearchParams(h.get(HEADER_QUERY) ?? '') };
}

/**
 * Lo mismo para un layout de /m (25/10/2026): la ruta y la query que recibe SU página. En un teléfono el proxy sirve /chats con
 * la página de /m/chats, y los headers dicen /chats: `pedidoInterno` (lib/movil-desvio.ts) lo traduce como el proxy. null = el
 * pedido no es de una pantalla de /m.
 */
export async function pedidoMovilActual(): Promise<{ ruta: string; query: QueryDelPedido } | null> {
  const h = await headers();
  const p = pedidoInterno(h.get(HEADER_RUTA), h.get(HEADER_QUERY) ?? '');
  return p ? { ruta: p.ruta, query: queryComoSearchParams(p.search) } : null;
}
