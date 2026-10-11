import type { TrackType } from "@/app/video-editor/_opencut/timeline";
import {
	KEYFRAME_LANE_HEIGHT_PX,
	TIMELINE_MAIN_TRACK_HEIGHT_PX,
	TIMELINE_TRACK_GAP_PX,
	TIMELINE_TRACK_HEIGHTS_PX,
} from "./layout";

// La altura depende del tipo Y de si es la pista principal (en CapCut la
// principal es la más alta). Todas las funciones que apilan pistas reciben el
// id de la principal; quien no lo pasa obtiene la altura de una superposición,
// así que cualquier cálculo nuevo de posiciones tiene que pasarlo o se
// desalinea del dibujo justo en la fila más grande.

type PistaParaAltura = { type: TrackType; id?: string };

export function getTrackHeight({
	type,
	isMain = false,
}: {
	type: TrackType;
	isMain?: boolean;
}): number {
	if (isMain && type === "video") return TIMELINE_MAIN_TRACK_HEIGHT_PX;
	return TIMELINE_TRACK_HEIGHTS_PX[type];
}

function alturaDe(track: PistaParaAltura, mainTrackId?: string | null): number {
	return getTrackHeight({
		type: track.type,
		isMain: !!mainTrackId && track.id === mainTrackId,
	});
}

export function getExpandedTrackHeight({
	type,
	isMain = false,
	expandedLaneCount,
}: {
	type: TrackType;
	isMain?: boolean;
	expandedLaneCount: number;
}): number {
	return (
		getTrackHeight({ type, isMain }) +
		expandedLaneCount * KEYFRAME_LANE_HEIGHT_PX
	);
}

export function getCumulativeHeightBefore({
	tracks,
	trackIndex,
	getExtraHeight,
	mainTrackId,
}: {
	tracks: Array<PistaParaAltura>;
	trackIndex: number;
	getExtraHeight?: (trackIndex: number) => number;
	mainTrackId?: string | null;
}): number {
	return tracks
		.slice(0, trackIndex)
		.reduce(
			(sum, track, i) =>
				sum +
				alturaDe(track, mainTrackId) +
				(getExtraHeight?.(i) ?? 0) +
				TIMELINE_TRACK_GAP_PX,
			0,
		);
}

export function getTotalTracksHeight({
	tracks,
	getExtraHeight,
	mainTrackId,
}: {
	tracks: Array<PistaParaAltura>;
	getExtraHeight?: (trackIndex: number) => number;
	mainTrackId?: string | null;
}): number {
	const tracksHeight = tracks.reduce(
		(sum, track, i) =>
			sum + alturaDe(track, mainTrackId) + (getExtraHeight?.(i) ?? 0),
		0,
	);
	const gapsHeight = Math.max(0, tracks.length - 1) * TIMELINE_TRACK_GAP_PX;
	return tracksHeight + gapsHeight;
}

/** Altura de una pista de la lista ordenada (superposiciones, principal, audio). */
export function getTrackHeightFor({
	track,
	mainTrackId,
}: {
	track: PistaParaAltura;
	mainTrackId?: string | null;
}): number {
	return alturaDe(track, mainTrackId);
}
