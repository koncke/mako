// =============================================================================
// Cambiar la velocidad de un clip (Velocidad › Estándar / Curva)
// =============================================================================
// Es un `updateElements` con el retime (el pipeline recalcula la duración),
// más lo que hace CapCut cuando el clip se ALARGA (cámara lenta): lo que venía
// detrás en la misma pista se corre para no quedar debajo. En la pista principal
// con el imán prendido lo mismo lo hace el imán (ripple/iman.ts) y correr antes
// no cambia nada; sin imán, o en una pista superpuesta, es lo que evita que dos
// clips se pisen.

import { EditorCore } from "@/app/video-editor/_opencut/core";
import { Command, type CommandResult } from "@/app/video-editor/_opencut/commands/base-command";
import type { RetimeConfig, SceneTracks, TimelineElement } from "@/app/video-editor/_opencut/timeline";
import {
	findTrackInSceneTracks,
	updateElementInSceneTracks,
} from "@/app/video-editor/_opencut/timeline";
import { applyElementUpdate } from "@/app/video-editor/_opencut/timeline/update-pipeline";
import {
	getTimelineDurationForSourceSpan,
	velocidadMediaDe,
} from "@/app/video-editor/_opencut/retime";
import { TICKS_PER_SECOND } from "@/app/video-editor/_opencut/wasm";
import { conElementosDePista, correrDesde } from "./clip-elegido";

/** «El clip debe durar al menos 0,1 s después de la rampa» (pc_clip_too_short). */
export const DURACION_MINIMA_TRAS_RAMPA = 0.1 * TICKS_PER_SECOND;

/** La fuente visible del clip, en ticks (lo que la velocidad estira o encoge). */
export function fuenteVisible(element: TimelineElement & { retime?: RetimeConfig }): number {
	return element.duration * velocidadMediaDe(element.retime);
}

/** La duración que tendría el clip con este retime, en ticks. */
export function duracionConRetime(
	element: TimelineElement & { retime?: RetimeConfig },
	retime: RetimeConfig | undefined,
): number {
	return getTimelineDurationForSourceSpan({ sourceSpan: fuenteVisible(element), retime });
}

export class CambiarVelocidadCommand extends Command {
	private savedState: SceneTracks | null = null;

	constructor(
		private readonly args: {
			trackId: string;
			elementId: string;
			retime: RetimeConfig | undefined;
		},
	) {
		super();
	}

	execute(): CommandResult | undefined {
		const editor = EditorCore.getInstance();
		const antes = editor.scenes.getActiveScene().tracks;
		this.savedState = antes;
		const { trackId, elementId, retime } = this.args;

		const track = findTrackInSceneTracks({ tracks: antes, trackId });
		const element = track?.elements.find((e) => e.id === elementId);
		if (!track || !element) return undefined;

		const nuevo = applyElementUpdate({
			element,
			patch: { retime },
			context: { tracks: antes, trackId },
		});
		let tracks = updateElementInSceneTracks({
			tracks: antes,
			trackId,
			elementId,
			update: () => nuevo,
		});

		// Si se alargó y pisa al siguiente de la pista, lo de adelante se corre.
		const finViejo = element.startTime + element.duration;
		const finNuevo = nuevo.startTime + nuevo.duration;
		if (finNuevo > finViejo) {
			const siguiente = track.elements
				.filter((e) => e.id !== elementId && e.startTime >= finViejo - 1)
				.reduce<TimelineElement | null>(
					(min, e) => (!min || e.startTime < min.startTime ? e : min),
					null,
				);
			const pisada = siguiente ? finNuevo - siguiente.startTime : 0;
			if (siguiente && pisada > 0) {
				tracks = conElementosDePista(tracks, trackId, (elementos) =>
					correrDesde({
						elementos,
						desde: siguiente.startTime,
						cantidad: pisada,
						excepto: elementId,
					}),
				);
			}
		}

		editor.timeline.updateTracks(tracks);
		return undefined;
	}

	undo(): void {
		if (this.savedState) {
			EditorCore.getInstance().timeline.updateTracks(this.savedState);
		}
	}
}
