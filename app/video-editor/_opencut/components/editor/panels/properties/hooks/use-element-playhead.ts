import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import { getElementLocalTime } from "@/app/video-editor/_opencut/animation";
import { addMediaTime, mediaTime, type MediaTime } from "@/app/video-editor/_opencut/wasm";

export function useElementPlayhead({
	startTime,
	duration,
}: {
	startTime: MediaTime;
	duration: MediaTime;
}) {
	const playheadTime = useEditor((editor) => editor.playback.getCurrentTime());
	const localTime = mediaTime({
		ticks: getElementLocalTime({
			timelineTime: playheadTime,
			elementStartTime: startTime,
			elementDuration: duration,
		}),
	});
	const isPlayheadWithinElementRange =
		playheadTime >= startTime &&
		playheadTime <= addMediaTime({ a: startTime, b: duration });

	return { localTime, isPlayheadWithinElementRange };
}
