// =============================================================================
// Sacar TRAMOS de tiempo del video: lo que hace borrar texto en la transcripción
// =============================================================================
// «Edición basada en la transcripción» de CapCut (`pc_text_cut_*`): «Elimina texto
// para eliminar partes correspondientes de tu video» y «Los cambios en la
// transcripción se sincronizarán con los subtítulos». Y «Eliminar las muletillas»
// del video. Las dos cosas son lo mismo: quitar tramos [desde, hasta) de la línea
// de tiempo y cerrar el hueco.
//
// Puro (sin EditorCore ni React): arma la línea de tiempo NUEVA entera a partir de
// la de antes, y el comando (commands/timeline/element/cortar-tramos.ts) la aplica
// de una vez. Con test (tests/video-editor-transcripcion.test.ts).
//
// Qué le pasa a cada cosa, como en CapCut (que exige la pista principal con imán):
//   · La PISTA PRINCIPAL se corta: cada clip se divide en los bordes de los tramos
//     (con lo que reparte «Dividir»: fuente, curva, fotogramas, transición,
//     animación y fundidos; timeline/dividir-elemento.ts) y lo de adentro se va.
//   · El AUDIO EXTRAÍDO de un video (`audio.extraidoDe`) se corta igual: si no, la
//     voz quedaría corrida del video.
//   · Los SUBTÍTULOS pierden las palabras que caen en un tramo (y su texto), y las
//     que quedan se corren con el video. Uno que se queda sin palabras dichas, se
//     borra. Uno sin tiempos por palabra se corre y se acorta como un bloque.
//   · Lo demás (stickers, textos, superposiciones, efectos, música) sigue a la
//     VINCULACIÓN: si está vinculado a la pista principal se corre con ella, y si
//     atraviesa un tramo se acorta (nunca queda pisando al de al lado). Si no está
//     vinculado, queda donde estaba: la música no salta.
//   · Una pista BLOQUEADA no se toca.
//
// La cuenta de todo es una sola: `aLinea(t)` = t menos lo que se quitó antes de t.
// Un instante adentro de un tramo cae en el borde izquierdo del hueco.
// ⚠️ La IA del chat no ve nada de esto: pide frases o tramos y el editor los traduce.
// =============================================================================

import type { SceneTracks, TextElement, TimelineElement, TimelineTrack } from "@/app/video-editor/_opencut/timeline";
import type { ParamValues } from "@/app/video-editor/_opencut/params";
import type { MediaTime } from "@/app/video-editor/_opencut/wasm";
import { EXTRAIDO_DE } from "@/app/video-editor/_opencut/audio/claves";
import type { dividirElemento } from "@/app/video-editor/_opencut/timeline/dividir-elemento";
import {
	codificarPalabras,
	coincidenConTexto,
	leerCodificadas,
	PARAM_PALABRAS,
	tokens,
	type PalabraSubtitulo,
} from "@/app/video-editor/_opencut/subtitles/palabras";

/** Un tramo [desde, hasta) en TICKS de la línea de tiempo. */
export type TramoTicks = readonly [number, number];

/**
 * «Dividir» (timeline/dividir-elemento.ts). Entra como parámetro y no por import: la
 * cuenta de dividir llega al WASM del motor (los ticks), que no carga fuera del
 * navegador, y así este archivo se prueba en node con un divisor de mentira.
 */
export type Dividir = typeof dividirElemento;

/** Dos tramos más cerca que esto (en segundos) se juntan: el pedacito del medio no se oiría. */
export const JUNTAR_S = 0.06;
/** Un borde de tramo a menos de esto de un borde de clip se estira hasta él: sin astillas de clip. */
export const BORDE_CLIP_S = 0.05;
/** Lo más corto que puede quedar algo que se acorta (un subtítulo, un sticker); menos, se borra. */
export const QUEDA_MINIMO_S = 0.1;

const esSubtitulo = (el: TimelineElement): el is TextElement => el.type === "text" && el.params.subtitulo === true;

/**
 * Los tramos en orden, sin superponerse, juntando los que casi se tocan y pegando
 * sus bordes a los de los clips cercanos. `bordes` son los inicios y fines de lo
 * que se corta (ticks).
 */
export function normalizarTramos({
	tramos,
	tps,
	bordes = [],
}: {
	tramos: ReadonlyArray<TramoTicks>;
	tps: number;
	bordes?: readonly number[];
}): Array<[number, number]> {
	const eps = BORDE_CLIP_S * tps;
	const pegar = (t: number, lado: "izq" | "der") => {
		// El izquierdo sólo se corre a la izquierda y el derecho a la derecha: el tramo
		// crece hasta el borde del clip, nunca se achica.
		let mejor = t;
		for (const b of bordes) {
			if (lado === "izq" && b < t && t - b <= eps && b < mejor) mejor = b;
			if (lado === "der" && b > t && b - t <= eps && b > mejor) mejor = b;
		}
		return mejor;
	};
	const limpios = tramos
		.map(([a, b]) => [Math.max(0, Math.round(Math.min(a, b))), Math.max(0, Math.round(Math.max(a, b)))] as [number, number])
		.filter(([a, b]) => b > a)
		.map(([a, b]) => [pegar(a, "izq"), pegar(b, "der")] as [number, number])
		.sort((x, y) => x[0] - y[0]);
	const out: Array<[number, number]> = [];
	for (const t of limpios) {
		const ultimo = out[out.length - 1];
		if (ultimo && t[0] - ultimo[1] <= JUNTAR_S * tps) ultimo[1] = Math.max(ultimo[1], t[1]);
		else out.push([t[0], t[1]]);
	}
	return out;
}

/** El instante `t` (ticks) después de quitar los tramos (ya normalizados). */
export function aLinea(t: number, tramos: ReadonlyArray<TramoTicks>): number {
	let quitado = 0;
	for (const [a, b] of tramos) {
		if (t <= a) break;
		if (t < b) return a - quitado;
		quitado += b - a;
	}
	return t - quitado;
}

/** ¿El instante cae adentro de un tramo? */
const adentro = (t: number, tramos: ReadonlyArray<TramoTicks>) => tramos.some(([a, b]) => t > a && t < b);

/**
 * Corta los tramos de UN elemento: las piezas que quedan, todavía en su lugar de
 * antes. La primera pieza conserva el id del elemento (lo que lo nombra: la
 * selección, el `audio.extraidoDe` de su audio, la vinculación).
 */
export function piezasSinTramos(
	element: TimelineElement,
	tramos: ReadonlyArray<TramoTicks>,
	dividir: Dividir,
): TimelineElement[] {
	const piezas: TimelineElement[] = [];
	let resto: TimelineElement | null = element;
	for (const [a, b] of tramos) {
		if (!resto) break;
		const ini = resto.startTime as number;
		const fin = ini + (resto.duration as number);
		if (b <= ini || a >= fin) continue;
		if (a > ini && b >= fin) {
			// Se va el final: como «Borrar a la derecha», la mitad que queda conserva la
			// transición, la Salida y el fundido (siguen yendo hacia el mismo vecino).
			const p = dividir({ element: resto, splitTime: a as MediaTime, retainSide: "left" });
			if (p?.izquierda) piezas.push(p.izquierda);
			resto = null;
			break;
		}
		if (a > ini) {
			// Se va un pedazo del medio: dos mitades, como «Dividir».
			const p = dividir({ element: resto, splitTime: a as MediaTime, retainSide: "both" });
			if (p?.izquierda) piezas.push(p.izquierda);
			resto = p ? p.derecha : resto;
		}
		if (!resto) break;
		const finResto = (resto.startTime as number) + (resto.duration as number);
		if (b < finResto) {
			// Se va el principio (o lo que quedaba antes de `b`): como «Borrar a la izquierda».
			const p = dividir({ element: resto, splitTime: b as MediaTime, retainSide: "right" });
			resto = p ? p.derecha : resto;
		} else {
			resto = null;
		}
	}
	if (resto) piezas.push(resto);
	if (piezas.length > 0 && !piezas.some((p) => p.id === element.id)) piezas[0] = { ...piezas[0], id: element.id };
	return piezas;
}

export type ResultadoCorte = {
	tracks: SceneTracks;
	/** Cuánto se quitó de la línea de tiempo, en ticks. */
	quitado: number;
	subtitulosCambiados: number;
	subtitulosBorrados: number;
};

/**
 * La línea de tiempo sin los tramos. Devuelve la MISMA `tracks` si no hay nada que
 * cortar. `vinculado` dice si un elemento sigue a la pista principal (la
 * «Vinculación» de CapCut, ripple/iman.ts); `rehacerTexto` vuelve a partir las
 * líneas de un subtítulo con otro texto (sin ella, el texto va en un renglón).
 */
export function cortarTramos({
	tracks,
	tramos: crudos,
	tps,
	vinculado,
	rehacerTexto,
	dividir,
}: {
	tracks: SceneTracks;
	tramos: ReadonlyArray<TramoTicks>;
	tps: number;
	vinculado: (element: TimelineElement, track: TimelineTrack) => boolean;
	rehacerTexto?: (element: TextElement, texto: string) => ParamValues;
	dividir: Dividir;
}): ResultadoCorte {
	const sinCambios: ResultadoCorte = { tracks, quitado: 0, subtitulosCambiados: 0, subtitulosBorrados: 0 };
	if (tracks.main.locked) return sinCambios;
	// El audio extraído se corta sólo si es de un video de la PRINCIPAL: el de una superposición
	// no se corta (su video se corre en bloque), y cortarle el audio lo dejaría desfasado.
	const idsPrincipal = new Set((tracks.main.elements as TimelineElement[]).map((e) => e.id));
	const esCortable = (el: TimelineElement, principal: boolean) =>
		principal || (el.type === "audio" && idsPrincipal.has(String(el.params[EXTRAIDO_DE] ?? "")));

	const bordes: number[] = [];
	const cortables = (track: TimelineTrack, principal: boolean) =>
		track.locked ? [] : (track.elements as TimelineElement[]).filter((e) => esCortable(e, principal));
	for (const e of [...cortables(tracks.main as TimelineTrack, true), ...tracks.audio.flatMap((t) => cortables(t as TimelineTrack, false))]) {
		bordes.push(e.startTime as number, (e.startTime as number) + (e.duration as number));
	}
	const tramos = normalizarTramos({ tramos: crudos, tps, bordes });
	if (tramos.length === 0) return sinCambios;
	const f = (t: number) => aLinea(t, tramos);
	const minimo = QUEDA_MINIMO_S * tps;
	let subtitulosCambiados = 0;
	let subtitulosBorrados = 0;

	/** De qué clip de la principal salió cada pieza (para volver a emparejar el audio extraído). */
	const origenDe = new Map<string, string>();
	/** Lo que se corta: dividido, sin lo de adentro y corrido. */
	const cortar = (el: TimelineElement, principal: boolean): TimelineElement[] =>
		piezasSinTramos(el, tramos, dividir).map((p) => {
			if (principal) origenDe.set(p.id, el.id);
			const ini2 = f(p.startTime as number);
			return p === el && ini2 === el.startTime ? el : { ...p, startTime: ini2 as MediaTime };
		});

	/** Lo que sigue a la principal: corrido y, si atraviesa un tramo, acortado. Null = se va. */
	const correr = (el: TimelineElement): TimelineElement | null => {
		const ini = el.startTime as number;
		const fin = ini + (el.duration as number);
		const ini2 = f(ini);
		const largo = f(fin) - ini2;
		if (largo === el.duration) return ini2 === ini ? el : { ...el, startTime: ini2 as MediaTime };
		if (largo < minimo) return null;
		const izq = dividir({ element: el, splitTime: (ini + largo) as MediaTime, retainSide: "left" })?.izquierda;
		return izq ? { ...izq, startTime: ini2 as MediaTime } : null;
	};

	/**
	 * Un subtítulo: sin las palabras que caen en un tramo, y corrido. Null = se va.
	 *
	 * Se miran TODAS sus palabras, no sólo las que se ven: un subtítulo partido con
	 * «Dividir» (o recortado) guarda el texto entero, y sus palabras sólo valen si siguen
	 * diciendo ese texto (`coincidenConTexto`). Re-guardar sólo las visibles las anulaba.
	 * Cada palabra pasa por la misma cuenta (`aLinea`), con el `trimStart` de siempre: las
	 * de afuera de lo visible quedan afuera, del mismo lado.
	 */
	const subtitulo = (el: TextElement): TextElement | null => {
		const ini = el.startTime as number;
		const fin = ini + (el.duration as number);
		const ini2 = f(ini);
		const fin2 = f(fin);
		const toca = tramos.some(([a, b]) => a < fin && b > ini);
		const contenido = String(el.params.content ?? "");
		const g = leerCodificadas(el.params[PARAM_PALABRAS]);
		if (!g || g.palabras.length === 0 || !coincidenConTexto(g.palabras, contenido)) {
			if (!toca) return ini2 === ini ? el : { ...el, startTime: ini2 as MediaTime };
			// Sin tiempos por palabra: un bloque, como un sticker.
			const corrido = correr(el) as TextElement | null;
			if (!corrido) subtitulosBorrados++;
			else subtitulosCambiados++;
			return corrido;
		}
		// Ticks de la línea de tiempo de cada palabra (el origen es `startTime − trimStart`).
		const origen = ini - (el.trimStart as number);
		const enLinea = (s: number) => origen + s * tps;
		const quitada = (p: PalabraSubtitulo) => adentro(enLinea((p.inicio + p.fin) / 2), tramos);
		const seVe = (p: PalabraSubtitulo) => {
			const m = enLinea((p.inicio + p.fin) / 2);
			return m >= ini && m < fin;
		};
		const quedan = g.palabras.filter((p) => !quitada(p));
		if (!toca && quedan.length === g.palabras.length) return ini2 === ini ? el : { ...el, startTime: ini2 as MediaTime };
		const dichasVisibles = g.palabras.filter((p) => !p.muletilla && seVe(p)).length;
		if ((dichasVisibles > 0 && !quedan.some((p) => !p.muletilla && seVe(p))) || fin2 - ini2 < minimo) {
			subtitulosBorrados++;
			return null;
		}
		const dichas = quedan.filter((p) => !p.muletilla);
		if (dichas.length === 0) {
			subtitulosBorrados++;
			return null;
		}
		subtitulosCambiados++;
		const origen2 = ini2 - (el.trimStart as number);
		const corridas = quedan.map((p) => ({
			...p,
			inicio: (f(enLinea(p.inicio)) - origen2) / tps,
			fin: (f(enLinea(p.fin)) - origen2) / tps,
		}));
		const quitoDichas = dichas.length !== g.palabras.filter((p) => !p.muletilla).length;
		let params: ParamValues = el.params;
		if (quitoDichas) {
			let texto = dichas.map((p) => p.texto).join(" ");
			// Si se fue la primera palabra de una oración, la que queda primera hereda la mayúscula.
			const primeraAntes = tokens(contenido)[0] ?? "";
			if (/^\p{Lu}/u.test(primeraAntes) && /^\p{Ll}/u.test(texto)) texto = texto[0].toUpperCase() + texto.slice(1);
			params = rehacerTexto ? rehacerTexto(el, texto) : { ...el.params, content: texto };
			// Las palabras se guardan con el texto nuevo (lo que DICE, sin los saltos de línea).
			const dice = tokens(String(params.content ?? ""));
			let k = 0;
			for (const p of corridas) if (!p.muletilla) p.texto = dice[k++] ?? p.texto;
		}
		return {
			...el,
			startTime: ini2 as MediaTime,
			duration: (fin2 - ini2) as MediaTime,
			params: {
				...params,
				// `corridas` ya van relativas al origen nuevo.
				[PARAM_PALABRAS]: codificarPalabras({ palabras: corridas, origen: 0, precision: g.precision }),
			},
		};
	};

	const pista = <TTrack extends TimelineTrack>(track: TTrack, principal: boolean): TTrack => {
		if (track.locked) return track;
		let cambio = false;
		const elements = (track.elements as TimelineElement[]).flatMap((el): TimelineElement[] => {
			let nuevos: TimelineElement[];
			if (esCortable(el, principal)) nuevos = cortar(el, principal);
			else if (esSubtitulo(el)) {
				const s = subtitulo(el);
				nuevos = s ? [s] : [];
			} else if (vinculado(el, track)) {
				const c = correr(el);
				nuevos = c ? [c] : [];
			} else nuevos = [el];
			if (nuevos.length !== 1 || nuevos[0] !== el) cambio = true;
			return nuevos;
		});
		return cambio ? ({ ...track, elements } as TTrack) : track;
	};

	const principal = pista(tracks.main, true);
	// Cada pedazo del audio extraído, con el pedazo de video que tiene arriba: si todos
	// siguieran apuntando al primero, «Recuperar audio» en el primero los borraría a todos
	// (y los demás quedarían mudos) y en otro no borraría nada (sonarían dos audios).
	const piezasDe = new Map<string, Array<{ id: string; ini: number; fin: number }>>();
	for (const p of principal.elements as TimelineElement[]) {
		const o = origenDe.get(p.id);
		if (!o) continue;
		if (!piezasDe.has(o)) piezasDe.set(o, []);
		piezasDe.get(o)!.push({ id: p.id, ini: p.startTime as number, fin: (p.startTime as number) + (p.duration as number) });
	}
	const emparejar = <TTrack extends TimelineTrack>(track: TTrack): TTrack => {
		if (track === tracks.audio.find((t) => t.id === track.id) || track.locked) return track;
		const elements = (track.elements as TimelineElement[]).map((e) => {
			const de = e.type === "audio" ? piezasDe.get(String(e.params[EXTRAIDO_DE] ?? "")) : undefined;
			if (!de) return e;
			const medio = (e.startTime as number) + (e.duration as number) / 2;
			const arriba = de.find((p) => medio >= p.ini && medio < p.fin);
			return !arriba || arriba.id === e.params[EXTRAIDO_DE] ? e : { ...e, params: { ...e.params, [EXTRAIDO_DE]: arriba.id } };
		});
		return { ...track, elements } as TTrack;
	};
	const nuevas: SceneTracks = {
		overlay: tracks.overlay.map((t) => pista(t, false)),
		main: principal,
		audio: tracks.audio.map((t) => emparejar(pista(t, false))),
	};
	const quitado = tramos.reduce((s, [a, b]) => s + (b - a), 0);
	const cambio =
		nuevas.main !== tracks.main ||
		nuevas.overlay.some((t, i) => t !== tracks.overlay[i]) ||
		nuevas.audio.some((t, i) => t !== tracks.audio[i]);
	if (!cambio) return sinCambios;
	return { tracks: nuevas, quitado, subtitulosCambiados, subtitulosBorrados };
}

/**
 * ¿Qué tramos tienen algo que cortar debajo? Un tramo donde la pista principal no
 * tiene nada (la voz viene de una pista de audio, por ejemplo) no se puede sacar
 * del video como pide CapCut: «No hay ningún clip de video en la pista principal».
 */
export function tramosConClip(tracks: SceneTracks, tramos: ReadonlyArray<TramoTicks>): { con: TramoTicks[]; sin: TramoTicks[] } {
	const clips = (tracks.main.elements as TimelineElement[]).map((e) => [e.startTime as number, (e.startTime as number) + (e.duration as number)] as const);
	const con: TramoTicks[] = [];
	const sin: TramoTicks[] = [];
	for (const t of tramos) {
		const medio = (t[0] + t[1]) / 2;
		(clips.some(([a, b]) => medio >= a && medio < b) ? con : sin).push(t);
	}
	return { con, sin };
}
