// =============================================================================
// «Reflejar» y «Girar» de la barra de la línea de tiempo
// =============================================================================
// Reflejar alterna `reflejo.horizontal` (lo dibuja el gancho de recorte/ganchos.ts).
// Girar suma 90° en sentido horario a «Girar» del panel (`transform.rotate`):
// si esa propiedad tiene fotogramas clave y el cabezal está sobre el clip, como
// en el panel, escribe el fotograma en el cabezal en vez del valor base (si no,
// el giro no se vería: manda la animación). Cada botón es UN paso de deshacer
// aunque haya varios clips elegidos.

import type { EditorCore } from "@/app/video-editor/_opencut/core";
import type { TimelineElement } from "@/app/video-editor/_opencut/timeline";
import {
	hasKeyframesForPath,
	resolveAnimationPathValueAtTime,
	upsertPathKeyframe,
} from "@/app/video-editor/_opencut/animation";
import { coerceParamValue, getParamChannelLayout } from "@/app/video-editor/_opencut/params";
import { getElementParam } from "@/app/video-editor/_opencut/params/registry";
import { REFLEJO_HORIZONTAL } from "@/app/video-editor/_opencut/params/extra/reflejo";
import { roundMediaTime } from "@/app/video-editor/_opencut/wasm";
import { clipsVisualesElegidos } from "./clip-elegido";

const GIRO = "transform.rotate";

export function reflejarSeleccion(editor: EditorCore): void {
	const clips = clipsVisualesElegidos(editor);
	if (clips.length === 0) return;
	editor.timeline.updateElements({
		updates: clips.map(({ track, element }) => ({
			trackId: track.id,
			elementId: element.id,
			patch: {
				params: { [REFLEJO_HORIZONTAL]: element.params[REFLEJO_HORIZONTAL] !== true },
			},
		})),
	});
}

/** +90°, dentro del rango del panel (−360…360): 270 → 0, como CapCut. */
export function girar90(grados: number): number {
	const siguiente = grados + 90;
	return siguiente >= 360 ? siguiente - 360 : siguiente;
}

export function girarSeleccion(editor: EditorCore): void {
	const clips = clipsVisualesElegidos(editor);
	if (clips.length === 0) return;
	const cabezal = editor.playback.getCurrentTime();

	const updates = clips.map(({ track, element }) => {
		const base = typeof element.params[GIRO] === "number" ? (element.params[GIRO] as number) : 0;
		const local = cabezal - element.startTime;
		const dentro = local >= 0 && local <= element.duration;
		const param = getElementParam({ element, key: GIRO });
		if (
			param &&
			dentro &&
			hasKeyframesForPath({ animations: element.animations, propertyPath: GIRO })
		) {
			const tiempo = roundMediaTime({ time: local });
			const actual = resolveAnimationPathValueAtTime({
				animations: element.animations,
				propertyPath: GIRO,
				localTime: tiempo,
				fallbackValue: base,
			});
			const animations = upsertPathKeyframe({
				animations: element.animations,
				propertyPath: GIRO,
				time: tiempo,
				value: girar90(actual),
				channelLayout: getParamChannelLayout({ param }),
				coerceValue: ({ value }) => coerceParamValue({ param, value }),
			});
			return {
				trackId: track.id,
				elementId: element.id,
				patch: { animations } as Partial<TimelineElement>,
			};
		}
		return {
			trackId: track.id,
			elementId: element.id,
			patch: { params: { [GIRO]: girar90(base) } } as Partial<TimelineElement>,
		};
	});
	editor.timeline.updateElements({ updates });
}
