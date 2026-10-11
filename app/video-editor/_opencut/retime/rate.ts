export const DEFAULT_RETIME_RATE = 1;
// El rango de «Velocidad › Estándar» de CapCut: 0,1× a 100×. OpenCut traía
// 0,01×–5×; un proyecto viejo con 0,05× queda en 0,1× al abrirse.
export const MIN_RETIME_RATE = 0.1;
export const MAX_RETIME_RATE = 100;
/**
 * Hasta dónde se puede conservar el tono. SoundTouch estira bien en este rango;
 * más allá el audio es un chirrido igual y el procesado se vuelve lento, así que
 * por encima de 10× el tono cambia siempre (CapCut también lo traba).
 */
export const MIN_RATE_TONO = 0.1;
export const MAX_RATE_TONO = 10;

export function clampRetimeRate({ rate }: { rate: number }): number {
	if (!Number.isFinite(rate) || rate <= 0) {
		return DEFAULT_RETIME_RATE;
	}

	return Math.min(Math.max(rate, MIN_RETIME_RATE), MAX_RETIME_RATE);
}

export function canMaintainPitch({ rate }: { rate: number }): boolean {
	return Number.isFinite(rate) && rate >= MIN_RATE_TONO && rate <= MAX_RATE_TONO;
}

export function shouldMaintainPitch({
	rate,
	maintainPitch,
}: {
	rate: number;
	maintainPitch?: boolean;
}): boolean {
	return maintainPitch === true && canMaintainPitch({ rate });
}
