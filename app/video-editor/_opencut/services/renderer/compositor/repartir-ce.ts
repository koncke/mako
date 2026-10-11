// =============================================================================
// Un efecto-CAPA con pases `ce-*`: se reparte a las capas que tiene debajo
// =============================================================================
// En CapCut un Filtro, un Ajuste o un Efecto puesto en su propia pista afecta a
// TODO lo que está debajo en ese instante. El motor de OpenCut lo modela como un
// `sceneEffect`: el compositor de WASM aplica sus pases al cuadro compuesto
// hasta ahí. Pero el WASM sólo conoce SU shader (el desenfoque): los `ce-*`
// corren en el WebGL2 de pases-ce.ts, que no ve el cuadro compuesto.
//
// Entonces, al armar el cuadro, los pases `ce-*` de la capa se aplican a cada
// capa que ya está en la lista (las de abajo), en el ESPACIO DEL LIENZO
// (effects/glsl.ts): cada pase recibe dónde cae esa capa en el cuadro (`u_capa`,
// `u_giro`, `u_lienzo`), así una viñeta o una sacudida quedan una sola vez sobre
// el cuadro y no una por capa. Lo que no es `ce-*` sigue como `sceneEffect`.
//
//   · textura «external» (un cuadro de video, una imagen, un sticker): se
//     procesa la fuente y se reemplaza. Si algún pase DESPLAZA (zoom, sacudida,
//     espejo, caleidoscopio…: `registrarPase({ desplaza: true })`), la capa se
//     dibuja antes en una textura del tamaño del lienzo con su posición, escala
//     y giro, y pasa a ocupar el cuadro entero: si no, lo que el pase mueve no
//     puede salir del recuadro de la capa (un clip con bandas que hace zoom no
//     crecería sobre las bandas, como sí pasa en CapCut);
//   · textura «rendered» (texto, color de fondo, fondo desenfocado, borde de
//     máscara): se envuelve el dibujo, y el hash de contenido suma los pases
//     (si no, el caché del compositor no la redibuja cuando el pase cambia).
//
// Medido el 11/10/2026 corriendo los shaders en GL de escritorio: con la capa
// en la mitad izquierda de un lienzo de 128×64, el Espejo sin pasar al lienzo
// dejaba la mitad derecha VACÍA (la capa no puede pintar fuera de su recuadro).
//
// ⚠️ La máscara de la capa queda donde estaba (no se deforma con una Sacudida),
// y un efecto de color sobre bordes semitransparentes no da exacto lo mismo que
// sobre el compuesto. Para lo que se usa (video a pantalla completa, overlays,
// texto) no se nota.

import type { EffectPass } from "@/app/video-editor/_opencut/effects/types";
import { aplicarPasesCe, esPaseCe, paseDesplaza } from "../pases-ce";
import type {
	FrameItemDescriptor,
	QuadTransformDescriptor,
	TextureCanvasDrawFn,
	TextureUploadDescriptor,
} from "./types";

export function separarPasesCe(pases: EffectPass[]): { ce: EffectPass[]; resto: EffectPass[] } {
	const ce: EffectPass[] = [];
	const resto: EffectPass[] = [];
	for (const pase of pases) (esPaseCe(pase.shader) ? ce : resto).push(pase);
	return { ce, resto };
}

/** Los uniforms del espacio de una capa puesta con `transform` en un lienzo de `lienzo`. */
function espacioDe(
	transform: QuadTransformDescriptor,
	lienzo: { width: number; height: number },
): Record<string, number[] | number> {
	return {
		// El compositor mide con y hacia abajo; los shaders, hacia arriba.
		u_capa: [
			transform.centerX,
			lienzo.height - transform.centerY,
			transform.width * (transform.flipX ? -1 : 1),
			transform.height * (transform.flipY ? -1 : 1),
		],
		// Positivo en el compositor = horario en pantalla = negativo con y arriba.
		u_giro: (-transform.rotationDegrees * Math.PI) / 180,
		u_lienzo: [lienzo.width, lienzo.height],
	};
}

function conEspacio(pases: EffectPass[], espacio: Record<string, number[] | number>): EffectPass[] {
	return pases.map((pase) => ({ ...pase, uniforms: { ...pase.uniforms, ...espacio } }));
}

function ocupaElLienzo(t: QuadTransformDescriptor, lienzo: { width: number; height: number }): boolean {
	return (
		Math.abs(t.centerX - lienzo.width / 2) < 0.5 &&
		Math.abs(t.centerY - lienzo.height / 2) < 0.5 &&
		Math.abs(t.width - lienzo.width) < 0.5 &&
		Math.abs(t.height - lienzo.height) < 0.5 &&
		t.rotationDegrees === 0 &&
		!t.flipX &&
		!t.flipY
	);
}

/** La capa dibujada donde la pondría el compositor, en una textura del tamaño del lienzo. */
function alLienzo(
	source: CanvasImageSource,
	t: QuadTransformDescriptor,
	lienzo: { width: number; height: number },
): OffscreenCanvas {
	const c = new OffscreenCanvas(lienzo.width, lienzo.height);
	const ctx = c.getContext("2d");
	if (!ctx) return c;
	ctx.translate(t.centerX, t.centerY);
	ctx.rotate((t.rotationDegrees * Math.PI) / 180);
	ctx.scale(t.flipX ? -1 : 1, t.flipY ? -1 : 1);
	ctx.drawImage(source, -t.width / 2, -t.height / 2, t.width, t.height);
	return c;
}

function transformLienzo(lienzo: { width: number; height: number }): QuadTransformDescriptor {
	return {
		centerX: lienzo.width / 2,
		centerY: lienzo.height / 2,
		width: lienzo.width,
		height: lienzo.height,
		rotationDegrees: 0,
		flipX: false,
		flipY: false,
	};
}

/** Un dibujo de textura con los pases aplicados encima. */
export function envolverDibujo({
	draw,
	width,
	height,
	pases,
}: {
	draw: TextureCanvasDrawFn;
	width: number;
	height: number;
	pases: EffectPass[];
}): TextureCanvasDrawFn {
	return (ctx) => {
		const lienzo = new OffscreenCanvas(width, height);
		const ctx2 = lienzo.getContext("2d");
		if (!ctx2) {
			draw(ctx);
			return;
		}
		draw(ctx2);
		const salida = aplicarPasesCe({ source: lienzo, width, height, passes: pases });
		ctx.drawImage(salida, 0, 0, width, height);
	};
}

/** Firma corta de unos pases, para el hash de contenido de una textura dibujada. */
export function firmaPases(pases: EffectPass[]): string {
	return JSON.stringify(pases.map((p) => [p.shader, p.uniforms]));
}

/**
 * Aplica los pases `ce-*` de un efecto-capa a todas las capas que ya están en
 * `items` (las de abajo). Modifica `textures` en el lugar.
 */
export function repartirPasesCe({
	pases,
	items,
	textures,
	lienzo,
}: {
	pases: EffectPass[];
	items: FrameItemDescriptor[];
	textures: Map<string, TextureUploadDescriptor>;
	lienzo: { width: number; height: number };
}): void {
	if (pases.length === 0) return;
	const desplaza = pases.some((p) => paseDesplaza(p.shader));
	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		if (item.type !== "layer") continue;
		const textura = textures.get(item.textureId);
		if (!textura) continue;
		if (textura.kind === "external") {
			if (desplaza && !ocupaElLienzo(item.transform, lienzo)) {
				// La capa pasa a ocupar el cuadro entero (ver la cabecera).
				const enLienzo = alLienzo(textura.source, item.transform, lienzo);
				const source = aplicarPasesCe({
					source: enLienzo,
					width: lienzo.width,
					height: lienzo.height,
					passes: conEspacio(pases, espacioDe(transformLienzo(lienzo), lienzo)),
				});
				textures.set(textura.id, { ...textura, source, width: lienzo.width, height: lienzo.height });
				items[i] = { ...item, transform: transformLienzo(lienzo) };
				continue;
			}
			const source = aplicarPasesCe({
				source: textura.source as OffscreenCanvas,
				width: textura.width,
				height: textura.height,
				passes: conEspacio(pases, espacioDe(item.transform, lienzo)),
			});
			textures.set(textura.id, { ...textura, source });
			continue;
		}
		const propios = conEspacio(pases, espacioDe(item.transform, lienzo));
		textures.set(textura.id, {
			...textura,
			contentHash: `${textura.contentHash}|ce:${firmaPases(propios)}`,
			draw: envolverDibujo({
				draw: textura.draw,
				width: textura.width,
				height: textura.height,
				pases: propios,
			}),
		});
	}
}
