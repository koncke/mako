// =============================================================================
// «Animaciones de subtítulos» de CapCut (el karaoke): qué palabra se está diciendo
// =============================================================================
// CapCut › Subtítulos › «Animaciones de subtítulos» › «Configuración»:
//   · «Subtítulos pronunciados»: «Palabra pronunciada» pinta del color SÓLO la que
//     se está diciendo; «Frase pronunciada» pinta todo lo ya dicho (el relleno se
//     acumula, como el karaoke de toda la vida).
//   · «Subtítulos no pronunciados»: lo que todavía no se dijo, con su «Opacidad».
// Los parámetros son de params/extra/subtitulos.ts; los tiempos, los de cada palabra
// que guarda el subtítulo (`subtitulo.palabras`, subtitles/palabras.ts).
//
// Puro (sin canvas ni motor): lo usan la medida del texto (./measure-element.ts,
// que lo guarda en lo medido) y el dibujo (./dibujar.ts, que pinta cada palabra con
// su color y su opacidad). Se prueba sin navegador
// (tests/video-editor-subtitulos-resaltado.test.ts).
//
// ⚠️ CUANTIZADO: el resultado sólo tiene enteros (qué palabra, cuántas dichas), el
// color y la opacidad: no cambia entre una palabra y la siguiente. Importa porque la
// textura del texto se vuelve a dibujar cuando cambia CUALQUIER cosa de lo medido
// (el hash es un JSON de todo, compositor/frame-descriptor.ts → `collectTextNode`),
// igual que el revelado (./revelado.ts). Con un tiempo o una fracción adentro, el
// subtítulo se re-dibujaría en cada cuadro.
//
// En una PAUSA entre dos palabras sigue resaltada la última que se dijo (como CapCut
// y las apps de subtítulos tipo karaoke): si se apagara en cada silencio, el resaltado
// parpadearía entre palabra y palabra.
//
// Las PALABRAS CLAVE («Resaltar palabras clave automáticamente», ../subtitles/claves.ts)
// van por el mismo camino: son índices de palabras con su color, fijos (no dependen del
// tiempo), y no necesitan tiempos por palabra. Sin karaoke y sin claves, null: el dibujo
// va por el camino de siempre.

import {
	DEFAULTS_CLAVES,
	DEFAULTS_RESALTADO,
	PARAM_CLAVES_COLOR,
	PARAM_NO_DICHAS_OPACIDAD,
	PARAM_RESALTAR,
	PARAM_RESALTAR_COLOR,
} from "@/app/video-editor/_opencut/params/extra/subtitulos";
import {
	coincidenConTexto,
	leerCodificadas,
	PARAM_PALABRAS,
} from "@/app/video-editor/_opencut/subtitles/palabras";
import { indicesDeClaves, PARAM_CLAVES, palabrasDelTexto } from "@/app/video-editor/_opencut/subtitles/claves";

export type ResaltadoTexto = {
	/**
	 * «ninguno» = sin karaoke (no hay modo, o el texto no tiene tiempos que valgan) pero
	 * con palabras clave: el dibujo pinta sólo las claves.
	 */
	modo: "palabra" | "frase" | "ninguno";
	/**
	 * La palabra que se está diciendo (o la última que se dijo, en una pausa), contada
	 * entre las palabras del TEXTO en orden (las muletillas no están en el texto y no
	 * cuentan); −1 antes de la primera.
	 */
	actual: number;
	/** Cuántas palabras ya empezaron a decirse (= `actual + 1`). */
	dichas: number;
	/** El color de lo pronunciado (hex). */
	color: string;
	/** 0–1: la opacidad de las que todavía no se dijeron (1 = sin efecto). */
	noDichas: number;
	/**
	 * «Resaltar palabras clave» (subtitles/claves.ts): qué palabras del texto (contadas en
	 * orden) van con `claveColor` todo el tiempo. Vacío = ninguna.
	 */
	claves: readonly number[];
	/** El color de las palabras clave (hex). */
	claveColor: string;
};

/**
 * Margen para dar una palabra por empezada: los tiempos se guardan a la centésima y
 * el cuadro puede caer un pelo antes por el redondeo de ticks.
 */
const MARGEN_S = 0.005;

// ── Los tiempos, leídos una vez ──────────────────────────────────────────────

/**
 * El JSON de las palabras se lee y se coteja contra el texto UNA vez por par
 * (texto, palabras): el resaltado se calcula en cada cuadro por cada texto visible.
 * Un tope para que un proyecto largo editado mucho rato no la haga crecer sin fin.
 */
const TOPE_CACHE = 512;
const cache = new Map<string, readonly number[] | null>();

/**
 * Cuándo empieza cada palabra DICHA del texto (sin las muletillas), en segundos desde
 * el origen del recorte del elemento (`startTime − trimStart`), en el orden del texto.
 * Null si no tiene tiempos por palabra o si ya no valen (el texto se reescribió).
 */
export function iniciosDePalabras(contenido: string, param: unknown): readonly number[] | null {
	if (typeof param !== "string" || !param) return null;
	const clave = `${contenido}\u0000${param}`;
	const guardado = cache.get(clave);
	if (guardado !== undefined) return guardado;
	const g = leerCodificadas(param);
	const inicios =
		g && g.palabras.length > 0 && coincidenConTexto(g.palabras, contenido)
			? g.palabras.filter((p) => !p.muletilla).map((p) => p.inicio)
			: null;
	if (cache.size >= TOPE_CACHE) {
		const vieja = cache.keys().next().value;
		if (vieja !== undefined) cache.delete(vieja);
	}
	cache.set(clave, inicios);
	return inicios;
}

/** ¿El texto tiene tiempos por palabra que valen? (el panel avisa si no). */
export function tieneTiemposPorPalabra(params: Readonly<Record<string, unknown>>): boolean {
	const inicios = iniciosDePalabras(String(params.content ?? ""), params[PARAM_PALABRAS]);
	return !!inicios && inicios.length > 0;
}

// ── En este instante ─────────────────────────────────────────────────────────

/**
 * El resaltado de un texto en un instante. `tiempo` es el tiempo LOCAL del elemento
 * (desde su `startTime`) y `recorteInicio` su `trimStart`, los dos en segundos: las
 * palabras van relativas al origen del recorte, así que la mitad derecha de un
 * «Dividir» (que corre el `trimStart`) sigue resaltando donde se dijo cada palabra.
 * Null si no hay karaoke que valga (modo «Ninguno» o sin tiempos por palabra) NI palabras clave.
 */
export function resaltadoDe({
	params,
	tiempo,
	recorteInicio,
}: {
	params: Readonly<Record<string, unknown>>;
	tiempo: number;
	recorteInicio: number;
}): ResaltadoTexto | null {
	const contenido = String(params.content ?? "");
	// Las palabras clave no necesitan tiempos: un subtítulo importado (.srt) también las lleva.
	const claves = indicesDeClaves(contenido, params[PARAM_CLAVES]);
	const colorClave = params[PARAM_CLAVES_COLOR];
	const claveColor = typeof colorClave === "string" && colorClave ? colorClave : DEFAULTS_CLAVES.color;
	const crudo = params[PARAM_RESALTAR];
	const modo = crudo === "palabra" || crudo === "frase" ? crudo : null;
	const inicios = modo ? iniciosDePalabras(contenido, params[PARAM_PALABRAS]) : null;
	if (!modo || !inicios || inicios.length === 0) {
		if (claves.length === 0) return null;
		// Sólo las claves: todo cuenta como dicho (nada se atenúa) y ninguna es «la que se dice».
		const total = palabrasDelTexto(contenido).length;
		return { modo: "ninguno", actual: -1, dichas: total, color: DEFAULTS_RESALTADO.color, noDichas: 1, claves, claveColor };
	}

	// Cuántas ya empezaron: se cuentan en ORDEN y se corta en la primera que falta,
	// así lo dicho es siempre un comienzo del texto (Whisper las da en orden).
	const t = tiempo + recorteInicio + MARGEN_S;
	let dichas = 0;
	while (dichas < inicios.length && inicios[dichas] <= t) dichas++;

	const color = params[PARAM_RESALTAR_COLOR];
	const opacidad = params[PARAM_NO_DICHAS_OPACIDAD];
	return {
		modo,
		actual: dichas - 1,
		dichas,
		color: typeof color === "string" && color ? color : DEFAULTS_RESALTADO.color,
		noDichas:
			typeof opacidad === "number" && Number.isFinite(opacidad)
				? Math.min(1, Math.max(0, opacidad / 100))
				: DEFAULTS_RESALTADO.noDichasOpacidad / 100,
		claves,
		claveColor,
	};
}

/** ¿La palabra `palabra` va con el color de lo pronunciado? */
export function vaResaltada(r: ResaltadoTexto, palabra: number): boolean {
	if (r.modo === "ninguno") return false;
	return r.modo === "palabra" ? palabra === r.actual : palabra < r.dichas;
}

/**
 * El color de una palabra: la que se dice (karaoke) gana, después la clave, y si no el
 * del texto. Así una clave se ve también mientras se dice, con el color del karaoke.
 */
export function colorDePalabra(r: ResaltadoTexto, palabra: number, colorTexto: string): string {
	if (vaResaltada(r, palabra)) return r.color;
	if (r.claves.includes(palabra)) return r.claveColor;
	return colorTexto;
}

// ── Contar las palabras sobre lo que se dibuja ───────────────────────────────
// El dibujo trabaja con los renglones ya partidos (y en mayúsculas si corresponde):
// partir y pasar a mayúsculas no cambian cuántas palabras son, así que la palabra k
// del texto es la k-ésima contada renglón por renglón.

const ESPACIO = /^\s+$/;

/** El número de la primera palabra de cada renglón (los renglones ENTEROS). */
export function primerasPalabras(renglones: readonly string[]): number[] {
	const primeras: number[] = [];
	let n = 0;
	for (const r of renglones) {
		primeras.push(n);
		n += r.split(/\s+/).filter(Boolean).length;
	}
	return primeras;
}

/**
 * Las palabras de un renglón (o de lo que se ve de él, si se está escribiendo):
 * cada una con dónde empieza en el texto (para medir el prefijo) y su número.
 */
export function palabrasDeRenglon(
	texto: string,
	primera: number,
): Array<{ texto: string; desde: number; palabra: number }> {
	const salida: Array<{ texto: string; desde: number; palabra: number }> = [];
	let k = primera;
	for (const m of texto.matchAll(/\S+/g)) {
		salida.push({ texto: m[0], desde: m.index ?? 0, palabra: k++ });
	}
	return salida;
}

/**
 * Curvado, el dibujo va letra por letra: el número de palabra de cada letra
 * (−1 para los espacios, que no tienen tinta).
 */
export function palabraDeCadaLetra(letras: readonly string[], primera: number): number[] {
	let k = primera - 1;
	let dentro = false;
	return letras.map((l) => {
		if (ESPACIO.test(l)) {
			dentro = false;
			return -1;
		}
		if (!dentro) {
			k++;
			dentro = true;
		}
		return k;
	});
}
