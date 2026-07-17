// =============================================================================
// Resolver un ad_id de Meta → la señal que necesita el detalle
// =============================================================================
// Compartido por las DOS puertas al detalle de un anuncio, para que las dos
// resuelvan idéntico:
//   /ads-manager/<ad_id>  → lo abre dentro de la tabla (CampanasBrowser)
//   /anuncio/<ad_id>      → la página del anuncio solo (AnuncioSolo)
//
// Las dos fuentes son distintas y complementarias, por eso el orden importa:
//   `senales` (Supabase)   = rendimiento del rango. Solo trae anuncios CON gasto.
//   `health.ads` (Meta)    = el árbol vivo. Trae TODOS, sin métricas.
// Un anuncio pausado o recién creado existe en el árbol y no en las señales: sin
// el fallback, su link no abriría nunca.
// =============================================================================

import type { SenalRecon } from '@/lib/queries';
import type { MetaHealth, NodoEstado } from '@/lib/meta-health-ui';
import type { ReconVeredicto, RitmoEstado } from '@/lib/queries';

/** Señal sintética para un anuncio sin gasto en el rango: existe, pero sin números. */
export function synthSenal(node: NodoEstado, campana: string | null, adset: string | null): SenalRecon {
  return {
    ad_id: node.id, ad_name: node.name, campana, adset_name: adset,
    spend_usd: 0, leads: 0, meta_leads: 0, dias_corriendo: 0,
    ritmo: 'sin_datos' as RitmoEstado, ritmo_dias: [], veredicto: 'explorando' as ReconVeredicto,
    agendas: 0, cierres: 0, cash_usd: 0, hook_rate: null, hold_rate: null, ctr_link: null,
    cpl_usd: null, frequency: null, impressions: 0, link_clicks: 0, cpm_usd: null, cpc_usd: null,
    ad_thumbnail_url: null, ad_permalink: null, ad_creative_sin_enlace: true,
  };
}

/**
 * El anuncio `adId`, con sus números si los tuvo. `null` = no existe en la cuenta
 * (id viejo, borrado en Meta, o de otra cuenta).
 */
export function resolverAd(adId: string, senales: SenalRecon[], health: MetaHealth | null): SenalRecon | null {
  const conGasto = senales.find((s) => s.ad_id === adId);
  if (conGasto) return conGasto;
  const node = (health?.ads ?? []).find((a) => a.id === adId);
  if (!node) return null;
  const adset = node.parentId ? (health?.adsets ?? []).find((a) => a.id === node.parentId) : undefined;
  const camp = adset?.parentId ? (health?.campaigns ?? []).find((c) => c.id === adset.parentId) : undefined;
  return synthSenal(node, camp?.name ?? null, adset?.name ?? null);
}
