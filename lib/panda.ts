// =============================================================================
// Cliente de Panda Video — métricas del VSL (Implementación v2, Fase 5)
// =============================================================================
// Dos APIs de Panda:
//   - api-v2.pandavideo.com/videos     → metadata (resolver external_id → id interno)
//   - data.pandavideo.com/general/{id} → serie de plays/views/unique por día
//   - data.pandavideo.com/retention    → engagement % + duration por video
//
// Auth: header `Authorization: <API_KEY>` (SIN prefijo Bearer).
//
// OJO: /general/{id} espera el ID INTERNO del video (no el external_id que
// Martin puso en PANDA_VSL_VIDEO_IDS). Resolvemos external→interno una vez.
// =============================================================================

import 'server-only';
import { credWs } from './credenciales';
import { getWorkspaceActual, OWNER_WS } from './workspace';
import { configWs } from './cron-workspaces';

const API_V2 = 'https://api-v2.pandavideo.com';
const DATA = 'https://data.pandavideo.com';

async function key(): Promise<string> {
  const k = await credWs('PANDA_API_KEY');
  if (!k || k.startsWith('PENDING')) {
    throw new Error('PANDA_API_KEY no configurada');
  }
  return k;
}

export async function getPandaVideoIds(): Promise<string[]> {
  const raw = await configWs('panda_vsl_video_ids', process.env.PANDA_VSL_VIDEO_IDS);
  if (!raw) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

async function pandaGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Authorization: await key() } });
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`Panda respuesta no-JSON (${res.status}): ${text.slice(0, 120)}`);
  }
  return body as T;
}

// ─────────────────────────────────────────────────────────────────────────────
// Resolver external_id → id interno (cache en memoria del proceso)
// ─────────────────────────────────────────────────────────────────────────────

// Keyed por workspace (cada cliente tiene su propia cuenta de Panda) con TTL
// corto: no servir el catálogo de otro workspace ni cachearlo para siempre.
const _videoCache = new Map<number, { map: Map<string, string>; ts: number }>();
const VIDEO_CACHE_TTL_MS = 5 * 60 * 1000;

async function getVideoMap(): Promise<Map<string, string>> {
  const ws = (await getWorkspaceActual()) ?? OWNER_WS;
  const cached = _videoCache.get(ws);
  if (cached && Date.now() - cached.ts < VIDEO_CACHE_TTL_MS) return cached.map;
  const map = new Map<string, string>();
  // Paginar el listado de videos
  let url: string | null = `${API_V2}/videos?limit=100`;
  let pages = 0;
  while (url && pages++ < 20) {
    const page: { videos?: Array<{ id?: string; video_external_id?: string }>; pagination?: { next?: string } } =
      await pandaGet(url);
    for (const v of page.videos ?? []) {
      if (v.video_external_id && v.id) map.set(v.video_external_id, v.id);
    }
    url = page.pagination?.next ?? null;
  }
  _videoCache.set(ws, { map, ts: Date.now() });
  return map;
}

// ─────────────────────────────────────────────────────────────────────────────
// Métricas diarias por video
// ─────────────────────────────────────────────────────────────────────────────

export type PandaDailyStat = {
  externalId: string;
  fecha: string;            // YYYY-MM-DD
  plays: number;
  unique_viewers: number;
  engagement_pct: number | null;   // % de retención media (0-100)
  duration_seconds: number | null;
  avg_watch_seconds: number | null; // engagement_pct/100 * duration
};

/**
 * Trae las métricas de UN video (por external_id) para UN día.
 * /general entrega buckets (horarios o diarios según rango); sumamos todos
 * los de la fecha para el total del día.
 */
export async function fetchPandaDailyStat(
  externalId: string,
  fecha: string,
  retencion?: Map<string, { engagement_pct: number | null; duration_seconds: number | null }>,
): Promise<PandaDailyStat> {
  const map = await getVideoMap();
  const internalId = map.get(externalId);
  if (!internalId) {
    throw new Error(`No se encontró video interno para external_id ${externalId}`);
  }

  // a) Plays/views del día
  const general = await pandaGet<{
    views_data?: Record<string, { play?: number; unique_play?: number }>;
  }>(`${DATA}/general/${internalId}?start_date=${fecha}&end_date=${fecha}`);

  let plays = 0;
  let unique = 0;
  for (const bucket of Object.values(general.views_data ?? {})) {
    plays += Number(bucket.play ?? 0);
    unique += Number(bucket.unique_play ?? 0);
  }

  // b) Retención (engagement % + duration). El endpoint /retention es a NIVEL
  // CUENTA (devuelve TODOS los videos): si el caller ya lo trajo para la fecha
  // (fetchPandaRetention), usamos ese mapa y evitamos una llamada idéntica por
  // cada video (N+1). Sin mapa, caemos a la llamada individual (compat).
  let engagement_pct: number | null = null;
  let duration_seconds: number | null = null;
  if (retencion) {
    const mine = retencion.get(externalId);
    engagement_pct = mine?.engagement_pct ?? null;
    duration_seconds = mine?.duration_seconds ?? null;
  } else {
    try {
      const ret = await pandaGet<{
        videos?: Array<{ engagement?: number | null; duration?: number; video_external_id?: string }>;
      }>(`${DATA}/retention?start_date=${fecha}&end_date=${fecha}`);
      const mine = ret.videos?.find((v) => v.video_external_id === externalId);
      if (mine) {
        engagement_pct = mine.engagement ?? null;
        duration_seconds = mine.duration ?? null;
      }
    } catch {
      // retención es opcional — si falla, plays/unique igual quedan
    }
  }

  const avg_watch_seconds =
    engagement_pct !== null && duration_seconds !== null
      ? (engagement_pct / 100) * duration_seconds
      : null;

  return {
    externalId,
    fecha,
    plays,
    unique_viewers: unique,
    engagement_pct,
    duration_seconds,
    avg_watch_seconds,
  };
}

/**
 * Trae la retención (engagement % + duración) de TODOS los videos de la cuenta
 * para una fecha en UNA sola llamada. Pasar el mapa resultante a fetchPandaDailyStat
 * evita el N+1 (una llamada idéntica a /retention por cada video).
 */
export async function fetchPandaRetention(
  fecha: string,
): Promise<Map<string, { engagement_pct: number | null; duration_seconds: number | null }>> {
  const map = new Map<string, { engagement_pct: number | null; duration_seconds: number | null }>();
  try {
    const ret = await pandaGet<{
      videos?: Array<{ engagement?: number | null; duration?: number; video_external_id?: string }>;
    }>(`${DATA}/retention?start_date=${fecha}&end_date=${fecha}`);
    for (const v of ret.videos ?? []) {
      if (v.video_external_id) {
        map.set(v.video_external_id, { engagement_pct: v.engagement ?? null, duration_seconds: v.duration ?? null });
      }
    }
  } catch {
    // retención opcional; si falla, mapa vacío y cada stat cae a null
  }
  return map;
}

/**
 * Serie diaria de UN video (por external_id) para un RANGO — /general con
 * start/end devuelve buckets por día. Para el backfill histórico del onboarding
 * (una llamada por video en vez de una por día). Sin retención (el endpoint de
 * retention agrega el rango entero; el cron diario la completa hacia adelante).
 */
export async function fetchPandaRangeStats(
  externalId: string,
  desde: string,
  hasta: string,
): Promise<Array<{ fecha: string; plays: number; unique_viewers: number }>> {
  const map = await getVideoMap();
  const internalId = map.get(externalId);
  if (!internalId) {
    throw new Error(`No se encontró video interno para external_id ${externalId}`);
  }
  const general = await pandaGet<{
    views_data?: Record<string, { play?: number; unique_play?: number }>;
  }>(`${DATA}/general/${internalId}?start_date=${desde}&end_date=${hasta}`);

  // Los buckets vienen keyed por fecha (YYYY-MM-DD...) en rangos multi-día;
  // agregamos por día por si alguna key trae hora.
  const porDia = new Map<string, { plays: number; unique: number }>();
  for (const [k, bucket] of Object.entries(general.views_data ?? {})) {
    const dia = k.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) continue;
    const acc = porDia.get(dia) ?? { plays: 0, unique: 0 };
    acc.plays += Number(bucket.play ?? 0);
    acc.unique += Number(bucket.unique_play ?? 0);
    porDia.set(dia, acc);
  }
  return [...porDia.entries()]
    .map(([fecha, v]) => ({ fecha, plays: v.plays, unique_viewers: v.unique }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

// ─────────────────────────────────────────────────────────────────────────────
// Catálogo: qué ES cada video (título de verdad y dónde verlo)
// ─────────────────────────────────────────────────────────────────────────────

export type VideoPanda = {
  /** El título que el negocio le puso en Panda. */
  titulo: string;
  /** El embed, tal cual lo publica Panda. NO se arma a mano. */
  player: string;
  /** Fotograma de portada. Sirve para reconocerlo sin abrirlo. */
  thumbnail: string | null;
  /**
   * A qué OTRO video manda Panda cuando este termina, si es que manda a alguno.
   *
   * ⚠️ ES UNA FUGA DE EMBUDO Y NO SE VE DESDE NINGÚN LADO. Medido el 2026-08-16:
   * el VSL de un cliente tenía `config.videoRedirect` apuntando a un video viejo
   * de otra persona —resto de una playlist de prueba borrada meses antes— así que
   * cada visitante que terminaba de ver la oferta pasaba solo a un video que no
   * tenía nada que ver. No aparece en la página, no aparece en el panel del
   * cliente, y nadie lo mira hasta que alguien reporta «me confunden los leads».
   *
   * La API pública NO permite borrarlo (`PUT /videos/{id}` responde textual
   * «must NOT have additional properties: config»), así que lo único que el
   * sistema puede hacer es DECIRLO. Se quita a mano en el panel de Panda.
   */
  redirigeA: { id: string; titulo: string } | null;
};

const _catalogoCache = new Map<number, { map: Map<string, VideoPanda>; ts: number }>();

/**
 * Todo lo que Panda sabe de los videos de este workspace, por `video_external_id`
 * — que es el id que viaja en cada evento del Pixel y el que va en la URL del
 * player (`?v=…`).
 *
 * ⚠️ EXISTE PARA QUE VER UN VIDEO NO DEPENDA DE QUE ALGUIEN LO REPRODUZCA. Antes,
 * la única forma de saber dónde estaba un video era esperar a que llegara un
 * `play`, porque su URL viajaba en ese evento y en ningún otro lado. Eso ponía la
 * pantalla al revés: para poder NOMBRAR un video —que es lo que se pide ahí—
 * había que primero conseguir que alguien lo mirara. Panda ya tiene el dato desde
 * el día que se subió el video.
 *
 * Y de paso trae el TÍTULO, que es la otra mitad. Lo que se mostraba salía del
 * atributo `title` del iframe, que en esta landing es el MISMO para los dos
 * videos («VSL Principal - Negocio que Escala»): un rótulo que no distingue no
 * sirve para elegir. Panda dice «Video VSL 2026.mp4» y «Mentoría 1a1 con Martín
 * Koncke», que sí.
 *
 * Nunca lanza: sin Panda configurado —o si su API se cae— devuelve un mapa vacío
 * y la pantalla cae al comportamiento de antes. Un catálogo que no se pudo leer
 * no puede apagar la lista de videos.
 */
export async function catalogoPanda(): Promise<Map<string, VideoPanda>> {
  const ws = (await getWorkspaceActual()) ?? OWNER_WS;
  const cached = _catalogoCache.get(ws);
  // El mismo TTL que el resto del módulo: la pantalla del probador consulta cada
  // 3 segundos, y sin caché serían 20 llamadas por minuto a Panda por persona.
  if (cached && Date.now() - cached.ts < VIDEO_CACHE_TTL_MS) return cached.map;
  const map = new Map<string, VideoPanda>();
  /** external_id → id interno. El redirect solo se lee por el id interno. */
  const internos = new Map<string, string>();
  try {
    let url: string | null = `${API_V2}/videos?limit=100`;
    let pages = 0;
    while (url && pages++ < 20) {
      const page: {
        videos?: Array<{ id?: string; video_external_id?: string; title?: string; video_player?: string; thumbnail?: string }>;
        pagination?: { next?: string };
      } = await pandaGet(url);
      for (const v of page.videos ?? []) {
        if (!v.video_external_id || !v.video_player) continue;
        map.set(v.video_external_id, {
          titulo: (v.title ?? '').trim() || v.video_external_id,
          player: v.video_player,
          thumbnail: v.thumbnail ?? null,
          redirigeA: null,
        });
        if (v.id) internos.set(v.video_external_id, v.id);
      }
      url = page.pagination?.next ?? null;
    }
    // ⚠️ EL REDIRECT SOLO ESTÁ EN EL DETALLE, uno por video. El listado no lo
    // trae. Son pocos videos por cuenta y el resultado se cachea 5 minutos, así
    // que el costo es una tanda cada 5 minutos y no una llamada por pantalla.
    // De a uno y no en paralelo a propósito: N llamadas simultáneas contra una
    // sola API key es cómo se compra un 429.
    for (const [externo, interno] of internos) {
      try {
        const det: { config?: { videoRedirect?: { externalId?: string; title?: string } } } =
          await pandaGet(`${API_V2}/videos/${interno}`);
        const r = det.config?.videoRedirect;
        const entrada = map.get(externo);
        if (r?.externalId && entrada) {
          entrada.redirigeA = { id: r.externalId, titulo: (r.title ?? '').trim() || r.externalId };
        }
      } catch {
        // Un detalle que no se pudo leer deja el redirect en null, que es «no sé»
        // y no «no tiene». El chequeo trata el null como que no hay nada que
        // avisar: es preferible callarse a inventar una fuga que no existe.
      }
    }
  } catch (e) {
    console.warn('[catalogoPanda] no se pudo leer:', e instanceof Error ? e.message : e);
    return map;
  }
  _catalogoCache.set(ws, { map, ts: Date.now() });
  return map;
}
