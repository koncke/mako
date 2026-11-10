import type { FrameRate } from "@/app/video-editor/_opencut/wasm/opencut";
import { BASE_TIMELINE_PIXELS_PER_SECOND } from "@/app/video-editor/_opencut/timeline/scale";
import { frameRateToFloat } from "@/app/video-editor/_opencut/fps/utils";

/**
 * frame intervals for labels - starts at 2 so there's always at least
 * one tick between labels even at max zoom.
 * pattern: 2, 3, 5, 10, 15 (matches CapCut)
 */
const LABEL_FRAME_INTERVALS = [2, 3, 5, 10, 15] as const;

/**
 * LOS RÓTULOS CAEN EN CADA SEGUNDO (10/11/2026). Medido en producción con dos clips de 24 fps
 * (el proyecto toma los fps del primero): la regla decía «00:00, 15f, 6f, 21f, 12f, 3f…», porque
 * 15 cuadros no dividen 24 y los rótulos se corrían del segundo, que no aparecía nunca. Con fps
 * que no admiten la serie de CapCut (24, 25, 50…), los rótulos van cada un DIVISOR de los fps
 * (a 24: 2, 3, 4, 6, 8, 12): el segundo siempre tiene el suyo. A 30 y 60 la serie no cambia.
 */
const DIVISORES_DE_RESPALDO = [2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30] as const;

/** Los intervalos de rótulo (en cuadros) que caen en cada segundo a estos fps. */
export function intervalosDeRotulo(fps: number): readonly number[] {
	const porSegundo = Math.round(fps);
	if (LABEL_FRAME_INTERVALS.every((n) => porSegundo % n === 0)) {
		return LABEL_FRAME_INTERVALS;
	}
	return DIVISORES_DE_RESPALDO.filter(
		(n) => n < porSegundo && porSegundo % n === 0,
	);
}

/**
 * frame intervals for ticks - can go down to 1 for max granularity.
 */
const TICK_FRAME_INTERVALS = [1, 2, 3, 5, 10, 15] as const;

/**
 * second intervals for when we're zoomed out past frame-level detail.
 */
const SECOND_MULTIPLIERS = [
	1, 2, 3, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600,
] as const;

/**
 * minimum pixel spacing between labels to keep them readable
 */
const MIN_LABEL_SPACING_PX = 120;

/**
 * minimum pixel spacing between ticks. much denser than labels.
 */
const MIN_TICK_SPACING_PX = 18;

export interface RulerConfig {
	/** time interval in seconds between each label */
	labelIntervalSeconds: number;
	/** time interval in seconds between each tick */
	tickIntervalSeconds: number;
}

/**
 * determines the optimal label and tick intervals based on zoom level and FPS.
 *
 * labels and ticks scale independently:
 * - labels need wide spacing (~50px) to stay readable
 * - ticks can be denser (~8px) to show finer subdivisions
 *
 * example at different zoom levels:
 * - very zoomed in: labels every 2f, ticks every 1f
 * - zoomed in: labels every 10f, ticks every 1f
 * - zoomed out: labels every 15f, ticks every 3f
 * - very zoomed out: labels every 1s, ticks every 5f
 */
export function getRulerConfig({
	zoomLevel,
	fps,
}: {
	zoomLevel: number;
	fps: FrameRate;
}): RulerConfig {
	const fpsFloat = frameRateToFloat(fps);
	const pixelsPerSecond = BASE_TIMELINE_PIXELS_PER_SECOND * zoomLevel;
	const pixelsPerFrame = pixelsPerSecond / fpsFloat;

	const labelIntervalSeconds = findOptimalInterval({
		pixelsPerFrame,
		pixelsPerSecond,
		fps: fpsFloat,
		minSpacingPx: MIN_LABEL_SPACING_PX,
		frameIntervals: intervalosDeRotulo(fpsFloat),
	});

	const rawTickIntervalSeconds = findOptimalInterval({
		pixelsPerFrame,
		pixelsPerSecond,
		fps: fpsFloat,
		minSpacingPx: MIN_TICK_SPACING_PX,
		frameIntervals: TICK_FRAME_INTERVALS,
	});

	// ensure tick interval divides evenly into label interval so labels always land on ticks
	const tickIntervalSeconds = ensureTickDividesLabel({
		tickIntervalSeconds: rawTickIntervalSeconds,
		labelIntervalSeconds,
		pixelsPerFrame,
		pixelsPerSecond,
		fps: fpsFloat,
	});

	return { labelIntervalSeconds, tickIntervalSeconds };
}

/**
 * adjusts tick interval to ensure it divides evenly into the label interval.
 * this guarantees labels always land on tick positions.
 */
function ensureTickDividesLabel({
	tickIntervalSeconds,
	labelIntervalSeconds,
	pixelsPerFrame,
	pixelsPerSecond,
	fps,
}: {
	tickIntervalSeconds: number;
	labelIntervalSeconds: number;
	pixelsPerFrame: number;
	pixelsPerSecond: number;
	fps: number;
}): number {
	const labelFrames = Math.round(labelIntervalSeconds * fps);
	const tickFrames = Math.round(tickIntervalSeconds * fps);

	// if tick already divides label evenly, we're good
	if (labelFrames % tickFrames === 0) {
		return tickIntervalSeconds;
	}

	// find the smallest tick interval that divides the label interval and has adequate spacing
	for (const candidateFrames of TICK_FRAME_INTERVALS) {
		if (labelFrames % candidateFrames === 0) {
			const candidateSpacing = pixelsPerFrame * candidateFrames;
			// accept if spacing meets minimum threshold
			if (candidateSpacing >= MIN_TICK_SPACING_PX) {
				return candidateFrames / fps;
			}
		}
	}

	// try second-level tick intervals that divide the label interval cleanly
	for (const candidateSeconds of SECOND_MULTIPLIERS) {
		const ratio = labelIntervalSeconds / candidateSeconds;
		const isDivisor = Math.abs(ratio - Math.round(ratio)) < 0.0001;
		if (isDivisor) {
			const candidateSpacing = pixelsPerSecond * candidateSeconds;
			if (candidateSpacing >= MIN_TICK_SPACING_PX) {
				return candidateSeconds;
			}
		}
	}

	// fallback: use the label interval itself (no intermediate ticks)
	return labelIntervalSeconds;
}

function findOptimalInterval({
	pixelsPerFrame,
	pixelsPerSecond,
	fps,
	minSpacingPx,
	frameIntervals,
}: {
	pixelsPerFrame: number;
	pixelsPerSecond: number;
	fps: number;
	minSpacingPx: number;
	frameIntervals: readonly number[];
}): number {
	// try frame-level intervals first
	for (const frameInterval of frameIntervals) {
		const pixelSpacing = pixelsPerFrame * frameInterval;
		if (pixelSpacing >= minSpacingPx) {
			return frameInterval / fps;
		}
	}

	// then try second-level intervals
	for (const secondMultiplier of SECOND_MULTIPLIERS) {
		const pixelSpacing = pixelsPerSecond * secondMultiplier;
		if (pixelSpacing >= minSpacingPx) {
			return secondMultiplier;
		}
	}

	return 60;
}

/**
 * checks if a time should have a label based on the label interval.
 */
export function shouldShowLabel({
	time,
	labelIntervalSeconds,
}: {
	time: number;
	labelIntervalSeconds: number;
}): boolean {
	const epsilon = 0.0001;
	const remainder = time % labelIntervalSeconds;
	return remainder < epsilon || remainder > labelIntervalSeconds - epsilon;
}

/**
 * formats a ruler tick label.
 *
 * - on second boundaries: "MM:SS" (e.g., "00:00", "01:30")
 * - between seconds: "Xf" (e.g., "5f", "15f")
 */
export function formatRulerLabel({
	timeInSeconds,
	fps,
}: {
	timeInSeconds: number;
	fps: FrameRate;
}): string {
	// Por NÚMERO DE CUADRO, como el código de tiempo (10/11/2026): a 23,976 fps el cuadro 24 cae
	// en 1,001 s, y con la cuenta en segundos ese rótulo decía «0f» en vez de «00:01».
	const fpsFloat = frameRateToFloat(fps);
	const porSegundo = Math.round(fpsFloat);
	const cuadro = Math.round(timeInSeconds * fpsFloat);
	const enElSegundo = cuadro % porSegundo;
	if (enElSegundo === 0) {
		return formatTimestamp({ timeInSeconds: cuadro / porSegundo });
	}
	return `${enElSegundo}f`;
}

/**
 * formats a timestamp as MM:SS or H:MM:SS when >= 1 hour.
 */
function formatTimestamp({ timeInSeconds }: { timeInSeconds: number }): string {
	const totalSeconds = Math.round(timeInSeconds);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	const mm = minutes.toString().padStart(2, "0");
	const ss = seconds.toString().padStart(2, "0");

	if (hours > 0) {
		return `${hours}:${mm}:${ss}`;
	}

	return `${mm}:${ss}`;
}
