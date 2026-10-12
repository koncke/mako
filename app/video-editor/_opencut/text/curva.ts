// =============================================================================
// «Curva» (Texto › Básico › Fuerza): dónde va cada letra sobre el arco
// =============================================================================
// Puro (sin canvas): el ancho de cada letra lo da quien llama. Lo usan la
// medida del texto (text/measure-element.ts, que guarda las posiciones y saca
// de ahí el recuadro de selección) y el dibujo (./dibujar.ts, que pone cada
// letra girada en su lugar). Se prueba sin navegador
// (tests/video-editor-animaciones.test.ts).
//
// La geometría, como la de CapCut:
//   · Fuerza 100 abre el renglón más ancho en `ARCO_MAXIMO` (casi un círculo);
//     positivo es un arco hacia arriba (centro DEBAJO del texto), negativo
//     hacia abajo (centro encima).
//   · Los renglones son CONCÉNTRICOS: comparten el centro, y el radio de cada
//     uno es el del centro del bloque más (o menos) su distancia. Así un párrafo
//     curvado se lee como un párrafo y no como renglones que se cruzan.
//   · La alineación se respeta sobre el arco: centrado reparte el renglón a los
//     dos lados de la vertical; a la izquierda, todos arrancan en el mismo ángulo.
//
// Se parte en GRAFEMAS (Intl.Segmenter), no en letras sueltas: un emoji
// compuesto (una familia, una bandera) o una letra con tilde combinante,
// girados por partes, se desarman.

import type { TextAlign } from "./primitives";

export type LetraEnArco = {
	letra: string;
	/** Centro de la letra, relativo al ancla del texto (px del lienzo). */
	x: number;
	y: number;
	/** Radianes, en el sentido de canvas. */
	giro: number;
	ancho: number;
	/** Code points de esta letra (para cortar con la «Máquina de escribir»). */
	puntos: number;
};

/** Fuerza 100: el renglón más ancho ocupa 300° (no se cierra en círculo). */
export const ARCO_MAXIMO = (5 * Math.PI) / 3;

let segmentador: Intl.Segmenter | null | undefined;

export function grafemas(texto: string): string[] {
	if (segmentador === undefined) {
		segmentador =
			typeof Intl !== "undefined" && "Segmenter" in Intl
				? new Intl.Segmenter(undefined, { granularity: "grapheme" })
				: null;
	}
	if (!segmentador) return Array.from(texto);
	return Array.from(segmentador.segment(texto), (s) => s.segment);
}

export function letrasEnArco({
	lineas,
	ys,
	alineacion,
	fuerza,
	espaciado,
	anchoLetra,
}: {
	/** Los renglones enteros (con May./min. ya aplicado). */
	lineas: readonly string[];
	/** La y de cada renglón relativa al ancla (la misma que usa el dibujo recto). */
	ys: readonly number[];
	alineacion: TextAlign;
	/** −100…100. */
	fuerza: number;
	/** Espaciado entre caracteres, px. */
	espaciado: number;
	anchoLetra: (letra: string) => number;
}): LetraEnArco[][] | null {
	const theta = (Math.min(100, Math.abs(fuerza)) / 100) * ARCO_MAXIMO;
	if (theta < 1e-4) return null;

	const renglones = lineas.map((linea) => {
		const letras = grafemas(linea);
		const anchos = letras.map((l) => Math.max(0, anchoLetra(l)));
		const largo = anchos.reduce((a, b) => a + b, 0) + espaciado * Math.max(0, letras.length - 1);
		return { letras, anchos, largo: Math.max(0, largo) };
	});
	const anchoBloque = Math.max(0, ...renglones.map((r) => r.largo));
	if (anchoBloque <= 0) return null;

	const s = fuerza > 0 ? 1 : -1;
	const radioBase = anchoBloque / theta;
	// El centro del arco: en x, el del bloque según la alineación (el ancla es el
	// borde izquierdo con «izquierda», el derecho con «derecha»); en y, a un radio
	// del centro del bloque, debajo (arco hacia arriba) o encima.
	const cx = alineacion === "left" ? anchoBloque / 2 : alineacion === "right" ? -anchoBloque / 2 : 0;
	const cy = s * radioBase;
	const radioMinimo = Math.max(1, anchoBloque * 0.02);

	return renglones.map(({ letras, anchos, largo }, i) => {
		const radio = Math.max(radioMinimo, radioBase - s * (ys[i] ?? 0));
		const alfa = largo / radio;
		const inicio = alineacion === "left" ? -theta / 2 : alineacion === "right" ? theta / 2 - alfa : -alfa / 2;
		let recorrido = 0;
		return letras.map((letra, k) => {
			const ancho = anchos[k];
			const phi = inicio + (recorrido + ancho / 2) / radio;
			recorrido += ancho + espaciado;
			return {
				letra,
				x: cx + radio * Math.sin(phi),
				y: cy - s * radio * Math.cos(phi),
				giro: s * phi,
				ancho,
				puntos: Array.from(letra).length,
			};
		});
	});
}

/**
 * El recuadro que encierra las letras curvadas (para la selección en el
 * reproductor). Cada letra cuenta como un círculo de su media diagonal: girada
 * no sale de ahí, y sobra poco.
 */
export function recuadroArco(
	arco: readonly (readonly LetraEnArco[])[],
	altoLinea: number,
): { left: number; top: number; width: number; height: number } | null {
	let izq = Infinity;
	let arr = Infinity;
	let der = -Infinity;
	let aba = -Infinity;
	for (const renglon of arco) {
		for (const l of renglon) {
			const r = Math.hypot(l.ancho / 2, altoLinea / 2);
			izq = Math.min(izq, l.x - r);
			der = Math.max(der, l.x + r);
			arr = Math.min(arr, l.y - r);
			aba = Math.max(aba, l.y + r);
		}
	}
	if (!Number.isFinite(izq)) return null;
	return { left: izq, top: arr, width: der - izq, height: aba - arr };
}

/**
 * Las letras de un renglón que se ven cuando la «Máquina de escribir» mostró
 * `puntosVisibles` code points (lo que devuelve `lineasReveladas`).
 */
export function letrasVisibles(renglon: readonly LetraEnArco[], puntosVisibles: number): LetraEnArco[] {
	const salida: LetraEnArco[] = [];
	let usados = 0;
	for (const l of renglon) {
		if (usados + l.puntos > puntosVisibles) break;
		usados += l.puntos;
		salida.push(l);
	}
	return salida;
}
