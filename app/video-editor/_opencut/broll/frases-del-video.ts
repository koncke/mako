// =============================================================================
// Lo que se dice en el video, con sus tiempos (para el B-roll y los clips mágicos)
// =============================================================================
// Los subtítulos de la línea de tiempo, si hay (./pistas.ts → `frasesDeSubtitulos`); si no, el audio por Whisper en el
// navegador, como «Subtítulos automáticos», pero SIN ponerlos: ni el B-roll ni los clips obligan a subtitular.

import type { EditorCore } from "@/app/video-editor/_opencut/core";
import { extractTimelineAudio } from "@/app/video-editor/_opencut/media/mediabunny";
import { decodificarMono16k } from "@/app/video-editor/_opencut/transcription/audio";
import { armarSubtitulos, quitarNoVoz } from "@/app/video-editor/_opencut/transcription/caption";
import { maxCaracteresPara } from "@/app/video-editor/_opencut/transcription/caption-defaults";
import { transcriptionService } from "@/app/video-editor/_opencut/services/transcription/service";
import { TICKS_PER_SECOND } from "@/app/video-editor/_opencut/wasm";
import type { Frase } from "@/lib/editor-video/broll";
import { frasesDeSubtitulos } from "./pistas";

/** Lo que se dice: los subtítulos si hay; si no, transcripto ahora (progreso de 0 a 100). */
export async function frasesDelVideo(editor: EditorCore, alProgreso: (p: number) => void): Promise<Frase[]> {
	const deSubtitulos = frasesDeSubtitulos(editor.scenes.getActiveScene().tracks, TICKS_PER_SECOND);
	if (deSubtitulos.length) return deSubtitulos;
	const blob = await extractTimelineAudio({
		tracks: editor.scenes.getActiveScene().tracks,
		mediaAssets: editor.media.getAssets(),
		totalDuration: editor.timeline.getTotalDuration(),
		onProgress: (p) => alProgreso(Math.round(p / 3)),
	});
	const muestras = await decodificarMono16k(blob);
	const resultado = await transcriptionService.transcribe({
		audioData: muestras,
		language: "es",
		onProgress: (p) => alProgreso(33 + Math.round(p.progress * 0.67)),
	});
	const lienzo = editor.project.getActive().settings.canvasSize;
	return armarSubtitulos({ palabras: quitarNoVoz(resultado.palabras), maxCaracteres: maxCaracteresPara(lienzo) }).map((c) => ({
		texto: c.text,
		inicio: c.startTime,
		fin: c.startTime + c.duration,
	}));
}
