'use server';

// =============================================================================
// Guardar el orden manual de una columna del kanban del CRM (mig 0200)
// =============================================================================
// «Cuando se hace esto, es como poner un "ORDENAMIENTO" dentro de filtros» (Martín,
// 06/10/2026). Arrastrar una tarjeta a un lugar de una columna guarda la columna ENTERA en
// el orden en que quedó. La lectura vive en lib/crm-orden.ts.
//
// ⚠️ EN UN ARCHIVO `'use server'` SÓLO SE EXPORTAN FUNCIONES ASYNC (AGENTS.md): un
// `export const` tipa perfecto y tira el build.

import { getTenantDb } from '@/lib/workspace';
import { listarFunnels, getFunnelDe, getPipelineStagesDefault } from '@/lib/funnels';

/** Tope de una columna. Una columna más larga que esto no se ordena a mano. */
const TOPE = 2000;

/**
 * Guarda la columna `etapa` del embudo `funnelId` (null = el del negocio) en el orden de
 * `leadIds`. Recibe la lista ENTERA y no un movimiento: con un buscador o un filtro puesto,
 * la pantalla manda también a los que esconde, y una lista no se puede desincronizar
 * consigo misma.
 *
 * ⚠️ SE GUARDAN SÓLO LOS LEADS DE ESTA CUENTA Y DE ESTE EMBUDO. La lista viaja desde el
 * navegador; un id ajeno no se escribe aunque la pantalla lo mande.
 */
export async function ordenarColumnaCrmAction(funnelId: number | null, etapa: string, leadIds: number[]): Promise<
  { ok: true } | { ok: false; error: string }
> {
  try {
    if (typeof etapa !== 'string' || !etapa.trim() || etapa.length > 80) return { ok: false, error: 'Falta la columna.' };
    // El embudo: null es el del negocio; uno que no es de esta cuenta, no existe. El del
    // negocio también tiene id, y si llega ése se guarda como null — así lo nombran los leads.
    let funnel: number | null = null;
    if (funnelId != null) {
      const funnels = await listarFunnels();
      const f = funnels.find((x) => x.id === Number(funnelId));
      if (!f) return { ok: false, error: 'Ese producto no es tuyo.' };
      funnel = f.esDefault ? null : f.id;
    }
    const etapas = funnel == null ? await getPipelineStagesDefault() : (await getFunnelDe(funnel)).stages;
    if (!etapas.some((s) => s.key === etapa)) return { ok: false, error: 'Esa columna ya no existe.' };

    const pedidos = [...new Set((Array.isArray(leadIds) ? leadIds : []).map(Number).filter((n) => Number.isFinite(n) && n > 0))].slice(0, TOPE);
    const db = await getTenantDb();
    let validos: number[] = [];
    if (pedidos.length) {
      const q = db.from('leads').select('id').in('id', pedidos);
      const { data, error } = await (funnel == null ? q.is('funnel_id', null) : q.eq('funnel_id', funnel));
      if (error) return { ok: false, error: error.message };
      const ok = new Set(((data ?? []) as Array<{ id: number | string }>).map((l) => Number(l.id)));
      validos = pedidos.filter((id) => ok.has(id));
    }
    const { error } = await db.from('lead_orden').upsert(
      [{ funnel_id: funnel, etapa, lead_ids: validos, updated_at: new Date().toISOString() }],
      { onConflict: 'workspace_id,funnel_id,etapa' },
    );
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo guardar el orden.' };
  }
}
