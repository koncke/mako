// =============================================================================
// El lienzo del que sale la textura de un `graphic`: de qué tamaño, cuándo se redibuja y cuándo se reusa
// =============================================================================
// Una forma (rectángulo, estrella…) se dibuja en un cuadrado de 512 y el motor la escala. Un gráfico ANIMADO (un motion
// graphic, graphics/definitions/motion.ts) ocupa el cuadro entero: se dibuja del tamaño del lienzo, nítido al exportar, y
// cambia en CADA cuadro.
//
// Vive aparte de graphics/index.ts y de services/renderer/nodes/graphic-node.ts para poder probarlo sin cargar el WASM
// del motor (los dos lo importan por la cadena de `animation`): tests/video-editor-motion.test.ts. Mismo molde que
// compositor/textura-vigente.ts.
// =============================================================================

import { DEFAULT_GRAPHIC_SOURCE_SIZE } from "./types";

type Lado = { width: number; height: number };

/**
 * El tamaño de la fuente. ⚠️ Lo preguntan CUATRO lugares —el nodo, el descriptor del cuadro, `resolve.ts` y los bordes de
 * la selección (preview/element-bounds.ts)— por `tamanoFuenteGrafico` (graphics/index.ts): si uno dice 512 y otro el
 * tamaño del lienzo, la caja de selección no coincide con lo que se ve.
 */
export function tamanoDeFuente({ animado, lienzo }: { animado: boolean; lienzo: Lado }): Lado {
	if (animado) return { width: Math.max(2, Math.round(lienzo.width)), height: Math.max(2, Math.round(lienzo.height)) };
	return { width: DEFAULT_GRAPHIC_SOURCE_SIZE, height: DEFAULT_GRAPHIC_SOURCE_SIZE };
}

/** La clave del dibujo: lo mismo con la misma clave no se redibuja. Un animado mete su tiempo (al milisegundo). */
export function claveDeFuente(p: {
	definitionId: string;
	params: unknown;
	width: number;
	height: number;
	animado: boolean;
	tiempo?: number;
	duracion?: number;
}): string {
	return JSON.stringify({
		definitionId: p.definitionId,
		params: p.params,
		width: p.width,
		height: p.height,
		...(p.animado ? { t: Math.round((p.tiempo ?? 0) * 1000), d: Math.round((p.duracion ?? 0) * 1000) } : {}),
	});
}

/**
 * ¿Se redibuja sobre el lienzo de antes? Sólo un ANIMADO, y sólo si mide lo mismo: redibuja en cada cuadro, y un lienzo
 * nuevo de 1920 × 1080 por cuadro es basura para el recolector. Como el compositor compara la textura por identidad Y
 * versión (compositor/textura-vigente.ts), el nodo sube `versionFuente` cada vez que redibuja.
 * Una forma sigue con un lienzo nuevo en cada cambio, como antes de los motion: no se le cambia el comportamiento a lo
 * que ya andaba (su `render` limpia, pero un estado del contexto que quedara puesto se arrastraría al siguiente dibujo).
 */
export function reusaLienzo({ animado, previo, width, height }: { animado: boolean; previo: Lado | null; width: number; height: number }): boolean {
	return animado && previo !== null && previo.width === width && previo.height === height;
}
