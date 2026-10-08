// =============================================================================
// Conector de Meta Ads (Graph API /insights)
// =============================================================================
// Responsabilidades:
//   1. fetchMetaInsights(fecha)        → llama Graph API, maneja paginación y
//                                        retries por rate limit, devuelve raw.
//   2. parseInsightsToMetrics(raw,fch) → transforma raw a la shape de la tabla.
//   3. upsertMetrics(metrics)          → escribe en marketing_metrics_daily.
//
// Errores tipados:
//   - MetaTokenError      → código 190 (token inválido/expirado)
//   - MetaRateLimitError  → código 17/4 tras agotar retries
//   - MetaApiError        → cualquier otro error de Meta
// =============================================================================

import { credWs } from './credenciales';
import { getTenantDb } from './workspace';
import { registrarMonedaMeta } from './moneda-meta';
import type { MarketingMetricRow, MetaInsightRaw, MetaAdsetRaw } from './types';

const GRAPH_BASE = 'https://graph.facebook.com';
const MAX_BACKOFF_ATTEMPTS = 5;
const MAX_PAGES = 50;
const PAGE_SIZE = 100;

// ─────────────────────────────────────────────────────────────────────────────
// Errores
// ─────────────────────────────────────────────────────────────────────────────

export class MetaTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MetaTokenError';
  }
}

export class MetaRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MetaRateLimitError';
  }
}

export class MetaApiError extends Error {
  constructor(
    message: string,
    public code?: number,
    public subcode?: number,
  ) {
    super(message);
    this.name = 'MetaApiError';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers internos
// ─────────────────────────────────────────────────────────────────────────────

async function getEnv(name: string): Promise<string> {
  const v = name === 'META_API_VERSION' ? process.env[name] : await credWs(name);
  if (!v || v.startsWith('PENDING')) {
    throw new Error(`Env var ${name} no definida (o aún con placeholder)`);
  }
  return v;
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function findActionValue(
  actions: Array<{ action_type: string; value: string }> | undefined,
  type: string,
): number | null {
  if (!actions) return null;
  const found = actions.find((a) => a.action_type === type);
  return found ? toNum(found.value) : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch (con paginación y backoff)
// ─────────────────────────────────────────────────────────────────────────────

type MetaPageResponse = {
  data?: MetaInsightRaw[];
  paging?: { next?: string };
  error?: {
    message: string;
    code?: number;
    error_subcode?: number;
    type?: string;
  };
};

async function fetchPageWithBackoff(
  url: string,
  attempt = 0,
): Promise<MetaPageResponse> {
  const res = await fetch(url, { method: 'GET' });

  let body: MetaPageResponse;
  try {
    body = (await res.json()) as MetaPageResponse;
  } catch {
    throw new MetaApiError(`Respuesta no-JSON de Meta (HTTP ${res.status})`);
  }

  if (body.error) {
    const { code, error_subcode, message } = body.error;
    if (code === 190) {
      throw new MetaTokenError(`Token Meta inválido o expirado: ${message}`);
    }
    if (code === 17 && error_subcode === 4) {
      if (attempt >= MAX_BACKOFF_ATTEMPTS) {
        throw new MetaRateLimitError(
          `Rate limit excedido tras ${MAX_BACKOFF_ATTEMPTS} intentos: ${message}`,
        );
      }
      const wait = 1000 * 2 ** attempt; // 1s, 2s, 4s, 8s, 16s
      console.warn(
        `[meta] rate limit, esperando ${wait}ms (intento ${attempt + 1})`,
      );
      await sleep(wait);
      return fetchPageWithBackoff(url, attempt + 1);
    }
    throw new MetaApiError(`Meta API error: ${message}`, code, error_subcode);
  }

  if (!res.ok) {
    throw new MetaApiError(`HTTP ${res.status} de Meta sin error body`);
  }

  return body;
}

/**
 * Llama Meta Insights y devuelve TODOS los insights del día especificado
 * (un objeto por adset del Ad Account configurado). Maneja paginación
 * automática y retries por rate limit.
 *
 * @param fecha 'YYYY-MM-DD' — Meta devuelve todo el día completo.
 */
export async function fetchMetaInsights(
  fecha: string,
): Promise<MetaInsightRaw[]> {
  const adAccountId = await getEnv('META_AD_ACCOUNT_ID');
  const apiVersion = await getEnv('META_API_VERSION');
  const token = await getEnv('META_ACCESS_TOKEN');

  const fields = [
    // En qué moneda viene `spend`: la de la CUENTA, que no siempre es MXN (ws13, ws14 y
    // ws15 cobran en USD). Se guarda acá, en el mismo pedido de siempre, para que todo
    // gasto en la base tenga su moneda conocida (lib/moneda-meta.ts).
    'account_currency',
    'adset_id',
    'adset_name',
    'campaign_id',
    'campaign_name',
    'account_id',
    'ad_id',
    'ad_name',
    'impressions',
    'reach',
    'frequency',
    'clicks',
    'inline_link_clicks',
    'ctr',
    'cpc',
    'cpm',
    'spend',
    'actions',
    'cost_per_action_type',
    // Métricas de video (Fase 1 v2) — vienen como arrays {action_type, value};
    // se toma el action_type 'video_view'
    'video_thruplay_watched_actions',
    'video_p25_watched_actions',
    'video_p50_watched_actions',
    'video_p75_watched_actions',
    'video_p100_watched_actions',
    'video_avg_time_watched_actions',
  ].join(',');

  const url = new URL(`${GRAPH_BASE}/${apiVersion}/${adAccountId}/insights`);
  url.searchParams.set('level', 'ad');
  url.searchParams.set('fields', fields);
  url.searchParams.set('action_breakdowns', 'action_type');
  url.searchParams.set(
    'time_range',
    JSON.stringify({ since: fecha, until: fecha }),
  );
  url.searchParams.set('limit', String(PAGE_SIZE));
  url.searchParams.set('access_token', token);

  const all: MetaInsightRaw[] = [];
  let nextUrl: string | null = url.toString();
  let pages = 0;

  while (nextUrl) {
    if (++pages > MAX_PAGES) {
      throw new MetaApiError(`Demasiadas páginas (>${MAX_PAGES})`);
    }
    const page = await fetchPageWithBackoff(nextUrl);
    if (Array.isArray(page.data)) all.push(...page.data);
    nextUrl = page.paging?.next ?? null;
  }

  // Best-effort: si no se puede guardar, el lector se la pregunta a Meta después.
  await registrarMonedaMeta(all.find((r) => r.account_currency)?.account_currency, adAccountId);
  return all;
}

// ─────────────────────────────────────────────────────────────────────────────
// Parse: raw → shape de la tabla
// ─────────────────────────────────────────────────────────────────────────────

export function parseInsightsToMetrics(
  insights: MetaInsightRaw[],
  fecha: string,
): MarketingMetricRow[] {
  return insights.map((ins): MarketingMetricRow => {
    const landingPageViews = findActionValue(ins.actions, 'landing_page_view');
    const pageViews = findActionValue(ins.actions, 'page_view');
    const costPerLPV = findActionValue(
      ins.cost_per_action_type,
      'landing_page_view',
    );

    // Leads del instant form: action_type 'lead'; si no existe, el agrupado
    // onsite_conversion.lead_grouped. NUNCA sumar ambos — es el mismo evento
    // contado dos veces.
    const leadsDirect = findActionValue(ins.actions, 'lead');
    const leadsGrouped = findActionValue(
      ins.actions,
      'onsite_conversion.lead_grouped',
    );
    const leadsCount = leadsDirect ?? leadsGrouped;

    // Agendas según Meta: conversión personalizada "Programaciones".
    const agendasMeta = findActionValue(ins.actions, 'offsite_conversion.fb_pixel_custom');

    // Video: las *_watched_actions vienen como arrays {action_type, value};
    // el valor real está bajo action_type 'video_view'
    const video3s = findActionValue(ins.actions, 'video_view');
    const videoThruplay = findActionValue(
      ins.video_thruplay_watched_actions,
      'video_view',
    );
    const videoP25 = findActionValue(ins.video_p25_watched_actions, 'video_view');
    const videoP50 = findActionValue(ins.video_p50_watched_actions, 'video_view');
    const videoP75 = findActionValue(ins.video_p75_watched_actions, 'video_view');
    const videoP100 = findActionValue(ins.video_p100_watched_actions, 'video_view');
    const videoAvgWatch = findActionValue(
      ins.video_avg_time_watched_actions,
      'video_view',
    );

    return {
      fecha,
      plataforma: 'meta',

      ad_account_id: ins.account_id ?? null,
      campaign_id: ins.campaign_id ?? null,
      campaign_name: ins.campaign_name ?? null,
      adset_id: ins.adset_id ?? null,
      adset_name: ins.adset_name ?? null,
      ad_id: ins.ad_id ?? null,
      ad_name: ins.ad_name ?? null,

      leads_count: leadsCount,
      agendas_meta: agendasMeta,
      video_3s_views: video3s,
      video_thruplay: videoThruplay,
      video_p25: videoP25,
      video_p50: videoP50,
      video_p75: videoP75,
      video_p100: videoP100,
      video_avg_watch_seconds: videoAvgWatch,

      impressions: toNum(ins.impressions),
      reach: toNum(ins.reach),
      frequency: toNum(ins.frequency),
      clicks: toNum(ins.clicks),
      link_clicks: toNum(ins.inline_link_clicks),
      ctr: toNum(ins.ctr),
      cpc: toNum(ins.cpc),
      cpm: toNum(ins.cpm),
      spend: toNum(ins.spend),

      landing_page_views: landingPageViews,
      page_views: pageViews,
      cost_per_landing_page_view: costPerLPV,

      youtube_video_id: null,
      youtube_video_type: null,
      youtube_views: null,
      youtube_minutes_watched: null,
      youtube_avg_view_duration: null,

      // Creativo (0022): se rellenan después con applyCreatives (fetchAdCreatives).
      ad_thumbnail_url: null,
      ad_permalink: null,
      ad_creative_sin_enlace: null,

      raw_payload: ins as unknown as Record<string, unknown>,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Creativos: miniatura + permalink por anuncio (0022)
// ─────────────────────────────────────────────────────────────────────────────

export type CreativeInfo = {
  thumbnail_url: string | null;
  permalink: string | null;
  sin_enlace: boolean;
};

type CreativeResponse = {
  creative?: {
    thumbnail_url?: string;
    image_url?: string;
    effective_object_story_id?: string;
    instagram_permalink_url?: string;
    object_story_spec?: {
      video_data?: { image_url?: string };
      link_data?: { picture?: string };
      photo_data?: { url?: string };
    };
    asset_feed_spec?: {
      images?: Array<{ url?: string }>;
      videos?: Array<{ thumbnail_url?: string }>;
    };
  };
  error?: { message: string; code?: number };
};

// Resolución del thumbnail pedida a Meta cuando solo hay thumbnail_url (respaldo).
const THUMB_SIZE = 1080;

/**
 * Elige la imagen de MAYOR resolución disponible para el anuncio.
 * Orden: la imagen del video (endpoint /ads/image, full-res) → imagen del
 * creativo → picture del link → foto → assets dinámicos → thumbnail_url (que
 * pedimos a 1080 como último recurso). El thumbnail_url crudo de Meta es ~64px
 * y se ve borroso; los primeros campos son de resolución completa.
 */
function bestImage(c: NonNullable<CreativeResponse['creative']>): string | null {
  return (
    c.object_story_spec?.video_data?.image_url ??
    c.image_url ??
    c.object_story_spec?.link_data?.picture ??
    c.object_story_spec?.photo_data?.url ??
    c.asset_feed_spec?.images?.[0]?.url ??
    c.asset_feed_spec?.videos?.[0]?.thumbnail_url ??
    c.thumbnail_url ??
    null
  );
}

/**
 * Trae el creativo (miniatura + permalink) de cada ad_id, UNA vez por anuncio.
 * - thumbnail: la imagen de mayor resolución disponible (ver bestImage).
 * - permalink: instagram_permalink_url; si no, https://www.facebook.com/{story_id};
 *   si no hay ninguno (stories / Audience Network / DCO) → null + sin_enlace.
 * - se refresca siempre (las URLs de Meta expiran).
 * Falla suave por anuncio: si una llamada falla, loguea y sigue.
 */
export async function fetchAdCreatives(adIds: string[]): Promise<Map<string, CreativeInfo>> {
  const out = new Map<string, CreativeInfo>();
  const unique = [...new Set(adIds.filter(Boolean))];
  if (unique.length === 0) return out;

  const apiVersion = await getEnv('META_API_VERSION');
  const token = await getEnv('META_ACCESS_TOKEN');

  const fields =
    'creative{thumbnail_url,image_url,effective_object_story_id,instagram_permalink_url,' +
    'object_story_spec{video_data{image_url},link_data{picture},photo_data{url}},' +
    'asset_feed_spec{images{url},videos{thumbnail_url}}}';

  // Traemos los creativos en PARALELO por chunks: baja el tiempo de N·t a ~(N/CHUNK)·t
  // sin dispararle a Meta todas las llamadas de golpe (respeta el rate limit).
  const CHUNK = 10;
  const fetchOne = async (adId: string): Promise<void> => {
    try {
      const url = new URL(`${GRAPH_BASE}/${apiVersion}/${adId}`);
      url.searchParams.set('fields', fields);
      url.searchParams.set('thumbnail_width', String(THUMB_SIZE));
      url.searchParams.set('thumbnail_height', String(THUMB_SIZE));
      url.searchParams.set('access_token', token);

      const res = await fetch(url.toString(), { method: 'GET' });
      const body = (await res.json()) as CreativeResponse;
      if (body.error) {
        console.warn(`[meta] creative ${adId}: ${body.error.message}`);
        return;
      }
      const c = body.creative;
      const thumbnail_url = c ? bestImage(c) : null;
      let permalink: string | null = null;
      if (c?.instagram_permalink_url) permalink = c.instagram_permalink_url;
      else if (c?.effective_object_story_id) permalink = `https://www.facebook.com/${c.effective_object_story_id}`;
      out.set(adId, { thumbnail_url, permalink, sin_enlace: permalink === null });
    } catch (err) {
      console.warn(`[meta] creative ${adId} falló: ${err instanceof Error ? err.message : String(err)}`);
    }
  };
  for (let i = 0; i < unique.length; i += CHUNK) {
    await Promise.all(unique.slice(i, i + CHUNK).map(fetchOne));
  }
  return out;
}

/** Aplica los creativos traídos sobre las filas de métricas (in place). */
export function applyCreatives(metrics: MarketingMetricRow[], creatives: Map<string, CreativeInfo>): void {
  for (const m of metrics) {
    if (!m.ad_id) continue;
    const c = creatives.get(m.ad_id);
    if (!c) continue;
    m.ad_thumbnail_url = c.thumbnail_url;
    m.ad_permalink = c.permalink;
    m.ad_creative_sin_enlace = c.sin_enlace;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Upsert: escribe en Supabase
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reemplaza atómicamente las filas Meta del día indicado por el batch nuevo.
 *
 * Estrategia: DELETE + INSERT (en vez de UPSERT) porque nuestro UNIQUE INDEX
 * usa expresiones COALESCE, y supabase-js no acepta onConflict con índices
 * de expresión. La ventana de "no hay datos" durante el cron es de milisegundos
 * y solo afecta lecturas dashboard durante esa fracción de segundo (aceptable
 * para un cron diario sin escritores concurrentes).
 *
 * @returns número de filas insertadas
 */
export async function upsertMetrics(
  metrics: MarketingMetricRow[],
): Promise<number> {
  if (metrics.length === 0) return 0;

  const fecha = metrics[0].fecha;
  if (!metrics.every((m) => m.fecha === fecha)) {
    throw new Error('upsertMetrics: todas las filas deben tener la misma fecha');
  }
  if (!metrics.every((m) => m.plataforma === 'meta')) {
    throw new Error('upsertMetrics: este path solo acepta plataforma=meta');
  }

  const supabase = await getTenantDb();

  // 1) Borra TODAS las filas Meta de ese día. Si un adset desapareció de Meta,
  //    también desaparece de la DB (queremos reflejar el estado actual del
  //    Ad Account, no acumular fantasmas).
  const { error: delError } = await supabase
    .from('marketing_metrics_daily')
    .delete()
    .eq('fecha', fecha)
    .eq('plataforma', 'meta');

  if (delError) {
    throw new Error(`Error borrando filas previas: ${delError.message}`);
  }

  // 2) Insert del batch nuevo.
  const { data, error } = await supabase
    .from('marketing_metrics_daily')
    .insert(metrics)
    .select('id');

  if (error) {
    throw new Error(`Error insertando metrics: ${error.message}`);
  }

  return data?.length ?? 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Presupuestos diarios de adsets (Fase 1 v2 — señal de RITMO de Recon)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Trae los adsets del Ad Account con su presupuesto diario y los upsertea en
 * adset_budget_daily para la fecha indicada.
 *
 * Meta solo expone el valor ACTUAL del presupuesto — no hay histórico, por
 * eso este snapshot diario es la única forma de construir la serie. El budget
 * se guarda en MXN crudo (daily_budget llega en CENTAVOS de MXN: /100).
 *
 * @returns número de adsets guardados
 */
export async function fetchAdsetBudgets(fecha: string): Promise<number> {
  const adAccountId = await getEnv('META_AD_ACCOUNT_ID');
  const apiVersion = await getEnv('META_API_VERSION');
  const token = await getEnv('META_ACCESS_TOKEN');

  const url = new URL(`${GRAPH_BASE}/${apiVersion}/${adAccountId}/adsets`);
  url.searchParams.set('fields', 'id,name,daily_budget,status,effective_status');
  url.searchParams.set('limit', String(PAGE_SIZE));
  url.searchParams.set('access_token', token);

  type AdsetsPage = {
    data?: MetaAdsetRaw[];
    paging?: { next?: string };
    error?: { message: string; code?: number; error_subcode?: number };
  };

  const all: MetaAdsetRaw[] = [];
  let nextUrl: string | null = url.toString();
  let pages = 0;

  while (nextUrl) {
    if (++pages > MAX_PAGES) {
      throw new MetaApiError(`Demasiadas páginas de adsets (>${MAX_PAGES})`);
    }
    const page = (await fetchPageWithBackoff(nextUrl)) as AdsetsPage;
    if (Array.isArray(page.data)) all.push(...page.data);
    nextUrl = page.paging?.next ?? null;
  }

  const rows = all
    .filter((a) => a.id)
    .map((a) => ({
      fecha,
      adset_id: a.id!,
      adset_name: a.name ?? null,
      // daily_budget viene en centavos de MXN. Adsets sin budget propio
      // (budget a nivel campaña / CBO) no traen el campo → NULL.
      daily_budget_mxn:
        a.daily_budget !== undefined && a.daily_budget !== null
          ? Number(a.daily_budget) / 100
          : null,
      status: a.effective_status ?? a.status ?? null,
    }));

  if (rows.length === 0) return 0;

  const supabase = await getTenantDb();
  // PK (workspace_id, fecha, adset_id) → upsert directo es idempotente por workspace
  const { error } = await supabase
    .from('adset_budget_daily')
    .upsert(rows, { onConflict: 'workspace_id,fecha,adset_id' });
  if (error) {
    throw new Error(`Error upserteando adset budgets: ${error.message}`);
  }

  return rows.length;
}
