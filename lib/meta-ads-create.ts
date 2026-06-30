// =============================================================================
// meta-ads-create — ESCRITURAS de creación en Meta Ads (campañas/conjuntos/anuncios)
// =============================================================================
// A diferencia de /api/meta-write (edita status/budget/name de entidades que ya
// existen) y de meta-ads.ts (solo LEE insights/creativos), este lib CREA el árbol
// nuevo en Meta: campaña → conjunto(s) → anuncio(s) + creativo, y sube imágenes /
// videos. TODO se crea en status PAUSED (se activa después con el toggle de la
// tabla). Reusa las convenciones de la cuenta: env vars (META_ACCESS_TOKEN /
// META_AD_ACCOUNT_ID ya como act_<id> / META_API_VERSION), montos en CENTAVOS de
// MXN, y el patrón crítico: Meta manda errores (incl. subcode 4841013 "Permisos")
// con HTTP 200, así que SIEMPRE miramos body.error, nunca res.ok.
// =============================================================================

import 'server-only';
import { META_PAGE_ID } from './config';
import {
  type CampaignSpec,
  type AdSetSpec,
  type AdSpec,
  type Creative,
  type Targeting,
  type Objective,
  objetivoDef,
} from './campaign-types';

const GRAPH_BASE = 'https://graph.facebook.com';

// Bucket de Supabase Storage donde el navegador stagea los creativos antes de Meta.
export const ADS_CREATIVES_BUCKET = 'ads-creatives';

// ─────────────────────────────────────────────────────────────────────────────
// Creds + error tipado
// ─────────────────────────────────────────────────────────────────────────────

function getEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.startsWith('PENDING')) {
    throw new Error(`Env var ${name} no definida (o con placeholder)`);
  }
  return v;
}

function ver(): string { return getEnv('META_API_VERSION'); }
function acct(): string { return getEnv('META_AD_ACCOUNT_ID'); } // ya viene como act_<id>
function token(): string { return getEnv('META_ACCESS_TOKEN'); }

function sleep(ms: number): Promise<void> { return new Promise((r) => setTimeout(r, ms)); }

/** Error de escritura en Meta con code/subcode para mapear el envelope HTTP. */
export class MetaWriteError extends Error {
  constructor(message: string, public code?: number, public subcode?: number) {
    super(message);
    this.name = 'MetaWriteError';
  }
}

/** Mapea cualquier error a la respuesta JSON que el cliente ya entiende. */
export function metaErrorEnvelope(err: unknown): {
  ok: false; message: string; code?: number; error_subcode?: number; status: number;
} {
  if (err instanceof MetaWriteError) {
    // subcode 4841013 ("Permissions error") o code 200 → 403 (lo distingue la UI).
    const status = err.subcode === 4841013 || err.code === 200 ? 403 : 502;
    return { ok: false, message: err.message, code: err.code, error_subcode: err.subcode, status };
  }
  const message = err instanceof Error ? err.message : String(err);
  return { ok: false, message, status: 500 };
}

// POST form-urlencoded a una edge de la cuenta; inspecciona body.error (HTTP 200).
async function graphPost(path: string, params: Record<string, string | number | undefined>): Promise<Record<string, unknown>> {
  const body = new URLSearchParams();
  for (const [k, val] of Object.entries(params)) {
    if (val === undefined || val === null || val === '') continue;
    body.set(k, String(val));
  }
  body.set('access_token', token());
  const res = await fetch(`${GRAPH_BASE}/${ver()}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    cache: 'no-store',
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: { code?: number; error_subcode?: number; message?: string } };
  if (data && data.error) {
    const e = data.error;
    throw new MetaWriteError(e.message ?? 'Meta rechazó la escritura', e.code, e.error_subcode);
  }
  if (!res.ok) throw new MetaWriteError(`HTTP ${res.status} de Meta sin error body`);
  return data;
}

// GET con inspección de body.error (para leer creativos de ganadores / formularios).
async function graphGet(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, { cache: 'no-store' });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: { code?: number; error_subcode?: number; message?: string } };
  if (data && data.error) {
    const e = data.error;
    throw new MetaWriteError(e.message ?? 'Meta rechazó la lectura', e.code, e.error_subcode);
  }
  if (!res.ok) throw new MetaWriteError(`HTTP ${res.status} de Meta sin error body`);
  return data;
}

const mxnACentavos = (mxn: number): number => Math.round(mxn * 100);

// ─────────────────────────────────────────────────────────────────────────────
// Segmentación: nuestro Targeting → spec de Meta
// ─────────────────────────────────────────────────────────────────────────────

const clampAge = (n: number): number => Math.min(65, Math.max(13, Math.round(n)));

function cleanGeo(g: NonNullable<Targeting['geo_locations']>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (g.countries?.length) out.countries = g.countries.map((c) => c.toUpperCase());
  if (g.regions?.length) out.regions = g.regions.map((r) => ({ key: r.key }));
  if (g.cities?.length) out.cities = g.cities.map((c) => ({ key: c.key, radius: c.radius ?? 17, distance_unit: c.distance_unit ?? 'kilometer' }));
  return out;
}

/** Construye el targeting de Meta a partir del nuestro (con defaults sanos). */
export function buildTargeting(t: Targeting): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  out.geo_locations = t.geo_locations && (t.geo_locations.countries?.length || t.geo_locations.regions?.length || t.geo_locations.cities?.length)
    ? cleanGeo(t.geo_locations)
    : { countries: ['MX'] }; // default: México
  if (t.excluded_geo_locations) {
    const eg = cleanGeo(t.excluded_geo_locations);
    if (Object.keys(eg).length) out.excluded_geo_locations = eg;
  }
  if (t.age_min) out.age_min = clampAge(t.age_min);
  if (t.age_max) out.age_max = clampAge(t.age_max);
  if (t.genders?.length) out.genders = t.genders;
  if (t.flexible_spec?.length) {
    const fs = t.flexible_spec
      .map((g) => ({ interests: (g.interests ?? []).filter((i) => i?.id).map((i) => ({ id: i.id, name: i.name })) }))
      .filter((g) => g.interests.length);
    if (fs.length) out.flexible_spec = fs;
  }
  if (t.custom_audiences?.length) out.custom_audiences = t.custom_audiences.filter((a) => a?.id).map((a) => ({ id: a.id }));
  if (t.excluded_custom_audiences?.length) out.excluded_custom_audiences = t.excluded_custom_audiences.filter((a) => a?.id).map((a) => ({ id: a.id }));
  if (t.publisher_platforms?.length) out.publisher_platforms = t.publisher_platforms;
  if (t.facebook_positions?.length) out.facebook_positions = t.facebook_positions;
  if (t.instagram_positions?.length) out.instagram_positions = t.instagram_positions;
  if (t.locales?.length) out.locales = t.locales;
  if (t.advantage_audience !== undefined) out.targeting_automation = { advantage_audience: t.advantage_audience };
  return out;
}

// promoted_object según el objetivo / meta de optimización.
function buildPromotedObject(objective: Objective, optimizationGoal: string): Record<string, string> | null {
  if (optimizationGoal === 'LEAD_GENERATION') {
    return { page_id: META_PAGE_ID }; // formulario instantáneo (el form va en el creativo)
  }
  if (optimizationGoal === 'OFFSITE_CONVERSIONS') {
    const pixel = process.env.META_PIXEL_ID;
    if (!pixel) return null; // sin pixel no podemos optimizar por conversión web
    const def = objetivoDef(objective);
    return { pixel_id: pixel, custom_event_type: def.custom_event_type ?? 'LEAD' };
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Creativo: nuestro Creative → object_story_spec de Meta
// ─────────────────────────────────────────────────────────────────────────────

export function buildObjectStorySpec(c: Creative): Record<string, unknown> {
  const hasLeadForm = !!c.lead_form_id;
  const ctaType = c.cta_type && c.cta_type !== 'NO_BUTTON' ? c.cta_type : null;

  // Video
  if (c.media_type === 'video' && c.video_id) {
    const video_data: Record<string, unknown> = { video_id: c.video_id, message: c.primary_text ?? '' };
    if (c.headline) video_data.title = c.headline;
    if (c.description) video_data.link_description = c.description;
    if (c.thumbnail_url) video_data.image_url = c.thumbnail_url;
    if (hasLeadForm) {
      video_data.call_to_action = { type: ctaType ?? 'SIGN_UP', value: { lead_gen_form_id: c.lead_form_id, link: c.destination_url || undefined } };
    } else if (c.destination_url) {
      video_data.call_to_action = { type: ctaType ?? 'LEARN_MORE', value: { link: c.destination_url } };
    }
    return { page_id: META_PAGE_ID, video_data };
  }

  // Imagen (o sin media subida todavía → link puro con la imagen del enlace)
  const link_data: Record<string, unknown> = { message: c.primary_text ?? '', link: c.destination_url ?? '' };
  if (c.headline) link_data.name = c.headline;
  if (c.description) link_data.description = c.description;
  if (c.image_hash) link_data.image_hash = c.image_hash;
  if (hasLeadForm) {
    link_data.call_to_action = { type: ctaType ?? 'SIGN_UP', value: { lead_gen_form_id: c.lead_form_id, link: c.destination_url || undefined } };
  } else if (ctaType && c.destination_url) {
    link_data.call_to_action = { type: ctaType, value: { link: c.destination_url } };
  }
  return { page_id: META_PAGE_ID, link_data };
}

// ─────────────────────────────────────────────────────────────────────────────
// Lecturas auxiliares (reusar ganadores, formularios instantáneos)
// ─────────────────────────────────────────────────────────────────────────────

/** object_story_id del post de un anuncio existente (para reusar su creativo). */
export async function getObjectStoryId(adId: string): Promise<string | null> {
  const url = new URL(`${GRAPH_BASE}/${ver()}/${adId}`);
  url.searchParams.set('fields', 'creative{effective_object_story_id,object_story_id}');
  url.searchParams.set('access_token', token());
  const data = await graphGet(url.toString());
  const creative = data.creative as { effective_object_story_id?: string; object_story_id?: string } | undefined;
  return creative?.effective_object_story_id ?? creative?.object_story_id ?? null;
}

/** Formularios instantáneos ya existentes en la página (para lead ads). */
export async function listLeadForms(): Promise<Array<{ id: string; name: string; status?: string }>> {
  const url = new URL(`${GRAPH_BASE}/${ver()}/${META_PAGE_ID}/leadgen_forms`);
  url.searchParams.set('fields', 'id,name,status');
  url.searchParams.set('limit', '100');
  url.searchParams.set('access_token', token());
  const data = await graphGet(url.toString());
  const arr = Array.isArray(data.data) ? (data.data as Array<Record<string, unknown>>) : [];
  return arr.map((f) => ({ id: String(f.id), name: String(f.name ?? f.id), status: f.status ? String(f.status) : undefined }));
}

/** Públicos personalizados de la cuenta (para retargeting: incluir / excluir). */
export async function listCustomAudiences(): Promise<Array<{ id: string; name: string; subtype?: string; count?: number | null }>> {
  const url = new URL(`${GRAPH_BASE}/${ver()}/${acct()}/customaudiences`);
  url.searchParams.set('fields', 'id,name,subtype,approximate_count');
  url.searchParams.set('limit', '200');
  url.searchParams.set('access_token', token());
  const data = await graphGet(url.toString());
  const arr = Array.isArray(data.data) ? (data.data as Array<Record<string, unknown>>) : [];
  return arr.map((a) => ({ id: String(a.id), name: String(a.name ?? a.id), subtype: a.subtype ? String(a.subtype) : undefined, count: a.approximate_count != null ? Number(a.approximate_count) : null }));
}

/** Busca intereses por texto → ids reales que Meta acepta en el targeting. */
export async function searchInterests(q: string): Promise<Array<{ id: string; name: string; audience?: number | null; topic?: string | null }>> {
  if (!q.trim()) return [];
  const url = new URL(`${GRAPH_BASE}/${ver()}/search`);
  url.searchParams.set('type', 'adinterest');
  url.searchParams.set('q', q.trim());
  url.searchParams.set('limit', '20');
  url.searchParams.set('access_token', token());
  const data = await graphGet(url.toString());
  const arr = Array.isArray(data.data) ? (data.data as Array<Record<string, unknown>>) : [];
  return arr.map((i) => ({ id: String(i.id), name: String(i.name ?? ''), audience: i.audience_size_lower_bound != null ? Number(i.audience_size_lower_bound) : (i.audience_size != null ? Number(i.audience_size) : null), topic: i.topic ? String(i.topic) : null }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Subida de creativos (imagen / video)
// ─────────────────────────────────────────────────────────────────────────────

/** Sube una imagen a act_<id>/adimages → devuelve image_hash (+ url/medidas). */
export async function uploadAdImage(bytes: ArrayBuffer, filename: string): Promise<{ image_hash: string; url: string | null; width: number | null; height: number | null }> {
  const form = new FormData();
  form.append('access_token', token());
  form.append('filename', new Blob([bytes]), filename);
  const res = await fetch(`${GRAPH_BASE}/${ver()}/${acct()}/adimages`, { method: 'POST', body: form, cache: 'no-store' });
  const data = (await res.json().catch(() => ({}))) as { images?: Record<string, { hash?: string; url?: string; width?: number; height?: number }>; error?: { code?: number; error_subcode?: number; message?: string } };
  if (data.error) throw new MetaWriteError(data.error.message ?? 'Error subiendo imagen', data.error.code, data.error.error_subcode);
  const images = data.images ?? {};
  const first = Object.values(images)[0];
  if (!first?.hash) throw new MetaWriteError('Meta no devolvió image_hash');
  return { image_hash: first.hash, url: first.url ?? null, width: first.width ?? null, height: first.height ?? null };
}

/** Sube un video a act_<id>/advideos (multipart) → devuelve video_id. */
export async function uploadAdVideo(bytes: ArrayBuffer, filename: string, mime: string): Promise<{ video_id: string }> {
  const form = new FormData();
  form.append('access_token', token());
  form.append('name', filename);
  form.append('source', new Blob([bytes], { type: mime }), filename);
  const res = await fetch(`${GRAPH_BASE}/${ver()}/${acct()}/advideos`, { method: 'POST', body: form, cache: 'no-store' });
  const data = (await res.json().catch(() => ({}))) as { id?: string; error?: { code?: number; error_subcode?: number; message?: string } };
  if (data.error) throw new MetaWriteError(data.error.message ?? 'Error subiendo video', data.error.code, data.error.error_subcode);
  if (!data.id) throw new MetaWriteError('Meta no devolvió video_id');
  return { video_id: String(data.id) };
}

/**
 * Sube un video a act_<id>/advideos por URL: Meta DESCARGA el archivo del file_url
 * (así los bytes nunca pasan por nuestra función → esquivamos el límite de body
 * del serverless). El file_url debe ser accesible por Meta (URL firmada de storage).
 */
export async function uploadAdVideoByUrl(fileUrl: string, name: string): Promise<{ video_id: string }> {
  const data = await graphPost(`${acct()}/advideos`, { file_url: fileUrl, name });
  if (!data.id) throw new MetaWriteError('Meta no devolvió video_id');
  return { video_id: String(data.id) };
}

/**
 * Espera a que Meta termine de PROCESAR el video antes de usarlo en un creativo.
 * Devuelve 'ready' | 'error' | 'processing' (este último = timeout: seguimos,
 * Meta suele terminar en segundo plano y el anuncio queda igual en PAUSA).
 */
export async function waitForVideoReady(videoId: string, opts: { timeoutMs?: number; intervalMs?: number } = {}): Promise<'ready' | 'error' | 'processing'> {
  const timeout = opts.timeoutMs ?? 150000;
  const interval = opts.intervalMs ?? 4000;
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    const url = new URL(`${GRAPH_BASE}/${ver()}/${videoId}`);
    url.searchParams.set('fields', 'status');
    url.searchParams.set('access_token', token());
    const data = await graphGet(url.toString()).catch(() => ({} as Record<string, unknown>));
    const vs = (data.status as { video_status?: string } | undefined)?.video_status;
    if (vs === 'ready') return 'ready';
    if (vs === 'error') return 'error';
    await sleep(interval);
  }
  return 'processing';
}

// ─────────────────────────────────────────────────────────────────────────────
// Creación del árbol (todo en PAUSA)
// ─────────────────────────────────────────────────────────────────────────────

/** Crea la campaña (PAUSED). En CBO el presupuesto va acá. Devuelve campaign_id. */
export async function createCampaign(spec: CampaignSpec): Promise<string> {
  const params: Record<string, string | number | undefined> = {
    name: spec.name,
    objective: spec.objective,
    status: 'PAUSED',
    buying_type: 'AUCTION',
    special_ad_categories: JSON.stringify(spec.special_ad_categories ?? []),
  };
  if (spec.budget_level === 'campaign' && spec.daily_budget_mxn) {
    params.daily_budget = mxnACentavos(spec.daily_budget_mxn);
    params.bid_strategy = 'LOWEST_COST_WITHOUT_CAP'; // CBO exige estrategia a nivel campaña
  }
  const data = await graphPost(`${acct()}/campaigns`, params);
  return String(data.id);
}

/** Crea un conjunto (PAUSED) bajo la campaña. En ABO el presupuesto va acá. */
export async function createAdSet(campaignId: string, spec: CampaignSpec, adset: AdSetSpec): Promise<string> {
  const def = objetivoDef(spec.objective);
  const optimization = adset.optimization_goal || def.optimization_goal;
  const params: Record<string, string | number | undefined> = {
    name: adset.name,
    campaign_id: campaignId,
    status: 'PAUSED',
    billing_event: adset.billing_event || def.billing_event,
    optimization_goal: optimization,
    targeting: JSON.stringify(buildTargeting(adset.targeting)),
  };
  // ABO: presupuesto + estrategia de puja en el conjunto. CBO: viven en la campaña.
  if (spec.budget_level === 'adset') {
    if (adset.daily_budget_mxn) params.daily_budget = mxnACentavos(adset.daily_budget_mxn);
    params.bid_strategy = adset.bid_strategy || 'LOWEST_COST_WITHOUT_CAP';
  }
  const promoted = buildPromotedObject(spec.objective, optimization);
  if (promoted) params.promoted_object = JSON.stringify(promoted);
  const data = await graphPost(`${acct()}/adsets`, params);
  return String(data.id);
}

/** Crea el creativo (reusando el post de un ganador o armando uno nuevo). */
export async function createAdCreative(creative: Creative, adName: string): Promise<string> {
  if (creative.source === 'existing' && creative.source_ad_id) {
    const storyId = await getObjectStoryId(creative.source_ad_id);
    if (!storyId) throw new MetaWriteError('El anuncio ganador no tiene un post reutilizable (object_story_id). Probá con otro o subí un creativo.');
    const data = await graphPost(`${acct()}/adcreatives`, { name: `${adName} — creativo`, object_story_id: storyId });
    return String(data.id);
  }
  const oss = buildObjectStorySpec(creative);
  const data = await graphPost(`${acct()}/adcreatives`, { name: `${adName} — creativo`, object_story_spec: JSON.stringify(oss) });
  return String(data.id);
}

/** Crea el anuncio (PAUSED) ligado al conjunto y al creativo. */
export async function createAd(adsetId: string, ad: AdSpec, creativeId: string): Promise<string> {
  const data = await graphPost(`${acct()}/ads`, {
    name: ad.name,
    adset_id: adsetId,
    creative: JSON.stringify({ creative_id: creativeId }),
    status: 'PAUSED',
  });
  return String(data.id);
}

// ─────────────────────────────────────────────────────────────────────────────
// Previsualización (sin crear nada)
// ─────────────────────────────────────────────────────────────────────────────

// Formato → ad_format de Meta para generatepreviews.
export const PREVIEW_FORMATS: Array<{ key: string; label: string; ad_format: string }> = [
  { key: 'feed', label: 'Feed de móvil', ad_format: 'MOBILE_FEED_STANDARD' },
  { key: 'ig_feed', label: 'Feed de Instagram', ad_format: 'INSTAGRAM_STANDARD' },
  { key: 'story', label: 'Historias', ad_format: 'INSTAGRAM_STORY' },
  { key: 'reels', label: 'Reels', ad_format: 'FACEBOOK_REELS_MOBILE' },
];

/** Genera previsualizaciones (iframe HTML de Meta) sin crear el anuncio. */
export async function generatePreviews(creative: Creative, adFormats: string[]): Promise<Array<{ ad_format: string; body: string }>> {
  let creativeParam: string;
  if (creative.source === 'existing' && creative.source_ad_id) {
    const storyId = await getObjectStoryId(creative.source_ad_id);
    if (!storyId) throw new MetaWriteError('El anuncio ganador no tiene un post reutilizable para previsualizar.');
    creativeParam = JSON.stringify({ object_story_id: storyId });
  } else {
    creativeParam = JSON.stringify({ object_story_spec: buildObjectStorySpec(creative) });
  }
  const out: Array<{ ad_format: string; body: string }> = [];
  for (const f of adFormats) {
    try {
      const url = new URL(`${GRAPH_BASE}/${ver()}/${acct()}/generatepreviews`);
      url.searchParams.set('ad_format', f);
      url.searchParams.set('creative', creativeParam);
      url.searchParams.set('access_token', token());
      const data = await graphGet(url.toString());
      const body = (data.data as Array<{ body?: string }> | undefined)?.[0]?.body;
      if (body) out.push({ ad_format: f, body });
    } catch {
      // Algunos formatos no aplican al creativo (p.ej. video en formato imagen): se omiten.
    }
  }
  return out;
}
