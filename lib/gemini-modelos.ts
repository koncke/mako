// =============================================================================
// gemini-modelos — los nombres de los modelos de Gemini y su lectura del entorno, en UN lugar (18/11/2026, F74)
// =============================================================================
// Hasta este día `gemini-flash-latest` y `gemini-flash-lite-latest` estaban escritos a mano en once lugares (la cascada barata,
// la visión, el STT de los audios y de las clases, el catálogo de modelos, Offer, el que desarma videos y tres scripts), y cada
// uno leía `GEMINI_MODEL` / `GEMINI_STT_MODEL` / `GEMINI_VISION_MODEL` en su propio orden. El día que Google mueva un alias o que
// haya que cambiar de modelo, se cambia acá y lo hereda todo.
//
// ⚠️ ESTO NO CAMBIA QUÉ MODELO CORRE: cada función devuelve exactamente lo que devolvía el `||` que reemplaza, en el mismo orden
// de variables. Gemini sigue como respaldo y como la IA de los clientes que sólo tienen su key de Gemini.
//
// ⚠️ Los alias `-latest` PROMETEN moverse (AGENTS.md → «Un modelo "latest" es un nombre que PROMETE moverse»): el 14/10/2026
// `gemini-flash-latest` dejó de aceptar `reasoning_effort: 'minimal'` sin que cambiara una línea nuestra. Lo que eso exige vive
// en lib/gemini-esfuerzo.ts (lo aprende del 400, por modelo); acá sólo está el nombre.
//
// Puro y sin `server-only` (lo leen los tests y lib/model-catalogo.ts). Las funciones leen el entorno AL LLAMARLAS, como los
// `||` de antes; el que las llama a nivel de módulo (MODELO_DOCS en lib/ai-cheap.ts) lo lee al cargar, como antes.
// =============================================================================

/** El Flash vigente: alias oficial de Google al Flash GA (un id pineado se retira y da 404 un día cualquiera). */
export const GEMINI_FLASH = 'gemini-flash-latest';
/** El respaldo: otra capacidad que la del Flash (medido el 07/10/2026: Flash en 503 «high demand», Lite en 200 a los 560 ms). */
export const GEMINI_FLASH_LITE = 'gemini-flash-lite-latest';

/** Los modelos de respaldo de Gemini, en orden, detrás del pedido (`MODELOS_RESPALDO` de lib/ai-cheap.ts). */
export const RESPALDOS_GEMINI: readonly string[] = [GEMINI_FLASH_LITE];

type Entorno = Record<string, string | undefined>;
const env = (e?: Entorno): Entorno => e ?? process.env;

/** El modelo de chat de Gemini: `GEMINI_MODEL`, o el Flash. */
export function modeloGeminiTexto(e?: Entorno): string {
  return env(e).GEMINI_MODEL || GEMINI_FLASH;
}

/** El que escucha audio: `GEMINI_STT_MODEL`, después `GEMINI_MODEL`, después el Flash. */
export function modeloGeminiStt(e?: Entorno): string {
  const v = env(e);
  return v.GEMINI_STT_MODEL || v.GEMINI_MODEL || GEMINI_FLASH;
}

/** El que lee documentos e imágenes: `GEMINI_VISION_MODEL`, después `GEMINI_MODEL`, después el Flash. */
export function modeloGeminiVision(e?: Entorno): string {
  const v = env(e);
  return v.GEMINI_VISION_MODEL || v.GEMINI_MODEL || GEMINI_FLASH;
}

/** El que mira un video entero (lib/video-desarmar-gemini.ts): `GEMINI_VIDEO_MODEL`, después `GEMINI_MODEL`, después el Flash. */
export function modeloGeminiVideo(e?: Entorno): string {
  const v = env(e);
  return v.GEMINI_VIDEO_MODEL || v.GEMINI_MODEL || GEMINI_FLASH;
}
