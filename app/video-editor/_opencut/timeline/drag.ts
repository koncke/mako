import type { MaskableElement, VisualElement } from "./types";
import type { ParamValues } from "@/app/video-editor/_opencut/params";
import type { MediaTime } from "@/app/video-editor/_opencut/wasm";

interface BaseDragData {
	id: string;
	name: string;
}

export interface MediaDragData extends BaseDragData {
	type: "media";
	mediaType: "image" | "video" | "audio";
	targetElementTypes?: MaskableElement["type"][];
}

export interface TextDragData extends BaseDragData {
	type: "text";
	content: string;
	/** Duración al soltarlo (la biblioteca de CapCut agrega el texto de 3 s). Sin ella, la de siempre. */
	duration?: MediaTime;
	/** El estilo de la tarjeta («Efectos de texto», «Plantilla de texto», un predefinido). */
	params?: ParamValues;
}

export interface StickerDragData extends BaseDragData {
	type: "sticker";
	stickerId: string;
}

export interface GraphicDragData extends BaseDragData {
	type: "graphic";
	definitionId: string;
	params: Partial<ParamValues>;
}

export interface EffectDragData extends BaseDragData {
	type: "effect";
	effectType: string;
	targetElementTypes: VisualElement["type"][];
	/** Params propios de la tarjeta (una LUT, un predefinido): se aplican al soltar. */
	params?: ParamValues;
}

/** Una transición de la biblioteca (transiciones/): no crea un elemento, se pone en
 *  el CORTE entre dos clips pegados (el más cercano del clip donde se suelta). */
export interface TransicionDragData extends BaseDragData {
	type: "transicion";
	transicionId: string;
}

export type TimelineDragData =
	| MediaDragData
	| TextDragData
	| StickerDragData
	| GraphicDragData
	| EffectDragData
	| TransicionDragData;
