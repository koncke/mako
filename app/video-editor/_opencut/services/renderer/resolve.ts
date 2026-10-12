import { mediaTimeToSeconds, roundMediaTime } from "@/app/video-editor/_opencut/wasm";
import { getElementLocalTime } from "@/app/video-editor/_opencut/animation";
import { aplicarGanchosVisual } from "./ganchos-ce";
import { acotarFuente, fueraDeVentana } from "@/app/video-editor/_opencut/transiciones/escena";
import { TICKS_PER_SECOND } from "@/app/video-editor/_opencut/wasm";
import { resolveEffectParamsAtTime } from "@/app/video-editor/_opencut/animation/effect-param-channel";
import { resolveGraphicParamsAtTime } from "@/app/video-editor/_opencut/animation/graphic-param-channel";
import {
	buildGaussianBlurPasses,
	intensityToSigma,
} from "@/app/video-editor/_opencut/effects/definitions/blur";
import { effectsRegistry, resolveEffectPasses } from "@/app/video-editor/_opencut/effects";
import type { Effect, EffectPass } from "@/app/video-editor/_opencut/effects/types";
import { getSourceTimeAtClipTime } from "@/app/video-editor/_opencut/retime";
import {
	DEFAULT_GRAPHIC_SOURCE_SIZE,
	resolveGraphicElementParamsAtTime,
} from "@/app/video-editor/_opencut/graphics";
import {
	buildTextBackgroundFromElement,
	getTextMeasurementContext,
	measureTextElement,
} from "@/app/video-editor/_opencut/text/measure-element";
import { resolveColorAtTime, resolveOpacityAtTime } from "@/app/video-editor/_opencut/animation/values";
import { resolveTransformAtTime } from "@/app/video-editor/_opencut/rendering/animation-values";
import { videoCache } from "@/app/video-editor/_opencut/services/video-cache/service";
import type { CanvasRenderer } from "./canvas-renderer";
import type { AnyBaseNode } from "./nodes/base-node";
import {
	BlurBackgroundNode,
	type BackdropSource,
	type ResolvedBlurBackgroundNodeState,
} from "./nodes/blur-background-node";
import {
	EffectLayerNode,
	type ResolvedEffectLayerNodeState,
} from "./nodes/effect-layer-node";
import {
	GraphicNode,
	type ResolvedGraphicNodeState,
} from "./nodes/graphic-node";
import { ImageNode, loadImageSource } from "./nodes/image-node";
import { StickerNode, loadStickerSource } from "./nodes/sticker-node";
import { TextNode, type ResolvedTextNodeState } from "./nodes/text-node";
import { VideoNode } from "./nodes/video-node";
import type {
	ResolvedVisualNodeState,
	ResolvedVisualSourceNodeState,
	VisualNodeParams,
} from "./nodes/visual-node";

type ResolveContext = {
	renderer: CanvasRenderer;
	time: number;
};

export async function resolveRenderTree({
	node,
	renderer,
	time,
}: {
	node: AnyBaseNode;
	renderer: CanvasRenderer;
	time: number;
}): Promise<void> {
	await resolveNode({
		node,
		context: {
			renderer,
			time,
		},
	});
}

async function resolveNode({
	node,
	context,
}: {
	node: AnyBaseNode;
	context: ResolveContext;
}): Promise<void> {
	if (node instanceof VideoNode) {
		node.resolved = await resolveVideoNode({ node, context });
	} else if (node instanceof ImageNode) {
		node.resolved = await resolveImageNode({ node, context });
	} else if (node instanceof StickerNode) {
		node.resolved = await resolveStickerNode({ node, context });
	} else if (node instanceof GraphicNode) {
		node.resolved = resolveGraphicNode({ node, context });
	} else if (node instanceof TextNode) {
		node.resolved = resolveTextNode({ node, context });
	} else if (node instanceof BlurBackgroundNode) {
		node.resolved = await resolveBlurBackgroundNode({ node, context });
	} else if (node instanceof EffectLayerNode) {
		node.resolved = resolveEffectLayerNode({ node, context });
	}

	await Promise.all(
		node.children.map((child) => resolveNode({ node: child, context })),
	);
}

function resolveEffectPassGroups({
	effects,
	animations,
	localTime,
	width,
	height,
}: {
	effects: Effect[] | undefined;
	animations: VisualNodeParams["animations"];
	localTime: number;
	width: number;
	height: number;
}): EffectPass[][] {
	return (effects ?? [])
		.filter((effect) => effect.enabled)
		// Un efecto de un tipo que no está registrado (un proyecto de otra versión)
		// se salta: tirar acá deja el cuadro entero en negro.
		.filter((effect) => effectsRegistry.has(effect.type))
		// El Chroma key va primero, sobre el cuadro crudo: el color se eligió con el
		// cuentagotas sobre el original, no sobre el ajustado o filtrado.
		.sort(
			(a, b) =>
				Number(effectsRegistry.get(b.type).clase === "croma") -
				Number(effectsRegistry.get(a.type).clase === "croma"),
		)
		.map((effect) => {
			const resolvedParams = resolveEffectParamsAtTime({
				effectId: effect.id,
				params: effect.params,
				animations,
				localTime,
			});
			const definition = effectsRegistry.get(effect.type);
			return resolveEffectPasses({
				definition,
				// Los efectos que se mueven (Glitch, Sacudida, el grano…) leen el
				// tiempo local en segundos de `__tiempo` (effects/glsl.ts).
				effectParams: { ...resolvedParams, __tiempo: localTime / TICKS_PER_SECOND },
				width,
				height,
			});
		})
		.filter((passes) => passes.length > 0);
}

function resolveVisualState({
	params,
	context,
	sourceWidth,
	sourceHeight,
}: {
	params: VisualNodeParams;
	context: ResolveContext;
	sourceWidth: number;
	sourceHeight: number;
}): ResolvedVisualNodeState | null {
	const clipTime = context.time - params.timeOffset;
	// Con una transición el clip se ve también un poco antes o después de su
	// tramo (transiciones/escena.ts); sin ella, `fueraDeVentana` es el chequeo de siempre.
	if (fueraDeVentana(params, clipTime)) {
		return null;
	}

	const localTime = getElementLocalTime({
		timelineTime: context.time,
		elementStartTime: params.timeOffset,
		elementDuration: params.duration,
	});
	const conKeyframes = {
		transform: resolveTransformAtTime({
			baseTransform: params.transform,
			animations: params.animations,
			localTime,
		}),
		opacity: resolveOpacityAtTime({
			baseOpacity: params.opacity,
			animations: params.animations,
			localTime,
		}),
	};
	// Animaciones de entrada/salida, reflejo, transiciones: ver ganchos-ce.ts.
	const { transform, opacity, pases } = aplicarGanchosVisual(conKeyframes, {
		params: params.paramsElemento ?? {},
		elementoId: params.elementoId,
		localTime: localTime / TICKS_PER_SECOND,
		duration: params.duration / TICKS_PER_SECOND,
		tiempoClip: clipTime / TICKS_PER_SECOND,
		lienzo: { width: context.renderer.width, height: context.renderer.height },
	});
	const containScale = Math.min(
		context.renderer.width / sourceWidth,
		context.renderer.height / sourceHeight,
	);
	const effectWidth = Math.round(
		Math.abs(sourceWidth * containScale * transform.scaleX),
	);
	const effectHeight = Math.round(
		Math.abs(sourceHeight * containScale * transform.scaleY),
	);

	const pasesDelClip = resolveEffectPassGroups({
		effects: params.effects,
		animations: params.animations,
		localTime,
		width: effectWidth,
		height: effectHeight,
	});
	return {
		localTime,
		transform,
		opacity,
		// Los pases de los ganchos (una transición) van DESPUÉS de los del clip.
		effectPasses: pases && pases.length > 0 ? [...pasesDelClip, pases] : pasesDelClip,
	};
}

async function resolveVideoNode({
	node,
	context,
}: {
	node: VideoNode;
	context: ResolveContext;
}): Promise<ResolvedVisualSourceNodeState | null> {
	const clipTime = context.time - node.params.timeOffset;
	if (fueraDeVentana(node.params, clipTime)) {
		return null;
	}

	const fuenteEn = (t: number) =>
		node.params.trimStart +
		getSourceTimeAtClipTime({
			clipTime: t,
			retime: node.params.retime,
			// La curva de velocidad está en el 0–1 del clip (retime/resolve.ts).
			clipDuration: node.params.duration,
		});
	let sourceTimeTicks = fuenteEn(clipTime);
	if (clipTime < 0 || clipTime >= node.params.duration) {
		// Fuera del tramo (una transición): lo recortado del medio, y si no hay,
		// el primer o el último cuadro (transiciones/escena.ts).
		sourceTimeTicks = acotarFuente({
			tiempo: sourceTimeTicks,
			fin: fuenteEn(node.params.duration) + node.params.trimEnd,
			tps: TICKS_PER_SECOND,
		});
	}
	const frame = await videoCache.getFrameAt({
		mediaId: node.params.mediaId,
		file: node.params.file,
		time: mediaTimeToSeconds({ time: roundMediaTime({ time: sourceTimeTicks }) }),
	});
	if (!frame) {
		return null;
	}

	const visualState = resolveVisualState({
		params: node.params,
		context,
		sourceWidth: frame.canvas.width,
		sourceHeight: frame.canvas.height,
	});
	if (!visualState) {
		return null;
	}

	return {
		...visualState,
		source: frame.canvas,
		sourceWidth: frame.canvas.width,
		sourceHeight: frame.canvas.height,
		// El canvas es de una rueda de 3 que se reusa: el cuadro lo dice el timestamp.
		sourceVersion: frame.timestamp,
	};
}

async function resolveImageNode({
	node,
	context,
}: {
	node: ImageNode;
	context: ResolveContext;
}): Promise<ResolvedVisualSourceNodeState | null> {
	const source = await loadImageSource({
		url: node.params.url,
		maxSourceSize: node.params.maxSourceSize,
	});
	const visualState = resolveVisualState({
		params: node.params,
		context,
		sourceWidth: source.width,
		sourceHeight: source.height,
	});
	if (!visualState) {
		return null;
	}

	return {
		...visualState,
		source: source.source,
		sourceWidth: source.width,
		sourceHeight: source.height,
	};
}

async function resolveStickerNode({
	node,
	context,
}: {
	node: StickerNode;
	context: ResolveContext;
}): Promise<ResolvedVisualSourceNodeState | null> {
	const source = await loadStickerSource({ stickerId: node.params.stickerId });
	const sourceWidth = node.params.intrinsicWidth ?? source.width;
	const sourceHeight = node.params.intrinsicHeight ?? source.height;
	const visualState = resolveVisualState({
		params: node.params,
		context,
		sourceWidth,
		sourceHeight,
	});
	if (!visualState) {
		return null;
	}

	return {
		...visualState,
		source: source.source,
		sourceWidth,
		sourceHeight,
	};
}

function resolveGraphicNode({
	node,
	context,
}: {
	node: GraphicNode;
	context: ResolveContext;
}): ResolvedGraphicNodeState | null {
	const visualState = resolveVisualState({
		params: node.params,
		context,
		sourceWidth: DEFAULT_GRAPHIC_SOURCE_SIZE,
		sourceHeight: DEFAULT_GRAPHIC_SOURCE_SIZE,
	});
	if (!visualState) {
		return null;
	}

	return {
		...visualState,
		resolvedParams: resolveGraphicElementParamsAtTime({
			element: node.params,
			localTime: visualState.localTime,
		}),
	};
}

function resolveTextNode({
	node,
	context,
}: {
	node: TextNode;
	context: ResolveContext;
}): ResolvedTextNodeState | null {
	if (
		context.time < node.params.startTime ||
		context.time >= node.params.startTime + node.params.duration
	) {
		return null;
	}

	const localTime = getElementLocalTime({
		timelineTime: context.time,
		elementStartTime: node.params.startTime,
		elementDuration: node.params.duration,
	});
	const background = buildTextBackgroundFromElement({ element: node.params });

	// El texto también pasa por los ganchos visuales (animaciones de texto de CapCut).
	const visualTexto = aplicarGanchosVisual(
		{
			transform: resolveTransformAtTime({
				baseTransform: node.params.transform,
				animations: node.params.animations,
				localTime,
			}),
			opacity: resolveOpacityAtTime({
				baseOpacity: node.params.opacity,
				animations: node.params.animations,
				localTime,
			}),
		},
		{
			params: node.params.params ?? {},
			elementoId: node.params.id,
			localTime: localTime / TICKS_PER_SECOND,
			duration: node.params.duration / TICKS_PER_SECOND,
			lienzo: { width: context.renderer.width, height: context.renderer.height },
		},
	);

	return {
		transform: visualTexto.transform,
		opacity: visualTexto.opacity,
		textColor: resolveColorAtTime({
			baseColor:
				typeof node.params.params.color === "string"
					? node.params.params.color
					: "#ffffff",
			animations: node.params.animations,
			propertyPath: "color",
			localTime,
		}),
		backgroundColor: resolveColorAtTime({
			baseColor: background.color,
			animations: node.params.animations,
			propertyPath: "background.color",
			localTime,
		}),
		effectPasses: resolveEffectPassGroups({
			effects: node.params.effects,
			animations: node.params.animations,
			localTime,
			width: context.renderer.width,
			height: context.renderer.height,
		}),
		measuredText: measureTextElement({
			element: node.params,
			canvasHeight: node.params.canvasHeight,
			localTime,
			ctx: getTextMeasurementContext(),
		}),
	};
}

async function resolveBlurBackgroundNode({
	node,
	context,
}: {
	node: BlurBackgroundNode;
	context: ResolveContext;
}): Promise<ResolvedBlurBackgroundNodeState | null> {
	const clipTime = context.time - node.params.timeOffset;
	if (clipTime < 0 || clipTime >= node.params.duration) {
		return null;
	}

	const backdropSource = await resolveBackdropSource({ node, clipTime });
	if (!backdropSource) {
		return null;
	}

	return {
		backdropSource,
		passes: buildGaussianBlurPasses({
			sigmaX: intensityToSigma({
				intensity: node.params.blurIntensity,
				resolution: context.renderer.width,
				reference: 1920,
			}),
			sigmaY: intensityToSigma({
				intensity: node.params.blurIntensity,
				resolution: context.renderer.height,
				reference: 1080,
			}),
		}),
	};
}

async function resolveBackdropSource({
	node,
	clipTime,
}: {
	node: BlurBackgroundNode;
	clipTime: number;
}): Promise<BackdropSource | null> {
	if (node.params.mediaType === "video") {
		const sourceTimeTicks =
			node.params.trimStart +
			getSourceTimeAtClipTime({
				clipTime,
				retime: node.params.retime,
				clipDuration: node.params.duration,
			});
		const frame = await videoCache.getFrameAt({
			mediaId: node.params.mediaId,
			file: node.params.file,
			time: mediaTimeToSeconds({ time: roundMediaTime({ time: sourceTimeTicks }) }),
		});
		if (!frame) {
			return null;
		}

		return {
			source: frame.canvas,
			width: frame.canvas.width,
			height: frame.canvas.height,
			version: frame.timestamp,
		};
	}

	const source = await loadImageSource({ url: node.params.url });
	return {
		source: source.source,
		width: source.width,
		height: source.height,
	};
}

function resolveEffectLayerNode({
	node,
	context,
}: {
	node: EffectLayerNode;
	context: ResolveContext;
}): ResolvedEffectLayerNodeState | null {
	const time = context.time;
	if (
		time < node.params.timeOffset - 1e-6 ||
		time >= node.params.timeOffset + node.params.duration + 1e-6
	) {
		return null;
	}

	if (!effectsRegistry.has(node.params.effectType)) {
		return null;
	}
	const definition = effectsRegistry.get(node.params.effectType);
	// Los parámetros de un efecto-capa se animan en `params.<clave>` (como los de
	// una forma; ver timeline/animation-targets.ts), y los que se mueven leen el
	// tiempo desde el inicio de la capa en `__tiempo`.
	const localTime = Math.max(0, time - node.params.timeOffset);
	const effectParams = {
		...resolveGraphicParamsAtTime({
			params: node.params.effectParams,
			definitions: definition.params,
			animations: node.params.animations,
			localTime,
		}),
		__tiempo: localTime / TICKS_PER_SECOND,
	};
	const passes = resolveEffectPasses({
		definition,
		effectParams,
		width: context.renderer.width,
		height: context.renderer.height,
	});
	if (passes.length === 0) {
		return null;
	}

	return {
		passes,
	};
}
