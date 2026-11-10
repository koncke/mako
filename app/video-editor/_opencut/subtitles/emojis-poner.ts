// =============================================================================
// «Emojis automáticos»: ponerlos o sacarlos en el proyecto abierto, en UN paso de deshacer
// =============================================================================
// Lo deciden ./emojis.ts (qué emoji) y ./emojis-pista.ts (dónde y cómo). Lo llaman el interruptor de Subtítulos
// automáticos (al generar), la sección «Emojis» de la pestaña Subtítulos y la operación del chat `emojis_subtitulos`.

import type { EditorCore } from "@/app/video-editor/_opencut/core";
import { TracksSnapshotCommand } from "@/app/video-editor/_opencut/commands/timeline/tracks-snapshot";
import { buildStickerElement } from "@/app/video-editor/_opencut/timeline/element-utils";
import { generateUUID } from "@/app/video-editor/_opencut/utils/id";
import { TICKS_PER_SECOND, ZERO_MEDIA_TIME } from "@/app/video-editor/_opencut/wasm";
import { lienzoDe, subtitulosDe } from "./insert";
import { armarEmojis, conEmojis, cuantosEmojis, sinEmojis } from "./emojis-pista";

/**
 * Prende (pone un emoji en cada subtítulo que dice algo que se puede dibujar, reemplazando los de antes) o apaga (los
 * saca). Devuelve cuántos emojis quedaron. Sin subtítulos o sin nada que cambiar, no deja un paso de deshacer.
 */
export function ponerEmojisEnSubtitulos({ editor, activar }: { editor: EditorCore; activar: boolean }): number {
	const escena = editor.scenes.getActiveSceneOrNull();
	if (!escena) return 0;
	const before = escena.tracks;
	let after = sinEmojis(before);
	if (activar) {
		const subtitulos = subtitulosDe(before)
			.map(({ element }) => element)
			.sort((a, b) => a.startTime - b.startTime);
		const paramsBase = buildStickerElement({ stickerId: "emojis:1f600", startTime: ZERO_MEDIA_TIME }).params;
		const emojis = armarEmojis({ subtitulos, tps: TICKS_PER_SECOND, lienzo: lienzoDe(editor), paramsBase, nuevoId: generateUUID });
		after = conEmojis({ tracks: after, emojis, nuevoId: generateUUID });
	}
	if (after !== before) editor.command.execute({ command: new TracksSnapshotCommand({ before, after }) });
	return cuantosEmojis(after);
}
