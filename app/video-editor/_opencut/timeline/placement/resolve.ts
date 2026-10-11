import type { SceneTracks, TrackType, TimelineTrack } from "@/app/video-editor/_opencut/timeline";
import {
	getDefaultInsertIndexForTrack,
	getHighestInsertIndexForTrack,
	resolvePreferredNewTrackPlacement,
} from "./insert-index";
import { getTrackTypeForElementType } from "./compatibility";
import { enforceMainTrackStart } from "./main-track";
import { canPlaceTimeSpansOnTrack as cabeSinSolaparse } from "./overlap";
import { useTimelineStore } from "@/app/video-editor/_opencut/timeline/timeline-store";
import type {
	PlacementResult,
	PlacementStrategy,
	PlacementSubject,
	PlacementTimeSpan,
} from "./types";
import { ZERO_MEDIA_TIME } from "@/app/video-editor/_opencut/wasm";

/**
 * Con el «Imán de la pista principal» prendido, soltar un clip ENCIMA de otro
 * en la principal lo INSERTA (el imán empuja a los de después: ripple/iman.ts),
 * como en CapCut; sin imán, como en OpenCut, se va a otra pista. Una pista
 * bloqueada no acepta nada.
 */
function canPlaceTimeSpansOnTrack({
	track,
	timeSpans,
	mainTrackId,
}: {
	track: TimelineTrack;
	timeSpans: PlacementTimeSpan[];
	mainTrackId?: string;
}): boolean {
	if (track.locked) return false;
	if (
		mainTrackId !== undefined &&
		track.id === mainTrackId &&
		useTimelineStore.getState().rippleEditingEnabled
	) {
		return true;
	}
	return cabeSinSolaparse({ track, timeSpans });
}

type ResolveTrackPlacementParams = PlacementSubject & {
	tracks: SceneTracks;
	timeSpans: PlacementTimeSpan[];
	strategy: PlacementStrategy;
};

function buildExistingTrackResult({
	track,
	trackIndex,
	tracks,
	timeSpans,
}: {
	track: TimelineTrack;
	trackIndex: number;
	tracks: SceneTracks;
	timeSpans: PlacementTimeSpan[];
}): PlacementResult {
	const firstSpan = timeSpans[0];
	const requestedStartTime = firstSpan?.startTime ?? ZERO_MEDIA_TIME;
	const adjustedStartTime = enforceMainTrackStart({
		tracks,
		targetTrackId: track.id,
		requestedStartTime,
		excludeElementId: firstSpan?.excludeElementId,
	});
	return {
		kind: "existingTrack",
		trackId: track.id,
		trackIndex,
		trackType: track.type,
		...(adjustedStartTime !== requestedStartTime ? { adjustedStartTime } : {}),
	};
}

function buildNewTrackResult({
	trackType,
	insertIndex,
	insertPosition,
}: {
	trackType: TrackType;
	insertIndex: number;
	insertPosition: "above" | "below" | null;
}): PlacementResult {
	return {
		kind: "newTrack",
		trackType,
		insertIndex,
		insertPosition,
	};
}

function findFirstAvailableTrackIndex({
	tracks,
	trackType,
	timeSpans,
	mainTrackId,
}: {
	tracks: TimelineTrack[];
	trackType: TrackType;
	timeSpans: PlacementTimeSpan[];
	mainTrackId?: string;
}): number {
	return tracks.findIndex((track) => {
		return (
			track.type === trackType &&
			canPlaceTimeSpansOnTrack({
				track,
				timeSpans,
				mainTrackId,
			})
		);
	});
}

function resolveAlwaysNewTrack({
	tracks,
	trackType,
	position,
}: {
	tracks: SceneTracks;
	trackType: TrackType;
	position: "highest" | "default";
}): PlacementResult {
	const insertIndex =
		position === "highest"
			? getHighestInsertIndexForTrack({
					tracks,
					trackType,
				})
			: getDefaultInsertIndexForTrack({
					tracks,
					trackType,
				});

	return buildNewTrackResult({
		trackType,
		insertIndex,
		insertPosition: null,
	});
}

function getInsertDirection({
	hoverDirection,
	verticalDragDirection,
}: {
	hoverDirection: "above" | "below";
	verticalDragDirection?: "up" | "down" | null;
}): "above" | "below" {
	if (verticalDragDirection === "up") {
		return "above";
	}

	if (verticalDragDirection === "down") {
		return "below";
	}

	return hoverDirection;
}

export function resolveTrackPlacement({
	tracks,
	...placement
}: ResolveTrackPlacementParams): PlacementResult | null {
	const orderedTracks = [...tracks.overlay, tracks.main, ...tracks.audio];
	const trackType =
		"trackType" in placement
			? placement.trackType
			: getTrackTypeForElementType({
					elementType: placement.elementType,
				});
	const { timeSpans, strategy } = placement;

	if (strategy.type === "explicit") {
		const trackIndex = orderedTracks.findIndex(
			(track) => track.id === strategy.trackId,
		);
		if (trackIndex < 0) {
			return null;
		}

		const track = orderedTracks[trackIndex];
		if (track.type !== trackType || track.locked) {
			return null;
		}

		return buildExistingTrackResult({
			track,
			trackIndex,
			tracks,
			timeSpans,
		});
	}

	if (strategy.type === "firstAvailable") {
		const existingTrackIndex = findFirstAvailableTrackIndex({
			tracks: orderedTracks,
			trackType,
			timeSpans,
			mainTrackId: tracks.main.id,
		});
		if (existingTrackIndex >= 0) {
			return buildExistingTrackResult({
				track: orderedTracks[existingTrackIndex],
				trackIndex: existingTrackIndex,
				tracks,
				timeSpans,
			});
		}

		return resolveAlwaysNewTrack({
			tracks,
			trackType,
			position: "highest",
		});
	}

	if (strategy.type === "preferIndex") {
		const preferredTrack = orderedTracks[strategy.trackIndex];
		const isPreferredTrackCompatible =
			!!preferredTrack && preferredTrack.type === trackType;
		const canUseExistingTrack =
			!strategy.createNewTrackOnly &&
			isPreferredTrackCompatible &&
			canPlaceTimeSpansOnTrack({
				track: preferredTrack,
				timeSpans,
				mainTrackId: tracks.main.id,
			});
		if (canUseExistingTrack) {
			return buildExistingTrackResult({
				track: preferredTrack,
				trackIndex: strategy.trackIndex,
				tracks,
				timeSpans,
			});
		}

		const { insertIndex, insertPosition } = resolvePreferredNewTrackPlacement({
			tracks,
			trackType,
			preferredIndex: strategy.trackIndex,
			direction: getInsertDirection({
				hoverDirection: strategy.hoverDirection,
				verticalDragDirection: !isPreferredTrackCompatible
					? strategy.verticalDragDirection
					: null,
			}),
		});
		return buildNewTrackResult({
			trackType,
			insertIndex,
			insertPosition,
		});
	}

	if (strategy.type === "aboveSource") {
		const aboveTrackIndex = strategy.sourceTrackIndex - 1;
		const aboveTrack = orderedTracks[aboveTrackIndex];
		if (
			aboveTrack &&
			aboveTrack.type === trackType &&
			canPlaceTimeSpansOnTrack({
				track: aboveTrack,
				timeSpans,
				mainTrackId: tracks.main.id,
			})
		) {
			return buildExistingTrackResult({
				track: aboveTrack,
				trackIndex: aboveTrackIndex,
				tracks,
				timeSpans,
			});
		}

		const firstAvailableTrackIndex = findFirstAvailableTrackIndex({
			tracks: orderedTracks,
			trackType,
			timeSpans,
			mainTrackId: tracks.main.id,
		});
		if (firstAvailableTrackIndex >= 0) {
			return buildExistingTrackResult({
				track: orderedTracks[firstAvailableTrackIndex],
				trackIndex: firstAvailableTrackIndex,
				tracks,
				timeSpans,
			});
		}

		const insertIndex = getHighestInsertIndexForTrack({
			tracks,
			trackType,
		});

		return buildNewTrackResult({
			trackType,
			insertIndex,
			insertPosition: null,
		});
	}

	return resolveAlwaysNewTrack({
		tracks,
		trackType,
		position: strategy.position,
	});
}
