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

/**
 * Los tipos de video que se ofrecen hechos, para no obligar a escribir.
 *
 * Es la regla de la casa de minimizar la config: una lista con la salida de
 * escribir otro convierte «pensá un nombre» en «elegí uno», que se contesta en un
 * click. El orden es por frecuencia esperada, no alfabético.
 */
export const TIPOS_VIDEO = [
  'VSL',
  'Testimonio',
  'Demo del producto',
  'Caso de éxito',
  'Presentación',
  'Anuncio',
  'Video de bienvenida',
] as const;

/**
 * Si un nombre declara que ESTE es el VSL.
 *
 * ⚠️ Una sola pregunta, no dos. La alternativa era un desplegable para el nombre
 * y aparte un control «marcar como VSL» — dos controles para una decisión, y el
 * segundo se queda sin contestar porque no se entiende qué agrega. Acá el nombre
 * ES la respuesta: quien elige «VSL» ya dijo cuál es.
 *
 * Se busca la palabra suelta, así que «VSL», «Mi VSL» y «VSL de ventas» marcan, y
 * «Testimonio» no. Es una heurística sobre texto que escribe una persona, y por
 * eso la fila muestra el distintivo VSL: la consecuencia se ve antes de guardar,
 * que es lo único que vuelve corregible una heurística.
 */
export function esTipoVsl(nombre: string): boolean {
  return /(^|\s)vsl(\s|$)/i.test(limpiar(nombre, 60));
}

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
    if (v.esVsl && !visto) { visto = true; return { id: v.id, nombre: v.nombre, esVsl: true as const }; }
    // Se reconstruye el objeto en vez de poner `esVsl: undefined`: una clave con
    // undefined sobrevive al `JSON.stringify` de algunos serializadores y vuelve
    // a leerse como presente. Lo que no está no puede confundir a nadie.
    return { id: v.id, nombre: v.nombre };
  });
}

/**
 * Agrega o renombra un video. Devuelve null si no se puede (sin id o sin nombre).
 *
 * ⚠️ `esVsl` tiene TRES valores, no dos: `true` marca, `false` desmarca y
 * **`undefined` significa "no lo toques"**. Sin esa distinción, renombrar el VSL
 * lo degradaba en silencio — la pantalla de renombrar no manda el flag porque no
 * está preguntando eso, y el video perdía el título sin que nadie lo pidiera.
 *
 * Es la regla de «cada pregunta, su campo»: «cómo se llama» y «cuál es el VSL»
 * son dos preguntas distintas, y contestar la primera no puede contestar la
 * segunda por omisión. Lo encontró el test de acá al lado, no la pantalla.
 */
export function conVideo(actuales: VideoLanding[], video: VideoLanding): VideoLanding[] | null {
  const id = limpiar(video.id, 120);
  const nombre = limpiar(video.nombre, 60);
  if (!id || !nombre) return null;
  const previo = actuales.find((v) => v.id === id);
  const marcado = video.esVsl ?? previo?.esVsl ?? false;
  const nuevo: VideoLanding = marcado ? { id, nombre, esVsl: true } : { id, nombre };
  // Se conserva la POSICIÓN al renombrar: en un desplegable, que un renglón salte
  // al final porque le cambiaste el nombre es desconcertante.
  const base = previo ? actuales.map((v) => (v.id === id ? nuevo : v)) : [...actuales, nuevo];
  // Marcar uno como VSL DESMARCA al anterior: es una elección, no una etiqueta
  // que se acumula. Si no, marcar el segundo dejaría dos y ganaría el orden — o
  // sea, el click no haría nada visible.
  const conVsl = marcado ? base.map((v) => (v.id === id ? v : { id: v.id, nombre: v.nombre })) : base;
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

/**
 * El rótulo de un video en una pantalla del CRM, con la cascada completa.
 *
 * Tres fuentes, de la más confiable a la menos: el nombre que puso la persona, el
 * `title` que el player reportó, y el id. El id de Panda es un UUID de 36
 * caracteres — pegarlo entero en una ficha la vuelve ilegible, así que se corta;
 * pero se corta con puntos suspensivos y NO se reemplaza por «Video», porque dos
 * videos que se llaman igual no se pueden comparar, que es todo lo que esta
 * pantalla existe para hacer.
 *
 * Devuelve también `propio`: si el rótulo lo eligió una persona o lo estamos
 * infiriendo. La pantalla lo usa para ofrecer ponerle nombre — sin esa marca,
 * un título del player se ve idéntico a uno elegido y nadie sabe que falta algo.
 */
export function rotuloDe(
  videos: VideoLanding[],
  id: string | null | undefined,
  tituloDelPlayer?: string | null,
): { texto: string; propio: boolean; esVsl: boolean } {
  const i = limpiar(id, 120);
  const guardado = i ? videos.find((v) => v.id === i) : undefined;
  if (guardado) return { texto: guardado.nombre, propio: true, esVsl: guardado.esVsl === true };
  const t = limpiar(tituloDelPlayer, 60);
  if (t) return { texto: t, propio: false, esVsl: false };
  if (!i) return { texto: 'Video sin identificar', propio: false, esVsl: false };
  return { texto: i.length > 12 ? `Video ${i.slice(0, 8)}…` : `Video ${i}`, propio: false, esVsl: false };
}
