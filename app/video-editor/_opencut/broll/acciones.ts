// =============================================================================
// B-roll y planos: DEJAR o SACAR lo que MaKo propuso (un paso de deshacer cada vez)
// =============================================================================
// Las reglas son puras (./pistas.ts → `dejarPropuestas`, `sacarPropuestas`): acá sólo se aplican sobre la escena de
// AHORA con un TracksSnapshotCommand, así Ctrl+Z devuelve la propuesta. Lo que no lleva la marca de propuesta no se
// toca nunca. La foto que se saca queda en Multimedia (la persona puede usarla igual).

import type { EditorCore } from "@/app/video-editor/_opencut/core";
import { TracksSnapshotCommand } from "@/app/video-editor/_opencut/commands/timeline/tracks-snapshot";
import { dejarPropuestas, sacarPropuestas } from "./pistas";

function aplicar(editor: EditorCore, cambiar: Parameters<typeof dejarPropuestas>[0] extends infer T ? (t: T) => T : never): boolean {
	const escena = editor.scenes.getActiveSceneOrNull();
	if (!escena) return false;
	const before = escena.tracks;
	const after = cambiar(before);
	if (after === before) return false;
	editor.command.execute({ command: new TracksSnapshotCommand({ before, after }) });
	return true;
}

/** Deja esas propuestas (todas, sin `ids`): quedan como cualquier otro elemento. */
export function dejar(editor: EditorCore, ids?: readonly string[]): boolean {
	const set = ids ? new Set(ids) : undefined;
	return aplicar(editor, (t) => dejarPropuestas(t, set));
}

/** Saca esas propuestas (todas, sin `ids`). */
export function sacar(editor: EditorCore, ids?: readonly string[]): boolean {
	const set = ids ? new Set(ids) : undefined;
	return aplicar(editor, (t) => sacarPropuestas(t, set));
}
