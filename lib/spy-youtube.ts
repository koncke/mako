// =============================================================================
// Leer el canal de YouTube de un competidor SIN usar `search.list`
// =============================================================================
// `lib/youtube.ts` ya resuelve la clave (`claveDeYoutube`: la del negocio y, si no tiene, la de la
// plataforma) y lee las métricas de un video PROPIO por su id. Lo que no existía es el lector por
// CANAL, que es lo que pide la tab: los videos recientes de un competidor con sus vistas, «me
// gusta», comentarios, duración, etiquetas y miniatura.
//
// ⚠️ LA TRAMPA QUE CAMBIA EL DISEÑO, y la razón por la que este archivo existe:
// **`search.list` ya no cuesta 100 unidades de 10.000 — tiene su propio balde de 100 LLAMADAS POR
// DÍA para TODA la app.** Cambio del 1/6/2026, verificado el 31/10/2026 en
// developers.google.com/youtube/v3/determine_quota_cost: «a default quota allocation of 100
// search.list calls, 100 videos.insert calls, and 10,000 units per day combined for all other
// endpoints». No es por usuario ni por workspace: son 100 búsquedas por día entre todos los
// negocios de MaKo.
//
// Todo tutorial, todo blog y toda memoria de modelo anteriores a junio de 2026 dicen «search.list
// cuesta 100 de 10.000», y de ahí se deduce «100 búsquedas por día, me alcanza». La cuenta da lo
// mismo y la conclusión es la contraria: con el sistema viejo las búsquedas competían con el resto
// y se podían priorizar gastando menos en otra cosa; con el nuevo el tope es duro. **Cualquier
// feature con forma de buscador está muerta a escala.**
//
// EL CAMINO QUE SÍ ESCALA, y es el que hay acá (≈0,04 unidades por video hidratado, ~250.000
// videos/día de techo teórico):
//   1. `channels.list?part=contentDetails,statistics,snippet&id=<50 ids>` → 1 unidad por 50 canales.
//      De ahí sale `contentDetails.relatedPlaylists.uploads`.
//   2. `playlistItems.list?playlistId=UU…&maxResults=50`                  → 1 unidad por 50 videos.
//   3. `videos.list?part=snippet,statistics,contentDetails&id=<50 ids>`   → 1 unidad por 50 videos.
//
// ⚠️ El playlist de subidas SE LEE DE LA API, no se deriva cambiando `UC`→`UU` a mano. Es un atajo
// que funciona en la mayoría de los canales y por eso es peligroso: el que falla falla en silencio,
// con una lista vacía que se lee como «este canal no subió nada».
//
// ⚠️ Y `tags` de un video AJENO sí vienen, pero SÓLO por `videos.list`. `search.list` nunca
// devuelve `snippet.tags`, y el síntoma («la API no da las etiquetas de otros canales») se
// diagnostica como un permiso cuando es el endpoint. La única deprecación de `tags` del revision
// history (12/5/2021) es la de PLAYLISTS, no la de videos, y es la fuente de la confusión.
//
// Lo que NO se puede, dicho para que nadie lo intente de nuevo:
//   · `dislikeCount`: privado desde el 13/12/2021. **No devuelve 0: no devuelve el campo.** Se lee
//     con `contadorPublicado`, que da `null`.
//   · El TEXTO de los subtítulos de un video ajeno: `captions.download` contesta `forbidden`
//     («requires the user to have permission to edit the video»). `captions.list` (50 unidades)
//     sólo dice que las pistas existen. **No hay vía legal para transcribir el video de un
//     competidor**, y era la pieza más tentadora para «el guion al estilo de». La alternativa
//     honesta es analizar título, descripción, etiquetas y miniatura, y decir que el guion no se
//     leyó.
//   · Alcance, retención, CTR e impresiones: son del dueño del canal.
//   · El volumen de búsqueda de una palabra: YouTube no lo expone por ninguna API. vidIQ lo
//     ESTIMA con datos propios y lo admite.
//
// SIN LLAMADAS A LA RED EN LAS FUNCIONES PURAS: `canalDeUrl`, `leerCanal`, `leerVideos` y
// `lotesDe` se prueban sin tocar YouTube (tests/spy-youtube.test.ts). Lo que sale a la red es
// `traerVideosDelCanal`, que recibe el `fetch` por parámetro.
// =============================================================================

import { contadorPublicado, TOPES } from './spy-reglas';

const API = 'https://www.googleapis.com/youtube/v3';

/**
 * Cuántas páginas de la playlist de subidas se recorren como mucho. Cada una cuesta 2 unidades
 * (`playlistItems` + `videos`), así que cuatro páginas son 8 de las 10.000 diarias: barato.
 * El tope existe para que un canal con diez mil videos no se lea entero.
 */
const PAGINAS_MAX = 4;

/** Cuántos videos LARGOS se intentan traer antes de dejar de paginar. */
const LARGOS_QUE_QUEREMOS = 20;

/**
 * La lectura COMPLETA (punto 8 del 4/11/2026: «que no traiga solo 50 reels o videos, que traiga muchos más, si puede,
 * todos»): hasta diez páginas, 500 videos, y sin cortar al llegar a los largos. Son 20 unidades de las 10.000 diarias de la
 * clave de la plataforma, que comparten todos los negocios: por eso se hace la primera vez (o mientras tenga menos de
 * `VIDEOS_PARA_LECTURA_CORTA` guardados) y después la lectura vuelve a la corta.
 */
export const PAGINAS_COMPLETAS = 10;
export const VIDEOS_POR_LECTURA_COMPLETA = 500;
export const VIDEOS_PARA_LECTURA_CORTA = 100;

/** ¿Esta lectura va completa? Sí, mientras tenga pocos videos guardados de ese canal. */
export const leerCompleto = (guardados: number): boolean => guardados < VIDEOS_PARA_LECTURA_CORTA;

/** Cuántos ids entran en una llamada de `channels.list`, `playlistItems.list` y `videos.list`. */
export const LOTE = 50;

/**
 * Las ÚNICAS rutas de la Data API que este lector usa. `tests/spy-reglas.test.ts` extrae las rutas
 * que pasan por `traer()` y afirma que son exactamente estas tres: así el guard mira lo que el
 * código HACE y no si alguien escribió una palabra.
 *
 * ⚠️ El endpoint prohibido no está acá como constante a propósito. La primera versión de este
 * archivo lo declaraba —`ENDPOINT_PROHIBIDO = 'search.list'`— para que el test pudiera buscar su
 * nombre, y el guard se puso rojo contra código perfecto: lo que encontraba era la constante misma.
 * Un guard que busca una palabra encuentra la documentación; uno que enumera las rutas usadas
 * encuentra la llamada.
 */
export const RUTAS_PERMITIDAS = ['channels', 'playlistItems', 'videos'] as const;

/** Un canal, como lo devuelve `channels.list`. */
export type CanalYoutube = {
  /** El id del canal (`UC…`). */
  id: string;
  nombre: string;
  descripcion: string;
  /** El playlist de subidas, LEÍDO de la API. Sin esto no hay videos que traer. */
  subidas: string | null;
  suscriptores: number | null;
  vistasTotales: number | null;
  videos: number | null;
  /**
   * La foto del canal (`snippet.thumbnails`), la más grande que haya. Martín, 4/11: «le pongo el link de su canal y
   * no me trae la foto». Estaba en la misma respuesta de `channels.list` que ya se pagaba, y se tiraba.
   */
  foto: string | null;
  /** Su @ (`snippet.customUrl`, «@victorherasmedia»), o null si no tiene. */
  handle: string | null;
};

/** Un video, como lo devuelve `videos.list`. */
export type VideoYoutube = {
  id: string;
  titulo: string;
  descripcion: string;
  publicadoEn: string;
  /** Las etiquetas: vienen por `videos.list` y por ningún otro endpoint. */
  etiquetas: string[];
  /**
   * La miniatura de mayor resolución que haya.
   *
   * ⚠️ DESDE EL 2/11/2026 SÍ SE GUARDA. Decía «se dibuja, no se guarda» porque la URL de
   * YouTube no vence ni bloquea, así que para verla alcanzaba. Se guarda por otro motivo, que
   * lo dio Martín: la miniatura de un video largo «puede llegar a servir de referencia para
   * crear miniaturas luego para los propios usuarios de MaKo». Una URL ajena no es material de
   * referencia; un archivo sí.
   */
  miniatura: string | null;
  /** ISO 8601 (`PT4M13S`), tal como lo devuelve la API. */
  duracion: string | null;
  vistas: number | null;
  megusta: number | null;
  comentarios: number | null;
};

/** Por qué no se pudo leer un canal. Las mismas seis formas que el lector de Instagram. */
export type MotivoYoutube = 'sin-clave' | 'no-esta' | 'sin-subidas' | 'cuota' | 'sin-permiso' | 'error';
export type LecturaCanal =
  | { ok: true; canal: CanalYoutube; videos: VideoYoutube[] }
  | { ok: false; motivo: MotivoYoutube; detalle: string };

const esObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');

/** Los ids en lotes de `LOTE`: es lo que convierte 500 videos en 10 unidades de cuota. */
export function lotesDe<T>(xs: readonly T[], tamano: number = LOTE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += tamano) out.push(xs.slice(i, i + tamano));
  return out;
}

/**
 * El canal que nombra un link, un @handle o un id pegado. Devuelve `{ id }` cuando se pudo resolver
 * sin gastar cuota, o `{ handle }` cuando hay que preguntarle a la API.
 *
 * ⚠️ Un `@handle` NO se resuelve con `search.list` (ahí se iría el balde de 100 llamadas): se
 * resuelve con `channels.list?forHandle=`, que cuesta 1 unidad. Un `/user/` viejo va por
 * `forUsername=`. Y un `/c/<nombre>` no tiene endpoint: es un alias que YouTube ya no resuelve por
 * API, y la pantalla tiene que pedir el link del canal (`/channel/UC…`) o su @.
 */
export type Apunta = { id: string } | { handle: string } | { usuario: string } | null;
export function canalDeUrl(crudo: string): Apunta {
  const s = (crudo ?? '').trim();
  if (!s) return null;
  if (/^UC[A-Za-z0-9_-]{20,}$/.test(s)) return { id: s };
  if (/^@[A-Za-z0-9._-]{3,30}$/.test(s)) return { handle: s.slice(1) };
  let u: URL;
  try { u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`); } catch { return null; }
  if (!/(^|\.)youtube\.com$/i.test(u.hostname) && !/(^|\.)youtu\.be$/i.test(u.hostname)) return null;
  const partes = u.pathname.split('/').filter(Boolean);
  if (partes[0] === 'channel' && partes[1] && /^UC[A-Za-z0-9_-]{20,}$/.test(partes[1])) return { id: partes[1] };
  if (partes[0] === 'user' && partes[1]) return { usuario: partes[1] };
  if (partes[0]?.startsWith('@')) return { handle: partes[0].slice(1) };
  // `/c/<alias>` queda afuera a propósito: no hay endpoint que lo resuelva y adivinar es inventar.
  return null;
}

/** La respuesta de `channels.list`, leída. Separada de la red para poder probarla. */
export function leerCanal(status: number, cuerpo: unknown): { ok: true; canal: CanalYoutube } | { ok: false; motivo: MotivoYoutube; detalle: string } {
  if (status === 403) {
    const razon = str((esObj(cuerpo) && esObj(cuerpo.error) && Array.isArray(cuerpo.error.errors) && esObj(cuerpo.error.errors[0]) ? cuerpo.error.errors[0].reason : '') as unknown);
    // `quotaExceeded` y `dailyLimitExceeded` son «volvé mañana»; el resto de los 403 son permiso.
    const cuota = /quota|dailyLimit|rateLimit/i.test(razon);
    return { ok: false, motivo: cuota ? 'cuota' : 'sin-permiso', detalle: razon || 'YouTube contestó 403' };
  }
  if (status !== 200) {
    const msg = str((esObj(cuerpo) && esObj(cuerpo.error) ? cuerpo.error.message : '') as unknown);
    return { ok: false, motivo: 'error', detalle: msg || `YouTube contestó ${status}` };
  }
  const items = esObj(cuerpo) && Array.isArray(cuerpo.items) ? cuerpo.items.filter(esObj) : [];
  // ⚠️ HTTP 200 con `items: []` es «ese canal no existe», no un error. Es la misma forma que la Ad
  // Library: la fuente contesta bien y devuelve nada.
  if (!items.length) return { ok: false, motivo: 'no-esta', detalle: 'YouTube no devolvió ese canal' };
  const c = items[0];
  const snippet = esObj(c.snippet) ? c.snippet : {};
  const stats = esObj(c.statistics) ? c.statistics : {};
  const contenido = esObj(c.contentDetails) ? c.contentDetails : {};
  const relacionados = esObj(contenido.relatedPlaylists) ? contenido.relatedPlaylists : {};
  return {
    ok: true,
    canal: {
      id: str(c.id),
      nombre: str(snippet.title),
      descripcion: str(snippet.description),
      // Se LEE. No se deriva de `UC`→`UU`: el canal donde el atajo falla devuelve una lista vacía
      // que se lee como «no subió nada».
      subidas: str(relacionados.uploads) || null,
      suscriptores: contadorPublicado(stats.subscriberCount),
      vistasTotales: contadorPublicado(stats.viewCount),
      videos: contadorPublicado(stats.videoCount),
      foto: mejorMiniatura(snippet.thumbnails, ['high', 'medium', 'default']),
      handle: /^@[A-Za-z0-9._-]{3,30}$/.test(str(snippet.customUrl)) ? str(snippet.customUrl) : null,
    },
  };
}

/** La URL https de la miniatura más grande de un `thumbnails` de YouTube, en el orden que se pida. */
function mejorMiniatura(minis: unknown, orden: readonly string[]): string | null {
  if (!esObj(minis)) return null;
  for (const k of orden) {
    const m = minis[k];
    const u = esObj(m) ? str(m.url) : '';
    if (/^https:\/\//.test(u)) return u;
  }
  return null;
}

/** El `?forHandle=` / `?id=` / `?forUsername=` de `channels.list` para lo que apunta a un canal. */
export const consultaDeCanal = (apunta: NonNullable<Apunta>): Record<string, string> => ('id' in apunta ? { id: apunta.id }
  : 'handle' in apunta ? { forHandle: `@${apunta.handle}` }
  : { forUsername: apunta.usuario });

/** El canal al que apunta lo que guarda el alta (`UC…`, `@handle` o `user:x`), o null si no es ninguno. */
export const apuntaDeRef = (ref: string): NonNullable<Apunta> | null => {
  const r = (ref ?? '').trim();
  if (/^UC[A-Za-z0-9_-]{20,}$/.test(r)) return { id: r };
  if (/^@[A-Za-z0-9._-]{3,30}$/.test(r)) return { handle: r.slice(1) };
  if (/^user:[A-Za-z0-9._-]{2,40}$/.test(r)) return { usuario: r.slice(5) };
  return null;
};

/**
 * UN canal, sólo para mostrar quién es (nombre, foto, suscriptores): `channels.list` con `snippet,statistics`, 1
 * unidad. Es lo que necesita la confirmación del alta y la lista del buscador; los videos los lee `traerVideosDelCanal`.
 */
export async function leerCanalCorto(apunta: NonNullable<Apunta>, clave: string, buscar: Buscador): Promise<{ ok: true; canal: CanalYoutube } | { ok: false; motivo: MotivoYoutube; detalle: string }> {
  if (!clave) return { ok: false, motivo: 'sin-clave', detalle: 'No hay clave de la YouTube Data API' };
  const r = await traer(buscar, 'channels', { part: 'snippet,statistics', ...consultaDeCanal(apunta) }, clave);
  return leerCanal(r.status, r.cuerpo);
}

/** El token de la página siguiente de `playlistItems.list`, o null si era la última. */
export function pasaALaSiguiente(cuerpo: unknown): string | null {
  return esObj(cuerpo) ? str(cuerpo.nextPageToken) || null : null;
}

/**
 * Los segundos de una duración ISO 8601 de YouTube (`PT1H2M3S`), o null si no se entiende.
 *
 * ⚠️ Un día entero viene como `P1DT…` y un directo sin terminar viene como `P0D`: por eso se leen
 * también los días, y por eso un `P0D` da 0 y no null — es un dato, no un error.
 */
export function segundosDeDuracion(iso: string | null): number | null {
  if (!iso) return null;
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(iso.trim());
  if (!m) return null;
  const [d, h, mi, se] = [m[1], m[2], m[3], m[4]].map((x) => (x ? Number(x) : 0));
  return d * 86_400 + h * 3_600 + mi * 60 + se;
}

/**
 * Hasta cuántos segundos YouTube considera que un video es un Short: 3 minutos desde octubre de
 * 2024 (antes era 1). Se usa para CLASIFICAR, no para descartar: los dos formatos se traen.
 */
export const SHORT_HASTA_SEGUNDOS = 180;

/** Si un video es corto. `null` (duración que no se entiende) NO es corto: se trata como largo. */
export const esShort = (v: { duracion: string | null }): boolean => {
  const s = segundosDeDuracion(v.duracion);
  return s != null && s > 0 && s <= SHORT_HASTA_SEGUNDOS;
};

/** Los ids de video de una respuesta de `playlistItems.list`, en el orden en que vinieron. */
export function leerIdsDeSubidas(cuerpo: unknown): string[] {
  const items = esObj(cuerpo) && Array.isArray(cuerpo.items) ? cuerpo.items.filter(esObj) : [];
  const out: string[] = [];
  for (const it of items) {
    const cd = esObj(it.contentDetails) ? it.contentDetails : {};
    const id = str(cd.videoId);
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}

/** La respuesta de `videos.list`, leída. Todo contador pasa por `contadorPublicado`: nunca `?? 0`. */
export function leerVideos(cuerpo: unknown): VideoYoutube[] {
  const items = esObj(cuerpo) && Array.isArray(cuerpo.items) ? cuerpo.items.filter(esObj) : [];
  return items.map((v) => {
    const snippet = esObj(v.snippet) ? v.snippet : {};
    const stats = esObj(v.statistics) ? v.statistics : {};
    const contenido = esObj(v.contentDetails) ? v.contentDetails : {};
    const minis = esObj(snippet.thumbnails) ? snippet.thumbnails : {};
    // De mayor a menor: la miniatura manda el alto de la tarjeta y una chica se ve mal estirada.
    const mini = ['maxres', 'standard', 'high', 'medium', 'default']
      .map((k) => (esObj(minis[k]) ? str((minis[k] as Record<string, unknown>).url) : ''))
      .find((u) => /^https:\/\//.test(u)) ?? null;
    return {
      id: str(v.id),
      titulo: str(snippet.title).slice(0, TOPES.titulo),
      descripcion: str(snippet.description).slice(0, TOPES.texto),
      publicadoEn: str(snippet.publishedAt),
      // Vienen SÓLO por este endpoint. Un video sin etiquetas y uno de `search.list` se ven igual.
      etiquetas: Array.isArray(snippet.tags) ? snippet.tags.map(str).filter(Boolean).slice(0, 40) : [],
      miniatura: mini,
      duracion: str(contenido.duration) || null,
      vistas: contadorPublicado(stats.viewCount),
      megusta: contadorPublicado(stats.likeCount),
      comentarios: contadorPublicado(stats.commentCount),
      // Sin `dislikeCount` a propósito: es privado desde el 13/12/2021 y la API NO devuelve el
      // campo. Un `?? 0` acá inventa «0 no me gusta» sobre un video que tiene miles.
    };
  }).filter((v) => v.id);
}

/**
 * De qué canal es cada video: la respuesta de `videos.list` con `part=snippet`, leída. Lo usa la búsqueda por nombre
 * (lib/spy-buscar.ts): Google devuelve casi siempre VIDEOS de YouTube, no canales, y un video dice de quién es.
 * Sin repetir canales, en el orden en que vinieron.
 */
export function canalesDeVideos(cuerpo: unknown): Array<{ id: string; nombre: string | null }> {
  const items = esObj(cuerpo) && Array.isArray(cuerpo.items) ? cuerpo.items.filter(esObj) : [];
  const vistos = new Set<string>();
  const out: Array<{ id: string; nombre: string | null }> = [];
  for (const v of items) {
    const snippet = esObj(v.snippet) ? v.snippet : {};
    const id = str(snippet.channelId);
    if (!/^UC[A-Za-z0-9_-]{20,}$/.test(id) || vistos.has(id)) continue;
    vistos.add(id);
    out.push({ id, nombre: str(snippet.channelTitle) || null });
  }
  return out;
}

/** Los canales de unos videos (hasta 50 ids): `videos.list` con `snippet`, 1 unidad. Vacío si no se pudo. */
export async function leerCanalesDeVideos(ids: readonly string[], clave: string, buscar: Buscador): Promise<{ ok: boolean; canales: Array<{ id: string; nombre: string | null }> }> {
  const limpios = [...new Set(ids.filter((x) => /^[A-Za-z0-9_-]{11}$/.test(x)))].slice(0, LOTE);
  if (!limpios.length) return { ok: true, canales: [] };
  if (!clave) return { ok: false, canales: [] };
  const r = await traer(buscar, 'videos', { part: 'snippet', id: limpios.join(',') }, clave);
  return r.status >= 200 && r.status < 300 ? { ok: true, canales: canalesDeVideos(r.cuerpo) } : { ok: false, canales: [] };
}

/** Lo que recibe el lector: el `fetch` entra por parámetro para poder probarlo sin red. */
export type Buscador = (url: string, init?: RequestInit) => Promise<Response>;

const traer = async (buscar: Buscador, ruta: string, params: Record<string, string>, clave: string): Promise<{ status: number; cuerpo: unknown }> => {
  const u = new URL(`${API}/${ruta}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  u.searchParams.set('key', clave);
  const r = await buscar(u.toString());
  let cuerpo: unknown = null;
  try { cuerpo = await r.json(); } catch { cuerpo = null; }
  return { status: r.status, cuerpo };
};

/**
 * Los videos recientes de un canal, con sus métricas. Tres llamadas por cada 50 videos y ni una a
 * `search.list`.
 *
 * `cuantos` se topea en `TOPES.piezasPorVuelta` (50): las subidas más nuevas dicen qué está
 * haciendo el competidor, y el archivo entero no.
 */
export async function traerVideosDelCanal(
  apunta: NonNullable<Apunta>,
  clave: string,
  buscar: Buscador,
  cuantos: number = TOPES.piezasPorVuelta,
  completa = false,
): Promise<LecturaCanal> {
  if (!clave) return { ok: false, motivo: 'sin-clave', detalle: 'No hay clave de la YouTube Data API' };
  const quiere = Math.max(1, Math.min(cuantos, completa ? VIDEOS_POR_LECTURA_COMPLETA : TOPES.piezasPorVuelta));
  const paginas = completa ? PAGINAS_COMPLETAS : PAGINAS_MAX;

  // 1. El canal: 1 unidad. `forHandle`/`forUsername` en vez de `search.list`.
  const uno = await traer(buscar, 'channels', { part: 'snippet,statistics,contentDetails', ...consultaDeCanal(apunta) }, clave);
  const canal = leerCanal(uno.status, uno.cuerpo);
  if (!canal.ok) return canal;
  if (!canal.canal.subidas) {
    // El canal existe y no declara playlist de subidas: no hay nada que traer, y eso NO es un error.
    return { ok: false, motivo: 'sin-subidas', detalle: 'Ese canal no publica una lista de subidas' };
  }

  // 2 y 3, en un bucle: una página de ids (1 unidad) y sus videos (1 unidad), hasta llenar el cupo.
  //
  // ⚠️ POR QUÉ SE PAGINA, que es lo que Martín vio: una sola página trae los ÚLTIMOS 50 subidos, y
  // en un canal que publica Shorts a diario esos 50 son todos Shorts — el video largo queda afuera
  // por VIEJO, no por formato. Y lo valioso de YouTube está en los largos. La duración recién se
  // conoce en `videos.list`, así que no se puede pedir «los largos»: hay que traer, clasificar y
  // decidir si hace falta otra página.
  const videos: VideoYoutube[] = [];
  let largos = 0;
  let pagina: string | null = null;
  for (let vuelta = 0; vuelta < paginas; vuelta += 1) {
    const dos: { status: number; cuerpo: unknown } = await traer(buscar, 'playlistItems', {
      part: 'contentDetails', playlistId: canal.canal.subidas, maxResults: String(LOTE),
      ...(pagina ? { pageToken: pagina } : {}),
    }, clave);
    if (dos.status !== 200) {
      const l = leerCanal(dos.status, dos.cuerpo);
      // La primera página que falla es un fallo; si ya trajimos algo, se devuelve lo que hay.
      if (videos.length) break;
      return l.ok ? { ok: false, motivo: 'error', detalle: `playlistItems contestó ${dos.status}` } : l;
    }
    const ids = leerIdsDeSubidas(dos.cuerpo);
    if (!ids.length) break;

    const tres = await traer(buscar, 'videos', { part: 'snippet,statistics,contentDetails', id: ids.join(',') }, clave);
    if (tres.status !== 200) {
      const l = leerCanal(tres.status, tres.cuerpo);
      if (videos.length) break;
      // Si el primer lote falla, se devuelve el fallo: media lista se lee como «subió 25 videos».
      return l.ok ? { ok: false, motivo: 'error', detalle: `videos.list contestó ${tres.status}` } : l;
    }
    for (const v of leerVideos(tres.cuerpo)) {
      videos.push(v);
      if (!esShort(v)) largos += 1;
    }

    pagina = pasaALaSiguiente(dos.cuerpo);
    // Se sigue sólo mientras falten LARGOS. Si ya hay bastantes, una página más no agrega nada. Completa, se sigue hasta
    // el final o el tope: lo que se pidió es todo.
    if (!pagina || (!completa && largos >= LARGOS_QUE_QUEREMOS)) break;
  }
  if (!videos.length) return { ok: true, canal: canal.canal, videos: [] };

  // El recorte: primero los largos más nuevos y después los cortos más nuevos, hasta `quiere`.
  // ⚠️ NO se recorta por fecha a secas: eso es justamente lo que dejaba afuera a los largos.
  const porFecha = (a: VideoYoutube, b: VideoYoutube) => String(b.publicadoEn ?? '').localeCompare(String(a.publicadoEn ?? ''));
  const deLargos = videos.filter((v) => !esShort(v)).sort(porFecha);
  const deCortos = videos.filter((v) => esShort(v)).sort(porFecha);
  const elegidos = completa ? [...deLargos, ...deCortos].slice(0, quiere) : [...deLargos.slice(0, LARGOS_QUE_QUEREMOS), ...deCortos].slice(0, quiere);
  // Y se devuelven en el orden en que YouTube los dio, que es el que espera quien los dibuja.
  const quedan = new Set(elegidos.map((v) => v.id));
  return { ok: true, canal: canal.canal, videos: videos.filter((v) => quedan.has(v.id)) };
}

/** Lo que se le dice a la persona cuando no se pudo leer un canal. Dice de quién fue y qué hacer. */
export function noPudeLeerCanal(motivo: MotivoYoutube): string {
  if (motivo === 'sin-clave') return 'Falta conectar YouTube para poder leer el canal. Se conecta en Integraciones.';
  if (motivo === 'no-esta') return 'No encontré ese canal de YouTube. Pega el enlace del canal o su @.';
  if (motivo === 'sin-subidas') return 'Ese canal no tiene videos publicados que YouTube deje leer.';
  if (motivo === 'cuota') return 'Hoy ya se agotó la cuota de YouTube. Vuelve a intentarlo mañana.';
  if (motivo === 'sin-permiso') return 'YouTube no dejó leer ese canal con la clave conectada.';
  return 'No pude leer ese canal de YouTube.';
}
