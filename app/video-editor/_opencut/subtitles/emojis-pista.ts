// =============================================================================
// Los emojis de los subtítulos en la línea de tiempo: armarlos, ponerlos en su pista y sacarlos
// =============================================================================
// Qué emoji va con cada subtítulo lo decide ./emojis.ts. Acá, sin el motor (los tests lo cargan en node):
//   · `armarEmojis`: un sticker de Stickers › Emojis por subtítulo elegido, con el MISMO tiempo que su subtítulo,
//     encima de él (`posicionDelEmoji`), con la animación de entrada «Rebote» (la regla de las animaciones,
//     ../animaciones/elegir.ts, la misma del panel) y la marca de su subtítulo (`subtitulo.emojiDe`);
//   · `conEmojis`: los pone en la pista «Emojis» (una pista de gráficos, la primera de arriba: el emoji va sobre todo);
//     los que ya estaban de antes se REEMPLAZAN (prender dos veces no duplica);
//   · `sinEmojis`: saca sólo los marcados (un sticker que puso la persona no se toca) y la pista si quedó vacía;
//   · `sincronizarEmojis`: corre en `timeline.updateTracks` (por donde pasa TODO cambio de pistas, como el imán) y
//     hace que cada emoji siga a su subtítulo: si el subtítulo cambió (otra plantilla, otro texto, se movió) el emoji
//     se recoloca; si el subtítulo ya no está, el emoji se va; si la persona tocó el emoji a mano o lo duplicó, deja
//     de ser automático (pierde la marca: apagar o regenerar ya no lo pisa). Revisión del 10/11/2026.
// Una pista bloqueada no se toca, y los emojis nuevos no van a una pista oculta ni a una donde pisan algo de la persona.

import type { ParamValues } from "@/app/video-editor/_opencut/params";
import type { OverlayTrack, SceneTracks, StickerElement, TextElement, TimelineElement } from "@/app/video-editor/_opencut/timeline/types";
import { cambiosAlElegir } from "@/app/video-editor/_opencut/animaciones/elegir";
import { buildEmptyTrack } from "@/app/video-editor/_opencut/timeline/placement/track-factory";
import { FONT_SIZE_SCALE_REFERENCE } from "@/app/video-editor/_opencut/text/typography";
import { EMOJIS_PROVIDER_ID, emojiAValor } from "@/app/video-editor/_opencut/stickers/providers/emojis";
import { buildStickerId } from "@/app/video-editor/_opencut/stickers/sticker-id";
import { leerClaves, PARAM_CLAVES } from "@/lib/editor-video/claves";
import { elegirEmojis, NOMBRE_PISTA_EMOJIS, PARAM_EMOJI_DE, posicionDelEmoji } from "./emojis";

type Lienzo = { width: number; height: number };

/** El lado del PNG del emoji (Stickers › Emojis lo dibuja así: el render lo escala «contain» al lienzo). */
const LADO_PNG = 512;

const esEmojiDeSubtitulo = (el: { params?: ParamValues }) => typeof el.params?.[PARAM_EMOJI_DE] === "string" && el.params[PARAM_EMOJI_DE] !== "";

/** Dónde va el emoji de este subtítulo (centro, escala), con lo que el subtítulo tiene AHORA. */
function colocacion(s: TextElement, lienzo: Lienzo): { x: number; y: number; escala: number } {
	const fontSize = Number(s.params.fontSize ?? 15) || 15;
	return posicionDelEmoji({
		x: Number(s.params["transform.positionX"] ?? 0) || 0,
		y: Number(s.params["transform.positionY"] ?? 0) || 0,
		renglones: String(s.params.content ?? "").split("\n").length,
		pxLetra: (fontSize * lienzo.height) / FONT_SIZE_SCALE_REFERENCE,
		lienzo,
	});
}

/** Los params del emoji puestos donde va con su subtítulo, con la entrada «Rebote» a la medida de su duración. */
function paramsColocados(base: ParamValues, s: TextElement, tps: number, lienzo: Lienzo): ParamValues {
	const pos = colocacion(s, lienzo);
	const valores: ParamValues = {
		...base,
		"transform.positionX": pos.x,
		"transform.positionY": pos.y,
		"transform.scaleX": pos.escala,
		"transform.scaleY": pos.escala,
		[PARAM_EMOJI_DE]: s.id,
	};
	return { ...valores, ...cambiosAlElegir({ valores, tipo: "sticker", D: s.duration / tps }, "entrada", "rebote") };
}

/** Los subtítulos con su emoji, ya armados como stickers (sin id de pista: van en la de «Emojis»). */
export function armarEmojis({
	subtitulos,
	tps,
	lienzo,
	paramsBase,
	nuevoId,
}: {
	/** Los subtítulos en orden de tiempo. */
	subtitulos: readonly TextElement[];
	tps: number;
	lienzo: Lienzo;
	/** Los params de fábrica de un sticker (buildDefaultElementParams). */
	paramsBase: ParamValues;
	nuevoId: () => string;
}): StickerElement[] {
	const lista = subtitulos.map((s) => ({
		texto: String(s.params.content ?? "").replace(/\s+/g, " ").trim(),
		inicio: s.startTime / tps,
		fin: (s.startTime + s.duration) / tps,
		claves: leerClaves(s.params[PARAM_CLAVES]),
	}));
	return elegirEmojis(lista).map(({ indice, emoji }) => {
		const s = subtitulos[indice];
		return {
			id: nuevoId(),
			type: "sticker",
			name: `Emoji ${emoji}`,
			stickerId: buildStickerId({ providerId: EMOJIS_PROVIDER_ID, providerValue: emojiAValor(emoji) }),
			intrinsicWidth: LADO_PNG,
			intrinsicHeight: LADO_PNG,
			startTime: s.startTime,
			duration: s.duration,
			trimStart: 0 as StickerElement["trimStart"],
			trimEnd: 0 as StickerElement["trimEnd"],
			params: paramsColocados(paramsBase, s, tps, lienzo),
		} as StickerElement;
	});
}

/** Las pistas sin los emojis de subtítulos (los de la persona quedan), y sin la pista «Emojis» si quedó vacía. Una pista bloqueada no se toca. */
export function sinEmojis(tracks: SceneTracks): SceneTracks {
	let cambio = false;
	const overlay = tracks.overlay.flatMap((t): OverlayTrack[] => {
		if (t.locked) return [t];
		const elements = (t.elements as TimelineElement[]).filter((el) => !esEmojiDeSubtitulo(el));
		if (elements.length === t.elements.length) return [t];
		cambio = true;
		if (!elements.length && t.name === NOMBRE_PISTA_EMOJIS) return [];
		return [{ ...t, elements } as OverlayTrack];
	});
	return cambio ? { ...tracks, overlay } : tracks;
}

/** Cuántos emojis de subtítulos hay. */
export function cuantosEmojis(tracks: SceneTracks | null | undefined): number {
	if (!tracks) return 0;
	return tracks.overlay.reduce((n, t) => n + (t.elements as TimelineElement[]).filter(esEmojiDeSubtitulo).length, 0);
}

/** Se pisan dos tramos en ticks. */
const pisa = (a: { startTime: number; duration: number }, b: { startTime: number; duration: number }) =>
	a.startTime < b.startTime + b.duration && b.startTime < a.startTime + a.duration;

/**
 * Pone los emojis en la pista «Emojis» (arriba de todo), reemplazando los de antes. Usa la que ya hay sólo si no está
 * bloqueada ni oculta y no pisan nada de la persona; si no, una pista nueva.
 */
export function conEmojis({ tracks, emojis, nuevoId }: { tracks: SceneTracks; emojis: readonly StickerElement[]; nuevoId: () => string }): SceneTracks {
	const limpias = sinEmojis(tracks);
	if (!emojis.length) return limpias;
	const overlay = [...limpias.overlay];
	const i = overlay.findIndex(
		(t) =>
			t.type === "graphic" &&
			t.name === NOMBRE_PISTA_EMOJIS &&
			!t.locked &&
			!t.hidden &&
			emojis.every((e) => (t.elements as TimelineElement[]).every((x) => !pisa(x, e))),
	);
	if (i >= 0) {
		overlay[i] = { ...overlay[i], elements: [...(overlay[i].elements as TimelineElement[]), ...emojis].sort((a, b) => a.startTime - b.startTime) } as OverlayTrack;
	} else {
		const pista = buildEmptyTrack({ id: nuevoId(), type: "graphic", name: NOMBRE_PISTA_EMOJIS });
		pista.elements = [...emojis];
		overlay.unshift(pista);
	}
	return { ...limpias, overlay };
}

const TRANSFORM = ["transform.positionX", "transform.positionY", "transform.scaleX", "transform.scaleY", "transform.rotate"] as const;
/** Lo del subtítulo que mueve a su emoji. */
const DEL_SUBTITULO = ["content", "fontSize", "transform.positionX", "transform.positionY"] as const;

/**
 * Cada emoji automático sigue a su subtítulo (ver el encabezado). `antes`: las pistas de antes del cambio; `despues`:
 * las que van a quedar. Devuelve `despues` tal cual si no hay nada que cambiar (el caso de casi todo cambio).
 */
export function sincronizarEmojis({ antes, despues, tps, lienzo }: { antes: SceneTracks | null; despues: SceneTracks; tps: number; lienzo: Lienzo | null }): SceneTracks {
	if (!despues.overlay.some((t) => (t.elements as TimelineElement[]).some(esEmojiDeSubtitulo))) return despues;
	const subtitulos = new Map<string, TextElement>();
	for (const t of despues.overlay) for (const el of t.elements as TimelineElement[]) if (el.type === "text" && el.params.subtitulo === true) subtitulos.set(el.id, el as TextElement);
	const previos = new Map<string, TimelineElement>();
	if (antes) for (const t of antes.overlay) for (const el of t.elements as TimelineElement[]) previos.set(el.id, el);
	// Los marcados de AHORA que ya estaban antes: un marcado nuevo con el mismo subtítulo que uno de éstos es una copia.
	const deAntes = new Set<string>();
	for (const t of despues.overlay) for (const el of t.elements as TimelineElement[]) if (esEmojiDeSubtitulo(el) && previos.has(el.id)) deAntes.add(String(el.params[PARAM_EMOJI_DE]));

	let cambio = false;
	const overlay = despues.overlay.flatMap((t): OverlayTrack[] => {
		if (t.locked) return [t];
		let cambioPista = false;
		const elements = (t.elements as TimelineElement[]).flatMap((el): TimelineElement[] => {
			if (!esEmojiDeSubtitulo(el)) return [el];
			const deSub = String(el.params[PARAM_EMOJI_DE]);
			const sub = subtitulos.get(deSub);
			const previo = previos.get(el.id);
			// El subtítulo ya no está (lo borraron, se regeneraron): su emoji también se va.
			if (!sub) {
				cambioPista = true;
				return [];
			}
			const sinMarca = () => {
				cambioPista = true;
				const { [PARAM_EMOJI_DE]: _marca, ...resto } = el.params;
				return [{ ...el, params: resto } as TimelineElement];
			};
			// Una copia (duplicar, pegar) de un emoji automático: es de la persona.
			if (!previo && deAntes.has(deSub)) return sinMarca();
			if (!previo || !esEmojiDeSubtitulo(previo) || previo.type !== "sticker" || el.type !== "sticker") return [el];
			const subPrevio = previos.get(deSub);
			const subCambio =
				!subPrevio || sub.startTime !== subPrevio.startTime || sub.duration !== subPrevio.duration || DEL_SUBTITULO.some((k) => sub.params[k] !== subPrevio.params[k]);
			if (!subCambio) {
				// Su subtítulo quedó igual y el emoji cambió: lo tocó la persona (otro emoji, lo movió, lo agrandó, otro
				// tiempo). Deja de ser automático.
				const tocado =
					el.stickerId !== previo.stickerId ||
					TRANSFORM.some((k) => el.params[k] !== previo.params[k]) ||
					el.startTime !== previo.startTime ||
					el.duration !== previo.duration;
				return tocado ? sinMarca() : [el];
			}
			// Su subtítulo cambió (otra plantilla, otro texto, se movió, el imán lo corrió, o un «Deshacer»): el emoji se
			// recoloca con lo de ahora. Manda el subtítulo aunque el emoji también haya cambiado (un «Deshacer» trae los
			// dos), y como la cuenta es la misma, deshacer deja el emoji donde estaba.
			if (!lienzo) return [el];
			const params = paramsColocados(el.params, sub, tps, lienzo);
			if (el.startTime === sub.startTime && el.duration === sub.duration && Object.keys(params).every((k) => params[k] === el.params[k])) return [el];
			cambioPista = true;
			return [{ ...el, startTime: sub.startTime, duration: sub.duration, params } as TimelineElement];
		});
		if (!cambioPista) return [t];
		cambio = true;
		if (!elements.length && t.name === NOMBRE_PISTA_EMOJIS) return [];
		return [{ ...t, elements } as OverlayTrack];
	});
	return cambio ? { ...despues, overlay } : despues;
}
