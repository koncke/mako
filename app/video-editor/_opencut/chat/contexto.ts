// =============================================================================
// chat/contexto — lo que la vista y la revisión del chat leen del EDITOR
// =============================================================================
// Lo mismo al pedir (PanelChat.tsx) y al aceptar (aplicar.ts): si al aceptar se mirara
// otra cosa que al pedir, una propuesta válida se descartaría (o al revés).
//   · lo disponible del motor, con la lista de Google Fonts del selector de fuentes
//     (async la primera vez; después queda en caché, fonts/google-fonts.ts);
//   · el lienzo, los medios sin sonido y la transcripción, de la línea de tiempo dada.
// =============================================================================

import type { EditorCore } from "@/app/video-editor/_opencut/core";
import type { SceneTracks, TextElement } from "@/app/video-editor/_opencut/timeline/types";
import { loadFontAtlas } from "@/app/video-editor/_opencut/fonts/google-fonts";
import { transcripcionDe } from "@/app/video-editor/_opencut/transcripcion/modelo";
import { usePreferenciasSubtitulos } from "@/app/video-editor/_opencut/subtitles/estado";
import { TICKS_PER_SECOND } from "@/app/video-editor/_opencut/wasm";
import { disponiblesDelMotor, type Disponibles } from "./disponibles";
import type { TranscripcionChat } from "./linea";

/** Lo que el motor tiene con nombre. La lista de fuentes puede no cargar: entonces valen las del sistema y las del proyecto. */
export async function disponiblesChat(editor: EditorCore): Promise<Disponibles> {
	const atlas = await loadFontAtlas().catch(() => null);
	const tracks = editor.scenes.getActiveSceneOrNull()?.tracks;
	const fuentesProyecto = tracks
		? [
				...new Set(
					tracks.overlay
						.flatMap((t) => (t.type === "text" ? (t.elements as TextElement[]) : []))
						.map((e) => String(e.params.fontFamily ?? ""))
						.filter(Boolean),
				),
			]
		: [];
	return disponiblesDelMotor({ atlas, fuentesProyecto });
}

/** El resto de lo que ven la vista y la revisión, de ESTA línea de tiempo. */
export function datosDeLinea(editor: EditorCore, tracks: SceneTracks): {
	lienzo: { ancho: number; alto: number } | null;
	mediosSinAudio: Set<string>;
	transcripcion: TranscripcionChat;
	conPalabras: boolean;
} {
	const canvas = editor.project.getActiveOrNull()?.settings.canvasSize;
	const parrafos = transcripcionDe({ tracks, tps: TICKS_PER_SECOND });
	return {
		lienzo: canvas ? { ancho: canvas.width, alto: canvas.height } : null,
		mediosSinAudio: new Set(editor.media.getAssets().filter((a) => a.hasAudio === false).map((a) => a.id)),
		transcripcion: { parrafos, idioma: usePreferenciasSubtitulos.getState().idioma },
		conPalabras: parrafos.some((p) => p.palabras.length > 0),
	};
}
