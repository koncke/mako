// =============================================================================
// «Reemplazar el clip»: la ÚNICA entrada de la pantalla
// =============================================================================
// La usan el menú del clip («Reemplazar el clip»), el botón «Sustituir» de una
// muestra (los dos por el diálogo, ./dialogo-reemplazar.tsx) y soltar un medio de
// Multimedia sobre una muestra (timeline/controllers/drag-drop-controller.ts). El
// chat arma el mismo ReemplazarClipCommand en su lote. Una regla que viviera en
// una de esas entradas no la cumpliría otra (AGENTS.md).
//
// Los avisos son los de CapCut (es-LA.po), en su primera parte: «Sustituido»
// (`pc_replacement_succeeded`), «No se pudo reemplazar» (`pc_replace_clip_failed`)
// y, para un video corto, la idea de `pc_the_current_video_is_shorter_than_the_
// original_clip` en corto, con el «Muy corto» de la grilla del diálogo.

import { toast } from "sonner";
import type { EditorCore } from "@/app/video-editor/_opencut/core";
import type { ElementRef } from "@/app/video-editor/_opencut/timeline";
import { armarReemplazo, ReemplazarClipCommand, type ResultadoReemplazo } from "./comando";
import { aceptaDe, buscarClip } from "./puro";

export const AVISO_SUSTITUIDO = "Sustituido";
export const AVISO_FALLO = "No se pudo reemplazar";
export const AVISO_CORTO = "El video es muy corto";

function aviso(r: Extract<ResultadoReemplazo, { ok: false }>, acepta: string): string {
	if (r.motivo === "corto") return AVISO_CORTO;
	if (r.motivo === "tipo") return acepta === "video" ? "Este clip pide un video" : "Este clip pide una foto";
	return AVISO_FALLO;
}

/** Reemplaza el clip `ref` (y, si es una muestra, las de su hueco) por el medio `mediaId`. */
export function reemplazarClip(editor: EditorCore, ref: ElementRef, mediaId: string): boolean {
	const clip = buscarClip(editor.scenes.getActiveScene().tracks, ref);
	if (!clip || clip.track.locked) {
		toast.error(AVISO_FALLO);
		return false;
	}
	const r = armarReemplazo(editor, ref, mediaId);
	if (!r.ok) {
		toast.error(aviso(r, aceptaDe(clip.element.params)));
		return false;
	}
	editor.command.execute({ command: new ReemplazarClipCommand({ ref, mediaId }) });
	toast.success(AVISO_SUSTITUIDO);
	return true;
}
