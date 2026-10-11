// =============================================================================
// Poner, sacar y restilar subtítulos en la línea de tiempo
// =============================================================================
// Todo pasa por UN comando de deshacer: generar con «Eliminar los subtítulos
// actuales» saca los viejos y pone los nuevos en un solo paso (Ctrl+Z devuelve
// los viejos), y aplicar una plantilla a 200 subtítulos es un solo paso.
//
// Los subtítulos van en una pista de texto PROPIA, arriba de todo (como la pista
// «Subtítulos» de CapCut). Si un archivo importado trae cues que se pisan (un SRT
// puede), los que no entran van a una segunda pista: dos clips no pueden ocupar
// el mismo tiempo en una pista.

import type { EditorCore } from "@/app/video-editor/_opencut/core";
import { TracksSnapshotCommand } from "@/app/video-editor/_opencut/commands/timeline/tracks-snapshot";
import type { ParamValue, ParamValues } from "@/app/video-editor/_opencut/params";
import type {
	CreateTextElement,
	OverlayTrack,
	SceneTracks,
	TextElement,
	TextTrack,
} from "@/app/video-editor/_opencut/timeline";
import { buildEmptyTrack } from "@/app/video-editor/_opencut/timeline/placement/track-factory";
import { loadFonts } from "@/app/video-editor/_opencut/fonts/google-fonts";
import { generateUUID } from "@/app/video-editor/_opencut/utils/id";
import { PARAM_SUBTITULO } from "@/app/video-editor/_opencut/params/extra/subtitulos";
import {
	bordeInferiorDe,
	buildSubtitleTextElement,
	partirYUbicar,
} from "./build-subtitle-text-element";
import type { Lienzo } from "./estilos";
import type { SubtitleCue } from "./types";

export const NOMBRE_PISTA_SUBTITULOS = "Subtítulos";

export type SubtituloEnPista = { track: TextTrack; element: TextElement };

export function esSubtitulo(element: { type: string; params?: ParamValues }): boolean {
	return element.type === "text" && element.params?.[PARAM_SUBTITULO] === true;
}

/** Todos los subtítulos de la escena, en orden de tiempo. */
export function subtitulosDe(tracks: SceneTracks | null | undefined): SubtituloEnPista[] {
	if (!tracks) return [];
	const lista: SubtituloEnPista[] = [];
	for (const track of tracks.overlay) {
		if (track.type !== "text") continue;
		for (const element of track.elements) {
			if (esSubtitulo(element)) lista.push({ track, element });
		}
	}
	return lista.sort((a, b) => a.element.startTime - b.element.startTime);
}

export function lienzoDe(editor: EditorCore): Lienzo {
	return editor.project.getActive().settings.canvasSize;
}

/** Carga las fuentes antes de MEDIR: medir con la de respaldo parte mal las líneas. */
export async function cargarFuentes(familias: string[]): Promise<void> {
	try {
		await loadFonts({ families: [...new Set(familias.filter(Boolean))] });
	} catch (error) {
		console.warn("[subtítulos] no se pudieron cargar las fuentes", error);
	}
}

/** Saca los subtítulos de las pistas, y las pistas de texto que quedan vacías por eso. */
function sinSubtitulos(tracks: SceneTracks): SceneTracks {
	const overlay = tracks.overlay.flatMap((track): OverlayTrack[] => {
		if (track.type !== "text") return [track];
		const quedan = track.elements.filter((e) => !esSubtitulo(e));
		if (quedan.length === track.elements.length) return [track];
		return quedan.length > 0 ? [{ ...track, elements: quedan }] : [];
	});
	return { ...tracks, overlay };
}

/**
 * Pone los subtítulos en pistas nuevas, arriba de todo. Devuelve cuántos puso.
 * `reemplazar` = «Eliminar los subtítulos actuales».
 */
export async function insertarSubtitulos({
	editor,
	captions,
	estilo,
	reemplazar = false,
}: {
	editor: EditorCore;
	captions: SubtitleCue[];
	estilo?: Record<string, ParamValue>;
	reemplazar?: boolean;
}): Promise<number> {
	if (captions.length === 0 || !editor.scenes.getActiveSceneOrNull()) return 0;
	const lienzo = lienzoDe(editor);
	await cargarFuentes([
		String(estilo?.fontFamily ?? ""),
		...captions.map((c) => c.style?.fontFamily ?? ""),
	]);

	const elementos: CreateTextElement[] = [...captions]
		.sort((a, b) => a.startTime - b.startTime)
		.map((caption, index) =>
			buildSubtitleTextElement({ index, caption, canvasSize: lienzo, estilo }),
		);

	// Reparto en pistas: cada cue en la primera pista donde no pisa a nadie.
	const pistas: TextTrack[] = [];
	for (const el of elementos) {
		let pista = pistas.find((p) => {
			const ultimo = p.elements[p.elements.length - 1];
			return !ultimo || ultimo.startTime + ultimo.duration <= el.startTime;
		});
		if (!pista) {
			pista = buildEmptyTrack({ id: generateUUID(), type: "text", name: NOMBRE_PISTA_SUBTITULOS });
			pistas.push(pista);
		}
		pista.elements.push({ ...el, id: generateUUID() } as TextElement);
	}

	// Se lee la escena DESPUÉS de las esperas (fuentes): mientras tanto pudo cambiar.
	const before = editor.scenes.getActiveScene().tracks;
	const base = reemplazar ? sinSubtitulos(before) : before;
	const after: SceneTracks = { ...base, overlay: [...pistas, ...base.overlay] };
	editor.command.execute({ command: new TracksSnapshotCommand({ before, after }) });
	return elementos.length;
}

/** Cambia parámetros de varios subtítulos en un solo paso de deshacer. */
export function actualizarSubtitulos({
	editor,
	cambios,
}: {
	editor: EditorCore;
	cambios: Array<{ trackId: string; elementId: string; params: ParamValues }>;
}): void {
	if (cambios.length === 0) return;
	editor.timeline.updateElements({
		updates: cambios.map(({ trackId, elementId, params }) => ({
			trackId,
			elementId,
			patch: { params } as Partial<TextElement>,
		})),
	});
}

/**
 * Escribe un estilo en TODOS los subtítulos y los vuelve a partir y a ubicar,
 * cada uno con su borde de abajo donde estaba (si el cliente los subió, quedan
 * arriba).
 */
export async function aplicarEstiloASubtitulos({
	editor,
	estilo,
	excepto,
	bordeComun,
}: {
	editor: EditorCore;
	estilo: Record<string, ParamValue>;
	/** El subtítulo del que sale el estilo (no hace falta reescribirlo). */
	excepto?: string;
	/**
	 * Un borde de abajo para TODOS (px desde el centro): «Aplicar en todos los
	 * subtítulos» los lleva a la altura del elegido. Sin esto, cada uno conserva
	 * el suyo (una plantilla no mueve lo que el cliente subió).
	 */
	bordeComun?: number | null;
}): Promise<number> {
	const lienzo = lienzoDe(editor);
	await cargarFuentes([String(estilo.fontFamily ?? "")]);
	const lista = subtitulosDe(editor.scenes.getActiveSceneOrNull()?.tracks).filter(
		({ element }) => element.id !== excepto,
	);
	const cambios = lista.map(({ track, element }) => {
		const borde = bordeComun ?? bordeInferiorDe({ params: element.params, lienzo });
		const params = { ...element.params, ...estilo };
		const ubicado = partirYUbicar({
			params,
			lienzo,
			repartir: true,
			ubicacion: borde != null ? { bordeInferior: borde } : {},
		});
		// La X se respeta si el estilo trae una (copiar de un subtítulo movido).
		if (estilo["transform.positionX"] != null) {
			ubicado["transform.positionX"] = estilo["transform.positionX"];
		}
		return { trackId: track.id, elementId: element.id, params: { ...estilo, ...ubicado } };
	});
	actualizarSubtitulos({ editor, cambios });
	return cambios.length;
}

/** Las claves que NO son estilo: no viajan con «Aplicar en todos los subtítulos». */
const NO_ESTILO = new Set(["content", PARAM_SUBTITULO]);

/** El estilo de un subtítulo, para escribirlo en los demás. */
export function estiloDe(element: TextElement): Record<string, ParamValue> {
	const estilo: Record<string, ParamValue> = {};
	for (const [clave, valor] of Object.entries(element.params)) {
		if (!NO_ESTILO.has(clave) && clave !== "transform.positionY") estilo[clave] = valor;
	}
	return estilo;
}
