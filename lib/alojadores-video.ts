// =============================================================================
// alojadores-video — el CATÁLOGO de videos de cada alojador conectado, con el id que manda el Pixel (25/10/2026)
// =============================================================================
// Pedido de Martín (por el Cerebro): «Implementa otros alojadores de video, no solo panda, como Vimeo u otros... y que
// los lugares donde consume eso, el Pixel de MaKo, web generator, cursos, etc, puedan traer datos de tus videos de
// esas herramientas conectadas». Hasta acá el único catálogo era el de Panda (`catalogoPanda`, lib/panda.ts): título,
// reproductor y portada de cada video, para nombrarlos sin esperar a que alguien los reproduzca.
//
// Lo que da la API de cada uno, leído en su documentación el 25/10/2026:
//   · Vimeo: GET /me/videos (token personal, Bearer): nombre, duración, reproductor (con su `h=` si es no listado),
//     portada y las reproducciones totales. Sus estadísticas por día son sólo de Enterprise (se piden a soporte).
//   · Wistia: GET /v1/medias.json (token, Bearer): nombre, duración y portada. Por día: /modern/stats/medias/{id}/by_date.
//   · Bunny Stream: GET /library/{biblioteca}/videos (clave de la biblioteca, header AccessKey): título, duración y
//     reproducciones. Por día: /library/{biblioteca}/statistics (viewsChart, watchTimeChart).
//   · Cloudflare Stream: GET /accounts/{cuenta}/stream (token, Bearer): nombre, duración, portada y el dominio
//     customer-… del reproductor. Por día da MINUTOS vistos (GraphQL), no reproducciones.
// Lo que mide a cada PERSONA (play, hasta dónde, dónde pausa) es el Pixel v27, igual en todos.
//
// ⚠️ ESTE ARCHIVO ES PURO: arma el video de cada respuesta. La llamada con la clave del negocio vive en
// lib/alojadores-video-api.ts. Las formas están probadas contra la documentación, NO contra una cuenta de verdad: para
// eso hace falta la clave de una cuenta real de cada alojador (tests/alojadores-video-catalogo.test.ts).
// =============================================================================

export type Alojador = 'panda' | 'vimeo' | 'wistia' | 'bunny' | 'cloudflare';

export type VideoAlojado = {
  alojador: Alojador;
  /** El id con el que lo manda el Pixel (lib/video-id.ts): así casan el catálogo y los eventos. */
  id: string;
  titulo: string;
  /** El reproductor para insertar (el src del iframe), como lo publica el alojador. */
  player: string;
  portada: string | null;
  /** En segundos, o null si el alojador no la dice (todavía procesando, por ejemplo). */
  duracion: number | null;
  /** Las reproducciones TOTALES, cuando la API las da en el listado. */
  reproducciones: number | null;
};

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {});
const txt = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
};
const https = (v: unknown): string | null => (/^https:\/\/[^\s"'<>]+$/.test(txt(v)) ? txt(v) : null);
const titulo = (v: unknown, id: string) => txt(v).slice(0, 200) || id;

/** Vimeo, una página de GET /me/videos. El id es el número de `uri` (/videos/123). */
export function videosDeVimeo(respuesta: unknown): VideoAlojado[] {
  const out: VideoAlojado[] = [];
  for (const v of Array.isArray(obj(respuesta).data) ? obj(respuesta).data as unknown[] : []) {
    const o = obj(v);
    const n = /^\/videos\/(\d+)/.exec(txt(o.uri))?.[1];
    const player = https(o.player_embed_url);
    if (!n || !player) continue;
    out.push({
      alojador: 'vimeo', id: `vimeo:${n}`, titulo: titulo(o.name, `vimeo:${n}`), player,
      portada: https(obj(o.pictures).base_link), duracion: num(o.duration), reproducciones: num(obj(o.stats).plays),
    });
  }
  return out;
}

/** Wistia, una página de GET /v1/medias.json (un arreglo). Sólo los videos (no los audios ni las imágenes). */
export function videosDeWistia(respuesta: unknown): VideoAlojado[] {
  const out: VideoAlojado[] = [];
  for (const v of Array.isArray(respuesta) ? respuesta : []) {
    const o = obj(v);
    const h = txt(o.hashed_id);
    if (!/^[a-z0-9]{6,20}$/i.test(h) || (o.type !== undefined && o.type !== 'Video')) continue;
    out.push({
      alojador: 'wistia', id: `w:${h}`, titulo: titulo(o.name, `w:${h}`), player: `https://fast.wistia.net/embed/iframe/${h}`,
      portada: https(obj(o.thumbnail).url), duracion: num(o.duration), reproducciones: null,
    });
  }
  return out;
}

/** Bunny Stream, una página de GET /library/{biblioteca}/videos. El reproductor lleva la biblioteca. */
export function videosDeBunny(respuesta: unknown, biblioteca: string): VideoAlojado[] {
  if (!/^\d{1,12}$/.test(biblioteca)) return [];
  const out: VideoAlojado[] = [];
  for (const v of Array.isArray(obj(respuesta).items) ? obj(respuesta).items as unknown[] : []) {
    const o = obj(v);
    const g = txt(o.guid).toLowerCase();
    if (!/^[0-9a-f-]{36}$/.test(g)) continue;
    out.push({
      alojador: 'bunny', id: `bunny:${g}`, titulo: titulo(o.title, `bunny:${g}`), player: `https://iframe.mediadelivery.net/embed/${biblioteca}/${g}`,
      portada: null, duracion: num(o.length), reproducciones: num(o.views),
    });
  }
  return out;
}

/**
 * Cloudflare Stream, GET /accounts/{cuenta}/stream. El reproductor es el del dominio customer-… de la cuenta (lo dice
 * `preview`, que termina en /watch); sin ese dato, el de iframe.videodelivery.net, que es el mismo reproductor.
 * La duración llega en -1 mientras se procesa: eso no es una duración.
 */
export function videosDeCloudflare(respuesta: unknown): VideoAlojado[] {
  const out: VideoAlojado[] = [];
  for (const v of Array.isArray(obj(respuesta).result) ? obj(respuesta).result as unknown[] : []) {
    const o = obj(v);
    const uid = txt(o.uid).toLowerCase();
    if (!/^[0-9a-f]{32}$/.test(uid)) continue;
    const cliente = /^https:\/\/(customer-[a-z0-9]+\.cloudflarestream\.com)\//.exec(txt(o.preview))?.[1];
    out.push({
      alojador: 'cloudflare', id: `cfs:${uid}`, titulo: titulo(obj(o.meta).name, `cfs:${uid}`),
      player: cliente ? `https://${cliente}/${uid}/iframe` : `https://iframe.videodelivery.net/${uid}`,
      portada: https(o.thumbnail), duracion: num(o.duration), reproducciones: null,
    });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Los números por día (Wistia y Bunny: los únicos que los dan por API sin ser Enterprise)
// ─────────────────────────────────────────────────────────────────────────────

/** Los números de UN video en UN día: las reproducciones y, si el alojador lo da, el tiempo medio visto. */
export type NumerosDelDia = { plays: number; promedioSeg: number | null; crudo: Record<string, unknown> };

/**
 * Wistia, GET /modern/stats/medias/{id}/by_date: un arreglo de `{ date, load_count, play_count, hours_watched }`. El tiempo
 * medio sale de las horas vistas sobre las reproducciones (null sin reproducciones: no es cero, es que no hubo).
 */
export function numerosDeWistia(respuesta: unknown, fecha: string): NumerosDelDia | null {
  const fila = (Array.isArray(respuesta) ? respuesta : []).map(obj).find((o) => txt(o.date).slice(0, 10) === fecha);
  if (!fila) return null;
  const plays = Math.max(0, Math.round(Number(fila.play_count) || 0));
  const horas = Number(fila.hours_watched);
  return {
    plays,
    promedioSeg: plays > 0 && Number.isFinite(horas) && horas >= 0 ? Math.round((horas * 3600) / plays) : null,
    crudo: { source: 'wistia', load_count: fila.load_count ?? null, play_count: fila.play_count ?? null, hours_watched: fila.hours_watched ?? null },
  };
}

/**
 * Bunny Stream, GET /library/{biblioteca}/statistics?videoGuid=…: `viewsChart` es un mapa de día (en UTC) a reproducciones.
 * ⚠️ `watchTimeChart` NO dice en qué unidad viene (la documentación dice «total watch time»): se guarda tal cual en
 * `crudo` y el tiempo medio queda en null, en vez de inventar segundos o minutos.
 */
export function numerosDeBunny(respuesta: unknown, fecha: string): NumerosDelDia | null {
  const o = obj(respuesta);
  const vistas = obj(o.viewsChart);
  const clave = Object.keys(vistas).find((k) => k.slice(0, 10) === fecha);
  if (clave === undefined) return null;
  const plays = Math.max(0, Math.round(Number(vistas[clave]) || 0));
  const tiempo = obj(o.watchTimeChart);
  const clt = Object.keys(tiempo).find((k) => k.slice(0, 10) === fecha);
  return { plays, promedioSeg: null, crudo: { source: 'bunny', views: vistas[clave] ?? null, watch_time: clt !== undefined ? tiempo[clt] : null } };
}
