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
//
// «Cambiar por otra» (10/11/2026, pendientes-video-editor.md §4.1): un B-roll de MaKo (propuesto o ya dejado: lleva su
// búsqueda y el id de Pexels) cambia de archivo en el MISMO lugar y tiempo. Las cuentas son las de «Reemplazar el clip»
// (../reemplazo/puro.ts → `elementoReemplazado`: mismo id, inicio, duración, animaciones y efectos; un video que no
// alcanza se rechaza; el sonido queda como estaba: un video propuesto entra silenciado y, si la persona le prendió el
// sonido, lo conserva), más lo propio del B-roll, que el reemplazo no conserva porque son params sin declarar: las marcas
// de MaKo y el archivo nuevo cubriendo el rectángulo donde se veía el viejo.
// =============================================================================

import type { Frase, HuecoBroll, Tramo } from "@/lib/editor-video/broll";
import type {
	EffectElement,
	ElementRef,
	EffectTrack,
	ImageElement,
	OverlayTrack,
	SceneTracks,
	TimelineElement,
	VideoElement,
	VideoTrack,
} from "@/app/video-editor/_opencut/timeline";
import { buildEmptyTrack } from "@/app/video-editor/_opencut/timeline/placement/track-factory";
import {
	buscarClip,
	conElementos,
	elementoReemplazado,
	rectoMostrado,
	type BaseParams,
	type MedioReemplazo,
	type MotivoReemplazo,
} from "@/app/video-editor/_opencut/reemplazo/puro";
import { cubrirCelda, paramsDeCubrir, type Tamano } from "@/app/video-editor/_opencut/plantillas/geometria";

export const PARAM_PROPUESTA = "mako.propuesta";
/** Lo que se buscó y de quién es la foto (el crédito que pide Pexels), en el elemento. */
export const PARAM_BUSQUEDA = "mako.broll.busqueda";
export const PARAM_AUTOR = "mako.broll.autor";
export const PARAM_FOTO = "mako.broll.foto";
export const PARAM_MOTIVO = "mako.broll.motivo";
/** Los ids de Pexels que ya se vieron en ese lugar («Cambiar por otra» no vuelve a ellos), separados por coma. */
export const PARAM_VISTAS = "mako.broll.vistas";
/** Lo que se guarda de las vistas: las últimas, para que el param no crezca sin fin. */
const MAX_VISTAS = 40;

/** Qué trae el B-roll de Pexels: fotos o videos. */
export type MedioBroll = "fotos" | "videos";

export type TipoPropuesta = "broll" | "plano";

export const NOMBRE_PISTA_BROLL = "B-roll";
export const NOMBRE_PISTA_PLANOS = "Planos";

export function propuestaDe(el: TimelineElement | null | undefined): TipoPropuesta | null {
	const v = el?.params?.[PARAM_PROPUESTA];
	return v === "broll" || v === "plano" ? v : null;
}

/** `bloqueada`: su pista está bloqueada (el botón «Otra» no la cambia, como no la cambia ninguna herramienta). */
export type Pendiente = { trackId: string; element: TimelineElement; tipo: TipoPropuesta; bloqueada?: true };

/** Lo que MaKo propuso y la persona todavía no dejó ni sacó, en el orden del video. */
export function pendientesDe(tracks: SceneTracks | null | undefined): Pendiente[] {
	if (!tracks) return [];
	const lista: Pendiente[] = [];
	for (const t of tracks.overlay) {
		for (const el of t.elements as TimelineElement[]) {
			const tipo = propuestaDe(el);
			if (tipo) lista.push({ trackId: t.id, element: el, tipo, ...(t.locked === true ? { bloqueada: true as const } : {}) });
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

const ID_PEXELS = /^\d{1,12}$/;

/** Un B-roll de MaKo, propuesto o ya dejado: qué se buscó, si es foto o video, y el id de Pexels de lo que muestra. */
export type BrollPuesto = { busqueda: string; medio: MedioBroll; foto: number };

/** El B-roll que trajo MaKo en ese elemento, o null si no es uno (una foto de la persona no lleva su búsqueda). */
export function brollDe(el: TimelineElement | null | undefined): BrollPuesto | null {
	if (!el || (el.type !== "image" && el.type !== "video")) return null;
	const busqueda = el.params?.[PARAM_BUSQUEDA];
	const foto = el.params?.[PARAM_FOTO];
	if (typeof busqueda !== "string" || !busqueda.trim() || typeof foto !== "string" || !ID_PEXELS.test(foto)) return null;
	return { busqueda: busqueda.trim(), medio: el.type === "video" ? "videos" : "fotos", foto: Number(foto) };
}

/** El B-roll de MaKo que la persona ya DEJÓ (sin marca de propuesta), en el orden del video: «Otra» también le sirve. */
export function brollsDejados(tracks: SceneTracks | null | undefined): Pendiente[] {
	const lista: Pendiente[] = [];
	for (const t of tracks?.overlay ?? []) {
		for (const el of t.elements as TimelineElement[]) {
			if (brollDe(el) && !propuestaDe(el)) lista.push({ trackId: t.id, element: el, tipo: "broll", ...(t.locked === true ? { bloqueada: true as const } : {}) });
		}
	}
	return lista.sort((a, b) => a.element.startTime - b.element.startTime);
}

/** Los ids que ya se vieron en el lugar de ese B-roll (sin el de ahora). */
export function vistasDe(el: TimelineElement): number[] {
	const v = el.params?.[PARAM_VISTAS];
	if (typeof v !== "string") return [];
	return v.split(",").filter((x) => ID_PEXELS.test(x)).map(Number);
}

/**
 * Lo que «Cambiar por otra» no vuelve a traer para ese B-roll: lo que muestra hoy, lo que ya se vio en ese lugar y lo
 * de su mismo medio que ya está en otro lugar de la línea de tiempo (dos huecos no llevan la misma foto).
 */
export function noRepetirEn(tracks: SceneTracks, el: TimelineElement): Set<number> {
	const propio = brollDe(el);
	if (!propio) return new Set(vistasDe(el));
	return new Set([...vistasDe(el), propio.foto, ...idsEnUso(tracks, propio.medio)]);
}

/** Los ids de Pexels de ese medio que ya están en la línea de tiempo (propuestos o dejados). */
export function idsEnUso(tracks: SceneTracks | null | undefined, medio: MedioBroll): Set<number> {
	const ids = new Set<number>();
	for (const t of tracks?.overlay ?? []) {
		for (const el of t.elements as TimelineElement[]) {
			const b = brollDe(el);
			if (b && b.medio === medio) ids.add(b.foto);
		}
	}
	return ids;
}

/** El primero de la búsqueda que no se repite y que sirve (un video que dure lo que el lugar). */
export function siguienteBroll<T extends { id: number }>(
	candidatos: readonly T[],
	fuera: ReadonlySet<number>,
	sirve: (c: T) => boolean = () => true,
): T | null {
	return candidatos.find((c) => !fuera.has(c.id) && sirve(c)) ?? null;
}

export type MotivoOtroBroll = MotivoReemplazo | "sin-broll" | "bloqueada";

/**
 * ¿Se puede cambiar el B-roll `ref` en la línea `tracks`? «Otra» lo pregunta ANTES de bajar el archivo y otra vez al
 * volver (mientras se bajaba, la persona pudo sacarlo o bloquear su pista): `falta` = ya no está; `no-broll` = está pero
 * no es un B-roll de MaKo; `bloqueada` = su pista está bloqueada.
 */
export type PuedeCambiarBroll = "si" | "falta" | "no-broll" | "bloqueada";

export function puedeCambiarBroll(tracks: SceneTracks, ref: ElementRef): PuedeCambiarBroll {
	const clip = buscarClip(tracks, ref);
	if (!clip) {
		const existe = [...tracks.overlay, tracks.main, ...tracks.audio].some((t) => (t.elements as TimelineElement[]).some((e) => e.id === ref.elementId));
		return existe ? "no-broll" : "falta";
	}
	if (!brollDe(clip.element)) return "no-broll";
	return clip.track.locked === true ? "bloqueada" : "si";
}

/**
 * La línea con el B-roll `ref` mostrando el archivo `medio` (de Pexels, `foto`): mismo id, lugar y tiempo, las marcas de
 * MaKo y el archivo nuevo cubriendo el rectángulo donde se veía el viejo. Foto por foto y video por video, así el sonido
 * de un video queda como lo dejó la persona. Lo de antes queda en las vistas (no se vuelve a traer).
 */
export function lineaConOtroBroll({
	tracks,
	ref,
	medio,
	foto,
	tps,
	lienzo,
	tamanoDe,
	base,
}: {
	tracks: SceneTracks;
	ref: ElementRef;
	medio: MedioReemplazo;
	foto: { id: number; autor: string };
	tps: number;
	lienzo: Tamano;
	tamanoDe: (mediaId: string) => Tamano | null;
	base: BaseParams;
}): { ok: true; tracks: SceneTracks } | { ok: false; motivo: MotivoOtroBroll } {
	const puede = puedeCambiarBroll(tracks, ref);
	if (puede === "bloqueada") return { ok: false, motivo: "bloqueada" };
	const clip = buscarClip(tracks, ref);
	const actual = clip ? brollDe(clip.element) : null;
	if (puede !== "si" || !clip || !actual) return { ok: false, motivo: "sin-broll" };
	if ((actual.medio === "videos") !== (medio.type === "video")) return { ok: false, motivo: "tipo" };
	const fuenteActual = tamanoDe(clip.element.mediaId) ?? lienzo;
	const r = elementoReemplazado({ elemento: clip.element, medio, tps, lienzo, fuenteActual, base });
	if (!r.ok) return r;
	const celda = rectoMostrado({ params: clip.element.params, fuente: fuenteActual, lienzo });
	const fuente = medio.width && medio.height ? { width: medio.width, height: medio.height } : lienzo;
	const marcas = Object.fromEntries(
		Object.entries(clip.element.params).filter(([k]) => k === PARAM_PROPUESTA || k.startsWith("mako.broll.")),
	);
	const vistas = [...new Set([...vistasDe(clip.element), actual.foto])].filter((id) => id !== foto.id).slice(-MAX_VISTAS);
	const params = {
		...r.elemento.params,
		...paramsDeCubrir(cubrirCelda({ fuente, celda, lienzo })),
		...marcas,
		[PARAM_FOTO]: String(foto.id),
		[PARAM_AUTOR]: foto.autor,
		[PARAM_VISTAS]: vistas.join(","),
	};
	const elemento = { ...r.elemento, name: clip.element.name, params } as TimelineElement;
	return { ok: true, tracks: conElementos(tracks, new Map([[clip.element.id, elemento]])) };
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
	/** Las fotos o los videos del B-roll (la misma pista los lleva). */
	imagenes: readonly (ImageElement | VideoElement)[];
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

// ── Sin Pexels: los clips del propio proyecto (12/11/2026) ─────────────────────────────────────────────────────────
// Probando la tab Video en el negocio de MaKo, el B-roll quedó en «Conectar Pexels» y sólo cambios de plano: ese negocio no
// tiene clave (ni la plataforma: Pexels es de cada negocio, lib/pexels.ts). Mientras no la conecte, el B-roll sale de lo que la
// persona YA subió a Multimedia.

/** Un archivo de Multimedia que puede ir de B-roll. `duracion` en segundos (null en una foto). */
export type MedioPropio = { id: string; nombre: string; tipo: "video" | "image"; duracion: number | null; ancho?: number; alto?: number };

/** El motivo que lleva un B-roll propio (lo lee la fila de la propuesta). */
export const MOTIVO_PROPIO = "Un archivo tuyo de Multimedia (sin Pexels conectado)";

/** Los archivos que ya están en la línea de tiempo (en cualquier pista): no se proponen de B-roll. */
function mediosEnUso(tracks: SceneTracks | null | undefined): Set<string> {
	const ids = new Set<string>();
	for (const t of [...(tracks?.overlay ?? []), ...(tracks ? [tracks.main] : [])]) {
		for (const el of t.elements as TimelineElement[]) if ("mediaId" in el && typeof el.mediaId === "string") ids.add(el.mediaId);
	}
	return ids;
}

/**
 * Qué archivo propio va en qué hueco: los videos y fotos de Multimedia que NO están en la línea de tiempo (el de la cara
 * está en la principal; uno que ya está encima no se repite), cada uno UNA vez, en los huecos de más peso y en el orden del
 * video. Un video va sólo donde alcanza su largo (`margen` de más, como los de Pexels). `tracks`: la línea SIN lo pendiente.
 */
export function brollPropio({
	medios,
	tracks,
	huecos,
	objetivo,
	margen = 0,
}: {
	medios: readonly MedioPropio[];
	tracks: SceneTracks | null | undefined;
	huecos: readonly HuecoBroll[];
	objetivo: number;
	margen?: number;
}): Array<{ hueco: HuecoBroll; medio: MedioPropio }> {
	const enUso = mediosEnUso(tracks);
	const libres = medios.filter((m) => !enUso.has(m.id));
	if (!libres.length || objetivo <= 0) return [];
	// Con menos archivos que huecos, van a los de más peso.
	const mejores = [...huecos].sort((a, b) => b.puntaje - a.puntaje || a.inicio - b.inicio).slice(0, Math.min(objetivo, libres.length));
	const pares: Array<{ hueco: HuecoBroll; medio: MedioPropio }> = [];
	const usados = new Set<string>();
	for (const hueco of mejores.sort((a, b) => a.inicio - b.inicio)) {
		const largo = hueco.fin - hueco.inicio;
		const medio = libres.find((m) => !usados.has(m.id) && (m.tipo === "image" || (m.duracion ?? 0) >= largo + margen));
		if (!medio) continue;
		usados.add(medio.id);
		pares.push({ hueco, medio });
	}
	return pares;
}
