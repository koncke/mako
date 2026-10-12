// =============================================================================
// Transiciones: lo que hace el usuario (poner, soltar, aplicar a todo, quitar)
// =============================================================================
// Todo escribe `transicion.id` / `transicion.duracion` en el clip de la
// IZQUIERDA del corte con UN comando (un paso de deshacer). Los avisos son los
// del es-LA.po de CapCut 9.3 (`no_sequence_current_position_transition`,
// `segment_too_short_to_add_transition`, `applied_to_all_clips`).

import { toast } from "sonner";
import { EditorCore } from "@/app/video-editor/_opencut/core";
import type { DropTarget, SceneTracks, TimelineElement, TimelineTrack } from "@/app/video-editor/_opencut/timeline";
import { findTrackInSceneTracks } from "@/app/video-editor/_opencut/timeline/track-element-update";
import { TICKS_PER_SECOND } from "@/app/video-editor/_opencut/wasm";
import { clipVisualElegido } from "@/app/video-editor/_opencut/commands/timeline/element/clip-elegido";
import { usePropertiesStore } from "@/app/video-editor/_opencut/components/editor/panels/properties/stores/properties-store";
import {
	DURACION_POR_DEFECTO,
	PARAM_TRANSICION_DURACION,
	PARAM_TRANSICION_ID,
} from "./claves";
import {
	admiteTransicion,
	anteriorPegado,
	clipsDe,
	corteMuyCorto,
	cortesDePista,
	duracionPedida,
	idTransicion,
	siguientePegado,
} from "./reglas";

/** El id de la pestaña «Transición» del panel derecho (./registro.ts). */
export const PESTANA_TRANSICION = "transicion";

// La primera frase de cada aviso de CapCut, tal cual: el resto («No se puede
// agregar una transición», «Aplica el efecto…») repite lo que ya se ve, y un
// aviso se lee de un vistazo (AGENTS.md, el texto que se dibuja es corto).
export const AVISO_SIN_CLIPS = "No hay clips continuos";
export const AVISO_MUY_CORTO = "El video es demasiado corto";
const AVISO_A_TODOS = "Aplicado a todos los clips";

type Corte = { track: TimelineTrack; a: TimelineElement; b: TimelineElement };

function pistaDeVideo(tracks: SceneTracks, trackId: string): TimelineTrack | null {
	const track = findTrackInSceneTracks({ tracks, trackId });
	return track && track.type === "video" && !track.locked ? track : null;
}

/** Elige el clip y abre su pestaña «Transición» (el ⧓ de la línea de tiempo, y después de poner una). */
export function abrirTransicion(editor: EditorCore, ref: { trackId: string; elementId: string }): void {
	const [par] = editor.timeline.getElementsWithTracks({ elements: [ref] });
	if (!par) return;
	editor.selection.setSelectedElements({ elements: [ref] });
	usePropertiesStore.getState().setActiveTab({ elementType: par.element.type, tabId: PESTANA_TRANSICION });
}

/** Pone la transición `id` en el corte; avisa y no hace nada si los clips son demasiado cortos. */
function poner(editor: EditorCore, { track, a, b }: Corte, id: string): boolean {
	if (corteMuyCorto(a, b, TICKS_PER_SECOND)) {
		toast.error(AVISO_MUY_CORTO);
		return false;
	}
	// Cambiar de transición conserva la duración elegida; una nueva arranca en 0,5 s.
	const duracion = idTransicion(a) ? duracionPedida(a) : DURACION_POR_DEFECTO;
	editor.timeline.updateElements({
		updates: [
			{
				trackId: track.id,
				elementId: a.id,
				patch: {
					params: { ...a.params, [PARAM_TRANSICION_ID]: id, [PARAM_TRANSICION_DURACION]: duracion },
				},
			},
		],
	});
	abrirTransicion(editor, { trackId: track.id, elementId: a.id });
	return true;
}

/** El corte del lado de `x` (ticks) en el clip `el`; si de ese lado no hay, el otro. */
function corteJunto(track: TimelineTrack, el: TimelineElement, x: number): Corte | null {
	if (!admiteTransicion(el)) return null;
	const der = siguientePegado(clipsDe(track), el);
	const izq = anteriorPegado(clipsDe(track), el);
	const derecha = der ? { track, a: el, b: der } : null;
	const izquierda = izq ? { track, a: izq, b: el } : null;
	return x >= el.startTime + el.duration / 2 ? (derecha ?? izquierda) : (izquierda ?? derecha);
}

/**
 * Clic en una tarjeta (o su ⊕): con un clip elegido, su corte DERECHO; si no,
 * el corte del clip de la pista principal que está bajo el cabezal (el más cercano).
 */
export function aplicarDesdeBiblioteca(editor: EditorCore, id: string): void {
	const elegido = clipVisualElegido(editor);
	if (elegido) {
		const track = pistaDeVideo(editor.scenes.getActiveScene().tracks, elegido.track.id);
		const b = track ? siguientePegado(clipsDe(track), elegido.element) : null;
		if (!track || !b) {
			toast.error(AVISO_SIN_CLIPS);
			return;
		}
		poner(editor, { track, a: elegido.element, b }, id);
		return;
	}
	const tracks = editor.scenes.getActiveScene().tracks;
	const main = pistaDeVideo(tracks, tracks.main.id);
	const cabezal = editor.playback.getCurrentTime();
	const bajo = main?.elements.find(
		(e) => admiteTransicion(e) && e.startTime <= cabezal && cabezal < e.startTime + e.duration,
	);
	const corte = main && bajo ? corteJunto(main, bajo, cabezal) : null;
	if (!corte) {
		toast.error(AVISO_SIN_CLIPS);
		return;
	}
	poner(editor, corte, id);
}

/** Soltada sobre la línea de tiempo: el corte más cercano del clip donde cayó. */
export function soltarTransicion({
	tracks,
	target,
	transicionId,
}: {
	tracks: SceneTracks;
	target: DropTarget;
	transicionId: string;
}): void {
	const editor = EditorCore.getInstance();
	const ref = target.targetElement;
	const track = ref ? pistaDeVideo(tracks, ref.trackId) : null;
	const el = ref && track ? track.elements.find((e) => e.id === ref.elementId) : undefined;
	const corte = track && el ? corteJunto(track, el, target.xPosition) : null;
	if (!corte) {
		toast.error(AVISO_SIN_CLIPS);
		return;
	}
	poner(editor, corte, transicionId);
}

/** «Aplicar a todo»: la misma transición y duración en todos los cortes de la pista. */
export function aplicarATodo(editor: EditorCore, ref: { trackId: string; elementId: string }): void {
	const track = pistaDeVideo(editor.scenes.getActiveScene().tracks, ref.trackId);
	const origen = track?.elements.find((e) => e.id === ref.elementId);
	const id = origen ? idTransicion(origen) : null;
	if (!track || !origen || !id) return;
	const duracion = duracionPedida(origen);
	const updates = cortesDePista(clipsDe(track))
		.filter(({ a, b }) => !corteMuyCorto(a, b, TICKS_PER_SECOND))
		.map(({ a }) => ({
			trackId: track.id,
			elementId: a.id,
			patch: { params: { ...a.params, [PARAM_TRANSICION_ID]: id, [PARAM_TRANSICION_DURACION]: duracion } },
		}));
	if (updates.length === 0) return;
	editor.timeline.updateElements({ updates });
	toast.success(AVISO_A_TODOS);
}

/** «Eliminar»: saca la transición del corte (el clip queda como antes de ponerla). */
export function quitarTransicion(editor: EditorCore, ref: { trackId: string; elementId: string }): void {
	const [par] = editor.timeline.getElementsWithTracks({ elements: [ref] });
	if (!par || !idTransicion(par.element)) return;
	// Con los valores por defecto y no borrando las claves: el pipeline de
	// `updateElements` MEZCLA los params (update-pipeline.ts), una clave que falta
	// en el parche queda como estaba.
	editor.timeline.updateElements({
		updates: [
			{
				...ref,
				patch: {
					params: {
						...par.element.params,
						[PARAM_TRANSICION_ID]: "",
						[PARAM_TRANSICION_DURACION]: DURACION_POR_DEFECTO,
					},
				},
			},
		],
	});
}
