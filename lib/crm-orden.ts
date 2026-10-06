import 'server-only';

// =============================================================================
// crm-orden — el orden manual de las columnas del kanban del CRM (mig 0200)
// =============================================================================
// «Cuando se hace esto, es como poner un "ORDENAMIENTO" dentro de filtros... normalmente se
// ordena por orden de llegada» (Martín, 06/10/2026). Arrastrar una tarjeta guarda la columna
// ENTERA en el orden en que quedó; la pantalla la ordena con `ordenarManual`
// (app/customer-success/orden-manual.ts, la misma pieza que Customer Success).
//
// La escritura vive en app/crm/orden-actions.ts. Acá sólo la lectura, que la pide la página.

import { getTenantDb } from '@/lib/workspace';

/** etapa → lead_ids, en el orden en que se arrastraron. */
export type OrdenManualCrm = Record<string, number[]>;

/**
 * El orden manual del embudo que se está mirando (`funnelId` null = el del negocio, igual
 * que `leads.funnel_id`).
 *
 * Nunca tira: sin la lectura, cada columna va por fecha de llegada, que es lo que había antes
 * de que existiera el orden manual — de menos, nunca algo inventado.
 */
export async function leerOrdenManual(funnelId: number | null): Promise<OrdenManualCrm> {
  try {
    const db = await getTenantDb();
    const q = db.from('lead_orden').select('etapa, lead_ids');
    const { data, error } = await (funnelId == null ? q.is('funnel_id', null) : q.eq('funnel_id', funnelId));
    if (error) throw new Error(error.message);
    const out: OrdenManualCrm = {};
    for (const f of (data ?? []) as Array<{ etapa: string; lead_ids: Array<number | string> | null }>) {
      const ids = (f.lead_ids ?? []).map(Number).filter((n) => Number.isFinite(n) && n > 0);
      if (ids.length) out[f.etapa] = ids;
    }
    return out;
  } catch (e) {
    console.warn('[crm] no pude leer el orden manual de las columnas:', e instanceof Error ? e.message : e);
    return {};
  }
}
