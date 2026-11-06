// =============================================================================
// Publicar y editar anuncios por Zernio, con la cuenta de Zernio DEL NEGOCIO (23/10/2026)
// =============================================================================
// El porqué y el contrato están en lib/zernio-ads-cuerpo.ts (la parte pura). Acá, lo que habla con
// Zernio: qué clave se usa, cuál es la conexión de anuncios del negocio, crear el anuncio dentro de un
// conjunto y cambiarle los textos a uno vivo.
//
// LA CLAVE ES DEL NEGOCIO (BYOK), SIEMPRE. Martín, 23/10: «que cada usuario traiga su API de Zernio».
// Para un cliente se lee con `credDelCliente`: nunca cae a la de la plataforma (la que usa el canal de
// Instagram, lib/zernio.ts, sí cae; acá NO, porque un anuncio es plata y cuentas del cliente). La única
// excepción es el negocio de la PLATAFORMA (`wsSuperAdmin`, el de MaKo), donde la clave de la plataforma
// ES la suya: ahí corre la prueba que decide (scripts/prueba-zernio-anuncio.mts).
//
// Nunca tira por «no hay Zernio»: devuelve null, y quien llama publica por Meta como siempre.

import 'server-only';
import { credDelCliente, envCred } from './credenciales';
import { wsSuperAdmin } from './workspace';
import { cfgDeCuenta, ZernioError, type ZernioErrorBody } from './zernio';
import { ENV_CUENTA_ZERNIO } from './zernio-meta-cuerpo';
import { esDeLaCuenta, normalizarCuentaMeta } from './meta-cuenta-id';
import { cuerpoCambiarTextos, idsDelAnuncioCreado, subcodeDeZernio, type ConexionAnunciosZernio } from './zernio-ads-cuerpo';

const ZERNIO_BASE = 'https://zernio.com/api/v1';

/** La clave de Zernio con la que este negocio publica, o null. Nunca la de la plataforma para un cliente. */
export async function claveZernioAnuncios(ws: number): Promise<string | null> {
  if (ws === (await wsSuperAdmin().catch(() => null))) return envCred('ZERNIO_API_KEY');
  const base = await credDelCliente('ZERNIO_API_KEY', ws);
  if (!base) return null;
  // Con varias claves (29/10/2026), la DUEÑA de la conexión de anuncios (`META_ZERNIO_CUENTA`): «Anuncios de Meta» pudo quedar en la
  // clave 2. Sin conexión todavía, o si no se puede averiguar, la 1 (lo de siempre).
  const conexion = await credDelCliente(ENV_CUENTA_ZERNIO, ws).catch(() => null);
  if (!conexion) return base;
  return (await cfgDeCuenta(ws, conexion).catch(() => null))?.apiKey ?? base;
}

async function zAds<T>(clave: string, path: string, init?: RequestInit & { headers?: Record<string, string> }, timeoutMs = 90_000): Promise<T> {
  const res = await fetch(`${ZERNIO_BASE}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${clave}`, 'content-type': 'application/json', ...(init?.headers ?? {}) },
    // Crear un anuncio sube media y espera a Meta: más que los 20 s del canal.
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = null; }
  if (!res.ok) {
    const b: ZernioErrorBody = body != null && typeof body === 'object' ? (body as ZernioErrorBody) : { error: text.slice(0, 300) };
    throw new ZernioError(`Zernio ${res.status}: ${b.error ?? text.slice(0, 200)}`, res.status, b);
  }
  if (body == null) throw new ZernioError(`Zernio: respuesta no-JSON en ${path}`, res.status, { error: text.slice(0, 300) });
  // Un 200 no es «salió bien» (AGENTS.md): `success: false` es un fallo.
  if ((body as { success?: unknown }).success === false) {
    const b = body as ZernioErrorBody;
    throw new ZernioError(`Zernio: ${b.error ?? 'success: false'}`, res.status, b);
  }
  return body as T;
}

type CuentaZernio = { _id: string; platform: string };

/**
 * La conexión de anuncios del negocio: una cuenta `metaads` de SU Zernio que administra SU cuenta
 * publicitaria (la de `META_AD_ACCOUNT_ID`, o la que se pase). null si no hay clave, no hay conexión, o
 * ninguna conexión ve esa cuenta: entonces se publica por Meta como siempre.
 *
 * ⚠️ Se pregunta por la cuenta publicitaria EXACTA (`GET /v1/ads/accounts?adAccountId=`): con la clave
 * de la plataforma la lista de conexiones no es sólo de este negocio, y publicar en otra cuenta sería
 * el peor error posible acá.
 */
export async function conexionAnunciosZernio(ws: number, adAccountId: string | null): Promise<ConexionAnunciosZernio | null> {
  const clave = await claveZernioAnuncios(ws);
  const act = adAccountId ? normalizarCuentaMeta(adAccountId) : null;
  if (!clave || !act) return null;
  const r = await zAds<{ accounts?: CuentaZernio[] }>(clave, '/accounts?platform=metaads');
  for (const a of (r.accounts ?? []).filter((x) => x.platform === 'metaads')) {
    const q = new URLSearchParams({ accountId: a._id, adAccountId: act });
    const l = await zAds<{ accounts?: Array<{ id?: string }> }>(clave, `/ads/accounts?${q.toString()}`).catch(() => null);
    if (l?.accounts?.some((x) => x.id === act)) return { accountId: a._id, adAccountId: act };
  }
  return null;
}

/**
 * El link para conectar la cuenta publicitaria a la Zernio del negocio (inicio de sesión para empresas
 * de Meta, `loginMode=business`: crea una conexión `metaads` aparte). La ventana de Facebook dice
 * «Zernio», no MaKo. El profile es el Default de SU cuenta de Zernio.
 */
export async function urlConectarAnunciosZernio(ws: number, redirectUrl: string, adAccountId?: string | null): Promise<{ url: string } | { yaConectado: true }> {
  const clave = await claveZernioAnuncios(ws);
  if (!clave) throw new ZernioError('Este negocio no tiene su clave de Zernio', 0, null);
  const p = await zAds<{ profiles?: Array<{ _id: string; isDefault?: boolean }> }>(clave, '/profiles');
  const perfil = (p.profiles ?? []).find((x) => x.isDefault) ?? p.profiles?.[0];
  if (!perfil) throw new ZernioError('Zernio: la cuenta no tiene ningún profile para conectar', 0, null);
  // `advertise` (Administrar campañas) alcanza para campañas, conjuntos, creativos, anuncios y reportes, y es lo que
  // un dueño le da a una integración sin darle la facturación. Con la cuenta publicitaria se acota lo que Zernio
  // sincroniza a ESA cuenta (medido el 25/10/2026 con la de MaKo: devuelve la ventana de Facebook).
  const q = new URLSearchParams({ profileId: perfil._id, loginMode: 'business', permissionLevel: 'advertise', redirect_url: redirectUrl });
  const act = adAccountId ? normalizarCuentaMeta(adAccountId) : null;
  if (act) q.set('adAccountId', act);
  const r = await zAds<{ authUrl?: string; alreadyConnected?: boolean }>(clave, `/connect/facebook/ads?${q.toString()}`);
  if (r.alreadyConnected) return { yaConectado: true };
  if (!r.authUrl) throw new ZernioError('Zernio no devolvió el link para conectar', 0, null);
  return { url: r.authUrl };
}

/** Crea UN anuncio (en pausa) con el cuerpo de `cuerpoAnuncioEnConjunto`. Devuelve el id de Meta. */
/**
 * `timeoutMs`: con un video por URL (`video.url`), Zernio lo baja, lo sube a Meta y espera que lo procese antes de contestar:
 * puede pasar del minuto. Si el tiempo se corta, reintentar con la MISMA clave de idempotencia devuelve la respuesta original.
 */
export async function crearAnuncioPorZernio(ws: number, cuerpo: Record<string, unknown>, idempotencia: string, timeoutMs = 90_000): Promise<{ adId: string; zernioId: string | null }> {
  const clave = await claveZernioAnuncios(ws);
  if (!clave) throw new ZernioError('Este negocio no tiene su clave de Zernio', 0, null);
  const r = await zAds<unknown>(clave, '/ads/create', {
    method: 'POST',
    // Un reintento después de un corte no publica dos veces (Zernio acepta Idempotency-Key, tope 255).
    headers: { 'Idempotency-Key': idempotencia.slice(0, 255) },
    body: JSON.stringify(cuerpo),
  }, timeoutMs);
  return idsDelAnuncioCreado(r);
}

/**
 * Un fallo de Zernio, leído: su mensaje y el subcode de Meta que trae adentro (`platformError`). null si no
 * es de Zernio. Lo usa lib/meta-ads-create.ts para traducirlo a su error sin importar el cliente de Zernio.
 */
export function leerErrorDeZernio(e: unknown): { mensaje: string; subcode: number | null } | null {
  if (!(e instanceof ZernioError)) return null;
  return { mensaje: e.body?.error ?? e.message, subcode: subcodeDeZernio(e.body) };
}

/** Cambia los textos de un anuncio vivo (Zernio crea el creativo nuevo y lo apunta). */
export async function cambiarTextosPorZernio(
  ws: number,
  adId: string,
  edited: { primary_text?: string; headline?: string; description?: string; cta_type?: string; destination_url?: string },
): Promise<void> {
  const clave = await claveZernioAnuncios(ws);
  if (!clave) throw new ZernioError('Este negocio no tiene su clave de Zernio', 0, null);
  await zAds<unknown>(clave, `/ads/${encodeURIComponent(adId)}`, { method: 'PUT', body: JSON.stringify(cuerpoCambiarTextos(edited)) });
}

// =============================================================================
// El Media Buyer opera la cuenta por Zernio (25/10/2026)
// =============================================================================
// Martín, 25/10: «que ya funcione el tema de Zernio para que funcione completamente el tema de Meta». Lo que el
// agente necesita, leído en el OpenAPI de Zernio v1.353.0 (zernio.com/openapi.json, 25/10/2026):
//   · prender o pausar: PUT /v1/ads/campaigns/{id}/status · /ad-sets/{id}/status · /ads/{id}/status. Leen el
//     interruptor EN VIVO antes de escribir y, si ya estaba así, no escriben (`skipped: 1`).
//   · presupuesto diario: PUT /v1/ads/campaigns/{id} (CBO; en ABO contesta 409) o PUT /v1/ads/ad-sets/{id} (ABO), con
//     `budget: { amount, type: 'daily' }` en la MONEDA de la cuenta, en unidades (no centavos).
//   · variar un anuncio: POST /v1/ads/{id}/duplicate (en pausa, mismo conjunto) y PUT /v1/ads/{copia} con el
//     `creative` nuevo (Zernio crea el creativo, como Meta: son inmutables).
//   · leer: GET /v1/ads/tree (campañas → conjuntos → anuncios con métricas y presupuestos).
// `platform: 'facebook'` es obligatorio en campañas y conjuntos: los ids de plataforma no son únicos entre redes.
// =============================================================================

export type EstadoMeta = 'ACTIVE' | 'PAUSED';

/**
 * Prende o pausa una campaña, un conjunto o un anuncio. Devuelve el interruptor leído DESPUÉS (o null si Zernio no lo pudo leer).
 * ⚠️ Medido el 25/10/2026: a una campaña que en Zernio no tiene anuncios (recién creada, o con el anuncio rechazado por Meta)
 * este endpoint le contesta 404 «Campaign not found», y no acepta `accountId` (sólo `status` y `platform`). Con anuncios anda.
 */
export async function cambiarEstadoPorZernio(ws: number, nivel: 'campaign' | 'adset' | 'ad', id: string, estado: EstadoMeta): Promise<{ leido: string | null; escribio: boolean }> {
  const clave = await claveZernioAnuncios(ws);
  if (!clave) throw new ZernioError('Este negocio no tiene su clave de Zernio', 0, null);
  const status = estado === 'ACTIVE' ? 'active' : 'paused';
  const ruta = nivel === 'campaign' ? `/ads/campaigns/${encodeURIComponent(id)}/status`
    : nivel === 'adset' ? `/ads/ad-sets/${encodeURIComponent(id)}/status` : `/ads/${encodeURIComponent(id)}/status`;
  const body = nivel === 'ad' ? { status } : { status, platform: 'facebook' };
  const r = await zAds<{ updated?: number; skipped?: number; platformCampaignStatus?: string | null; platformAdSetStatus?: string | null; configuredStatus?: string | null }>(clave, ruta, { method: 'PUT', body: JSON.stringify(body) });
  const leido = nivel === 'campaign' ? r.platformCampaignStatus ?? null : nivel === 'adset' ? r.platformAdSetStatus ?? null : r.configuredStatus ?? null;
  return { leido, escribio: r.updated === 1 };
}

/**
 * Cambia el presupuesto DIARIO (moneda de la cuenta, en unidades) de una campaña CBO o de un conjunto ABO.
 * `accountId` (la cuenta de Zernio): sin él, una campaña VACÍA en Zernio da 404 (medido el 25/10/2026; la OpenAPI lo pide
 * «sólo para una campaña vacía»). Sólo lo acepta el de campañas: el de conjuntos no lo declara y no se manda.
 */
export async function cambiarPresupuestoPorZernio(ws: number, nivel: 'campaign' | 'adset', id: string, monto: number, accountId?: string): Promise<{ monto: number | null }> {
  const clave = await claveZernioAnuncios(ws);
  if (!clave) throw new ZernioError('Este negocio no tiene su clave de Zernio', 0, null);
  if (!(monto > 0)) throw new ZernioError('Presupuesto inválido', 0, null);
  const ruta = nivel === 'campaign' ? `/ads/campaigns/${encodeURIComponent(id)}` : `/ads/ad-sets/${encodeURIComponent(id)}`;
  const r = await zAds<{ budget?: { amount?: number } }>(clave, ruta, {
    method: 'PUT', body: JSON.stringify({ platform: 'facebook', budget: { amount: Math.round(monto * 100) / 100, type: 'daily' }, ...(accountId && nivel === 'campaign' ? { accountId } : {}) }),
  });
  return { monto: r.budget?.amount ?? null };
}

/**
 * Una variación de un anuncio que ya existe: lo duplica EN PAUSA en su mismo conjunto y le cambia los textos.
 * Conserva todo lo demás del original (la media, el botón, el formulario o el link, la página y el Instagram).
 * Si cambiar los textos falla, la copia se BORRA: un anuncio igual al original no es una variación.
 */
export async function variacionPorZernio(
  ws: number,
  adId: string,
  textos: { primary_text?: string; headline?: string; cta_type?: string },
  opts: { nombre: string; idempotencia: string },
): Promise<{ adId: string }> {
  const clave = await claveZernioAnuncios(ws);
  if (!clave) throw new ZernioError('Este negocio no tiene su clave de Zernio', 0, null);
  const dup = await zAds<{ copiedAdId?: string }>(clave, `/ads/${encodeURIComponent(adId)}/duplicate`, {
    method: 'POST',
    headers: { 'Idempotency-Key': opts.idempotencia.slice(0, 255) },
    body: JSON.stringify({ statusOption: 'PAUSED', renameStrategy: 'DEEP_RENAME', renameSuffix: ` · ${opts.nombre}`.slice(0, 60) }),
  });
  const copia = dup.copiedAdId ? String(dup.copiedAdId) : '';
  if (!/^\d+$/.test(copia)) throw new ZernioError('Zernio no devolvió el id de la copia del anuncio', 0, null);
  try {
    await zAds<unknown>(clave, `/ads/${encodeURIComponent(copia)}`, { method: 'PUT', body: JSON.stringify(cuerpoCambiarTextos(textos)) });
  } catch (e) {
    await zAds<unknown>(clave, `/ads/${encodeURIComponent(copia)}`, { method: 'DELETE' }).catch(() => null);
    throw e;
  }
  return { adId: copia };
}

/** Borra un anuncio que creó MaKo (deshacer una variación). Zernio lo deja como `cancelled` en su árbol. */
export async function borrarAnuncioPorZernio(ws: number, adId: string): Promise<void> {
  const clave = await claveZernioAnuncios(ws);
  if (!clave) throw new ZernioError('Este negocio no tiene su clave de Zernio', 0, null);
  await zAds<unknown>(clave, `/ads/${encodeURIComponent(adId)}`, { method: 'DELETE' });
}

type ZBudget = { amount?: number; type?: string } | null | undefined;
type ZAd = { platformAdId?: string; name?: string; status?: string; configuredStatus?: string | null; platformCreatedAt?: string | null; creativeType?: string | null; metrics?: { spend?: number; impressions?: number; conversions?: number; reach?: number }; creative?: { thumbnailUrl?: string | null; imageUrl?: string | null } };
type ZAdSet = { platformAdSetId?: string; adSetName?: string; status?: string; createdTime?: string | null; adSetBudget?: ZBudget; ads?: ZAd[]; metrics?: { spend?: number } };
type ZCampaign = { platformCampaignId?: string; campaignName?: string; status?: string; platformCampaignStatus?: string | null; createdTime?: string | null; campaignBudget?: ZBudget; budgetLevel?: 'campaign' | 'adset' | null; currency?: string; adSets?: ZAdSet[] };

/**
 * El árbol de la cuenta por Zernio, con las métricas del rango. Para la cuenta que NO tiene token propio de Meta con
 * permisos de anuncios (la de MaKo: su token es el del botón, sin `ads_read`). Hasta 50 campañas, de la más nueva, con
 * el desglose DIARIO por anuncio (`timeIncrement=1&dailyLevel=ad`): de ahí salen las ventanas de 3, 7 y 14 días.
 */
export async function arbolPorZernio(ws: number, conexion: ConexionAnunciosZernio, desde: string, hasta: string): Promise<{ campanas: ZCampaign[]; moneda: string | null }> {
  const clave = await claveZernioAnuncios(ws);
  if (!clave) throw new ZernioError('Este negocio no tiene su clave de Zernio', 0, null);
  const q = new URLSearchParams({ accountId: conexion.accountId, adAccountId: conexion.adAccountId, platform: 'facebook', fromDate: desde, toDate: hasta, limit: '50', source: 'all', timeIncrement: '1', dailyLevel: 'ad' });
  const r = await zAds<{ campaigns?: ZCampaign[] }>(clave, `/ads/tree?${q.toString()}`);
  const campanas = r.campaigns ?? [];
  return { campanas, moneda: campanas.find((c) => c.currency)?.currency ?? null };
}

export type { ZCampaign, ZAdSet, ZAd };

/** Una campaña o un conjunto leído EN VIVO de Meta (GET /ads/accounts/live): su interruptor propio y su presupuesto de hoy. */
export type EnVivoZernio = { id: string; nombre: string | null; campanaId: string | null; configurado: string | null; entrega: string | null; presupuestoDia: number | null };

/**
 * Las campañas y los conjuntos de la cuenta, leídos en vivo por Zernio (OpenAPI v1.356+: `GET /ads/accounts/live`, una
 * llamada a Meta por pedido). Trae lo que el árbol sincronizado no tiene: `configuredStatus`, el interruptor PROPIO (el
 * dato lo pasó el chat «Zernio y CAPI», 25/10/2026). `completo` es false si quedó otra página sin leer.
 */
export async function enVivoPorZernio(ws: number, conexion: ConexionAnunciosZernio): Promise<{ campanas: EnVivoZernio[]; conjuntos: EnVivoZernio[]; completo: boolean; moneda: string | null }> {
  const clave = await claveZernioAnuncios(ws);
  if (!clave) throw new ZernioError('Este negocio no tiene su clave de Zernio', 0, null);
  type Fila = { platformCampaignId?: string; platformAdSetId?: string; campaignName?: string | null; adSetName?: string | null; configuredStatus?: string | null; platformCampaignStatus?: string | null; platformAdSetStatus?: string | null; dailyBudget?: number | null };
  const q = new URLSearchParams({ accountId: conexion.accountId, adAccountId: conexion.adAccountId, limit: '500' });
  const r = await zAds<{ currency?: string | null; campaigns?: Fila[]; adSets?: Fila[]; paging?: { campaigns?: { after?: string | null }; adSets?: { after?: string | null } } }>(clave, `/ads/accounts/live?${q.toString()}`);
  const fila = (id: string | undefined, f: Fila, entrega: string | null | undefined, nombre: string | null | undefined, campanaId: string | null): EnVivoZernio | null => (id
    ? { id, nombre: nombre ?? null, campanaId, configurado: f.configuredStatus ? f.configuredStatus.toUpperCase() : null, entrega: entrega ? entrega.toUpperCase() : null, presupuestoDia: typeof f.dailyBudget === 'number' ? f.dailyBudget : null }
    : null);
  return {
    campanas: (r.campaigns ?? []).map((f) => fila(f.platformCampaignId, f, f.platformCampaignStatus, f.campaignName, null)).filter((x): x is EnVivoZernio => !!x),
    conjuntos: (r.adSets ?? []).map((f) => fila(f.platformAdSetId, f, f.platformAdSetStatus, f.adSetName, f.platformCampaignId ?? null)).filter((x): x is EnVivoZernio => !!x),
    completo: !r.paging?.campaigns?.after && !r.paging?.adSets?.after,
    // La moneda de la cuenta: el árbol de una cuenta SIN anuncios no la trae, y sin ella la corrida se abstiene (moneda_sin_tasa).
    moneda: r.currency ?? null,
  };
}

/** Los textos de un anuncio leídos por Zernio (para cuando el negocio no tiene token propio de Meta). */
export async function leerAnuncioPorZernio(ws: number, adId: string): Promise<{ body: string | null; linkUrl: string | null } | null> {
  const clave = await claveZernioAnuncios(ws);
  if (!clave) return null;
  const r = await zAds<{ ad?: { creative?: { body?: string | null; linkUrl?: string | null } } | null }>(clave, `/ads/${encodeURIComponent(adId)}`);
  const c = r.ad?.creative;
  return c ? { body: c.body ?? null, linkUrl: c.linkUrl ?? null } : null;
}

/**
 * Crea una campaña ENTERA (campaña + conjunto + anuncio) con un creativo nuevo, por la Zernio del negocio: `POST /v1/ads/create`
 * en la forma «legacy». `status: 'PAUSED'` pausa la campaña (lo de adentro queda prendido: un solo «prender» la larga).
 * Devuelve los ids de Meta de las tres cosas.
 */
export async function crearCampanaPorZernio(ws: number, cuerpo: Record<string, unknown>, idempotencia: string, timeoutMs = 180_000): Promise<{ campaignId: string | null; adSetId: string | null; adId: string }> {
  const clave = await claveZernioAnuncios(ws);
  if (!clave) throw new ZernioError('Este negocio no tiene su clave de Zernio', 0, null);
  const r = await zAds<{ ad?: { platformAdId?: string; platformCampaignId?: string; platformAdSetId?: string } }>(clave, '/ads/create', {
    method: 'POST', headers: { 'Idempotency-Key': idempotencia.slice(0, 255) }, body: JSON.stringify(cuerpo),
  }, timeoutMs);
  const { adId } = idsDelAnuncioCreado(r);
  return { campaignId: r.ad?.platformCampaignId ? String(r.ad.platformCampaignId) : null, adSetId: r.ad?.platformAdSetId ? String(r.ad.platformAdSetId) : null, adId };
}

/**
 * Crea una campaña VACÍA (sin conjuntos ni anuncios), en pausa: `POST /ads/campaigns` (OpenAPI v1.357). En Meta el
 * presupuesto de acá es de la campaña (CBO). Sirve para medir las escrituras del Media Buyer en una cuenta sin método de
 * pago, donde Meta no deja crear anuncios (subcode 1359188).
 */
export async function crearCampanaVaciaPorZernio(ws: number, c: { accountId: string; adAccountId: string; nombre: string; presupuestoDia: number }, idempotencia: string): Promise<{ campaignId: string }> {
  const clave = await claveZernioAnuncios(ws);
  if (!clave) throw new ZernioError('Este negocio no tiene su clave de Zernio', 0, null);
  const r = await zAds<{ campaignId?: string }>(clave, '/ads/campaigns', {
    method: 'POST', headers: { 'Idempotency-Key': idempotencia.slice(0, 255) },
    body: JSON.stringify({ accountId: c.accountId, adAccountId: c.adAccountId, name: c.nombre, goal: 'traffic', status: 'PAUSED', budgetAmount: c.presupuestoDia, budgetType: 'daily', specialAdCategories: [] }),
  });
  if (!r.campaignId) throw new ZernioError('Zernio no devolvió el id de la campaña', 0, null);
  return { campaignId: String(r.campaignId) };
}

/**
 * El interruptor PROPIO de un anuncio, leído de Meta AHORA (`GET /ads/{adId}?live=true`). ⚠️ Medido el 25/10/2026: Zernio
 * guarda el estado de los anuncios y lo refresca cada 15 a 60 minutos (su doc: «Controllers that act on a switch should pass
 * live=true»); recién pausado, el árbol seguía diciendo prendido y «prender» se frenó con «Ya estaba prendido en Meta».
 */
export async function anuncioEnVivoPorZernio(ws: number, adId: string): Promise<{ configurado: string | null; entrega: string | null; estado: string | null }> {
  const clave = await claveZernioAnuncios(ws);
  if (!clave) throw new ZernioError('Este negocio no tiene su clave de Zernio', 0, null);
  const r = await zAds<{ ad?: { status?: string | null; configuredStatus?: string | null; platformStatus?: string | null } | null }>(clave, `/ads/${encodeURIComponent(adId)}?live=true`);
  const a = r.ad ?? null;
  // ⚠️ Un anuncio BORRADO vuelve con `configuredStatus: ACTIVE`: lo que dice que está borrado es `status` (cancelled) o la entrega (DELETED).
  return { configurado: a?.configuredStatus ? a.configuredStatus.toUpperCase() : null, entrega: a?.platformStatus ? a.platformStatus.toUpperCase() : null, estado: a?.status ?? null };
}

/** Borra una campaña (con lo que tenga adentro) por la Zernio del negocio. `accountId` hace falta si quedó vacía. */
export async function borrarCampanaPorZernio(ws: number, campaignId: string, accountId?: string): Promise<void> {
  const clave = await claveZernioAnuncios(ws);
  if (!clave) throw new ZernioError('Este negocio no tiene su clave de Zernio', 0, null);
  await zAds<unknown>(clave, `/ads/campaigns/${encodeURIComponent(campaignId)}`, { method: 'DELETE', body: JSON.stringify({ platform: 'facebook', ...(accountId ? { accountId } : {}) }) });
}

/**
 * Un conjunto con los campos pedidos, leído EN VIVO de Meta por Zernio (`GET /ads/ad-sets/{id}?fields=`, el paso directo: la
 * forma de la Graph API). Lo usa el Media Buyer para mirar el PÚBLICO de un conjunto antes de prenderlo o subirle el presupuesto
 * (lib/media-buyer/publico.ts). ⚠️ Comprueba que sea de la cuenta de la conexión: con la clave de la plataforma la conexión
 * puede ver otras cuentas, y decidir con el público de otra sería decidir sobre otro negocio.
 */
export async function conjuntoMetaPorZernio(ws: number, conexion: ConexionAnunciosZernio, adSetId: string, fields: string): Promise<Record<string, unknown>> {
  return objetoDeLaConexion(ws, conexion, 'adset', adSetId, fields);
}

/** Lo mismo para una campaña (`GET /ads/campaigns/{id}?fields=`): su interruptor, para releer una campaña recién creada. */
export async function campanaMetaPorZernio(ws: number, conexion: ConexionAnunciosZernio, campaignId: string, fields: string): Promise<Record<string, unknown>> {
  return objetoDeLaConexion(ws, conexion, 'campaign', campaignId, fields);
}

async function objetoDeLaConexion(ws: number, conexion: ConexionAnunciosZernio, nivel: 'campaign' | 'adset', id: string, fields: string): Promise<Record<string, unknown>> {
  const clave = await claveZernioAnuncios(ws);
  if (!clave) throw new ZernioError('Este negocio no tiene su clave de Zernio', 0, null);
  const q = new URLSearchParams({ accountId: conexion.accountId, fields: `account_id,${fields}` });
  const ruta = nivel === 'campaign' ? '/ads/campaigns/' : '/ads/ad-sets/';
  const r = await zAds<{ adSet?: Record<string, unknown> | null; campaign?: Record<string, unknown> | null }>(clave, `${ruta}${encodeURIComponent(id)}?${q.toString()}`, undefined, 30_000);
  const o = nivel === 'campaign' ? r.campaign : r.adSet;
  const que = nivel === 'campaign' ? 'la campaña' : 'el conjunto';
  if (!o || typeof o !== 'object') throw new ZernioError(`Zernio no devolvió ${que} ${id}`, 0, null);
  if (!esDeLaCuenta(o.account_id, conexion.adAccountId)) throw new ZernioError(`${que[0].toUpperCase()}${que.slice(1)} ${id} no es de la cuenta ${conexion.adAccountId}`, 0, null);
  return o;
}

/**
 * El creativo de un anuncio (su id en Meta), para lanzar una campaña con el mismo (`existingCreativeId`). Comprueba la cuenta
 * del anuncio. null si Zernio no lo trae.
 */
export async function creativoDeAnuncioPorZernio(ws: number, conexion: ConexionAnunciosZernio, adId: string): Promise<{ creativoId: string | null; nombre: string | null }> {
  const clave = await claveZernioAnuncios(ws);
  if (!clave) throw new ZernioError('Este negocio no tiene su clave de Zernio', 0, null);
  const r = await zAds<{ ad?: { platformAdAccountId?: string; name?: string | null; creative?: { creativeId?: string | null } | null } | null }>(clave, `/ads/${encodeURIComponent(adId)}?live=true`, undefined, 30_000);
  const a = r.ad;
  if (!a) throw new ZernioError(`Zernio no devolvió el anuncio ${adId}`, 0, null);
  if (!esDeLaCuenta(a.platformAdAccountId, conexion.adAccountId)) throw new ZernioError(`El anuncio ${adId} no es de la cuenta ${conexion.adAccountId}`, 0, null);
  const id = a.creative?.creativeId ? String(a.creative.creativeId) : null;
  return { creativoId: id && /^\d+$/.test(id) ? id : null, nombre: a.name ?? null };
}
