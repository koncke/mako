import { parseAss } from "./ass";
import { parseLrc } from "./lrc";
import { parseSrt } from "./srt";
import type { ParseSubtitleResult } from "./types";
export type { ParseSubtitleResult, SubtitleCue } from "./types";

/** Los formatos de «Importar subtítulos» de CapCut: SRT, LRC y ASS. */
export const EXTENSIONES_SUBTITULOS = [".srt", ".lrc", ".ass"] as const;

export class FormatoNoAdmitido extends Error {
	constructor() {
		super("Unsupported subtitle format");
		this.name = "FormatoNoAdmitido";
	}
}

export function parseSubtitleFile({
	fileName,
	input,
}: {
	fileName: string;
	input: string;
}): ParseSubtitleResult {
	const extension = getFileExtension({ fileName });

	switch (extension) {
		case "srt":
			return parseSrt({ input });
		case "ass":
		case "ssa":
			return parseAss({ input });
		case "lrc":
			return parseLrc({ input });
		default:
			throw new FormatoNoAdmitido();
	}
}

function getFileExtension({ fileName }: { fileName: string }): string {
	const extension = fileName.split(".").pop();
	return extension?.toLowerCase() ?? "";
}
