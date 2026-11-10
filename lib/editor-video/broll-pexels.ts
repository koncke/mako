// =============================================================================
// editor-video/broll-pexels — lo que se lee de Pexels, sin red (para el B-roll del Video Editor)
// =============================================================================
// La fuente de las imágenes del B-roll es Pexels, con la clave de CADA negocio (lib/pexels.ts). Por qué Pexels:
//   · LA LICENCIA ES CLARA Y DEJA EL USO COMERCIAL: «All photos and videos on Pexels can be downloaded and used for
//     free», sin atribución obligatoria (pexels.com/license). Un anuncio es uso comercial; el repositorio que ya usan
//     las portadas (Openverse con CC0) está marcado «licencia NO VERIFICADA» para anuncios
//     (docs/hallazgos-video-pipeline.md), así que no sirve acá.
//   · Lo que pide su API (pexels.com/api/documentation, «Guidelines»): mostrar un link a Pexels y nombrar a quien sacó la
//     foto cuando se pueda. Por eso cada foto viaja con su `autor`, y el panel dice «Fotos de Pexels».
//   · Es la misma fuente que usa Submagic para su «Magic B-Rolls».
// Cada negocio con SU clave: el límite (200 pedidos por hora, 20.000 por mes) y los términos son de cada cuenta, y no
// hay una de la plataforma que la reemplace (la regla de Zernio, 23/10/2026).
//
// SIN `server-only`: lo prueba tests/video-editor-broll.test.ts sin red.
// =============================================================================

import type { BrollElegido } from './broll';

export const ORIGEN_API_PEXELS = 'https://api.pexels.com';
/** Desde donde se bajan las fotos: lo único que la ruta acepta bajar (`urlDeFotoPexels`). */
export const ORIGEN_FOTOS_PEXELS = 'https://images.pexels.com';
/**
 * Desde donde se bajan los videos: los `video_files[].link` que devuelve su API. Hoy son de videos.pexels.com; los
 * ejemplos viejos de su documentación traen player.vimeo.com (Pexels sirvió sus videos desde Vimeo). Lo único que la
 * ruta acepta bajar, y siempre porque lo dijo la API, nunca el navegador.
 */
export const ORIGENES_VIDEOS_PEXELS: readonly string[] = ['https://videos.pexels.com', 'https://player.vimeo.com'];

/**
 * Lo que pesa, como mucho, un video del B-roll que baja la ruta: una ruta de Vercel no deja pasar más de ~4,5 MB de
 * vuelta (lib/operaciones-adjuntos.ts), así que se elige un archivo chico y, si pasa de esto, el siguiente más chico.
 */
export const MAX_BYTES_VIDEO_BROLL = 4 * 1024 * 1024;
/**
 * Los videos que se proponen: de hasta 20 s (un hueco del B-roll dura de 1,5 a 4 s, y el archivo se baja entero: uno
 * largo pesa de más) y en un archivo cuyo lado corto va de 360 a 1080 px (nada de 2K ni 4K: es una toma de apoyo
 * encima de la cara).
 */
export const TOPES_VIDEO_BROLL = { duracionMax: 20, ladoMin: 360, ladoMax: 1080, ladoIdeal: 540 } as const;

export type OrientacionBroll = 'vertical' | 'horizontal' | 'cuadrada';
const ORIENTACION_PEXELS: Readonly<Record<OrientacionBroll, 'portrait' | 'landscape' | 'square'>> = {
  vertical: 'portrait',
  horizontal: 'landscape',
  cuadrada: 'square',
};

/** La orientación del lienzo: lo que se busca y lo que se baja. */
export function orientacionDeLienzo(ancho: number, alto: number): OrientacionBroll {
  if (!(ancho > 0) || !(alto > 0)) return 'vertical';
  const r = ancho / alto;
  return r < 0.9 ? 'vertical' : r > 1.1 ? 'horizontal' : 'cuadrada';
}

export function orientacionPexels(o: OrientacionBroll): 'portrait' | 'landscape' | 'square' {
  return ORIENTACION_PEXELS[o] ?? 'portrait';
}

/** Una foto, como la ve el panel: la miniatura, quién la sacó y su página (para el crédito). */
export type FotoBroll = { id: number; ancho: number; alto: number; autor: string; pagina: string; mini: string; alt: string };

const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

/** Una URL de Pexels sólo si es del origen esperado. Nunca se arma: sale de lo que contestó su API. */
export function urlDePexels(v: unknown, origen: string): string | null {
  if (typeof v !== 'string') return null;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' && u.origin === origen ? u.href : null;
  } catch {
    return null;
  }
}

/** Una foto del JSON de Pexels (`photos[i]` de /v1/search, o /v1/photos/:id). `null` si no trae lo que hace falta. */
export function fotoDePexels(crudo: unknown): FotoBroll | null {
  if (!crudo || typeof crudo !== 'object') return null;
  const o = crudo as Record<string, unknown>;
  const id = typeof o.id === 'number' && Number.isInteger(o.id) && o.id > 0 ? o.id : null;
  const src = o.src && typeof o.src === 'object' ? (o.src as Record<string, unknown>) : {};
  const mini = urlDePexels(src.medium ?? src.small ?? src.tiny, ORIGEN_FOTOS_PEXELS);
  if (id == null || !mini) return null;
  return {
    id,
    ancho: typeof o.width === 'number' ? o.width : 0,
    alto: typeof o.height === 'number' ? o.height : 0,
    autor: texto(o.photographer, 80),
    pagina: urlDePexels(o.url, 'https://www.pexels.com') ?? '',
    mini,
    alt: texto(o.alt, 160),
  };
}

/**
 * La URL que se BAJA para el video: el recorte que Pexels ya arma para la orientación (`portrait` 800×1200,
 * `landscape` 1200×627) o `large2x` (940 px de ancho al doble) para la cuadrada. Siempre de images.pexels.com.
 */
export function urlDeFotoPexels(crudo: unknown, orientacion: OrientacionBroll): string | null {
  if (!crudo || typeof crudo !== 'object') return null;
  const src = (crudo as { src?: unknown }).src;
  if (!src || typeof src !== 'object') return null;
  const s = src as Record<string, unknown>;
  const preferida = orientacion === 'vertical' ? s.portrait : orientacion === 'horizontal' ? s.landscape : s.large2x;
  return urlDePexels(preferida, ORIGEN_FOTOS_PEXELS) ?? urlDePexels(s.large2x, ORIGEN_FOTOS_PEXELS) ?? urlDePexels(s.large, ORIGEN_FOTOS_PEXELS);
}

/** Lo que se le dice a la persona cuando Pexels contesta mal (su texto, no el código). */
export function errorDePexels(status: number): string {
  if (status === 401 || status === 403) return 'Pexels no aceptó tu clave. Revísala en Integraciones.';
  if (status === 429) return 'Pasaste el límite de Pexels (200 búsquedas por hora). Vuelve a intentar en un rato.';
  if (status >= 500) return 'Pexels no contesta ahora. Vuelve a intentar en unos minutos.';
  return `Pexels contestó ${status}.`;
}

/**
 * La primera foto (o video) de cada búsqueda que no se usó antes: dos huecos no llevan la misma, ni una que ya esté en
 * la línea de tiempo (`yaUsadas`). `sirve` descarta lo que no entra en ESE hueco (un video más corto que el hueco).
 */
export function fotosElegidas<T extends { id: number }>(
  elegidos: readonly BrollElegido[],
  resultados: ReadonlyArray<{ consulta: string; fotos: T[] }>,
  { yaUsadas = new Set<number>(), sirve = () => true }: { yaUsadas?: ReadonlySet<number>; sirve?: (item: T, elegido: BrollElegido) => boolean } = {},
): Array<{ elegido: BrollElegido; foto: T }> {
  const porConsulta = new Map(resultados.map((r) => [r.consulta.toLowerCase(), r.fotos] as const));
  const usadas = new Set<number>(yaUsadas);
  const out: Array<{ elegido: BrollElegido; foto: T }> = [];
  for (const e of elegidos) {
    const foto = (porConsulta.get(e.busqueda.toLowerCase()) ?? []).find((f) => !usadas.has(f.id) && sirve(f, e));
    if (!foto) continue;
    usadas.add(foto.id);
    out.push({ elegido: e, foto });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Los VIDEOS de Pexels (/videos/search y /videos/videos/:id, sin el /v1 de las fotos)
// ─────────────────────────────────────────────────────────────────────────────
// La misma licencia que las fotos («All photos and videos on Pexels can be downloaded and used for free», pexels.com/
// license) y las mismas pautas de su API: el link a Pexels y el nombre de quien lo filmó (`user.name`).

/** Un video, como lo ve el panel: su miniatura, cuánto dura y de quién es. */
export type VideoBroll = { id: number; ancho: number; alto: number; duracion: number; autor: string; pagina: string; mini: string };

/** Un video del JSON de Pexels (`videos[i]` de /videos/search, o /videos/videos/:id). `null` si no trae lo que hace falta. */
export function videoDePexels(crudo: unknown): VideoBroll | null {
  if (!crudo || typeof crudo !== 'object') return null;
  const o = crudo as Record<string, unknown>;
  const id = typeof o.id === 'number' && Number.isInteger(o.id) && o.id > 0 ? o.id : null;
  const duracion = typeof o.duration === 'number' && Number.isFinite(o.duration) && o.duration > 0 ? o.duration : null;
  const fotos = Array.isArray(o.video_pictures) ? (o.video_pictures as Array<Record<string, unknown>>) : [];
  const mini = urlDePexels(o.image, ORIGEN_FOTOS_PEXELS) ?? urlDePexels(fotos[0]?.picture, ORIGEN_FOTOS_PEXELS);
  if (id == null || duracion == null || !mini) return null;
  const user = o.user && typeof o.user === 'object' ? (o.user as Record<string, unknown>) : {};
  return {
    id,
    ancho: typeof o.width === 'number' ? o.width : 0,
    alto: typeof o.height === 'number' ? o.height : 0,
    duracion,
    autor: texto(user.name, 80),
    pagina: urlDePexels(o.url, 'https://www.pexels.com') ?? '',
    mini,
  };
}

/** Una URL de un video de Pexels: de uno de sus orígenes (`ORIGENES_VIDEOS_PEXELS`), nunca armada. */
export function urlDeVideoPexels(v: unknown): string | null {
  for (const origen of ORIGENES_VIDEOS_PEXELS) {
    const url = urlDePexels(v, origen);
    if (url) return url;
  }
  return null;
}

/** Un archivo de video que se puede bajar, y el lado corto de su cuadro (para no probar uno más grande que otro que no entró). */
export type ArchivoVideoPexels = { url: string; lado: number };

/**
 * Los archivos del video que se pueden bajar, del que conviene al que menos: mp4 de sus orígenes con el lado corto entre
 * 360 y 1080 px; primero los de 540 o más, del más chico al más grande (pesa poco y se ve bien encima de la cara), y
 * después los de menos de 540, del más grande al más chico. Nunca 2K ni 4K. Vacío si no hay ninguno que sirva.
 */
export function archivosDeVideoPexels(crudo: unknown): ArchivoVideoPexels[] {
  if (!crudo || typeof crudo !== 'object') return [];
  const archivos = (crudo as { video_files?: unknown }).video_files;
  if (!Array.isArray(archivos)) return [];
  const { ladoMin, ladoMax, ladoIdeal } = TOPES_VIDEO_BROLL;
  const candidatos: ArchivoVideoPexels[] = [];
  const vistas = new Set<string>();
  for (const a of archivos as Array<Record<string, unknown>>) {
    if (a?.file_type !== 'video/mp4') continue;
    const url = urlDeVideoPexels(a.link);
    const w = typeof a.width === 'number' ? a.width : 0;
    const h = typeof a.height === 'number' ? a.height : 0;
    const lado = Math.min(w, h);
    if (!url || vistas.has(url) || lado < ladoMin || lado > ladoMax) continue;
    vistas.add(url);
    candidatos.push({ url, lado });
  }
  const grupo = (lado: number) => (lado >= ladoIdeal ? 0 : 1);
  return candidatos.sort((a, b) => grupo(a.lado) - grupo(b.lado) || (grupo(a.lado) === 0 ? a.lado - b.lado : b.lado - a.lado));
}

/**
 * Los archivos que se prueban, en orden, sabiendo cuáles ya pasaron del techo de peso: uno con el lado igual o más
 * grande que el de uno que ya pesó de más no se prueba (con el mismo video, más píxeles es más peso). `techo` es el lado
 * más chico que pesó de más (Infinity si ninguno).
 */
export function siguienteArchivo(candidatos: readonly ArchivoVideoPexels[], probados: ReadonlySet<string>, techo: number): ArchivoVideoPexels | null {
  return candidatos.find((c) => !probados.has(c.url) && c.lado < techo) ?? null;
}

/** ¿El archivo es un MP4? La caja `ftyp` a los 4 bytes (nunca el content-type de un tercero). */
export function esMp4(bytes: Uint8Array): boolean {
  return bytes.length > 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70;
}
