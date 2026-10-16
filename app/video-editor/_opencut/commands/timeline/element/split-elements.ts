import {
	Command,
	createElementSelectionResult,
	type CommandResult,
} from "@/app/video-editor/_opencut/commands/base-command";
import type { SceneTracks, TimelineElement } from "@/app/video-editor/_opencut/timeline";
import { EditorCore } from "@/app/video-editor/_opencut/core";
import { dividirElemento } from "@/app/video-editor/_opencut/timeline/dividir-elemento";
import type { MediaTime } from "@/app/video-editor/_opencut/wasm";

export class SplitElementsCommand extends Command {
	private savedState: SceneTracks | null = null;
	private rightSideElements: { trackId: string; elementId: string }[] = [];
	private readonly elements: { trackId: string; elementId: string }[];
	private readonly splitTime: MediaTime;
	private readonly retainSide: "both" | "left" | "right";

	constructor({
		elements,
		splitTime,
		retainSide = "both",
	}: {
		elements: { trackId: string; elementId: string }[];
		splitTime: MediaTime;
		retainSide?: "both" | "left" | "right";
	}) {
		super();
		this.elements = elements;
		this.splitTime = splitTime;
		this.retainSide = retainSide;
	}

	getRightSideElements(): { trackId: string; elementId: string }[] {
		return this.rightSideElements;
	}

	execute(): CommandResult | undefined {
		const editor = EditorCore.getInstance();
		this.savedState = editor.scenes.getActiveScene().tracks;
		this.rightSideElements = [];

		const splitTrack = <
			TTrack extends { id: string; elements: TimelineElement[] },
		>(
			track: TTrack,
		): TTrack => {
			const elementsToSplit = this.elements.filter(
				(target) => target.trackId === track.id,
			);

			if (elementsToSplit.length === 0) {
				return track;
			}

			const elements = track.elements.flatMap((element) => {
				const shouldSplit = elementsToSplit.some(
					(target) => target.elementId === element.id,
				);
				if (!shouldSplit) {
					return [element];
				}
				// La cuenta vive en timeline/dividir-elemento.ts (pura, la usa también
				// la edición por transcripción).
				const partes = dividirElemento({
					element,
					splitTime: this.splitTime,
					retainSide: this.retainSide,
				});
				if (!partes) {
					return [element];
				}
				if (partes.derecha) {
					this.rightSideElements.push({
						trackId: track.id,
						elementId: partes.derecha.id,
					});
				}
				return [partes.izquierda, partes.derecha].filter(
					(e): e is TimelineElement => e !== null,
				);
			});

			return { ...track, elements } as TTrack;
		};

		const updatedTracks: SceneTracks = {
			overlay: this.savedState.overlay.map((track) => splitTrack(track)),
			main: splitTrack(this.savedState.main),
			audio: this.savedState.audio.map((track) => splitTrack(track)),
		};

		editor.timeline.updateTracks(updatedTracks);

		if (this.rightSideElements.length > 0) {
			return createElementSelectionResult(this.rightSideElements);
		}
		return undefined;
	}

	undo(): void {
		if (this.savedState) {
			const editor = EditorCore.getInstance();
			editor.timeline.updateTracks(this.savedState);
		}
	}
}
