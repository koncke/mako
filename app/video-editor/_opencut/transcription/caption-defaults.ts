// Cómo se cortan los subtítulos automáticos (transcription/caption.ts). Medidos
// a ojo contra los de CapCut: una línea corta que se lee de un vistazo, que
// cambia en las pausas y al terminar una oración.

/** Silencio entre dos palabras que corta el subtítulo, en segundos. */
export const PAUSA_CORTE_S = 0.5;
/** Un subtítulo no dura más que esto aunque no haya pausa. */
export const MAX_DURACION_SUBTITULO_S = 5;
/** Ni menos que esto (si el siguiente lo deja): menos no se alcanza a leer. */
export const MIN_CAPTION_DURATION_SECONDS = 0.6;
/** Un hueco más chico que esto entre dos subtítulos se cierra (si no, parpadea). */
export const HUECO_MINIMO_S = 0.3;

/** Caracteres por subtítulo según la forma del lienzo. */
export function maxCaracteresPara(lienzo: { width: number; height: number }): number {
	const r = lienzo.width / Math.max(1, lienzo.height);
	if (r < 0.9) return 28; // vertical (9:16, 4:5)
	if (r < 1.2) return 32; // cuadrado
	return 42; // horizontal
}

/** Lo que usaba OpenCut (repartir en tandas fijas); queda para la importación manual. */
export const DEFAULT_WORDS_PER_CAPTION = 3;
