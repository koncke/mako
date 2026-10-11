import type {
	TimelineElement,
	TrackType,
} from "@/app/video-editor/_opencut/timeline";

// Los colores de los clips son los MEDIDOS en CapCut Desktop 9.3 (tokens
// --cc-clip-* de capcut-theme.css): video verde petróleo con la franja del
// nombre un tono más clara, texto ladrillo, audio azul marino con la onda
// celeste. Stickers, efectos, filtros y ajuste salen de la guía de 2023 (a ojo).
// Nada de hex acá: el canvas de la onda lee el token con `leerToken`.

export const TIMELINE_AUDIO_WAVEFORM_COLOR = "rgba(255, 255, 255, 0.7)";

export const TIMELINE_TRACK_THEME: Record<
	TrackType,
	{
		elementClassName: string;
		waveformColor?: string;
	}
> = {
	video: { elementClassName: "bg-[var(--cc-clip-video)]" },
	text: { elementClassName: "bg-[var(--cc-clip-text)]" },
	audio: {
		elementClassName: "bg-[var(--cc-clip-audio)]",
		waveformColor: TIMELINE_AUDIO_WAVEFORM_COLOR,
	},
	graphic: { elementClassName: "bg-[var(--cc-clip-sticker)]" },
	effect: { elementClassName: "bg-[var(--cc-clip-effect)]" },
} as const;

/** La fila de la pista que tiene el clip elegido (`#2f2f2f`). */
export const SELECTED_TRACK_ROW_CLASS = "bg-[var(--cc-track-active)]";
export const DEFAULT_TIMELINE_BOOKMARK_COLOR = "#00c1cd";
/** «Agregar marcador con nuevo color» (Alt+M) recorre esta lista. */
export const COLORES_MARCADOR = [
	"#00c1cd",
	"#f2b01e",
	"#f5464b",
	"#3fb27f",
	"#8e7fff",
	"#ff8a3d",
] as const;

export function getTimelineElementClassName({
	type,
}: {
	type: TrackType;
}): string {
	return TIMELINE_TRACK_THEME[type].elementClassName.trim();
}

/**
 * El color de un clip de efecto depende de qué es: en CapCut los filtros y el
 * «Ajuste» son capas con su propio color. El tipo de efecto lo registra el
 * paquete de color (effects/); se reconoce por el id.
 */
export function claseClipEfecto({ effectType }: { effectType: string }): string {
	const id = effectType.toLowerCase();
	if (id.includes("filtro") || id.includes("filter") || id.includes("lut")) {
		return "bg-[var(--cc-clip-filter)]";
	}
	if (id.includes("ajust") || id.includes("adjust")) {
		return "bg-[var(--cc-clip-adjust)]";
	}
	return "bg-[var(--cc-clip-effect)]";
}

/** Clase de fondo del cuerpo de un clip, por tipo de elemento. */
export function claseCuerpoClip(element: TimelineElement): string {
	switch (element.type) {
		case "video":
		case "image":
			return "bg-[var(--cc-clip-video)]";
		case "text":
			return "bg-[var(--cc-clip-text)]";
		case "audio":
			return "bg-[var(--cc-clip-audio)]";
		case "sticker":
		case "graphic":
			return "bg-[var(--cc-clip-sticker)]";
		case "effect":
			return claseClipEfecto({ effectType: element.effectType });
	}
}

/**
 * Lee un token `--cc-*` ya resuelto, para lo que se dibuja en un canvas (que no
 * entiende `var()`). Se lee de la raíz `.ce`, donde viven los tokens.
 */
export function leerToken(nombre: string, respaldo: string): string {
	if (typeof document === "undefined") return respaldo;
	const raiz = document.querySelector(".ce") ?? document.documentElement;
	const valor = getComputedStyle(raiz).getPropertyValue(nombre).trim();
	return valor || respaldo;
}
