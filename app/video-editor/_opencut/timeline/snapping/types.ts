import type { MediaTime } from "@/app/video-editor/_opencut/wasm";

export type SnapPointType =
	| "element-start"
	| "element-end"
	| "playhead"
	| "bookmark"
	| "keyframe"
	// Los ritmos marcados de un clip de audio (paquete J, audio/ritmos.ts).
	| "ritmo";

export interface SnapPoint {
	time: MediaTime;
	type: SnapPointType;
	elementId?: string;
	trackId?: string;
}

export interface SnapResult {
	snappedTime: MediaTime;
	snapPoint: SnapPoint | null;
	snapDistance: number;
}

export type TimelineSnapPointSource = () => Iterable<SnapPoint>;
