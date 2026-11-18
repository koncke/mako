// =============================================================================
// lead-visita — atar la visita del Pixel (`visitor_id`) a una ficha que YA existía (O44, 18/11/2026)
// =============================================================================
// La ficha de un lead se une con su grabación, sus visitas y lo que vio del video POR `visitor_id` (la cookie anónima del
// Pixel). Un opt-in de alguien que ya estaba en el CRM no crea una ficha nueva, así que esa llave tiene que llegar a la que
// existía. Lo hacen DOS caminos y los dos pasan por acá:
//   · el opt-in que choca con un duplicado y queda como propuesta: al confirmarla con «enriquecer»
//     (app/crm/revisar/[id]/acciones.ts, 17/10/2026);
//   · el opt-in cuyo email o teléfono coincide con UN solo lead, que desde el 14/11/2026 (d4d759ce5, la llamada con Julio)
//     se suma directo a esa ficha sin propuesta (app/api/track/optin/route.ts). Ese camino nació sin escribir la llave: la
//     persona que se volvía a registrar quedaba sin la grabación ni el tracking de esa visita.
//
// La atribución NO se pisa (su primer contacto es el que la trajo): sólo la llave de la visita, y sólo si la ficha no tenía
// una (`.is('visitor_id', null)`: dos dispositivos no se pisan). Corre ADENTRO de `runWithWorkspace`: `getTenantDb` le pone
// el negocio al update.
// =============================================================================

import 'server-only';
import { getTenantDb } from '@/lib/workspace';

export type VisitaAtada = { atada: boolean; error?: string };

/** Le pone a la ficha `leadId` la llave de la visita, sólo si no tenía una. Nunca tira: un error vuelve en `error`. */
export async function atarVisitaAlLead(leadId: number, visitorId: string | null | undefined): Promise<VisitaAtada> {
  const visita = typeof visitorId === 'string' ? visitorId.trim() : '';
  if (!visita || !Number.isFinite(leadId)) return { atada: false };
  try {
    const db = await getTenantDb();
    const { data, error } = await db.from('leads').update({ visitor_id: visita }).eq('id', leadId).is('visitor_id', null).select('id');
    if (error) return { atada: false, error: error.message };
    return { atada: Array.isArray(data) && data.length > 0 };
  } catch (e) {
    return { atada: false, error: e instanceof Error ? e.message : String(e) };
  }
}
