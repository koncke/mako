// =============================================================================
// funnels-elegidos-server — en qué funnel estaba cada lead, leído de la base
// =============================================================================
// La regla pura (y por qué no alcanza con la casa del lead) vive en lib/funnels-elegidos.ts. Acá está lo que la
// alimenta: la casa de cada lead (`leads.funnel_id`, NULL = el del negocio) y los funnels a los que se lo agregó
// (`lead_funnel`, mig 0207), con desde cuándo. Lo usan el avance de un OKR o un KPI (lib/objectives-fuentes.ts), el
// desglose del hero de /general (lib/vista-general.ts) y la dimensión «Producto» de los pagos del Dashboard
// (lib/graficos-datos.ts): los tres tienen que repartir un pago con la MISMA regla, o el número y su detalle no cuadran.
// =============================================================================

import 'server-only';
import { getTenantDb } from './workspace';
import { leerTodo } from './supabase-paginado';
import { idDelFunnelDefault } from './funnels';
import { casaReal } from './lead-funnel-reglas';
import { filtrarEnFunnels, type Agregado } from './funnels-elegidos';

/** Cuántos ids van en un `in (…)`: la lista viaja en la URL de PostgREST. */
const TANDA_IDS = 200;

/** La casa de cada uno de estos leads, cruda (`leads.funnel_id`, NULL = el del negocio). */
async function casasDe(leadIds: readonly number[]): Promise<Map<number, number | null>> {
  const db = await getTenantDb();
  const out = new Map<number, number | null>();
  for (let i = 0; i < leadIds.length; i += TANDA_IDS) {
    const tanda = leadIds.slice(i, i + TANDA_IDS);
    const filas = await leerTodo<{ id: number; funnel_id: number | null }>(db, 'leads', 'id, funnel_id', { orden: 'id', filtros: (q) => q.in('id', tanda) });
    for (const f of filas) out.set(Number(f.id), f.funnel_id == null ? null : Number(f.funnel_id));
  }
  return out;
}

export type Ubicacion = { casas: Map<number, number | null>; agregados: Map<number, Agregado[]> };

/**
 * Dónde está cada uno de estos leads: su casa (ya traducida: NULL → el id del funnel del negocio) y los funnels a los
 * que se lo agregó, con desde cuándo. `crudas` = las casas ya leídas (si quien llama ya leyó los leads). TIRA si falla.
 * ⚠️ `lead_funnel` se lee ENTERA (son pocas filas: 6 en toda la base el 17/10/2026) porque hace falta saber TODOS los
 * funnels de cada lead, no sólo los elegidos: uno agregado después a otro funnel deja de contar en el elegido.
 */
export async function ubicarLeads(leadIds: readonly number[], crudas: Map<number, number | null> | null = null): Promise<Ubicacion> {
  const db = await getTenantDb();
  const [casasCrudas, filasLF, def] = await Promise.all([
    crudas ?? casasDe(leadIds),
    leerTodo<{ id: number; lead_id: number; funnel_id: number; created_at: string }>(db, 'lead_funnel', 'id, lead_id, funnel_id, created_at', { orden: 'id' }),
    idDelFunnelDefault(),
  ]);
  // NULL en la casa es el funnel del negocio: sin saber cuál es, esos leads no se pueden repartir.
  if (def == null && [...casasCrudas.values()].some((c) => c == null)) throw new Error('no pude leer cuál es tu funnel principal');
  const casas = new Map<number, number | null>();
  for (const [lead, c] of casasCrudas) casas.set(lead, casaReal(c, def));
  const agregados = new Map<number, Agregado[]>();
  for (const f of filasLF) {
    const lista = agregados.get(Number(f.lead_id)) ?? [];
    lista.push({ funnel: Number(f.funnel_id), desde: f.created_at });
    agregados.set(Number(f.lead_id), lista);
  }
  return { casas, agregados };
}

/** Los ids de lead (únicos, reales) de una lista de hechos. */
export const idsDeLeads = (xs: readonly { lead: number | null | undefined }[]): number[] =>
  [...new Set(xs.map((x) => x.lead).filter((x): x is number => x != null && x > 0))];

/**
 * Los ítems de un desglose (un pago, un cierre: `leadId` + `fecha`) que caen en ESTOS funnels, con la misma regla
 * que el número de arriba —si no, el pop-up lista lo que el número no suma—. Vacío = todos, sin leer nada. TIRA si
 * falla: quien llama decide (el hero de /general esconde el desglose y deja el número).
 */
export async function filtrarPorFunnels<T extends { leadId?: number; fecha: string | null; funnel?: number | null }>(items: readonly T[], elegidos: readonly number[]): Promise<T[]> {
  if (!elegidos.length) return [...items];
  const hechos = items.map((x) => ({ lead: x.leadId ?? null, fecha: x.fecha }));
  const { casas, agregados } = await ubicarLeads(idsDeLeads(hechos));
  return filtrarEnFunnels(items, (x) => ({ lead: x.leadId, fecha: x.fecha, funnel: x.funnel }), elegidos, casas, agregados);
}
