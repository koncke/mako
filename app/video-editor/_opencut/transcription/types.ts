import type { LanguageCode } from "./languages";

export type TranscriptionLanguage = LanguageCode | "auto";

export interface TranscriptionSegment {
	text: string;
	start: number;
	end: number;
}

/**
 * Una palabra con su tiempo, en segundos desde el inicio de la línea de tiempo.
 * `texto` es como lo escribió Whisper: con su puntuación pegada y sin el espacio
 * de adelante.
 */
export interface PalabraTranscrita {
	texto: string;
	inicio: number;
	fin: number;
}

/**
 * `palabra`: los tiempos salen del modelo, palabra por palabra.
 * `segmento`: el modelo sólo dio tiempos por frase y las palabras se repartieron
 * dentro de cada frase por largo (el respaldo si las marcas por palabra fallan).
 */
export type PrecisionTiempos = "palabra" | "segmento";

export interface TranscriptionResult {
	text: string;
	palabras: PalabraTranscrita[];
	precision: PrecisionTiempos;
	language: string;
}

export type TranscriptionStatus =
	| "idle"
	| "loading-model"
	| "transcribing"
	| "complete"
	| "error";

export interface TranscriptionProgress {
	status: TranscriptionStatus;
	/** 0–100. */
	progress: number;
	message?: string;
}

export type TranscriptionModelId =
	| "whisper-tiny"
	| "whisper-base"
	| "whisper-small"
	| "whisper-medium";

export interface TranscriptionModel {
	id: TranscriptionModelId;
	name: string;
	huggingFaceId: string;
	description: string;
}

export interface CaptionChunk {
	text: string;
	startTime: number;
	duration: number;
}
