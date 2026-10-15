import { CORNER_RADIUS_MIN } from "@/app/video-editor/_opencut/text/background";
import { DEFAULTS } from "@/app/video-editor/_opencut/timeline/defaults";
import type { TextElement } from "@/app/video-editor/_opencut/timeline";
import type { TextBackground } from "@/app/video-editor/_opencut/text/background";
import { resolveNumberAtTime } from "@/app/video-editor/_opencut/animation/values";
import { TICKS_PER_SECOND } from "@/app/video-editor/_opencut/wasm";
import {
	revelacionTexto,
	type RevelacionTexto,
} from "@/app/video-editor/_opencut/animaciones/calcular";
import {
	getTextVisualRect,
	setCanvasLetterSpacing,
	type TextCanvasContext,
} from "./layout";
import { letrasEnArco, recuadroArco, type LetraEnArco } from "./curva";
import { cuantizarRevelado } from "./revelado";
import { resaltadoDe, type ResaltadoTexto } from "./resaltado";
import {
	aplicarMayusculas,
	leerEstiloTexto,
	leerMayusculas,
	sobresaleTrazo,
	type EstiloTexto,
} from "./estilo";
import {
	measureTextLayout,
	type MeasuredTextLayout,
	type TextAlign,
	type TextDecoration,
	type TextFontStyle,
	type TextFontWeight,
	type TextLayoutParams,
} from "./primitives";

export interface ResolvedTextBackground extends TextBackground {
	paddingX: number;
	paddingY: number;
	offsetX: number;
	offsetY: number;
	cornerRadius: number;
}

export interface MeasuredTextElement extends MeasuredTextLayout {
	resolvedBackground: ResolvedTextBackground;
	visualRect: { left: number; top: number; width: number; height: number };
	/** Trazo, sombra y opacidad del fondo de CapCut (./estilo.ts). */
	estilo: EstiloTexto;
	/** «Máquina de escribir» / «Palabra por palabra» en este instante; `null` = entero. */
	revelado: RevelacionTexto | null;
	/** «Curva»: cada letra de cada renglón en su lugar del arco; `null` = recto (./curva.ts). */
	arco: LetraEnArco[][] | null;
	/**
	 * «Animaciones de subtítulos» (karaoke) en este instante; `null` = sin resaltado.
	 * Cuantizado: sólo cambia cuando cambia la palabra (./resaltado.ts).
	 */
	resaltado: ResaltadoTexto | null;
}

let textMeasurementContext:
	| CanvasRenderingContext2D
	| OffscreenCanvasRenderingContext2D
	| null = null;

export function getTextMeasurementContext():
	| CanvasRenderingContext2D
	| OffscreenCanvasRenderingContext2D {
	if (textMeasurementContext) {
		return textMeasurementContext;
	}

	if (typeof OffscreenCanvas !== "undefined") {
		const canvas = new OffscreenCanvas(1, 1);
		const context = canvas.getContext("2d");
		if (context) {
			textMeasurementContext = context;
			return context;
		}
	}

	if (typeof document !== "undefined") {
		const canvas = document.createElement("canvas");
		const context = canvas.getContext("2d");
		if (context) {
			textMeasurementContext = context;
			return context;
		}
	}

	throw new Error("Failed to create text measurement context");
}

export function measureTextElement({
	element,
	canvasHeight,
	localTime,
	ctx,
}: {
	element: TextElement;
	canvasHeight: number;
	localTime: number;
	ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
}): MeasuredTextElement {
	const base = buildTextLayoutParamsFromElement({ element });
	// «May./min.» se mide como se ve. No va en buildTextLayoutParamsFromElement:
	// el editor de texto sobre el reproductor (text-edit-overlay) edita ESE
	// contenido, y lo guardaría en mayúsculas.
	const text = {
		...base,
		content: aplicarMayusculas(base.content, leerMayusculas(element.params)),
	};
	const measuredLayout = measureTextLayout({
		text,
		canvasHeight,
		ctx,
	});

	const bg = buildTextBackgroundFromElement({ element });
	const resolvedBackground: ResolvedTextBackground = {
		...bg,
		paddingX: resolveNumberAtTime({
			baseValue: bg.paddingX ?? DEFAULTS.text.background.paddingX,
			animations: element.animations,
			propertyPath: "background.paddingX",
			localTime,
		}),
		paddingY: resolveNumberAtTime({
			baseValue: bg.paddingY ?? DEFAULTS.text.background.paddingY,
			animations: element.animations,
			propertyPath: "background.paddingY",
			localTime,
		}),
		offsetX: resolveNumberAtTime({
			baseValue: bg.offsetX ?? DEFAULTS.text.background.offsetX,
			animations: element.animations,
			propertyPath: "background.offsetX",
			localTime,
		}),
		offsetY: resolveNumberAtTime({
			baseValue: bg.offsetY ?? DEFAULTS.text.background.offsetY,
			animations: element.animations,
			propertyPath: "background.offsetY",
			localTime,
		}),
		cornerRadius: resolveNumberAtTime({
			baseValue: bg.cornerRadius ?? CORNER_RADIUS_MIN,
			animations: element.animations,
			propertyPath: "background.cornerRadius",
			localTime,
		}),
	};

	const conFondo = getTextVisualRect({
		textAlign: text.textAlign,
		block: measuredLayout.block,
		background: resolvedBackground,
		fontSizeRatio: measuredLayout.fontSizeRatio,
	});
	const estilo = leerEstiloTexto(element.params);
	const arco = estilo.curva ? medirArco(ctx, measuredLayout, estilo.curva.fuerza) : null;
	// Curvado, el recuadro es el de las letras en el arco (sin fondo: un texto
	// con fondo no se curva).
	const recuadro = (arco && recuadroArco(arco, measuredLayout.lineHeightPx)) || conFondo;
	// El recuadro de selección abarca el trazo de afuera (la sombra y el brillo
	// no: en CapCut tampoco agrandan el recuadro).
	const borde = sobresaleTrazo(estilo, measuredLayout.scaledFontSize);
	const visualRect =
		borde > 0
			? {
					left: recuadro.left - borde,
					top: recuadro.top - borde,
					width: recuadro.width + borde * 2,
					height: recuadro.height + borde * 2,
				}
			: recuadro;

	return {
		...measuredLayout,
		resolvedBackground,
		visualRect,
		estilo,
		revelado: cuantizarRevelado(
			measuredLayout.lines,
			revelacionTexto(element.params, localTime / TICKS_PER_SECOND, element.duration / TICKS_PER_SECOND),
		),
		arco,
		resaltado: resaltadoDe({
			params: element.params,
			tiempo: localTime / TICKS_PER_SECOND,
			recorteInicio: element.trimStart / TICKS_PER_SECOND,
		}),
	};
}

/**
 * Mide cada letra sola (sin el espaciado de canvas, que se suma aparte entre
 * letras) y las pone en el arco. Un ancho por letra distinta: un subtítulo
 * largo repite muchas.
 */
function medirArco(ctx: TextCanvasContext, layout: MeasuredTextLayout, fuerza: number): LetraEnArco[][] | null {
	ctx.save();
	ctx.font = layout.fontString;
	setCanvasLetterSpacing({ ctx, letterSpacingPx: 0 });
	const anchos = new Map<string, number>();
	const anchoLetra = (letra: string) => {
		let w = anchos.get(letra);
		if (w === undefined) {
			w = ctx.measureText(letra).width;
			anchos.set(letra, w);
		}
		return w;
	};
	try {
		return letrasEnArco({
			lineas: layout.lines,
			ys: layout.lines.map((_, i) => i * layout.lineHeightPx - layout.block.visualCenterOffset),
			alineacion: layout.textAlign,
			fuerza,
			espaciado: layout.letterSpacing,
			anchoLetra,
		});
	} finally {
		ctx.restore();
	}
}

export function buildTextLayoutParamsFromElement({
	element,
}: {
	element: TextElement;
}): TextLayoutParams {
	return {
		content: readStringParam({
			params: element.params,
			key: "content",
			fallback: "Texto predeterminado",
		}),
		fontSize: readNumberParam({
			params: element.params,
			key: "fontSize",
			fallback: 15,
		}),
		fontFamily: readStringParam({
			params: element.params,
			key: "fontFamily",
			fallback: "Arial",
		}),
		fontWeight: readFontWeight({
			value: element.params.fontWeight,
			fallback: "normal",
		}),
		fontStyle: readFontStyle({
			value: element.params.fontStyle,
			fallback: "normal",
		}),
		textAlign: readTextAlign({
			value: element.params.textAlign,
			fallback: "center",
		}),
		textDecoration: readTextDecoration({
			value: element.params.textDecoration,
			fallback: "none",
		}),
		letterSpacing: readNumberParam({
			params: element.params,
			key: "letterSpacing",
			fallback: DEFAULTS.text.letterSpacing,
		}),
		lineHeight: readNumberParam({
			params: element.params,
			key: "lineHeight",
			fallback: DEFAULTS.text.lineHeight,
		}),
	};
}

export function buildTextBackgroundFromElement({
	element,
}: {
	element: TextElement;
}): TextBackground {
	return {
		enabled: readBooleanParam({
			params: element.params,
			key: "background.enabled",
			fallback: DEFAULTS.text.background.enabled,
		}),
		color: readStringParam({
			params: element.params,
			key: "background.color",
			fallback: DEFAULTS.text.background.color,
		}),
		cornerRadius: readNumberParam({
			params: element.params,
			key: "background.cornerRadius",
			fallback: DEFAULTS.text.background.cornerRadius,
		}),
		paddingX: readNumberParam({
			params: element.params,
			key: "background.paddingX",
			fallback: DEFAULTS.text.background.paddingX,
		}),
		paddingY: readNumberParam({
			params: element.params,
			key: "background.paddingY",
			fallback: DEFAULTS.text.background.paddingY,
		}),
		offsetX: readNumberParam({
			params: element.params,
			key: "background.offsetX",
			fallback: DEFAULTS.text.background.offsetX,
		}),
		offsetY: readNumberParam({
			params: element.params,
			key: "background.offsetY",
			fallback: DEFAULTS.text.background.offsetY,
		}),
	};
}

function readStringParam({
	params,
	key,
	fallback,
}: {
	params: TextElement["params"];
	key: string;
	fallback: string;
}): string {
	const value = params[key];
	return typeof value === "string" ? value : fallback;
}

function readNumberParam({
	params,
	key,
	fallback,
}: {
	params: TextElement["params"];
	key: string;
	fallback: number;
}): number {
	const value = params[key];
	return typeof value === "number" ? value : fallback;
}

function readBooleanParam({
	params,
	key,
	fallback,
}: {
	params: TextElement["params"];
	key: string;
	fallback: boolean;
}): boolean {
	const value = params[key];
	return typeof value === "boolean" ? value : fallback;
}

function readTextAlign({
	value,
	fallback,
}: {
	value: unknown;
	fallback: TextAlign;
}): TextAlign {
	return value === "left" || value === "center" || value === "right"
		? value
		: fallback;
}

function readFontWeight({
	value,
	fallback,
}: {
	value: unknown;
	fallback: TextFontWeight;
}): TextFontWeight {
	return value === "bold" || value === "normal" ? value : fallback;
}

function readFontStyle({
	value,
	fallback,
}: {
	value: unknown;
	fallback: TextFontStyle;
}): TextFontStyle {
	return value === "italic" || value === "normal" ? value : fallback;
}

function readTextDecoration({
	value,
	fallback,
}: {
	value: unknown;
	fallback: TextDecoration;
}): TextDecoration {
	return value === "none" || value === "underline" || value === "line-through"
		? value
		: fallback;
}
