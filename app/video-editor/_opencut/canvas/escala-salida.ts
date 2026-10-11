// =============================================================================
// Resolución de reproducción («Completa», «1/2», «1/4») — sólo el reproductor
// =============================================================================
// CapCut baja la resolución del REPRODUCTOR para que la reproducción sea fluida
// sin tocar la del video exportado. Acá el render del motor arma un
// FrameDescriptor en los píxeles del lienzo del proyecto (posiciones, tamaños,
// todo absoluto), y el compositor de WASM lo dibuja tal cual. Bajar la
// resolución es escalar ESE descriptor justo antes de dibujarlo: el lienzo de
// salida, el centro y el tamaño de cada capa. Las texturas quedan como están (el
// compositor las muestrea con UV normalizadas, así que una textura de 1920 en
// un cuadro de 960 se dibuja bien), y lo que se ahorra es el relleno y los
// pases de efectos, que corren a la resolución de salida.
//
// ⚠️ Los pases que miden en PÍXELES DE SALIDA hay que escalarlos también: el
// desenfoque gaussiano del WASM calcula `u_sigma` contra el ancho del lienzo
// (effects/definitions/blur.ts → intensityToSigma), y a 1/2 sin corregir se ve
// el doble de borroso. Las máscaras NO: su textura es del tamaño del lienzo y el
// pase de máscara la muestrea con UV normalizadas (verificado en el WGSL de
// opencut-wasm 0.2.10, `compositor-mask-shader`), y el calado (JFA) corre sobre
// esa textura. Los pases `ce-*` tampoco: corren sobre la FUENTE antes de subirla
// (ganchos-ce.ts → preaplicarPasesCe), a la resolución de la fuente.
//
// Lo usa services/renderer/canvas-renderer.ts con su `escalaSalida`; el export
// arma su propio CanvasRenderer y queda siempre en 1.

import type { EffectPass } from "@/app/video-editor/_opencut/effects/types";
import type { FrameDescriptor } from "@/app/video-editor/_opencut/services/renderer/compositor/types";
import { GAUSSIAN_BLUR_SHADER } from "@/app/video-editor/_opencut/effects/definitions/blur";

/** Las escalas que ofrece el botón de resolución del reproductor. */
export const ESCALAS_SALIDA = [1, 0.5, 0.25] as const;
export type EscalaSalida = (typeof ESCALAS_SALIDA)[number];

function escalarPases(grupos: EffectPass[][], k: number): EffectPass[][] {
	return grupos.map((grupo) =>
		grupo.map((pase) => {
			if (pase.shader !== GAUSSIAN_BLUR_SHADER) return pase;
			const sigma = pase.uniforms.u_sigma;
			const paso = pase.uniforms.u_step;
			return {
				...pase,
				uniforms: {
					...pase.uniforms,
					...(typeof sigma === "number" ? { u_sigma: sigma * k } : {}),
					// El paso es max(1, sigma/10): a escala menor nunca baja de 1.
					...(typeof paso === "number" ? { u_step: Math.max(1, paso * k) } : {}),
				},
			};
		}),
	);
}

/** El lado de salida, entero y al menos 2 px (el compositor no acepta 0). */
function lado(n: number): number {
	return Math.max(2, Math.round(n));
}

/** El descriptor de un cuadro, a `k` veces su resolución. `k = 1` lo devuelve igual. */
export function escalarFrame(frame: FrameDescriptor, k: number): FrameDescriptor {
	if (!(k > 0) || k === 1) return frame;
	const width = lado(frame.width * k);
	const height = lado(frame.height * k);
	// El factor real por eje (el redondeo del lado lo corre un poco).
	const kx = width / frame.width;
	const ky = height / frame.height;
	return {
		...frame,
		width,
		height,
		items: frame.items.map((item) => {
			if (item.type === "sceneEffect") {
				return { ...item, effectPassGroups: escalarPases(item.effectPassGroups, k) };
			}
			return {
				...item,
				transform: {
					...item.transform,
					centerX: item.transform.centerX * kx,
					centerY: item.transform.centerY * ky,
					width: item.transform.width * kx,
					height: item.transform.height * ky,
				},
				effectPassGroups: escalarPases(item.effectPassGroups, k),
			};
		}),
	};
}
