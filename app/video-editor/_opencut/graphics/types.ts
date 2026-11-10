import type { ParamDefinition, ParamValues } from "@/app/video-editor/_opencut/params";

export const DEFAULT_GRAPHIC_SOURCE_SIZE = 512;

export interface GraphicRenderContext {
	ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
	params: ParamValues;
	width: number;
	height: number;
	/** Segundos desde el inicio del clip (sólo los animados: los motion graphics). Sin él, el cuadro final. */
	tiempo?: number;
	/** Duración del clip en segundos (los animados salen antes de terminar). */
	duracion?: number;
}

export interface GraphicDefinition {
	id: string;
	name: string;
	keywords: string[];
	params: ParamDefinition[];
	render(context: GraphicRenderContext): void;
	/**
	 * Un gráfico ANIMADO (un motion graphic, lib/motion): se dibuja en cada cuadro con su tiempo y del tamaño del lienzo
	 * (no del cuadrado de 512 de una forma), así ocupa el cuadro entero y se ve nítido al exportar.
	 */
	animado?: boolean;
	/**
	 * Sólo un animado: el instante (en segundos) que dibuja el cuadro `tiempo`. Dos cuadros con el mismo instante son el
	 * mismo dibujo, y el nodo no redibuja (un motion graphic quieto en el medio del clip: graphic-node.ts).
	 */
	instanteDeDibujo?(c: { params: ParamValues; tiempo: number; duracion?: number; width: number; height: number }): number;
	/** Lo que hay que tener listo antes de dibujar (las fuentes). El reproductor y el export lo esperan. */
	preparar?(params: ParamValues): Promise<void> | null;
}

export interface GraphicInstance {
	definitionId: string;
	params: ParamValues;
}
