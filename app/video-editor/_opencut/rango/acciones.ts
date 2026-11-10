// =============================================================================
// El rango sobre el editor: lo que hacen I, O, Shift+X y Alt+X
// =============================================================================
// Las reglas (qué marca queda, qué tramo vale) son de ./reglas.ts; acá sólo se
// lee el cabezal, la selección y el proyecto, y se guarda en ./rango-store.ts.
// Lo atan a sus teclas actions/use-editor-actions.ts; lo lee Exportar
// (export/exportar.ts → datosDelProyecto) y lo dibuja la regla
// (./components/rango-regla.tsx).

import type { EditorCore } from "@/app/video-editor/_opencut/core";
import { marcasDe, useRangoStore } from "./rango-store";
import {
	SIN_MARCAS,
	clipEnElTiempo,
	marcarEntrada,
	marcarSalida,
	marcasDeClips,
	tramoEfectivo,
	type MarcasRango,
	type Tramo,
} from "./reglas";

function proyectoDe(editor: EditorCore): string | null {
	return editor.project.getActiveOrNull()?.metadata.id ?? null;
}

function cambiar(editor: EditorCore, fn: (m: MarcasRango) => MarcasRango | null): void {
	const proyecto = proyectoDe(editor);
	if (!proyecto) return;
	const nuevas = fn(marcasDe(proyecto));
	if (nuevas) useRangoStore.getState().fijar(proyecto, nuevas);
}

/** I: «Punto de entrada» en el cabezal. */
export function marcarEntradaEnCabezal(editor: EditorCore): void {
	cambiar(editor, (m) => marcarEntrada(m, editor.playback.getCurrentTime()));
}

/** O: «Punto de salida» en el cabezal. */
export function marcarSalidaEnCabezal(editor: EditorCore): void {
	cambiar(editor, (m) => marcarSalida(m, editor.playback.getCurrentTime()));
}

/**
 * Shift+X: «Seleccionar por clip». El rango pasa a ser el de los clips
 * elegidos; sin nada elegido, el de la pista principal bajo el cabezal (como
 * Dividir). Sin clip, no cambia nada.
 */
export function marcarRangoDelClip(editor: EditorCore): void {
	cambiar(editor, () => {
		const elegidos = editor.timeline
			.getElementsWithTracks({ elements: editor.selection.getSelectedElements() })
			.map(({ element }) => element);
		if (elegidos.length > 0) return marcasDeClips(elegidos);
		const principal = editor.scenes.getActiveSceneOrNull()?.tracks.main;
		if (!principal) return null;
		const clip = clipEnElTiempo(principal.elements, editor.playback.getCurrentTime());
		return clip ? marcasDeClips([clip]) : null;
	});
}

/** Alt+X: «Anular selección» (del rango). */
export function quitarRango(editor: EditorCore): void {
	cambiar(editor, () => SIN_MARCAS);
}

/** El tramo que vale ahora (o `null`): el que se dibuja y el que se exporta. */
export function tramoVigente(editor: EditorCore): Tramo | null {
	return tramoEfectivo(marcasDe(proyectoDe(editor)), editor.timeline.getTotalDuration());
}
