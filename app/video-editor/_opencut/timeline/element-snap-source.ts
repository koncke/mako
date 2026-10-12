import type { SceneTracks } from "@/app/video-editor/_opencut/timeline";
import type { SnapPoint } from "@/app/video-editor/_opencut/timeline/snapping";
import { TICKS_PER_SECOND, addMediaTime, roundMediaTime } from "@/app/video-editor/_opencut/wasm";
import { ritmosEnClip } from "@/app/video-editor/_opencut/audio/ritmos";

export function getElementEdgeSnapPoints({
	tracks,
	excludeElementIds,
}: {
	tracks: SceneTracks;
	excludeElementIds?: Set<string>;
}): SnapPoint[] {
	const snapPoints: SnapPoint[] = [];
	const orderedTracks = [...tracks.overlay, tracks.main, ...tracks.audio];

	for (const track of orderedTracks) {
		for (const element of track.elements) {
			if (excludeElementIds?.has(element.id)) {
				continue;
			}

			snapPoints.push(
				{
					time: element.startTime,
					type: "element-start",
					elementId: element.id,
					trackId: track.id,
				},
				{
					time: addMediaTime({ a: element.startTime, b: element.duration }),
					type: "element-end",
					elementId: element.id,
					trackId: track.id,
				},
			);

			// Los ritmos de un audio también imantan, como en CapCut: para
			// cortar o encajar un clip justo en el golpe.
			if (element.type === "audio") {
				for (const t of ritmosEnClip(element)) {
					snapPoints.push({
						time: roundMediaTime({ time: element.startTime + t * TICKS_PER_SECOND }),
						type: "ritmo",
						elementId: element.id,
						trackId: track.id,
					});
				}
			}
		}
	}

	return snapPoints;
}
