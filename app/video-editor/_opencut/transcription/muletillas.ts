// =============================================================================
// «Identificar las muletillas»: sacar eh, este, o sea… de los subtítulos
// =============================================================================
// Dos listas por idioma, porque no es lo mismo «eh» que «este»:
//
//   · SONIDOS (eh, mmm, uh): no son palabras, se sacan siempre.
//   · PALABRAS que a veces son muletilla y a veces no («este producto», «bueno,
//     ...»): se sacan sólo cuando SUENAN a muletilla — con coma o puntos
//     suspensivos pegados («este,», «o sea...») o con pausa a los dos lados.
//
// Whisper ya se come muchas muletillas solo (las «limpia» al transcribir), así
// que esto encuentra pocas; las que encuentra son las que sí escribió.
// ⚠️ «é» del portugués NO va en sonidos: es «es».

import type { PalabraTranscrita } from "./types";

const SONIDOS = new Set([
	"eh", "ehh", "ehm", "em", "emm", "mm", "mmm", "mmmm", "hmm", "hm", "ah", "ahh",
	"uh", "uhh", "uhm", "um", "umm", "er", "erm", "hã", "ãh", "ahn", "hum",
]);

const PALABRAS: Record<string, string[]> = {
	es: ["este", "o sea", "bueno", "tipo", "pues", "digamos", "sabes", "viste", "nada", "a ver"],
	en: ["like", "you know", "i mean", "so", "well", "basically", "actually"],
	pt: ["tipo", "né", "então", "assim", "sabe", "quer dizer"],
};

const PAUSA_MULETILLA_S = 0.25;

export function normalizarPalabra(texto: string): string {
	return texto
		.toLowerCase()
		.replace(/^[¡¿"'“«(\[{-]+/, "")
		.replace(/[.,;:!?…"'”»)\]}]+$/, "")
		.trim();
}

const suenaAMuletilla = (texto: string) => /[,…]$|\.\.\.$/.test(texto.trim());

/**
 * Saca las muletillas de una lista de palabras. Si la que se saca empezaba una
 * oración (mayúscula), la siguiente hereda la mayúscula.
 */
export function quitarMuletillas({
	palabras,
	idioma,
}: {
	palabras: PalabraTranscrita[];
	idioma: string;
}): { palabras: PalabraTranscrita[]; quitadas: number } {
	const frases = (PALABRAS[idioma] ?? []).map((f) => f.split(" "));
	const salida: PalabraTranscrita[] = [];
	let quitadas = 0;
	let mayusculaPendiente = false;

	for (let i = 0; i < palabras.length; i++) {
		const p = palabras[i];
		const norm = normalizarPalabra(p.texto);
		let largo = 0;

		if (SONIDOS.has(norm)) {
			largo = 1;
		} else {
			for (const frase of frases) {
				const n = frase.length;
				if (i + n > palabras.length) continue;
				if (!frase.every((w, k) => normalizarPalabra(palabras[i + k].texto) === w)) continue;
				const ultima = palabras[i + n - 1];
				const antes = i > 0 ? p.inicio - palabras[i - 1].fin : Number.POSITIVE_INFINITY;
				const despues =
					i + n < palabras.length ? palabras[i + n].inicio - ultima.fin : Number.POSITIVE_INFINITY;
				if (
					suenaAMuletilla(ultima.texto) ||
					(antes >= PAUSA_MULETILLA_S && despues >= PAUSA_MULETILLA_S)
				) {
					largo = n;
					break;
				}
			}
		}

		if (largo > 0) {
			// La puntuación de cierre de oración no se pierde con la muletilla:
			// «compramos, eh.» → «compramos.»
			const fin = palabras[i + largo - 1].texto.trim();
			const cierre = /[.!?]$/.test(fin) && !fin.endsWith("...") ? fin.slice(-1) : "";
			if (cierre && salida.length > 0) {
				const prev = salida[salida.length - 1];
				salida[salida.length - 1] = { ...prev, texto: prev.texto.replace(/[,;:]+$/, "") + cierre };
			}
			if (/^[¡¿"'“«(]*\p{Lu}/u.test(p.texto.trim())) mayusculaPendiente = true;
			quitadas += largo;
			i += largo - 1;
			continue;
		}

		if (mayusculaPendiente) {
			mayusculaPendiente = false;
			salida.push({ ...p, texto: p.texto.replace(/\p{Ll}/u, (c) => c.toUpperCase()) });
			continue;
		}
		salida.push(p);
	}
	return { palabras: salida, quitadas };
}
