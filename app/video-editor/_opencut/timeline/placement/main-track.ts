import type { SceneTracks, TimelineElement, VideoTrack } from "@/app/video-editor/_opencut/timeline";
import { type MediaTime, ZERO_MEDIA_TIME } from "@/app/video-editor/_opencut/wasm";
import { useTimelineStore } from "@/app/video-editor/_opencut/timeline/timeline-store";

export const MAIN_TRACK_NAME = "Main Track";

export function getEarliestMainTrackElement({
	mainTrack,
	excludeElementId,
}: {
	mainTrack: VideoTrack;
	excludeElementId?: string;
}): TimelineElement | null {
	const elements = mainTrack.elements.filter((element) => {
		return !excludeElementId || element.id !== excludeElementId;
	});
	if (elements.length === 0) {
		return null;
	}

	return elements.reduce((earliestElement, element) => {
		return element.startTime < earliestElement.startTime
			? element
			: earliestElement;
	});
}

/**
 * Con el imán, lo que se suelta en la pista principal cae en el BORDE de clip
 * más cercano (antes o después del clip que tiene abajo), como en CapCut: el
 * imán después empaqueta y empuja a los que siguen (ripple/iman.ts).
 */
function bordeMasCercano({
	mainTrack,
	requestedStartTime,
	excludeElementId,
}: {
	mainTrack: VideoTrack;
	requestedStartTime: MediaTime;
	excludeElementId?: string;
}): MediaTime {
	const otros = mainTrack.elements.filter((e) => e.id !== excludeElementId);
	const debajo = otros.find(
		(e) =>
			requestedStartTime >= e.startTime &&
			requestedStartTime < e.startTime + e.duration,
	);
	if (!debajo) return requestedStartTime;
	const mitad = debajo.startTime + debajo.duration / 2;
	return requestedStartTime < mitad
		? debajo.startTime
		: ((debajo.startTime + debajo.duration) as MediaTime);
}

export function enforceMainTrackStart({
	tracks,
	targetTrackId,
	requestedStartTime,
	excludeElementId,
}: {
	tracks: SceneTracks;
	targetTrackId: string;
	requestedStartTime: MediaTime;
	excludeElementId?: string;
}): MediaTime {
	if (tracks.main.id !== targetTrackId) {
		return requestedStartTime;
	}

	const earliestElement = getEarliestMainTrackElement({
		mainTrack: tracks.main,
		excludeElementId,
	});
	if (!earliestElement) {
		return ZERO_MEDIA_TIME;
	}

	if (requestedStartTime <= earliestElement.startTime) {
		return ZERO_MEDIA_TIME;
	}

	if (useTimelineStore.getState().rippleEditingEnabled) {
		return bordeMasCercano({
			mainTrack: tracks.main,
			requestedStartTime,
			excludeElementId,
		});
	}

	return requestedStartTime;
}
