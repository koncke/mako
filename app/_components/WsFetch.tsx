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

import { WS_PARAM, wsDeBusqueda, getWsDeTrabajo, esRutaDelTablero } from '@/lib/ws-tab';

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

  /**
   * Qué workspace le toca a ESTA llamada.
   *
   * ⚠️ MANDA LA PESTAÑA, SIEMPRE. El `ws de trabajo` es el del tablero que la ficha
   * de un cliente monta adentro del panel de la plataforma, y sólo entra cuando la
   * pestaña NO tiene uno propio y la ruta es del tablero. Al revés —el embebido
   * pisando a la pestaña— un super admin parado adentro de un cliente vería sus
   * llamadas salir hacia otro, que es exactamente el bug que esto evita.
   *
   * ⚠️ Y LA LISTA DE RUTAS ES POSITIVA. Sin ese corte, la llamada que el panel de
   * atrás hace mientras el modal está abierto (`/api/admin/*`) saldría apuntando al
   * cliente: una carrera convertida en escritura en el inquilino equivocado.
   */
  const wsDeLaLlamada = (url: string): number | null => {
    const dePestana = wsDeBusqueda(window.location.search);
    if (dePestana) return dePestana;
    const deTrabajo = getWsDeTrabajo();
    if (!deTrabajo) return null;
    try {
      return esRutaDelTablero(new URL(url, window.location.origin).pathname) ? deTrabajo : null;
    } catch {
      return null;
    }
  };

  window.fetch = function (entrada: RequestInfo | URL, init?: RequestInit) {
    try {
      if (typeof entrada === 'string' || entrada instanceof URL) {
        const url = String(entrada);
        if (!esApiPropia(url)) return original(entrada, init);
        // Se lee en CADA llamada, no al parchear: la pestaña puede navegar y cambiar
        // de cliente sin recargar, y un valor capturado quedaría viejo.
        const ws = wsDeLaLlamada(url);
        return ws ? original(conWsApi(url, ws), init) : original(entrada, init);
      }
      // `fetch(new Request(...))`: no se le puede cambiar la url, hay que
      // reconstruirlo. Se preserva todo lo demás del Request original.
      if (entrada instanceof Request && esApiPropia(entrada.url)) {
        const ws = wsDeLaLlamada(entrada.url);
        if (ws) return original(new Request(conWsApi(entrada.url, ws), entrada), init);
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
