import type { SelectedKeyframeRef } from "@/app/video-editor/_opencut/animation/types";
import type { ElementRef } from "@/app/video-editor/_opencut/timeline/types";

export interface SelectedMaskPointSelection {
	trackId: string;
	elementId: string;
	maskId: string;
	pointIds: string[];
}

export interface EditorSelectionSnapshot {
	selectedElements: ElementRef[];
	selectedKeyframes: SelectedKeyframeRef[];
	keyframeSelectionAnchor: SelectedKeyframeRef | null;
	selectedMaskPoints: SelectedMaskPointSelection | null;
}

export interface EditorSelectionPatch {
	selectedElements?: ElementRef[];
	selectedKeyframes?: SelectedKeyframeRef[];
	keyframeSelectionAnchor?: SelectedKeyframeRef | null;
	selectedMaskPoints?: SelectedMaskPointSelection | null;
}

export type EditorSelectionKind = "mask-points" | "keyframes" | "elements";
