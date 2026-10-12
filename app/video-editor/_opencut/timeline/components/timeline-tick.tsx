"use client";

import type { FrameRate } from "@/app/video-editor/_opencut/wasm/opencut";
import { timelineTimeToSnappedPixels } from "@/app/video-editor/_opencut/timeline";
import { formatRulerLabel } from "@/app/video-editor/_opencut/timeline/ruler-utils";

interface TimelineTickProps {
	time: number;
	timeInSeconds: number;
	zoomLevel: number;
	fps: FrameRate;
	showLabel: boolean;
}

export function TimelineTick({
	time,
	timeInSeconds,
	zoomLevel,
	fps,
	showLabel,
}: TimelineTickProps) {
	const leftPosition = timelineTimeToSnappedPixels({ time, zoomLevel });

	// Como la regla de CapCut: «|00:05» (la marca alta y el rótulo a su
	// derecha) y marcas cortas entre rótulos, todo en gris `#555`.
	if (showLabel) {
		const label = formatRulerLabel({ timeInSeconds, fps });
		return (
			<span
				className="absolute top-0 flex h-full select-none items-start border-l border-(--cc-ruler) pt-[3px] pl-1 text-[10px] leading-none text-(--cc-ruler)"
				style={{ left: `${leftPosition}px` }}
			>
				{label}
			</span>
		);
	}

	return (
		<div
			className="absolute bottom-0 h-1.5 border-l border-(--cc-ruler)/70"
			style={{ left: `${leftPosition}px` }}
		/>
	);
}
