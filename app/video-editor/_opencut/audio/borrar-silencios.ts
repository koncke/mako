// =============================================================================
// «Borrar silencios»: el trabajo largo (leer el audio) y los avisos
// =============================================================================
// Pedido de Martín (reunión 858545195 @94:33, validado el 13/10): «un botón "Borrar
// silencios", que los elimine solo». Sobre qué clips actúa, cómo se lee el audio y qué
// se le dice a la persona viven acá; la detección es pura (dsp/silencios.ts) y la
// edición es un comando (commands/timeline/element/borrar-silencios.ts).
//
// Un clip que es todo silencio NO se borra: se avisa. Y no se reintenta solo.

import { toast } from "sonner";
import type { EditorCore } from "@/app/video-editor/_opencut/core";
import type { ElementRef } from "@/app/video-editor/_opencut/timeline/types";
import { canElementHaveAudio } from "@/app/video-editor/_opencut/timeline";
import { getSourceTimeAtClipTime } from "@/app/video-editor/_opencut/retime";
import { TICKS_PER_SECOND } from "@/app/video-editor/_opencut/wasm";
import {
	objetivosEnCabezal,
	sinBloqueados,
} from "@/app/video-editor/_opencut/timeline/components/pistas-ce";
import {
	BorrarSilenciosCommand,
	type PlanDeSilencios,
} from "@/app/video-editor/_opencut/commands/timeline/element/borrar-silencios";
import { recorrerFuente, type ClipConAudio } from "./decodificar";
import { MedidorVentanas, rangosDeSilencio, tramosQueQuedan } from "./dsp/silencios";
import { quedaAlgo } from "./silencios-plan";

/**
 * Sobre qué clips actúa «Borrar silencios»: los ELEGIDOS que tienen audio; sin
 * selección, el de la pista principal bajo el cabezal (como Dividir). Nunca los de
 * pistas bloqueadas.
 */
export function objetivosDeSilencios({
	editor,
	seleccion,
}: {
	editor: EditorCore;
	seleccion?: ElementRef[];
}): Array<{ ref: ElementRef; element: ClipConAudio }> {
	const scene = editor.scenes.getActiveSceneOrNull();
	if (!scene) return [];
	const elegidos = sinBloqueados({
		tracks: scene.tracks,
		refs: seleccion ?? editor.selection.getSelectedElements(),
	});
	const candidatos = elegidos.length > 0 ? elegidos : objetivosEnCabezal({ editor });
	return editor.timeline
		.getElementsWithTracks({ elements: candidatos })
		.filter(({ element }) => canElementHaveAudio(element))
		.map(({ track, element }) => ({
			ref: { trackId: track.id, elementId: element.id },
			element: element as ClipConAudio,
		}));
}

let enCurso = false;

function segundos(s: number): string {
	return `${s.toFixed(1).replace(".", ",")} s`;
}

export async function borrarSilencios(editor: EditorCore): Promise<void> {
	if (enCurso) return;
	const objetivos = objetivosDeSilencios({ editor });
	if (objetivos.length === 0) {
		toast.error("Elige un clip con audio");
		return;
	}
	enCurso = true;
	const idAviso = toast.loading("Buscando silencios…", { duration: Number.POSITIVE_INFINITY });
	try {
		const mediaAssets = editor.media.getAssets();
		const planes: PlanDeSilencios[] = [];
		let todoSilencio = 0;
		let sinAudio = 0;
		for (const { ref, element } of objetivos) {
			// El tramo de la FUENTE que el clip muestra (el mismo cálculo que Normalizar).
			const duracion = element.duration / TICKS_PER_SECOND;
			const desde = element.trimStart / TICKS_PER_SECOND;
			const tramo = getSourceTimeAtClipTime({
				clipTime: duracion,
				retime: element.retime,
				clipDuration: duracion,
			});
			const hasta = desde + tramo;
			const medidor = new MedidorVentanas();
			const ok = await recorrerFuente({
				element,
				mediaAssets,
				desde,
				hasta,
				alTrozo: (trozo) => medidor.agregar(trozo),
			});
			if (!ok) {
				sinAudio++;
				continue;
			}
			const silencios = rangosDeSilencio(medidor.resultado());
			if (silencios.length === 0) continue;
			if (!quedaAlgo(tramosQueQuedan({ desde, hasta, silencios }))) {
				todoSilencio++;
				continue;
			}
			planes.push({ ref, silenciosFuente: silencios });
		}

		if (planes.length === 0) {
			toast.dismiss(idAviso);
			if (todoSilencio > 0) toast.error("El clip es todo silencio");
			else if (sinAudio === objetivos.length) toast.error("El clip no tiene audio");
			else toast("Sin silencios");
			return;
		}

		const command = new BorrarSilenciosCommand(planes);
		editor.command.execute({ command });
		toast.success(`Se quitaron ${segundos(command.segundosQuitados())}`, {
			id: idAviso,
			duration: 4000,
		});
	} catch (error) {
		console.error("[borrar-silencios]", error);
		toast.error("No se pudieron borrar", { id: idAviso, duration: 5000 });
	} finally {
		enCurso = false;
	}
}
