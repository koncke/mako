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
	ANIMS_PALABRA,
	DEFAULTS_CLAVES,
	DEFAULTS_RESALTADO,
	PARAM_ANIM_PALABRA,
	PARAM_CLAVES_COLOR,
	PARAM_CLAVES_TAMANO,
	PARAM_NO_DICHAS_OPACIDAD,
	PARAM_RESALTAR,
	PARAM_RESALTAR_COLOR,
	TOPES_CLAVES_TAMANO,
	type AnimPalabra,
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
	/** «Animación de la palabra» (params/extra/subtitulos.ts): cómo se mueve la que se está diciendo. */
	anim: AnimPalabra;
	/** El tamaño de la que se está diciendo en ESTE instante (1 = igual), de la tabla de la animación: cuantizado. */
	escalaActual: number;
	/** Cuánto más abajo va la que se está diciendo, en veces el tamaño de la letra (el «de abajo hacia arriba»). */
	subidaActual: number;
	/** El tamaño de las palabras clave (1 = igual; «Tamaño de las palabras clave» / 100). */
	clavesEscala: number;
};

// ── La animación de la palabra (Submagic, estilo Hormozi) ────────────────────
// Submagic no publica sus números (docs/editor-video/relevo-submagic.md: «resaltan, rebotan y se desvanecen
// palabra por palabra» y, para el Hormozi nuevo, «pop-in de abajo hacia arriba»). Éstos son NUESTROS, elegidos para
// leerse a 30 fps: la palabra entra un poco más chica y más abajo, se pasa y se asienta apenas más grande mientras se
// dice. ⚠️ Es una TABLA y no una curva continua: el resultado cambia sólo al pasar de un renglón al siguiente (cuatro
// veces por palabra), así la textura del texto no se vuelve a dibujar en cada cuadro (ver CUANTIZADO arriba).

export const CURVA_POP: ReadonlyArray<{ ms: number; escala: number; subida: number }> = [
	{ ms: 0, escala: 0.82, subida: 0.18 },
	{ ms: 40, escala: 1.02, subida: 0.06 },
	{ ms: 80, escala: 1.16, subida: 0 },
	{ ms: 130, escala: 1.1, subida: 0 },
];

/** «Crece»: la que se dice queda así de grande, sin moverse. */
export const ESCALA_CRECER = 1.15;

/** La forma de la palabra que se dice, `ms` después de empezar a decirse. */
export function formaDeAnim(anim: AnimPalabra, ms: number): { escala: number; subida: number } {
	if (anim === "crecer") return { escala: ESCALA_CRECER, subida: 0 };
	if (anim !== "pop") return { escala: 1, subida: 0 };
	let paso = CURVA_POP[0];
	for (const p of CURVA_POP) if (ms >= p.ms) paso = p;
	return { escala: paso.escala, subida: paso.subida };
}

function leerAnim(v: unknown): AnimPalabra {
	return ANIMS_PALABRA.includes(v as AnimPalabra) ? (v as AnimPalabra) : "ninguna";
}

function leerClavesEscala(v: unknown): number {
	if (typeof v !== "number" || !Number.isFinite(v)) return DEFAULTS_CLAVES.tamano / 100;
	return Math.min(TOPES_CLAVES_TAMANO.max, Math.max(TOPES_CLAVES_TAMANO.min, v)) / 100;
}

/**
 * El tamaño más grande que puede llegar a tener `palabra` (la animación en su pico, una clave con su tamaño). El
 * renglón le reserva ese lugar (./measure-element.ts → `reservas`, ./dibujar.ts → armarPiezas): sin la reserva, la
 * palabra agrandada se comía el espacio y tapaba a las vecinas («HOYDINEROYA», revisión del 10/11/2026). La reserva
 * es la del pico y no la del instante: así el renglón no baila cuando una palabra crece.
 */
export function escalaMaximaDePalabra(r: ResaltadoTexto, palabra: number): number {
	const anim = r.anim === "pop" ? Math.max(...CURVA_POP.map((p) => p.escala)) : r.anim === "crecer" ? ESCALA_CRECER : 1;
	return Math.max(anim, r.claves.includes(palabra) ? r.clavesEscala : 1);
}

/**
 * Lo que se le reserva a cada renglón: Σ (escala máxima − 1) × ancho de cada palabra, medido con `anchoDe` (el
 * `measureText` con la fuente y el interletrado del texto). Puro: lo usan la medición y el test.
 */
export function reservasDeRenglones(r: ResaltadoTexto, renglones: readonly string[], anchoDe: (texto: string) => number): number[] {
	const primeras = primerasPalabras(renglones);
	return renglones.map((renglon, i) => {
		let total = 0;
		for (const p of palabrasDeRenglon(renglon, primeras[i] ?? 0)) {
			const m = escalaMaximaDePalabra(r, p.palabra);
			if (m > 1) total += (m - 1) * anchoDe(p.texto);
		}
		return total;
	});
}

/**
 * Dónde va cada palabra de un renglón recto: donde caería en el renglón entero (el ancho de lo que la precede,
 * medido como «hasta el fin de la palabra − la palabra», así da igual si el navegador cuenta el espaciado de la
 * última letra) más las reservas de las de antes, y centrada en la suya. `x0` es el inicio del renglón CON su reserva.
 * Puro (el dibujo pasa el `measureText` del lienzo): lo usa ./dibujar.ts → armarPiezas y lo prueba el test.
 */
export function ubicarPalabras({
	renglon,
	primera,
	x0,
	anchoDe,
	escalaMax,
}: {
	renglon: string;
	primera: number;
	x0: number;
	anchoDe: (texto: string) => number;
	/** La escala máxima de cada palabra; sin ella, sin reserva. */
	escalaMax?: (palabra: number) => number;
}): Array<{ texto: string; palabra: number; x: number; ancho: number }> {
	const salida: Array<{ texto: string; palabra: number; x: number; ancho: number }> = [];
	let corrido = 0;
	for (const p of palabrasDeRenglon(renglon, primera)) {
		const ancho = anchoDe(p.texto);
		const antes = p.desde === 0 ? 0 : anchoDe(renglon.slice(0, p.desde + p.texto.length)) - ancho;
		const reserva = escalaMax ? Math.max(0, escalaMax(p.palabra) - 1) * ancho : 0;
		salida.push({ texto: p.texto, palabra: p.palabra, x: x0 + antes + corrido + reserva / 2, ancho });
		corrido += reserva;
	}
	return salida;
}

/**
 * La forma con que se dibuja la palabra `palabra`: la que se dice, con su animación; una clave, con su tamaño (si es
 * la que se dice, gana la más grande); las demás, como siempre. `subida` va en veces el tamaño de la letra.
 */
export function formaDePalabra(r: ResaltadoTexto, palabra: number): { escala: number; subida: number } {
	const clave = r.claves.includes(palabra) ? r.clavesEscala : 1;
	if (palabra === r.actual && r.anim !== "ninguna") return { escala: Math.max(r.escalaActual, clave), subida: r.subidaActual };
	return { escala: clave, subida: 0 };
}

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
	const clavesEscala = leerClavesEscala(params[PARAM_CLAVES_TAMANO]);
	const crudo = params[PARAM_RESALTAR];
	const modo = crudo === "palabra" || crudo === "frase" ? crudo : null;
	// La animación de la palabra también necesita saber cuál se dice, aunque no la pinte de otro color.
	const anim = leerAnim(params[PARAM_ANIM_PALABRA]);
	const inicios = modo || anim !== "ninguna" ? iniciosDePalabras(contenido, params[PARAM_PALABRAS]) : null;
	if (!inicios || inicios.length === 0) {
		if (claves.length === 0) return null;
		// Sólo las claves: todo cuenta como dicho (nada se atenúa) y ninguna es «la que se dice».
		const total = palabrasDelTexto(contenido).length;
		return {
			modo: "ninguno",
			actual: -1,
			dichas: total,
			color: DEFAULTS_RESALTADO.color,
			noDichas: 1,
			claves,
			claveColor,
			anim: "ninguna",
			escalaActual: 1,
			subidaActual: 0,
			clavesEscala,
		};
	}

	// Cuántas ya empezaron: se cuentan en ORDEN y se corta en la primera que falta,
	// así lo dicho es siempre un comienzo del texto (Whisper las da en orden).
	const t = tiempo + recorteInicio + MARGEN_S;
	let dichas = 0;
	while (dichas < inicios.length && inicios[dichas] <= t) dichas++;
	const actual = dichas - 1;
	const forma = actual >= 0 ? formaDeAnim(anim, (t - inicios[actual]) * 1000) : { escala: 1, subida: 0 };

	const color = params[PARAM_RESALTAR_COLOR];
	const opacidad = params[PARAM_NO_DICHAS_OPACIDAD];
	return {
		modo: modo ?? "ninguno",
		actual,
		// Sin karaoke (sólo la animación), nada se atenúa: todo cuenta como dicho.
		dichas: modo ? dichas : palabrasDelTexto(contenido).length,
		color: typeof color === "string" && color ? color : DEFAULTS_RESALTADO.color,
		noDichas: !modo
			? 1
			: typeof opacidad === "number" && Number.isFinite(opacidad)
				? Math.min(1, Math.max(0, opacidad / 100))
				: DEFAULTS_RESALTADO.noDichasOpacidad / 100,
		claves,
		claveColor,
		anim,
		escalaActual: forma.escala,
		subidaActual: forma.subida,
		clavesEscala,
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

// ── La palabra clave GIGANTE: el renglón reserva alto (13/11/2026) ────────────────────────────────────────────────────
// «La palabra clave gigante» (lib/video-recetas.ts) pide la palabra fuerte 3 o 4 veces más grande. La clave se agranda
// desde su centro (./dibujar.ts → recorrerPiezas), y cada renglón iba a una altura FIJA (`i × lineHeightPx`): a 3× en un
// subtítulo de dos renglones tapaba al otro (por eso el tope era 160 %). Ahora, por encima de `UMBRAL_ALTO_CLAVE`, el renglón
// con una clave grande reserva su alto: el bloque crece y los renglones se separan. Hasta 160 % no cambia nada de lo de antes.

/** Hasta esta escala la clave entra en el interlineado de siempre (lo que ya estaba no se mueve). */
export const UMBRAL_ALTO_CLAVE = 1.6;

/** La escala de la clave más grande de cada renglón (1 si no tiene). Sólo las claves: la animación de la palabra es corta. */
export function escalaDeRenglones(r: ResaltadoTexto, renglones: readonly string[]): number[] {
	const primeras = primerasPalabras(renglones);
	return renglones.map((renglon, i) => {
		let max = 1;
		for (const p of palabrasDeRenglon(renglon, primeras[i] ?? 0)) if (r.claves.includes(p.palabra)) max = Math.max(max, r.clavesEscala);
		return max;
	});
}

/**
 * Dónde va el centro de cada renglón (desde el centro del bloque) y el alto del bloque, si algún renglón tiene una clave más
 * grande que `UMBRAL_ALTO_CLAVE`; null si no (todo queda como siempre: `i × lineHeightPx − offset`). Cada renglón mide su
 * interlineado más lo que crece su clave (`(escala − 1) × fontPx`), repartido arriba y abajo.
 */
export function centrosDeRenglones(escalas: readonly number[], lineHeightPx: number, fontPx: number): { ys: number[]; alto: number } | null {
	if (!escalas.some((e) => e > UMBRAL_ALTO_CLAVE)) return null;
	const altos = escalas.map((e) => lineHeightPx + Math.max(0, e - 1) * fontPx);
	const alto = altos.reduce((a, b) => a + b, 0);
	const ys: number[] = [];
	let arriba = -alto / 2;
	for (const h of altos) {
		ys.push(arriba + h / 2);
		arriba += h;
	}
	return { ys, alto };
}
