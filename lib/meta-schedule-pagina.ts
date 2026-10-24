// =============================================================================
// meta-schedule-pagina — ¿en qué página agendó esta persona? (para no repetirle el Schedule a Meta)
// =============================================================================
// El webhook de Calendly sabe QUIÉN reservó y, si la página le pasó el visitante en `utm_term`, de qué visita venía. Lo
// que no sabe es la PÁGINA, y la necesita para preguntarle al analizador si esa página ya dispara su propio
// `fbq('track','Schedule')` sin id (lib/meta-capi-payload.ts, `repiteScheduleDeLaPagina`). Pedido de Martín (24/10/2026):
// el Schedule de un cliente se contaba dos veces.
//
// Se lee el último `agendo` del Pixel de ese visitante y, si todavía no llegó (el beacon y el webhook salen en el mismo
// segundo), su última visita. Sin ninguno de los dos, null: «no sé», y MaKo manda como siempre.
// =============================================================================

import 'server-only';
import { getTenantDb } from './workspace';

/** Sin query ni hash: el snapshot del analizador se guarda por página, y una `?name=…` no es otra página. */
const sinQuery = (u: string | null | undefined): string | null => {
  if (!u) return null;
  try { const x = new URL(u); return `${x.origin}${x.pathname}`; } catch { return null; }
};

export async function paginaDeAgenda(visitorId: string): Promise<string | null> {
  const db = await getTenantDb();
  const { data: agendo } = await db.from('vsl_events').select('landing_url')
    .eq('visitor_id', visitorId).eq('tipo_evento', 'agendo').not('landing_url', 'is', null)
    .order('created_at', { ascending: false }).limit(1);
  const deAgendo = sinQuery((agendo as Array<{ landing_url: string | null }> | null)?.[0]?.landing_url);
  if (deAgendo) return deAgendo;
  const { data: visita } = await db.from('landing_visits').select('landing_url')
    .eq('visitor_id', visitorId).not('landing_url', 'is', null)
    .order('created_at', { ascending: false }).limit(1);
  return sinQuery((visita as Array<{ landing_url: string | null }> | null)?.[0]?.landing_url);
}
