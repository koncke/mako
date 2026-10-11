import type { TrackType } from "@/app/video-editor/_opencut/timeline";

// Medidas de la línea de tiempo de CapCut Desktop 9.3: los px de las capturas
// oficiales (Windows al 125 %) divididos por 1,25 (relevamiento-capcut-armazon
// §1 y §7). La pista principal es más alta que las superposiciones; texto,
// stickers y efectos van en filas finas; el audio, a media altura.
export const TIMELINE_TRACK_HEIGHTS_PX: Record<TrackType, number> = {
	video: 60,
	text: 28,
	audio: 52,
	graphic: 28,
	effect: 28,
} as const;

/** La pista principal (~110 px en la captura). */
export const TIMELINE_MAIN_TRACK_HEIGHT_PX = 88;

export const KEYFRAME_LANE_HEIGHT_PX = 20;
export const KEYFRAME_DIAMOND_SIZE_PX = 14;
export const EXPANDED_GROUP_HEADER_HEIGHT_PX = 18;

export const TIMELINE_TRACK_GAP_PX = 5;
/** Cabecera de pistas (184 px → 147). */
export const TIMELINE_TRACK_HEADER_WIDTH_PX = 147;
/** Columna del botón «Portada», entre las cabeceras y las pistas (70 px → 56). */
export const TIMELINE_COVER_COLUMN_WIDTH_PX = 56;
/** Todo lo que queda a la izquierda del 0 de la regla. */
export const TIMELINE_TRACK_LABELS_COLUMN_WIDTH_PX =
	TIMELINE_TRACK_HEADER_WIDTH_PX + TIMELINE_COVER_COLUMN_WIDTH_PX;
export const TIMELINE_RULER_HEIGHT_PX = 22;
export const TIMELINE_BOOKMARK_ROW_HEIGHT_PX = 16;
export const TIMELINE_SCROLLBAR_SIZE_PX = 12;
export const TIMELINE_CONTENT_TOP_PADDING_PX = 2;
/** Barra de herramientas (48 px → 38). */
export const TIMELINE_TOOLBAR_HEIGHT_PX = 38;

/** Clip de video: franja del nombre arriba y onda del audio abajo (20 y 22 px en la captura). */
export const CLIP_NAME_STRIP_HEIGHT_PX = 16;
export const CLIP_WAVE_STRIP_HEIGHT_PX = 18;
