// =============================================================================
// El video de UN anuncio para verlo en la hoja (#860), por donde le corresponde al negocio (18/11/2026, O8)
// =============================================================================
// Lo leía app/api/anuncios/video/route.ts con el token de Meta del workspace, y un negocio que conectó Meta por Zernio (el camino
// principal desde el 25/10, lib/meta-via.ts) no tiene token: el ▶ contestaba «Meta no configurado». Ahora:
//   · POR ZERNIO: `GET /v1/ads/{adId}/media` (`mediaDeAnuncio`, lib/zernio-meta-cuerpo.ts), el MISMO pedido con que se transcribe
//     el anuncio (lib/transcribe.ts): el link directo del .mp4, que la pantalla dibuja en un `<video>`. Si Zernio falla y el negocio
//     conserva el token de antes, se lee por ahí.
//   · POR EL TOKEN: el plugin de video de facebook.com sacado de `embed_html` (lib/anuncio-video.ts dice por qué ése), validado por
//     `srcDelReproductor`.
// ⚠️ El link de Zernio vence (~12 días para un video): se pide cada vez que se abre el ▶, nunca se guarda.
// =============================================================================

import 'server-only';
import { canalMeta, zernioGet, type CanalMeta } from './meta-via';
import { mediaDeAnuncio } from './zernio-meta-cuerpo';
import { srcDelReproductor, videoDelCreativo } from './anuncio-video';

const GRAPH = 'https://graph.facebook.com';
const TOPE_MS = 15_000;

/** `reproductor` = el src del plugin de facebook.com (por el token); `video` = el .mp4 directo (por Zernio). Los dos null = sin video. */
export type VideoDeAnuncio = { reproductor: string | null; video: string | null; permalink: string | null };

const SIN_VIDEO: VideoDeAnuncio = { reproductor: null, video: null, permalink: null };

/** Por el token: el anuncio, su video y el `embed_html` del video. Tira con el mensaje de Meta si falla (viene ADENTRO del cuerpo). */
async function porElToken(adId: string, token: string): Promise<VideoDeAnuncio> {
  const ver = process.env.META_API_VERSION;
  if (!ver) throw new Error('Meta no configurado');
  const leer = async (path: string, fields: string): Promise<Record<string, unknown>> => {
    const u = new URL(`${GRAPH}/${ver}/${path}`);
    u.searchParams.set('fields', fields);
    u.searchParams.set('access_token', token);
    const r = await fetch(u, { cache: 'no-store', signal: AbortSignal.timeout(TOPE_MS) });
    const b = (await r.json().catch(() => null)) as Record<string, unknown> | null;
    if (!b) throw new Error('Meta no contestó');
    const e = b.error as { message?: string } | undefined;
    if (e) throw new Error(e.message ?? 'Meta devolvió un error');
    return b;
  };
  const ad = await leer(adId, 'creative{video_id,object_story_spec}');
  const video = videoDelCreativo(ad.creative);
  if (!video) return SIN_VIDEO;
  const v = await leer(video, 'embed_html,permalink_url');
  const p = typeof v.permalink_url === 'string' ? v.permalink_url : null;
  const permalink = p ? (p.startsWith('http') ? p : `https://www.facebook.com${p}`) : null;
  return { reproductor: srcDelReproductor(v.embed_html), video: null, permalink };
}

/** Por la Zernio del negocio: el .mp4 del anuncio. Tira `ZernioError` o un Error si la respuesta no trae la lista. */
async function porZernio(c: Extract<CanalMeta, { via: 'zernio' }>, adId: string): Promise<VideoDeAnuncio> {
  const m = mediaDeAnuncio(await zernioGet(c, `/ads/${encodeURIComponent(adId)}/media`));
  if (!m) throw new Error('Zernio contestó el creativo sin la lista `media`');
  return { reproductor: null, video: m.video?.url ?? null, permalink: null };
}

/** El video del anuncio en el negocio `ws` (o el del contexto). Sin Meta conectado, sin video. Tira si no lo pudo leer. */
export async function videoDeAnuncio(adId: string, ws?: number | null): Promise<VideoDeAnuncio> {
  const c = await canalMeta(ws);
  if (c.via === 'ninguna') return SIN_VIDEO;
  if (c.via === 'zernio') {
    try {
      return await porZernio(c, adId);
    } catch (e) {
      if (!c.respaldo) throw e;
      console.warn(`[anuncio-video] el video de ${adId} por Zernio falló, sigo por el token: ${e instanceof Error ? e.message : String(e)}`);
      return porElToken(adId, c.respaldo);
    }
  }
  return porElToken(adId, c.token);
}
