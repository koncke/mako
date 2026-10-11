// =============================================================================
// «Congelar»: un cuadro fijo de 3 s en el cabezal
// =============================================================================
// Como CapCut: divide el clip de video en el cabezal, mete entre las dos mitades
// una IMAGEN con el cuadro que se ve ahí, de 3 s, y corre lo que sigue en la
// pista. La imagen hereda lo que hace que el clip se vea como se ve (posición,
// escala, giro, opacidad, mezcla, reflejo, recorte, efectos, máscara), pero no
// las animaciones de entrada/salida ni la transición: un cuadro congelado en el
// medio no «entra».
//
// Dos partes, porque una es asíncrona y la otra no puede serlo:
//   1. `congelarCuadro(editor)`: decodifica el cuadro (recorte/cuadro.ts), lo
//      guarda como medio (oculto de la biblioteca: `ephemeral`, como hace CapCut
//      con sus cuadros congelados) y recién ahí
//   2. ejecuta `CongelarCuadroCommand`, que es UN paso de deshacer.

import { toast } from "sonner";
import { EditorCore } from "@/app/video-editor/_opencut/core";
import { Command, createElementSelectionResult, type CommandResult } from "@/app/video-editor/_opencut/commands/base-command";
import { SplitElementsCommand } from "./split-elements";
import type {
	ImageElement,
	SceneTracks,
	TimelineElement,
	VideoElement,
} from "@/app/video-editor/_opencut/timeline";
import { findTrackInSceneTracks } from "@/app/video-editor/_opencut/timeline";
import {
	buildDefaultParamValues,
	getBuiltInElementParams,
} from "@/app/video-editor/_opencut/params/registry";
import type { ParamValues } from "@/app/video-editor/_opencut/params";
import { generateUUID } from "@/app/video-editor/_opencut/utils/id";
import { getSourceTimeAtClipTime } from "@/app/video-editor/_opencut/retime";
import { processMediaAssets } from "@/app/video-editor/_opencut/media/processing";
import { cuadroAJpeg, cuadroDeVideo } from "@/app/video-editor/_opencut/recorte/cuadro";
import {
	TICKS_PER_SECOND,
	mediaTime,
	roundMediaTime,
	type MediaTime,
} from "@/app/video-editor/_opencut/wasm";
import { conElementosDePista, correrDesde, videoElegido } from "./clip-elegido";

/** CapCut congela 3 s. */
export const DURACION_CONGELAR = mediaTime({ ticks: 3 * TICKS_PER_SECOND });

// Lo que NO pasa del clip a su cuadro congelado (ver la cabecera).
const PREFIJOS_QUE_NO_PASAN = ["anim.", "transicion.", "revertir."];

function paramsParaCongelado(clip: VideoElement): ParamValues {
	const definiciones = getBuiltInElementParams({ type: "image" });
	const valores: ParamValues = buildDefaultParamValues(definiciones);
	for (const def of definiciones) {
		if (PREFIJOS_QUE_NO_PASAN.some((p) => def.key.startsWith(p))) continue;
		const valor = clip.params[def.key];
		if (valor !== undefined) valores[def.key] = valor;
	}
	return valores;
}

export class CongelarCuadroCommand extends Command {
	private savedState: SceneTracks | null = null;
	private readonly idCongelado = generateUUID();

	constructor(
		private readonly args: {
			trackId: string;
			elementId: string;
			/** Instante de la línea de tiempo donde se congela. */
			tiempo: MediaTime;
			mediaId: string;
			nombre: string;
			duracion?: MediaTime;
		},
	) {
		super();
	}

	execute(): CommandResult | undefined {
		const editor = EditorCore.getInstance();
		const antes = editor.scenes.getActiveScene().tracks;
		this.savedState = antes;
		const { trackId, elementId, tiempo, mediaId, nombre } = this.args;
		const duracion = this.args.duracion ?? DURACION_CONGELAR;

		const clip = findTrackInSceneTracks({ tracks: antes, trackId })?.elements.find(
			(e) => e.id === elementId,
		);
		if (!clip || clip.type !== "video") return undefined;

		// 1. Dividir en el cabezal (si cae en el borde izquierdo no divide: el
		//    cuadro va antes del clip entero).
		if (tiempo > clip.startTime && tiempo < clip.startTime + clip.duration) {
			new SplitElementsCommand({
				elements: [{ trackId, elementId }],
				splitTime: tiempo,
			}).execute();
		}
		const divididas = editor.scenes.getActiveScene().tracks;

		// 2. Correr lo que sigue y meter el cuadro.
		const congelado: ImageElement = {
			id: this.idCongelado,
			type: "image",
			mediaId,
			name: nombre,
			startTime: tiempo,
			duration: duracion,
			trimStart: mediaTime({ ticks: 0 }),
			trimEnd: mediaTime({ ticks: 0 }),
			hidden: clip.hidden ?? false,
			params: paramsParaCongelado(clip),
			...(clip.effects?.length ? { effects: structuredClone(clip.effects) } : {}),
			...(clip.masks?.length ? { masks: structuredClone(clip.masks) } : {}),
		};
		const tracks = conElementosDePista(divididas, trackId, (elementos) =>
			[
				...correrDesde({ elementos, desde: tiempo, cantidad: duracion }),
				congelado as TimelineElement,
			].sort((a, b) => a.startTime - b.startTime),
		);
		editor.timeline.updateTracks(tracks);
		return createElementSelectionResult([{ trackId, elementId: this.idCongelado }]);
	}

	undo(): void {
		if (this.savedState) {
			EditorCore.getInstance().timeline.updateTracks(this.savedState);
		}
	}
}

/** ¿Se puede congelar ahora? Un video elegido y el cabezal sobre él. */
export function puedeCongelar(editor: EditorCore, seleccion = editor.selection.getSelectedElements()): boolean {
	const elegido = videoElegido(editor, seleccion);
	if (!elegido) return false;
	const t = editor.playback.getCurrentTime();
	const { startTime, duration } = elegido.element;
	return t >= startTime && t < startTime + duration;
}

let congelando = false;

export async function congelarCuadro(editor: EditorCore): Promise<void> {
	if (congelando) return;
	const elegido = videoElegido(editor);
	if (!elegido) return;
	const { track, element } = elegido;
	const tiempo = editor.playback.getCurrentTime();
	if (tiempo < element.startTime || tiempo >= element.startTime + element.duration) return;

	const proyecto = editor.project.getActiveOrNull();
	const asset = editor.media.getAssets().find((a) => a.id === element.mediaId);
	if (!proyecto || !asset?.file) return;

	// Un clip de menos de dos cuadros no se puede partir en dos.
	const cps = proyecto.settings.fps.numerator / proyecto.settings.fps.denominator;
	if (element.duration < (2 * TICKS_PER_SECOND) / cps) {
		toast.error("El clip es demasiado corto para congelarlo");
		return;
	}

	congelando = true;
	try {
		const enClip = tiempo - element.startTime;
		const fuenteTicks =
			element.trimStart +
			getSourceTimeAtClipTime({
				clipTime: enClip,
				retime: element.retime,
				clipDuration: element.duration,
			});
		const cuadro = await cuadroDeVideo({
			file: asset.file,
			segundos: fuenteTicks / TICKS_PER_SECOND,
		});
		const blob = await cuadroAJpeg(cuadro);
		const base = asset.name.replace(/\.[^.]+$/, "");
		const file = new File([blob], `${base} (congelado).jpg`, { type: "image/jpeg" });
		const [procesado] = await processMediaAssets({ files: [file] });
		if (!procesado) return;
		const medio = await editor.media.addMediaAsset({
			projectId: proyecto.metadata.id,
			asset: { ...procesado, ephemeral: true },
		});
		if (!medio) return;

		// Mientras se decodificaba, el clip pudo cambiar o desaparecer.
		const vigente = editor.timeline
			.getElementsWithTracks({ elements: [{ trackId: track.id, elementId: element.id }] })
			.at(0);
		if (!vigente) return;

		editor.command.execute({
			command: new CongelarCuadroCommand({
				trackId: track.id,
				elementId: element.id,
				tiempo: roundMediaTime({ time: tiempo }),
				mediaId: medio.id,
				nombre: element.name,
			}),
		});
	} catch (error) {
		console.error("[congelar] no se pudo congelar el cuadro", error);
		toast.error("No se pudo congelar el cuadro");
	} finally {
		congelando = false;
	}
}
