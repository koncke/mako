// =============================================================================
// Meta por la Zernio del negocio: la parte PURA (25/10/2026)
// =============================================================================
// Martín, 25/10: «implementa zernio y depreca la conexión con API de Meta... Y también revisa el tema de CAPI y
// alimentar al pixel». Venía de preguntar «si el usuario tiene zernio, podriamos no pedirle la API de Meta?».
//
// Lo medido en la OpenAPI de Zernio (v1.356.1, docs.zernio.com/api/openapi, 25/10/2026) que hace posible el cambio:
//   · `GET /v1/ads/insights` es un PASO DIRECTO a los insights de Meta: manda `fields`, `level`, `breakdowns` y
//     `actionBreakdowns` tal cual y devuelve las filas de Meta «verbatim». Las mismas filas que ya parsea
//     `parseInsightsToMetrics` (lib/meta-ads.ts): no hace falta otro parser.
//   · `GET /v1/ads/accounts/live` lee los conjuntos EN VIVO con su presupuesto diario (en UNIDADES de la moneda de la
//     cuenta, no en centavos como el `daily_budget` de Meta) y su interruptor propio (`configuredStatus`).
//   · `POST /v1/ads/conversions` es la Conversions API de Meta por Zernio, con la MISMA conexión de anuncios: «There is
//     no pixel-scoped access token to paste» (su guía de Meta). Zernio hashea email, teléfono, nombres y `externalId`:
//     se mandan EN CLARO. `eventId` es OBLIGATORIO.
//
// PROBADO el 25/10/2026 en la cuenta publicitaria de MaKo (act_1426493815659364), conectada a Zernio con el clic de Martín
// (scripts/prueba-zernio-meta.mts): la conexión, las lecturas, el nivel anuncio con la tarjeta y CAPI. Lo que NO se pudo medir
// ahí: filas de insights reales (la cuenta nunca gastó): se miran en el primer cron de un negocio que gaste.
//
// Sin `server-only`: lo ejecutan los tests sin red.
// =============================================================================

import type { MetaInsightRaw } from './types';

/**
 * PRENDIDO el 25/10/2026 con la prueba pasada en la cuenta de MaKo (docs/hallazgos-integraciones.md → «Meta entero por la
 * Zernio del negocio»): la conexión quedó al segundo clic, con la página fija; las lecturas del cron, la salud, el modal del
 * anuncio y la API contestan sin errores; el nivel anuncio da el presupuesto en unidades y el creativo con su post; y CAPI
 * llegó al píxel con el código de «Probar eventos» TEST96217 (eventsReceived 1, por el script y por `probar_capi_meta`).
 * Prendido: todo negocio con su conexión de anuncios de Zernio lee y escribe Meta por ahí, y el token de Meta deja de pedirse
 * en Integraciones (queda plegado para quien lo tenía).
 */
export const ZERNIO_META_PROBADO = true;

/** La credencial con el `_id` de la conexión `metaads` del negocio en SU Zernio. Un id, no un secreto: la escribe sólo el server. */
export const ENV_CUENTA_ZERNIO = 'META_ZERNIO_CUENTA';

export type ViaMeta = 'zernio' | 'token' | 'ninguna';

/**
 * ¿Meta cuenta como CONECTADA? Con el token de siempre (token + cuenta publicitaria) o por Zernio (la conexión + la cuenta).
 * La leen los TRES lectores de «conectada» (`integracionConectada`, `verificarServicio` y /api/metodo): sin esto un negocio
 * que conectó sólo por Zernio queda «sin Meta» para los crons y para el medidor, porque el token es obligatorio en el catálogo.
 * ⚠️ El token SIGUE obligatorio en el catálogo a propósito: marcarlo opcional dejaba «conectada» a una cuenta publicitaria
 * pegada sola, sin nada con qué leerla.
 */
export function metaConectadaConCampos(tiene: (env: string) => boolean): boolean {
  return tiene('META_AD_ACCOUNT_ID') && (tiene('META_ACCESS_TOKEN') || tiene(ENV_CUENTA_ZERNIO));
}

/**
 * ¿Por dónde habla MaKo con Meta para este negocio? Zernio PRIMERO cuando está activo y el negocio tiene su conexión y su
 * cuenta publicitaria; el token de Meta queda de respaldo para los negocios que ya lo tenían (tienen que seguir andando).
 * `activo` = `ZERNIO_META_PROBADO` o el negocio de la plataforma (donde se prueba).
 */
export function viaDeMeta(p: { activo: boolean; cuentaZernio: string | null; adAccountId: string | null; claveZernio: boolean; token: string | null }): ViaMeta {
  if (p.activo && cargado(p.cuentaZernio) && cargado(p.adAccountId) && p.claveZernio) return 'zernio';
  if (cargado(p.token) && cargado(p.adAccountId)) return 'token';
  return 'ninguna';
}

function cargado(v: string | null | undefined): v is string {
  return typeof v === 'string' && v.trim() !== '' && !v.startsWith('PENDING');
}

// ── Insights (paso directo) ──────────────────────────────────────────────────

/** El tope de filas por página de `GET /v1/ads/insights` (500, contra los 100 que se le piden a Meta directo). */
export const FILAS_POR_PAGINA_ZERNIO = 500;

/**
 * La query de `GET /v1/ads/insights` para un nodo de Meta (`act_…`, una campaña, un conjunto o un anuncio). Los nombres son
 * los de Zernio (`actionBreakdowns`, `fromDate`): los VALORES son los de Meta tal cual.
 */
export function queryInsightsZernio(p: {
  accountId: string;
  objectId: string;
  level?: 'ad' | 'adset' | 'campaign' | 'account';
  fields: readonly string[];
  desde?: string;
  hasta?: string;
  datePreset?: string;
  timeIncrement?: string | number;
  breakdowns?: readonly string[];
  actionBreakdowns?: readonly string[];
  filtering?: unknown;
  after?: string | null;
  limit?: number;
}): string {
  const q = new URLSearchParams({ accountId: p.accountId, objectId: p.objectId });
  if (p.level) q.set('level', p.level);
  if (p.fields.length) q.set('fields', p.fields.join(','));
  if (p.desde && p.hasta) { q.set('fromDate', p.desde); q.set('toDate', p.hasta); } else if (p.datePreset) q.set('datePreset', p.datePreset);
  if (p.timeIncrement != null) q.set('timeIncrement', String(p.timeIncrement));
  if (p.breakdowns?.length) q.set('breakdowns', p.breakdowns.join(','));
  if (p.actionBreakdowns?.length) q.set('actionBreakdowns', p.actionBreakdowns.join(','));
  if (p.filtering != null) q.set('filtering', JSON.stringify(p.filtering));
  q.set('limit', String(Math.max(1, Math.min(FILAS_POR_PAGINA_ZERNIO, p.limit ?? FILAS_POR_PAGINA_ZERNIO))));
  if (p.after) q.set('after', p.after);
  return q.toString();
}

/**
 * Una página de `GET /v1/ads/insights`: las filas de Meta y el cursor de la siguiente. null si la respuesta NO trae lista:
 * un cuerpo sin `data` no es «no hubo entrega» (eso es `data: []`), es una forma que acá no se sabe leer, y tomarlo por
 * vacío borraría el día de `marketing_metrics_daily` (el cron borra antes de insertar).
 */
export function paginaDeInsights(body: unknown): { filas: MetaInsightRaw[]; after: string | null } | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as { data?: unknown; paging?: { after?: unknown } };
  if (!Array.isArray(b.data)) return null;
  const filas = b.data.filter((f): f is MetaInsightRaw => !!f && typeof f === 'object');
  const after = typeof b.paging?.after === 'string' && b.paging.after ? b.paging.after : null;
  return { filas, after };
}

// ── Presupuestos de los conjuntos, en vivo ───────────────────────────────────

export type ConjuntoVivo = { adset_id: string; adset_name: string | null; presupuesto_diario: number | null; status: string | null };

/**
 * Una página de los conjuntos de `GET /v1/ads/accounts/live?level=adSet`. ⚠️ `dailyBudget` viene en UNIDADES de la moneda
 * (Zernio ya lo convirtió): NO pasa por `desdeUnidadMeta`, o el presupuesto queda dividido por 100. Un conjunto bajo el
 * presupuesto de su campaña (CBO) viene sin `dailyBudget` → null, como hoy con Meta. null si no trae lista.
 */
export function paginaDeConjuntos(body: unknown): { filas: ConjuntoVivo[]; after: string | null; moneda: string | null } | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as { adSets?: unknown; currency?: unknown; paging?: { adSets?: { after?: unknown } } };
  if (!Array.isArray(b.adSets)) return null;
  const filas: ConjuntoVivo[] = [];
  for (const raw of b.adSets) {
    if (!raw || typeof raw !== 'object') continue;
    const a = raw as { platformAdSetId?: unknown; adSetName?: unknown; dailyBudget?: unknown; platformAdSetStatus?: unknown; configuredStatus?: unknown };
    const id = typeof a.platformAdSetId === 'string' ? a.platformAdSetId : typeof a.platformAdSetId === 'number' ? String(a.platformAdSetId) : '';
    if (!id) continue;
    const pres = typeof a.dailyBudget === 'number' && Number.isFinite(a.dailyBudget) ? a.dailyBudget : null;
    // La entrega (`effective_status`) primero, como el cron de siempre (`effective_status ?? status`).
    const st = typeof a.platformAdSetStatus === 'string' ? a.platformAdSetStatus : typeof a.configuredStatus === 'string' ? a.configuredStatus : null;
    filas.push({ adset_id: id, adset_name: typeof a.adSetName === 'string' ? a.adSetName : null, presupuesto_diario: pres, status: st });
  }
  const after = typeof b.paging?.adSets?.after === 'string' && b.paging.adSets.after ? b.paging.adSets.after : null;
  return { filas, after, moneda: typeof b.currency === 'string' ? b.currency : null };
}

// ── El árbol de la cuenta (campañas, conjuntos y anuncios), con la forma de la Graph API ──

/** Una fila con la forma de las edges de la Graph API (`/{act}/campaigns`, `/adsets`, `/ads`): lo que lee `toNodo` (lib/meta-health.ts). */
export type FilaGraph = Record<string, unknown>;

/** Lo que Meta ya no muestra en sus edges: lo borrado y lo archivado. En `/v1/ads` de Zernio se queda (status `cancelled`). */
const FUERA_DEL_ARBOL = new Set(['DELETED', 'ARCHIVED']);

/** El `status` normalizado de Zernio → el `effective_status` de Meta, para un anuncio sin `platformStatus` (filas viejas). */
const ESTADO_DE_ZERNIO: Record<string, string> = {
  active: 'ACTIVE', paused: 'PAUSED', pending_review: 'PENDING_REVIEW', rejected: 'DISAPPROVED', error: 'WITH_ISSUES', cancelled: 'DELETED',
};

const texto = (v: unknown): string | null => (typeof v === 'string' && v ? v : typeof v === 'number' ? String(v) : null);
const monto = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/**
 * El árbol de la cuenta con la forma de la Graph API, armado con lo que da Zernio (25/10/2026): las campañas y los conjuntos
 * EN VIVO (`GET /v1/ads/accounts/live`) y los anuncios de la lista sincronizada (`GET /v1/ads`, Zernio no tiene lectura en vivo
 * de los anuncios de una cuenta). Así `_getMetaHealth` no cambia su parser.
 *
 * ⚠️ Los presupuestos de Zernio vienen en UNIDADES de la moneda; las filas de la Graph API, en la unidad MÍNIMA (centavos),
 * y `toNodo` las divide. Por eso pasan por `aMinima` (el `aUnidadMeta` de siempre), o el presupuesto quedaría 100 veces más chico.
 * ⚠️ Un anuncio entra sólo si su conjunto está vivo: la lista de Zernio guarda lo que se borró (y su estado puede tener hasta una
 * hora de atraso), y un anuncio de una campaña borrada se pintaría como prendido.
 * Lo que Zernio no trae: el aprendizaje de cada conjunto (va aparte, `aprendizaje`), el `created_time` de campañas y conjuntos,
 * y las recomendaciones de Meta (su `/ads/recommendations` es sólo de Google).
 */
export function arbolDesdeZernio(p: {
  live: unknown;
  anuncios: readonly unknown[];
  aMinima: (monto: number, moneda: string) => number;
  aprendizaje?: ReadonlyMap<string, unknown>;
}): { moneda: string; campaigns: FilaGraph[]; adsets: FilaGraph[]; ads: FilaGraph[] } | null {
  if (!p.live || typeof p.live !== 'object') return null;
  const l = p.live as { currency?: unknown; campaigns?: unknown; adSets?: unknown };
  const moneda = texto(l.currency);
  if (!moneda || !Array.isArray(l.campaigns) || !Array.isArray(l.adSets)) return null;
  const minima = (v: unknown) => { const n = monto(v); return n == null ? null : p.aMinima(n, moneda); };

  // El objetivo de la campaña sólo viene en sus anuncios (`platformObjective`).
  const objetivo = new Map<string, string>();
  for (const raw of p.anuncios) {
    const a = (raw ?? {}) as { platformCampaignId?: unknown; platformObjective?: unknown };
    const c = texto(a.platformCampaignId); const o = texto(a.platformObjective);
    if (c && o && !objetivo.has(c)) objetivo.set(c, o);
  }

  const campaigns: FilaGraph[] = [];
  for (const raw of l.campaigns) {
    const c = (raw ?? {}) as Record<string, unknown>;
    const id = texto(c.platformCampaignId);
    if (!id) continue;
    campaigns.push({
      id, name: texto(c.campaignName) ?? undefined,
      effective_status: texto(c.platformCampaignStatus) ?? texto(c.configuredStatus) ?? undefined,
      configured_status: texto(c.configuredStatus) ?? undefined,
      daily_budget: minima(c.dailyBudget), lifetime_budget: minima(c.lifetimeBudget), budget_remaining: minima(c.budgetRemaining),
      objective: objetivo.get(id),
    });
  }

  const adsets: FilaGraph[] = [];
  const conjuntosVivos = new Set<string>();
  for (const raw of l.adSets) {
    const s = (raw ?? {}) as Record<string, unknown>;
    const id = texto(s.platformAdSetId);
    if (!id) continue;
    conjuntosVivos.add(id);
    adsets.push({
      id, name: texto(s.adSetName) ?? undefined, campaign_id: texto(s.platformCampaignId) ?? undefined,
      effective_status: texto(s.platformAdSetStatus) ?? texto(s.configuredStatus) ?? undefined,
      configured_status: texto(s.configuredStatus) ?? undefined,
      daily_budget: minima(s.dailyBudget), lifetime_budget: minima(s.lifetimeBudget), budget_remaining: minima(s.budgetRemaining),
      learning_stage_info: p.aprendizaje?.get(id),
    });
  }

  const ads: FilaGraph[] = [];
  const vistos = new Set<string>();
  for (const raw of p.anuncios) {
    const a = (raw ?? {}) as Record<string, unknown>;
    const id = texto(a.platformAdId);
    const conjunto = texto(a.platformAdSetId);
    if (!id || !conjunto || !conjuntosVivos.has(conjunto) || vistos.has(id)) continue;
    const estado = (texto(a.platformStatus) ?? ESTADO_DE_ZERNIO[texto(a.status) ?? ''] ?? 'UNKNOWN').toUpperCase();
    const interruptor = texto(a.configuredStatus)?.toUpperCase() ?? null;
    if (FUERA_DEL_ARBOL.has(estado) || (interruptor && FUERA_DEL_ARBOL.has(interruptor)) || a.status === 'cancelled') continue;
    vistos.add(id);
    // El rechazo de Meta, con la forma de `issues_info` (lo que lee `parseIssues`).
    const motivo = texto(a.rejectionReason);
    const conProblema = a.reviewStatus === 'rejected' || a.reviewStatus === 'with_issues' || a.status === 'rejected' || a.status === 'error';
    ads.push({
      id, name: texto(a.name) ?? undefined, adset_id: conjunto, campaign_id: texto(a.platformCampaignId) ?? undefined,
      effective_status: estado, configured_status: interruptor ?? undefined, created_time: texto(a.platformCreatedAt) ?? undefined,
      ...(conProblema ? { issues_info: [{ error_summary: a.reviewStatus === 'with_issues' || a.status === 'error' ? 'Anuncio con problemas' : 'Anuncio rechazado', error_message: motivo ?? '' }] } : {}),
    });
  }
  return { moneda, campaigns, adsets, ads };
}

/** Una página de `GET /v1/ads` (la lista sincronizada): los anuncios y si queda otra. null si no trae lista. */
export function paginaDeAnuncios(body: unknown): { anuncios: unknown[]; hayMas: boolean } | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as { ads?: unknown; pagination?: { page?: unknown; pages?: unknown } };
  if (!Array.isArray(b.ads)) return null;
  const page = monto(b.pagination?.page); const pages = monto(b.pagination?.pages);
  return { anuncios: b.ads, hayMas: page != null && pages != null && page < pages };
}

// ── Formularios de leads por Zernio ──────────────────────────────────────────

export type FormularioZernio = { id: string; name: string; status?: string };

/**
 * Una página de `GET /v1/ads/lead-forms` (los formularios de la página de la conexión). La OpenAPI no declara la forma de cada
 * formulario (`items: object`): se lee tolerante (`id` o `formId`, `name`, `status`) y se dejan afuera los archivados y borrados,
 * como con el token (Meta no deja usarlos en un anuncio). null si no trae la lista.
 */
export function formulariosDeZernio(body: unknown): { formularios: FormularioZernio[]; cursor: string | null } | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as { forms?: unknown; pagination?: { hasMore?: unknown; cursor?: unknown } };
  if (!Array.isArray(b.forms)) return null;
  const formularios: FormularioZernio[] = [];
  for (const raw of b.forms) {
    const f = (raw ?? {}) as Record<string, unknown>;
    const id = texto(f.id) ?? texto(f.formId) ?? texto(f.platformFormId);
    if (!id || !/^\d+$/.test(id)) continue;
    const status = texto(f.status)?.toUpperCase();
    if (status === 'ARCHIVED' || status === 'DELETED') continue;
    formularios.push({ id, name: texto(f.name) ?? id, ...(status ? { status } : {}) });
  }
  const cursor = b.pagination?.hasMore === true ? texto(b.pagination.cursor) : null;
  return { formularios, cursor };
}

/**
 * El cuerpo de `POST /v1/ads/lead-forms` (Meta: el contenido va en `platformSpecificData`) armado DESDE los parámetros de la Graph
 * API que ya arma `paramsFormulario` (lib/meta-formularios.ts): las preguntas, su orden, la privacidad y la pantalla final son las
 * MISMAS por los dos caminos, sin una segunda copia de esas reglas.
 */
export function cuerpoFormularioZernio(accountId: string, p: Record<string, string>): Record<string, unknown> {
  const privacidad = JSON.parse(p.privacy_policy) as { url: string; link_text?: string };
  const final = JSON.parse(p.thank_you_page) as { title?: string; body?: string; button_type?: string; button_text?: string; website_url?: string };
  return {
    accountId, name: p.name, privacyPolicyUrl: privacidad.url,
    platformSpecificData: {
      questions: JSON.parse(p.questions) as unknown[],
      ...(privacidad.link_text ? { privacyPolicyLinkText: privacidad.link_text } : {}),
      ...(p.follow_up_action_url ? { followUpActionUrl: p.follow_up_action_url } : {}),
      ...(p.locale ? { locale: p.locale } : {}),
      ...(final.title ? { thankYouTitle: final.title } : {}),
      ...(final.body ? { thankYouBody: final.body } : {}),
      ...(final.button_text ? { thankYouButtonText: final.button_text } : {}),
      ...(final.button_type ? { thankYouButtonType: final.button_type } : {}),
      ...(final.website_url ? { thankYouWebsiteUrl: final.website_url } : {}),
      isOptimizedForQuality: p.is_optimized_for_quality === 'true',
    },
  };
}

/**
 * Las páginas e Instagram con los que la conexión puede publicar (`GET /v1/ads/instagram-accounts`), con la forma de
 * `identidadesMeta` (lib/meta-identidad.ts): toda página que lista Zernio es de la conexión, así que puede anunciar; el Instagram
 * de cada página es el de empresa (o el conectado); los de la cuenta publicitaria son los `ad_account`. null si no trae las listas.
 */
export function identidadesDeZernio(body: unknown): {
  paginas: Array<{ id: string; nombre: string; puedeAnunciar: boolean; instagram: { id: string; username: string | null } | null }>;
  instagramCuenta: Array<{ id: string; username: string | null }>;
} | null {
  const b = (body ?? {}) as { accounts?: unknown; pages?: unknown };
  if (!Array.isArray(b.accounts) || !Array.isArray(b.pages)) return null;
  const ig = (r: unknown) => {
    const o = (r ?? {}) as { igUserId?: unknown; username?: unknown };
    const id = texto(o.igUserId);
    return id ? { id, username: texto(o.username) } : null;
  };
  const paginas = b.pages.flatMap((raw) => {
    const p = (raw ?? {}) as { pageId?: unknown; name?: unknown; instagramBusinessAccount?: unknown; connectedInstagramAccount?: unknown };
    const id = texto(p.pageId);
    return id ? [{ id, nombre: texto(p.name) ?? id, puedeAnunciar: true, instagram: ig(p.instagramBusinessAccount) ?? ig(p.connectedInstagramAccount) }] : [];
  });
  const instagramCuenta = b.accounts.flatMap((raw) => {
    const a = (raw ?? {}) as { source?: unknown };
    const x = ig(raw);
    return x && a.source === 'ad_account' ? [x] : [];
  });
  return { paginas, instagramCuenta };
}

/**
 * Un resultado de `GET /v1/ads/targeting/search?dimension=geo` (normalizado por Zernio: `id`, `name`, `type`, `countryCode`, `path`
 * del lugar padre al país) con la forma de un resultado de `adgeolocation` de Meta, para que lo lea el MISMO `lugarDesdeBusqueda`
 * (lib/meta-geo.ts). El `id` es la `key` de Meta (medido el 26/10/2026: «Ciudad de Córdoba» → 84740, la misma de siempre). La
 * provincia sale del primer padre; el id de la provincia y la ciudad de un código postal no vienen.
 */
export function lugarCrudoDeZernio(r: unknown): Record<string, unknown> {
  const o = (r ?? {}) as { id?: unknown; name?: unknown; type?: unknown; countryCode?: unknown; path?: unknown };
  const padres = Array.isArray(o.path) ? o.path.filter((x): x is string => typeof x === 'string') : [];
  const tipo = texto(o.type);
  return {
    key: tipo === 'country' ? texto(o.countryCode) ?? texto(o.id) : texto(o.id), name: texto(o.name), type: tipo,
    country_code: texto(o.countryCode), region: tipo !== 'region' && tipo !== 'country' && padres.length > 1 ? padres[0] : null,
  };
}

/** Un interés de `GET /v1/ads/targeting/search?dimension=interest` con la forma que devuelve `searchInterests`. */
export function interesDeZernio(r: unknown): { id: string; name: string; audience: number | null; topic: string | null } | null {
  const o = (r ?? {}) as { id?: unknown; name?: unknown; audienceSize?: unknown; path?: unknown };
  const id = texto(o.id);
  if (!id) return null;
  const path = Array.isArray(o.path) ? o.path.filter((x): x is string => typeof x === 'string') : [];
  // El «tema» de Meta es el primer nivel debajo de «Intereses» (el `topic` de la búsqueda con el token).
  return { id, name: texto(o.name) ?? id, audience: monto(o.audienceSize), topic: path.length > 2 ? path[1] : null };
}

/** El `subtype` de Meta de cada tipo de público de Zernio (lo que muestra MaKo al elegir uno). */
const SUBTIPO_DE_PUBLICO: Record<string, string> = {
  customer_list: 'CUSTOM', website: 'WEBSITE', website_retargeting: 'WEBSITE', engagement: 'ENGAGEMENT', meta_engagement: 'ENGAGEMENT', lookalike: 'LOOKALIKE',
};

/**
 * Los públicos personalizados de `GET /v1/ads/audiences`, con la forma que ya devuelve `listCustomAudiences`: el id es el de META
 * (`platformAudienceId`, el que va en una segmentación; el `id` de Zernio es otro y es null en los que no creó Zernio). Los
 * `saved_targeting` no son públicos de Meta (son segmentaciones guardadas en Zernio): no van. null si no trae la lista.
 */
export function publicosDeZernio(body: unknown): Array<{ id: string; name: string; subtype?: string; count: number | null }> | null {
  const b = (body ?? {}) as { audiences?: unknown };
  if (!Array.isArray(b.audiences)) return null;
  const out: Array<{ id: string; name: string; subtype?: string; count: number | null }> = [];
  for (const raw of b.audiences) {
    const a = (raw ?? {}) as Record<string, unknown>;
    const id = texto(a.platformAudienceId);
    if (!id || a.type === 'saved_targeting') continue;
    const subtype = SUBTIPO_DE_PUBLICO[texto(a.type) ?? ''];
    out.push({ id, name: texto(a.name) ?? id, ...(subtype ? { subtype } : {}), count: monto(a.size) });
  }
  return out;
}

// ── Escribir en Meta por Zernio: de quién es la entidad, y el fallo dicho para la persona ──

export type NivelMeta = 'campaign' | 'adset' | 'ad';

/** Lo que se lee de una campaña, un conjunto o un anuncio antes de escribirle: su cuenta publicitaria y sus dos estados. */
export type EntidadZernio = { cuenta: string | null; configurado: string | null; efectivo: string | null };

/**
 * De qué cuenta es una entidad y cómo está, leído de lo que devuelve Zernio: `GET /ads/campaigns/{id}` y `/ads/ad-sets/{id}`
 * son el paso directo de Meta (`campaign` / `adSet` con los campos pedidos: `account_id`, `configured_status`, `effective_status`);
 * `GET /ads/{id}?live=true` es el anuncio guardado por Zernio con los interruptores releídos de Meta (`platformAdAccountId`,
 * `configuredStatus`, `platformStatus`). null si no trae la entidad.
 */
export function entidadDeZernio(nivel: NivelMeta, body: unknown): EntidadZernio | null {
  const b = (body ?? {}) as { campaign?: Record<string, unknown> | null; adSet?: Record<string, unknown> | null; ad?: Record<string, unknown> | null };
  const mayus = (v: unknown) => texto(v)?.toUpperCase() ?? null;
  if (nivel === 'ad') {
    const a = b.ad;
    if (!a || typeof a !== 'object') return null;
    // ⚠️ Un anuncio BORRADO vuelve con `configuredStatus: ACTIVE` (docs/hallazgos-ads.md): lo que dice que no está es la entrega.
    const efectivo = mayus(a.platformStatus) ?? (a.status === 'cancelled' ? 'DELETED' : null);
    return { cuenta: texto(a.platformAdAccountId), configurado: efectivo === 'DELETED' ? 'DELETED' : mayus(a.configuredStatus), efectivo };
  }
  const e = nivel === 'campaign' ? b.campaign : b.adSet;
  if (!e || typeof e !== 'object') return null;
  return { cuenta: texto(e.account_id), configurado: mayus(e.configured_status) ?? mayus(e.status), efectivo: mayus(e.effective_status) };
}

/**
 * Qué hacer con una entidad que Meta ya borró. Zernio NO da error al pausar un anuncio borrado (contesta 200: medido el 26/10/2026
 * en la cuenta de MaKo), y con el token Meta sí lo rechazaba. Borrarla otra vez ya está hecho; cualquier otra escritura, no existe.
 */
export function siYaEstaBorrada(e: EntidadZernio, op: string): 'hecho' | 'no_existe' | null {
  if (e.configurado !== 'DELETED' && e.efectivo !== 'DELETED') return null;
  return op === 'delete' ? 'hecho' : 'no_existe';
}

/**
 * ¿Lo que Zernio devolvió al crear es un anuncio YA BORRADO? Con la misma `Idempotency-Key` devuelve la respuesta de la primera vez
 * aunque ese anuncio ya no exista (medido el 26/10/2026): crear, borrar y volver a pedir lo mismo en el mismo tramo daba «creado»
 * sobre uno borrado. Se mira releyéndolo en vivo (`anuncioEnVivoPorZernio`): `status: cancelled` o la entrega `DELETED`.
 * ⚠️ El interruptor (`configuredStatus`) NO sirve: un anuncio borrado vuelve con `ACTIVE`.
 */
export function vinoBorrado(v: { estado: string | null; entrega: string | null } | null): boolean {
  return !!v && (v.estado === 'cancelled' || v.entrega === 'DELETED');
}

/**
 * Un fallo de Zernio al escribir, dicho para la persona, con el status que contesta MaKo. Lo que tiene arreglo del lado del
 * negocio dice dónde se arregla: el tope de anuncios activos gratis de SU Zernio (`ads_allowance_exceeded`: prender o subir
 * presupuesto con la cuenta de Zernio sin medio de pago), la cuenta publicitaria no elegida en la conexión, la conexión
 * vencida. El resto lleva el mensaje de Meta que Zernio trae adentro (`platformError`).
 */
export function falloDeEscrituraZernio(
  status: number,
  body: { error?: string; code?: string; platformError?: unknown } | null,
  mensaje: string,
): { status: number; message: string; code?: number; error_subcode?: number } {
  const pe = (body?.platformError ?? null) as { code?: unknown; error_subcode?: unknown; message?: unknown; error_user_msg?: unknown; error_user_title?: unknown } | null;
  const code = Number(pe?.code); const sub = Number(pe?.error_subcode);
  const meta = {
    ...(Number.isFinite(code) && code > 0 ? { code } : {}),
    ...(Number.isFinite(sub) && sub > 0 ? { error_subcode: sub } : {}),
  };
  if (body?.code === 'ads_allowance_exceeded') {
    return { status: 409, message: 'Tu cuenta de Zernio llegó al tope de anuncios activos gratis: carga un medio de pago en Zernio para prender anuncios o subir presupuestos.' };
  }
  if (body?.code === 'ad_account_not_selected') {
    return { status: 409, message: 'Tu conexión de Facebook en Zernio no tiene elegida esta cuenta publicitaria. Vuelve a conectar en Integraciones → Zernio y elígela.' };
  }
  if (status === 409 && !pe) return { status: 409, message: 'La conexión de Facebook en Zernio necesita reconectarse: hazlo en Integraciones → Zernio.' };
  const deMeta = texto(pe?.error_user_msg) ?? texto(pe?.message);
  if (status === 404) return { status: 404, message: deMeta ?? 'Eso no está en la cuenta de Meta de este negocio (o ya se borró).', ...meta };
  const texto_ = deMeta ?? body?.error ?? mensaje;
  if (esFalloDePermiso(status, texto_) || meta.error_subcode === 4841013 || meta.code === 200) return { status: 403, message: texto_, ...meta };
  return { status: 502, message: texto_, ...meta };
}

// ── CAPI por Zernio ──────────────────────────────────────────────────────────

/** El `actionSource` de Zernio. El de MaKo es el de Meta (`website`, `system_generated`, `email`, `app`). */
type FuenteZernio = 'web' | 'app' | 'offline' | 'crm' | 'phone_call' | 'system_generated' | 'business_messaging';

export function fuenteZernio(a: 'system_generated' | 'website' | 'email' | 'app' | undefined): FuenteZernio {
  if (a === 'website') return 'web';
  if (a === 'app') return 'app';
  // Zernio no tiene `email`: lo que MaKo manda así es un hecho del sistema, no del navegador.
  return 'system_generated';
}

export type EventoZernio = {
  eventName: string;
  eventTime: number;
  eventId: string;
  actionSource: FuenteZernio;
  sourceUrl?: string;
  user: { email?: string; phone?: string; leadId?: string; externalId?: string };
  platformData?: Record<string, unknown>;
};

/**
 * El evento de `POST /v1/ads/conversions`, con lo MISMO que decide el envío directo (lib/meta-capi.ts): la hora del hecho
 * ya recortada a la ventana, el `lead_id` ya validado y el `custom_data` ya armado (los campos de CRM si el destino es el
 * conjunto de datos de CRM). Lo que cambia es la identidad: va EN CLARO, porque Zernio la normaliza y la hashea (mandarla
 * hasheada la haría hashear dos veces y no cruzaría con nada).
 *
 * ⚠️ `eventId` es obligatorio en Zernio. Sin uno del llamador se arma uno ESTABLE con el nombre, la hora y la identidad: un
 * reintento del mismo hecho repite el id y Meta lo junta, en vez de contarlo dos veces.
 */
export function eventoParaZernio(p: {
  eventName: string;
  segundos: number;
  eventId?: string;
  actionSource?: 'system_generated' | 'website' | 'email' | 'app';
  eventSourceUrl?: string;
  email: string | null;
  phone: string | null;
  leadId: string | null;
  externalId?: string | null;
  customData?: Record<string, unknown> | null;
}): EventoZernio {
  const email = p.email?.trim().toLowerCase() || '';
  const phone = p.phone ? p.phone.replace(/[^\d+]/g, '') : '';
  const uid = typeof p.externalId === 'string' ? p.externalId.trim().toLowerCase() : '';
  const user: EventoZernio['user'] = {};
  if (email.includes('@')) user.email = email;
  if (/\d/.test(phone)) user.phone = phone;
  if (p.leadId) user.leadId = p.leadId;
  if (uid) user.externalId = uid;
  const id = p.eventId?.trim() || `${p.eventName}:${p.segundos}:${p.leadId || user.email || user.phone || uid || 'x'}`;
  return {
    eventName: p.eventName,
    eventTime: p.segundos,
    eventId: id.slice(0, 200),
    actionSource: fuenteZernio(p.actionSource),
    ...(p.eventSourceUrl ? { sourceUrl: p.eventSourceUrl } : {}),
    user,
    ...(p.customData && Object.keys(p.customData).length ? { platformData: p.customData } : {}),
  };
}

/**
 * Lo que contestó Zernio a un envío. ⚠️ Un rechazo de Meta NO es un error de HTTP: viene en un 200 con `eventsFailed` y
 * `failures[]` («Branch on eventsFailed, never on the status code», su guía). Un 200 que no confirma ningún evento
 * tampoco es un éxito.
 */
export function resultadoConversionZernio(body: unknown): { ok: true; recibidos: number } | { ok: false; detalle: string } {
  if (!body || typeof body !== 'object') return { ok: false, detalle: 'respuesta ilegible de Zernio' };
  const b = body as { eventsReceived?: unknown; eventsFailed?: unknown; failures?: unknown; traceId?: unknown };
  const fallidos = typeof b.eventsFailed === 'number' ? b.eventsFailed : 0;
  const recibidos = typeof b.eventsReceived === 'number' ? b.eventsReceived : 0;
  if (fallidos > 0 || recibidos < 1) {
    const f = Array.isArray(b.failures) ? (b.failures[0] as { message?: unknown; code?: unknown } | undefined) : undefined;
    const msg = f && typeof f.message === 'string' ? f.message : fallidos > 0 ? 'Meta rechazó el evento' : 'Zernio no confirmó ningún evento';
    const code = f && (typeof f.code === 'string' || typeof f.code === 'number') ? ` (código ${f.code})` : '';
    const traza = typeof b.traceId === 'string' && b.traceId ? ` · fbtrace ${b.traceId}` : '';
    return { ok: false, detalle: `${msg}${code}${traza}`.slice(0, 300) };
  }
  return { ok: true, recibidos };
}

/**
 * ¿El fallo de Zernio es de PERMISO sobre el píxel? Entonces vale probar con el token del píxel (el de Events Manager), si
 * el negocio lo pegó: una conexión con «Administrar campañas» (`permissionLevel=advertise`) puede no alcanzar para el
 * píxel (Zernio pide «Control total» para CREAR píxeles; para mandarles eventos no lo dice, y no está medido).
 * Un fallo de red o de datos no se reintenta por otro lado: repetiría el mismo error.
 */
export function esFalloDePermiso(status: number, texto: string): boolean {
  if (status === 401 || status === 403 || status === 409) return true;
  return /permission|permiso|not authorized|no autorizad|\(#10\)|\(#200\)|code 200|código 200|code 10\b|código 10\b|does not have access|insufficient/i.test(texto);
}

// ── La conexión: cuentas publicitarias y píxeles que ve ──────────────────────

export type CuentaPublicitariaZernio = { id: string; nombre: string | null; moneda: string | null; estado: number | null; motivo: number | null; zonaHoraria?: string | null };

/**
 * Las cuentas publicitarias de `GET /v1/ads/accounts?accountId=` (las que la conexión administra), con el estado de Meta
 * (`accountStatus`: 1 activa, 2 deshabilitada, 3 saldo impago…) y su `disableReason`. null si no trae lista.
 */
export function cuentasDeZernio(body: unknown): CuentaPublicitariaZernio[] | null {
  if (!body || typeof body !== 'object') return null;
  const lista = (body as { accounts?: unknown }).accounts;
  if (!Array.isArray(lista)) return null;
  const out: CuentaPublicitariaZernio[] = [];
  for (const raw of lista) {
    if (!raw || typeof raw !== 'object') continue;
    const a = raw as { id?: unknown; name?: unknown; currency?: unknown; accountStatus?: unknown; disableReason?: unknown; timezoneName?: unknown };
    const id = typeof a.id === 'string' ? a.id.trim() : '';
    if (!/^act_\d{5,20}$/.test(id)) continue;
    out.push({
      id,
      nombre: typeof a.name === 'string' ? a.name : null,
      moneda: typeof a.currency === 'string' ? a.currency : null,
      estado: typeof a.accountStatus === 'number' ? a.accountStatus : null,
      motivo: typeof a.disableReason === 'number' ? a.disableReason : null,
      zonaHoraria: typeof a.timezoneName === 'string' ? a.timezoneName : null,
    });
  }
  return out;
}

export type PixelZernio = { id: string; nombre: string | null; activo: boolean };

/** Los píxeles de `GET /v1/accounts/{id}/conversion-destinations` (en Meta, un destino ES un píxel). null si no trae lista. */
export function pixelesDeZernio(body: unknown): PixelZernio[] | null {
  if (!body || typeof body !== 'object') return null;
  const lista = (body as { destinations?: unknown }).destinations;
  if (!Array.isArray(lista)) return null;
  const out: PixelZernio[] = [];
  for (const raw of lista) {
    if (!raw || typeof raw !== 'object') continue;
    const d = raw as { id?: unknown; name?: unknown; status?: unknown };
    const id = typeof d.id === 'string' ? d.id.trim() : typeof d.id === 'number' ? String(d.id) : '';
    if (!/^\d{6,20}$/.test(id)) continue;
    out.push({ id, nombre: typeof d.name === 'string' ? d.name : null, activo: d.status !== 'inactive' });
  }
  return out;
}

/**
 * Qué se guarda solo al conectar: lo INEQUÍVOCO (como `guardarConexionMeta` con el token). Con una sola cuenta publicitaria,
 * ésa; con varias, la que ya estaba elegida si sigue entre las que se ven, y si no la elige la persona. Lo mismo el píxel.
 */
export function eleccionInicial(p: {
  cuentas: readonly CuentaPublicitariaZernio[]; pixeles: readonly PixelZernio[]; cuentaActual: string | null; pixelActual: string | null;
}): { cuenta: string | null; pixel: string | null } {
  const act = p.cuentaActual?.trim() || null;
  const pix = p.pixelActual?.trim() || null;
  const cuenta = act && p.cuentas.some((c) => c.id === act) ? act : p.cuentas.length === 1 ? p.cuentas[0].id : null;
  const activos = p.pixeles.filter((x) => x.activo);
  const pixel = pix && p.pixeles.some((x) => x.id === pix) ? pix : activos.length === 1 ? activos[0].id : null;
  return { cuenta, pixel };
}

// ── La salud de la cuenta: el mismo objeto crudo que devuelve `GET /{act}` ───

/**
 * La cuenta como la devuelve Meta (`GET /{act}?fields=name,account_status,…`), armada con lo que lee Zernio: la lista de
 * cuentas (`accountStatus`, `disableReason`, `currency`, `timezoneName`) y sus finanzas (`/v1/ads/accounts/finance`).
 * Así `computeAccountHealth` (lib/meta-health.ts) juzga igual venga de donde venga.
 * ⚠️ Zernio da las finanzas en UNIDADES de la moneda; Meta, en la unidad MÍNIMA (centavos, salvo COP, CLP, JPY…). Se
 * vuelven a la mínima con `aMinima` (`aUnidadMeta`), porque `computeAccountHealth` divide.
 * `is_prepay_account` y el país fiscal no vienen por Zernio: quedan afuera (el país sale de la zona horaria).
 */
export function cuentaCrudaDesdeZernio(
  cuenta: CuentaPublicitariaZernio,
  finanzas: { balance?: unknown; amountSpent?: unknown; spendCap?: unknown; currency?: unknown; fundingSource?: unknown } | null,
  aMinima: (monto: number, moneda: string | null) => number,
): Record<string, unknown> {
  const moneda = (typeof finanzas?.currency === 'string' && finanzas.currency) || cuenta.moneda || null;
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const fs = finanzas?.fundingSource as { displayString?: unknown } | null | undefined;
  const balance = n(finanzas?.balance);
  const gastado = n(finanzas?.amountSpent);
  const tope = n(finanzas?.spendCap);
  return {
    id: cuenta.id,
    name: cuenta.nombre ?? undefined,
    account_status: cuenta.estado ?? undefined,
    disable_reason: cuenta.motivo ?? 0,
    ...(moneda ? { currency: moneda } : {}),
    ...(balance != null ? { balance: aMinima(balance, moneda) } : {}),
    ...(gastado != null ? { amount_spent: aMinima(gastado, moneda) } : {}),
    ...(tope != null ? { spend_cap: aMinima(tope, moneda) } : {}),
    ...(fs && typeof fs.displayString === 'string' ? { funding_source_details: { display_string: fs.displayString } } : {}),
    ...(cuenta.zonaHoraria ? { timezone_name: cuenta.zonaHoraria } : {}),
  };
}

// ── El video y la imagen de un anuncio (para transcribirlo) ──────────────────

export type MediaDeAnuncio = { video: { url: string; videoId: string | null; segundos: number | null } | null; imagen: string | null };

/**
 * `GET /v1/ads/{adId}/media`: los links DIRECTOS y firmados de cada video e imagen que usa el anuncio (Zernio los lee en vivo
 * de Meta). Es la salida al `source` que Meta dejó de devolver por la Graph API (docs/hallazgos-ads.md). El primero de cada
 * tipo: el anuncio de un video tiene uno; un carrusel, varios (se transcribe el primero, como con el token). null si la
 * respuesta no trae lista. ⚠️ Los links vencen (una imagen ~24 h, un video ~12 días): se bajan en el momento, no se guardan.
 */
export function mediaDeAnuncio(body: unknown): MediaDeAnuncio | null {
  if (!body || typeof body !== 'object') return null;
  const lista = (body as { media?: unknown }).media;
  if (!Array.isArray(lista)) return null;
  const http = (u: unknown): u is string => typeof u === 'string' && /^https:\/\//i.test(u);
  let video: MediaDeAnuncio['video'] = null;
  let imagen: string | null = null;
  for (const raw of lista) {
    if (!raw || typeof raw !== 'object') continue;
    const m = raw as { type?: unknown; url?: unknown; videoId?: unknown; length?: unknown; thumbnailUrl?: unknown };
    if (m.type === 'video' && !video && http(m.url)) {
      video = { url: m.url, videoId: typeof m.videoId === 'string' ? m.videoId : null, segundos: typeof m.length === 'number' ? m.length : null };
      if (!imagen && http(m.thumbnailUrl)) imagen = m.thumbnailUrl;
    } else if (m.type === 'image' && http(m.url) && !imagen) imagen = m.url;
  }
  return { video, imagen };
}

// ── La página de los anuncios: sin ella, con varias, la conexión no se crea ──

/** Un id de página de Facebook: sólo dígitos. */
export const ID_PAGINA = /^\d{5,20}$/;

export type PaginaFacebook = { id: string; nombre: string | null };

/** Las páginas de `GET /v1/accounts/{id}/facebook-page` (de una conexión `facebook` o `metaads`) y la elegida ahí. null si no trae lista. */
export function paginasDeZernio(body: unknown): { paginas: PaginaFacebook[]; elegida: string | null } | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as { pages?: unknown; selectedPageId?: unknown };
  if (!Array.isArray(b.pages)) return null;
  const paginas: PaginaFacebook[] = [];
  for (const raw of b.pages) {
    if (!raw || typeof raw !== 'object') continue;
    const p = raw as { id?: unknown; name?: unknown };
    const id = typeof p.id === 'string' ? p.id.trim() : typeof p.id === 'number' ? String(p.id) : '';
    if (ID_PAGINA.test(id)) paginas.push({ id, nombre: typeof p.name === 'string' ? p.name : null });
  }
  const elegida = typeof b.selectedPageId === 'string' && ID_PAGINA.test(b.selectedPageId) ? b.selectedPageId : null;
  return { paginas, elegida };
}

/**
 * Con qué página se abre «Conectar con Facebook». Medido el 25/10/2026 con la cuenta de MaKo: con VARIAS páginas concedidas y
 * sin `pageId`, Zernio NO crea la conexión (el primer clic volvió sin nada; el segundo, con la página fija, conectó). Zernio
 * lo dice en su doc: «Multiple Pages without a selection return 400… restart with pageId», y su propia app muestra un selector.
 *   · La que eligió la persona en la pantalla, primero.
 *   · La del negocio (`META_PAGE_ID`): la eligió una persona (en la conexión vieja, o con `elegir_pagina_meta` de la API).
 *   · Si MaKo conoce UNA sola (la de su Facebook en Zernio), ésa: se deduce, no se pregunta.
 *   · Con varias, se pregunta, con la sugerida marcada (la elegida en su Facebook de Zernio).
 *   · Sin ninguna conocida, se abre sin página: si el negocio tiene una sola, Zernio usa ésa; si vuelve sin conexión, se pregunta.
 */
export function paginaParaConectar(p: {
  elegida: string | null; delNegocio: string | null; candidatas: readonly PaginaFacebook[]; sugeridaDeZernio: string | null;
}): { pageId: string | null; preguntar: boolean; sugerida: string | null } {
  if (p.elegida && ID_PAGINA.test(p.elegida)) return { pageId: p.elegida, preguntar: false, sugerida: p.elegida };
  if (p.delNegocio && ID_PAGINA.test(p.delNegocio)) return { pageId: p.delNegocio, preguntar: false, sugerida: p.delNegocio };
  const ids = [...new Set(p.candidatas.map((c) => c.id))];
  if (ids.length === 1) return { pageId: ids[0], preguntar: false, sugerida: ids[0] };
  if (ids.length === 0) return { pageId: null, preguntar: false, sugerida: null };
  const sugerida = p.sugeridaDeZernio && ids.includes(p.sugeridaDeZernio) ? p.sugeridaDeZernio : null;
  return { pageId: null, preguntar: true, sugerida };
}

/** Las páginas conocidas, sin repetir, con su nombre si alguna fuente lo trae (el `META_PAGE_ID` solo no lo trae). */
export function unirPaginas(...listas: ReadonlyArray<readonly PaginaFacebook[]>): PaginaFacebook[] {
  const por = new Map<string, PaginaFacebook>();
  for (const l of listas) for (const p of l) {
    const ya = por.get(p.id);
    if (!ya || (!ya.nombre && p.nombre)) por.set(p.id, p);
  }
  return [...por.values()];
}

// ── El corte del token de Meta para ADMINISTRAR anuncios (25/10/2026) ───────

/**
 * Martín, 25/10: «manda un aviso a todos los clientes que conecten Zernio y si no conectan dentro de 1 semana ya no podrán
 * administrar anuncios en MaKo». Desde este día (AAAA-MM-DD, hora de Argentina) el token de Meta deja de servir para ESCRIBIR
 * (crear, editar, pausar, presupuesto, borrar); leer métricas sigue. null = sin corte. Lo fija el Cerebro el día que sale el
 * aviso: una semana después de ese día.
 */
// Fijado el 26/10/2026: el aviso sale el lunes 27/10 a las 10:00 a los cinco negocios que usan el token (lo aprobó Martín) y el
// corte es una semana después.
export const CORTE_TOKEN_META: string | null = '2026-11-03';

/** ¿Este negocio ya no puede administrar anuncios con el token? Sólo pasado el corte y sin la conexión de Zernio. */
export function tokenMetaVencido(p: { corte: string | null; hoy: string; viaZernio: boolean }): boolean {
  if (!p.corte || !/^\d{4}-\d{2}-\d{2}$/.test(p.corte) || p.viaZernio) return false;
  return p.hoy >= p.corte;
}

/**
 * El evento de las PRUEBAS de CAPI (`probar_capi_meta`, scripts/prueba-zernio-meta.mts). NO es un «Lead» a propósito: medido el
 * 25/10/2026, Zernio NO reenvía el `testCode` (el código de «Probar eventos»): los Lead de prueba entraron al píxel de MaKo como
 * eventos REALES (en `/{pixel}/stats`, Lead con la clave de match `email` y nada más). Un evento propio no cuenta como contacto
 * ni mueve la optimización de nadie, y se ve en la vista general del píxel.
 */
export const EVENTO_DE_PRUEBA_CAPI = 'PruebaMaKo';

/** Lo que lee la persona cuando una escritura se frena por el corte: qué pasó y dónde se arregla. */
export function avisoTokenVencido(corte: string): string {
  const [a, m, d] = corte.split('-');
  return `Desde el ${d}/${m}/${a} MaKo administra tus anuncios sólo con tu conexión de Zernio. Conéctala en Integraciones → Zernio y vuelve a intentarlo.`;
}

/** Hoy en Argentina (AAAA-MM-DD): el corte es un día del calendario de Martín, no de UTC. */
export function hoyEnArgentina(ahora = new Date()): string {
  return new Date(ahora.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
}
