"use client";

import { useRef } from "react";
import { useContainerSize } from "@/app/video-editor/_opencut/hooks/use-container-size";
import {
	getCenteredLineLeft,
	TIMELINE_INDICATOR_LINE_WIDTH_PX,
	timelineTimeToSnappedPixels,
} from "@/app/video-editor/_opencut/timeline";
import { useScrollPosition } from "@/app/video-editor/_opencut/timeline/hooks/use-scroll-position";
import { useTimelinePlayhead } from "@/app/video-editor/_opencut/timeline/hooks/use-timeline-playhead";
import {
	addMediaTime,
	maxMediaTime,
	mediaTime,
	subMediaTime,
	TICKS_PER_SECOND,
	ZERO_MEDIA_TIME,
} from "@/app/video-editor/_opencut/wasm";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import { TIMELINE_SCROLLBAR_SIZE_PX } from "./layout";
import { TIMELINE_LAYERS } from "./layers";

interface TimelinePlayheadProps {
	zoomLevel: number;
	hasHorizontalScrollbar: boolean;
	rulerRef: React.RefObject<HTMLDivElement | null>;
	rulerScrollRef: React.RefObject<HTMLDivElement | null>;
	tracksScrollRef: React.RefObject<HTMLDivElement | null>;
	timelineRef: React.RefObject<HTMLDivElement | null>;
	playheadRef?: React.RefObject<HTMLDivElement | null>;
	isSnappingToPlayhead?: boolean;
}

export function TimelinePlayhead({
	zoomLevel,
	hasHorizontalScrollbar,
	rulerRef,
	rulerScrollRef,
	tracksScrollRef,
	timelineRef,
	playheadRef: externalPlayheadRef,
	isSnappingToPlayhead = false,
}: TimelinePlayheadProps) {
	const editor = useEditor();
	const duration = editor.timeline.getTotalDuration();
	const internalPlayheadRef = useRef<HTMLDivElement>(null);
	const playheadRef = externalPlayheadRef || internalPlayheadRef;

	const { handlePlayheadMouseDown } = useTimelinePlayhead({
		zoomLevel,
		rulerRef,
		rulerScrollRef,
		tracksScrollRef,
		playheadRef,
	});
	const { height: timelineHeight } = useContainerSize({ containerRef: timelineRef });
	const { height: tracksHeight } = useContainerSize({
		containerRef: tracksScrollRef,
	});
	const { scrollLeft } = useScrollPosition({ scrollRef: tracksScrollRef });

	const timelineContainerHeight =
		timelineHeight || tracksHeight || 400;
	const totalHeight = Math.max(
		0,
		timelineContainerHeight -
			(hasHorizontalScrollbar ? TIMELINE_SCROLLBAR_SIZE_PX - 5 : 0),
	);

	const currentTime = editor.playback.getCurrentTime();
	const centerPosition = timelineTimeToSnappedPixels({
		time: currentTime,
		zoomLevel,
	});
	const leftPosition =
		getCenteredLineLeft({ centerPixel: centerPosition }) - scrollLeft;

	const handlePlayheadKeyDown = (
		event: React.KeyboardEvent<HTMLDivElement>,
	) => {
		if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

		event.preventDefault();
		const fps = editor.project.getActive().settings.fps;
		const ticksPerFrame = mediaTime({
			ticks: Math.round(
				(TICKS_PER_SECOND * fps.denominator) / fps.numerator,
			),
		});
		const direction = event.key === "ArrowRight" ? 1 : -1;
		const now = editor.playback.getCurrentTime();
		const nextTime =
			direction > 0
				? addMediaTime({ a: now, b: ticksPerFrame })
				: subMediaTime({ a: now, b: ticksPerFrame });

		editor.playback.seek({
			time: maxMediaTime({
				a: ZERO_MEDIA_TIME,
				b: duration < nextTime ? duration : nextTime,
			}),
		});
	};

	return (
		<div
			ref={playheadRef}
			role="slider"
			aria-label="Cabezal"
			aria-valuemin={0}
			aria-valuemax={duration}
			aria-valuenow={currentTime}
			tabIndex={0}
			className="pointer-events-none absolute"
			style={{
				left: `${leftPosition}px`,
				top: 0,
				height: `${totalHeight}px`,
				width: `${TIMELINE_INDICATOR_LINE_WIDTH_PX}px`,
				zIndex: TIMELINE_LAYERS.playhead,
			}}
			onKeyDown={handlePlayheadKeyDown}
		>
			{/* El cabezal de CapCut: línea blanca y el «escudo» blanco sobre la regla. */}
			<div className="pointer-events-none absolute left-0 h-full w-px bg-(--cc-playhead)" />

			<button
				type="button"
				aria-label="Mover el cabezal"
				className={`pointer-events-auto absolute top-0 left-px h-3 w-[11px] -translate-x-1/2 cursor-col-resize bg-(--cc-playhead) shadow-xs ${isSnappingToPlayhead ? "outline outline-1 outline-(--cc-accent)" : ""}`}
				style={{ clipPath: "polygon(0 0, 100% 0, 100% 62%, 50% 100%, 0 62%)" }}
				onMouseDown={handlePlayheadMouseDown}
			/>
		</div>
	);
}
