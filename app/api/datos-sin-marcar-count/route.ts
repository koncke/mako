// =============================================================================
// GET /api/datos-sin-marcar-count — total de "datos sin marcar" para el badge
// del CRM (rediseño). Es el MISMO universo que la lista "Datos sin marcar"
// (getPendientesDeMarcar), no la cola de acción completa.
// =============================================================================

import { getPendientesDeMarcar } from '@/lib/queries';
import { hoyEnTijuana } from '@/lib/date-utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const { total } = await getPendientesDeMarcar(hoyEnTijuana());
    return Response.json({ total });
  } catch (err) {
    console.error('[datos-sin-marcar-count]', err instanceof Error ? err.message : err);
    return Response.json({ total: 0 });
  }
}
