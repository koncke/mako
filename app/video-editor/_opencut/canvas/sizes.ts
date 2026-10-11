import type {
	TCanvasSize,
	TProjectSettings,
} from "@/app/video-editor/_opencut/project/types";

export const DEFAULT_CANVAS_PRESETS: TCanvasSize[] = [
	{ width: 1920, height: 1080 },
	{ width: 1080, height: 1920 },
	{ width: 1080, height: 1080 },
	{ width: 1440, height: 1080 },
];

export const DEFAULT_CANVAS_SIZE: TCanvasSize = { width: 1920, height: 1080 };

// =============================================================================
// «Relación»: la lista del botón del reproductor de CapCut
// =============================================================================
// CapCut no guarda una resolución de lienzo: guarda una PROPORCIÓN, y la
// resolución la elige el diálogo Exportar. El motor de OpenCut sí guarda
// píxeles (`settings.canvasSize`), así que cada proporción se traduce a un
// tamaño conservando el LADO CORTO del lienzo actual: un proyecto 4K que pasa
// a 9:16 queda 2160×3840, no cae a 1080. La lista y el orden son los de
// `Resources/video_template_ratio.json` de CapCut 9.3.
//
// «Original» = la proporción del PRIMER clip que se agregó
// (`settings.originalCanvasSize`, lo fija insert-element); sin clips, 16:9.
// Elegir una proporción fija la deja guardada en `settings.relacion` para que el
// primer clip ya no la pise (en CapCut, el primer clip sólo manda en «Original»).

export type IdRelacion =
	| "original"
	| "16:9"
	| "9:16"
	| "1:1"
	| "4:3"
	| "2:1"
	| "5.8in"
	| "2.35:1"
	| "3:4"
	| "1.85:1";

export type Relacion = {
	id: IdRelacion;
	etiqueta: string;
	/** ancho / alto; `null` en «Original» (depende del primer clip). */
	proporcion: number | null;
};

export const RELACIONES: readonly Relacion[] = [
	{ id: "original", etiqueta: "Original", proporcion: null },
	{ id: "16:9", etiqueta: "16:9", proporcion: 16 / 9 },
	{ id: "9:16", etiqueta: "9:16", proporcion: 9 / 16 },
	{ id: "1:1", etiqueta: "1:1", proporcion: 1 },
	{ id: "4:3", etiqueta: "4:3", proporcion: 4 / 3 },
	{ id: "2:1", etiqueta: "2:1", proporcion: 2 },
	// La pantalla del iPhone X (1125×2436), en vertical.
	{ id: "5.8in", etiqueta: '5.8"', proporcion: 1125 / 2436 },
	{ id: "2.35:1", etiqueta: "2.35:1", proporcion: 2.35 },
	{ id: "3:4", etiqueta: "3:4", proporcion: 3 / 4 },
	{ id: "1.85:1", etiqueta: "1.85:1", proporcion: 1.85 },
];

export function esIdRelacion(valor: unknown): valor is IdRelacion {
	return RELACIONES.some((r) => r.id === valor);
}

/** El códec H.264 pide lados pares: un lienzo impar exporta con una línea negra o falla. */
function par(n: number): number {
	return Math.max(2, Math.round(n / 2) * 2);
}

/** El tamaño de una proporción con el lado corto dado. */
export function tamanoConProporcion({
	proporcion,
	ladoCorto,
}: {
	proporcion: number;
	ladoCorto: number;
}): TCanvasSize {
	return proporcion >= 1
		? { width: par(ladoCorto * proporcion), height: par(ladoCorto) }
		: { width: par(ladoCorto), height: par(ladoCorto / proporcion) };
}

/** El lienzo «Original»: el del primer clip, o el de siempre si todavía no hay. */
export function tamanoOriginal(settings: TProjectSettings): TCanvasSize {
	return settings.originalCanvasSize ?? DEFAULT_CANVAS_SIZE;
}

/** El lienzo que corresponde a elegir `id` en «Relación», partiendo del actual. */
export function tamanoDeRelacion({
	id,
	settings,
}: {
	id: IdRelacion;
	settings: TProjectSettings;
}): TCanvasSize {
	const relacion = RELACIONES.find((r) => r.id === id);
	if (!relacion || relacion.proporcion === null) return tamanoOriginal(settings);
	const { width, height } = settings.canvasSize;
	return tamanoConProporcion({
		proporcion: relacion.proporcion,
		ladoCorto: Math.min(width, height),
	});
}

function mismaProporcion(a: number, b: number): boolean {
	return Math.abs(a / b - 1) < 0.01;
}

/**
 * Qué ítem de «Relación» va tildado. Se DEDUCE del lienzo y no sólo de
 * `settings.relacion`: el tamaño también se cambia desde otros lados (la vista de
 * ajustes del proyecto, deshacer), y un tilde que miente es peor que ninguno.
 */
export function relacionActual(settings: TProjectSettings): IdRelacion | null {
	const { width, height } = settings.canvasSize;
	const proporcion = width / height;
	const guardada = settings.relacion;
	if (!guardada || guardada === "original") {
		const original = tamanoOriginal(settings);
		if (mismaProporcion(proporcion, original.width / original.height)) {
			return "original";
		}
	}
	if (guardada && guardada !== "original") {
		const elegida = RELACIONES.find((r) => r.id === guardada);
		if (elegida?.proporcion && mismaProporcion(proporcion, elegida.proporcion)) {
			return elegida.id;
		}
	}
	return (
		RELACIONES.find(
			(r) => r.proporcion !== null && mismaProporcion(proporcion, r.proporcion),
		)?.id ?? null
	);
}
