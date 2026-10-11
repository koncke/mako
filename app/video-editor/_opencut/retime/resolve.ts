// =============================================================================
// Tiempo del clip ↔ tiempo de la fuente, con velocidad constante o con curva
// =============================================================================
// Las funciones no saben en qué unidad trabajan (el render pasa ticks, el audio
// segundos): con velocidad constante da igual, porque es una proporción. Con
// CURVA no: la curva está en el 0–1 del clip, y para pasar de un instante a la
// fuente hace falta saber cuánto dura el clip EN LA MISMA UNIDAD que `clipTime`.
// Por eso `clipDuration` es opcional: quien lo pasa obtiene la curva exacta;
// quien no, la velocidad media (exacta en los extremos del clip, que es lo que
// usan las cuentas de duración y de recorte). Ver retime/curva.ts.

import type { RetimeConfig } from "@/app/video-editor/_opencut/timeline";
import { clampRetimeRate } from "@/app/video-editor/_opencut/retime/rate";
import {
	integralCurva,
	inversaIntegralCurva,
	mediaCurva,
	velocidadEnCurva,
	type CurvaVelocidad,
} from "./curva";

/** La curva del retime, si la tiene y es usable. */
export function curvaDeRetime(retime?: RetimeConfig): CurvaVelocidad | null {
	if (!retime || retime.mode !== "curve" || !retime.curva) return null;
	return retime.curva.puntos.length >= 2 ? retime.curva : null;
}

/** La velocidad media: la de «Estándar», o la media de la curva. */
export function velocidadMediaDe(retime?: RetimeConfig): number {
	const curva = curvaDeRetime(retime);
	if (curva) return clampRetimeRate({ rate: mediaCurva(curva) });
	return clampRetimeRate({ rate: retime?.rate ?? 1 });
}

export function getSourceTimeAtClipTime({
	clipTime,
	retime,
	clipDuration,
}: {
	clipTime: number;
	retime?: RetimeConfig;
	/** Duración del clip en la unidad de `clipTime` (hace falta para la curva). */
	clipDuration?: number;
}): number {
	const curva = curvaDeRetime(retime);
	if (curva && clipDuration !== undefined && clipDuration > 0) {
		if (clipTime <= 0) return clipTime * velocidadEnCurva(curva, 0);
		if (clipTime >= clipDuration) {
			return (
				clipDuration * mediaCurva(curva) +
				(clipTime - clipDuration) * velocidadEnCurva(curva, 1)
			);
		}
		return clipDuration * integralCurva(curva, clipTime / clipDuration);
	}
	return clipTime * velocidadMediaDe(retime);
}

export function getClipTimeAtSourceTime({
	sourceTime,
	retime,
	clipDuration,
}: {
	sourceTime: number;
	retime?: RetimeConfig;
	clipDuration?: number;
}): number {
	const curva = curvaDeRetime(retime);
	if (curva && clipDuration !== undefined && clipDuration > 0) {
		if (sourceTime <= 0) return sourceTime / velocidadEnCurva(curva, 0);
		const total = clipDuration * mediaCurva(curva);
		if (sourceTime >= total) {
			return clipDuration + (sourceTime - total) / velocidadEnCurva(curva, 1);
		}
		return clipDuration * inversaIntegralCurva(curva, sourceTime / clipDuration);
	}
	return sourceTime / velocidadMediaDe(retime);
}

export function getEffectiveRateAt({
	clipTime,
	retime,
	clipDuration,
}: {
	clipTime?: number;
	retime?: RetimeConfig;
	clipDuration?: number;
}): number {
	const curva = curvaDeRetime(retime);
	if (curva && clipTime !== undefined && clipDuration !== undefined && clipDuration > 0) {
		return velocidadEnCurva(curva, clipTime / clipDuration);
	}
	return velocidadMediaDe(retime);
}

export function getTimelineDurationForSourceSpan({
	sourceSpan,
	retime,
}: {
	sourceSpan: number;
	retime?: RetimeConfig;
}): number {
	if (sourceSpan <= 0) {
		return 0;
	}
	// Con curva también es una división: la fuente que recorre el clip entero
	// es duración × velocidad media, en cualquier unidad.
	return sourceSpan / velocidadMediaDe(retime);
}
