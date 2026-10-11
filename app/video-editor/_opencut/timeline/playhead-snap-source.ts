import type { SnapPoint } from "@/app/video-editor/_opencut/timeline/snapping";
import type { MediaTime } from "@/app/video-editor/_opencut/wasm";

export function getPlayheadSnapPoints({
	playheadTime,
}: {
	playheadTime: MediaTime;
}): SnapPoint[] {
	return [{ time: playheadTime, type: "playhead" }];
}
