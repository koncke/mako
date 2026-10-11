import { useEffect, useReducer, useState } from "react";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import { useCommittedRef } from "@/app/video-editor/_opencut/hooks/use-committed-ref";
import { useIgnorarGuias } from "@/app/video-editor/_opencut/preview/hooks/use-ignorar-guias";
import { guiasParaIman } from "@/app/video-editor/_opencut/guides/guias-usuario";
import { usePreviewViewport } from "@/app/video-editor/_opencut/preview/components/preview-viewport";
import type { SnapLine } from "@/app/video-editor/_opencut/preview/preview-snap";
import { registerCanceller } from "@/app/video-editor/_opencut/editor/cancel-interaction";
import {
	PreviewInteractionController,
	type PreviewInteractionDeps,
	type PreviewInteractionDepsRef,
} from "@/app/video-editor/_opencut/preview/controllers/preview-interaction-controller";

export type OnSnapLinesChange = (lines: SnapLine[]) => void;

export function usePreviewInteraction({
	onSnapLinesChange,
	isMaskMode = false,
}: {
	onSnapLinesChange?: OnSnapLinesChange;
	isMaskMode?: boolean;
}) {
	const editor = useEditor();
	const ignorarGuiasRef = useIgnorarGuias();
	const viewport = usePreviewViewport();
	const deps: PreviewInteractionDeps = {
		viewport: {
			screenToCanvas: viewport.screenToCanvas,
			screenPixelsToLogicalThreshold: viewport.screenPixelsToLogicalThreshold,
		},
		input: {
			ignoraGuias: () => ignorarGuiasRef.current,
		},
		scene: {
			getTracks: () => editor.scenes.getActiveScene().tracks,
			getCurrentTime: () => editor.playback.getCurrentTime(),
			getMediaAssets: () => editor.media.getAssets(),
			getCanvasSize: () => editor.project.getActive().settings.canvasSize,
		},
		selection: {
			getSelected: () => editor.selection.getSelectedElements(),
			setSelected: (elements) =>
				editor.selection.setSelectedElements({ elements: [...elements] }),
			clearSelection: () => editor.selection.clearSelection(),
		},
		timeline: {
			getElementsWithTracks: ({ elements }) =>
				editor.timeline.getElementsWithTracks({ elements: [...elements] }),
			previewElements: (updates) =>
				editor.timeline.previewElements({ updates: [...updates] }),
			commitPreview: () => editor.timeline.commitPreview(),
			discardPreview: () => editor.timeline.discardPreview(),
		},
		playback: {
			getIsPlaying: () => editor.playback.getIsPlaying(),
			subscribe: (listener) => editor.playback.subscribe(listener),
		},
		preview: {
			isMaskMode: () => isMaskMode,
			onSnapLinesChange,
			getGuias: () => {
				const proyecto = editor.project.getActive();
				return guiasParaIman({
					proyecto: proyecto?.metadata.id,
					lienzo: proyecto.settings.canvasSize,
				});
			},
		},
	};
	const depsRef = useCommittedRef(deps) as PreviewInteractionDepsRef;
	const [controller] = useState(
		() => new PreviewInteractionController({ depsRef }),
	);

	const [, rerender] = useReducer((n: number) => n + 1, 0);
	useEffect(
		() => controller.subscribe({ listener: rerender }),
		[controller],
	);

	useEffect(() => {
		if (!controller.isDragging) return;
		return registerCanceller({ fn: () => controller.cancel() });
	}, [controller.isDragging, controller]);

	useEffect(() => () => controller.destroy(), [controller]);

	return {
		onPointerDown: controller.onPointerDown,
		onPointerMove: controller.onPointerMove,
		onPointerUp: controller.onPointerUp,
		onDoubleClick: controller.onDoubleClick,
		editingText: controller.editingText,
		commitTextEdit: controller.commitTextEdit,
	};
}
