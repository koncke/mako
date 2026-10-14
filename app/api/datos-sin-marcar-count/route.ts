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

/**
 * Una fila de «A revisar». Desde el 13/10/2026 es UN DATO de un lead (Martín: el desplegable con
 * «solucionar» e «ignorar» por dato, «Todo esto también afecta al desplegable que aparece en el CRM
 * debajo a la derecha de "A revisar"»). Lo que no es un dato —una nutrición manual vencida— va
 * como una fila del lead, sin `paso`: se abre la ficha y no se puede ignorar desde acá.
 */
type Fila = { lead_id: number; lead_nombre: string; mensaje: string; paso?: { id: string; label: string } };

export async function GET(req: Request) {
  try {
    const { total, items, ignorados } = await getPendientesDeMarcar(hoyEnTijuana());
    // `?lista=1`: también los primeros, para resolverlos SIN IR A OTRA TAB (tercer feedback del
    // 12/10/2026, punto 4: «A revisar» abre la ficha en el lugar). Sin el parámetro, el conteo
    // de siempre: lo pide el Sidebar en cada página y no necesita nombres.
    if (new URL(req.url).searchParams.get('lista') === '1') {
      const filas: Fila[] = [];
      for (const i of items ?? []) {
        if (filas.length >= TOPE_LISTA) break;
        if (!i.faltantes?.length) { filas.push({ lead_id: i.lead_id, lead_nombre: i.lead_nombre, mensaje: i.mensaje }); continue; }
        for (const f of i.faltantes) {
          if (filas.length >= TOPE_LISTA) break;
          filas.push({ lead_id: i.lead_id, lead_nombre: i.lead_nombre, mensaje: f.label, paso: { id: f.id, label: f.label } });
        }
      }
      const ocultos = (ignorados ?? []).slice(0, TOPE_LISTA)
        .map((x) => ({ lead_id: x.lead_id, lead_nombre: x.lead_nombre, paso: { id: x.paso.id, label: x.paso.label } }));
      return Response.json({ total, items: filas, ignorados: ocultos });
    }
    return Response.json({ total });
  } catch (err) {
    console.error('[datos-sin-marcar-count]', err instanceof Error ? err.message : err);
    return Response.json({ total: 0 });
  }
}
