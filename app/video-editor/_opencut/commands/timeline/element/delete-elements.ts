import { Command, type CommandResult } from "@/app/video-editor/_opencut/commands/base-command";
import type { SceneTracks } from "@/app/video-editor/_opencut/timeline";
import { EditorCore } from "@/app/video-editor/_opencut/core";
import type { TimelineTrack } from "@/app/video-editor/_opencut/timeline";
import { estanPegados, sinTransicion } from "@/app/video-editor/_opencut/transiciones/reglas";

function removeTrackElements<TTrack extends TimelineTrack>({
	track,
	elements,
}: {
	track: TTrack;
	elements: { trackId: string; elementId: string }[];
}): TTrack {
	const borrados = track.elements.filter((element) =>
		elements.some(
			(target) => target.trackId === track.id && target.elementId === element.id,
		),
	);
	if (borrados.length === 0) return track;
	// La transición de CapCut se va con el clip: la del clip que terminaba justo
	// donde empezaba uno borrado se quita, o el imán (que cierra el hueco) la
	// pasaría al clip siguiente (transiciones/reglas.ts).
	const nextElements = track.elements
		.filter((element) => !borrados.includes(element))
		.map((element) =>
			borrados.some((b) => estanPegados(element, b))
				? ({ ...element, params: sinTransicion(element.params) } as typeof element)
				: element,
		);

	return { ...track, elements: nextElements } as TTrack;
}

export class DeleteElementsCommand extends Command {
	private savedState: SceneTracks | null = null;
	private readonly elements: { trackId: string; elementId: string }[];

	constructor({
		elements,
	}: {
		elements: { trackId: string; elementId: string }[];
	}) {
		super();
		this.elements = elements;
	}

	execute(): CommandResult | undefined {
		const editor = EditorCore.getInstance();
		this.savedState = editor.scenes.getActiveScene().tracks;

		const updatedTracks: SceneTracks = {
			overlay: this.savedState.overlay.map((track) =>
				removeTrackElements({ track, elements: this.elements }),
			),
			main: removeTrackElements({
				track: this.savedState.main,
				elements: this.elements,
			}),
			audio: this.savedState.audio.map((track) =>
				removeTrackElements({ track, elements: this.elements }),
			),
		};

		editor.timeline.updateTracks(updatedTracks);

		return {
			selection: {
				selectedElements: [],
				selectedKeyframes: [],
				keyframeSelectionAnchor: null,
				selectedMaskPoints: null,
			},
		};
	}

	undo(): void {
		if (this.savedState) {
			const editor = EditorCore.getInstance();
			editor.timeline.updateTracks(this.savedState);
		}
	}
}
