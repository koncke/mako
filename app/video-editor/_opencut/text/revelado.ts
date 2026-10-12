// =============================================================================
// «Máquina de escribir» y «Palabra por palabra»: qué parte del texto se ve
// =============================================================================
// Puro (sin canvas ni motor): lo usan el dibujo del texto (./dibujar.ts) y la
// vista previa de las tarjetas de Animación, y se prueba sin navegador
// (tests/video-editor-animaciones.test.ts).

import type { RevelacionTexto } from "@/app/video-editor/_opencut/animaciones/calcular";

/**
 * La misma revelación con la fracción llevada a «unidades visibles / total»:
 * da exactamente las mismas líneas, pero no cambia entre una letra y la
 * siguiente. Importa porque la textura del texto se vuelve a dibujar cuando
 * cambia CUALQUIER cosa de lo medido (el hash es un JSON de todo,
 * compositor/frame-descriptor.ts → `collectTextNode`): con la fracción cruda se
 * re-dibujaba en cada cuadro de la escritura aunque no apareciera nada nuevo.
 */
export function cuantizarRevelado(
	lineas: readonly string[],
	revelado: RevelacionTexto | null,
): RevelacionTexto | null {
	if (!revelado) return null;
	const total =
		revelado.modo === "caracter"
			? lineas.reduce((n, l) => n + Array.from(l).length, 0)
			: lineas.reduce((n, l) => n + l.split(/\s+/).filter((t) => t.length > 0).length, 0);
	if (total === 0) return revelado;
	const visibles =
		revelado.modo === "caracter"
			? Math.floor(revelado.fraccion * total + 1e-6)
			: Math.ceil(revelado.fraccion * total - 1e-6);
	return { modo: revelado.modo, fraccion: Math.max(0, Math.min(total, visibles)) / total };
}

/** Las líneas tal como se ven en este instante (cortadas si el texto se está escribiendo). */
export function lineasReveladas(lineas: readonly string[], revelado: RevelacionTexto | null): string[] {
	if (!revelado) return [...lineas];
	if (revelado.modo === "caracter") {
		const total = lineas.reduce((n, l) => n + Array.from(l).length, 0);
		let quedan = Math.floor(revelado.fraccion * total + 1e-6);
		return lineas.map((l) => {
			const letras = Array.from(l);
			const n = Math.min(letras.length, quedan);
			quedan -= n;
			return letras.slice(0, n).join("");
		});
	}
	// Por palabra: la primera aparece apenas arranca (ceil), como al dictar.
	const palabrasDe = (l: string) => l.split(/(\s+)/).filter((t) => t.length > 0);
	const total = lineas.reduce((n, l) => n + palabrasDe(l).filter((t) => !/^\s+$/.test(t)).length, 0);
	let quedan = Math.ceil(revelado.fraccion * total - 1e-6);
	return lineas.map((l) => {
		let salida = "";
		for (const token of palabrasDe(l)) {
			const esEspacio = /^\s+$/.test(token);
			if (!esEspacio) {
				if (quedan <= 0) break;
				quedan--;
			}
			salida += token;
		}
		return salida.trimEnd();
	});
}

