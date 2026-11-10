// =============================================================================
// «Clips mágicos»: abrir UN clip en un proyecto nuevo, vertical y con subtítulos
// =============================================================================
// «Cada clip abre en el editor» (pedido de Leila, 30/10/2026). El original NO se toca:
//
//   1. se guarda el proyecto abierto y se COPIA («Duplicar proyecto» del inicio: copia también sus archivos);
//   2. en la copia: se corta todo lo que está fuera del clip (el mismo corte que «Edición basada en la transcripción»,
//      que corre y recorta los subtítulos), con un poco de aire para no comerse una sílaba;
//   3. el lienzo pasa a 9:16 y el video principal se agranda para llenarlo (./cubrir.ts): siguiendo a la persona si se
//      la encontró en sus cuadros (./seguir.ts, ./seguir-en-editor.ts), y si no, recortado al centro;
//   4. los subtítulos de antes se van (estaban ubicados para el cuadro horizontal) y se generan de nuevo para el
//      vertical, con la plantilla y las palabras clave elegidas en Subtítulos automáticos;
//   5. el historial de deshacer arranca vacío, se guarda, y la copia lleva el título del clip.
// Quien llama navega a `/video-editor/<id>`. Si algo falla en el medio, la copia se borra y se vuelve a abrir el original.

import type { EditorCore } from "@/app/video-editor/_opencut/core";
import { BatchCommand } from "@/app/video-editor/_opencut/commands/batch-command";
import { UpdateProjectSettingsCommand } from "@/app/video-editor/_opencut/commands/project";
import { TracksSnapshotCommand } from "@/app/video-editor/_opencut/commands/timeline/tracks-snapshot";
import { cortarTramosEnEditor } from "@/app/video-editor/_opencut/commands/timeline/element/cortar-tramos";
import { tamanoDeRelacion } from "@/app/video-editor/_opencut/canvas/sizes";
import { generarSubtitulos } from "@/app/video-editor/_opencut/subtitles/generar";
import { sinSubtitulos } from "@/app/video-editor/_opencut/subtitles/insert";
import { textoDeSubtitulos } from "@/app/video-editor/_opencut/subtitles/resultado";
import { TICKS_PER_SECOND } from "@/app/video-editor/_opencut/wasm";
import { tramoDeCorte, type ClipElegido } from "@/lib/editor-video/clips";
import { clipsConAnimacionDelEncuadre, principalCubriendo } from "./cubrir";
import { animarEncuadre, encuadresQueSiguen } from "./seguir-en-editor";
import { useTrabajoClips } from "./estado";
import { avisoDeAnimaciones, type ResultadoAbrir } from "./resultado";

let abriendo = false;

export async function abrirClip(editor: EditorCore, clip: ClipElegido): Promise<ResultadoAbrir> {
	if (abriendo) return { ok: false, motivo: "ocupado" };
	const proyecto = editor.project.getActiveOrNull();
	if (!proyecto || !editor.scenes.getActiveSceneOrNull()) return { ok: false, motivo: "sin-proyecto" };
	const original = proyecto.metadata.id;
	const trabajo = useTrabajoClips.getState();
	abriendo = true;
	trabajo.fijar({ fase: "abriendo", progreso: 0, mensaje: null, error: false });
	let copia: string | null = null;
	try {
		const total = editor.timeline.getTotalDuration() / TICKS_PER_SECOND;
		const tramo = tramoDeCorte(clip, total);
		await editor.project.prepareExit().catch(() => {});
		await editor.save.flush().catch(() => {});
		try {
			[copia] = await editor.project.duplicateProjects({ ids: [original] });
		} catch {
			return { ok: false, motivo: "no-se-copio" };
		}
		if (!copia) return { ok: false, motivo: "no-se-copio" };
		await editor.project.loadProject({ id: copia });

		// 2. Sólo el tramo del clip.
		const cortes: Array<[number, number]> = [];
		if (tramo.fin < total - 0.05) cortes.push([tramo.fin, total]);
		if (tramo.inicio > 0.05) cortes.push([0, tramo.inicio]);
		if (cortes.length && !cortarTramosEnEditor(editor, cortes)) throw new Error("no se pudo cortar el tramo");

		// 3. Vertical, con el principal llenando el cuadro: siguiendo a la persona donde se la encontró.
		const activo = editor.project.getActive();
		const canvasSize = tamanoDeRelacion({ id: "9:16", settings: activo.settings });
		const assets = editor.media.getAssets();
		const tamanoDe = (id: string) => {
			const a = assets.find((x) => x.id === id);
			return a?.width && a?.height ? { width: a.width, height: a.height } : null;
		};
		trabajo.fijar({ fase: "encuadrando", progreso: 0 });
		const encuadres = await encuadresQueSiguen({
			editor,
			tracks: editor.scenes.getActiveScene().tracks,
			lienzo: canvasSize,
			alAvanzar: (hecho) => trabajo.fijar({ progreso: Math.round(hecho * 100) }),
		});
		trabajo.fijar({ fase: "abriendo", progreso: 0 });
		// Después de mirar (unos segundos): el comando parte de la escena de ahora, no de la de antes de esperar.
		const before = editor.scenes.getActiveScene().tracks;
		// Lo animado de la posición o la escala era del cuadro horizontal: se saca (./cubrir.ts), y se dice.
		const sinAnimar = clipsConAnimacionDelEncuadre(before, tamanoDe, encuadres);
		editor.command.execute({
			command: new BatchCommand([
				new UpdateProjectSettingsCommand({ relacion: "9:16", canvasSize, canvasSizeMode: "preset" }),
				new TracksSnapshotCommand({
					before,
					after: principalCubriendo(before, canvasSize, tamanoDe, { encuadres, animar: animarEncuadre }),
				}),
			]),
		});

		// 4. Los subtítulos, de nuevo y para el vertical.
		const conSubs = editor.scenes.getActiveScene().tracks;
		const sinSubs = sinSubtitulos(conSubs);
		if (sinSubs !== conSubs) editor.command.execute({ command: new TracksSnapshotCommand({ before: conSubs, after: sinSubs }) });
		const subs = await generarSubtitulos(editor);
		const aviso = [avisoDeAnimaciones(sinAnimar), subs.ok ? null : `El clip quedó sin subtítulos: ${textoDeSubtitulos(subs.motivo)}`]
			.filter((x): x is string => !!x)
			.join(" ") || null;

		// 5. Arranca limpio, guardado y con su título.
		editor.command.clear();
		await editor.project.saveCurrentProject();
		await editor.project.renameProject({ id: copia, name: clip.titulo });
		return { ok: true, id: copia, aviso };
	} catch (error) {
		console.error("[clips] no se pudo abrir el clip", error);
		if (copia) {
			await editor.project.deleteProjects({ ids: [copia] }).catch(() => {});
			await editor.project.loadProject({ id: original }).catch(() => {});
		}
		return { ok: false, motivo: "no-se-armo" };
	} finally {
		abriendo = false;
		trabajo.fijar({ fase: "inactivo", progreso: 0 });
	}
}
