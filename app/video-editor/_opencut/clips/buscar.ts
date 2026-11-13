// =============================================================================
// «Clips mágicos»: buscar los mejores momentos del video abierto
// =============================================================================
// Pedido de Leila (30/10/2026): de un video largo a varios cortos. Lo que se dice (los subtítulos, o transcripto acá
// mismo sin ponerlos: ../broll/frases-del-video.ts) va a la ruta /api/video-editor/clips, donde la IA del negocio elige
// por número de frase y el código valida (lib/editor-video/clips.ts). Sin IA, salen los mejores por las reglas. Los
// clips quedan en ./estado.ts, atados a este proyecto; cada uno se abre con ./abrir.ts.
//
// No lanza: cada salida es un resultado (./resultado.ts) que leen el botón y el chat.

import type { EditorCore } from "@/app/video-editor/_opencut/core";
import { useTrabajoSubtitulos } from "@/app/video-editor/_opencut/subtitles/estado";
import { useTrabajoBroll } from "@/app/video-editor/_opencut/broll/estado";
import { frasesDelVideo } from "@/app/video-editor/_opencut/broll/frases-del-video";
import { TICKS_PER_SECOND } from "@/app/video-editor/_opencut/wasm";
import { TOPES_CLIPS, type ClipElegido } from "@/lib/editor-video/clips";
import { useTrabajoClips } from "./estado";
import { esFallaDeClips, textoDeClips, type ResultadoClips, type VigenciaMensaje } from "./resultado";

let enCurso = false;

/** Lo que contesta /api/video-editor/clips. */
type RespuestaClips = { ok?: boolean; clips?: ClipElegido[]; conIA?: boolean; aviso?: string | null; error?: string };

/** La línea de tiempo de ahora, para atarle un mensaje (./resultado.ts › mensajeVigente): si cambia, el mensaje se va. */
export function vigenciaDe(editor: EditorCore): VigenciaMensaje | null {
	const proyecto = editor.project.getActiveOrNull();
	return proyecto ? { proyectoId: proyecto.metadata.id, duracion: editor.timeline.getTotalDuration() } : null;
}

export async function buscarClips(editor: EditorCore, { cuantos }: { cuantos: number }): Promise<ResultadoClips> {
	const trabajo = useTrabajoClips.getState();
	const terminar = (r: ResultadoClips): ResultadoClips => {
		trabajo.fijar({
			fase: "inactivo",
			progreso: 0,
			mensaje: r.ok ? r.aviso : textoDeClips(r),
			error: esFallaDeClips(r),
			vigencia: vigenciaDe(editor),
		});
		return r;
	};
	if (enCurso || trabajo.fase !== "inactivo" || useTrabajoSubtitulos.getState().fase !== "inactivo" || useTrabajoBroll.getState().fase !== "inactivo") {
		return { ok: false, motivo: "ocupado" };
	}
	const proyecto = editor.project.getActiveOrNull();
	if (!proyecto || !editor.scenes.getActiveSceneOrNull()) return terminar({ ok: false, motivo: "sin-proyecto" });
	const duracion = editor.timeline.getTotalDuration() / TICKS_PER_SECOND;
	if (duracion < TOPES_CLIPS.maxSeg) return terminar({ ok: false, motivo: "corto" });
	enCurso = true;
	try {
		trabajo.fijar({ fase: "escuchando", progreso: 0, mensaje: null, error: false });
		const frases = await frasesDelVideo(editor, (p) => trabajo.fijar({ progreso: p }));
		if (!frases.length) return terminar({ ok: false, motivo: "sin-voz" });
		trabajo.fijar({ fase: "eligiendo", progreso: 0 });
		let datos: RespuestaClips | null = null;
		try {
			const r = await fetch("/api/video-editor/clips", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ cuantos, frases: frases.slice(0, TOPES_CLIPS.maxFrases) }),
				signal: AbortSignal.timeout(200_000),
			});
			datos = (await r.json().catch(() => null)) as RespuestaClips | null;
			if (!r.ok || !datos || datos.ok === false) return terminar({ ok: false, motivo: "red", ...(datos?.error ? { detalle: datos.error } : {}) });
		} catch {
			return terminar({ ok: false, motivo: "red" });
		}
		if (editor.project.getActiveOrNull()?.metadata.id !== proyecto.metadata.id) return terminar({ ok: false, motivo: "otro-proyecto" });
		const clips = datos.clips ?? [];
		if (!clips.length) return terminar({ ok: false, motivo: "sin-clips" });
		trabajo.fijar({ proyectoId: proyecto.metadata.id, clips, conIA: datos.conIA === true });
		return terminar({ ok: true, clips: clips.length, aviso: datos.aviso ?? null });
	} catch (error) {
		console.error("[clips] no se pudieron buscar", error);
		return terminar({ ok: false, motivo: "red" });
	} finally {
		enCurso = false;
	}
}
