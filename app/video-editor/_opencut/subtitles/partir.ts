// =============================================================================
// subtitles/partir — un subtítulo en renglones que entran en el ancho (puro: sin motor ni `wasm`)
// =============================================================================
// Sale de ./build-subtitle-text-element.ts (13/11/2026) para probarlo en node: ahí lo usa `partirYUbicar`, con el
// `measureText` del lienzo. Las palabras clave agrandadas suman su reserva (`extra`): tests/video-editor-clave-gigante.test.ts.

/**
 * Parte cada párrafo en líneas que entran en `anchoPx` (por palabras). `ancho` mide
 * como se DIBUJA: con «May./min.» en Mayúscula, «PALABRA» es más ancha que «palabra»,
 * y medida en minúscula una línea en mayúsculas se salía por los costados.
 */
export function partirEnLineas({
	ancho,
	texto,
	anchoPx,
	extra,
}: {
	ancho: (s: string) => number;
	texto: string;
	anchoPx: number;
	/**
	 * Lo que suma una palabra además de su ancho (13/11/2026): una palabra clave agrandada ocupa (escala − 1) × su ancho
	 * (text/resaltado.ts → reservasDeRenglones, la misma cuenta del dibujo). Sin esto, una clave grande se salía del cuadro.
	 * `indice`: su número entre TODAS las palabras del texto, que es como se guardan las claves.
	 */
	extra?: (indice: number, palabra: string) => number;
}): string {
	let base = 0;
	return texto
		.replace(/\r\n/g, "\n")
		.split("\n")
		.map((parrafo) => {
			const palabras = parrafo.trim().split(/\s+/).filter(Boolean);
			const desde = base;
			base += palabras.length;
			if (palabras.length === 0) return "";
			const suma = (de: number, hasta: number) => {
				if (!extra) return 0;
				let n = 0;
				for (let k = de; k < hasta; k++) n += extra(desde + k, palabras[k]);
				return n;
			};
			const lineas: string[] = [];
			let linea = palabras[0];
			let inicio = 0;
			for (let i = 1; i < palabras.length; i++) {
				const candidata = `${linea} ${palabras[i]}`;
				if (ancho(candidata) + suma(inicio, i + 1) <= anchoPx) {
					linea = candidata;
				} else {
					lineas.push(linea);
					linea = palabras[i];
					inicio = i;
				}
			}
			lineas.push(linea);
			// «Equilibrar» pasa palabras de un renglón al otro midiendo sólo el texto: con claves agrandadas no se usa.
			return extra ? lineas.join("\n") : equilibrar({ ancho, lineas });
		})
		.join("\n");
}

/**
 * Dos líneas desparejas («Esto es lo que vas a ver en / esto») se leen peor que
 * dos parejas: si la segunda quedó con menos de un tercio, se pasa una palabra.
 */
function equilibrar({ ancho, lineas }: { ancho: (s: string) => number; lineas: string[] }): string {
	if (lineas.length !== 2) return lineas.join("\n");
	let [a, b] = lineas;
	while (ancho(b) < ancho(a) / 3) {
		const corte = a.lastIndexOf(" ");
		if (corte <= 0) break;
		const nuevaA = a.slice(0, corte);
		const nuevaB = `${a.slice(corte + 1)} ${b}`;
		if (ancho(nuevaB) > ancho(a)) break;
		a = nuevaA;
		b = nuevaB;
	}
	return `${a}\n${b}`;
}
