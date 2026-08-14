// =============================================================================
// landing-videos — qué video es cuál, en la landing del cliente
// =============================================================================
// Una landing puede tener varios videos: el VSL, un testimonio, una demo. Hasta
// ahora el snippet los medía a TODOS y los mezclaba en una sola curva, así que
// «cuánto del VSL ven» sumaba la gente que miró 8 segundos de un testimonio.
// La curva existía y no significaba nada, que es peor que no tenerla.
//
// La salida NO es medir solo el VSL: la infraestructura de retención ya está y
// sirve igual para un testimonio. Lo que faltaba es SABER CUÁL ES CUÁL — y eso
// no se puede adivinar desde el código: solo lo sabe quien armó la página.
//
// El patrón es el mismo que el de las páginas guardadas: el sistema DETECTA los
// videos (el snippet ya manda `video_id` y `vsl_titulo` en cada evento) y la
// persona les pone nombre. No se le pide que descubra nada; se le pide que
// nombre lo que ya está a la vista.
//
// Sin `server-only`: lo que se puede equivocar es el saneo (un id repetido, un
// nombre vacío, dos VSL marcados a la vez) y tiene que poder testearse.
// =============================================================================

export const VIDEOS_KEY = 'landing.videos';

/** Tope: más que esto en una landing y el desplegable deja de servir. */
export const MAX_VIDEOS = 20;

export type VideoLanding = {
  /** El id del player (Panda). Es lo que viaja en cada evento. */
  id: string;
  /** Cómo lo llama el negocio: «VSL», «Testimonio de Ana», «Demo del producto». */
  nombre: string;
  /**
   * Si es EL VSL. Uno solo por workspace, y es el que manda en las pantallas que
   * hablan de «el VSL» en singular (el semáforo, la retención del embudo).
   * Los demás se miden igual — lo único que cambia es cuál es el protagonista.
   */
  esVsl?: boolean;
};

const limpiar = (s: unknown, max: number): string =>
  (typeof s === 'string' ? s : '').trim().replace(/\s+/g, ' ').slice(0, max);

/** Nombre por defecto de un video recién detectado, para que nunca quede vacío. */
export function nombrePorDefecto(titulo: string | null | undefined, n: number): string {
  const t = limpiar(titulo, 60);
  return t || `Video ${n}`;
}

/** Los videos guardados, saneados. Tolera un JSON roto (devuelve lista vacía). */
export function parsearVideos(crudo: string | null): VideoLanding[] {
  if (!crudo?.trim()) return [];
  let lista: unknown;
  try { lista = JSON.parse(crudo); } catch { return []; }
  if (!Array.isArray(lista)) return [];
  const out: VideoLanding[] = [];
  for (const x of lista) {
    if (!x || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    const id = limpiar(o.id, 120);
    const nombre = limpiar(o.nombre, 60);
    if (!id || !nombre) continue;              // sin id no se puede atribuir; sin nombre no sirve de nada
    if (out.some((v) => v.id === id)) continue; // el id es la identidad: no puede repetirse
    out.push({ id, nombre, ...(o.esVsl === true ? { esVsl: true } : {}) });
  }
  return unSoloVsl(out).slice(0, MAX_VIDEOS);
}

/**
 * Deja UN solo VSL: el primero marcado gana.
 *
 * No es cosmético. Las pantallas que hablan de «el VSL» en singular —la
 * retención del embudo, el semáforo— tienen que poder preguntar «cuál es» y
 * recibir una respuesta, no una lista. Con dos marcados, cada pantalla elegiría
 * uno distinto según cómo ordene, y los números dejarían de cerrar entre sí.
 */
export function unSoloVsl(videos: VideoLanding[]): VideoLanding[] {
  let visto = false;
  return videos.map((v) => {
    if (!v.esVsl) return { ...v, esVsl: undefined } as VideoLanding;
    if (visto) return { id: v.id, nombre: v.nombre };
    visto = true;
    return v;
  }).map((v) => (v.esVsl ? v : { id: v.id, nombre: v.nombre }));
}

/** Agrega o renombra un video. Devuelve null si no se puede (sin id o sin nombre). */
export function conVideo(actuales: VideoLanding[], video: VideoLanding): VideoLanding[] | null {
  const id = limpiar(video.id, 120);
  const nombre = limpiar(video.nombre, 60);
  if (!id || !nombre) return null;
  const existe = actuales.some((v) => v.id === id);
  // Se conserva la POSICIÓN al renombrar: en un desplegable, que un renglón salte
  // al final porque le cambiaste el nombre es desconcertante.
  const base = existe
    ? actuales.map((v) => (v.id === id ? { id, nombre, ...(video.esVsl ? { esVsl: true as const } : {}) } : v))
    : [...actuales, { id, nombre, ...(video.esVsl ? { esVsl: true as const } : {}) }];
  // Marcar uno como VSL DESMARCA al anterior: es una elección, no una etiqueta
  // que se acumula. Si no, marcar el segundo dejaría dos y ganaría el orden.
  const conVsl = video.esVsl ? base.map((v) => (v.id === id ? v : { id: v.id, nombre: v.nombre })) : base;
  return unSoloVsl(conVsl).slice(0, MAX_VIDEOS);
}

export function sinVideo(actuales: VideoLanding[], id: string): VideoLanding[] {
  const i = limpiar(id, 120);
  return actuales.filter((v) => v.id !== i);
}

/** El VSL del workspace, o null si todavía nadie eligió cuál es. */
export function vslDe(videos: VideoLanding[]): VideoLanding | null {
  return videos.find((v) => v.esVsl) ?? null;
}

/** Cómo se llama un video en pantalla. Sin nombre guardado, se cae al id — que
 *  es feo pero VERDADERO; inventarle «Video» a secas los haría indistinguibles. */
export function nombreDe(videos: VideoLanding[], id: string | null | undefined): string {
  const i = limpiar(id, 120);
  if (!i) return 'Video sin identificar';
  return videos.find((v) => v.id === i)?.nombre ?? i;
}
