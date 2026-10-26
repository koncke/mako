import { createCanvasSurface } from "../canvas-utils";
import {
	getGraphicDefinition,
	registerDefaultGraphics,
	tamanoFuenteGrafico,
} from "@/app/video-editor/_opencut/graphics";
import type { ParamValues } from "@/app/video-editor/_opencut/params";
import {
	VisualNode,
	type ResolvedVisualNodeState,
	type VisualNodeParams,
} from "./visual-node";

export interface GraphicNodeParams extends VisualNodeParams {
	definitionId: string;
	params: ParamValues;
}

export interface ResolvedGraphicNodeState extends ResolvedVisualNodeState {
	resolvedParams: ParamValues;
}

export class GraphicNode extends VisualNode<
	GraphicNodeParams,
	ResolvedGraphicNodeState
> {
	private cachedKey: string | null = null;
	private cachedSource: OffscreenCanvas | null = null;
	/**
	 * Sube cada vez que se redibuja. El lienzo se REUSA (un motion graphic redibuja en cada cuadro: uno nuevo de 1920 × 1080
	 * por cuadro es basura para el recolector), y el compositor no re-sube una textura que es el mismo objeto con la misma
	 * versión (compositor/textura-vigente.ts): sin esto el reproductor se quedaba en el primer cuadro.
	 */
	versionFuente = 0;

	constructor(params: GraphicNodeParams) {
		super(params);
		registerDefaultGraphics();
	}

	/** Lo que la definición necesita listo antes de dibujar (las fuentes de un motion graphic), o null. */
	preparar(resolvedParams: ParamValues): Promise<void> | null {
		const definition = getGraphicDefinition({ definitionId: this.params.definitionId });
		return definition.preparar?.(resolvedParams) ?? null;
	}

	getSource({
		resolvedParams,
		tiempo,
		duracion,
		lienzo,
	}: {
		resolvedParams: ParamValues;
		/** Segundos desde el inicio del clip: sólo lo usa un gráfico animado (lib/motion). */
		tiempo?: number;
		duracion?: number;
		lienzo?: { width: number; height: number };
	}): OffscreenCanvas {
		const definition = getGraphicDefinition({
			definitionId: this.params.definitionId,
		});
		const { width, height } = tamanoFuenteGrafico({
			definitionId: this.params.definitionId,
			lienzo: lienzo ?? { width: 0, height: 0 },
		});
		// Un animado cambia en cada cuadro: el tiempo (redondeado al milisegundo) entra en la clave.
		const cacheKey = JSON.stringify({
			definitionId: this.params.definitionId,
			params: resolvedParams,
			width,
			height,
			...(definition.animado
				? { t: Math.round((tiempo ?? 0) * 1000), d: Math.round((duracion ?? 0) * 1000) }
				: {}),
		});
		if (this.cachedSource && this.cachedKey === cacheKey) {
			return this.cachedSource;
		}

		const { canvas, context } =
			this.cachedSource && this.cachedSource.width === width && this.cachedSource.height === height
				? { canvas: this.cachedSource, context: this.cachedSource.getContext("2d") as OffscreenCanvasRenderingContext2D }
				: createCanvasSurface({ width, height });

		definition.render({
			ctx: context,
			params: resolvedParams,
			width,
			height,
			...(definition.animado ? { tiempo: tiempo ?? 0, duracion } : {}),
		});

		this.cachedKey = cacheKey;
		this.cachedSource = canvas;
		this.versionFuente++;
		return canvas;
	}
}
