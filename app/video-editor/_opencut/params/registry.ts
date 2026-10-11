import type {
	ParamDefinition,
	ParamValue,
	ParamValues,
} from "@/app/video-editor/_opencut/params";
import { MIN_TRANSFORM_SCALE } from "@/app/video-editor/_opencut/animation/transform";
import type { BlendMode } from "@/app/video-editor/_opencut/rendering";
import type {
	ElementType,
	TimelineElement,
} from "@/app/video-editor/_opencut/timeline";
import { DEFAULTS } from "@/app/video-editor/_opencut/timeline/defaults";
import { VOLUME_DB_MAX, VOLUME_DB_MIN } from "@/app/video-editor/_opencut/timeline/audio-constants";
import { paramsExtra } from "@/app/video-editor/_opencut/params/extra";
import {
	CORNER_RADIUS_MAX,
	CORNER_RADIUS_MIN,
} from "@/app/video-editor/_opencut/text/background";

export type ElementParamDefinition<TKey extends string = string> =
	ParamDefinition<TKey> & {
		read?: ({ element }: { element: TimelineElement }) => ParamValue | null;
		write?: ({
			element,
			value,
		}: {
			element: TimelineElement;
			value: ParamValue;
		}) => TimelineElement;
	};

export function buildDefaultParamValues(
	params: readonly ParamDefinition[],
): ParamValues {
	const values: ParamValues = {};
	for (const param of params) {
		values[param.key] = param.default;
	}
	return values;
}

export class DefinitionRegistry<TKey extends string, TDefinition> {
	private definitions = new Map<TKey, TDefinition>();
	private entityName: string;

	constructor(entityName: string) {
		this.entityName = entityName;
	}

	register({
		key,
		definition,
	}: {
		key: TKey;
		definition: TDefinition;
	}): void {
		this.definitions.set(key, definition);
	}

	has(key: TKey): boolean {
		return this.definitions.has(key);
	}

	get(key: TKey): TDefinition {
		const def = this.definitions.get(key);
		if (!def) {
			throw new Error(`Unknown ${this.entityName}: ${key}`);
		}
		return def;
	}

	getAll(): TDefinition[] {
		return Array.from(this.definitions.values());
	}
}

// Los rótulos y el ORDEN son los de CapCut (Mezcla › Modo, es-LA.po): Normal,
// Pantalla, Oscurecer, Iluminar, Superposición, Luz intensa, Luz tenue,
// Profundidad del color, Desvanecimiento del color, Multiplicar. CapCut tiene
// además «Profundidad lineal» (linear burn), que el compositor de WASM no trae:
// el panel derecho la muestra apagada (ver video/basico.tsx). Los modos que el
// motor tiene y CapCut no van al final, con nombre en español, para que un
// proyecto viejo que los use siga mostrando su valor.
const BLEND_MODE_OPTIONS: Array<{ value: BlendMode; label: string }> = [
	{ value: "normal", label: "Normal" },
	{ value: "screen", label: "Pantalla" },
	{ value: "darken", label: "Oscurecer" },
	{ value: "lighten", label: "Iluminar" },
	{ value: "overlay", label: "Superposición" },
	{ value: "hard-light", label: "Luz intensa" },
	{ value: "soft-light", label: "Luz tenue" },
	{ value: "color-burn", label: "Profundidad del color" },
	{ value: "color-dodge", label: "Desvanecimiento del color" },
	{ value: "multiply", label: "Multiplicar" },
	{ value: "plus-lighter", label: "Sobreexposición lineal" },
	{ value: "difference", label: "Diferencia" },
	{ value: "exclusion", label: "Exclusión" },
	{ value: "hue", label: "Matiz" },
	{ value: "saturation", label: "Saturación" },
	{ value: "color", label: "Color" },
	{ value: "luminosity", label: "Luminosidad" },
];

const visualElementParams: ElementParamDefinition[] = [
	{
		key: "transform.scaleX",
		label: "Escala X",
		type: "number",
		default: DEFAULTS.element.transform.scaleX,
		min: MIN_TRANSFORM_SCALE,
		step: 0.01,
	},
	{
		key: "transform.scaleY",
		label: "Escala Y",
		type: "number",
		default: DEFAULTS.element.transform.scaleY,
		min: MIN_TRANSFORM_SCALE,
		step: 0.01,
	},
	{
		key: "transform.positionX",
		label: "Posición X",
		type: "number",
		default: DEFAULTS.element.transform.position.x,
		min: -100_000,
		step: 1,
	},
	{
		key: "transform.positionY",
		label: "Posición Y",
		type: "number",
		default: DEFAULTS.element.transform.position.y,
		min: -100_000,
		step: 1,
	},
	{
		key: "transform.rotate",
		label: "Girar",
		type: "number",
		default: DEFAULTS.element.transform.rotate,
		min: -360,
		max: 360,
		step: 1,
	},
	{
		key: "opacity",
		label: "Opacidad",
		type: "number",
		default: DEFAULTS.element.opacity,
		min: 0,
		max: 1,
		step: 0.01,
	},
	{
		key: "blendMode",
		label: "Modo",
		type: "select",
		default: DEFAULTS.element.blendMode,
		keyframable: false,
		options: BLEND_MODE_OPTIONS,
	},
];

const audioElementParams: ElementParamDefinition[] = [
	{
		key: "volume",
		label: "Volumen",
		type: "number",
		default: DEFAULTS.element.volume,
		min: VOLUME_DB_MIN,
		max: VOLUME_DB_MAX,
		step: 0.01,
	},
	{
		key: "muted",
		label: "Silenciado",
		type: "boolean",
		default: false,
		keyframable: false,
	},
];

const textElementParams: ElementParamDefinition[] = [
	{
		key: "content",
		label: "Texto",
		type: "text",
		default: "Default text",
		keyframable: false,
	},
	{
		key: "fontFamily",
		label: "Fuente",
		type: "font",
		default: "Arial",
		keyframable: false,
	},
	{
		key: "fontSize",
		label: "Tamaño de la fuente",
		type: "number",
		default: 15,
		min: 1,
		step: 1,
	},
	{
		key: "fontWeight",
		label: "Peso",
		type: "select",
		default: "normal",
		keyframable: false,
		options: [
			{ value: "normal", label: "Normal" },
			{ value: "bold", label: "Negrita" },
		],
	},
	{
		key: "fontStyle",
		label: "Estilo",
		type: "select",
		default: "normal",
		keyframable: false,
		options: [
			{ value: "normal", label: "Normal" },
			{ value: "italic", label: "Cursiva" },
		],
	},
	{
		key: "textDecoration",
		label: "Decoración",
		type: "select",
		default: "none",
		keyframable: false,
		options: [
			{ value: "none", label: "Ninguna" },
			{ value: "underline", label: "Subrayado" },
			{ value: "line-through", label: "Tachado" },
		],
	},
	{
		key: "color",
		label: "Color",
		type: "color",
		default: "#ffffff",
	},
	{
		key: "letterSpacing",
		label: "Espaciado entre caracteres",
		type: "number",
		default: DEFAULTS.text.letterSpacing,
		min: -100,
		step: 0.1,
	},
	{
		key: "lineHeight",
		label: "Interlineado",
		type: "number",
		default: DEFAULTS.text.lineHeight,
		min: 0.1,
		step: 0.1,
	},
	{
		key: "textAlign",
		label: "Alineación",
		type: "select",
		default: "center",
		keyframable: false,
		options: [
			{ value: "left", label: "Izquierda" },
			{ value: "center", label: "Centro" },
			{ value: "right", label: "Derecha" },
		],
	},
	{
		key: "background.enabled",
		label: "Fondo",
		type: "boolean",
		default: DEFAULTS.text.background.enabled,
		keyframable: false,
	},
	{
		key: "background.color",
		label: "Color del fondo",
		type: "color",
		default: DEFAULTS.text.background.color,
		dependencies: [{ param: "background.enabled", equals: true }],
	},
	{
		key: "background.cornerRadius",
		label: "Radio de las esquinas",
		type: "number",
		default: DEFAULTS.text.background.cornerRadius,
		min: CORNER_RADIUS_MIN,
		max: CORNER_RADIUS_MAX,
		step: 1,
		dependencies: [{ param: "background.enabled", equals: true }],
	},
	{
		key: "background.paddingX",
		label: "Margen X",
		type: "number",
		default: DEFAULTS.text.background.paddingX,
		min: 0,
		step: 1,
		dependencies: [{ param: "background.enabled", equals: true }],
	},
	{
		key: "background.paddingY",
		label: "Margen Y",
		type: "number",
		default: DEFAULTS.text.background.paddingY,
		min: 0,
		step: 1,
		dependencies: [{ param: "background.enabled", equals: true }],
	},
	{
		key: "background.offsetX",
		label: "Desplazamiento X",
		type: "number",
		default: DEFAULTS.text.background.offsetX,
		min: -100_000,
		step: 1,
		dependencies: [{ param: "background.enabled", equals: true }],
	},
	{
		key: "background.offsetY",
		label: "Desplazamiento Y",
		type: "number",
		default: DEFAULTS.text.background.offsetY,
		min: -100_000,
		step: 1,
		dependencies: [{ param: "background.enabled", equals: true }],
	},
];

export const elementParamRegistry = new DefinitionRegistry<
	ElementType,
	readonly ElementParamDefinition[]
>("element params");

elementParamRegistry.register({
	key: "video",
	definition: [...visualElementParams, ...audioElementParams, ...paramsExtra("video")],
});
elementParamRegistry.register({
	key: "image",
	definition: [...visualElementParams, ...paramsExtra("image")],
});
elementParamRegistry.register({
	key: "text",
	definition: [...textElementParams, ...visualElementParams, ...paramsExtra("text")],
});
elementParamRegistry.register({
	key: "sticker",
	definition: [...visualElementParams, ...paramsExtra("sticker")],
});
elementParamRegistry.register({
	key: "graphic",
	definition: [...visualElementParams, ...paramsExtra("graphic")],
});
elementParamRegistry.register({
	key: "audio",
	definition: [...audioElementParams, ...paramsExtra("audio")],
});
elementParamRegistry.register({
	key: "effect",
	definition: [...paramsExtra("effect")],
});

export function getElementParams({
	element,
}: {
	element: TimelineElement;
}): readonly ElementParamDefinition[] {
	return elementParamRegistry.has(element.type)
		? elementParamRegistry.get(element.type)
		: [];
}

export function getBuiltInElementParams({
	type,
}: {
	type: ElementType;
}): readonly ElementParamDefinition[] {
	return elementParamRegistry.has(type) ? elementParamRegistry.get(type) : [];
}

export function getElementParam({
	element,
	key,
}: {
	element: TimelineElement;
	key: string;
}): ElementParamDefinition | null {
	return (
		getElementParams({ element }).find((param) => param.key === key) ?? null
	);
}

export function readElementParamValue({
	element,
	param,
}: {
	element: TimelineElement;
	param: ElementParamDefinition;
}): ParamValue | null {
	if (param.read) {
		return param.read({ element });
	}
	if ("params" in element) {
		return element.params[param.key] ?? param.default;
	}
	return null;
}

export function writeElementParamValue({
	element,
	param,
	value,
}: {
	element: TimelineElement;
	param: ElementParamDefinition;
	value: ParamValue;
}): TimelineElement {
	if (param.write) {
		return param.write({ element, value });
	}
	if ("params" in element) {
		return {
			...element,
			params: {
				...element.params,
				[param.key]: value,
			},
		};
	}
	return element;
}

export function buildElementParamValues({
	element,
}: {
	element: TimelineElement;
}): ParamValues {
	const values: ParamValues = {};
	for (const param of getElementParams({ element })) {
		const value = readElementParamValue({ element, param });
		if (value !== null) {
			values[param.key] = value;
		}
	}
	return values;
}

