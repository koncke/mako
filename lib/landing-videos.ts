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

import { canonizarVideoId, MAX_VIDEO_ID } from './video-id';

export const VIDEOS_KEY = 'landing.videos';

/**
 * El saneo de un id de video, y el ÚNICO de este módulo.
 *
 * ⚠️ VA ACÁ Y NO EN CADA CALL-SITE. Este módulo es el choke point del catálogo:
 * por `parsearVideos`, `conVideo`, `sinVideo`, `parsearOcultos`, `conOculto` y
 * `sinOculto` pasan las dos pantallas que lo escriben Y las tres operaciones de la
 * API de MaKo. Si la canonicalización viviera en los llamadores, la próxima
 * pantalla nacería sin ella — y el modo de falla es que dos filas nombren el
 * mismo video, que es exactamente lo que se vino a cerrar.
 */
function idVideo(x: unknown): string { return canonizarVideoId(limpiar(x, MAX_VIDEO_ID)) ?? ''; }

/** Tope: más que esto en una landing y el desplegable deja de servir. */
export const MAX_VIDEOS = 20;

/**
 * Los videos que el negocio marcó como «este no es de mi página».
 *
 * ⚠️ VA EN SU PROPIA LISTA Y NO COMO UN CAMPO DE `VideoLanding`, aunque parezca
 * el lugar obvio. `landing.videos` contesta «cómo llamo a cada video mío» y toda
 * su lógica depende de eso: exige nombre, deja UN solo VSL, conserva la posición
 * al renombrar. Un video oculto no tiene nombre ni lo va a tener — meterlo ahí
 * obligaba a aflojar el «sin nombre no entra», que es justo lo que impide que la
 * lista se llene de filas mudas.
 *
 * ⚠️ Y ESCONDER NO ES BORRAR. Los eventos de ese video son un hecho y quedan
 * donde están: si un día vuelve a reproducirse, la medición sigue completa. Lo
 * único que se guarda acá es «no me lo ofrezcas para nombrar».
 */
export const VIDEOS_OCULTOS_KEY = 'landing.videos_ocultos';

/** Nunca lanza: una lista corrupta deja de esconder, no rompe la pantalla. */
export function parsearOcultos(crudo: string | null): string[] {
  if (!crudo?.trim()) return [];
  try {
    const v: unknown = JSON.parse(crudo);
    if (!Array.isArray(v)) return [];
    return [...new Set(v.filter((x): x is string => typeof x === 'string' && !!x.trim()).map(idVideo).filter(Boolean))].slice(0, MAX_VIDEOS * 2);
  } catch { return []; }
}

export function conOculto(actuales: string[], id: string): string[] {
  const i = idVideo(id);
  if (!i) return actuales;
  return actuales.includes(i) ? actuales : [...actuales, i].slice(0, MAX_VIDEOS * 2);
}

export function sinOculto(actuales: string[], id: string): string[] {
  // Canonizado igual que al esconder: si acá se comparara el id crudo, dejar de
  // esconder un video pedido por su alias no encontraría la fila guardada.
  const i = idVideo(id);
  return actuales.filter((x) => x !== i);
}

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
    const id = idVideo(o.id);
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
  const id = idVideo(video.id);
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
  const i = idVideo(id);
  return actuales.filter((v) => v.id !== i);
}

/** El VSL del workspace, o null si todavía nadie eligió cuál es. */
export function vslDe(videos: VideoLanding[]): VideoLanding | null {
  return videos.find((v) => v.esVsl) ?? null;
}

/** Cómo se llama un video en pantalla. Sin nombre guardado, se cae al id — que
 *  es feo pero VERDADERO; inventarle «Video» a secas los haría indistinguibles. */
export function nombreDe(videos: VideoLanding[], id: string | null | undefined): string {
  const i = idVideo(id);
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
  const i = idVideo(id);
  const guardado = i ? videos.find((v) => v.id === i) : undefined;
  if (guardado) return { texto: guardado.nombre, propio: true, esVsl: guardado.esVsl === true };
  const t = limpiar(tituloDelPlayer, 60);
  if (t) return { texto: t, propio: false, esVsl: false };
  if (!i) return { texto: 'Video sin identificar', propio: false, esVsl: false };
  return { texto: i.length > 12 ? `Video ${i.slice(0, 8)}…` : `Video ${i}`, propio: false, esVsl: false };
}

// ── El BALDE: los eventos que no se pudieron atribuir a ningún video ─────────
//
// `getVslEngagement` (lib/leads.ts) agrupa la retención por `video_id` y deja una
// entrada aparte para las filas que llegaron SIN id. Esa entrada —el balde— tiene
// `videoId: null` por construcción y no lo pierde nunca: la clave del mapa es `''`
// y el id se inicializa en null.
//
// De ahí salen las dos preguntas de abajo, y son DISTINTAS. Viven acá, juntas,
// porque las dos puntas de la misma oferta tienen que mirar el MISMO universo: la
// lista que se dibuja, la que se ofrece nombrar y la que el pop-up contesta. Ya se
// pagó tenerlas separadas — el botón «ponles un nombre» abría un pop-up sin una
// sola fila que contestar.
//
// El tipo va estructural a propósito: `VideoEngagement` vive en `lib/leads.ts`, que
// es `server-only`, y este módulo lo importan componentes de cliente.

/** Lo que las dos preguntas necesitan saber de una fila de retención. */
export type FilaRetencion = { videoId: string | null; plays: number; maxPct: number | null };

/**
 * ¿Se le puede poner nombre?
 *
 * Sólo si hay un id contra el que guardarlo. El balde no tiene y no va a tener, así
 * que ofrecerle un nombre es invitar a algo imposible — se reportó dos veces:
 * «sigue sin dejarme poner de qué video es el "Video sin identificar"».
 */
export const videoNombrable = (v: FilaRetencion): boolean => !!v.videoId;

/**
 * ¿Esta fila dice algo, o es el balde vacío?
 *
 * ⚠️ UN BALDE SIN REPRODUCCIONES NO SE DIBUJA. `getVslEngagement` consulta
 * `vsl_events` sin filtrar por tipo, así que los eventos de la PÁGINA (`pageview`,
 * `click`, `scroll`, `salio`, `volvio`, `cierre`) caen también en el balde —todos
 * llegan sin `video_id`— y `avanceDe` los descarta por no ser de video. O sea que
 * cualquier lead que haya visitado la landing termina con una fila
 * «sin identificar · sin reproducir» al lado de su video real.
 *
 * No era un renglón de más: con dos entradas la tarjeta creía que había varios
 * videos, escondía el minicard «Retención del VSL» y dibujaba un desglose para uno
 * solo. Martín: «en caso de que ya no haya video para identificar, porque solo hay
 * 1, está mal que aparezca eso allí».
 *
 * Con reproducciones SÍ se dibuja: son mediciones reales de antes de la v5 del
 * snippet, y esconderlas sería perder plays que ocurrieron.
 */
export const filaDeRetencionInforma = (v: FilaRetencion): boolean =>
  videoNombrable(v) || v.plays > 0 || v.maxPct != null;
