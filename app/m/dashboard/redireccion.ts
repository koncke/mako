// =============================================================================
// /m/dashboard — QUÉ página dibuja un pedido, para el layout que redirige antes del loader (25/10/2026, React #310)
// =============================================================================
// app/m/dashboard/loading.tsx envuelve a las dos páginas (la del Dashboard y la de una hoja propia, ./[hoja]), así que las
// dos redirigen en ./layout.tsx (docs/hallazgos-infra.md, tickets #7 y #9). Pero el layout no recibe el `[hoja]` (es de la
// hija) ni sabe qué ruta se pidió: la pone el proxy (lib/pedido-actual.ts), y es la de la URL. En el teléfono la URL es la
// de ESCRITORIO (/dashboard?hoja=…, /marketing, /comercial, /graficos: «las rutas deben ser las mismas»), que el proxy
// reescribe con `rutaMovil` (lib/movil-desvio.ts). Por eso se traduce con la MISMA tabla: otra cuenta acá mandaría a una
// hoja que la página no abre. Sin `server-only`: la leen el layout y el test.
// =============================================================================

import { esRutaMovil, rutaMovil } from '@/lib/movil-rutas';
import type { QueryDelPedido } from '@/lib/pedido-actual-reglas';

/** Adonde vuelve una hoja propia que no se abre en el teléfono (y el closer, que no tiene otras): el Dashboard. */
export const VOLVER_AL_DASHBOARD = '/m/dashboard';

export type PaginaDelPedido = { pagina: 'dashboard' } | { pagina: 'hoja'; id: string } | null;

/** La página de /m/dashboard que dibuja este pedido: el Dashboard, una hoja propia (con su id), o null (otra ruta). */
export function paginaDelPedido(ruta: string | null, query: QueryDelPedido): PaginaDelPedido {
  if (!ruta) return null;
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) for (const x of Array.isArray(v) ? v : [v]) sp.append(k, x);
  const qs = sp.toString();
  const destino = esRutaMovil(ruta) ? ruta : rutaMovil(qs ? `${ruta}?${qs}` : ruta);
  const path = (destino ?? '').split(/[?#]/)[0].replace(/\/+$/, '');
  if (path === VOLVER_AL_DASHBOARD) return { pagina: 'dashboard' };
  const m = /^\/m\/dashboard\/([^/]+)$/.exec(path);
  if (!m) return null;
  let id = m[1];
  // Como la página (./[hoja]/page.tsx): un % suelto se busca tal cual.
  try { id = decodeURIComponent(id); } catch { /* tal cual */ }
  return { pagina: 'hoja', id };
}
