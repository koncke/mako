import type { EffectPass } from "@/app/video-editor/_opencut/effects/types";
import type { ElementAnimations } from "@/app/video-editor/_opencut/animation/types";
import type { ParamValues } from "@/app/video-editor/_opencut/params";
import { BaseNode } from "./base-node";

export type EffectLayerNodeParams = {
	effectType: string;
	effectParams: ParamValues;
	timeOffset: number;
	duration: number;
	/** Fotogramas clave de los parámetros (`params.<clave>`), como los del elemento. */
	animations?: ElementAnimations;
};

export type ResolvedEffectLayerNodeState = {
	passes: EffectPass[];
};

export class EffectLayerNode extends BaseNode<
	EffectLayerNodeParams,
	ResolvedEffectLayerNodeState
> {}
