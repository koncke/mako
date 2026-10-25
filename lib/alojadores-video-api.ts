// =============================================================================
// alojadores-video-api — el catálogo de videos de cada alojador conectado, con la clave del negocio (25/10/2026)
// =============================================================================
// Las formas de cada respuesta, y por qué, en lib/alojadores-video.ts (puro). Acá sólo se llama con la clave que el
// negocio conectó en Integraciones (`credWs`, cifrada en `credenciales`).
//
// ⚠️ NUNCA ROMPE: un alojador sin clave, caído o con la clave vencida devuelve una lista vacía (y lo dice en `fallas`),
// igual que `catalogoPanda`. Un catálogo que no se pudo leer no puede apagar la lista de videos de una pantalla.
// ⚠️ DE A UNO Y CON TOPE: cinco páginas de 100 por alojador, en serie (N llamadas simultáneas contra una sola clave es
// como se compra un 429), y cinco minutos de caché por negocio, como el de Panda.
// =============================================================================

import 'server-only';
import { credWs } from './credenciales';
import { wsObligatorio } from './workspace';
import { catalogoPanda } from './panda';
import { videosDeBunny, videosDeCloudflare, videosDeVimeo, videosDeWistia, type Alojador, type VideoAlojado } from './alojadores-video';

/** Las claves de cada alojador en `credenciales` (las que pide su tarjeta en Integraciones). */
export const CLAVES_ALOJADOR = {
  vimeo: ['VIMEO_TOKEN'],
  wistia: ['WISTIA_TOKEN'],
  bunny: ['BUNNY_STREAM_KEY', 'BUNNY_STREAM_LIBRARY'],
  cloudflare: ['CLOUDFLARE_STREAM_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'],
} as const satisfies Record<Exclude<Alojador, 'panda'>, readonly string[]>;

const PAGINAS = 5;
const CACHE_MS = 5 * 60 * 1000;
const _cache = new Map<number, { videos: VideoAlojado[]; fallas: string[]; ts: number }>();

async function pedir(url: string, headers: Record<string, string>): Promise<unknown> {
  const r = await fetch(url, { headers: { Accept: 'application/json', ...headers }, signal: AbortSignal.timeout(15_000), cache: 'no-store' });
  if (!r.ok) throw new Error(`respondió ${r.status}`);
  return r.json();
}

async function deVimeo(token: string): Promise<VideoAlojado[]> {
  const out: VideoAlojado[] = [];
  let url: string | null = 'https://api.vimeo.com/me/videos?per_page=100&fields=uri,name,duration,player_embed_url,pictures.base_link,stats.plays';
  for (let i = 0; url && i < PAGINAS; i++) {
    const j = await pedir(url, { Authorization: `bearer ${token}`, Accept: 'application/vnd.vimeo.*+json;version=3.4' }) as { paging?: { next?: string | null } };
    out.push(...videosDeVimeo(j));
    url = j.paging?.next ? `https://api.vimeo.com${j.paging.next}` : null;
  }
  return out;
}

async function deWistia(token: string): Promise<VideoAlojado[]> {
  const out: VideoAlojado[] = [];
  for (let p = 1; p <= PAGINAS; p++) {
    const j = await pedir(`https://api.wistia.com/v1/medias.json?per_page=100&page=${p}`, { Authorization: `Bearer ${token}` });
    const lote = videosDeWistia(j);
    out.push(...lote);
    if (!Array.isArray(j) || j.length < 100) break;
  }
  return out;
}

async function deBunny(clave: string, biblioteca: string): Promise<VideoAlojado[]> {
  const out: VideoAlojado[] = [];
  for (let p = 1; p <= PAGINAS; p++) {
    const j = await pedir(`https://video.bunnycdn.com/library/${encodeURIComponent(biblioteca)}/videos?page=${p}&itemsPerPage=100&orderBy=date`, { AccessKey: clave }) as { items?: unknown[] };
    out.push(...videosDeBunny(j, biblioteca));
    if (!Array.isArray(j.items) || j.items.length < 100) break;
  }
  return out;
}

async function deCloudflare(token: string, cuenta: string): Promise<VideoAlojado[]> {
  // Un listado, hasta 1.000 videos (el máximo que acepta en una página).
  const j = await pedir(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(cuenta)}/stream?limit=1000`, { Authorization: `Bearer ${token}` });
  return videosDeCloudflare(j);
}

/** Los alojadores (fuera de Panda) que este negocio conectó: los que tienen TODAS sus claves. */
export async function alojadoresConectados(): Promise<Array<Exclude<Alojador, 'panda'>>> {
  const out: Array<Exclude<Alojador, 'panda'>> = [];
  for (const [a, claves] of Object.entries(CLAVES_ALOJADOR) as Array<[Exclude<Alojador, 'panda'>, readonly string[]]>) {
    const vals = await Promise.all(claves.map((c) => credWs(c).catch(() => null)));
    if (vals.every((v) => !!v && !v.startsWith('PENDING'))) out.push(a);
  }
  return out;
}

/**
 * Todos los videos de los alojadores conectados (Panda incluido), con el id del Pixel. `fallas` dice qué alojador no se
 * pudo leer y por qué (para decirlo en pantalla, no para esconderlo).
 */
export async function catalogoDeVideos(): Promise<{ videos: VideoAlojado[]; fallas: string[] }> {
  const ws = await wsObligatorio();
  const c = _cache.get(ws);
  if (c && Date.now() - c.ts < CACHE_MS) return { videos: c.videos, fallas: c.fallas };
  const videos: VideoAlojado[] = [];
  const fallas: string[] = [];
  const panda = await catalogoPanda().catch(() => new Map());
  for (const [id, v] of panda) {
    videos.push({ alojador: 'panda', id, titulo: v.titulo, player: v.player, portada: v.thumbnail ?? null, duracion: null, reproducciones: null });
  }
  for (const a of await alojadoresConectados()) {
    try {
      const [k1, k2] = await Promise.all(CLAVES_ALOJADOR[a].map((k) => credWs(k)));
      if (a === 'vimeo') videos.push(...await deVimeo(k1!));
      else if (a === 'wistia') videos.push(...await deWistia(k1!));
      else if (a === 'bunny') videos.push(...await deBunny(k1!, k2!.trim()));
      else videos.push(...await deCloudflare(k1!, k2!.trim()));
    } catch (e) {
      fallas.push(`${a}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  _cache.set(ws, { videos, fallas, ts: Date.now() });
  return { videos, fallas };
}
