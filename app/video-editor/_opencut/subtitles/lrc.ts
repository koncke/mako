// =============================================================================
// LRC (letras con tiempo): el tercer formato de «Importar subtítulos» de CapCut
// =============================================================================
// Cada línea es `[mm:ss.xx]texto` (puede traer varias marcas: la misma línea en
// dos momentos). El LRC no dice cuándo TERMINA una línea: dura hasta la
// siguiente, con un tope para que una línea antes de un instrumental largo no
// quede en pantalla un minuto. Las etiquetas de cabecera ([ar:], [ti:]…) y las
// marcas por palabra del LRC extendido (`<mm:ss.xx>`) se ignoran.

import type { ParseSubtitleResult, SubtitleCue } from "./types";

const MARCA = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
const TOPE_LINEA_S = 8;
const ULTIMA_LINEA_S = 4;

function segundos(m: string, s: string, frac?: string): number {
	const f = frac ? Number(frac) / 10 ** frac.length : 0;
	return Number(m) * 60 + Number(s) + f;
}

export function parseLrc({ input }: { input: string }): ParseSubtitleResult {
	const lineas: Array<{ t: number; texto: string }> = [];
	let skippedCueCount = 0;

	for (const cruda of input.replace(/\r\n?/g, "\n").split("\n")) {
		const marcas = [...cruda.matchAll(MARCA)];
		if (marcas.length === 0) continue;
		const texto = cruda
			.replace(MARCA, "")
			.replace(/<\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?>/g, "")
			.trim();
		if (!texto) {
			// Una marca sin texto es un corte (fin de la línea anterior): se guarda
			// vacía para que la anterior termine ahí.
			for (const m of marcas) lineas.push({ t: segundos(m[1], m[2], m[3]), texto: "" });
			continue;
		}
		for (const m of marcas) {
			const t = segundos(m[1], m[2], m[3]);
			if (Number.isFinite(t)) lineas.push({ t, texto });
			else skippedCueCount++;
		}
	}

	lineas.sort((a, b) => a.t - b.t);
	const captions: SubtitleCue[] = [];
	for (let i = 0; i < lineas.length; i++) {
		const { t, texto } = lineas[i];
		if (!texto) continue;
		const siguiente = lineas[i + 1]?.t;
		const fin = siguiente != null ? Math.min(siguiente, t + TOPE_LINEA_S) : t + ULTIMA_LINEA_S;
		if (fin - t <= 0) {
			skippedCueCount++;
			continue;
		}
		captions.push({ text: texto, startTime: t, duration: fin - t });
	}
	return { captions, skippedCueCount, warnings: [] };
}
