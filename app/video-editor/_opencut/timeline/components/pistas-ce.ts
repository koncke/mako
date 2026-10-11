// =============================================================================
// Las pistas como en CapCut: orden, bloqueo y la pista «Subtítulos»
// =============================================================================
// Lo usan la línea de tiempo (dibujo), las acciones de teclado y la barra.
//
// «Bloquear pista» es NUEVO respecto de OpenCut: una pista bloqueada no deja
// elegir, mover, recortar ni borrar sus clips, ni soltar nada encima. Se
// respeta en cuatro lugares, y uno nuevo que edite clips tiene que pasar por
// `sinBloqueados`:
//   · el dibujo (los clips de una pista bloqueada no reciben el mouse);
//   · la selección por recuadro y «Seleccionar todo / hacia un lado»;
//   · las acciones sobre «lo que está en el cabezal» (Dividir sin selección…);
//   · la ubicación (timeline/placement: una pista bloqueada no acepta nada).
// El reproductor (paquete E) puede mover con sus tiradores un clip elegido:
// tiene `estaBloqueada` para negarse.

import type { EditorCore } from "@/app/video-editor/_opencut/core";
import type {
	ElementRef,
	SceneTracks,
	TimelineTrack,
	TScene,
} from "@/app/video-editor/_opencut/timeline";
import { findTrackInSceneTracks, updateTrackInSceneTracks } from "@/app/video-editor/_opencut/timeline";
import { TracksSnapshotCommand } from "@/app/video-editor/_opencut/commands/timeline/tracks-snapshot";

/** Arriba → abajo, como se dibujan: superposiciones, principal, audio. */
export function pistasEnOrden(scene: TScene | null): TimelineTrack[] {
	if (!scene) return [];
	return [...scene.tracks.overlay, scene.tracks.main, ...scene.tracks.audio];
}

export function estaBloqueada({
	tracks,
	trackId,
}: {
	tracks: SceneTracks;
	trackId: string;
}): boolean {
	return findTrackInSceneTracks({ tracks, trackId })?.locked === true;
}

/** Saca de una lista de clips los que viven en pistas bloqueadas. */
export function sinBloqueados({
	tracks,
	refs,
}: {
	tracks: SceneTracks;
	refs: ElementRef[];
}): ElementRef[] {
	return refs.filter((ref) => !estaBloqueada({ tracks, trackId: ref.trackId }));
}

/** «Bloquear pista» / «Desbloquear pista», con deshacer. Suelta la selección de esa pista. */
export function alternarBloqueoPista({
	editor,
	trackId,
}: {
	editor: EditorCore;
	trackId: string;
}): void {
	const before = editor.scenes.getActiveScene().tracks;
	const after = updateTrackInSceneTracks({
		tracks: before,
		trackId,
		update: (track) => ({ ...track, locked: !track.locked }),
	});
	editor.command.execute({
		command: new TracksSnapshotCommand({ before, after }),
	});
	const bloqueada = findTrackInSceneTracks({ tracks: after, trackId })?.locked;
	if (bloqueada) {
		const seleccion = editor.selection.getSelectedElements();
		const resto = seleccion.filter((ref) => ref.trackId !== trackId);
		if (resto.length !== seleccion.length) {
			editor.selection.setSelectedElements({ elements: resto });
		}
	}
}

/**
 * Una pista de texto cuyos textos son TODOS subtítulos (`params.subtitulo`,
 * lo escribe el paquete de subtítulos) se rotula «Subtítulos», como la pista
 * de subtítulos de CapCut.
 */
export function esPistaSubtitulos(track: TimelineTrack): boolean {
	return (
		track.type === "text" &&
		track.elements.length > 0 &&
		track.elements.every((e) => e.params.subtitulo === true)
	);
}

const contiene = (
	e: { startTime: number; duration: number },
	t: number,
) => t > e.startTime && t < e.startTime + e.duration;

/**
 * Sobre qué clips actúan Dividir / Borrar a la izquierda / a la derecha: los
 * ELEGIDOS que el cabezal atraviesa; sin selección, el de la pista principal
 * que está bajo el cabezal (como CapCut). Nunca los de pistas bloqueadas.
 */
export function objetivosEnCabezal({
	editor,
	tiempo = editor.playback.getCurrentTime(),
}: {
	editor: EditorCore;
	tiempo?: number;
}): ElementRef[] {
	const scene = editor.scenes.getActiveSceneOrNull();
	if (!scene) return [];
	const tracks = scene.tracks;
	const seleccion = sinBloqueados({
		tracks,
		refs: editor.selection.getSelectedElements(),
	});
	if (seleccion.length > 0) {
		return editor.timeline
			.getElementsWithTracks({ elements: seleccion })
			.filter(({ element }) => contiene(element, tiempo))
			.map(({ track, element }) => ({ trackId: track.id, elementId: element.id }));
	}
	if (tracks.main.locked) return [];
	const enPrincipal = tracks.main.elements.find((e) => contiene(e, tiempo));
	return enPrincipal ? [{ trackId: tracks.main.id, elementId: enPrincipal.id }] : [];
}

/** Todos los clips (de pistas sin bloquear) que el cabezal atraviesa: «Dividir todo». */
export function todosEnCabezal({
	editor,
	tiempo = editor.playback.getCurrentTime(),
}: {
	editor: EditorCore;
	tiempo?: number;
}): ElementRef[] {
	return pistasEnOrden(editor.scenes.getActiveSceneOrNull()).flatMap((track) =>
		track.locked
			? []
			: track.elements
					.filter((e) => contiene(e, tiempo))
					.map((e) => ({ trackId: track.id, elementId: e.id })),
	);
}
