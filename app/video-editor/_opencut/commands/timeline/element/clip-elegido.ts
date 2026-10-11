// =============================================================================
// El clip elegido, para las operaciones de clip (Congelar, Revertir, Reflejar…)
// =============================================================================
// Las herramientas de la barra preguntan esto en cada cambio del editor (para
// habilitarse): tiene que ser barato y no tirar.

import type { EditorCore } from "@/app/video-editor/_opencut/core";
import type {
	ElementRef,
	ImageElement,
	SceneTracks,
	TimelineElement,
	TimelineTrack,
	VideoElement,
} from "@/app/video-editor/_opencut/timeline";
import {
	findTrackInSceneTracks,
	updateTrackInSceneTracks,
} from "@/app/video-editor/_opencut/timeline";
import type { MediaTime } from "@/app/video-editor/_opencut/wasm";

export type ClipVisual = VideoElement | ImageElement;

export type ClipConPista<T extends TimelineElement = TimelineElement> = {
	track: TimelineTrack;
	element: T;
};

function elegidos(editor: EditorCore, seleccion?: ElementRef[]): ClipConPista[] {
	const refs = seleccion ?? editor.selection.getSelectedElements();
	if (refs.length === 0) return [];
	return editor.timeline
		.getElementsWithTracks({ elements: refs })
		.filter(({ track }) => !track.locked);
}

/** Los clips de video o imagen elegidos (en pistas sin bloquear). */
export function clipsVisualesElegidos(
	editor: EditorCore,
	seleccion?: ElementRef[],
): ClipConPista<ClipVisual>[] {
	return elegidos(editor, seleccion).filter(
		(x): x is ClipConPista<ClipVisual> =>
			x.element.type === "video" || x.element.type === "image",
	);
}

/** EL clip de video o imagen elegido, si hay uno solo elegido. */
export function clipVisualElegido(
	editor: EditorCore,
	seleccion?: ElementRef[],
): ClipConPista<ClipVisual> | null {
	const todos = elegidos(editor, seleccion);
	if (todos.length !== 1) return null;
	const [unico] = clipsVisualesElegidos(editor, seleccion);
	return unico ?? null;
}

/** EL clip de VIDEO elegido, si hay uno solo elegido. */
export function videoElegido(
	editor: EditorCore,
	seleccion?: ElementRef[],
): ClipConPista<VideoElement> | null {
	const clip = clipVisualElegido(editor, seleccion);
	return clip && clip.element.type === "video"
		? (clip as ClipConPista<VideoElement>)
		: null;
}

/** Cambia una pista de la escena con una función sobre sus elementos. */
export function conElementosDePista(
	tracks: SceneTracks,
	trackId: string,
	cambiar: (elementos: TimelineElement[]) => TimelineElement[],
): SceneTracks {
	if (!findTrackInSceneTracks({ tracks, trackId })) return tracks;
	return updateTrackInSceneTracks({
		tracks,
		trackId,
		update: (track) =>
			({ ...track, elements: cambiar(track.elements as TimelineElement[]) }) as typeof track,
	});
}

/**
 * Corre `cantidad` los elementos de una pista que empiezan en `desde` o
 * después (menos `excepto`). Es lo que hace CapCut al meter un cuadro
 * congelado o al alargar un clip con la velocidad: lo de adelante se corre.
 */
export function correrDesde({
	elementos,
	desde,
	cantidad,
	excepto,
}: {
	elementos: TimelineElement[];
	desde: number;
	cantidad: number;
	excepto?: string;
}): TimelineElement[] {
	if (cantidad === 0) return elementos;
	return elementos.map((e) =>
		e.id !== excepto && e.startTime >= desde
			? { ...e, startTime: (e.startTime + cantidad) as MediaTime }
			: e,
	);
}
