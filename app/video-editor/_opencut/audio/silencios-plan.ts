// =============================================================================
// «Borrar silencios»: de los tramos de la FUENTE a los cortes y los lugares del clip
// =============================================================================
// La detección (dsp/silencios.ts) contesta en segundos de la FUENTE. La línea de
// tiempo habla con otro origen: el clip empieza en `startTime`, saltea `trimStart`
// segundos de la fuente y puede ir a otra velocidad (`retime`, incluida una curva).
// Acá se traduce, y se decide dónde queda cada clip de la pista después de borrar.
// Todo puro, sin motor: lo prueba `tests/video-editor-silencios.test.ts`. El comando
// (commands/timeline/element/borrar-silencios.ts) sólo llama a esto, a Dividir y a
// Eliminar.

import type { RetimeConfig } from "@/app/video-editor/_opencut/timeline";
import { getClipTimeAtSourceTime } from "@/app/video-editor/_opencut/retime/resolve";

/** Un clip visto desde la línea, todo en SEGUNDOS. */
export type ClipEnLaLinea = {
	inicio: number;
	duracion: number;
	/** Segundos de la fuente que el clip saltea al principio. */
	trimStart: number;
	retime?: RetimeConfig;
};

export type Tramo = [number, number];

const EPS = 1e-6;

/**
 * Un silencio que llega a menos de esto de un borde del clip se estira hasta el borde:
 * el audio arranca en el paquete que toca y no justo en el recorte, así que sin esto
 * quedaría una astilla de 20-40 ms de aire como clip suelto.
 */
export const BORDE_S = 0.05;

/** Menos de esto que oír no es un clip: si eso es todo lo que queda, no se toca nada. */
export const QUEDA_MINIMA_S = 0.1;

/** ¿Queda algo que oír en el tramo de la fuente, sacando los silencios? */
export function quedaAlgo(tramosQueQuedan: readonly Tramo[]): boolean {
	return tramosQueQuedan.reduce((s, [a, b]) => s + Math.max(0, b - a), 0) > QUEDA_MINIMA_S;
}

/** Lo mismo, con los silencios ya llevados a la línea. */
export function quedaAlgoEnLaLinea(clip: ClipEnLaLinea, silenciosLinea: readonly Tramo[]): boolean {
	const cubierto = silenciosLinea.reduce((s, [a, b]) => s + Math.max(0, b - a), 0);
	return clip.duracion - cubierto > QUEDA_MINIMA_S;
}

/** Los silencios de la FUENTE llevados a la LÍNEA, recortados al clip y en orden. */
export function silenciosEnLaLinea(clip: ClipEnLaLinea, silenciosFuente: readonly Tramo[]): Tramo[] {
	const fin = clip.inicio + clip.duracion;
	const aLinea = (segundoDeFuente: number) =>
		clip.inicio +
		getClipTimeAtSourceTime({
			sourceTime: segundoDeFuente - clip.trimStart,
			retime: clip.retime,
			clipDuration: clip.duracion,
		});
	const acotar = (t: number) => Math.min(fin, Math.max(clip.inicio, t));
	const alBorde = (t: number) =>
		t - clip.inicio < BORDE_S ? clip.inicio : fin - t < BORDE_S ? fin : t;
	const out: Tramo[] = [];
	for (const [a, b] of silenciosFuente) {
		const a2 = alBorde(acotar(aLinea(a)));
		const b2 = alBorde(acotar(aLinea(b)));
		if (b2 - a2 > EPS) out.push([a2, b2]);
	}
	return out.sort((x, y) => x[0] - y[0]);
}

/** Dónde dividir: cada borde de silencio estrictamente ADENTRO del clip, sin repetir. */
export function cortesDelClip(clip: ClipEnLaLinea, silenciosLinea: readonly Tramo[]): number[] {
	const fin = clip.inicio + clip.duracion;
	const out: number[] = [];
	for (const [a, b] of silenciosLinea) {
		for (const t of [a, b]) {
			if (t <= clip.inicio + EPS || t >= fin - EPS) continue;
			if (out.some((x) => Math.abs(x - t) <= EPS)) continue;
			out.push(t);
		}
	}
	return out.sort((x, y) => x - y);
}

/** Una pieza [inicio, fin) de la línea es silencio si su punto medio cae en un silencio. */
export function esPiezaDeSilencio(
	pieza: { inicio: number; fin: number },
	silenciosLinea: readonly Tramo[],
): boolean {
	const medio = (pieza.inicio + pieza.fin) / 2;
	return silenciosLinea.some(([a, b]) => medio >= a && medio <= b);
}

/**
 * Dónde queda cada clip de la pista después de borrar. Las piezas que quedan van
 * pegadas desde donde empezaba el clip; lo que venía DESPUÉS del clip se corre lo que
 * se quitó; lo de antes, quieto. Se calcula contra las posiciones de ANTES de la
 * operación, no contra las de ahora: así da lo mismo haya corrido o no el imán de la
 * pista principal en el medio (ripple/iman.ts). Unidad: la de la entrada (ticks).
 */
export function recolocar({
	piezas,
	otros,
	inicioOriginal,
	finOriginal,
	quitado,
}: {
	/** Las piezas que quedan, en orden de la línea. */
	piezas: ReadonlyArray<{ id: string; duracion: number }>;
	/** Los demás clips de la pista, con dónde empezaban ANTES de la operación. */
	otros: ReadonlyArray<{ id: string; inicioAntes: number }>;
	inicioOriginal: number;
	finOriginal: number;
	quitado: number;
}): Map<string, number> {
	const out = new Map<string, number>();
	let cursor = inicioOriginal;
	for (const p of piezas) {
		out.set(p.id, cursor);
		cursor += p.duracion;
	}
	for (const o of otros) {
		out.set(o.id, o.inicioAntes >= finOriginal - EPS ? o.inicioAntes - quitado : o.inicioAntes);
	}
	return out;
}
