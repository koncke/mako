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
// ⚠️ NADA DE ESTO ESTÁ PROBADO CONTRA LA CUENTA REAL. Lo decide la cuenta publicitaria de MaKo (act_1426493815659364)
// conectada a Zernio con el clic de Martín (scripts/prueba-zernio-meta.mts). Hasta entonces `ZERNIO_META_PROBADO` queda
// en false y lo nuevo corre SÓLO en el negocio de la plataforma (el de MaKo), que es donde se prueba.
//
// Sin `server-only`: lo ejecutan los tests sin red.
// =============================================================================

import type { MetaInsightRaw } from './types';

/**
 * Se prende SÓLO con la prueba de scripts/prueba-zernio-meta.mts pasada en la cuenta de MaKo, y con su resultado en
 * docs/hallazgos-integraciones.md. Prendido: todo negocio con su conexión de anuncios de Zernio lee y escribe Meta por ahí,
 * y el token de Meta deja de pedirse en el onboarding y en Integraciones.
 */
export const ZERNIO_META_PROBADO = false;

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
export const CORTE_TOKEN_META: string | null = null;

/** ¿Este negocio ya no puede administrar anuncios con el token? Sólo pasado el corte y sin la conexión de Zernio. */
export function tokenMetaVencido(p: { corte: string | null; hoy: string; viaZernio: boolean }): boolean {
  if (!p.corte || !/^\d{4}-\d{2}-\d{2}$/.test(p.corte) || p.viaZernio) return false;
  return p.hoy >= p.corte;
}

/** Lo que lee la persona cuando una escritura se frena por el corte: qué pasó y dónde se arregla. */
export function avisoTokenVencido(corte: string): string {
  const [a, m, d] = corte.split('-');
  return `Desde el ${d}/${m}/${a} MaKo administra tus anuncios sólo con tu conexión de Zernio. Conéctala en Integraciones → Zernio y vuelve a intentarlo.`;
}

/** Hoy en Argentina (AAAA-MM-DD): el corte es un día del calendario de Martín, no de UTC. */
export function hoyEnArgentina(ahora = new Date()): string {
  return new Date(ahora.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
}
