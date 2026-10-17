// =============================================================================
// anuncio-video — el reproductor de un video de Meta para verlo SIN SALIR de la hoja (#860, módulo puro)
// =============================================================================
// Martín, revisión del 16/10/2026 (1:14:00): en «Los anuncios que más te traen» «se corta la cara de la persona porque
// los anuncios normalmente son en vertical… Y número dos, debería poder reproducirse ahí mismo, sin necesidad de tener que
// redirigir a otra pestaña».
//
// QUÉ SE PROBÓ CONTRA META (17/10/2026, un anuncio del ws1, sólo lectura):
//   · `GET /{video_id}?fields=source` sigue SIN `source` (docs/hallazgos-ads.md, «Meta dejó de devolver `source`»).
//   · La vista previa del anuncio (`/{ad_id}/previews`) devuelve un iframe de business.facebook.com que SIN sesión de
//     Facebook contesta 400 y `X-Frame-Options: DENY`: a un cliente no le carga.
//   · `embed_html` del video: un iframe de www.facebook.com/plugins/video.php que sin sesión contesta 200, sin
//     `X-Frame-Options`, y con las URLs del .mp4 adentro (`sd_src`/`hd_src`). Es el que se usa.
// =============================================================================

/** El `src` del reproductor, sacado de `embed_html`, SÓLO si es el plugin de video de facebook.com (lo demás, null). */
export function srcDelReproductor(embedHtml: unknown): string | null {
  if (typeof embedHtml !== 'string') return null;
  const m = /\ssrc="([^"]+)"/.exec(embedHtml);
  if (!m) return null;
  try {
    const u = new URL(m[1].replace(/&amp;/g, '&'));
    if (u.protocol !== 'https:' || u.hostname !== 'www.facebook.com' || u.pathname !== '/plugins/video.php') return null;
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * ¿Las tarjetas de este gráfico son ANUNCIOS? (llevan el ▶). Las de Meta agrupadas por anuncio y las de guiones por guion:
 * en las dos, el `ref` de la fila es el id del anuncio (lib/graficos-datos.ts `r.anuncio`, lib/graficos-datos-extra.ts
 * `r.guion`). Otra dimensión (la campaña, el ángulo) agrupa varios anuncios: no hay UN video que reproducir.
 */
export function esTarjetaDeAnuncio(g: { fuente: string; dimension?: string | null }): boolean {
  return (g.fuente === 'meta' && g.dimension === 'anuncio') || (g.fuente === 'guiones' && g.dimension === 'guion');
}

/** El video de un anuncio, del `creative` que devuelve Meta (directo, o adentro de `object_story_spec`). */
export function videoDelCreativo(creative: unknown): string | null {
  const c = creative as { video_id?: unknown; object_story_spec?: { video_data?: { video_id?: unknown } } } | null | undefined;
  const id = c?.video_id ?? c?.object_story_spec?.video_data?.video_id;
  return typeof id === 'string' && /^\d+$/.test(id) ? id : null;
}
