import {
	applyMaskFeather as applyMaskFeatherWasm,
	initializeGpu,
} from "@/app/video-editor/_opencut/wasm/opencut";
import { aplicarPasesCe, esPaseCe } from "./pases-ce";
import type { EffectPass } from "@/app/video-editor/_opencut/effects/types";
import { GAUSSIAN_BLUR_SHADER } from "@/app/video-editor/_opencut/effects/definitions/blur";

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
		// pases-ce.ts; el desenfoque, a un canvas 2D (ver `desenfocar2d`).
		let actual = source;
		let i = 0;
		while (i < passes.length) {
			const ce = esPaseCe(passes[i].shader);
			let j = i;
			while (j < passes.length && esPaseCe(passes[j].shader) === ce) j++;
			const tramo = passes.slice(i, j);
			actual = ce
				? aplicarPasesCe({ source: actual, width, height, passes: tramo })
				: desenfocar2d({ source: actual, width, height, passes: tramo });
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

		// ⚠️ Hoy no lo llama nadie (el calado lo hace el compositor). Si se usa,
		// probablemente pasa lo mismo que con `applyEffectPasses` (ver
		// `desenfocar2d`): el WASM dibuja en el canvas del reproductor.
		return applyMaskFeatherWasm({
			mask: maskCanvas,
			width,
			height,
			feather,
		});
	},
};

// Lo que NO es `ce-*` (el desenfoque de OpenCut) NO va al `applyEffectPasses`
// del WASM: ese WASM dibuja en SU canvas, que es el mismo que el compositor
// monta en el reproductor, y lo achica al tamaño de lo que procesa. Pasó
// (11/10/2026): abrir Biblioteca › Efectos dibujaba la miniatura del
// «Desenfoque» (160×160) y el reproductor quedaba mostrando esa miniatura, y el
// próximo cuadro salía en un canvas de 160×160 (la esquina de arriba a la
// izquierda estirada: con las barras de prueba, «todo rojo»). Lo único que pasa
// por acá son las miniaturas de la biblioteca (effect-preview.ts), así que
// alcanza con el filtro de desenfoque del canvas 2D, de la misma intensidad.
function desenfocar2d({
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
	// Varias pasadas gaussianas seguidas suman en cuadrado: σ = √(Σσᵢ²) por eje.
	let x2 = 0;
	let y2 = 0;
	for (const pase of passes) {
		if (pase.shader !== GAUSSIAN_BLUR_SHADER) continue;
		const sigma = typeof pase.uniforms.u_sigma === "number" ? pase.uniforms.u_sigma : 0;
		const dir = pase.uniforms.u_direction;
		if (Array.isArray(dir) && dir[1] > dir[0]) y2 += sigma * sigma;
		else x2 += sigma * sigma;
	}
	const sigma = (Math.sqrt(x2) + Math.sqrt(y2)) / 2;
	if (!(sigma > 0.01)) return source;
	const salida = new OffscreenCanvas(width, height);
	const ctx = salida.getContext("2d");
	if (!ctx) return source;
	ctx.filter = `blur(${sigma}px)`;
	ctx.drawImage(source, 0, 0, width, height);
	return salida;
}
