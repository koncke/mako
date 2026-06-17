// =============================================================================
// GET /api/pendientes-count — total de pendientes para el badge del tab (Fase G)
// =============================================================================
// Lo consume DashboardTabs (cliente) para mostrar cuántas cosas hay por hacer
// sin que cada página tenga que calcularlo. Si falla, devuelve 0 (el badge
// simplemente no aparece).

import { getPendientesBadge } from '@/lib/queries';
import { hoyEnTijuana } from '@/lib/date-utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const total = await getPendientesBadge(hoyEnTijuana());
    return Response.json({ total });
  } catch (err) {
    console.error('[pendientes-count]', err instanceof Error ? err.message : err);
    return Response.json({ total: 0 });
  }
}
