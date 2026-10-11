import type { RetimeConfig } from "@/app/video-editor/_opencut/timeline";
import { clampRetimeRate } from "@/app/video-editor/_opencut/retime/rate";
import { mediaCurva, normalizarPuntos, type PuntoCurva } from "./curva";

export function buildConstantRetime({
	rate,
	maintainPitch = false,
}: {
	rate: number;
	maintainPitch?: boolean;
}): RetimeConfig {
	return { rate: clampRetimeRate({ rate }), maintainPitch };
}

/**
 * Un retime con curva. `rate` queda en la velocidad media (ver timeline/types).
 * El tono no se conserva con curva: SoundTouch estira con un tempo fijo, y la
 * curva lo cambia muestra a muestra (el audio sigue a la velocidad, como cinta).
 */
export function buildCurveRetime({
	preset,
	puntos,
}: {
	preset: string;
	puntos: readonly PuntoCurva[];
}): RetimeConfig {
	const curva = { preset, puntos: normalizarPuntos(puntos) };
	return {
		rate: clampRetimeRate({ rate: mediaCurva(curva) }),
		maintainPitch: false,
		mode: "curve",
		curva,
	};
}
