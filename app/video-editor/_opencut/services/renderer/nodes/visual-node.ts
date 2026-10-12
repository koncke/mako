import { BaseNode } from "./base-node";
import type { ParamValues } from "@/app/video-editor/_opencut/params";
import type { Effect, EffectPass } from "@/app/video-editor/_opencut/effects/types";
import type { Mask } from "@/app/video-editor/_opencut/masks/types";
import type { BlendMode, Transform } from "@/app/video-editor/_opencut/rendering";
import type { RetimeConfig, VisualElement } from "@/app/video-editor/_opencut/timeline";
import type { VentanaCe } from "@/app/video-editor/_opencut/transiciones/escena";

export interface VisualNodeParams {
	duration: number;
	timeOffset: number;
	trimStart: number;
	trimEnd: number;
	retime?: RetimeConfig;
	transform: Transform;
	animations?: VisualElement["animations"];
	opacity: number;
	blendMode?: BlendMode;
	effects?: Effect[];
	masks?: Mask[];
	/** `element.params` del elemento de origen: lo leen los ganchos de ganchos-ce.ts. */
	paramsElemento?: ParamValues;
	elementoId?: string;
	/**
	 * Transiciones (transiciones/escena.ts): el clip se dibuja también `antes`
	 * ticks antes de empezar y `despues` ticks después de terminar, con el
	 * material recortado del medio o congelado en su primer/último cuadro.
	 */
	ventanaCe?: VentanaCe;
}

export interface ResolvedVisualNodeState {
	localTime: number;
	transform: Transform;
	opacity: number;
	effectPasses: EffectPass[][];
}

export interface ResolvedVisualSourceNodeState extends ResolvedVisualNodeState {
	source: CanvasImageSource;
	sourceWidth: number;
	sourceHeight: number;
	/**
	 * Qué cuadro tiene `source` (el `timestamp` del video decodificado). El
	 * decodificador reusa 3 canvas en rueda, así que el MISMO objeto trae otro
	 * cuadro después: sin esto el compositor, que cachea por identidad, no lo
	 * re-sube (compositor/wasm-compositor.ts).
	 */
	sourceVersion?: number;
}

export abstract class VisualNode<
	Params extends VisualNodeParams = VisualNodeParams,
	Resolved extends ResolvedVisualNodeState = ResolvedVisualNodeState,
> extends BaseNode<Params, Resolved> {}
