// =============================================================================
// B-roll y planos: las PISTAS de la propuesta (puro: sin motor, sin `wasm`)
// =============================================================================
// Lo que MaKo propone va a la línea de tiempo de verdad (se ve en el visor y en la línea de tiempo), en pistas propias:
//
//   · «B-roll»: las fotos, ABAJO de las pistas de la persona y arriba de la principal. Sus textos y stickers siguen
//     encima; una foto suya encima del principal es un tramo `ocupado` y ahí no se propone nada.
//   · «Planos»: las capas del efecto «Acercar», la última de todas (pegada a la principal): una capa de efecto cambia
//     todo lo que tiene debajo, así que ahí acerca sólo el video que habla, no las fotos ni los textos.
//
// Cada elemento propuesto lleva `mako.propuesta` («broll» o «plano») hasta que la persona lo DEJA (la marca pasa a "")
// o lo SACA (se borra). Así una propuesta sobrevive a recargar la página: lo pendiente se lee de la línea de tiempo, no
// de un estado aparte (la pantalla lo calcula, nunca lo recuerda). La línea de tiempo la dibuja con un borde punteado
// (timeline/components/timeline-element.tsx).
//
// «Sin pisar lo que ya editó»: nada de esto toca un elemento que no tenga la marca. Volver a proponer saca sólo lo
// pendiente (`sinPendientes`); lo que la persona dejó cuenta como ocupado.
//
// Los tiempos llegan en SEGUNDOS y salen en ticks con el `tps` que pasa quien llama (las pruebas no cargan el `wasm`).
// =============================================================================

import type { Frase, Tramo } from "@/lib/editor-video/broll";
import type {
	EffectElement,
	EffectTrack,
	ImageElement,
	OverlayTrack,
	SceneTracks,
	TimelineElement,
	VideoTrack,
} from "@/app/video-editor/_opencut/timeline";
import { buildEmptyTrack } from "@/app/video-editor/_opencut/timeline/placement/track-factory";

export const PARAM_PROPUESTA = "mako.propuesta";
/** Lo que se buscó y de quién es la foto (el crédito que pide Pexels), en el elemento. */
export const PARAM_BUSQUEDA = "mako.broll.busqueda";
export const PARAM_AUTOR = "mako.broll.autor";
export const PARAM_FOTO = "mako.broll.foto";
export const PARAM_MOTIVO = "mako.broll.motivo";

export type TipoPropuesta = "broll" | "plano";

export const NOMBRE_PISTA_BROLL = "B-roll";
export const NOMBRE_PISTA_PLANOS = "Planos";

export function propuestaDe(el: TimelineElement | null | undefined): TipoPropuesta | null {
	const v = el?.params?.[PARAM_PROPUESTA];
	return v === "broll" || v === "plano" ? v : null;
}

export type Pendiente = { trackId: string; element: TimelineElement; tipo: TipoPropuesta };

/** Lo que MaKo propuso y la persona todavía no dejó ni sacó, en el orden del video. */
export function pendientesDe(tracks: SceneTracks | null | undefined): Pendiente[] {
	if (!tracks) return [];
	const lista: Pendiente[] = [];
	for (const t of tracks.overlay) {
		for (const el of t.elements as TimelineElement[]) {
			const tipo = propuestaDe(el);
			if (tipo) lista.push({ trackId: t.id, element: el, tipo });
		}
	}
	return lista.sort((a, b) => a.element.startTime - b.element.startTime);
}

/** Lo que se dice: los subtítulos de la línea de tiempo (textos con `subtitulo: true`), en segundos. */
export function frasesDeSubtitulos(tracks: SceneTracks | null | undefined, tps: number): Frase[] {
	if (!tracks) return [];
	const frases: Frase[] = [];
	for (const t of tracks.overlay) {
		if (t.type !== "text") continue;
		for (const el of t.elements) {
			if (el.params?.subtitulo !== true) continue;
			const texto = typeof el.params.content === "string" ? el.params.content.replace(/\s+/g, " ").trim() : "";
			if (!texto) continue;
			frases.push({ texto, inicio: el.startTime / tps, fin: (el.startTime + el.duration) / tps });
		}
	}
	return frases.sort((a, b) => a.inicio - b.inicio);
}

/**
 * Los tramos que NO se tocan, en segundos:
 *   · para el B-roll, toda imagen o video encima del principal que no sea una propuesta pendiente (sus fotos, sus
 *     pantallas divididas, el B-roll que ya dejó): ahí ya hay algo encima de la cara;
 *   · para los planos, toda capa de efecto que no sea un plano pendiente: sus efectos no se mezclan con un acercamiento.
 */
export function tramosOcupados(tracks: SceneTracks | null | undefined, tps: number, para: TipoPropuesta): Tramo[] {
	if (!tracks) return [];
	const tramos: Tramo[] = [];
	for (const t of tracks.overlay) {
		if (para === "broll" ? t.type !== "video" : t.type !== "effect") continue;
		for (const el of t.elements as TimelineElement[]) {
			if (propuestaDe(el)) continue;
			tramos.push({ inicio: el.startTime / tps, fin: (el.startTime + el.duration) / tps });
		}
	}
	return tramos;
}

/** Las pistas sin lo pendiente (de un tipo, o de los dos). Una pista de MaKo que queda vacía se va. */
export function sinPendientes(tracks: SceneTracks, tipo?: TipoPropuesta): SceneTracks {
	return quitar(tracks, (el) => {
		const t = propuestaDe(el);
		return t !== null && (!tipo || t === tipo);
	});
}

/** Saca los pendientes con esos ids (todos, sin `ids`). Lo que no es una propuesta no se toca nunca. */
export function sacarPropuestas(tracks: SceneTracks, ids?: ReadonlySet<string>): SceneTracks {
	return quitar(tracks, (el) => propuestaDe(el) !== null && (!ids || ids.has(el.id)));
}

/** Deja los pendientes con esos ids (todos, sin `ids`): la marca pasa a "" y el elemento queda como uno más. */
export function dejarPropuestas(tracks: SceneTracks, ids?: ReadonlySet<string>): SceneTracks {
	let cambio = false;
	const overlay = tracks.overlay.map((t) => {
		let tocada = false;
		const elements = (t.elements as TimelineElement[]).map((el) => {
			if (!propuestaDe(el) || (ids && !ids.has(el.id))) return el;
			tocada = true;
			return { ...el, params: { ...el.params, [PARAM_PROPUESTA]: "" } } as TimelineElement;
		});
		if (!tocada) return t;
		cambio = true;
		return { ...t, elements } as OverlayTrack;
	});
	return cambio ? { ...tracks, overlay } : tracks;
}

const esPistaDeMaKo = (t: OverlayTrack) =>
	(t.type === "video" && t.name === NOMBRE_PISTA_BROLL) || (t.type === "effect" && t.name === NOMBRE_PISTA_PLANOS);

function quitar(tracks: SceneTracks, sale: (el: TimelineElement) => boolean): SceneTracks {
	let cambio = false;
	const overlay: OverlayTrack[] = [];
	for (const t of tracks.overlay) {
		const elements = (t.elements as TimelineElement[]).filter((el) => !sale(el));
		if (elements.length === t.elements.length) { overlay.push(t); continue; }
		cambio = true;
		// La pista de MaKo que queda vacía se va (la creó MaKo); la de la persona queda aunque quede vacía.
		if (!elements.length && esPistaDeMaKo(t)) continue;
		overlay.push({ ...t, elements } as OverlayTrack);
	}
	return cambio ? { ...tracks, overlay } : tracks;
}

/** Se pisan dos tramos en ticks. */
const pisa = (a: { startTime: number; duration: number }, b: { startTime: number; duration: number }) =>
	a.startTime < b.startTime + b.duration && b.startTime < a.startTime + a.duration;

/**
 * Las pistas con la propuesta puesta: las fotos en la pista «B-roll» (la que ya había, si no se pisan) y las capas en
 * «Planos», abajo de todo. Lo de la persona queda igual y en su lugar.
 */
export function conPropuestas({
	tracks,
	imagenes,
	capas,
	nuevoId,
}: {
	tracks: SceneTracks;
	imagenes: readonly ImageElement[];
	capas: readonly EffectElement[];
	nuevoId: () => string;
}): SceneTracks {
	const overlay = [...tracks.overlay];
	if (imagenes.length) {
		const i = overlay.findIndex((t) => t.type === "video" && t.name === NOMBRE_PISTA_BROLL);
		const previa = i >= 0 ? (overlay[i] as VideoTrack) : null;
		const entran = previa && imagenes.every((im) => previa.elements.every((e) => !pisa(e, im)));
		if (previa && entran) {
			overlay[i] = { ...previa, elements: [...previa.elements, ...imagenes].sort((a, b) => a.startTime - b.startTime) };
		} else {
			const pista = buildEmptyTrack({ id: nuevoId(), type: "video", name: NOMBRE_PISTA_BROLL });
			pista.elements = [...imagenes];
			// Abajo de las de la persona, arriba de los planos (si ya hay una pista de planos, va antes que ella).
			const planos = overlay.findIndex((t) => t.type === "effect" && t.name === NOMBRE_PISTA_PLANOS);
			if (planos >= 0) overlay.splice(planos, 0, pista);
			else overlay.push(pista);
		}
	}
	if (capas.length) {
		const i = overlay.findIndex((t) => t.type === "effect" && t.name === NOMBRE_PISTA_PLANOS);
		const previa = i >= 0 ? (overlay[i] as EffectTrack) : null;
		const entran = previa && capas.every((c) => previa.elements.every((e) => !pisa(e, c)));
		if (previa && entran) {
			overlay[i] = { ...previa, elements: [...previa.elements, ...capas].sort((a, b) => a.startTime - b.startTime) };
		} else {
			const pista = buildEmptyTrack({ id: nuevoId(), type: "effect", name: NOMBRE_PISTA_PLANOS });
			pista.elements = [...capas];
			overlay.push(pista);
		}
	}
	if (!imagenes.length && !capas.length) return tracks;
	return { ...tracks, overlay };
}
