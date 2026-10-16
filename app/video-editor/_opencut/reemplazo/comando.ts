// =============================================================================
// «Reemplazar el clip»: el comando (UN paso de deshacer)
// =============================================================================
// Se arma contra las pistas del MOMENTO de ejecutar, no contra las de cuando se
// pidió: así sirve adentro de un lote del chat (chat/comandos.ts), donde lo de
// antes del lote pudo mover o cambiar el clip. Deshacer vuelve a las pistas de
// antes (molde: congelar.ts y velocidad.ts).
//
// Las cuentas son de ./puro.ts; acá sólo se junta lo que llega al motor: los
// params por defecto (params/registry.ts), los ticks por segundo, el lienzo y el
// tamaño de cada medio de la biblioteca. La entrada para la pantalla es
// ./reemplazar.ts (avisa); este archivo no avisa.

import { EditorCore } from "@/app/video-editor/_opencut/core";
import { Command, createElementSelectionResult, type CommandResult } from "@/app/video-editor/_opencut/commands/base-command";
import { buildDefaultParamValues, getBuiltInElementParams } from "@/app/video-editor/_opencut/params/registry";
import type { ElementRef, SceneTracks } from "@/app/video-editor/_opencut/timeline";
import { TICKS_PER_SECOND } from "@/app/video-editor/_opencut/wasm";
import { lineaReemplazada, medioDeAsset, type MotivoReemplazo } from "./puro";

export type ResultadoReemplazo =
	| { ok: true; tracks: SceneTracks; objetivos: ElementRef[] }
	| { ok: false; motivo: MotivoReemplazo | "sin-medio" };

/** Lo que haría reemplazar `ref` por el medio `mediaId` ahora (sin tocar nada). */
export function armarReemplazo(editor: EditorCore, ref: ElementRef, mediaId: string): ResultadoReemplazo {
	const proyecto = editor.project.getActiveOrNull();
	const assets = editor.media.getAssets();
	const asset = assets.find((a) => a.id === mediaId);
	const medio = asset ? medioDeAsset(asset) : null;
	if (!proyecto || !medio) return { ok: false, motivo: "sin-medio" };
	return lineaReemplazada({
		tracks: editor.scenes.getActiveScene().tracks,
		ref,
		medio,
		tps: TICKS_PER_SECOND,
		lienzo: proyecto.settings.canvasSize,
		tamanoDe: (id) => {
			const a = assets.find((x) => x.id === id);
			return a?.width && a.height ? { width: a.width, height: a.height } : null;
		},
		base: (tipo) => buildDefaultParamValues(getBuiltInElementParams({ type: tipo })),
	});
}

export class ReemplazarClipCommand extends Command {
	private antes: SceneTracks | null = null;

	constructor(private readonly args: { ref: ElementRef; mediaId: string }) {
		super();
	}

	execute(): CommandResult | undefined {
		const editor = EditorCore.getInstance();
		const antes = editor.scenes.getActiveScene().tracks;
		const r = armarReemplazo(editor, this.args.ref, this.args.mediaId);
		if (!r.ok) {
			this.antes = null;
			return undefined;
		}
		this.antes = antes;
		editor.timeline.updateTracks(r.tracks);
		return createElementSelectionResult(r.objetivos.slice(0, 1));
	}

	undo(): void {
		if (this.antes) EditorCore.getInstance().timeline.updateTracks(this.antes);
	}
}
