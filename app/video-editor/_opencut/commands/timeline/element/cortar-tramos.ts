// =============================================================================
// «Edición basada en la transcripción» y «Eliminar las muletillas»: el comando
// =============================================================================
// Saca tramos de tiempo del video en UN paso de deshacer. La cuenta (qué se corta,
// qué se corre, cómo quedan los subtítulos) es pura y está probada
// (transcripcion/cortar.ts); acá sólo se le pasa lo que vive en el editor: la
// vinculación de la barra (ripple/iman.ts), cómo se parten las líneas de un
// subtítulo en este lienzo y el «Dividir» de verdad.
//
// Lo usan el panel «Transcripción» (transcripcion/components/) y el chat «Editar
// con IA» (chat/aplicar.ts), así borrar desde el chat se porta igual que borrar
// texto a mano.

import { Command, type CommandResult } from "@/app/video-editor/_opencut/commands/base-command";
import { EditorCore } from "@/app/video-editor/_opencut/core";
import type { ParamValues } from "@/app/video-editor/_opencut/params";
import type { SceneTracks, TextElement } from "@/app/video-editor/_opencut/timeline";
import { dividirElemento } from "@/app/video-editor/_opencut/timeline/dividir-elemento";
import { useTimelineStore } from "@/app/video-editor/_opencut/timeline/timeline-store";
import { estaVinculado } from "@/app/video-editor/_opencut/ripple/iman";
import { TICKS_PER_SECOND } from "@/app/video-editor/_opencut/wasm";
import { bordeInferiorDe, partirYUbicar } from "@/app/video-editor/_opencut/subtitles/build-subtitle-text-element";
import { lienzoDe } from "@/app/video-editor/_opencut/subtitles/insert";
import { cortarTramos, tramosConClip, type ResultadoCorte, type TramoTicks } from "@/app/video-editor/_opencut/transcripcion/cortar";

export type ResumenCorte = { quitadoSegundos: number; subtitulosCambiados: number; subtitulosBorrados: number; sinClip: number };

/** La cuenta, contra la línea de tiempo de AHORA. */
function calcular(editor: EditorCore, tramos: TramosSegundos): { before: SceneTracks; r: ResultadoCorte; sinClip: number } {
	const before = editor.scenes.getActiveScene().tracks;
	const enTicks: TramoTicks[] = tramos.map(([a, b]) => [a * TICKS_PER_SECOND, b * TICKS_PER_SECOND] as const);
	// Sin clip en la principal debajo no hay video que cortar (la voz viene de otra
	// pista): esos tramos no se tocan, y quien llama lo dice.
	const { con, sin } = tramosConClip(before, enTicks);
	const { vinculacion, tiposVinculados } = useTimelineStore.getState();
	const lienzo = lienzoDe(editor);
	const rehacerTexto = (el: TextElement, texto: string): ParamValues => {
		const borde = bordeInferiorDe({ params: el.params, lienzo });
		const ubicado = partirYUbicar({
			params: { ...el.params, content: texto },
			lienzo,
			ubicacion: borde != null ? { bordeInferior: borde } : {},
		});
		return { ...el.params, content: ubicado.content, "transform.positionY": ubicado["transform.positionY"] };
	};
	const r = cortarTramos({
		tracks: before,
		tramos: con,
		tps: TICKS_PER_SECOND,
		vinculado: (element, track) => vinculacion && estaVinculado({ element, track, tipos: tiposVinculados }),
		rehacerTexto,
		dividir: dividirElemento,
	});
	return { before, r, sinClip: sin.length };
}

const resumenDe = (r: ResultadoCorte, sinClip: number): ResumenCorte => ({
	quitadoSegundos: r.quitado / TICKS_PER_SECOND,
	subtitulosCambiados: r.subtitulosCambiados,
	subtitulosBorrados: r.subtitulosBorrados,
	sinClip,
});

/** Tramos en SEGUNDOS de la línea de tiempo. */
export type TramosSegundos = ReadonlyArray<readonly [number, number]>;

export class CortarTramosCommand extends Command {
	private before: SceneTracks | null = null;
	private hecho: ResumenCorte | null = null;
	/**
	 * Los tramos, o cómo sacarlos de la línea de tiempo del momento: el chat los pide
	 * así («corta donde digo…», «sin muletillas») porque en su lote lo de antes pudo
	 * correr el video, y unos tiempos calculados al pedir ya no caerían en su lugar.
	 */
	private readonly tramos: TramosSegundos | ((tracks: SceneTracks) => TramosSegundos);

	constructor({ tramos }: { tramos: TramosSegundos | ((tracks: SceneTracks) => TramosSegundos) }) {
		super();
		this.tramos = tramos;
	}

	private resueltos(editor: EditorCore): TramosSegundos {
		return typeof this.tramos === "function" ? this.tramos(editor.scenes.getActiveScene().tracks) : this.tramos;
	}

	/** Lo que haría sobre la línea de tiempo de ahora, sin tocarla. Null si no cambiaría nada. */
	previa(): ResumenCorte | null {
		const editor = EditorCore.getInstance();
		const { before, r, sinClip } = calcular(editor, this.resueltos(editor));
		return r.tracks === before ? null : resumenDe(r, sinClip);
	}

	/** Lo que hizo; null si no cambió nada. */
	resumen(): ResumenCorte | null {
		return this.hecho;
	}

	execute(): CommandResult | undefined {
		const editor = EditorCore.getInstance();
		const { before, r, sinClip } = calcular(editor, this.resueltos(editor));
		if (r.tracks === before) {
			this.hecho = null;
			return undefined;
		}
		this.before = before;
		this.hecho = resumenDe(r, sinClip);
		editor.timeline.updateTracks(r.tracks);
		return undefined;
	}

	undo(): void {
		if (this.before) EditorCore.getInstance().timeline.updateTracks(this.before);
	}
}

/**
 * Corta los tramos (segundos) en un paso de deshacer, sólo si algo cambia: un pedido
 * que no corta nada no deja un paso vacío en el historial. Devuelve qué hizo.
 */
export function cortarTramosEnEditor(editor: EditorCore, tramos: TramosSegundos): ResumenCorte | null {
	const comando = new CortarTramosCommand({ tramos });
	if (!comando.previa()) return null;
	editor.command.execute({ command: comando });
	return comando.resumen();
}
