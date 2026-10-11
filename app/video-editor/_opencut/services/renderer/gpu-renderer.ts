import {
	applyEffectPasses,
	applyMaskFeather as applyMaskFeatherWasm,
	initializeGpu,
} from "opencut-wasm";
import { aplicarPasesCe, esPaseCe } from "./pases-ce";
import type { EffectPass, EffectUniformValue } from "@/app/video-editor/_opencut/effects/types";

let gpuAvailable = false;
let initPromise: Promise<void> | null = null;

export function initializeGpuRenderer(): Promise<void> {
	if (!initPromise) {
		initPromise = initializeGpu()
			.then(() => {
				gpuAvailable = true;
			})
			.catch((error: unknown) => {
				gpuAvailable = false;
				const message = error instanceof Error ? error.message : String(error);
				console.warn(`GPU renderer unavailable: ${message}`);
			});
	}
	return initPromise;
}

export function isGpuAvailable(): boolean {
	return gpuAvailable;
}

export const gpuRenderer = {
	applyEffect({
		source,
		width,
		height,
		passes,
	}: {
		source: OffscreenCanvas;
		width: number;
		height: number;
		passes: EffectPass[];
	}): OffscreenCanvas {
		if (passes.length === 0) {
			return source;
		}
		// Tramos consecutivos del mismo motor: los `ce-*` van al WebGL2 de
		// pases-ce.ts, los demás al WASM (sólo si hay GPU para él).
		let actual = source;
		let i = 0;
		while (i < passes.length) {
			const ce = esPaseCe(passes[i].shader);
			let j = i;
			while (j < passes.length && esPaseCe(passes[j].shader) === ce) j++;
			const tramo = passes.slice(i, j);
			if (ce) {
				actual = aplicarPasesCe({ source: actual, width, height, passes: tramo });
			} else if (gpuAvailable) {
				actual = applyEffectPasses({
					source: actual,
					width,
					height,
					passes: serializeEffectPasses(tramo),
				});
			}
			i = j;
		}
		return actual;
	},

	applyMaskFeather({
		maskCanvas,
		width,
		height,
		feather,
	}: {
		maskCanvas: OffscreenCanvas;
		width: number;
		height: number;
		feather: number;
	}): OffscreenCanvas {
		if (!gpuAvailable) {
			return maskCanvas;
		}

		return applyMaskFeatherWasm({
			mask: maskCanvas,
			width,
			height,
			feather,
		});
	},
};

function serializeEffectPasses(passes: EffectPass[]) {
	return passes.map((pass) => ({
		shader: pass.shader,
		uniforms: Object.entries(pass.uniforms).map(([name, value]) => ({
			name,
			value: normalizeUniformValue(value),
		})),
	}));
}

function normalizeUniformValue(value: EffectUniformValue): number[] {
	return typeof value === "number" ? [value] : value;
}
