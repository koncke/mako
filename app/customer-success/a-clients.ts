// =============================================================================
// a-clients — las rutas viejas de Customer Success REDIRIGEN a Clients (17/10/2026)
// =============================================================================
// Martín unificó Clientes, Curso y Comunidad en UNA tab, «Clients» (docs/diseno-clients.md). Las rutas
// viejas siguen vivas porque hay mails, avisos, notificaciones de la comunidad y links de la API ya mandados
// que las nombran: cada `page.tsx` viejo es sólo esto, y la tabla de qué va a dónde es `rutaNuevaDeVieja`
// (lib/clients-rutas.ts, con su test).
//
// ⚠️ CON LA QUERY ENTERA Y EL `?ws=` (`rutaConWs`): un `?cliente=`, un `?post=` o el workspace que mira el
//    super admin no se pierden en el salto. Temporal (307), no permanente: un 308 lo guarda el navegador
//    para siempre, y si la tabla cambia, el que ya lo tiene no se entera.
// =============================================================================

import 'server-only';
import { redirect } from 'next/navigation';
import { rutaConWs } from '@/lib/workspace';
import { RUTA_CLIENTS, queryDeSearchParams, rutaNuevaDeVieja } from '@/lib/clients-rutas';

export async function aClients(
  rutaVieja: string,
  searchParams: Promise<Record<string, string | string[] | undefined>>,
): Promise<never> {
  const q = queryDeSearchParams(await searchParams);
  redirect(await rutaConWs(rutaNuevaDeVieja(rutaVieja, q) ?? RUTA_CLIENTS));
}
