import { resolveGraphicParamsAtTime } from "@/app/video-editor/_opencut/animation";
import type { ElementAnimations } from "@/app/video-editor/_opencut/animation/types";
import { buildDefaultParamValues } from "@/app/video-editor/_opencut/params/registry";
import type { ParamValues } from "@/app/video-editor/_opencut/params";
import { graphicsRegistry } from "./registry";
import { tamanoDeFuente } from "./fuente-grafico";
import { definicionOAusente } from "./ausente";
import {
	registerDefaultGraphics,
	ellipseGraphicDefinition,
	polygonGraphicDefinition,
	rectangleGraphicDefinition,
	starGraphicDefinition,
} from "./definitions";
import {
	DEFAULT_GRAPHIC_SOURCE_SIZE,
	type GraphicInstance,
	type GraphicDefinition,
} from "./types";

const graphicPreviewUrlCache = new Map<string, string>();

const FALLBACK_CORNER_RADIUS_RATIO = 0.2;
const FALLBACK_FILL_OPACITY = 0.08;
const FALLBACK_MIN_FONT_SIZE = 12;
const FALLBACK_FONT_SIZE_RATIO = 0.15;

function buildFallbackPreviewUrl({
	name,
	size,
}: {
	name: string;
	size: number;
}): string {
	const svg = `
		<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
			<rect width="${size}" height="${size}" rx="${size * FALLBACK_CORNER_RADIUS_RATIO}" fill="white" fill-opacity="${FALLBACK_FILL_OPACITY}" />
			<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="${Math.max(FALLBACK_MIN_FONT_SIZE, size * FALLBACK_FONT_SIZE_RATIO)}" font-family="sans-serif">${name}</text>
		</svg>
	`;
	return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function getGraphicDefinition({
	definitionId,
}: {
	definitionId: string;
}): GraphicDefinition {
	registerDefaultGraphics();
	// Una definición que ya no existe no tira: es un gráfico vacío (graphics/ausente.ts).
	return definicionOAusente(graphicsRegistry, definitionId);
}

export function buildDefaultGraphicInstance({
	definitionId,
}: {
	definitionId: string;
}): GraphicInstance {
	const definition = getGraphicDefinition({ definitionId });
	return {
		definitionId,
		params: buildDefaultParamValues(definition.params),
	};
}

export function resolveGraphicParams({
	definition,
	params,
}: {
	definition: GraphicDefinition;
	params?: ParamValues;
}): ParamValues {
	return {
		...buildDefaultParamValues(definition.params),
		...(params ?? {}),
	};
}

export function resolveGraphicElementParamsAtTime({
	element,
	localTime,
}: {
	element: {
		definitionId: string;
		params: ParamValues;
		animations?: ElementAnimations;
	};
	localTime: number;
}): ParamValues {
	const definition = getGraphicDefinition({
		definitionId: element.definitionId,
	});
	return resolveGraphicParamsAtTime({
		params: resolveGraphicParams({
			definition,
			params: element.params,
		}),
		definitions: definition.params,
		animations: element.animations,
		localTime,
	});
}

/**
 * El tamaño del lienzo del que sale la textura de un gráfico: el cuadrado de 512 de una forma, o el cuadro entero si es
 * ANIMADO (un motion graphic, lib/motion): ocupa todo el video y se dibuja a su resolución, nítido al exportar. Lo
 * preguntan el nodo, el descriptor del cuadro, la resolución y los bordes de la selección: los cuatro tienen que decir
 * lo mismo o la caja de selección no coincide con lo que se ve.
 */
export function tamanoFuenteGrafico({
	definitionId,
	lienzo,
}: {
	definitionId: string;
	lienzo: { width: number; height: number };
}): { width: number; height: number } {
	registerDefaultGraphics();
	const animado = graphicsRegistry.has(definitionId) && !!graphicsRegistry.get(definitionId).animado;
	return tamanoDeFuente({ animado, lienzo });
}

export function buildGraphicPreviewUrl({
	definitionId,
	params,
	size = DEFAULT_GRAPHIC_SOURCE_SIZE,
}: {
	definitionId: string;
	params?: ParamValues;
	size?: number;
}): string {
	const definition = getGraphicDefinition({ definitionId });
	const resolvedParams = resolveGraphicParams({ definition, params });
	const cacheKey = JSON.stringify({ definitionId, resolvedParams, size });
	const cachedUrl = graphicPreviewUrlCache.get(cacheKey);
	if (cachedUrl) {
		return cachedUrl;
	}

	if (typeof document === "undefined") {
		return buildFallbackPreviewUrl({ name: definition.name, size });
	}

	const canvas = document.createElement("canvas");
	canvas.width = size;
	canvas.height = size;
	const ctx = canvas.getContext("2d");
	if (!ctx) {
		return buildFallbackPreviewUrl({ name: definition.name, size });
	}

	definition.render({
		ctx,
		params: resolvedParams,
		width: size,
		height: size,
	});

	const previewUrl = canvas.toDataURL("image/png");
	graphicPreviewUrlCache.set(cacheKey, previewUrl);
	return previewUrl;
}

export {
	DEFAULT_GRAPHIC_SOURCE_SIZE,
	ellipseGraphicDefinition,
	graphicsRegistry,
	polygonGraphicDefinition,
	rectangleGraphicDefinition,
	registerDefaultGraphics,
	starGraphicDefinition,
};
export type {
	GraphicDefinition,
	GraphicInstance,
	GraphicRenderContext,
} from "./types";
