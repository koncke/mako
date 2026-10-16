// =============================================================================
// La TRANSCRIPCIÓN del video: de dónde sale y qué se corta al borrar texto
// =============================================================================
// En CapCut la transcripción es aparte de los subtítulos, pero «Los cambios en la
// transcripción se sincronizarán con los subtítulos». Acá es al revés y más simple:
// la transcripción SON los subtítulos con tiempos por palabra (subtitles/palabras.ts),
// en orden. Un párrafo por subtítulo. Así no hay dos textos que se desincronicen, y
// «Transcribir» es «Subtítulos automáticos».
//
// Puro (sin motor ni React), con test (tests/video-editor-transcripcion.test.ts):
//   transcripcionDe     → los párrafos y sus palabras, en segundos de la línea de tiempo.
//   tramosDePalabras    → qué tramos del video se van al borrar unas palabras.
//   muletillasDe        → qué palabras son muletillas (las guardadas y las del texto).
//   buscarFrase         → dónde se dice una frase (para el chat: «corta donde digo…»).
// =============================================================================

import type { SceneTracks, TextElement } from "@/app/video-editor/_opencut/timeline";
import { PARAM_PALABRAS, palabrasDe } from "@/app/video-editor/_opencut/subtitles/palabras";
import { normalizarPalabra, quitarMuletillas } from "@/app/video-editor/_opencut/transcription/muletillas";
import type { PalabraTranscrita } from "@/app/video-editor/_opencut/transcription/types";

export type PalabraTx = {
	/** `${elementId}#${n}`: n es su lugar entre las palabras guardadas del subtítulo. */
	id: string;
	elementId: string;
	texto: string;
	/** Segundos de la línea de tiempo. */
	inicio: number;
	fin: number;
	/** Una muletilla que se sacó del texto al transcribir («Identificar las muletillas»). */
	muletilla: boolean;
};

export type ParrafoTx = {
	elementId: string;
	trackId: string;
	inicio: number;
	fin: number;
	/** Lo que dice el subtítulo (sin los saltos de línea). */
	texto: string;
	/** Vacío si el subtítulo no tiene tiempos por palabra (importado, escrito a mano o reescrito). */
	palabras: PalabraTx[];
	bloqueado: boolean;
};

/** Los subtítulos de la escena como transcripción, en orden de tiempo. */
export function transcripcionDe({ tracks, tps }: { tracks: SceneTracks | null | undefined; tps: number }): ParrafoTx[] {
	if (!tracks) return [];
	const parrafos: ParrafoTx[] = [];
	for (const track of tracks.overlay) {
		if (track.type !== "text") continue;
		for (const el of track.elements as TextElement[]) {
			if (el.params.subtitulo !== true) continue;
			const contenido = String(el.params.content ?? "");
			const inicio = el.startTime / tps;
			const fin = (el.startTime + el.duration) / tps;
			const g = palabrasDe({
				contenido,
				param: el.params[PARAM_PALABRAS],
				inicio,
				recorteInicio: el.trimStart / tps,
				duracion: el.duration / tps,
			});
			parrafos.push({
				elementId: el.id,
				trackId: track.id,
				inicio,
				fin,
				texto: contenido.split(/\s+/).filter(Boolean).join(" "),
				palabras: (g?.palabras ?? []).map((p, n) => ({
					id: `${el.id}#${n}`,
					elementId: el.id,
					texto: p.texto,
					inicio: p.inicio,
					fin: p.fin,
					muletilla: p.muletilla === true,
				})),
				bloqueado: track.locked === true,
			});
		}
	}
	return parrafos.sort((a, b) => a.inicio - b.inicio);
}

/** Todas las palabras de la transcripción, en orden de tiempo. */
export function palabrasEnOrden(parrafos: readonly ParrafoTx[]): PalabraTx[] {
	return parrafos.flatMap((p) => p.palabras).sort((a, b) => a.inicio - b.inicio);
}

/**
 * Los tramos del video (segundos) que se van al borrar las palabras `quitar`.
 *
 * Cada racha de palabras seguidas que se borran se lleva su voz y la MITAD de las
 * pausas de los costados: la pausa que queda entre las palabras vecinas es el
 * promedio de las dos que había. Cortar justo en los bordes de la palabra dejaría
 * las dos pausas enteras (un hueco largo); cortar de palabra vecina a palabra
 * vecina, ninguna (se pegan). Y los tiempos de Whisper bailan ±0,1 s: cortar en el
 * medio de la pausa es lo más lejos posible de comerse una sílaba vecina.
 * Al principio y al final de todo, el corte va al borde de la palabra.
 */
export function tramosDePalabras({
	palabras,
	quitar,
}: {
	palabras: readonly PalabraTx[];
	quitar: ReadonlySet<string>;
}): Array<[number, number]> {
	const tramos: Array<[number, number]> = [];
	let i = 0;
	while (i < palabras.length) {
		if (!quitar.has(palabras[i].id)) {
			i++;
			continue;
		}
		let j = i;
		while (j + 1 < palabras.length && quitar.has(palabras[j + 1].id)) j++;
		const prev = palabras[i - 1];
		const next = palabras[j + 1];
		const primera = palabras[i];
		const ultima = palabras[j];
		const desde = prev ? primera.inicio - Math.max(0, primera.inicio - prev.fin) / 2 : primera.inicio;
		const hasta = next ? ultima.fin + Math.max(0, next.inicio - ultima.fin) / 2 : ultima.fin;
		if (hasta > desde) tramos.push([desde, hasta]);
		i = j + 1;
	}
	return tramos;
}

/**
 * Las muletillas de la transcripción: las que se guardaron marcadas al transcribir y
 * las que siguen en el texto (si «Identificar las muletillas» estaba apagado), con
 * el mismo criterio (transcription/muletillas.ts: los sonidos siempre; «este», «o
 * sea»… sólo si suenan a muletilla).
 */
export function muletillasDe(parrafos: readonly ParrafoTx[], idioma: string): Set<string> {
	const ids = new Set<string>();
	const dichas: Array<PalabraTranscrita & { id: string }> = [];
	for (const p of palabrasEnOrden(parrafos)) {
		if (p.muletilla) ids.add(p.id);
		else dichas.push({ id: p.id, texto: p.texto, inicio: p.inicio, fin: p.fin });
	}
	const { sacadas } = quitarMuletillas({ palabras: dichas, idioma: idioma === "auto" ? "es" : idioma });
	for (const s of sacadas) ids.add((s as PalabraTranscrita & { id: string }).id);
	return ids;
}

/**
 * Dónde se dice una frase: cada aparición, como la lista de ids de sus palabras.
 * Compara palabra por palabra sin mayúsculas ni puntuación, y salta las muletillas
 * guardadas (no están en el texto: «hola, eh, mundo» se encuentra con «hola mundo»),
 * pero las que caen ADENTRO de la aparición van en ella: cortar la frase se las lleva.
 */
export function buscarFrase(parrafos: readonly ParrafoTx[], frase: string): string[][] {
	const buscada = frase.split(/\s+/).map(normalizarPalabra).filter(Boolean);
	if (buscada.length === 0) return [];
	const todas = palabrasEnOrden(parrafos);
	const dichas = todas.map((p, lugar) => ({ p, lugar })).filter(({ p }) => !p.muletilla);
	const norm = dichas.map(({ p }) => normalizarPalabra(p.texto));
	const apariciones: string[][] = [];
	for (let i = 0; i + buscada.length <= dichas.length; i++) {
		if (buscada.every((w, k) => norm[i + k] === w)) {
			const desde = dichas[i].lugar;
			const hasta = dichas[i + buscada.length - 1].lugar;
			apariciones.push(todas.slice(desde, hasta + 1).map((p) => p.id));
			i += buscada.length - 1;
		}
	}
	return apariciones;
}
