// =============================================================================
// Los tiempos POR PALABRA de un subtítulo: guardarlos, leerlos y no perderlos
// =============================================================================
// Whisper devuelve cada palabra con su tiempo (services/transcription/worker.ts) y
// hasta el 15/10/2026 el editor los TIRABA: `armarSubtitulos` armaba cada subtítulo
// con su texto, su inicio y su duración, y nada más. Sin ellos no hay dividir un
// subtítulo donde cae la palabra, ni resaltar palabras, ni sacar muletillas del video,
// ni editar por la transcripción. Acá viven, puros (sin DOM ni motor) y con test
// (tests/video-editor-subtitulos-palabras.test.ts).
//
// DÓNDE: en el parámetro `subtitulo.palabras` del texto (un string JSON: los params
// sólo aceptan número, texto o booleano). NO se declara en params/extra: no es un
// control, y así «Pegar atributos» no lo lleva a otro texto.
//
// CONTRA QUÉ: los tiempos van relativos al ORIGEN DEL RECORTE del elemento
// (`startTime − trimStart`), no a su inicio. «Dividir» corre el `trimStart` de la mitad
// derecha (SplitElementsCommand), así que con ese origen las palabras de las dos
// mitades siguen cayendo donde se dijeron; y mover el subtítulo las mueve con él.
//
// CUÁNDO VALEN: sólo si siguen diciendo lo que dice el texto. Si alguien reescribió el
// subtítulo, las palabras guardadas ya no son las suyas: `palabrasDe` las da por
// vencidas (null) en vez de devolver tiempos de otro texto. Corregir una palabra sin
// cambiar cuántas son las conserva (`rehacerPalabras`).
// =============================================================================

import type { PrecisionTiempos } from "@/app/video-editor/_opencut/transcription/types";

export const PARAM_PALABRAS = "subtitulo.palabras";

/** Una palabra del subtítulo, en segundos de la línea de tiempo. */
export type PalabraSubtitulo = {
	texto: string;
	inicio: number;
	fin: number;
	/** Una muletilla que se sacó del TEXTO pero se guardó para poder sacarla del video. */
	muletilla?: boolean;
};

export type PalabrasGuardadas = { precision: PrecisionTiempos; palabras: PalabraSubtitulo[] };

type Codificada = { v: 1; p: PrecisionTiempos; w: Array<[number, number, string] | [number, number, string, 1]> };

/** A la centésima: más no cambia nada en un subtítulo y engorda el proyecto. */
const cs = (s: number) => Math.round(s * 100) / 100;

/** Lo que el texto dice, palabra por palabra (los saltos de línea de `partirYUbicar` no cuentan). */
export function tokens(texto: string): string[] {
	return texto.split(/\s+/).filter(Boolean);
}

/**
 * Las palabras como van en el parámetro. `origen` es el origen del recorte del
 * elemento en segundos (`startTime − trimStart`; un subtítulo nuevo tiene trimStart 0).
 */
export function codificarPalabras({
	palabras,
	origen,
	precision,
}: {
	palabras: readonly PalabraSubtitulo[];
	origen: number;
	precision: PrecisionTiempos;
}): string {
	const c: Codificada = {
		v: 1,
		p: precision,
		w: palabras.map((p) =>
			p.muletilla
				? [cs(p.inicio - origen), cs(p.fin - origen), p.texto, 1]
				: [cs(p.inicio - origen), cs(p.fin - origen), p.texto],
		),
	};
	return JSON.stringify(c);
}

/** Las palabras guardadas en un parámetro, en segundos relativos al origen; null si no hay o no se pueden leer. */
export function leerCodificadas(valor: unknown): PalabrasGuardadas | null {
	if (typeof valor !== "string" || !valor) return null;
	let c: unknown;
	try {
		c = JSON.parse(valor);
	} catch {
		return null;
	}
	if (!c || typeof c !== "object") return null;
	const { v, p, w } = c as Partial<Codificada>;
	if (v !== 1 || (p !== "palabra" && p !== "segmento") || !Array.isArray(w)) return null;
	const palabras: PalabraSubtitulo[] = [];
	for (const x of w) {
		if (!Array.isArray(x) || typeof x[0] !== "number" || typeof x[1] !== "number" || typeof x[2] !== "string") return null;
		palabras.push({ inicio: x[0], fin: x[1], texto: x[2], ...(x[3] === 1 ? { muletilla: true } : {}) });
	}
	return { precision: p, palabras };
}

/**
 * ¿El texto sigue diciendo lo que dicen las palabras? Las dichas (sin las muletillas,
 * que no están en el texto) tienen que coincidir una a una con `tokens(contenido)`.
 * Es LA regla de cuándo valen: la usan `palabrasDe` y el resaltado (text/resaltado.ts).
 */
export function coincidenConTexto(palabras: readonly PalabraSubtitulo[], contenido: string): boolean {
	const habladas = palabras.filter((p) => !p.muletilla);
	const dice = tokens(contenido);
	return habladas.length === dice.length && habladas.every((p, i) => p.texto === dice[i]);
}

/**
 * Las palabras de un subtítulo, en segundos de la LÍNEA DE TIEMPO, sólo las que caen en
 * lo que se ve del elemento. Null si no tiene, o si el texto ya no dice lo que dicen
 * las palabras (alguien lo reescribió): tiempos de otro texto son peores que ninguno.
 */
export function palabrasDe({
	contenido,
	param,
	inicio,
	recorteInicio,
	duracion,
}: {
	contenido: string;
	param: unknown;
	/** startTime del elemento, en segundos. */
	inicio: number;
	/** trimStart del elemento, en segundos. */
	recorteInicio: number;
	duracion: number;
}): PalabrasGuardadas | null {
	const g = leerCodificadas(param);
	if (!g || !coincidenConTexto(g.palabras, contenido)) return null;
	const origen = inicio - recorteInicio;
	const fin = inicio + duracion;
	const palabras = g.palabras
		.map((p) => ({ ...p, inicio: cs(p.inicio + origen), fin: cs(p.fin + origen) }))
		// Lo que quedó del otro lado de un corte no es de esta mitad.
		.filter((p) => p.fin > inicio + 0.005 && p.inicio < fin - 0.005);
	return { precision: g.precision, palabras };
}

/**
 * Al corregir el texto a mano: si sigue teniendo las mismas palabras (una corrección de
 * ortografía, una mayúscula), los tiempos siguen valiendo y se le ponen los textos
 * nuevos. Si cambió cuántas son, no hay forma honesta de saber qué tiempo es de cuál:
 * null, y el subtítulo se queda sin palabras.
 */
export function rehacerPalabras(g: PalabrasGuardadas, contenidoNuevo: string): PalabrasGuardadas | null {
	const dice = tokens(contenidoNuevo);
	const habladas = g.palabras.filter((p) => !p.muletilla);
	if (habladas.length !== dice.length) return null;
	let k = 0;
	return {
		precision: g.precision,
		palabras: g.palabras.map((p) => (p.muletilla ? p : { ...p, texto: dice[k++] })),
	};
}

// ─────────────────────────────────────────────────────────────────────────────
// Dividir y combinar (los atajos del panel de subtítulos de CapCut)
// ─────────────────────────────────────────────────────────────────────────────

/** Lo más corto que puede quedar cada mitad, en segundos (CapCut avisa «No se puede dividir aquí»). */
export const MITAD_MINIMA_S = 0.1;

export type TramoSubtitulo = { texto: string; inicio: number; fin: number; palabras: PalabrasGuardadas | null };

/**
 * Dividir un subtítulo donde está el cursor («Dividir un subtítulo: Enter»). Con
 * palabras, el corte cae donde empieza la primera palabra de la derecha; sin ellas, se
 * reparte el tiempo por largo de texto. Null si alguna mitad quedaría vacía o más corta
 * que `MITAD_MINIMA_S`.
 */
export function dividirEnCursor({
	texto,
	cursor,
	inicio,
	fin,
	palabras,
}: {
	texto: string;
	cursor: number;
	inicio: number;
	fin: number;
	palabras: PalabrasGuardadas | null;
}): { izquierda: TramoSubtitulo; derecha: TramoSubtitulo } | null {
	const textoIzq = texto.slice(0, cursor).trim();
	const textoDer = texto.slice(cursor).trim();
	if (!textoIzq || !textoDer) return null;

	const tIzq = tokens(textoIzq);
	const tDer = tokens(textoDer);
	const enMedioDeUnaPalabra = /\S$/.test(texto.slice(0, cursor)) && /^\S/.test(texto.slice(cursor));
	const habladas = palabras ? palabras.palabras.filter((p) => !p.muletilla) : [];
	const alineadas = !!palabras && habladas.length === tIzq.length + tDer.length - (enMedioDeUnaPalabra ? 1 : 0);

	let corte: number;
	let palIzq: PalabrasGuardadas | null = null;
	let palDer: PalabrasGuardadas | null = null;
	if (palabras && alineadas) {
		const k = tIzq.length - (enMedioDeUnaPalabra ? 1 : 0);
		if (enMedioDeUnaPalabra) {
			// La palabra partida reparte su tiempo por largo entre las dos mitades.
			const p = habladas[k];
			const izq = tIzq[tIzq.length - 1];
			const der = tDer[0];
			corte = p.inicio + ((p.fin - p.inicio) * izq.length) / Math.max(1, izq.length + der.length);
		} else {
			corte = habladas[k].inicio;
		}
		const izqP: PalabraSubtitulo[] = [];
		const derP: PalabraSubtitulo[] = [];
		let i = 0;
		for (const p of palabras.palabras) {
			if (p.muletilla) {
				(p.inicio < corte ? izqP : derP).push(p);
				continue;
			}
			if (i < k) izqP.push(p);
			else if (i === k && enMedioDeUnaPalabra) {
				izqP.push({ ...p, texto: tIzq[tIzq.length - 1], fin: corte });
				derP.push({ ...p, texto: tDer[0], inicio: corte });
			} else derP.push(p);
			i++;
		}
		palIzq = { precision: palabras.precision, palabras: izqP };
		palDer = { precision: palabras.precision, palabras: derP };
	} else {
		const largoIzq = textoIzq.length;
		corte = inicio + ((fin - inicio) * largoIzq) / Math.max(1, largoIzq + textoDer.length);
	}
	corte = Math.min(Math.max(corte, inicio), fin);
	if (corte - inicio < MITAD_MINIMA_S || fin - corte < MITAD_MINIMA_S) return null;
	return {
		izquierda: { texto: textoIzq, inicio, fin: corte, palabras: palIzq },
		derecha: { texto: textoDer, inicio: corte, fin, palabras: palDer },
	};
}

/**
 * Combinar dos subtítulos seguidos («Combinar hacia arriba / hacia abajo»): uno solo que
 * va del inicio del primero al fin del segundo. Las palabras se juntan sólo si los dos
 * las tienen y con la misma precisión; si no, el combinado queda sin palabras.
 */
export function combinar(a: TramoSubtitulo, b: TramoSubtitulo): TramoSubtitulo {
	const palabras =
		a.palabras && b.palabras && a.palabras.precision === b.palabras.precision
			? { precision: a.palabras.precision, palabras: [...a.palabras.palabras, ...b.palabras.palabras] }
			: null;
	return { texto: `${a.texto.trim()} ${b.texto.trim()}`.trim(), inicio: a.inicio, fin: Math.max(a.fin, b.fin), palabras };
}

// ─────────────────────────────────────────────────────────────────────────────
// Buscar y reemplazar
// ─────────────────────────────────────────────────────────────────────────────

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Reemplaza `buscar` por `reemplazo` en un texto, sin distinguir mayúsculas. Devuelve
 * el texto y cuántas veces lo cambió (0 = no aparecía).
 */
export function reemplazarEnTexto(texto: string, buscar: string, reemplazo: string): { texto: string; veces: number } {
	const b = buscar.trim();
	if (!b) return { texto, veces: 0 };
	let veces = 0;
	const nuevo = texto.replace(new RegExp(escapar(b), "gi"), () => {
		veces++;
		return reemplazo;
	});
	return { texto: nuevo, veces };
}
