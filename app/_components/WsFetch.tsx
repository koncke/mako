'use client';

// =============================================================================
// El `?ws=` de la pestaña viaja solo en cada llamada a /api
// =============================================================================
// Hay 340 `fetch('/api/…')` repartidos en 108 archivos. Editarlos uno por uno
// para que lleven el workspace de la pestaña era garantizar que a los tres meses
// hubiera cinco olvidados — y un olvidado no es un error visible: es una pantalla
// que te muestra los datos de TU workspace mientras el resto de la pestaña
// muestra los del cliente. Nadie reporta eso como bug; se lee como "se ve raro".
//
// Por eso hay UN choke point. Es la misma idea que `emitirAviso` para los avisos
// y `getTenantDb` para el scoping: un solo lugar por el que pasa todo.
//
// ⚠️ EL PARCHE VA EN EL MÓDULO, NO EN UN EFECTO. Los efectos de React corren de
// HIJO a padre, así que un provider que parchee en `useEffect` lo hace DESPUÉS de
// que sus hijos ya dispararon sus primeras llamadas — justo las de la carga
// inicial, que son las que más importan. El código de arriba de un módulo
// 'use client' corre cuando se carga el chunk, antes de renderizar nada.
//
// Solo toca llamadas a `/api/` del mismo origen. Todo lo demás (Supabase Storage,
// la Graph API de Meta, un CDN) pasa sin que lo miremos.

import { WS_PARAM, wsDeBusqueda } from '@/lib/ws-tab';

declare global {
  // eslint-disable-next-line no-var
  var __makoWsFetch: boolean | undefined;
}

/** ¿Es una llamada a NUESTRA api? Solo esas llevan el workspace. */
function esApiPropia(url: string): boolean {
  if (url.startsWith('/api/')) return true;
  if (!/^https?:\/\//i.test(url)) return false;
  try {
    const u = new URL(url);
    return u.origin === window.location.origin && u.pathname.startsWith('/api/');
  } catch {
    return false;
  }
}

/** Le pega el `?ws=` a una URL de api, respetando el que ya traiga. */
function conWsApi(url: string, ws: number): string {
  const abs = new URL(url, window.location.origin);
  if (abs.searchParams.has(WS_PARAM)) return url;
  abs.searchParams.set(WS_PARAM, String(ws));
  return url.startsWith('/') ? `${abs.pathname}${abs.search}${abs.hash}` : abs.toString();
}

if (typeof window !== 'undefined' && !globalThis.__makoWsFetch) {
  globalThis.__makoWsFetch = true;
  const original = window.fetch.bind(window);

  window.fetch = function (entrada: RequestInfo | URL, init?: RequestInit) {
    try {
      // Se lee en CADA llamada, no al parchear: la pestaña puede navegar y cambiar de
      // cliente sin recargar, y un valor capturado quedaría viejo.
      const ws = wsDeBusqueda(window.location.search);
      if (!ws) return original(entrada, init);
      if (typeof entrada === 'string' || entrada instanceof URL) {
        const url = String(entrada);
        return esApiPropia(url) ? original(conWsApi(url, ws), init) : original(entrada, init);
      }
      // `fetch(new Request(...))`: no se le puede cambiar la url, hay que
      // reconstruirlo. Se preserva todo lo demás del Request original.
      if (entrada instanceof Request && esApiPropia(entrada.url)) {
        return original(new Request(conWsApi(entrada.url, ws), entrada), init);
      }
    } catch {
      // Ante cualquier cosa rara, la llamada original. Este parche no puede ser
      // el motivo de que la app deje de funcionar.
    }
    return original(entrada, init);
  };
}

/** No pinta nada: existe para que el layout importe el módulo y se aplique el parche. */
export function WsFetch() {
  return null;
}
