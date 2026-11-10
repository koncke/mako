// =============================================================================
// «Borrar silencios»: el trabajo largo (leer el audio) y los avisos
// =============================================================================
// Pedido de Martín (reunión 858545195 @94:33, validado el 13/10): «un botón "Borrar
// silencios", que los elimine solo». Sobre qué clips actúa, cómo se lee el audio y qué
// se le dice a la persona viven acá; la detección es pura (dsp/silencios.ts) y la
// edición es un comando (commands/timeline/element/borrar-silencios.ts).
//
// Un clip que es todo silencio NO se borra: se avisa. Y no se reintenta solo.
//
// Las pausas se buscan en el audio SIN RUIDO (dsp/silencios-sin-ruido.ts, decisión del Cerebro del
// 28/10): con el ruido de fondo a 20 dB de la voz no se encontraba ninguna. Se corta el original.
//
// Lo usan el botón de la barra (`borrarSilencios`, con sus avisos) y el chat «Editar con IA»
// (`quitarSilencios`, chat/aplicar.ts: Leila se lo pidió a MaKo el 27/10 y MaKo contestó que no
// podía). Las dos entradas son el MISMO trabajo; el chat además va contando lo que encuentra
// (`alPaso`) para que se vea construyéndose (AGENTS.md, 28/10/2026).

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
import { tramosQueQuedan } from "./dsp/silencios";
import { JuntadorDeTrozos, silenciosSinRuido } from "./dsp/silencios-sin-ruido";
import { reducirRuidoEnSegundoPlano } from "./ruido-hilo/cliente";
import { quedaAlgo, quedaAlgoEnLaLinea, silenciosEnLaLinea } from "./silencios-plan";
import { PAUSA_MIN_S, avisoBotonSinSilencios, clipsConSonido } from "./silencios-aviso";

/**
 * Sobre qué clips actúa «Borrar silencios»: los ELEGIDOS que tienen audio; sin
 * selección, el de la pista principal bajo el cabezal (como Dividir). Nunca los de
 * pistas bloqueadas. `cabezal: false` (el chat, que nombra sus clips): sin ninguno
 * de los pedidos, nada; nunca el del cabezal.
 */
export function objetivosDeSilencios({
	editor,
	seleccion,
	cabezal = true,
}: {
	editor: EditorCore;
	seleccion?: ElementRef[];
	cabezal?: boolean;
}): Array<{ ref: ElementRef; element: ClipConAudio }> {
	const scene = editor.scenes.getActiveSceneOrNull();
	if (!scene) return [];
	const elegidos = sinBloqueados({
		tracks: scene.tracks,
		refs: seleccion ?? editor.selection.getSelectedElements(),
	});
	const candidatos = elegidos.length > 0 || !cabezal ? elegidos : objetivosEnCabezal({ editor });
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

/** Lo que va pasando, en orden: cada clip que se escucha, cada silencio que se encontró (en segundos de la LÍNEA), el corte. */
export type PasoSilencios =
	| { tipo: "escuchando"; elementId: string; nombre: string }
	| { tipo: "silencio"; elementId: string; nombre: string; desde: number; hasta: number }
	| { tipo: "cortando" };

export type ResultadoSilencios =
	| { ok: true; segundos: number; silencios: number }
	| { ok: false; motivo: "sin-clip" | "ocupado" | "sin-audio" | "todo-silencio" | "error" }
	// Sin pausas: DÓNDE se buscó, para que el aviso lo diga (ticket 31: el chat había buscado en un clip de 0,9 s).
	| { ok: false; motivo: "sin-silencios"; clips: number; titulo?: string; segundos: number; minimoS: number };

/**
 * Lee el audio de cada clip, decide dónde cortar y corta, en UN comando (un Deshacer). Sin
 * avisos: quien llama dice lo que corresponde. `seleccion`/`cabezal`: ver `objetivosDeSilencios`.
 * `minimoS`: la pausa más corta que se saca (la del chat; sin ella, la de siempre).
 */
export async function quitarSilencios(
	editor: EditorCore,
	{
		seleccion,
		cabezal = true,
		minimoS = PAUSA_MIN_S,
		alPaso,
	}: { seleccion?: ElementRef[]; cabezal?: boolean; minimoS?: number; alPaso?: (paso: PasoSilencios) => void } = {},
): Promise<ResultadoSilencios> {
	if (enCurso) return { ok: false, motivo: "ocupado" };
	const objetivos = objetivosDeSilencios({ editor, seleccion, cabezal });
	if (objetivos.length === 0) return { ok: false, motivo: "sin-clip" };
	enCurso = true;
	try {
		const mediaAssets = editor.media.getAssets();
		// La red corre en un worker (./ruido-hilo/): con un clip largo, el editor sigue respondiendo mientras escucha.
		const reducir = reducirRuidoEnSegundoPlano;
		const planes: PlanDeSilencios[] = [];
		let todoSilencio = 0;
		let sinAudio = 0;
		let cuantos = 0;
		// Lo que se escuchó (los clips con audio), para decir dónde no hubo pausas.
		let escuchados = 0;
		let segundosEscuchados = 0;
		for (const { ref, element } of objetivos) {
			alPaso?.({ tipo: "escuchando", elementId: element.id, nombre: element.name });
			// El tramo de la FUENTE que el clip muestra (el mismo cálculo que Normalizar).
			const duracion = element.duration / TICKS_PER_SECOND;
			const desde = element.trimStart / TICKS_PER_SECOND;
			const tramo = getSourceTimeAtClipTime({
				clipTime: duracion,
				retime: element.retime,
				clipDuration: duracion,
			});
			const hasta = desde + tramo;
			const juntador = new JuntadorDeTrozos();
			const ok = await recorrerFuente({
				element,
				mediaAssets,
				desde,
				hasta,
				alTrozo: (trozo) => juntador.agregar(trozo),
			});
			const audio = juntador.resultado();
			if (!ok || !audio) {
				sinAudio++;
				continue;
			}
			escuchados++;
			segundosEscuchados += duracion;
			const silencios = await silenciosSinRuido({ audio, reducir, opciones: { minSilencioS: minimoS } });
			if (silencios.length === 0) continue;
			if (!quedaAlgo(tramosQueQuedan({ desde, hasta, silencios }))) {
				todoSilencio++;
				continue;
			}
			// Lo que va a cortar el comando, en la línea de tiempo (las mismas cuentas que él).
			const clip = { inicio: element.startTime / TICKS_PER_SECOND, duracion, trimStart: desde, retime: element.retime };
			const enLaLinea = silenciosEnLaLinea(clip, silencios);
			if (enLaLinea.length === 0) continue;
			if (!quedaAlgoEnLaLinea(clip, enLaLinea)) {
				todoSilencio++;
				continue;
			}
			planes.push({ ref, silenciosFuente: silencios });
			cuantos += enLaLinea.length;
			for (const [a, b] of enLaLinea) alPaso?.({ tipo: "silencio", elementId: element.id, nombre: element.name, desde: a, hasta: b });
		}

		if (planes.length === 0) {
			if (todoSilencio > 0) return { ok: false, motivo: "todo-silencio" };
			if (sinAudio === objetivos.length) return { ok: false, motivo: "sin-audio" };
			const unico = objetivos.length === 1 ? objetivos[0].element.name : undefined;
			return { ok: false, motivo: "sin-silencios", clips: escuchados, ...(unico ? { titulo: unico } : {}), segundos: segundosEscuchados, minimoS };
		}

		alPaso?.({ tipo: "cortando" });
		const command = new BorrarSilenciosCommand(planes);
		editor.command.execute({ command });
		return { ok: true, segundos: command.segundosQuitados(), silencios: cuantos };
	} catch (error) {
		console.error("[borrar-silencios]", error);
		return { ok: false, motivo: "error" };
	} finally {
		enCurso = false;
	}
}

/** El botón de la barra: lo elegido (o el clip bajo el cabezal), con sus avisos. */
export async function borrarSilencios(editor: EditorCore): Promise<void> {
	if (enCurso) return;
	if (objetivosDeSilencios({ editor }).length === 0) {
		toast.error("Elige un clip con audio");
		return;
	}
	const idAviso = toast.loading("Buscando silencios…", { duration: Number.POSITIVE_INFINITY });
	const r = await quitarSilencios(editor);
	if (r.ok) {
		toast.success(`Se quitaron ${segundos(r.segundos)}`, { id: idAviso, duration: 4000 });
		return;
	}
	toast.dismiss(idAviso);
	if (r.motivo === "todo-silencio") toast.error("El clip es todo silencio");
	else if (r.motivo === "sin-audio") toast.error("El clip no tiene audio");
	else if (r.motivo === "sin-silencios") {
		// Dice DÓNDE buscó (sin nada elegido, sólo el clip bajo el cabezal), y si hay más video donde buscar (ticket 31).
		const tracks = editor.scenes.getActiveSceneOrNull()?.tracks;
		const aviso = avisoBotonSinSilencios(r, (tracks ? clipsConSonido(tracks) : 0) > r.clips);
		toast(aviso.titulo, { description: aviso.descripcion, duration: 6000 });
	}
	else if (r.motivo === "sin-clip") toast.error("Elige un clip con audio");
	else if (r.motivo === "error") toast.error("No se pudieron borrar", { duration: 5000 });
}
