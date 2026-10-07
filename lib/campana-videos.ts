// =============================================================================
// campana-videos — qué videos SUBIDOS lleva una publicación, y qué dice Meta de ellos
// =============================================================================
// Puro y sin `server-only`, a propósito: lo usan las rutas que crean en Meta (para
// preguntar ANTES de crear nada si Meta ya procesó cada video), lib/meta-ads-create.ts
// (para leer `video_status` y exigir la miniatura al publicar) y los tests.
//
// Por qué existe (tarea #59, 07/10/2026): el navegador daba por listo un video que Meta
// todavía no había procesado — la ruta de subida devolvía `processing` y los tres modales
// escribían `processing: false` sin mirarlo— y ninguna ruta lo comprobaba en el server.
// Con un video sin procesar, Meta rechaza el CREATIVO, o sea cuando la campaña y el
// conjunto ya existen, y todo termina en rollback. Preguntar antes no crea nada.
// =============================================================================

import type { AdSetSpec, CampaignSpec, Creative } from './campaign-types';

/** Un id de Meta: sólo dígitos. Va pegado en la URL de la Graph API (`?ids=`), así que
 *  lo que no sea un id no viaja. */
const ID_META = /^\d{1,30}$/;

/**
 * El mismo criterio que `buildObjectStorySpec` (lib/meta-ads-create.ts) para decidir que
 * un creativo es un VIDEO: `media_type === 'video'` con su `video_id`. Un ganador reusado
 * (`source: 'existing'`) no cuenta: viaja con el post de un anuncio que ya corre, su video
 * ya está procesado y su `video_id` no se manda.
 */
export function esVideoSubido(c: Partial<Creative> | null | undefined): c is Partial<Creative> & { video_id: string } {
  if (!c || c.source === 'existing' || c.media_type !== 'video') return false;
  return typeof c.video_id === 'string' && ID_META.test(c.video_id.trim());
}

/** Los video_id subidos de una lista de creativos, sin repetir y en orden. */
export function videosDeCreativos(creativos: ReadonlyArray<Partial<Creative> | null | undefined>): string[] {
  const out: string[] = [];
  for (const c of creativos) {
    if (!esVideoSubido(c)) continue;
    const id = c.video_id.trim();
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

export function videosDeConjunto(adset: Pick<AdSetSpec, 'ads'> | null | undefined): string[] {
  return videosDeCreativos((adset?.ads ?? []).map((a) => a?.creative));
}

export function videosDeCampana(spec: Pick<CampaignSpec, 'adsets'> | null | undefined): string[] {
  return videosDeCreativos((spec?.adsets ?? []).flatMap((s) => (s?.ads ?? []).map((a) => a?.creative)));
}

export type EstadoVideo = 'ready' | 'processing' | 'error';

/**
 * Lo que Meta dice de un video (`status.video_status`), en tres estados y un «no sé».
 *
 * - `'expired'` y cualquier valor que no conozcamos cuentan como `'error'`: un video que
 *   Meta no da por listo ni por en curso no se puede publicar.
 * - `null` = no se pudo leer (la lectura falló o vino sin el campo). ⚠️ NO bloquea: tratar
 *   «no pude leer» como «sin procesar» frenaría publicaciones sanas por un bache de red.
 *   Si de verdad faltaba, Meta lo rechaza al crear, como siempre.
 */
export function estadoDeVideoStatus(vs: unknown): EstadoVideo | null {
  if (typeof vs !== 'string' || !vs.trim()) return null;
  const v = vs.trim().toLowerCase();
  if (v === 'ready') return 'ready';
  if (v === 'processing') return 'processing';
  return 'error';
}

export type VideosSinProcesar = { procesando: string[]; conError: string[] };

/**
 * El texto del 409 que corta una publicación ANTES de crear nada. null = se puede seguir.
 * Corto: lo dibuja el pie del modal. El error manda sobre el «procesando», porque esperar
 * no lo arregla.
 */
export function motivoVideos(r: VideosSinProcesar | null | undefined): string | null {
  if (!r) return null;
  if (r.conError.length) {
    return r.conError.length === 1
      ? 'Meta no pudo procesar un video. Quítalo y súbelo de nuevo.'
      : `Meta no pudo procesar ${r.conError.length} videos. Quítalos y súbelos de nuevo.`;
  }
  if (r.procesando.length) {
    return r.procesando.length === 1
      ? 'Un video sigue procesándose en Meta. Espera unos minutos y vuelve a intentar.'
      : `${r.procesando.length} videos siguen procesándose en Meta. Espera unos minutos y vuelve a intentar.`;
  }
  return null;
}

/**
 * ¿A este creativo le falta la miniatura que Meta EXIGE para publicar un video?
 *
 * Meta pide `image_hash` o `image_url` en `video_data`: sin ninguna, el creativo se rechaza
 * con «Your ad needs a video thumbnail» (medido el 30/06, be1dc1ee). Y la `image_url` tiene
 * que ser http(s): una data: URL —el frame que dibuja `makeThumb` en el navegador— Meta no
 * la descarga (#3858258, y Threads la valida estricto).
 */
export function faltaMiniatura(c: Partial<Creative> | null | undefined): boolean {
  if (!c || c.media_type !== 'video' || !c.video_id) return false;
  if (c.image_hash) return false;
  return !(typeof c.thumbnail_url === 'string' && /^https?:\/\//i.test(c.thumbnail_url));
}
