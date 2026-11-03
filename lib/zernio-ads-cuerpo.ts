// =============================================================================
// Publicar y editar anuncios por Zernio: la parte PURA (23/10/2026)
// =============================================================================
// Por qué existe: con el token que pega cada cliente (su app propia de Meta, casi siempre en
// desarrollo) MaKo lee métricas y leads, crea campañas y conjuntos, pausa y cambia presupuestos,
// pero un anuncio con creativo NUEVO (`object_story_spec`) nace como un post de ESA app y Meta lo
// rechaza con el 1885183 (ws13: 14 de 14; ws1, con su app activa: 5 de 5). Cambiar textos o creativo
// de un anuncio vivo crea otro creativo y choca igual. Martín, 23/10: «lo único que no podemos es
// publicar o editar campañas» → «vamos por Zernio directo… que cada usuario traiga su API de Zernio».
//
// Así que Zernio hace SÓLO eso: crea el ANUNCIO dentro de un conjunto que ya creó MaKo (la forma
// «attach» de `POST /v1/ads/create`, con `adSetId`) y cambia el creativo de un anuncio vivo
// (`PUT /v1/ads/{adId}` con `creative`). Lo demás sigue con el token del cliente: si Zernio se cae,
// sólo se cae publicar. Contrato leído en docs.zernio.com (ad-campaigns/create-standalone-ad y
// update-ad, 23/10/2026); docs/hallazgos-ads.md → «Publicar por Zernio».
//
// ⚠️ NO PROBADO CONTRA META TODAVÍA. Que la app de Meta de Zernio esté activa y con acceso avanzado
// lo dice sólo Zernio. La prueba que decide (un anuncio PAUSADO con creativo nuevo en una cuenta cuyo
// dueño no tiene rol en la app de Zernio) está en scripts/prueba-zernio-anuncio.mts y no corrió:
// hasta entonces `ZERNIO_ANUNCIOS_PROBADO` queda en false y la pantalla no ofrece conectarlo.
//
// Sin `server-only`: lo ejecutan los tests sin red.
// =============================================================================

import type { Creative, CTAType } from './campaign-types';

/** Se prende SÓLO con la prueba de scripts/prueba-zernio-anuncio.mts pasada, y con su resultado en hallazgos. */
export const ZERNIO_ANUNCIOS_PROBADO = false;

/** La conexión de anuncios de Zernio de un negocio: la cuenta `metaads` y SU cuenta publicitaria. */
export type ConexionAnunciosZernio = { accountId: string; adAccountId: string };

/**
 * ¿Por dónde sale este anuncio? Zernio sólo para lo que hoy falla con la app del cliente: un creativo
 * NUEVO. Reusar un post propio («Usar un ganador», `source: 'existing'`) pasa con el token del cliente
 * (medido el 16/09) y sigue por Meta. Sin conexión de Zernio, Meta como siempre.
 */
export function rutaDelAnuncio(creative: Pick<Creative, 'source'>, conexion: ConexionAnunciosZernio | null): 'zernio' | 'meta' {
  if (creative.source === 'existing') return 'meta';
  return conexion ? 'zernio' : 'meta';
}

/** El CTA de MaKo, como lo nombra Zernio (los mismos valores de Meta). Sin botón, ninguno. */
function cta(c: Pick<Creative, 'cta_type' | 'lead_form_id'>): CTAType | undefined {
  if (c.cta_type && c.cta_type !== 'NO_BUTTON') return c.cta_type;
  return c.lead_form_id ? ('SIGN_UP' as CTAType) : undefined;
}

const http = (u: string | null | undefined): string | undefined => (u && /^https?:\/\//i.test(u) ? u : undefined);

/**
 * El cuerpo de `POST /v1/ads/create` en su forma «attach»: UN anuncio, EN PAUSA, dentro del conjunto
 * que ya creó MaKo. Hereda presupuesto, público y calendario del conjunto (Zernio da 400 si se le pasa
 * `bidStrategy` acá, así que no se manda nada del conjunto).
 *
 * La media: un video ya subido a la cuenta va por su id (`video.id`, «id to reuse»); una imagen va por
 * URL (`imageUrl`), porque Zernio no documenta recibir el `image_hash` de Meta. Esa URL la resuelve el
 * server desde el hash (`act_<id>/adimages`): la `thumbnail_url` del creativo suele ser la vista LOCAL
 * del navegador (un `data:`), que el modal prefiere a la de Meta. Sin media no se arma: tira, y quien
 * llama no publica a medias.
 */
export function cuerpoAnuncioEnConjunto(x: {
  conexion: ConexionAnunciosZernio;
  adSetId: string;
  nombre: string;
  creative: Creative;
  pageId?: string | null;
  instagramAccountId?: string | null;
  /** La URL pública de la imagen en Meta (de su `image_hash`). */
  imagenUrl?: string | null;
}): Record<string, unknown> {
  const c = x.creative;
  const cuerpo: Record<string, unknown> = {
    accountId: x.conexion.accountId,
    adAccountId: x.conexion.adAccountId,
    adSetId: x.adSetId,
    name: x.nombre,
    status: 'PAUSED',
    adStatus: 'PAUSED',
    body: c.primary_text ?? '',
  };
  if (c.headline) cuerpo.headline = c.headline;
  if (c.description) cuerpo.description = c.description;
  const boton = cta(c);
  if (boton) cuerpo.callToAction = boton;
  if (c.destination_url) cuerpo.linkUrl = c.destination_url;
  if (c.lead_form_id) cuerpo.leadGenFormId = c.lead_form_id;
  if (x.pageId) cuerpo.pageId = x.pageId;
  if (x.instagramAccountId) cuerpo.instagramAccountId = x.instagramAccountId;
  if (c.media_type === 'video' && (c.video_id || http(c.video_url))) {
    // Por su id si ya está en la cuenta; si no, por LINK (`video.url`: Zernio lo baja y lo sube a Meta; el anuncio desde el grupo,
    // lib/anuncio-desde-archivo.ts).
    const video: Record<string, unknown> = c.video_id ? { id: c.video_id } : { url: http(c.video_url) };
    const mini = http(c.thumbnail_url);
    if (mini) video.thumbnailUrl = mini;
    cuerpo.video = video;
  } else {
    const img = http(x.imagenUrl) ?? http(c.thumbnail_url);
    if (!img) throw new Error('Para publicar por Zernio la imagen tiene que tener una dirección pública.');
    cuerpo.imageUrl = img;
  }
  return cuerpo;
}

/**
 * El cuerpo de `PUT /v1/ads/{adId}` para cambiar los TEXTOS: sólo lo que cambió, adentro de `creative`.
 * Zernio lo aplica como parche (conserva la media y los url_tags del creativo vivo) y crea un creativo
 * nuevo, porque en Meta son inmutables.
 */
export function cuerpoCambiarTextos(edited: { primary_text?: string; headline?: string; description?: string; cta_type?: string; destination_url?: string }): Record<string, unknown> {
  const creative: Record<string, unknown> = {};
  if (edited.primary_text != null) creative.body = edited.primary_text;
  if (edited.headline != null) creative.headline = edited.headline;
  if (edited.description != null) creative.description = edited.description;
  if (edited.cta_type && edited.cta_type !== 'NO_BUTTON') creative.callToAction = edited.cta_type;
  if (edited.destination_url != null) creative.linkUrl = edited.destination_url;
  if (!Object.keys(creative).length) throw new Error('No hay ningún texto para cambiar.');
  return { creative };
}

/** El id de Meta del anuncio creado: `ad.platformAdId` (forma de un anuncio) o el primero de `ads[]`. */
export function idsDelAnuncioCreado(r: unknown): { adId: string; zernioId: string | null } {
  const o = (r ?? {}) as { ad?: Record<string, unknown>; ads?: Array<Record<string, unknown>> };
  const ad = o.ad ?? o.ads?.[0];
  const adId = ad?.platformAdId != null ? String(ad.platformAdId) : '';
  if (!adId) throw new Error('Zernio no devolvió el id del anuncio en Meta (platformAdId).');
  return { adId, zernioId: ad?._id != null ? String(ad._id) : null };
}

/**
 * El subcode de Meta que viene dentro de un error de Zernio (`platformError.error_subcode`, «passed
 * through verbatim»). Lo usa la traducción de rechazos de siempre (lib/meta-publicar-errores.ts).
 */
export function subcodeDeZernio(body: unknown): number | null {
  const pe = (body as { platformError?: { error_subcode?: unknown } } | null)?.platformError;
  const n = Number(pe?.error_subcode);
  return Number.isFinite(n) && n > 0 ? n : null;
}
