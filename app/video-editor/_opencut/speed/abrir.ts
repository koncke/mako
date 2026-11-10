// =============================================================================
// Ctrl+R «Mostrar el panel de velocidad» y Shift+B «Velocidad de la curva»
// =============================================================================
// Atajos del preset «CapCut» (relevamiento-capcut-armazon §10). No hay otro
// panel: abren la pestaña «Velocidad» que ya registra ./registro.ts, en el panel
// derecho del clip elegido, igual que Video › «Eliminar fondo» lo abre
// fondo/registro.tsx (`abrirEliminarFondo`): escribiendo la vista en
// properties-store.
//
// Con un clip elegido, de video o audio (la Curva, sólo video: el audio no la
// tiene). Sin eso no hay panel de velocidad que mostrar y la tecla no hace nada,
// como «Extraer/Restaurar el audio».

import type { EditorCore } from "@/app/video-editor/_opencut/core";
import { usePropertiesStore } from "@/app/video-editor/_opencut/components/editor/panels/properties/stores/properties-store";

export const PESTANA_VELOCIDAD = "velocidad";
export const SUBPESTANA_ESTANDAR = "velocidad-estandar";
export const SUBPESTANA_CURVA = "velocidad-curva";

/** El clip elegido que tiene «Velocidad» (uno solo, de video o audio). */
function clipConVelocidad(editor: EditorCore): { tipo: "video" | "audio" } | null {
	const seleccion = editor.selection.getSelectedElements();
	if (seleccion.length !== 1) return null;
	const [con] = editor.timeline.getElementsWithTracks({ elements: seleccion });
	if (!con) return null;
	const tipo = con.element.type;
	return tipo === "video" || tipo === "audio" ? { tipo } : null;
}

/**
 * Ctrl+R: la pestaña «Velocidad», en la sub-pestaña que se usó la última vez
 * (lo que hace un clic en la pestaña: properties/index.tsx → elegirPestana).
 */
export function mostrarPanelVelocidad(editor: EditorCore): void {
	const clip = clipConVelocidad(editor);
	if (!clip) return;
	const store = usePropertiesStore.getState();
	const recordada = store.subpestanaPorPestana[`${clip.tipo}:${PESTANA_VELOCIDAD}`];
	const sub = recordada === SUBPESTANA_CURVA && clip.tipo === "video" ? SUBPESTANA_CURVA : SUBPESTANA_ESTANDAR;
	store.setActiveTab({ elementType: clip.tipo, tabId: sub });
}

/** Shift+B: Velocidad › «Curva» (sólo un clip de video). */
export function mostrarVelocidadCurva(editor: EditorCore): void {
	const clip = clipConVelocidad(editor);
	if (!clip || clip.tipo !== "video") return;
	const store = usePropertiesStore.getState();
	store.setActiveTab({ elementType: clip.tipo, tabId: SUBPESTANA_CURVA });
	store.recordarSubpestana({ elementType: clip.tipo, pestana: PESTANA_VELOCIDAD, subpestana: SUBPESTANA_CURVA });
}
