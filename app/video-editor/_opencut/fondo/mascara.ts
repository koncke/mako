// =============================================================================
// La máscara de «Eliminación automática»: de la confianza del modelo al alfa
// =============================================================================
// Funciones puras (sin DOM ni MediaPipe) para poder probarlas en node:
//
//   · `tamanoSegmentacion`: a qué tamaño se segmenta. El modelo selfie mira
//     256×256 por dentro, así que mandarle el cuadro de 1080p sólo encarece la
//     subida y la lectura de la máscara: se segmenta con el lado largo en 512
//     (los dos lados quedan cerca de los 256 del modelo en un 16:9) y la máscara
//     se escala al tamaño del cuadro con interpolación bilineal.
//   · `mascaraPersona`: la confianza (0–1) → alfa 0–255, con una rampa suave
//     (los bordes del modelo ya son blandos: un umbral duro los deja serruchados)
//     y un desenfoque de caja de 3×3 con los bordes REPETIDOS. ⚠️ No con el
//     `filter: blur()` del canvas: ése toma como transparente lo que queda fuera
//     del cuadro, y una persona cortada por el borde (el torso abajo de todo)
//     salía desvanecida contra ese borde.

/** El lado largo de la imagen que se le pasa al modelo. */
export const LADO_SEGMENTACION = 512;

/** La rampa: debajo de BAJO es fondo, arriba de ALTO es persona. */
export const RAMPA_BAJO = 0.3;
export const RAMPA_ALTO = 0.7;

export function tamanoSegmentacion(ancho: number, alto: number): { ancho: number; alto: number } {
	const lado = Math.max(ancho, alto);
	if (!(lado > 0)) return { ancho: 1, alto: 1 };
	// Nunca se agranda: una imagen chica se segmenta a su tamaño.
	const escala = Math.min(1, LADO_SEGMENTACION / lado);
	return {
		ancho: Math.max(1, Math.round(ancho * escala)),
		alto: Math.max(1, Math.round(alto * escala)),
	};
}

function rampa(x: number): number {
	const t = Math.min(1, Math.max(0, (x - RAMPA_BAJO) / (RAMPA_ALTO - RAMPA_BAJO)));
	return t * t * (3 - 2 * t);
}

/**
 * Escribe en `rgba` (los datos de un ImageData de `ancho`×`alto`) blanco con el
 * alfa de PERSONA. `confianza` es la máscara del modelo; `esDeFondo` dice si esa
 * máscara mide el FONDO (MediaPipe documenta el selfie con dos categorías,
 * fondo en el índice 0 y persona en el 1; si sólo llega una, es la del rótulo
 * «selfie» del modelo, o sea la persona). `tmp` es un búfer de trabajo del mismo
 * tamaño, para no crear uno por cuadro.
 */
export function mascaraPersona({
	confianza,
	esDeFondo,
	ancho,
	alto,
	rgba,
	tmp,
}: {
	confianza: ArrayLike<number>;
	esDeFondo: boolean;
	ancho: number;
	alto: number;
	rgba: Uint8ClampedArray;
	tmp: Float32Array;
}): void {
	const n = ancho * alto;
	// 1. Rampa, y la pasada horizontal del desenfoque a `tmp`.
	for (let y = 0; y < alto; y++) {
		const fila = y * ancho;
		let previo = valor(confianza[fila], esDeFondo);
		let actual = previo;
		for (let x = 0; x < ancho; x++) {
			const siguiente = x + 1 < ancho ? valor(confianza[fila + x + 1], esDeFondo) : actual;
			tmp[fila + x] = (previo + actual + siguiente) / 3;
			previo = actual;
			actual = siguiente;
		}
	}
	// 2. Pasada vertical, directo al alfa.
	for (let i = 0; i < n; i++) {
		const arriba = i >= ancho ? tmp[i - ancho] : tmp[i];
		const abajo = i + ancho < n ? tmp[i + ancho] : tmp[i];
		const a = (arriba + tmp[i] + abajo) / 3;
		const j = i * 4;
		rgba[j] = 255;
		rgba[j + 1] = 255;
		rgba[j + 2] = 255;
		rgba[j + 3] = Math.round(a * 255);
	}
}

function valor(c: number, esDeFondo: boolean): number {
	const v = Number.isFinite(c) ? c : 0;
	return rampa(esDeFondo ? 1 - v : v);
}
