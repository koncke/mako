import { BaseNode } from "./base-node";
import type { TextElement } from "@/app/video-editor/_opencut/timeline";
import type { EffectPass } from "@/app/video-editor/_opencut/effects/types";
import type { BlendMode, Transform } from "@/app/video-editor/_opencut/rendering";
// Trazo, sombra, opacidad del fondo y «Máquina de escribir» de CapCut (paquete de texto).
import { dibujarTextoCe } from "@/app/video-editor/_opencut/text/dibujar";
import type { MeasuredTextElement } from "@/app/video-editor/_opencut/text/measure-element";

export type TextNodeParams = TextElement & {
	transform: Transform;
	opacity: number;
	blendMode?: BlendMode;
	canvasCenter: { x: number; y: number };
	canvasHeight: number;
	textBaseline?: CanvasTextBaseline;
};

export interface ResolvedTextNodeState {
	transform: Transform;
	opacity: number;
	textColor: string;
	backgroundColor: string;
	effectPasses: EffectPass[][];
	measuredText: MeasuredTextElement;
}

export class TextNode extends BaseNode<TextNodeParams, ResolvedTextNodeState> {}

export function renderTextToContext({
	node,
	ctx,
}: {
	node: TextNode;
	ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
}): void {
	const resolved = node.resolved;
	if (!resolved) {
		return;
	}

	const x = resolved.transform.position.x + node.params.canvasCenter.x;
	const y = resolved.transform.position.y + node.params.canvasCenter.y;
	const baseline = node.params.textBaseline ?? "middle";

	ctx.save();
	ctx.translate(x, y);
	ctx.scale(resolved.transform.scaleX, resolved.transform.scaleY);
	if (resolved.transform.rotate) {
		ctx.rotate((resolved.transform.rotate * Math.PI) / 180);
	}

	dibujarTextoCe({
		ctx,
		medido: resolved.measuredText,
		textColor: resolved.textColor,
		backgroundColor: resolved.backgroundColor,
		textBaseline: baseline,
	});

	ctx.restore();
}
