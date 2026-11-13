// =============================================================================
// Los archivos de un proyecto que faltan en ESTE navegador (y lo que se le dice a la persona)
// =============================================================================
// Los proyectos viven en el navegador: la línea en IndexedDB y cada archivo en el OPFS. Si el OPFS se vacía (visto en
// producción el 12/11/2026, en el teléfono, al recargar) el proyecto abre igual: storageService.loadMediaAsset devuelve
// null para ese medio, la biblioteca queda sin él y el armado de la escena SALTA el clip (services/renderer/
// scene-builder.ts) → el reproductor queda negro y mudo, sin ningún aviso.
//
// Esto dice qué medios usa la línea y no están, para avisarlo nombrando cada archivo y ofrecer elegirlo de nuevo
// (./reenlazar.ts → MediaManager.reenlazarMedio, con el MISMO mediaId: el clip conserva recorte, velocidad y efectos).
// Lo usa el editor del teléfono (app/m/video-editor/EditorVideoM.tsx). El de la computadora sólo lo dice al generar
// subtítulos (subtitles/resultado.ts › `faltaAlgunArchivo`, que mira sólo lo que suena).
//
// Sin imports: el test lo carga en node (tests/video-editor-m-archivo-falta.test.ts).

export type TipoFaltante = "video" | "image" | "audio";

export type ArchivoFaltante = {
	mediaId: string;
	/** El nombre del clip (al insertarlo es el del archivo: timeline/element-utils.ts › buildElementFromMedia). */
	nombre: string;
	tipo: TipoFaltante;
	/** Cuántos clips usan ese archivo (un clip dividido son dos). */
	clips: number;
};

type PistasSueltas = {
	main: { elements: readonly unknown[] };
	overlay: ReadonlyArray<{ elements: readonly unknown[] }>;
	audio: ReadonlyArray<{ elements: readonly unknown[] }>;
};

type ElementoSuelto = { type?: string; mediaId?: unknown; sourceType?: string; name?: unknown; startTime?: unknown };

const NOMBRE_SIN_NOMBRE: Record<TipoFaltante, string> = { video: "un video", image: "una foto", audio: "un audio" };

/**
 * Los medios que la línea usa y no están en `idsDeMedios` (la biblioteca cargada), UNO por archivo, en el orden en que
 * aparecen en el video. Cuentan los videos, las fotos y el audio subido; la música de la biblioteca viene por URL y no.
 */
export function archivosFaltantes(tracks: PistasSueltas, idsDeMedios: ReadonlySet<string>): ArchivoFaltante[] {
	const porMedio = new Map<string, ArchivoFaltante & { inicio: number }>();
	for (const pista of [tracks.main, ...tracks.overlay, ...tracks.audio]) {
		for (const e of pista.elements as ElementoSuelto[]) {
			if (e.type !== "video" && e.type !== "image" && e.type !== "audio") continue;
			if (e.type === "audio" && e.sourceType === "library") continue;
			if (typeof e.mediaId !== "string" || !e.mediaId || idsDeMedios.has(e.mediaId)) continue;
			const inicio = typeof e.startTime === "number" ? e.startTime : Number.POSITIVE_INFINITY;
			const nombre = typeof e.name === "string" ? e.name.trim() : "";
			const ya = porMedio.get(e.mediaId);
			if (ya) {
				ya.clips += 1;
				if (inicio < ya.inicio) ya.inicio = inicio;
				if (!ya.nombre && nombre) ya.nombre = nombre;
				continue;
			}
			porMedio.set(e.mediaId, { mediaId: e.mediaId, nombre, tipo: e.type, clips: 1, inicio });
		}
	}
	return [...porMedio.values()]
		.sort((a, b) => a.inicio - b.inicio)
		.map(({ inicio: _inicio, ...f }) => ({ ...f, nombre: f.nombre || NOMBRE_SIN_NOMBRE[f.tipo] }));
}

/**
 * El título del aviso: nombra el archivo si es uno; si son varios, cuántos (cada uno va en su fila). `donde`: el teléfono
 * (app/m/video-editor/EditorVideoM.tsx) o la computadora (./components/aviso-archivos-faltantes.tsx).
 */
export function textoDelAviso(faltan: readonly Pick<ArchivoFaltante, "nombre">[], donde: "teléfono" | "navegador" = "teléfono"): string {
	if (faltan.length === 0) return "";
	if (faltan.length === 1) return `Falta «${faltan[0].nombre}» en este ${donde}`;
	return `Faltan ${faltan.length} archivos en este ${donde}`;
}

/** Lo que deja elegir el selector de archivos: el MISMO tipo del clip (un video no se reenlaza con una foto). */
export function aceptaDelFaltante(tipo: TipoFaltante): string {
	return tipo === "video" ? "video/*" : tipo === "image" ? "image/*" : "audio/*";
}

/** El aviso de cuando el archivo elegido es de otro tipo que el del clip. */
export const AVISO_OTRO_TIPO: Record<TipoFaltante, string> = {
	video: "Ese archivo no es un video",
	image: "Ese archivo no es una foto",
	audio: "Ese archivo no es un audio",
};
