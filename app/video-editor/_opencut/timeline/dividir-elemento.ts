// =============================================================================
// Dividir UN elemento en un instante: la cuenta de «Dividir», sin el motor
// =============================================================================
// Era el cuerpo de SplitElementsCommand. Salió a una función pura (15/10/2026)
// porque la edición por transcripción (transcripcion/cortar.ts) corta varios
// tramos de muchos clips de una vez y arma la línea de tiempo entera antes de
// tocar el editor: así hay UN solo cambio de pistas (un paso de deshacer, una
// pasada del imán) y se puede probar sin navegador. El comando la sigue usando
// igual que antes.
//
// Lo que reparte entre las dos mitades: el tramo de la fuente (con curva de
// velocidad, según dónde cae el corte en la curva), los fotogramas clave, la
// transición (queda en la derecha), la animación (Entrada a la izquierda,
// Salida a la derecha) y los fundidos de audio.

import type { TimelineElement } from "@/app/video-editor/_opencut/timeline";
import { generateUUID } from "@/app/video-editor/_opencut/utils/id";
import { sinTransicion } from "@/app/video-editor/_opencut/transiciones/reglas";
import { sinEntrada, sinSalida } from "@/app/video-editor/_opencut/animaciones/reglas";
import { sinFundidoEntrada, sinFundidoSalida } from "@/app/video-editor/_opencut/audio/claves";
import { isRetimableElement } from "@/app/video-editor/_opencut/timeline";
import { splitAnimationsAtTime } from "@/app/video-editor/_opencut/animation";
import {
	getSourceSpanAtClipTime,
	splitRetimeAtClipTime,
} from "@/app/video-editor/_opencut/retime";
import {
	addMediaTime,
	type MediaTime,
	roundMediaTime,
	subMediaTime,
} from "@/app/video-editor/_opencut/wasm";

export type LadoQueQueda = "both" | "left" | "right";

/**
 * Las mitades de `element` cortado en `splitTime` (ticks de la línea de tiempo).
 * Null si el corte no cae ESTRICTAMENTE adentro del elemento. Con `retainSide`
 * "left" o "right" sólo vuelve esa mitad (la otra, null). La izquierda conserva
 * el id; la derecha lleva uno nuevo.
 */
export function dividirElemento({
	element,
	splitTime,
	retainSide = "both",
	nuevoId = generateUUID,
}: {
	element: TimelineElement;
	splitTime: MediaTime;
	retainSide?: LadoQueQueda;
	nuevoId?: () => string;
}): { izquierda: TimelineElement | null; derecha: TimelineElement | null } | null {
	const effectiveStart = element.startTime;
	const effectiveEnd = element.startTime + element.duration;
	if (splitTime <= effectiveStart || splitTime >= effectiveEnd) return null;

	const relativeTime = subMediaTime({ a: splitTime, b: element.startTime });
	const leftVisibleDuration = relativeTime;
	const rightVisibleDuration = subMediaTime({ a: element.duration, b: relativeTime });
	const retimeRef = isRetimableElement(element) ? element.retime : undefined;
	// Snap the source-side split point exactly once and derive the right
	// half from it. Independently rounding both spans (left and total)
	// would let a 1-tick rounding error desynchronise them, breaking the
	// invariant `leftSourceSpan + rightSourceSpan == totalSourceSpan`.
	// See the same discipline in `compute-resize.ts` (snap-once comment).
	// Con curva de velocidad, la fuente hasta el corte depende de dónde
	// cae en la curva: hace falta la duración del clip (retime/resolve.ts).
	const leftSourceSpan = roundMediaTime({
		time: getSourceSpanAtClipTime({
			clipTime: leftVisibleDuration,
			retime: retimeRef,
			clipDuration: element.duration,
		}),
	});
	const totalSourceSpan = roundMediaTime({
		time: getSourceSpanAtClipTime({
			clipTime: element.duration,
			retime: retimeRef,
			clipDuration: element.duration,
		}),
	});
	// Cada mitad se lleva su tramo de la curva (con velocidad constante, la misma).
	const { left: leftRetime, right: rightRetime } = splitRetimeAtClipTime({
		retime: retimeRef,
		splitClipTime: relativeTime,
		clipDuration: element.duration,
	});
	const rightSourceSpan = subMediaTime({ a: totalSourceSpan, b: leftSourceSpan });
	const { leftAnimations, rightAnimations } = splitAnimationsAtTime({
		animations: element.animations,
		splitTime: relativeTime,
		shouldIncludeSplitBoundary: true,
	});
	const leftTrimEnd = addMediaTime({ a: element.trimEnd, b: rightSourceSpan });
	const rightTrimStart = addMediaTime({ a: element.trimStart, b: leftSourceSpan });

	// Las dos mitades conservan el nombre, como en CapCut (OpenCut le sumaba
	// «(left)»/«(right)», que se leía en inglés sobre el clip de un efecto).
	if (retainSide === "left") {
		return {
			izquierda: {
				...element,
				duration: leftVisibleDuration,
				trimEnd: leftTrimEnd,
				animations: leftAnimations,
				...(leftRetime !== undefined ? { retime: leftRetime } : {}),
			} as TimelineElement,
			derecha: null,
		};
	}
	if (retainSide === "right") {
		return {
			izquierda: null,
			derecha: {
				...element,
				id: nuevoId(),
				startTime: splitTime,
				duration: rightVisibleDuration,
				trimStart: rightTrimStart,
				animations: rightAnimations,
				...(rightRetime !== undefined ? { retime: rightRetime } : {}),
			} as TimelineElement,
		};
	}
	// Con las dos mitades, la transición (`transicion.*`) es del borde derecho
	// ORIGINAL, que queda en la mitad derecha: la izquierda no la lleva, o
	// aparecería en el corte nuevo (transiciones/reglas.ts). Con «Borrar a la
	// derecha» la mitad que queda la conserva, como al recortar el final.
	// Y la animación: la Entrada queda en la izquierda y la Salida en la
	// derecha (animaciones/reglas.ts). Los fundidos de audio, igual (audio/claves.ts).
	return {
		izquierda: {
			...element,
			params: sinFundidoSalida(sinSalida(sinTransicion(element.params))),
			duration: leftVisibleDuration,
			trimEnd: leftTrimEnd,
			animations: leftAnimations,
			...(leftRetime !== undefined ? { retime: leftRetime } : {}),
		} as TimelineElement,
		derecha: {
			...element,
			id: nuevoId(),
			params: sinFundidoEntrada(sinEntrada(element.params)),
			startTime: splitTime,
			duration: rightVisibleDuration,
			trimStart: rightTrimStart,
			animations: rightAnimations,
			...(rightRetime !== undefined ? { retime: rightRetime } : {}),
		} as TimelineElement,
	};
}
