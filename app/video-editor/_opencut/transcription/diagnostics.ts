import type { DiagnosticsManager } from "@/app/video-editor/_opencut/core/managers/diagnostics-manager";
import { timelineHasAudio } from "@/app/video-editor/_opencut/media/audio";

export const TRANSCRIPTION_DIAGNOSTICS_SCOPE = "transcription";

export function registerTranscriptionDiagnostics({
	diagnostics,
}: {
	diagnostics: DiagnosticsManager;
}): void {
	diagnostics.register({
		id: "transcription.no_audio",
		scope: TRANSCRIPTION_DIAGNOSTICS_SCOPE,
		severity: "caution",
		message: "Sin audio en la línea de tiempo",
		check: (editor) => {
			const scene = editor.scenes.getActiveSceneOrNull();
			if (!scene) return false;
			return !timelineHasAudio({
				tracks: scene.tracks,
				mediaAssets: editor.media.getAssets(),
			});
		},
	});
}
