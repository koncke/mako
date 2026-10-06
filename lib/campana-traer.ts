// =============================================================================
// campana-traer — traer al producto los leads que una campaña YA tiene en el CRM
// =============================================================================
// Lo que hace de verdad el «traer» de app/crm/campanas-actions.ts. Vive acá y no en la
// acción para que se pueda ejercer contra la base sin una sesión de Next: la acción es la
// puerta (quién puede, qué producto), esto es el trabajo.
//
// La regla de QUÉ leads se mueven es pura y vive en lib/campana-atribucion.ts.
// =============================================================================

import 'server-only';
import { getTenantDb } from './workspace';
import { leerTodo } from './supabase-paginado';
import type { CampanaAsignada } from './campana-config';
import {
  mapaDeAnuncios, repartirPorItem,
  type LeadAtribuible, type FilaConNombre, type Anuncio,
} from './campana-atribucion';

/** Lo que el cruce necesita, leído una vez. Las dos tablas crecen con el uso, así que van
 *  paginadas: el techo de 1000 de PostgREST no da error, devuelve 1000. */
export async function leadsYMetricas(): Promise<{ leads: LeadAtribuible[]; metricas: FilaConNombre[]; anuncios: Map<string, Anuncio> }> {
  const db = await getTenantDb();
  const [leads, metricas] = await Promise.all([
    leerTodo<LeadAtribuible>(db, 'leads', 'id, funnel_id, meta_campaign_id, adset_id_origen, meta_ad_id, utm_campaign, utm_content'),
    leerTodo<FilaConNombre>(db, 'marketing_metrics_daily', 'id, ad_id, campaign_id, campaign_name, adset_id, adset_name', {
      filtros: (q) => q.not('campaign_id', 'is', null),
    }),
  ]);
  return { leads, metricas, anuncios: mapaDeAnuncios(metricas) };
}

/** Qué leads se moverían al asignar `item` a `destino`, con la configuración `asignadas`.
 *  Lo calcula el SERVER siempre: la pantalla manda qué campaña, nunca una lista de ids. */
export async function planDeTraida(
  destino: number | null,
  item: { tipo: 'campana' | 'conjunto'; id: string },
  asignadas: CampanaAsignada[],
): Promise<LeadAtribuible[]> {
  return (await planDeTraidaLote(destino, [item], asignadas)).get(item.id) ?? [];
}

/** El plan para VARIAS campañas o conjuntos a la vez (la barra de lote de la tabla), con
 *  una sola lectura de leads y métricas. Cada lead queda en UN grupo: ver `repartirPorItem`. */
export async function planDeTraidaLote(
  destino: number | null,
  items: { tipo: 'campana' | 'conjunto'; id: string }[],
  asignadas: CampanaAsignada[],
): Promise<Map<string, LeadAtribuible[]>> {
  const { leads, anuncios } = await leadsYMetricas();
  const conjuntosDeOtro = new Set(
    asignadas.filter((a) => a.tipo === 'conjunto' && a.funnelId !== destino).map((a) => a.id),
  );
  return repartirPorItem(items, destino, leads, anuncios, conjuntosDeOtro);
}

const LOTE = 200;

/**
 * Mueve leads de producto EN LOTE y deja una línea en el historial de cada uno.
 *
 * ⚠️ SÓLO CAMBIA EL PRODUCTO, NO LA ETAPA — y es lo contrario de lo que hace
 * `moverLeadsAFunnelAction` (app/crm/actions.ts), a propósito. Aquélla trae a UNA persona
 * a empezar de cero en otro embudo, y por eso la pone en la entrada. Ésta trae la HISTORIA
 * de una campaña: un lead que ya pagó tiene que seguir en Ganado, no volver a «Lead
 * entrante». Si su etapa guardada no existe en el embudo nuevo, el tablero lo ubica por lo
 * que hizo y le pone el chip de «fuera del embudo» (app/crm/crm-map.ts): no se pierde nada.
 *
 * Devuelve los ids que la base CONFIRMÓ haber movido (`.select('id')`), no los pedidos: un
 * lead borrado en el medio no puede figurar como traído, ni volver en un deshacer.
 */
export async function moverEnLote(ids: number[], a: number | null, porQue: string): Promise<{ movidos: number[]; fallaron: number }> {
  const db = await getTenantDb();
  const movidos: number[] = [];
  let fallaron = 0;
  for (let i = 0; i < ids.length; i += LOTE) {
    const tanda = ids.slice(i, i + LOTE);
    const { data, error } = await db.from('leads').update({ funnel_id: a }).in('id', tanda).select('id');
    if (error) { fallaron += tanda.length; continue; }
    const ok = (data ?? []).map((r) => Number((r as { id: number | string }).id));
    movidos.push(...ok);
    fallaron += tanda.length - ok.length;
  }
  // El historial va en lote también: quinientas inserciones de a una son quinientos viajes.
  // Mismo formato que `logLeadEvent` (lib/leads.ts). Si falla, el movimiento ya pasó y no se
  // deshace por un renglón de historial.
  for (let i = 0; i < movidos.length; i += LOTE) {
    const filas = movidos.slice(i, i + LOTE).map((id) => ({
      lead_id: id, campo: 'Producto', valor_anterior: null, valor_nuevo: porQue, autor: 'CRM',
    }));
    const { error } = await db.from('lead_audit').insert(filas);
    if (error) console.error('[campanas] historial falló:', error.message);
  }
  return { movidos, fallaron };
}
