import type { RetimeConfig } from "@/app/video-editor/_opencut/timeline";
import { getSourceTimeAtClipTime, curvaDeRetime } from "./resolve";
import { mediaCurva, partirCurva } from "./curva";

export function getSourceSpanAtClipTime({
	clipTime,
	retime,
	clipDuration,
}: {
	clipTime: number;
	retime?: RetimeConfig;
	/** Duración del clip en la unidad de `clipTime` (para la curva; ver resolve.ts). */
	clipDuration?: number;
}): number {
	return Math.max(0, getSourceTimeAtClipTime({ clipTime, retime, clipDuration }));
}

/**
 * El retime de cada mitad al dividir un clip. Con velocidad constante, el
 * mismo; con curva, cada mitad se lleva su tramo de la curva (re-normalizado) y
 * su propia velocidad media.
 */
export function splitRetimeAtClipTime({
	retime,
	splitClipTime,
	clipDuration,
}: {
	retime?: RetimeConfig;
	splitClipTime: number;
	clipDuration?: number;
}): {
	left: RetimeConfig | undefined;
	right: RetimeConfig | undefined;
} {
	const curva = curvaDeRetime(retime);
	if (!retime || !curva || clipDuration === undefined || clipDuration <= 0) {
		return { left: retime, right: retime };
	}
	const { izquierda, derecha } = partirCurva(curva, splitClipTime / clipDuration);
	return {
		left: { ...retime, curva: izquierda, rate: mediaCurva(izquierda) },
		right: { ...retime, curva: derecha, rate: mediaCurva(derecha) },
	};
}

export function adjustRetimeForTrimChange({
	retime,
}: {
	retime?: RetimeConfig;
	clipTrimTime: number;
	side: "start" | "end";
}): RetimeConfig | undefined {
	// Al recortar un clip con curva, la curva se estira sobre lo que queda (es
	// del 0–1 del clip): no hay nada que cambiar.
	return retime;
}
