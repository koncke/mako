// =============================================================================
// GET /api/datos-sin-marcar-count — total de "datos sin marcar" para el badge
// del CRM (rediseño). Es el MISMO universo que la lista "Datos sin marcar"
// (getPendientesDeMarcar), no la cola de acción completa.
// =============================================================================

import { getPendientesDeMarcar } from '@/lib/queries';
import { hoyEnTijuana } from '@/lib/date-utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Cuántos dibuja «A revisar». La cola entera sigue en su vista (`/crm?pendientes=1`). */
const TOPE_LISTA = 12;

export async function GET(req: Request) {
  try {
    const { total, items } = await getPendientesDeMarcar(hoyEnTijuana());
    // `?lista=1`: también los primeros, para resolverlos SIN IR A OTRA TAB (tercer feedback del
    // 12/10/2026, punto 4: «A revisar» abre la ficha en el lugar). Sin el parámetro, el conteo
    // de siempre: lo pide el Sidebar en cada página y no necesita nombres.
    if (new URL(req.url).searchParams.get('lista') === '1') {
      const lista = (items ?? []).slice(0, TOPE_LISTA).map((i) => ({ lead_id: i.lead_id, lead_nombre: i.lead_nombre, mensaje: i.mensaje }));
      return Response.json({ total, items: lista });
    }
    return Response.json({ total });
  } catch (err) {
    console.error('[datos-sin-marcar-count]', err instanceof Error ? err.message : err);
    return Response.json({ total: 0 });
  }
}
