// =============================================================================
// meta-ads-create — ESCRITURAS de creación en Meta Ads (campañas/conjuntos/anuncios)
// =============================================================================
// A diferencia de /api/meta-write (edita status/budget/name de entidades que ya
// existen) y de meta-ads.ts (solo LEE insights/creativos), este lib CREA el árbol
// nuevo en Meta: campaña → conjunto(s) → anuncio(s) + creativo, y sube imágenes /
// videos. TODO se crea en status PAUSED (se activa después con el toggle de la
// tabla). Montos en CENTAVOS de la moneda de la cuenta, y el patrón crítico: Meta
// manda errores (incl. subcode 4841013 "Permisos") con HTTP 200, así que SIEMPRE
// miramos body.error, nunca res.ok.
//
// CREDENCIALES (tarea #170): el token, la cuenta, la página y el pixel salen de
// `credWs` POR WORKSPACE — no de process.env. Cada cliente crea sobre SU cuenta de
// Meta y SU página. Si le falta una credencial, se apaga fail-closed y lo dice; no
// cae a la del dueño. La única excepción es META_API_VERSION, que no es un secreto.
// =============================================================================

import 'server-only';
import { META_PAGE_ID } from './config';
import { credWs } from './credenciales';
import { normalizarCuentaMeta } from './meta-cuenta-id';
import { paisDeCuentaMeta } from './meta-pais';
import { getWorkspaceActual, OWNER_WS } from './workspace';
import {
  type CampaignSpec,
  type AdSetSpec,
  type AdSpec,
  type Creative,
  type Targeting,
  type Objective,
  type BudgetLevel,
  objetivoDef,
} from './campaign-types';

const GRAPH_BASE = 'https://graph.facebook.com';

// Bucket de Supabase Storage donde el navegador stagea los creativos antes de Meta.
export const ADS_CREATIVES_BUCKET = 'ads-creatives';

// ─────────────────────────────────────────────────────────────────────────────
// Creds + error tipado
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El workspace sobre cuya cuenta de Meta se opera.
 *
 * El `?? OWNER_WS` NO es un fallback nuevo: es exactamente lo que hacía
 * assertCuentaDelDueno, que dejaba pasar `ws === null` a propósito («admin de
 * agencia sin impersonar: administra la cuenta del dueño»). Se preserva para que
 * el recableado sea no-op. El endurecimiento del null vive en el guard, que es el
 * único que sabe si detrás hay una sesión de AGENCIA.
 */
async function wsDeLaCuenta(): Promise<number> {
  return (await getWorkspaceActual()) ?? OWNER_WS;
}

/**
 * Una credencial de Meta del workspace en curso. Molde: lib/meta-ads.ts:58 y
 * lib/meta-health.ts:47, pero con el ws EXPLÍCITO.
 *
 * ⚠️ `credWs` va SIEMPRE con sus dos argumentos. La forma de un argumento pasa por
 * `wsDefault` (lib/credenciales.ts:110) y termina en `?? OWNER_WS`, que es Mauricio
 * —un CLIENTE, no la plataforma—. Las hermanas la usan con uno porque solo LEEN;
 * acá se CREA y se BORRA con plata de por medio.
 *
 * ⚠️ Y NO se usa `envCred`. lib/meta-write.ts:37 la usa y parece el precedente, pero
 * resuelve SIEMPRE contra OWNER_WS: copiarla compila, pasa los tests y deja el
 * archivo cableado al dueño justo después de haberle sacado el candado.
 */
async function cred(name: string): Promise<string> {
  const ws = await wsDeLaCuenta();
  // META_API_VERSION NO va por credWs: la fija instrumentation, no es un secreto y
  // NO está en el catálogo BYOK (lib/metodo-catalogo.ts:163-174 tiene las otras
  // seis) → por credWs daría null y apagaría Ads Manager para todos los clientes.
  const v = name === 'META_API_VERSION' ? process.env[name] : await credWs(name, ws);
  if (!v || v.startsWith('PENDING')) {
    throw new MetaWriteError(`${name} no está configurado para este workspace (Integraciones → Meta Ads).`);
  }
  // Las filas viejas pueden traer el id pelado: normaliza el guardado, no la base.
  return name === 'META_AD_ACCOUNT_ID' ? normalizarCuentaMeta(v) : v;
}

/**
 * El page id del workspace. El literal del dueño (lib/config.ts) SOLO para OWNER_WS.
 * Copia de lib/meta-leads.ts:125 sin su `|| ws == null`: allá es un cron de INGESTA
 * (leer de más es feo), acá se escribe y se borra. El fallback es MÁS DÉBIL que el
 * camino feliz: la base gana siempre.
 */
async function pageId(): Promise<string> {
  const ws = await wsDeLaCuenta();
  const p = (await credWs('META_PAGE_ID', ws)) ?? (ws === OWNER_WS ? META_PAGE_ID : null);
  if (!p) {
    throw new MetaWriteError(
      'META_PAGE_ID no está configurado para este workspace (Integraciones → Meta Ads → «ID de tu página de Facebook»).',
    );
  }
  return p;
}

/** null a propósito: buildPromotedObject ya degrada sin pixel.
 *  Se llama `pixelDelWs` y no `pixelId` porque listPixelEvents tiene un parámetro
 *  con ese nombre que la sombrearía. */
async function pixelDelWs(): Promise<string | null> {
  return credWs('META_PIXEL_ID', await wsDeLaCuenta());
}

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
/**
 * El CANDADO DE LA MINA (assertCuentaDelDueno) vivió acá hasta la tarea #170, y se
 * fue con ella. Gritaba si se llamaba a este lib desde un workspace que no fuera el
 * del dueño, porque el token, la cuenta y la página eran las de Mauricio para todos.
 * Ahora salen de `cred()` / `pageId()`, o sea de credWs por workspace, así que la
 * mina que el candado tapaba ya no existe: si al workspace le falta una credencial,
 * `cred()` tira fail-closed en vez de caer a la del dueño.
 *
 * Lo que NO cambió: quién puede entrar. Eso sigue siendo cosa del guard de las rutas
 * (lib/ads-guard.ts), que exige rol admin DEL workspace — sin eso, un closer o un
 * setter llega a borrar campañas con plata.
 */
async function graphPost(path: string, params: Record<string, string | number | undefined>): Promise<Record<string, unknown>> {
  // Hoisteadas: credWs no cachea (un SELECT por llamada) y resolverlas adentro del
  // armado sería una chance más de abortar a mitad de un árbol ya empezado.
  const [apiVersion, accessToken] = await Promise.all([cred('META_API_VERSION'), cred('META_ACCESS_TOKEN')]);
  const body = new URLSearchParams();
  for (const [k, val] of Object.entries(params)) {
    if (val === undefined || val === null || val === '') continue;
    body.set(k, String(val));
  }
  body.set('access_token', accessToken);
  const res = await fetch(`${GRAPH_BASE}/${apiVersion}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    cache: 'no-store',
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: { code?: number; error_subcode?: number; message?: string; error_user_title?: string; error_user_msg?: string } };
  if (data && data.error) {
    const e = data.error;
    // Meta esconde el motivo real en error_user_title/error_user_msg → lo mostramos.
    const msg = [e.error_user_title, e.error_user_msg].filter(Boolean).join(' — ') || e.message || 'Meta rechazó la escritura';
    throw new MetaWriteError(msg, e.code, e.error_subcode);
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

/**
 * Construye el targeting de Meta a partir del nuestro (con defaults sanos).
 *
 * `paisPorDefecto` es la red de contención cuando el spec llega sin geo: ISO-2 del
 * país DE LA CUENTA (lib/meta-pais.ts), nunca una constante. Acá había un
 * `{ countries: ['MX'] }` fijo y por eso una cuenta argentina publicaba en México:
 * el fallback no fallaba, entregaba — en el país equivocado, en silencio y con
 * plata puesta. Si tampoco hay país de cuenta se LANZA: un error que se lee es
 * mejor que una campaña que gasta donde nadie compra.
 */
export function buildTargeting(t: Targeting, paisPorDefecto?: string | null): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const tieneGeo = Boolean(t.geo_locations && (t.geo_locations.countries?.length || t.geo_locations.regions?.length || t.geo_locations.cities?.length));
  if (!tieneGeo && !paisPorDefecto) {
    throw new MetaWriteError('No sé en qué país mostrar estos anuncios: elige la ubicación antes de publicar.');
  }
  out.geo_locations = tieneGeo ? cleanGeo(t.geo_locations!) : { countries: [String(paisPorDefecto).toUpperCase()] };
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
  // v23+: al CREAR un conjunto con segmentación NO-default (intereses/edad/género/
  // públicos), Meta EXIGE targeting_automation.advantage_audience explícito (0 o 1).
  // Si el usuario afinó la segmentación y no definió advantage → 0 (respetar lo fino);
  // si no hay nada fino → 1 (Advantage+ amplio). Nunca lo dejamos sin setear.
  const hasFine = Boolean(t.age_min || t.age_max || t.genders?.length || t.flexible_spec?.some((g) => g.interests?.length) || t.custom_audiences?.length);
  const adv = t.advantage_audience !== undefined ? t.advantage_audience : (hasFine ? 0 : 1);
  out.targeting_automation = { advantage_audience: adv };
  return out;
}

// promoted_object según el objetivo / meta de optimización / conversión elegida.
async function buildPromotedObject(objective: Objective, optimizationGoal: string, conversion?: { pixel_event?: string; custom_conversion_id?: string; pixel_id?: string }): Promise<Record<string, string> | null> {
  if (optimizationGoal === 'LEAD_GENERATION') {
    return { page_id: await pageId() }; // formulario instantáneo (el form va en el creativo)
  }
  if (optimizationGoal === 'OFFSITE_CONVERSIONS') {
    // Conversión personalizada (ej. agenda/"Programaciones") → su id basta.
    if (conversion?.custom_conversion_id) return { custom_conversion_id: conversion.custom_conversion_id };
    // El pixel del WORKSPACE: con process.env acá, un cliente le atribuía SUS
    // conversiones al medidor de Mauricio y optimizaba la campaña contra él.
    const pixel = conversion?.pixel_id || (await pixelDelWs());
    if (!pixel) return null; // sin pixel no podemos optimizar por conversión web
    const def = objetivoDef(objective);
    // custom_event_type DEBE ser un enum de Meta (LEAD, SCHEDULE, PURCHASE, …), no el
    // nombre del evento del pixel. El cliente ya manda el enum.
    return { pixel_id: pixel, custom_event_type: conversion?.pixel_event || def.custom_event_type || 'LEAD' };
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Creativo: nuestro Creative → object_story_spec de Meta
// ─────────────────────────────────────────────────────────────────────────────

export async function buildObjectStorySpec(c: Creative): Promise<Record<string, unknown>> {
  const hasLeadForm = !!c.lead_form_id;
  const ctaType = c.cta_type && c.cta_type !== 'NO_BUTTON' ? c.cta_type : null;

  // Video
  if (c.media_type === 'video' && c.video_id) {
    const video_data: Record<string, unknown> = { video_id: c.video_id, message: c.primary_text ?? '' };
    if (c.headline) video_data.title = c.headline;
    if (c.description) video_data.link_description = c.description;
    // Miniatura del video: preferimos la CUSTOM (image_hash) para conservarla al
    // editar textos. Si no, image_url SOLO si es http(s) descargable por Meta (una
    // data:image/… local causa #3858258 y Threads la valida estricto). Sin ninguna,
    // la omitimos y Meta genera la miniatura automática del video (válida en todas).
    if (c.image_hash) video_data.image_hash = c.image_hash;
    else if (c.thumbnail_url && /^https?:\/\//i.test(c.thumbnail_url)) video_data.image_url = c.thumbnail_url;
    if (hasLeadForm) {
      video_data.call_to_action = { type: ctaType ?? 'SIGN_UP', value: { lead_gen_form_id: c.lead_form_id, link: c.destination_url || undefined } };
    } else if (c.destination_url) {
      video_data.call_to_action = { type: ctaType ?? 'LEARN_MORE', value: { link: c.destination_url } };
    }
    return { page_id: await pageId(), video_data };
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
  return { page_id: await pageId(), link_data };
}

// ─────────────────────────────────────────────────────────────────────────────
// Lecturas auxiliares (reusar ganadores, formularios instantáneos)
// ─────────────────────────────────────────────────────────────────────────────

/** object_story_id del post de un anuncio existente (para reusar su creativo). */
export async function getObjectStoryId(adId: string): Promise<string | null> {
  const [apiVersion, accessToken] = await Promise.all([cred('META_API_VERSION'), cred('META_ACCESS_TOKEN')]);
  const url = new URL(`${GRAPH_BASE}/${apiVersion}/${adId}`);
  url.searchParams.set('fields', 'creative{effective_object_story_id,object_story_id}');
  url.searchParams.set('access_token', accessToken);
  const data = await graphGet(url.toString());
  const creative = data.creative as { effective_object_story_id?: string; object_story_id?: string } | undefined;
  return creative?.effective_object_story_id ?? creative?.object_story_id ?? null;
}

/** Formularios instantáneos ya existentes en la página (para lead ads). */
export async function listLeadForms(): Promise<Array<{ id: string; name: string; status?: string }>> {
  const [apiVersion, accessToken, page] = await Promise.all([cred('META_API_VERSION'), cred('META_ACCESS_TOKEN'), pageId()]);
  const url = new URL(`${GRAPH_BASE}/${apiVersion}/${page}/leadgen_forms`);
  url.searchParams.set('fields', 'id,name,status');
  url.searchParams.set('limit', '100');
  url.searchParams.set('access_token', accessToken);
  const data = await graphGet(url.toString());
  const arr = Array.isArray(data.data) ? (data.data as Array<Record<string, unknown>>) : [];
  return arr.map((f) => ({ id: String(f.id), name: String(f.name ?? f.id), status: f.status ? String(f.status) : undefined }));
}

/** Públicos personalizados de la cuenta (para retargeting: incluir / excluir). */
/**
 * Datos de la cuenta publicitaria que la UI necesita para NO adivinar: la moneda
 * en la que Meta va a cobrar y el país por defecto de la segmentación.
 *
 * Sin esto, dos cosas se inventaban del lado del navegador: que la cuenta cobra en
 * MXN (y se multiplicaba el presupuesto por el tipo de cambio sobre cuentas en
 * dólares) y que el público está en México.
 */
export async function cuentaMeta(): Promise<{ accountId: string; name: string; currency: string; country: string | null; timezoneName: string | null }> {
  const [apiVersion, adAccountId, tk] = await Promise.all([cred('META_API_VERSION'), cred('META_AD_ACCOUNT_ID'), cred('META_ACCESS_TOKEN')]);
  const url = new URL(`${GRAPH_BASE}/${apiVersion}/${adAccountId}`);
  url.searchParams.set('fields', 'name,currency,timezone_name,business_country_code');
  url.searchParams.set('access_token', tk);
  const d = await graphGet(url.toString());
  return {
    accountId: adAccountId,
    name: String(d.name ?? ''),
    currency: String(d.currency ?? 'USD'),
    country: paisDeCuentaMeta(d),
    timezoneName: d.timezone_name != null ? String(d.timezone_name) : null,
  };
}

/**
 * Países que Meta acepta en geo_locations, con su nombre en español — los suyos,
 * no una lista nuestra que se desactualiza. 247 filas, una sola llamada.
 *
 * ⚠️ SIN caché de módulo, aunque el catálogo sea el mismo para todos y la tentación
 * sea obvia. Este lib es per-workspace: un `let` acá lo comparten TODOS los
 * clientes del proceso, y tests/ads-manager-credenciales.test.ts lo prohíbe de
 * plano ("sin estado mutable de módulo: cruzaría clientes"). Lo escribí igual y el
 * test lo cazó — que es exactamente para lo que está.
 */
export async function listCountries(): Promise<Array<{ code: string; name: string }>> {
  const [apiVersion, tk] = await Promise.all([cred('META_API_VERSION'), cred('META_ACCESS_TOKEN')]);
  const url = new URL(`${GRAPH_BASE}/${apiVersion}/search`);
  url.searchParams.set('type', 'adgeolocation');
  url.searchParams.set('location_types', '["country"]');
  url.searchParams.set('locale', 'es_LA');
  url.searchParams.set('limit', '300');
  url.searchParams.set('access_token', tk);
  const d = await graphGet(url.toString());
  const arr = Array.isArray(d.data) ? (d.data as Array<Record<string, unknown>>) : [];
  const items = arr
    .map((o) => ({ code: String(o.country_code ?? o.key ?? '').toUpperCase(), name: String(o.name ?? '') }))
    .filter((o) => /^[A-Z]{2}$/.test(o.code) && o.name)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  return items;
}

export async function listCustomAudiences(): Promise<Array<{ id: string; name: string; subtype?: string; count?: number | null }>> {
  const [apiVersion, adAccountId, tk] = await Promise.all([cred('META_API_VERSION'), cred('META_AD_ACCOUNT_ID'), cred('META_ACCESS_TOKEN')]);
  const base = `${GRAPH_BASE}/${apiVersion}/${adAccountId}/customaudiences`;
  const fetchWith = (fields: string) => { const url = new URL(base); url.searchParams.set('fields', fields); url.searchParams.set('limit', '200'); url.searchParams.set('access_token', tk); return graphGet(url.toString()); };
  // approximate_count fue REMOVIDO de la API → usamos los bounds. Si esos también
  // fallaran, caemos a id,name para que los públicos SIEMPRE carguen (el tamaño es 2do).
  let data: Record<string, unknown>;
  try { data = await fetchWith('id,name,subtype,approximate_count_lower_bound,approximate_count_upper_bound'); }
  catch { data = await fetchWith('id,name'); }
  const arr = Array.isArray(data.data) ? (data.data as Array<Record<string, unknown>>) : [];
  return arr.map((a) => {
    const lo = a.approximate_count_lower_bound; const hi = a.approximate_count_upper_bound;
    const count = lo != null ? Number(lo) : (hi != null ? Number(hi) : null);
    return { id: String(a.id), name: String(a.name ?? a.id), subtype: a.subtype ? String(a.subtype) : undefined, count };
  });
}

export type AudienceTipo = 'page' | 'ig' | 'video' | 'pixel';

/** id de la cuenta de Instagram conectada (públicos de IG + actor del creativo para
 * que el anuncio corra en IG/Threads). null si no hay.
 *
 * ⚠️ La clave del memo es la IDENTIDAD RESUELTA (`página:cuenta`), no el workspace.
 * Un `let` suelto —lo que había acá— es un cubo compartido entre TODOS los clientes
 * del proceso: el anuncio del cliente B saldría publicado en el Instagram del A,
 * aceptado por Meta, sin error y con «listo» en la pantalla. Y un `Map<ws, …>`
 * tampoco alcanza: si el cliente cambia su página desde /integraciones, seguiría
 * sirviendo el IG de la página vieja hasta que Vercel recicle el lambda. */
const _igActorId = new Map<string, string | null>(); // key `${page}:${acct}`; ausente = sin resolver
export async function getInstagramActorId(): Promise<string | null> {
  let page: string, adAccountId: string;
  // Esta función nunca tiró y se preserva: sin credenciales, no hay IG y se sigue.
  try { [page, adAccountId] = await Promise.all([pageId(), cred('META_AD_ACCOUNT_ID')]); }
  catch { return null; }
  const key = `${page}:${adAccountId}`;
  const hit = _igActorId.get(key);
  if (hit !== undefined) return hit;
  try {
    const id = await resolveInstagramActorId(page, adAccountId); // string | null (Meta respondió: no hay)
    _igActorId.set(key, id);
    if (id == null) console.warn('[meta-ads] sin cuenta de Instagram conectada a la página → los anuncios solo correrán en Facebook.');
    return id;
  } catch {
    // Fallo transitorio (red/timeout): NO lo cacheamos como "no hay IG" — se reintenta
    // la próxima vez. Cachear null acá apagaría IG/Threads para todo el proceso.
    return null;
  }
}
// Recibe la página y la cuenta por parámetro: armar la URL con la constante del dueño
// era el otro medio bug — arreglar solo el memo seguiría preguntando por SU página.
async function resolveInstagramActorId(page: string, adAccountId: string): Promise<string | null> {
  let reached = false; // ¿pudimos consultar a Meta al menos una vez?
  const [apiVersion, accessToken] = await Promise.all([cred('META_API_VERSION'), cred('META_ACCESS_TOKEN')]);
  try {
    const url = new URL(`${GRAPH_BASE}/${apiVersion}/${page}`);
    url.searchParams.set('fields', 'instagram_business_account{id}');
    url.searchParams.set('access_token', accessToken);
    const data = await graphGet(url.toString());
    reached = true;
    const iba = data.instagram_business_account as { id?: string } | undefined;
    if (iba?.id) return String(iba.id);
  } catch { /* sigue: probamos el fallback */ }
  try {
    const url = new URL(`${GRAPH_BASE}/${apiVersion}/${adAccountId}/instagram_accounts`);
    url.searchParams.set('fields', 'id');
    url.searchParams.set('access_token', accessToken);
    const data = await graphGet(url.toString());
    reached = true;
    const arr = Array.isArray(data.data) ? (data.data as Array<{ id?: string }>) : [];
    if (arr[0]?.id) return String(arr[0].id);
  } catch { /* sigue */ }
  if (!reached) throw new MetaWriteError('No se pudo consultar la cuenta de Instagram (fallo transitorio).');
  return null; // Meta respondió pero no hay IG conectado
}

/**
 * Crea un público personalizado (Custom Audience) para retargeting, SIN salir de la
 * app. Se pueden crear varios y combinarlos (se incluyen con OR en el conjunto).
 *   - 'page'  → interactuaron con tu página de Facebook (engagement, META_PAGE_ID).
 *   - 'ig'    → interactuaron con tu Instagram (cuenta conectada a la página).
 *   - 'lead'  → abrieron tu formulario instantáneo en la página.
 *   - 'pixel' → visitaron tu web (requiere META_PIXEL_ID).
 * `dias` = ventana de retención (1..180). Devuelve {id, name}.
 */
export async function createCustomAudience(input: { tipo: AudienceTipo; dias: number; name?: string; evento?: string }): Promise<{ id: string; name: string }> {
  const dias = Math.min(365, Math.max(1, Math.round(input.dias || 90)));
  const retention = dias * 86400;
  const eng = (source: Record<string, unknown>, event?: string): Record<string, unknown> => ({
    inclusions: { operator: 'or', rules: [{ event_sources: [source], retention_seconds: retention, ...(event ? { filter: { operator: 'or', filters: [{ field: 'event', operator: '=', value: event }] } } : {}) }] },
  });

  let name: string; let rule: Record<string, unknown>;
  if (input.tipo === 'pixel') {
    const pixel = await pixelDelWs();
    if (!pixel) throw new MetaWriteError('Para "visitaron tu web" hace falta META_PIXEL_ID configurado. Elige otro tipo o configura el pixel.');
    // Website audience por EVENTO del pixel (PageView, ViewContent, Lead, Purchase,
    // o un evento personalizado). El rule EXIGE un filter (por eso pasa el evento).
    const evento = (input.evento || 'PageView').replace(/[^A-Za-z0-9_]/g, '').slice(0, 48) || 'PageView';
    name = input.name || `Web · ${evento} · ${dias}d`;
    rule = eng({ type: 'pixel', id: pixel }, evento);
  } else if (input.tipo === 'ig') {
    const ig = await getInstagramActorId();
    if (!ig) throw new MetaWriteError('No encontré una cuenta de Instagram conectada a tu página. Conéctala en Meta o elige otro tipo de público.');
    name = input.name || `Interacción Instagram · ${dias} días`;
    rule = eng({ type: 'ig_business', id: ig }, 'ig_business_profile_engaged');
  } else if (input.tipo === 'video') {
    name = input.name || `Vieron tus videos · ${dias} días`;
    rule = eng({ type: 'page', id: await pageId() }, 'page_video_view');
  } else {
    name = input.name || `Interacción Facebook · ${dias} días`;
    rule = eng({ type: 'page', id: await pageId() }, 'page_engaged');
  }

  // En v25 `subtype` ya NO se manda (Meta lo infiere de la regla). El nombre debe
  // ser corto y simple (Meta rechaza nombres largos o con caracteres raros).
  const data = await graphPost(`${await cred('META_AD_ACCOUNT_ID')}/customaudiences`, { name: name.slice(0, 48), rule: JSON.stringify(rule) });
  if (!data.id) throw new MetaWriteError('Meta no devolvió el id del público');
  return { id: String(data.id), name };
}

/** Pixels de la cuenta (para elegir cuál medir en conversiones web). */
export async function listPixels(): Promise<Array<{ id: string; name: string }>> {
  const [apiVersion, adAccountId, accessToken] = await Promise.all([cred('META_API_VERSION'), cred('META_AD_ACCOUNT_ID'), cred('META_ACCESS_TOKEN')]);
  const url = new URL(`${GRAPH_BASE}/${apiVersion}/${adAccountId}/adspixels`);
  url.searchParams.set('fields', 'id,name');
  url.searchParams.set('limit', '50');
  url.searchParams.set('access_token', accessToken);
  const data = await graphGet(url.toString());
  const arr = Array.isArray(data.data) ? (data.data as Array<Record<string, unknown>>) : [];
  return arr.map((p) => ({ id: String(p.id), name: String(p.name ?? p.id) }));
}

/** Conversiones personalizadas de la cuenta (ej. "Programaciones"/agenda) para optimizar.
 * Incluye pixel_id (el pixel al que pertenece cada una) para poder filtrar por el pixel
 * elegido — si no, se mezclan las conversiones de TODOS los pixels. */
export async function listCustomConversions(): Promise<Array<{ id: string; name: string; event?: string; pixel_id?: string }>> {
  const [apiVersion, adAccountId, tk] = await Promise.all([cred('META_API_VERSION'), cred('META_AD_ACCOUNT_ID'), cred('META_ACCESS_TOKEN')]);
  const base = `${GRAPH_BASE}/${apiVersion}/${adAccountId}/customconversions`;
  const fetchWith = (fields: string) => { const u = new URL(base); u.searchParams.set('fields', fields); u.searchParams.set('limit', '200'); u.searchParams.set('access_token', tk); return graphGet(u.toString()); };
  // Si la versión de API no aceptara pixel/data_sources, caemos a lo básico (sin filtrar).
  let data: Record<string, unknown>;
  try { data = await fetchWith('id,name,custom_event_type,pixel,data_sources'); }
  catch { data = await fetchWith('id,name,custom_event_type'); }
  const arr = Array.isArray(data.data) ? (data.data as Array<Record<string, unknown>>) : [];
  return arr.map((c) => {
    const pixel = c.pixel as { id?: string } | undefined;
    // El id de la data source de tipo pixel ES el id del pixel; el campo `pixel` es lo directo.
    const ds = Array.isArray(c.data_sources) ? (c.data_sources as Array<Record<string, unknown>>) : [];
    const pixel_id = pixel?.id ? String(pixel.id) : (ds[0]?.id ? String(ds[0].id) : undefined);
    return { id: String(c.id), name: String(c.name ?? c.id), event: c.custom_event_type ? String(c.custom_event_type) : undefined, pixel_id };
  });
}

/**
 * Eventos ACTIVOS de un pixel = los que recibió recientemente (Meta los muestra
 * como "Active events"). CRÍTICO: optimizar por un evento INACTIVO arruina la
 * entrega. Lee {pixel_id}/stats?aggregation=event en una ventana de ~30 días (SIN
 * ventana de tiempo Meta devuelve vacío) y junta los nombres de evento con count>0.
 * Robusto a TODAS las formas que devuelve la Graph API:
 *   - data[].data[]  → [{ value: "Lead", count: 123 }, ...]   (forma real anidada)
 *   - data[].value objeto → { "Lead": 123, "PageView": 999 }
 *   - data[].value array  → [{ value: "Lead", count: 123 }, ...]
 *   - data[].value string → "Lead" (+ data[].count)
 * Best-effort: si el endpoint no responde, devuelve [] y la UI cae al listado
 * estándar con una advertencia.
 */
export async function listPixelEvents(pixelId: string): Promise<string[]> {
  if (!pixelId) return [];
  // Ventana de ~30 días (en SEGUNDOS unix, como pide la Graph API). Es código de
  // servidor Node, así que Date.now() es seguro.
  const nowSec = Math.floor(Date.now() / 1000);
  const startSec = nowSec - 30 * 24 * 60 * 60;
  const [apiVersion, accessToken] = await Promise.all([cred('META_API_VERSION'), cred('META_ACCESS_TOKEN')]);
  const url = new URL(`${GRAPH_BASE}/${apiVersion}/${pixelId}/stats`);
  url.searchParams.set('aggregation', 'event');
  url.searchParams.set('start_time', String(startSec));
  url.searchParams.set('end_time', String(nowSec));
  url.searchParams.set('access_token', accessToken);

  let data: Record<string, unknown>;
  try { data = await graphGet(url.toString()); } catch { return []; }

  const out = new Set<string>();
  const add = (name: unknown, count?: unknown) => {
    const n = String(name ?? '').trim();
    if (!n) return;
    // Solo descartamos cuando HAY un conteo explícito <= 0; sin conteo, lo incluimos.
    if (count !== undefined && count !== null && count !== '' && Number(count) <= 0) return;
    out.add(n);
  };
  const ingestEntries = (obj: Record<string, unknown>) => { for (const [k, c] of Object.entries(obj)) add(k, c); };
  const ingestArray = (arr: unknown[]) => {
    for (const e of arr) {
      if (e && typeof e === 'object' && !Array.isArray(e)) {
        const o = e as Record<string, unknown>;
        add(o.value ?? o.event ?? o.name, o.count); // {value|event|name, count}
      }
    }
  };

  const rows = Array.isArray(data.data) ? (data.data as Array<Record<string, unknown>>) : [];
  for (const row of rows) {
    // FORMA REAL: cada bucket de tiempo trae su desglose por evento en row.data[].
    if (Array.isArray(row.data)) ingestArray(row.data as unknown[]);
    const v = row.value;
    if (v && typeof v === 'object' && !Array.isArray(v)) ingestEntries(v as Record<string, unknown>);
    else if (Array.isArray(v)) ingestArray(v as unknown[]);
    else if (typeof v === 'string') add(v, row.count);
  }
  return [...out];
}

/** Busca intereses por texto → ids reales que Meta acepta en el targeting. */
export async function searchInterests(q: string): Promise<Array<{ id: string; name: string; audience?: number | null; topic?: string | null }>> {
  if (!q.trim()) return [];
  const [apiVersion, accessToken] = await Promise.all([cred('META_API_VERSION'), cred('META_ACCESS_TOKEN')]);
  const url = new URL(`${GRAPH_BASE}/${apiVersion}/search`);
  url.searchParams.set('type', 'adinterest');
  url.searchParams.set('q', q.trim());
  url.searchParams.set('limit', '20');
  url.searchParams.set('access_token', accessToken);
  const data = await graphGet(url.toString());
  const arr = Array.isArray(data.data) ? (data.data as Array<Record<string, unknown>>) : [];
  return arr.map((i) => ({ id: String(i.id), name: String(i.name ?? ''), audience: i.audience_size_lower_bound != null ? Number(i.audience_size_lower_bound) : (i.audience_size != null ? Number(i.audience_size) : null), topic: i.topic ? String(i.topic) : null }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Subida de creativos (imagen / video)
// ─────────────────────────────────────────────────────────────────────────────

/** Sube una imagen a act_<id>/adimages → devuelve image_hash (+ url/medidas). */
export async function uploadAdImage(bytes: ArrayBuffer, filename: string): Promise<{ image_hash: string; url: string | null; width: number | null; height: number | null }> {
  // fetch crudo: no pasa por graphPost, así que resuelve sus propias credenciales.
  const [apiVersion, adAccountId, accessToken] = await Promise.all([cred('META_API_VERSION'), cred('META_AD_ACCOUNT_ID'), cred('META_ACCESS_TOKEN')]);
  const form = new FormData();
  form.append('access_token', accessToken);
  form.append('filename', new Blob([bytes]), filename);
  const res = await fetch(`${GRAPH_BASE}/${apiVersion}/${adAccountId}/adimages`, { method: 'POST', body: form, cache: 'no-store' });
  const data = (await res.json().catch(() => ({}))) as { images?: Record<string, { hash?: string; url?: string; width?: number; height?: number }>; error?: { code?: number; error_subcode?: number; message?: string } };
  if (data.error) throw new MetaWriteError(data.error.message ?? 'Error subiendo imagen', data.error.code, data.error.error_subcode);
  const images = data.images ?? {};
  const first = Object.values(images)[0];
  if (!first?.hash) throw new MetaWriteError('Meta no devolvió image_hash');
  return { image_hash: first.hash, url: first.url ?? null, width: first.width ?? null, height: first.height ?? null };
}

/** Sube un video a act_<id>/advideos (multipart) → devuelve video_id. */
export async function uploadAdVideo(bytes: ArrayBuffer, filename: string, mime: string): Promise<{ video_id: string }> {
  // fetch crudo: no pasa por graphPost, así que resuelve sus propias credenciales.
  const [apiVersion, adAccountId, accessToken] = await Promise.all([cred('META_API_VERSION'), cred('META_AD_ACCOUNT_ID'), cred('META_ACCESS_TOKEN')]);
  const form = new FormData();
  form.append('access_token', accessToken);
  form.append('name', filename);
  form.append('source', new Blob([bytes], { type: mime }), filename);
  const res = await fetch(`${GRAPH_BASE}/${apiVersion}/${adAccountId}/advideos`, { method: 'POST', body: form, cache: 'no-store' });
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
  const data = await graphPost(`${await cred('META_AD_ACCOUNT_ID')}/advideos`, { file_url: fileUrl, name });
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
  // FUERA del bucle: credWs no cachea (un SELECT por llamada) y el sondeo da hasta
  // ~37 vueltas. Adentro serían ~74 consultas, y cada una una chance de abortar.
  const [apiVersion, accessToken] = await Promise.all([cred('META_API_VERSION'), cred('META_ACCESS_TOKEN')]);
  while (Date.now() - startedAt < timeout) {
    const url = new URL(`${GRAPH_BASE}/${apiVersion}/${videoId}`);
    url.searchParams.set('fields', 'status');
    url.searchParams.set('access_token', accessToken);
    const data = await graphGet(url.toString()).catch(() => ({} as Record<string, unknown>));
    const vs = (data.status as { video_status?: string } | undefined)?.video_status;
    if (vs === 'ready') return 'ready';
    if (vs === 'error') return 'error';
    await sleep(interval);
  }
  return 'processing';
}

/**
 * Miniatura que Meta GENERA sola del video (URL http descargable, sirve en TODAS las
 * ubicaciones incl. Threads). Meta EXIGE image_hash o image_url en video_data; sin esto
 * la publicación falla con "Your ad needs a video thumbnail". Reintenta por si las
 * miniaturas todavía no están listas justo tras el procesado.
 */
async function getVideoThumbnailUrl(videoId: string): Promise<string | null> {
  // Fuera del for por lo mismo que waitForVideoReady: son 3 vueltas, no 3 lecturas.
  const [apiVersion, accessToken] = await Promise.all([cred('META_API_VERSION'), cred('META_ACCESS_TOKEN')]);
  for (let i = 0; i < 3; i++) {
    try {
      const url = new URL(`${GRAPH_BASE}/${apiVersion}/${videoId}/thumbnails`);
      url.searchParams.set('fields', 'uri,is_preferred');
      url.searchParams.set('access_token', accessToken);
      const data = await graphGet(url.toString());
      const arr = Array.isArray(data.data) ? (data.data as Array<{ uri?: string; is_preferred?: boolean }>) : [];
      const pref = arr.find((t) => t.is_preferred) ?? arr[0];
      if (pref?.uri) return String(pref.uri);
    } catch { /* reintenta */ }
    if (i < 2) await sleep(2000);
  }
  return null;
}

/** Devuelve el creativo con una miniatura de video VÁLIDA (URL http de Meta) para el
 * object_story_spec. Si ya trae una http la respeta; si trae una data:/blob: local o
 * nada, usa la que generó Meta del propio video. */
async function withVideoThumb(c: Creative): Promise<Creative> {
  // Si ya hay miniatura custom (image_hash) o una URL http válida, no la pisamos.
  if (c.media_type === 'video' && c.video_id && !c.image_hash && !(c.thumbnail_url && /^https?:\/\//i.test(c.thumbnail_url))) {
    const uri = await getVideoThumbnailUrl(c.video_id);
    if (uri) return { ...c, thumbnail_url: uri };
  }
  return c;
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
  const data = await graphPost(`${await cred('META_AD_ACCOUNT_ID')}/campaigns`, params);
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
    targeting: JSON.stringify(buildTargeting(adset.targeting, (await cuentaMeta()).country)),
  };
  // ABO: presupuesto + estrategia de puja en el conjunto. CBO: viven en la campaña.
  if (spec.budget_level === 'adset') {
    if (adset.daily_budget_mxn) params.daily_budget = mxnACentavos(adset.daily_budget_mxn);
    params.bid_strategy = adset.bid_strategy || 'LOWEST_COST_WITHOUT_CAP';
  }
  const promoted = await buildPromotedObject(spec.objective, optimization, adset.conversion);
  if (promoted) params.promoted_object = JSON.stringify(promoted);
  const data = await graphPost(`${await cred('META_AD_ACCOUNT_ID')}/adsets`, params);
  return String(data.id);
}

// UTMs automáticos en TODOS los anuncios. Meta reemplaza {{campaign.name}} /
// {{adset.name}} / {{ad.name}} en cada clic → tracking sin tener que cargarlo a mano.
export const UTM_TAGS = 'utm_source=facebook&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{adset.name}}';

/** Crea el creativo (reusando el post de un ganador o armando uno nuevo). UTMs automáticos. */
export async function createAdCreative(creative: Creative, adName: string): Promise<string> {
  if (creative.source === 'existing' && creative.source_ad_id) {
    const storyId = await getObjectStoryId(creative.source_ad_id);
    if (!storyId) throw new MetaWriteError('El anuncio ganador no tiene un post reutilizable (object_story_id). Prueba con otro o sube un creativo.');
    const data = await graphPost(`${await cred('META_AD_ACCOUNT_ID')}/adcreatives`, { name: `${adName} — creativo`, object_story_id: storyId, url_tags: UTM_TAGS });
    return String(data.id);
  }
  const oss = await buildObjectStorySpec(await withVideoThumb(creative));
  // Adjuntamos la cuenta de Instagram conectada → el anuncio corre en IG/Threads.
  // Sin esto Meta solo entrega en Facebook y bloquea la publicación pidiendo IG.
  // graphPost ignora los valores undefined, así que si no hay IG no rompe nada.
  const igId = await getInstagramActorId();
  const data = await graphPost(`${await cred('META_AD_ACCOUNT_ID')}/adcreatives`, { name: `${adName} — creativo`, object_story_spec: JSON.stringify(oss), instagram_user_id: igId ?? undefined, url_tags: UTM_TAGS });
  return String(data.id);
}

/** Crea el anuncio (PAUSED) ligado al conjunto y al creativo. */
export async function createAd(adsetId: string, ad: AdSpec, creativeId: string): Promise<string> {
  const data = await graphPost(`${await cred('META_AD_ACCOUNT_ID')}/ads`, {
    name: ad.name,
    adset_id: adsetId,
    creative: JSON.stringify({ creative_id: creativeId }),
    status: 'PAUSED',
  });
  return String(data.id);
}

// ─────────────────────────────────────────────────────────────────────────────
// Editar los TEXTOS de un anuncio ya publicado (y así arreglar rechazos por copy)
// ─────────────────────────────────────────────────────────────────────────────
// En Meta un creativo es INMUTABLE: para cambiar el copy se crea un creativo NUEVO
// (reusando el MISMO video/imagen) y se apunta el anuncio a ese creativo. Cambiar
// el texto re-dispara la revisión de Meta (por eso sirve para reparar un rechazo).

export type AdEditData = {
  ad_id: string;
  name: string;
  status: string;
  issues: Array<{ resumen: string; mensaje: string }>;
  editable: boolean; // false si el anuncio reutiliza un post existente (object_story_id)
  reason?: string;
  creative: {
    media_type: 'image' | 'video' | null;
    image_hash: string | null;
    video_id: string | null;
    thumbnail_url: string | null;
    primary_text: string;
    headline: string;
    description: string;
    cta_type: string | null;
    destination_url: string;
    lead_form_id: string | null;
  } | null;
};

function parseIssuesInfo(raw: unknown): Array<{ resumen: string; mensaje: string; code?: number; mid?: string }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((it) => {
      const o = (it ?? {}) as Record<string, unknown>;
      const code = Number(o.error_code);
      const mid = o.mid != null ? String(o.mid) : undefined;
      return {
        resumen: String(o.error_summary ?? o.error_type ?? 'Problema'),
        mensaje: String(o.error_message ?? ''),
        ...(Number.isFinite(code) ? { code } : {}),
        ...(mid ? { mid } : {}),
      };
    })
    .filter((x) => x.resumen || x.mensaje);
}

// Creativo dinámico (Advantage+ Creative / varios textos o imágenes): NO lo editamos
// acá porque aplanarlo a un object_story_spec plano apagaría esa optimización.
function esCreativoDinamico(afs: Record<string, unknown>): boolean {
  const len = (k: string) => (Array.isArray(afs[k]) ? (afs[k] as unknown[]).length : 0);
  return len('bodies') > 1 || len('titles') > 1 || len('descriptions') > 1 || len('images') > 1 || len('videos') > 1;
}

/** Lee el anuncio + su creativo para prellenar el editor de textos.
 * OJO Meta: al LEER, el object_story_spec de una imagen trae `picture` (URL) pero
 * NO el image_hash; el hash vive en creative.image_hash (top-level) o en
 * asset_feed_spec.images[].hash. Sin el hash el creativo nuevo saldría SIN imagen. */
export async function getAdForEdit(adId: string): Promise<AdEditData> {
  const [apiVersion, accessToken] = await Promise.all([cred('META_API_VERSION'), cred('META_ACCESS_TOKEN')]);
  const url = new URL(`${GRAPH_BASE}/${apiVersion}/${adId}`);
  url.searchParams.set('fields', 'name,effective_status,issues_info,creative{id,image_hash,object_story_spec,asset_feed_spec,effective_object_story_id,object_story_id}');
  url.searchParams.set('access_token', accessToken);
  const data = await graphGet(url.toString());
  const name = String(data.name ?? '');
  const status = String(data.effective_status ?? '');
  const issues = parseIssuesInfo(data.issues_info);
  const creative = data.creative as Record<string, unknown> | undefined;
  const oss = creative?.object_story_spec as Record<string, unknown> | undefined;
  const afs = creative?.asset_feed_spec as Record<string, unknown> | undefined;
  const vd = oss?.video_data as Record<string, unknown> | undefined;
  const ld = oss?.link_data as Record<string, unknown> | undefined;
  const noEditable = (reason: string): AdEditData => ({ ad_id: adId, name, status, issues, editable: false, reason, creative: null });

  if (afs && esCreativoDinamico(afs)) return noEditable('Este anuncio usa creativo dinámico (varios textos/imágenes que Meta rota); edítalo desde Meta para no perder esa optimización.');
  if (!oss || (!vd && !ld)) return noEditable('Este anuncio reutiliza una publicación existente; sus textos se editan desde esa publicación, no aquí.');

  // CTA de mensajería (WhatsApp/Messenger): el destino NO vive en value.link → no lo tocamos.
  const cta = (vd?.call_to_action ?? ld?.call_to_action) as { type?: string; value?: Record<string, unknown> } | undefined;
  const cv = cta?.value ?? {};
  const esMensajeria = ['WHATSAPP_MESSAGE', 'MESSAGE_PAGE'].includes(cta?.type ?? '') || cv.app_destination != null || cv.whatsapp_number != null || (cv.page != null && cv.link == null);
  if (esMensajeria) return noEditable('Este anuncio abre un chat de WhatsApp/Messenger; sus textos se editan desde Meta para no perder el destino del mensaje.');

  const link = typeof cv.link === 'string' ? cv.link : '';
  const lead = typeof cv.lead_gen_form_id === 'string' ? cv.lead_gen_form_id : null;
  let c: NonNullable<AdEditData['creative']>;
  if (vd) {
    c = {
      media_type: 'video', image_hash: vd.image_hash ? String(vd.image_hash) : null, video_id: vd.video_id ? String(vd.video_id) : null,
      thumbnail_url: vd.image_url ? String(vd.image_url) : null,
      primary_text: String(vd.message ?? ''), headline: String(vd.title ?? ''), description: String(vd.link_description ?? ''),
      cta_type: cta?.type ?? null, destination_url: link, lead_form_id: lead,
    };
  } else {
    // Imagen: el hash real sale del top-level o del asset_feed_spec (no de link_data).
    const afsImgs = Array.isArray(afs?.images) ? (afs!.images as Array<Record<string, unknown>>) : [];
    const hash = (creative?.image_hash ? String(creative.image_hash) : null)
      ?? (afsImgs[0]?.hash ? String(afsImgs[0].hash) : null)
      ?? (ld?.image_hash ? String(ld.image_hash) : null);
    c = {
      media_type: 'image', image_hash: hash, video_id: null, thumbnail_url: null,
      primary_text: String(ld?.message ?? ''), headline: String(ld?.name ?? ''), description: String(ld?.description ?? ''),
      cta_type: cta?.type ?? null, destination_url: link || (ld?.link ? String(ld.link) : ''), lead_form_id: lead,
    };
    if (!hash) return noEditable('No pudimos recuperar la imagen de este anuncio para conservarla; edítalo desde Meta.');
  }
  return { ad_id: adId, name, status, issues, editable: true, creative: c };
}

/** Aplica los textos editados: crea un creativo NUEVO (mismo media) y apunta el anuncio a él. */
export async function updateAdCopy(adId: string, edited: { primary_text?: string; headline?: string; description?: string; cta_type?: string; destination_url?: string }): Promise<{ creative_id: string }> {
  const current = await getAdForEdit(adId);
  if (!current.editable || !current.creative) throw new MetaWriteError(current.reason ?? 'Este anuncio no permite editar textos aquí.');
  const cc = current.creative;
  const creative: Creative = {
    source: 'upload',
    media_type: cc.media_type ?? undefined,
    image_hash: cc.image_hash, video_id: cc.video_id, thumbnail_url: cc.thumbnail_url,
    primary_text: edited.primary_text ?? cc.primary_text,
    headline: edited.headline ?? cc.headline,
    description: edited.description ?? cc.description,
    cta_type: (edited.cta_type ?? cc.cta_type ?? undefined) as Creative['cta_type'],
    destination_url: edited.destination_url ?? cc.destination_url,
    lead_form_id: cc.lead_form_id,
    lead_form_name: cc.lead_form_id ? '' : null,
  };
  const creativeId = await createAdCreative(creative, current.name);
  // Apuntar el anuncio al creativo nuevo (re-dispara revisión de Meta).
  await graphPost(adId, { creative: JSON.stringify({ creative_id: creativeId }) });
  return { creative_id: creativeId };
}

/**
 * Borra una entidad (campaña/conjunto/anuncio/creativo) en Meta. Best-effort, para
 * el rollback de un árbol a medio crear. Borrar la campaña cascadea a sus conjuntos
 * y anuncios; los creativos son a nivel cuenta y se borran aparte.
 */
export async function deleteEntity(id: string): Promise<void> {
  // fetch crudo, y es el que BORRA: resuelve las credenciales DEL WORKSPACE.
  const [apiVersion, accessToken] = await Promise.all([cred('META_API_VERSION'), cred('META_ACCESS_TOKEN')]);
  const url = `${GRAPH_BASE}/${apiVersion}/${id}?access_token=${encodeURIComponent(accessToken)}`;
  await fetch(url, { method: 'DELETE', cache: 'no-store' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Editar el PÚBLICO (targeting) de un conjunto existente
// ─────────────────────────────────────────────────────────────────────────────

// CRÍTICO: el POST /{adset_id} con `targeting` REEMPLAZA el objeto entero (no hace
// merge). Por eso devolvemos el targeting CRUDO de Meta y el editor superpone solo lo
// que el usuario toca; así NO se pierde nada que el editor no maneje (geo por ciudad/
// región, idioma/locales, behaviors/demographics, exclusiones, etc.).
export async function getAdsetTargeting(adsetId: string): Promise<{ name: string; optimization_goal: string; targeting: Record<string, unknown> }> {
  const [apiVersion, accessToken] = await Promise.all([cred('META_API_VERSION'), cred('META_ACCESS_TOKEN')]);
  const url = new URL(`${GRAPH_BASE}/${apiVersion}/${adsetId}`);
  url.searchParams.set('fields', 'name,optimization_goal,targeting');
  url.searchParams.set('access_token', accessToken);
  const data = await graphGet(url.toString());
  return { name: String(data.name ?? ''), optimization_goal: String(data.optimization_goal ?? ''), targeting: (data.targeting ?? {}) as Record<string, unknown> };
}

/** Actualiza la segmentación del conjunto. Recibe el objeto de targeting COMPLETO
 * (crudo de Meta con los cambios superpuestos) y lo re-envía tal cual. */
export async function updateAdsetTargeting(adsetId: string, targeting: Record<string, unknown>): Promise<void> {
  await graphPost(adsetId, { targeting: JSON.stringify(targeting) });
}

// ─────────────────────────────────────────────────────────────────────────────
// Agregar un ANUNCIO a un conjunto / un CONJUNTO a una campaña (todo en PAUSA)
// ─────────────────────────────────────────────────────────────────────────────

/** Datos del conjunto para saber si el anuncio nuevo necesita formulario o URL. */
export async function getAdsetForAdd(adsetId: string): Promise<{ name: string; optimization_goal: string; needsForm: boolean }> {
  const [apiVersion, accessToken] = await Promise.all([cred('META_API_VERSION'), cred('META_ACCESS_TOKEN')]);
  const url = new URL(`${GRAPH_BASE}/${apiVersion}/${adsetId}`);
  url.searchParams.set('fields', 'name,optimization_goal');
  url.searchParams.set('access_token', accessToken);
  const data = await graphGet(url.toString());
  const opt = String(data.optimization_goal ?? '');
  return { name: String(data.name ?? ''), optimization_goal: opt, needsForm: opt === 'LEAD_GENERATION' };
}

/** Crea un anuncio (PAUSED) dentro de un conjunto existente. */
export async function addAdToAdset(adsetId: string, creative: Creative, adName: string): Promise<{ ad_id: string; creative_id: string }> {
  const creativeId = await createAdCreative(creative, adName);
  const adId = await createAd(adsetId, { name: adName, creative }, creativeId);
  await adoptarTranscripcionDelCreativo(adId, creative.video_id);
  return { ad_id: adId, creative_id: creativeId };
}

/** Objetivo + nivel de presupuesto de una campaña, para armar un conjunto nuevo coherente.
 * En campañas de conversión, HEREDA la conversión de un conjunto existente (así el nuevo
 * conjunto optimiza por lo mismo sin pedirle al usuario el pixel/evento de nuevo). */
export async function getCampaignBasics(campaignId: string): Promise<{ name: string; objective: Objective; budgetLevel: BudgetLevel; optimization: string; needsForm: boolean; needsConv: boolean; conversion?: AdSetSpec['conversion'] }> {
  const [apiVersion, accessToken] = await Promise.all([cred('META_API_VERSION'), cred('META_ACCESS_TOKEN')]);
  const url = new URL(`${GRAPH_BASE}/${apiVersion}/${campaignId}`);
  url.searchParams.set('fields', 'name,objective,daily_budget,lifetime_budget');
  url.searchParams.set('access_token', accessToken);
  const data = await graphGet(url.toString());
  const objective = String(data.objective ?? 'OUTCOME_LEADS') as Objective;
  const hasCampBudget = data.daily_budget != null || data.lifetime_budget != null;
  // La optimización REAL sale de un conjunto existente (no del default del objetivo):
  // una campaña OUTCOME_LEADS puede optimizar por conversión web (OFFSITE_CONVERSIONS),
  // no por formulario. De paso heredamos la conversión (promoted_object).
  let optimization = objetivoDef(objective).optimization_goal;
  let conversion: AdSetSpec['conversion'];
  try {
    const u = new URL(`${GRAPH_BASE}/${apiVersion}/${campaignId}/adsets`);
    u.searchParams.set('fields', 'optimization_goal,promoted_object'); u.searchParams.set('limit', '10'); u.searchParams.set('access_token', accessToken);
    const d = await graphGet(u.toString());
    const arr = Array.isArray(d.data) ? (d.data as Array<Record<string, unknown>>) : [];
    if (arr[0]?.optimization_goal) optimization = String(arr[0].optimization_goal);
    for (const a of arr) {
      const po = a.promoted_object as Record<string, unknown> | undefined;
      if (po && (po.custom_conversion_id || po.pixel_id)) {
        conversion = { pixel_id: po.pixel_id ? String(po.pixel_id) : undefined, pixel_event: po.custom_event_type ? String(po.custom_event_type) : undefined, custom_conversion_id: po.custom_conversion_id ? String(po.custom_conversion_id) : undefined };
        break;
      }
    }
  } catch { /* sin conjuntos: usamos el default del objetivo */ }
  return { name: String(data.name ?? ''), objective, budgetLevel: hasCampBudget ? 'campaign' : 'adset', optimization, needsForm: optimization === 'LEAD_GENERATION', needsConv: optimization === 'OFFSITE_CONVERSIONS', conversion };
}

/** Crea un conjunto (PAUSED) + sus anuncios dentro de una campaña existente. */
export async function addAdsetToCampaign(campaignId: string, objective: Objective, budgetLevel: BudgetLevel, adset: AdSetSpec): Promise<{ adset_id: string; ad_ids: string[] }> {
  const specLike = { name: '', objective, special_ad_categories: [], budget_level: budgetLevel, adsets: [adset] } as CampaignSpec;
  const adsetId = await createAdSet(campaignId, specLike, adset);
  const ad_ids: string[] = [];
  for (const ad of adset.ads) {
    const creativeId = await createAdCreative(ad.creative, ad.name);
    const adId = await createAd(adsetId, ad, creativeId);
    await adoptarTranscripcionDelCreativo(adId, ad.creative.video_id);
    ad_ids.push(adId);
  }
  return { adset_id: adsetId, ad_ids };
}

// ─────────────────────────────────────────────────────────────────────────────
// Adoptar la transcripción hecha al subir el creativo
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Copia a ad_transcripts la transcripción que se hizo al SUBIR el video
 * (creative_transcripts, indexada por video_id), ahora que el anuncio existe y
 * tiene ad_id. Con la fila puesta, el cron transcribe-ads lo saltea: esa tabla
 * usa "existe fila = ya está" — o sea que evita bajar el mp4 de Meta y pagar
 * whisper una segunda vez por el mismo video.
 *
 * Best-effort: si algo falla, el cron lo transcribe mañana como siempre.
 */
export async function adoptarTranscripcionDelCreativo(adId: string, videoId: string | null | undefined): Promise<void> {
  if (!adId || !videoId) return;
  try {
    const { getTenantDb } = await import('./workspace');
    const db = await getTenantDb();
    const { data } = await db
      .from('creative_transcripts')
      .select('transcript,secciones,idioma,duracion_s,model,status,error')
      .eq('video_id', videoId)
      .maybeSingle();
    if (!data) return;
    await db.from('ad_transcripts').upsert(
      {
        ad_id: adId,
        video_id: videoId,
        tipo: 'video',
        status: data.status,
        transcript: data.transcript,
        secciones: data.secciones,
        idioma: data.idioma,
        duracion_s: data.duracion_s,
        model: data.model,
        error: data.error,
        updated_at: new Date().toISOString(),
      },
      // La PK pasó a ser (workspace_id, ad_id) en la 0057: con 'ad_id' solo,
      // Postgres rechaza el upsert por falta de constraint que matchee.
      { onConflict: 'workspace_id,ad_id' },
    );
  } catch (e) {
    console.error('[ads-manager] no se pudo adoptar la transcripción del creativo', e);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Estado de entrega de anuncios recién creados (aprobación de pares de Meta)
// ─────────────────────────────────────────────────────────────────────────────

/** Código de "peer approval": Meta retiene el anuncio hasta que un usuario de
 * confianza / admin del portfolio lo apruebe A MANO. No hay forma de aprobarlo
 * por API (los edges /confirm, /approve, /review y /appeal no existen), así que
 * lo único que se puede hacer es detectarlo y avisar. Espeja la constante de
 * lib/meta-health-ui.ts (acá no se importa para no acoplar server↔UI). */
const ISSUE_APROBACION_PENDIENTE = 2446984;

/** Lee el estado de varios anuncios en UNA llamada (?ids=) y marca cuáles quedaron
 * esperando la aprobación manual de Meta. Best-effort: si Graph falla, devuelve
 * vacío — es un aviso, no puede tumbar el flujo de publicación. */
export async function getAdsAprobacionPendiente(adIds: string[]): Promise<{ pendientes: Array<{ id: string; name: string; mid: string | null }>; leidos: number }> {
  const ids = adIds.filter((id) => /^\d+$/.test(id)).slice(0, 50);
  if (ids.length === 0) return { pendientes: [], leidos: 0 };
  try {
    const [apiVersion, accessToken] = await Promise.all([cred('META_API_VERSION'), cred('META_ACCESS_TOKEN')]);
    const url = new URL(`${GRAPH_BASE}/${apiVersion}/`);
    url.searchParams.set('ids', ids.join(','));
    url.searchParams.set('fields', 'id,name,effective_status,issues_info');
    url.searchParams.set('access_token', accessToken);
    const data = await graphGet(url.toString());
    const pendientes: Array<{ id: string; name: string; mid: string | null }> = [];
    let leidos = 0;
    for (const raw of Object.values(data as Record<string, unknown>)) {
      const ad = (raw ?? {}) as Record<string, unknown>;
      if (!ad.id) continue;
      leidos++;
      const issues = Array.isArray(ad.issues_info) ? (ad.issues_info as Array<Record<string, unknown>>) : [];
      const hit = issues.find((i) => Number(i.error_code) === ISSUE_APROBACION_PENDIENTE);
      if (hit) pendientes.push({ id: String(ad.id), name: String(ad.name ?? ''), mid: hit.mid != null ? String(hit.mid) : null });
    }
    return { pendientes, leidos };
  } catch (e) {
    console.error('[ads-manager] no se pudo leer el estado de aprobación', e);
    return { pendientes: [], leidos: 0 };
  }
}

/** La cuenta publicitaria en uso (act_<id>), para armar links a Ads Manager. */
export async function getAdAccountId(): Promise<string> {
  return cred('META_AD_ACCOUNT_ID');
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
    // Mismo IG actor que al crear → la previa de Instagram/Threads se renderiza.
    const igId = await getInstagramActorId();
    creativeParam = JSON.stringify({ object_story_spec: await buildObjectStorySpec(await withVideoThumb(creative)), ...(igId ? { instagram_user_id: igId } : {}) });
  }
  // Fuera del for: son hasta 4 formatos y las credenciales son las mismas.
  const [apiVersion, adAccountId, accessToken] = await Promise.all([cred('META_API_VERSION'), cred('META_AD_ACCOUNT_ID'), cred('META_ACCESS_TOKEN')]);
  const out: Array<{ ad_format: string; body: string }> = [];
  for (const f of adFormats) {
    try {
      const url = new URL(`${GRAPH_BASE}/${apiVersion}/${adAccountId}/generatepreviews`);
      url.searchParams.set('ad_format', f);
      url.searchParams.set('creative', creativeParam);
      url.searchParams.set('access_token', accessToken);
      const data = await graphGet(url.toString());
      const body = (data.data as Array<{ body?: string }> | undefined)?.[0]?.body;
      if (body) out.push({ ad_format: f, body });
    } catch {
      // Algunos formatos no aplican al creativo (p.ej. video en formato imagen): se omiten.
    }
  }
  return out;
}
