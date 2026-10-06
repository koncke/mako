// =============================================================================
// campana-traer — qué leads de una campaña hay que AGREGAR a un producto
// =============================================================================
// Lo que calcula el «traer» de app/crm/campanas-actions.ts. Vive acá y no en la acción
// para que se pueda ejercer contra la base sin una sesión de Next: la acción es la puerta
// (quién puede, qué producto), esto es el trabajo.
//
// ⚠️ DESDE EL 06/10/2026 TRAER ES AGREGAR, NO MOVER. Acá vivía `moverEnLote`, que
// reescribía `leads.funnel_id` y con eso SACABA al lead del producto donde estaba. Martín:
// «No se debe "Mover" se debe agregar al otro producto». La escritura ahora es
// `agregarLoteAProducto` (lib/lead-funnel.ts, mig 0207): una fila de `lead_funnel` por
// lead, en la etapa de entrada del destino, y la casa no se toca. `moverEnLote` se borró
// porque se quedó sin call sites; si vuelve a hacer falta mover una casa en lote, la regla
// de cómo se escribe el producto del negocio está en `casaParaEscribir`.
//
// La regla de QUÉ leads se agregan es pura y vive en lib/campana-atribucion.ts.
// =============================================================================

import 'server-only';
import { getTenantDb } from './workspace';
import { leerTodo } from './supabase-paginado';
import { idDelFunnelDefault } from './funnels';
import { casaParaEscribir } from './lead-funnel-reglas';
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

/**
 * Los leads que YA están en un producto por una FILA de `lead_funnel` (no por su casa).
 *
 * ⚠️ «No pude leer» NO es «no hay ninguno»: con un `[]` por una lectura caída, la previa
 * contaría como nuevos a los que ya están y la pregunta diría un número de más. Tira, y la
 * acción lo dice. (El alta en sí no depende de esto: `agregarLoteAProducto` vuelve a
 * mirar las filas antes de escribir.)
 */
async function agregadosDe(funnelIdReal: number): Promise<Set<number>> {
  const db = await getTenantDb();
  const filas = await leerTodo<{ lead_id: number | string }>(db, 'lead_funnel', 'id, lead_id', {
    orden: 'id',
    filtros: (q) => q.eq('funnel_id', funnelIdReal),
  });
  return new Set(filas.map((f) => Number(f.lead_id)));
}

/** Qué leads se agregarían al asignar `item` a `destino`, con la configuración `asignadas`.
 *  Lo calcula el SERVER siempre: la pantalla manda qué campaña, nunca una lista de ids. */
export async function planDeTraida(
  destino: number | null,
  item: { tipo: 'campana' | 'conjunto'; id: string },
  asignadas: CampanaAsignada[],
): Promise<LeadAtribuible[]> {
  return (await planDeTraidaLote(destino, [item], asignadas)).get(item.id) ?? [];
}

/**
 * El plan para VARIAS campañas o conjuntos a la vez (la barra de lote de la tabla), con
 * una sola lectura de leads y métricas. Cada lead queda en UN grupo: ver `repartirPorItem`.
 *
 * `destino` va como lo escribe el CRM: `null` = el producto del negocio. Las filas de
 * `lead_funnel`, en cambio, lo guardan con su id REAL, así que acá se traducen los dos
 * lados: el `funnel_id` de cada lead pasa por `casaParaEscribir` (un lead con el id del
 * default escrito —el bug que esa función cierra— es del negocio, no de «otro producto») y
 * las filas se buscan con el id real.
 */
export async function planDeTraidaLote(
  destino: number | null,
  items: { tipo: 'campana' | 'conjunto'; id: string }[],
  asignadas: CampanaAsignada[],
): Promise<Map<string, LeadAtribuible[]>> {
  const [{ leads, anuncios }, defaultId] = await Promise.all([leadsYMetricas(), idDelFunnelDefault()]);
  const destinoReal = destino ?? defaultId;
  const enDestino = destinoReal == null ? new Set<number>() : await agregadosDe(destinoReal);
  const normalizados = leads.map((l) => ({
    ...l,
    funnel_id: casaParaEscribir(l.funnel_id == null ? null : Number(l.funnel_id), defaultId),
  }));
  const conjuntosDeOtro = new Set(
    asignadas.filter((a) => a.tipo === 'conjunto' && a.funnelId !== destino).map((a) => a.id),
  );
  return repartirPorItem(items, destino, normalizados, anuncios, conjuntosDeOtro, enDestino);
}
