// =============================================================================
// Un subtítulo = un texto con `subtitulo: true`, partido en líneas y ubicado
// =============================================================================
// El motor de texto no parte líneas solo: dibuja los `\n` del contenido. Por eso
// el subtítulo se arma con los saltos ya puestos (midiendo con la MISMA cuenta
// que usa el render, text/measure-element.ts) y se ubica con el borde de abajo a
// una altura fija, centrado. Cuando cambia el estilo (una plantilla, «Aplicar en
// todos los subtítulos») se vuelve a partir y a ubicar con `reacomodarSubtitulo`.
//
// Los parámetros salen de TODOS los declarados para el texto (registry + extra),
// no de los defaults de OpenCut a mano: así un subtítulo nace con los parámetros
// que sumen los demás paquetes (animaciones, contorno…) en su valor por defecto.

import { FONT_SIZE_SCALE_REFERENCE } from "@/app/video-editor/_opencut/text/typography";
import {
	buildTextLayoutParamsFromElement,
	getTextMeasurementContext,
	measureTextElement,
} from "@/app/video-editor/_opencut/text/measure-element";
import { resolveTextLayout } from "@/app/video-editor/_opencut/text/primitives";
import { setCanvasLetterSpacing } from "@/app/video-editor/_opencut/text/layout";
import { aplicarMayusculas, leerMayusculas } from "@/app/video-editor/_opencut/text/estilo";
import {
	buildDefaultParamValues,
	getBuiltInElementParams,
} from "@/app/video-editor/_opencut/params/registry";
import type { ParamValue, ParamValues } from "@/app/video-editor/_opencut/params";
import { mediaTimeFromSeconds, ZERO_MEDIA_TIME } from "@/app/video-editor/_opencut/wasm";
import type { CreateTextElement, TextElement } from "@/app/video-editor/_opencut/timeline";
import { PARAM_SUBTITULO } from "@/app/video-editor/_opencut/params/extra/subtitulos";
import type { SubtitleCue, SubtitleStyleOverrides } from "./types";
import { codificarPalabras, PARAM_PALABRAS } from "./palabras";
import { anchoMaximo, margenInferior, type Lienzo } from "./estilos";

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Un TextElement de mentira para medir con las funciones del render. */
function comoTexto(params: ParamValues): TextElement {
	return {
		id: "medir",
		type: "text",
		name: "",
		duration: ZERO_MEDIA_TIME,
		startTime: ZERO_MEDIA_TIME,
		trimStart: ZERO_MEDIA_TIME,
		trimEnd: ZERO_MEDIA_TIME,
		params,
	} as TextElement;
}

/**
 * Parte cada párrafo en líneas que entran en `anchoPx` (por palabras). `ancho` mide
 * como se DIBUJA: con «May./min.» en Mayúscula, «PALABRA» es más ancha que «palabra»,
 * y medida en minúscula una línea en mayúsculas se salía por los costados.
 */
function partirEnLineas({
	ancho,
	texto,
	anchoPx,
}: {
	ancho: (s: string) => number;
	texto: string;
	anchoPx: number;
}): string {
	return texto
		.replace(/\r\n/g, "\n")
		.split("\n")
		.map((parrafo) => {
			const palabras = parrafo.trim().split(/\s+/).filter(Boolean);
			if (palabras.length === 0) return "";
			const lineas: string[] = [];
			let linea = palabras[0];
			for (let i = 1; i < palabras.length; i++) {
				const candidata = `${linea} ${palabras[i]}`;
				if (ancho(candidata) <= anchoPx) {
					linea = candidata;
				} else {
					lineas.push(linea);
					linea = palabras[i];
				}
			}
			lineas.push(linea);
			return equilibrar({ ancho, lineas });
		})
		.join("\n");
}

/**
 * Dos líneas desparejas («Esto es lo que vas a ver en / esto») se leen peor que
 * dos parejas: si la segunda quedó con menos de un tercio, se pasa una palabra.
 */
function equilibrar({ ancho, lineas }: { ancho: (s: string) => number; lineas: string[] }): string {
	if (lineas.length !== 2) return lineas.join("\n");
	let [a, b] = lineas;
	while (ancho(b) < ancho(a) / 3) {
		const corte = a.lastIndexOf(" ");
		if (corte <= 0) break;
		const nuevaA = a.slice(0, corte);
		const nuevaB = `${a.slice(corte + 1)} ${b}`;
		if (ancho(nuevaB) > ancho(a)) break;
		a = nuevaA;
		b = nuevaB;
	}
	return `${a}\n${b}`;
}

export type Ubicacion = {
	/** Dónde va: abajo (lo común), arriba o al medio (sólo lo piden los ASS). */
	vertical?: "top" | "middle" | "bottom";
	/** Margen vertical en px; por defecto, `margenInferior(lienzo)`. */
	margenPx?: number;
	/** Márgenes laterales (ASS), proporción del ancho. */
	margenIzquierdo?: number;
	margenDerecho?: number;
	/** Mantener el borde de abajo donde está (en px desde el centro del lienzo). */
	bordeInferior?: number;
};

/**
 * Parte el contenido en líneas y lo ubica. Devuelve los parámetros nuevos
 * (contenido y posición); el resto queda como estaba.
 */
export function partirYUbicar({
	params,
	lienzo,
	ubicacion = {},
	repartir = false,
}: {
	params: ParamValues;
	lienzo: Lienzo;
	ubicacion?: Ubicacion;
	/** Juntar los saltos que ya había antes de partir (al cambiar de estilo). */
	repartir?: boolean;
}): Pick<ParamValues, "content" | "transform.positionX" | "transform.positionY"> {
	let ctx: Ctx;
	try {
		ctx = getTextMeasurementContext();
	} catch {
		return {
			content: params.content ?? "",
			"transform.positionX": params["transform.positionX"] ?? 0,
			"transform.positionY": params["transform.positionY"] ?? 0,
		};
	}
	const original = String(params.content ?? "");
	const texto = repartir ? original.replace(/\s*\n\s*/g, " ") : original;

	const layout = resolveTextLayout({
		text: buildTextLayoutParamsFromElement({ element: comoTexto(params) }),
		canvasHeight: lienzo.height,
	});
	const izquierdo = (ubicacion.margenIzquierdo ?? 0) * lienzo.width;
	const derecho = (ubicacion.margenDerecho ?? 0) * lienzo.width;
	const anchoDisponible =
		izquierdo > 0 || derecho > 0 ? lienzo.width - izquierdo - derecho : anchoMaximo(lienzo);
	const escalaX = Math.abs(Number(params["transform.scaleX"] ?? 1)) || 1;
	const escalaY = Math.abs(Number(params["transform.scaleY"] ?? 1)) || 1;

	const mayusculas = leerMayusculas(params);
	ctx.save();
	ctx.font = layout.fontString;
	setCanvasLetterSpacing({ ctx, letterSpacingPx: layout.letterSpacing });
	const content = partirEnLineas({
		ancho: (s) => ctx.measureText(aplicarMayusculas(s, mayusculas)).width,
		texto,
		anchoPx: anchoDisponible / escalaX,
	});
	ctx.restore();

	const medido = measureTextElement({
		element: comoTexto({ ...params, content }),
		canvasHeight: lienzo.height,
		localTime: 0,
		ctx,
	});
	const r = medido.visualRect;

	// X: centrado en el espacio disponible (o pegado a un margen si el texto se
	// alinea a un lado, como en los ASS).
	const alineacion = String(params.textAlign ?? "center");
	const centroX = lienzo.width / 2;
	let x: number;
	if (alineacion === "left" && izquierdo > 0) x = izquierdo - r.left * escalaX - centroX;
	else if (alineacion === "right" && derecho > 0)
		x = lienzo.width - derecho - (r.left + r.width) * escalaX - centroX;
	else x = izquierdo + (lienzo.width - izquierdo - derecho) / 2 - (r.left + r.width / 2) * escalaX - centroX;

	// Y: el borde de abajo a la altura pedida (o donde ya estaba).
	const centroY = lienzo.height / 2;
	const abajoRel = (r.top + r.height) * escalaY;
	let y: number;
	if (ubicacion.bordeInferior != null) {
		y = ubicacion.bordeInferior - abajoRel;
	} else if (ubicacion.vertical === "top") {
		y = (ubicacion.margenPx ?? lienzo.height * 0.05) - r.top * escalaY - centroY;
	} else if (ubicacion.vertical === "middle") {
		y = -(r.top + r.height / 2) * escalaY;
	} else {
		y = lienzo.height - (ubicacion.margenPx ?? margenInferior(lienzo)) - abajoRel - centroY;
	}

	return {
		content,
		"transform.positionX": Math.round(x * 10) / 10,
		"transform.positionY": Math.round(y * 10) / 10,
	};
}

/** Dónde está hoy el borde de abajo de un subtítulo (px desde el centro del lienzo). */
export function bordeInferiorDe({
	params,
	lienzo,
}: {
	params: ParamValues;
	lienzo: Lienzo;
}): number | null {
	try {
		const ctx = getTextMeasurementContext();
		const r = measureTextElement({
			element: comoTexto(params),
			canvasHeight: lienzo.height,
			localTime: 0,
			ctx,
		}).visualRect;
		const escalaY = Math.abs(Number(params["transform.scaleY"] ?? 1)) || 1;
		return Number(params["transform.positionY"] ?? 0) + (r.top + r.height) * escalaY;
	} catch {
		return null;
	}
}

/** Los parámetros de estilo que trae un SRT/ASS importado (sus `style`). */
function paramsDeOverrides(style: SubtitleStyleOverrides | undefined): ParamValues {
	if (!style) return {};
	const p: ParamValues = {};
	if (style.fontSizeRatioOfPlayHeight != null) {
		p.fontSize = style.fontSizeRatioOfPlayHeight * FONT_SIZE_SCALE_REFERENCE;
	} else if (style.fontSize != null) {
		p.fontSize = style.fontSize;
	}
	if (style.fontFamily) p.fontFamily = style.fontFamily;
	if (style.color) p.color = style.color;
	if (style.textAlign) p.textAlign = style.textAlign;
	if (style.fontWeight) p.fontWeight = style.fontWeight;
	if (style.fontStyle) p.fontStyle = style.fontStyle;
	if (style.textDecoration) p.textDecoration = style.textDecoration;
	if (style.letterSpacing != null) p.letterSpacing = style.letterSpacing;
	if (style.lineHeight != null) p.lineHeight = style.lineHeight;
	if (style.background) {
		p["background.enabled"] = style.background.enabled;
		p["background.color"] = style.background.color;
		const b = style.background;
		if (b.cornerRadius != null) p["background.cornerRadius"] = b.cornerRadius;
		if (b.paddingX != null) p["background.paddingX"] = b.paddingX;
		if (b.paddingY != null) p["background.paddingY"] = b.paddingY;
		if (b.offsetX != null) p["background.offsetX"] = b.offsetX;
		if (b.offsetY != null) p["background.offsetY"] = b.offsetY;
	}
	return p;
}

/**
 * Arma el texto-subtítulo de un cue: los parámetros por defecto de TODO texto,
 * el estilo (la plantilla elegida), lo que traiga el archivo importado, y la
 * marca `subtitulo`.
 */
export function buildSubtitleTextElement({
	index,
	caption,
	canvasSize,
	estilo = {},
}: {
	index: number;
	caption: SubtitleCue;
	canvasSize: Lienzo;
	estilo?: Record<string, ParamValue>;
}): CreateTextElement {
	const base = buildDefaultParamValues(getBuiltInElementParams({ type: "text" }));
	const params: ParamValues = {
		...base,
		...estilo,
		...paramsDeOverrides(caption.style),
		content: caption.text,
		[PARAM_SUBTITULO]: true,
		// Las palabras con su tiempo, relativas al origen del recorte: un subtítulo nuevo
		// tiene trimStart 0, así que el origen es su inicio (subtitles/palabras.ts).
		...(caption.palabras?.length
			? { [PARAM_PALABRAS]: codificarPalabras({ palabras: caption.palabras, origen: caption.startTime, precision: caption.precision ?? "segmento" }) }
			: {}),
	};
	const placement = caption.style?.placement;
	const ubicado = partirYUbicar({
		params,
		lienzo: canvasSize,
		ubicacion: placement
			? {
					vertical: placement.verticalAlign,
					margenPx:
						placement.marginVerticalRatio != null
							? placement.marginVerticalRatio * canvasSize.height
							: undefined,
					margenIzquierdo: placement.marginLeftRatio,
					margenDerecho: placement.marginRightRatio,
				}
			: {},
	});

	return {
		type: "text",
		name: `Subtítulo ${index + 1}`,
		duration: mediaTimeFromSeconds({ seconds: caption.duration }),
		startTime: mediaTimeFromSeconds({ seconds: caption.startTime }),
		trimStart: ZERO_MEDIA_TIME,
		trimEnd: ZERO_MEDIA_TIME,
		params: { ...params, ...ubicado },
	};
}
