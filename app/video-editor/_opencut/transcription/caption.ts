// =============================================================================
// De palabras con tiempo a subtítulos (cómo corta CapCut)
// =============================================================================
// OpenCut partía cada frase de Whisper en tandas fijas de 3 palabras y les
// repartía el tiempo de la frase en partes iguales: el subtítulo cambiaba a
// destiempo de la voz y cortaba en cualquier lado. Acá cada subtítulo arranca
// cuando arranca su primera palabra y termina cuando termina la última, y se
// corta donde corta el que habla:
//
//   · en una PAUSA (≥ 0,5 s sin voz entre dos palabras);
//   · al terminar una ORACIÓN (. ! ? …);
//   · si no entra en el LARGO de una línea (según la forma del lienzo), sin
//     dejar colgando un artículo o una preposición al final («de», «la», «the»);
//   · en una COMA, si ya va por la mitad del largo;
//   · si dura más de 5 s.
//
// Este archivo es puro (sin DOM): lo usa también el worker de Whisper.

import type { CaptionChunk, PalabraTranscrita } from "./types";
import {
	HUECO_MINIMO_S,
	MAX_DURACION_SUBTITULO_S,
	MIN_CAPTION_DURATION_SECONDS,
	PAUSA_CORTE_S,
} from "./caption-defaults";
import { normalizarPalabra } from "./muletillas";

/** Palabras que no cierran una línea: si el corte cae después de una, pasa a la siguiente. */
const NO_CIERRAN = new Set([
	"a", "al", "con", "de", "del", "el", "en", "la", "las", "lo", "los", "mi", "mis", "o",
	"para", "por", "que", "se", "su", "sus", "tu", "tus", "un", "una", "y", "e", "ni", "sin",
	"the", "an", "and", "of", "to", "in", "on", "for", "with", "my", "your", "or", "at",
	"da", "do", "das", "dos", "na", "no", "nas", "nos", "um", "uma", "em", "com", "seu", "sua",
]);

const FIN_ORACION = /[.!?…]["'”»)\]]*$/;
const COMA = /[,;:]["'”»)\]]*$/;

/**
 * Reparte el tiempo de una frase entre sus palabras por LARGO (no en partes
 * iguales: «a» no dura lo que «extraordinariamente»). Es el respaldo cuando el
 * modelo sólo dio tiempos por frase.
 */
export function repartirPorLargo({
	texto,
	inicio,
	fin,
}: {
	texto: string;
	inicio: number;
	fin: number;
}): PalabraTranscrita[] {
	const palabras = texto.trim().split(/\s+/).filter(Boolean);
	if (palabras.length === 0) return [];
	const pesos = palabras.map((p) => Math.max(1, p.length));
	const total = pesos.reduce((a, b) => a + b, 0);
	const dur = Math.max(0, fin - inicio);
	let t = inicio;
	return palabras.map((p, i) => {
		const d = (dur * pesos[i]) / total;
		const palabra = { texto: p, inicio: t, fin: t + d };
		t += d;
		return palabra;
	});
}

/**
 * Lo que Whisper escribe y nadie dijo: marcas de no-voz («[Música]», «(risas)»,
 * «♪») y sus alucinaciones conocidas en español sobre silencio o música.
 */
export function quitarNoVoz(palabras: PalabraTranscrita[]): PalabraTranscrita[] {
	const salida: PalabraTranscrita[] = [];
	// Una marca abierta que no cierra en pocas palabras era un paréntesis de
	// verdad («(ver abajo)» mal cerrado): se devuelve tal cual.
	const MAX_MARCA = 6;
	let marca: PalabraTranscrita[] | null = null;
	for (const p of palabras) {
		const t = p.texto.trim();
		if (!marca && /^[[(*]/.test(t)) marca = [];
		if (marca) {
			marca.push(p);
			if (/[\])*][.,!?]*$/.test(t)) {
				marca = null;
			} else if (marca.length >= MAX_MARCA) {
				salida.push(...marca);
				marca = null;
			}
			continue;
		}
		if (/[♪♫]/.test(t) || /^[#*]+$/.test(t)) continue;
		salida.push(p);
	}
	if (marca) salida.push(...marca);
	return salida;
}

const ALUCINACIONES = [
	/amara\.org/i,
	/subt[ií]tulos? (realizados? )?por/i,
	/subtitulado por/i,
];

const largoDe = (ps: PalabraTranscrita[]) =>
	ps.reduce((n, p, i) => n + p.texto.length + (i > 0 ? 1 : 0), 0);

/** Arma los subtítulos a partir de las palabras (ver la cabecera). */
export function armarSubtitulos({
	palabras,
	maxCaracteres,
	pausa = PAUSA_CORTE_S,
	maxDuracion = MAX_DURACION_SUBTITULO_S,
}: {
	palabras: PalabraTranscrita[];
	maxCaracteres: number;
	pausa?: number;
	maxDuracion?: number;
}): CaptionChunk[] {
	const grupos: PalabraTranscrita[][] = [];
	let actual: PalabraTranscrita[] = [];

	const cerrar = () => {
		if (actual.length > 0) grupos.push(actual);
		actual = [];
	};

	for (const p of palabras) {
		if (actual.length > 0) {
			const prev = actual[actual.length - 1];
			const largo = largoDe(actual);
			const porLargo = largo + 1 + p.texto.length > maxCaracteres;
			if (
				p.inicio - prev.fin >= pausa ||
				FIN_ORACION.test(prev.texto) ||
				p.fin - actual[0].inicio > maxDuracion ||
				(COMA.test(prev.texto) && largo >= maxCaracteres * 0.5)
			) {
				cerrar();
			} else if (porLargo) {
				// Un artículo o una preposición no cierra la línea: se va con la que sigue.
				const arrastre: PalabraTranscrita[] = [];
				while (
					actual.length > 2 &&
					arrastre.length < 2 &&
					NO_CIERRAN.has(normalizarPalabra(actual[actual.length - 1].texto)) &&
					!COMA.test(actual[actual.length - 1].texto)
				) {
					arrastre.unshift(actual.pop() as PalabraTranscrita);
				}
				cerrar();
				actual = arrastre;
			}
		}
		actual.push(p);
	}
	cerrar();

	// Tiempos: de la primera a la última palabra, con un mínimo para leer, sin
	// pisar al siguiente y cerrando los huecos chicos (si no, parpadea).
	const subtitulos: CaptionChunk[] = [];
	const textos = grupos.map((g) => g.map((p) => p.texto.trim()).join(" "));
	for (let i = 0; i < grupos.length; i++) {
		const g = grupos[i];
		const texto = textos[i];
		if (!texto || ALUCINACIONES.some((re) => re.test(texto))) continue;
		// La misma línea tres veces seguidas es un bucle de Whisper, no alguien
		// que repite: queda la primera.
		if (i >= 2 && texto === textos[i - 1] && texto === textos[i - 2]) continue;

		const inicio = Math.max(0, g[0].inicio);
		let fin = Math.max(inicio, g[g.length - 1].fin);
		const siguiente = grupos[i + 1]?.[0]?.inicio ?? Number.POSITIVE_INFINITY;
		if (fin - inicio < MIN_CAPTION_DURATION_SECONDS) {
			fin = Math.min(inicio + MIN_CAPTION_DURATION_SECONDS, siguiente);
		}
		if (siguiente - fin < HUECO_MINIMO_S) fin = Math.min(siguiente, Math.max(fin, siguiente));
		fin = Math.min(fin, siguiente);
		if (fin - inicio < 0.05) fin = inicio + 0.05;
		subtitulos.push({ text: texto, startTime: inicio, duration: fin - inicio });
	}

	// Por las dudas (palabras desordenadas en el borde de un trozo): ningún
	// subtítulo empieza antes de que termine el anterior.
	for (let i = 1; i < subtitulos.length; i++) {
		const prev = subtitulos[i - 1];
		const finPrev = prev.startTime + prev.duration;
		if (subtitulos[i].startTime < finPrev) {
			const fin = subtitulos[i].startTime + subtitulos[i].duration;
			subtitulos[i].startTime = finPrev;
			subtitulos[i].duration = Math.max(0.05, fin - finPrev);
		}
	}
	return subtitulos;
}

/**
 * «Agregar subtítulos» a mano: el texto se divide en subtítulos solo (por
 * oraciones y por largo), uno detrás del otro desde `inicio`, con el tiempo que
 * lleva leerlos (~15 caracteres por segundo, mínimo 1 s).
 */
export function dividirTextoEnSubtitulos({
	texto,
	inicio,
	maxCaracteres,
}: {
	texto: string;
	inicio: number;
	maxCaracteres: number;
}): CaptionChunk[] {
	const CPS = 15;
	let t = inicio;
	const palabras: PalabraTranscrita[] = [];
	// Un renglón en blanco o un salto de línea también corta: se lo marca como
	// fin de oración con una pausa artificial.
	for (const linea of texto.split(/\n+/)) {
		const ws = linea.trim().split(/\s+/).filter(Boolean);
		for (const w of ws) {
			const d = Math.max(0.15, (w.length + 1) / CPS);
			palabras.push({ texto: w, inicio: t, fin: t + d });
			t += d;
		}
		t += PAUSA_CORTE_S;
	}
	// Los cortes salen de armarSubtitulos; los tiempos se rehacen pegados uno
	// detrás del otro (la pausa de arriba sólo estaba para forzar el corte).
	let desde = inicio;
	return armarSubtitulos({ palabras, maxCaracteres, maxDuracion: 6 }).map((c) => {
		const duration = Math.max(1, c.text.length / CPS);
		const sub = { text: c.text, startTime: desde, duration };
		desde += duration;
		return sub;
	});
}
