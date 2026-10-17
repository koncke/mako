// =============================================================================
// El rendimiento por anuncio: lo que viene del CRM y el renglón que lee MaKo
// =============================================================================
// Puro (sin `server-only`): lo usan lib/queries.ts (`getSenalesRecon`) y la API de MaKo
// (`ver_rendimiento_anuncios`, lib/api-mako/areas/ads.run.ts), y lo prueba
// tests/ads-rendimiento-leads.test.ts sin base ni red.
//
// ⚠️ EL BUG QUE CIERRA (17/10/2026): la API devolvía `leads_meta` = 10 en TODOS los anuncios y
// `leads_crm` = los leads que reporta Meta. `SenalRecon.meta_leads` es la META de leads (la vara
// `RECON_LEADS_VALIDACION` con la que un anuncio se da por validado; las tarjetas la pintan
// «leads / meta»), no «los leads de Meta»; y `SenalRecon.leads` es `leads_count` de Meta, no el CRM.
// Un cliente que le preguntaba a MaKo por sus anuncios recibía un dato inventado.
// =============================================================================

/** Lo que el CRM sabe de los leads de un anuncio. */
export type BajadaCrm = { leads: number; agendas: number; cierres: number; cash: number };

export type FilaLeadCrm = {
  meta_ad_id: string | null;
  fecha_junta_1: string | null;
  estado_lead: string;
  total_cobrado_usd: number | null;
  created_at: string | null;
};

/**
 * Por anuncio: cuántos leads del CRM ENTRARON en [desde, hasta] (por `created_at`, la fecha UTC),
 * y de todos los que vinieron de él (de cualquier fecha) cuántos agendaron, cuántos se ganaron y
 * cuánto se cobró. Las fechas van como YYYY-MM-DD.
 */
export function bajadaCrmPorAnuncio(filas: readonly FilaLeadCrm[], desde: string, hasta: string): Map<string, BajadaCrm> {
  const out = new Map<string, BajadaCrm>();
  for (const l of filas) {
    if (!l.meta_ad_id) continue;
    const d = out.get(l.meta_ad_id) ?? { leads: 0, agendas: 0, cierres: 0, cash: 0 };
    const entro = (l.created_at ?? '').slice(0, 10);
    if (entro && entro >= desde && entro <= hasta) d.leads += 1;
    if (l.fecha_junta_1) d.agendas += 1;
    if (l.estado_lead === 'ganado') d.cierres += 1;
    d.cash += Number(l.total_cobrado_usd ?? 0);
    out.set(l.meta_ad_id, d);
  }
  return out;
}

/** Lo que `ver_rendimiento_anuncios` necesita de una señal (un subconjunto de `SenalRecon`). */
export type SenalParaFila = {
  ad_id: string; ad_name: string; campana: string | null; adset_name: string | null;
  spend_usd: number; leads: number; meta_leads: number; leads_crm?: number | null;
  agendas: number; cierres: number; cash_usd: number; dias_corriendo: number; veredicto: string;
  hook_rate: number | null; hold_rate: number | null; ctr_link: number | null; cpl_usd: number | null;
  cpm_usd: number | null; frequency: number | null; impressions: number;
};

const r2 = (n: number | null | undefined): number | null => (n == null || !Number.isFinite(n) ? null : Math.round(n * 100) / 100);

/** El renglón de un anuncio en `ver_rendimiento_anuncios`. Cada número dice de dónde sale. */
export function filaDeRendimiento(s: SenalParaFila) {
  return {
    ad_id: s.ad_id, anuncio: s.ad_name, campana: s.campana, conjunto: s.adset_name, gasto_usd: Math.round(s.spend_usd),
    leads_meta: s.leads,
    // Una entrada de la caché anterior al 17/10/2026 no trae el campo: se dice que no se sabe, no un cero.
    leads_crm: s.leads_crm ?? null,
    meta_leads_para_validar: s.meta_leads,
    agendas_meta: s.agendas, cierres: s.cierres, cash_usd: s.cash_usd,
    dias_corriendo: s.dias_corriendo, veredicto: s.veredicto, hook_rate_pct: r2(s.hook_rate), hold_rate_pct: r2(s.hold_rate),
    ctr_pct: r2(s.ctr_link), cpl_usd: r2(s.cpl_usd), cpm_usd: r2(s.cpm_usd), frecuencia: r2(s.frequency), impresiones: s.impressions,
  };
}
