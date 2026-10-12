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
import { listarFunnels, getFunnelDe, getPipelineStagesDefault, idDelFunnelDefault } from '@/lib/funnels';

/** Tope de una columna. Una columna más larga que esto no se ordena a mano. */
const TOPE = 2000;

/**
 * De a cuántos ids se valida. PostgREST corta cada respuesta en 1000 filas SIN avisar, y una
 * columna puede pasarlas (la de entrada del ws1 tuvo 1.057): validando la columna entera de
 * una vez, los que caían después de la fila 1000 salían del orden guardado en silencio y
 * volvían al final. Con tandas de 500 ninguna respuesta llega al techo.
 */
const TANDA = 500;

/**
 * Guarda la columna `etapa` del embudo `funnelId` (null = el del negocio) en el orden de
 * `leadIds`. Recibe la lista ENTERA y no un movimiento: con un buscador o un filtro puesto,
 * la pantalla manda también a los que esconde, y una lista no se puede desincronizar
 * consigo misma.
 *
 * ⚠️ SE GUARDAN SÓLO LOS LEADS DE ESTA CUENTA Y DE ESTE EMBUDO. La lista viaja desde el
 * navegador; un id ajeno no se escribe aunque la pantalla lo mande.
 *
 * ⚠️ Y «DE ESTE EMBUDO» SON DOS COSAS desde la mig 0207: los que tienen aquí su CASA
 * (`leads.funnel_id`, NULL para el del negocio) y los AGREGADOS (una fila de `lead_funnel`
 * con el id de este embudo — el del negocio va ahí con su id real, no NULL). El tablero
 * dibuja a los dos (`listLeadsDeFunnel`); validando sólo la casa, cada agregado se caía del
 * orden guardado sin un error y su tarjeta volvía al final al recargar.
 */
export async function ordenarColumnaCrmAction(funnelId: number | null, etapa: string, leadIds: number[]): Promise<
  { ok: true } | { ok: false; error: string }
> {
  try {
    if (typeof etapa !== 'string' || !etapa.trim() || etapa.length > 80) return { ok: false, error: 'Falta la columna.' };
    // El embudo: null es el del negocio; uno que no es de esta cuenta, no existe. El del
    // negocio también tiene id, y si llega ése se guarda como null — así lo nombran los leads.
    let funnel: number | null = null;
    // El id REAL del embudo, que es como lo nombra `lead_funnel` (también el del negocio).
    let idReal: number | null = null;
    if (funnelId != null) {
      const funnels = await listarFunnels();
      const f = funnels.find((x) => x.id === Number(funnelId));
      if (!f) return { ok: false, error: 'Ese funnel no es tuyo.' };
      funnel = f.esDefault ? null : f.id;
      idReal = f.id;
    } else {
      idReal = await idDelFunnelDefault();
    }
    const etapas = funnel == null ? await getPipelineStagesDefault() : (await getFunnelDe(funnel)).stages;
    if (!etapas.some((s) => s.key === etapa)) return { ok: false, error: 'Esa columna ya no existe.' };

    const pedidos = [...new Set((Array.isArray(leadIds) ? leadIds : []).map(Number).filter((n) => Number.isFinite(n) && n > 0))].slice(0, TOPE);
    const db = await getTenantDb();
    const ok = new Set<number>();
    for (let i = 0; i < pedidos.length; i += TANDA) {
      const tanda = pedidos.slice(i, i + TANDA);
      // Los que tienen aquí su casa.
      const q = db.from('leads').select('id').in('id', tanda);
      const { data, error } = await (funnel == null ? q.is('funnel_id', null) : q.eq('funnel_id', funnel));
      if (error) return { ok: false, error: error.message };
      for (const l of (data ?? []) as Array<{ id: number | string }>) ok.add(Number(l.id));
      // Y los agregados. Sin el id real del embudo (no se pudo leer el del negocio) no hay a
      // quién preguntarle: quedan afuera, que es lo que pasaba antes — de menos, nunca ajenos.
      if (idReal == null) continue;
      const ag = await db.from('lead_funnel').select('lead_id').eq('funnel_id', idReal).in('lead_id', tanda);
      if (ag.error) return { ok: false, error: ag.error.message };
      for (const f of (ag.data ?? []) as Array<{ lead_id: number | string }>) ok.add(Number(f.lead_id));
    }
    const validos = pedidos.filter((id) => ok.has(id));
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
