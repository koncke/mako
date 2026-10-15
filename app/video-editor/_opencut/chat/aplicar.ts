// =============================================================================
// chat/aplicar — aceptar y restaurar una propuesta del chat
// =============================================================================
// El contrato es el del Landing (`aceptarPropuesta` en app/landing-generator/editor/
// paneles/PanelAgente.tsx), en el mismo orden:
//
//   1. Lo pendiente, guardado (`editor.save.flush`). Si no se guardó, NO se aplica: la
//      revisión ofrece «Aplicar igual».
//   2. Recién ahí, la línea de tiempo: la de AHORA, con las mismas referencias con las que
//      se pidió (`refsPrevias`), y se vuelve a revisar. Lo que se borró o se bloqueó mientras
//      tanto se descarta con su motivo.
//   3. Todo con los comandos del PROPIO motor (insertar, actualizar, borrar, dividir), en un
//      BatchCommand: UN paso de deshacer. Así un corte, un borrado o un cambio de volumen del
//      chat se portan igual que los de la barra (imán, transiciones, fundidos, animaciones).
//
// ⚠️ El editor de video no tiene historial de versiones como el Landing («Antes de un cambio
// de IA»): la vuelta atrás es «Restaurar» (el deshacer, si nadie tocó la línea de tiempo
// después) o Ctrl+Z. Está anotado en docs/hallazgos-video-editor.md.
// =============================================================================

import type { EditorCore } from "@/app/video-editor/_opencut/core";
import type { Command } from "@/app/video-editor/_opencut/commands/base-command";
import { BatchCommand } from "@/app/video-editor/_opencut/commands/batch-command";
import {
	DeleteElementsCommand,
	InsertElementCommand,
	SplitElementsCommand,
	UpdateElementsCommand,
} from "@/app/video-editor/_opencut/commands/timeline/element";
import { buildTextElement } from "@/app/video-editor/_opencut/timeline/element-utils";
import type { SceneTracks, TimelineElement, TScene } from "@/app/video-editor/_opencut/timeline/types";
import { TICKS_PER_SECOND, mediaTimeFromSeconds } from "@/app/video-editor/_opencut/wasm";
import type { OperacionChat } from "@/lib/editor-video/chat-catalogo";
import { ReemplazarSubtitulosCommand } from "@/app/video-editor/_opencut/subtitles/editar";
import { generarSubtitulos } from "@/app/video-editor/_opencut/subtitles/generar";
import { revisarOperaciones, vistaDeLinea, type OperacionResuelta } from "./linea";

/** Lo que propuso la IA, con lo necesario para aplicarlo en la línea de tiempo correcta. */
export type PropuestaChat = {
	proyectoId: string;
	escenaId: string;
	/** La línea de tiempo al mandar (para avisar «Cambiaste la línea de tiempo mientras tanto»). */
	tracksEnviados: SceneTracks;
	/** elementId → ref, de la vista que se mandó. */
	refsPorId: Map<string, string>;
	elegidos: Array<{ trackId: string; elementId: string }>;
	alcance: "video" | "seleccion";
	operaciones: OperacionChat[];
};

/** Lo necesario para deshacer un cambio aplicado. */
/** Lo necesario para deshacer un cambio aplicado: `pasos` son los del historial (el lote, y la generación de subtítulos si hubo). */
export type AplicadaChat = { escenaId: string; antes: SceneTracks; despues: SceneTracks; pasos: number };

export type ResultadoAceptar =
	| { ok: true; aplicada: AplicadaChat; descartes: string[] }
	| { ok: false; error: string; sinVersion?: boolean };

const segundos = (s: number) => mediaTimeFromSeconds({ seconds: s });

/** Los comandos del motor de UNA operación resuelta. */
function comandoDe(op: Exclude<OperacionResuelta, { op: "generar_subtitulos" }>): Command {
	const actualizar = (trackId: string, elementId: string, patch: Partial<TimelineElement>) =>
		new UpdateElementsCommand({ updates: [{ trackId, elementId, patch }] });
	switch (op.op) {
		case "agregar_texto":
			// Lo mismo que «Texto predeterminado» (text/components/assets-view.tsx), con el texto pedido.
			return new InsertElementCommand({
				element: buildTextElement({
					raw: { name: op.texto.slice(0, 40), duration: segundos(op.duracion), params: { content: op.texto } },
					startTime: segundos(op.inicio),
				}),
				placement: { mode: "auto", trackType: "text" },
			});
		case "cambiar_texto":
			return actualizar(op.el.trackId, op.el.elementId, { params: { content: op.texto } } as Partial<TimelineElement>);
		case "borrar":
			return new DeleteElementsCommand({ elements: op.els.map((e) => ({ trackId: e.trackId, elementId: e.elementId })) });
		case "mover":
			return actualizar(op.el.trackId, op.el.elementId, { startTime: segundos(op.inicio) });
		case "duracion":
			return actualizar(op.el.trackId, op.el.elementId, { duration: segundos(op.duracion) });
		case "dividir":
			return new SplitElementsCommand({ elements: [{ trackId: op.el.trackId, elementId: op.el.elementId }], splitTime: segundos(op.en) });
		case "volumen":
			return actualizar(op.el.trackId, op.el.elementId, { params: { volume: op.db } } as Partial<TimelineElement>);
		case "silenciar":
			return actualizar(op.el.trackId, op.el.elementId, { params: { muted: op.silenciado } } as Partial<TimelineElement>);
		case "ocultar":
			return actualizar(op.el.trackId, op.el.elementId, { hidden: op.oculto } as Partial<TimelineElement>);
		case "reemplazar_en_subtitulos":
			return new ReemplazarSubtitulosCommand({ buscar: op.buscar, reemplazo: op.reemplazo });
	}
}

/** ACEPTAR. El orden es el contrato (ver la cabecera). */
export async function aceptarPropuesta(editor: EditorCore, p: PropuestaChat, op: { sinVersion?: boolean } = {}): Promise<ResultadoAceptar> {
	const enSuLugar = (): { error: string } | { escena: TScene } => {
		const proyecto = editor.project.getActiveOrNull();
		const escena = editor.scenes.getActiveSceneOrNull();
		if (!proyecto || proyecto.metadata.id !== p.proyectoId) return { error: "Es de otro proyecto" };
		if (!escena || escena.id !== p.escenaId) return { error: "Es de otra escena" };
		return { escena };
	};
	const alPedir = enSuLugar();
	if ("error" in alPedir) return { ok: false, error: alPedir.error };

	// 1. Lo pendiente, guardado.
	if (!op.sinVersion) {
		try {
			await editor.save.flush();
		} catch {
			return { ok: false, error: "No se guardó el proyecto", sinVersion: true };
		}
	}

	// 2. La línea de tiempo de AHORA (pudo cambiar durante el `await`).
	const lugar = enSuLugar();
	if ("error" in lugar) return { ok: false, error: lugar.error };
	const antes = lugar.escena.tracks;
	const vista = vistaDeLinea({ tracks: antes, tps: TICKS_PER_SECOND, cabezal: 0, elegidos: p.elegidos, refsPrevias: p.refsPorId });
	const { resueltas, descartes } = revisarOperaciones({ operaciones: p.operaciones, vista, alcance: p.alcance });
	if (!resueltas.length) return { ok: false, error: descartes[0] ? `No se aplica: ${descartes[0]}` : "Ya no hay nada que cambiar" };

	// 3. Un paso de deshacer para lo que se arma en el momento. Los subtítulos automáticos
	//    van después y aparte: transcriben (puede tardar) y ponen su pista con su propio
	//    paso (subtitles/generar.ts), así que «Restaurar» deshace los dos.
	const directas = resueltas.filter((r): r is Exclude<OperacionResuelta, { op: "generar_subtitulos" }> => r.op !== "generar_subtitulos");
	const subtitular = resueltas.some((r) => r.op === "generar_subtitulos");
	let pasos = 0;
	if (directas.length) {
		const comandos = directas.map(comandoDe);
		editor.command.execute({ command: comandos.length === 1 ? comandos[0] : new BatchCommand(comandos) });
		if (editor.scenes.getActiveSceneOrNull()?.tracks !== antes) pasos++;
	}
	if (subtitular) {
		const previo = editor.scenes.getActiveSceneOrNull()?.tracks;
		await generarSubtitulos(editor);
		if (editor.scenes.getActiveSceneOrNull()?.tracks !== previo) pasos++;
	}
	const despues = editor.scenes.getActiveSceneOrNull()?.tracks;
	// Si la línea de tiempo no cambió, no se aplicó: decir «Aplicado» sería mentir.
	if (!despues || despues === antes || pasos === 0) return { ok: false, error: "No se aplicó el cambio" };
	return { ok: true, aplicada: { escenaId: p.escenaId, antes, despues, pasos }, descartes };
}

/**
 * «Restaurar» un cambio aplicado con el deshacer del editor, SÓLO si nadie tocó la línea de
 * tiempo después (es el mismo objeto que dejó el cambio). Si el deshacer no vuelve
 * exactamente a lo de antes, se rehace y devuelve false: ahí la vuelta es Ctrl+Z.
 */
export function deshacerPropuesta(editor: EditorCore, a: AplicadaChat): boolean {
	const escena = editor.scenes.getActiveSceneOrNull();
	if (!escena || escena.id !== a.escenaId || escena.tracks !== a.despues) return false;
	for (let i = 0; i < a.pasos; i++) editor.command.undo();
	if (editor.scenes.getActiveSceneOrNull()?.tracks === a.antes) return true;
	for (let i = 0; i < a.pasos; i++) editor.command.redo();
	return false;
}
