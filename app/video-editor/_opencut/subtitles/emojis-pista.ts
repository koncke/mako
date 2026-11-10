// =============================================================================
// Los emojis de los subtítulos en la línea de tiempo: armarlos, ponerlos en su pista y sacarlos
// =============================================================================
// Qué emoji va con cada subtítulo lo decide ./emojis.ts. Acá, sin el motor (los tests lo cargan en node):
//   · `armarEmojis`: un sticker de Stickers › Emojis por subtítulo elegido, con el MISMO tiempo que su subtítulo,
//     encima de él (`posicionDelEmoji`), con la animación de entrada «Rebote» (la regla de las animaciones,
//     ../animaciones/elegir.ts, la misma del panel) y la marca de su subtítulo (`subtitulo.emojiDe`);
//   · `conEmojis`: los pone en la pista «Emojis» (una pista de gráficos, la primera de arriba: el emoji va sobre todo);
//     los que ya estaban de antes se REEMPLAZAN (prender dos veces no duplica);
//   · `sinEmojis`: saca sólo los marcados (un sticker que puso la persona no se toca) y la pista si quedó vacía.

import type { ParamValues } from "@/app/video-editor/_opencut/params";
import type { OverlayTrack, SceneTracks, StickerElement, TextElement, TimelineElement } from "@/app/video-editor/_opencut/timeline/types";
import { cambiosAlElegir } from "@/app/video-editor/_opencut/animaciones/elegir";
import { buildEmptyTrack } from "@/app/video-editor/_opencut/timeline/placement/track-factory";
import { FONT_SIZE_SCALE_REFERENCE } from "@/app/video-editor/_opencut/text/typography";
import { EMOJIS_PROVIDER_ID, emojiAValor } from "@/app/video-editor/_opencut/stickers/providers/emojis";
import { buildStickerId } from "@/app/video-editor/_opencut/stickers/sticker-id";
import { leerClaves, PARAM_CLAVES } from "@/lib/editor-video/claves";
import { elegirEmojis, NOMBRE_PISTA_EMOJIS, PARAM_EMOJI_DE, posicionDelEmoji } from "./emojis";

/** El lado del PNG del emoji (Stickers › Emojis lo dibuja así: el render lo escala «contain» al lienzo). */
const LADO_PNG = 512;

const esEmojiDeSubtitulo = (el: { params?: ParamValues }) => typeof el.params?.[PARAM_EMOJI_DE] === "string" && el.params[PARAM_EMOJI_DE] !== "";

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
	lienzo: { width: number; height: number };
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
		const fontSize = Number(s.params.fontSize ?? 15) || 15;
		const pxLetra = (fontSize * lienzo.height) / FONT_SIZE_SCALE_REFERENCE;
		const renglones = String(s.params.content ?? "").split("\n").length;
		const pos = posicionDelEmoji({
			x: Number(s.params["transform.positionX"] ?? 0) || 0,
			y: Number(s.params["transform.positionY"] ?? 0) || 0,
			renglones,
			pxLetra,
			lienzo,
		});
		const base: ParamValues = {
			...paramsBase,
			"transform.positionX": pos.x,
			"transform.positionY": pos.y,
			"transform.scaleX": pos.escala,
			"transform.scaleY": pos.escala,
			[PARAM_EMOJI_DE]: s.id,
		};
		const anim = cambiosAlElegir({ valores: base, tipo: "sticker", D: s.duration / tps }, "entrada", "rebote");
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
			params: { ...base, ...anim },
		} as StickerElement;
	});
}

/** Las pistas sin los emojis de subtítulos (los de la persona quedan), y sin la pista «Emojis» si quedó vacía. */
export function sinEmojis(tracks: SceneTracks): SceneTracks {
	let cambio = false;
	const overlay = tracks.overlay.flatMap((t): OverlayTrack[] => {
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

/** Pone los emojis en la pista «Emojis» (arriba de todo), reemplazando los de antes. */
export function conEmojis({ tracks, emojis, nuevoId }: { tracks: SceneTracks; emojis: readonly StickerElement[]; nuevoId: () => string }): SceneTracks {
	const limpias = sinEmojis(tracks);
	if (!emojis.length) return limpias;
	const overlay = [...limpias.overlay];
	const i = overlay.findIndex((t) => t.type === "graphic" && t.name === NOMBRE_PISTA_EMOJIS);
	if (i >= 0) {
		overlay[i] = { ...overlay[i], elements: [...(overlay[i].elements as TimelineElement[]), ...emojis].sort((a, b) => a.startTime - b.startTime) } as OverlayTrack;
	} else {
		const pista = buildEmptyTrack({ id: nuevoId(), type: "graphic", name: NOMBRE_PISTA_EMOJIS });
		pista.elements = [...emojis];
		overlay.unshift(pista);
	}
	return { ...limpias, overlay };
}
