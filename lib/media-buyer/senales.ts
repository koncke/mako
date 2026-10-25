// =============================================================================
// Media Buyer — la parte PURA de la lectura de una cuenta (sin red ni base: la prueban los tests)
// =============================================================================
// Las ventanas, cómo se juntan las métricas de Meta con la cohorte del CRM por anuncio, cómo se traduce el árbol de
// Zernio y cómo se escriben los montos. Lo que habla con Meta, Zernio y la base es lib/media-buyer/datos.ts.
// =============================================================================

import type { ConversorGasto } from '@/lib/presupuesto-cambio';
import type { NodoMB, SenalMB } from './motor';

// Lo mínimo que necesita del árbol de Zernio (lib/zernio-ads.ts → ZCampaign), escrito acá para no importar un módulo
// `server-only` desde código puro.
type ZBudget = { amount?: number; type?: string } | null | undefined;
type ZAdP = { platformAdId?: string; name?: string; status?: string; configuredStatus?: string | null; platformCreatedAt?: string | null; creativeType?: string | null; creative?: { thumbnailUrl?: string | null; imageUrl?: string | null } };
type ZAdSetP = { platformAdSetId?: string; adSetName?: string; status?: string; createdTime?: string | null; adSetBudget?: ZBudget; ads?: ZAdP[] };
export type ZCampaignP = { platformCampaignId?: string; campaignName?: string; status?: string; platformCampaignStatus?: string | null; createdTime?: string | null; campaignBudget?: ZBudget; budgetLevel?: 'campaign' | 'adset' | null; adSets?: ZAdSetP[] };

/** YYYY-MM-DD menos n días (calendario, sin husos: las fechas ya son del día de Tijuana). */
export function diasAntes(fecha: string, n: number): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Las tres ventanas, terminando AYER. */
export function ventanas(hoy: string): { corta: [string, string]; larga: [string, string]; crm: [string, string] } {
  const ayer = diasAntes(hoy, 1);
  return { corta: [diasAntes(hoy, 3), ayer], larga: [diasAntes(hoy, 7), ayer], crm: [diasAntes(hoy, 14), ayer] };
}

// ── Las filas que se agregan (puras, exportadas para el test) ────────────────

export type FilaMetrica = { fecha: string; ad_id: string; spend: number | null; leads_count: number | null; agendas_meta: number | null; impressions: number | null; frequency: number | null; video_3s_views: number | null; ad_thumbnail_url?: string | null };
export type FilaLeadAd = { meta_ad_id: string | null; created_at: string | null; fecha_junta_1: string | null; estado_lead: string | null; total_cobrado_usd: number | null };

/**
 * Junta las métricas de Meta y la cohorte del CRM por anuncio para UNA ventana [desde, hasta].
 * `aUnidad` pasa el gasto de la moneda de la cuenta a la unidad de decidir (dólares si convierte).
 */
export function senalesDeVentana(metricas: FilaMetrica[], leads: FilaLeadAd[], desde: string, hasta: string, aUnidad: (m: number) => number): SenalMB[] {
  const por = new Map<string, SenalMB & { _dias: Set<string>; _freq: number[]; _ultima: string }>();
  const de = (id: string) => {
    let s = por.get(id);
    if (!s) {
      s = { adId: id, gasto: 0, leadsMeta: 0, leadsCrm: 0, agendasMeta: 0, agendasCrm: 0, cierres: 0, caja: 0, impresiones: 0, frecuencia: null, diasCorriendo: 0, esVideo: false, miniatura: null, _dias: new Set(), _freq: [], _ultima: '' };
      por.set(id, s);
    }
    return s;
  };
  for (const r of metricas) {
    if (!r.ad_id || r.fecha < desde || r.fecha > hasta) continue;
    const s = de(r.ad_id);
    const sp = Number(r.spend ?? 0);
    s.gasto += aUnidad(sp);
    s.leadsMeta += Number(r.leads_count ?? 0);
    s.agendasMeta += Number(r.agendas_meta ?? 0);
    s.impresiones += Number(r.impressions ?? 0);
    if (r.frequency) s._freq.push(Number(r.frequency));
    if (Number(r.video_3s_views ?? 0) > 0) s.esVideo = true;
    if (sp > 0) s._dias.add(r.fecha);
    if (r.fecha >= s._ultima) { s._ultima = r.fecha; s.miniatura = r.ad_thumbnail_url ?? s.miniatura; }
  }
  for (const l of leads) {
    if (!l.meta_ad_id) continue;
    const entro = (l.created_at ?? '').slice(0, 10);
    if (!entro || entro < desde || entro > hasta) continue;
    const s = de(l.meta_ad_id);
    s.leadsCrm += 1;
    if (l.fecha_junta_1) s.agendasCrm += 1;
    if (l.estado_lead === 'ganado') s.cierres += 1;
    s.caja += Number(l.total_cobrado_usd ?? 0);
  }
  return [...por.values()].map(({ _dias, _freq, _ultima, ...s }) => ({
    ...s,
    gasto: Math.round(s.gasto * 100) / 100,
    diasCorriendo: _dias.size,
    frecuencia: _freq.length ? _freq.reduce((a, b) => a + b, 0) / _freq.length : null,
  }));
}

/**
 * El árbol de Zernio, traducido. ⚠️ Zernio no trae el interruptor PROPIO de una campaña ni de un conjunto: trae la
 * entrega (Meta `effective_status` en la campaña, un estado derivado de los anuncios en el conjunto). Se toma la
 * entrega como interruptor: un conjunto que no entrega por cualquier motivo se trata como apagado, y el motor no lo
 * toca. Errar para el lado de no tocar es lo seguro.
 */
export function arbolDesdeZernio(campanas: ZCampaignP[]): { arbol: NodoMB[]; metricas: FilaMetrica[] } {
  const arbol: NodoMB[] = [];
  const metricas: FilaMetrica[] = [];
  const sw = (s: string | null | undefined): string | null => (s ? (s.toUpperCase() === 'ACTIVE' ? 'ACTIVE' : 'PAUSED') : null);
  for (const c of campanas) {
    if (!c.platformCampaignId) continue;
    const cbo = c.budgetLevel === 'campaign';
    arbol.push({
      id: c.platformCampaignId, nombre: c.campaignName ?? c.platformCampaignId, nivel: 'campaign', parentId: null,
      configurado: sw(c.platformCampaignStatus ?? c.status), entrega: (c.platformCampaignStatus ?? c.status ?? '').toUpperCase(),
      presupuestoDia: cbo && c.campaignBudget?.type === 'daily' ? Number(c.campaignBudget.amount ?? 0) || null : null,
      nivelPresupuesto: c.budgetLevel ?? null, creada: c.createdTime ?? null,
    });
    for (const s of c.adSets ?? []) {
      if (!s.platformAdSetId) continue;
      arbol.push({
        id: s.platformAdSetId, nombre: s.adSetName ?? s.platformAdSetId, nivel: 'adset', parentId: c.platformCampaignId,
        configurado: sw(s.status), entrega: (s.status ?? '').toUpperCase(),
        presupuestoDia: !cbo && s.adSetBudget?.type === 'daily' ? Number(s.adSetBudget.amount ?? 0) || null : null,
        nivelPresupuesto: c.budgetLevel ?? null, creada: s.createdTime ?? null,
      });
      for (const a of s.ads ?? []) {
        if (!a.platformAdId) continue;
        arbol.push({
          id: a.platformAdId, nombre: a.name ?? a.platformAdId, nivel: 'ad', parentId: s.platformAdSetId,
          configurado: a.configuredStatus ? a.configuredStatus.toUpperCase() : sw(a.status), entrega: (a.status ?? '').toUpperCase(),
          presupuestoDia: null, nivelPresupuesto: c.budgetLevel ?? null, creada: a.platformCreatedAt ?? null,
        });
        const diario = (a as { daily?: Array<{ date?: string; spend?: number; impressions?: number; conversions?: number }> }).daily ?? [];
        for (const d of diario) {
          if (!d.date) continue;
          metricas.push({
            fecha: d.date.slice(0, 10), ad_id: a.platformAdId, spend: d.spend ?? 0, leads_count: d.conversions ?? 0, agendas_meta: 0,
            impressions: d.impressions ?? 0, frequency: null, video_3s_views: (a.creativeType ?? '').toLowerCase().includes('video') ? 1 : 0,
            ad_thumbnail_url: a.creative?.thumbnailUrl ?? a.creative?.imageUrl ?? null,
          });
        }
      }
    }
  }
  return { arbol, metricas };
}

/** Cómo se escribe un monto en la unidad del gasto: «US$ 12» si la cuenta convierte a dólares, si no en su moneda. */
export function fmtUnidad(datos: { conversor: ConversorGasto; moneda: string | null }): (u: number) => string {
  const convierte = datos.conversor.moneda != null && datos.conversor.aUsd(1) != null;
  const n = (u: number) => u.toLocaleString('es-MX', { maximumFractionDigits: 2 });
  return (u) => (convierte ? `US$ ${n(u)}` : `${n(u)} ${datos.moneda ?? ''}`.trim());
}

/**
 * El presupuesto diario más chico que propone el agente, en la moneda de la cuenta. Meta pide alrededor de US$1 por día
 * por conjunto; el piso es US$5 para que «bajar» nunca deje algo que casi no entrega.
 */
export function presupuestoMinimoCuenta(datos: { conversor: ConversorGasto }): number {
  const uno = datos.conversor.aUsdNum(1);
  return uno > 0 ? Math.ceil(5 / uno) : 5;
}

