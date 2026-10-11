// =============================================================================
// «Revertir» un clip de video
// =============================================================================
// El trabajo pesado (decodificar, invertir, codificar) está en retime/revertir.ts.
// Acá: el aviso con el progreso y «Cancelar», el medio nuevo (oculto de la
// biblioteca, como los de CapCut) y el cambio del clip, que es UN paso de
// deshacer.
//
// Revertir un clip ya revertido lo DEVUELVE al original sin procesar nada, como
// CapCut: el clip revertido guarda en `params["revertir.origen"]` de qué medio y
// de qué tramo salió. No es un parámetro declarado en params/extra a propósito:
// no se anima, no se pega con «Pegar atributos» y no tiene que aparecer en
// ningún panel. Sobrevive a dividir y a recortar porque la vuelta se calcula
// con los recortes del momento (ver `restaurarOriginal`).

import { toast } from "sonner";
import type { EditorCore } from "@/app/video-editor/_opencut/core";
import type { ParamValues } from "@/app/video-editor/_opencut/params";
import type { VideoElement } from "@/app/video-editor/_opencut/timeline";
import { processMediaAssets } from "@/app/video-editor/_opencut/media/processing";
import {
	RevertirCancelado,
	TOPE_REVERTIR_S,
	revertirVideo,
} from "@/app/video-editor/_opencut/retime/revertir";
import {
	TICKS_PER_SECOND,
	roundMediaTime,
} from "@/app/video-editor/_opencut/wasm";
import { videoElegido } from "./clip-elegido";

export const CLAVE_ORIGEN = "revertir.origen";

type Origen = {
	/** El medio original. */
	mediaId: string;
	/** Recortes y fuente del clip original al revertirlo (ticks). */
	trimStart: number;
	trimEnd: number;
	sourceDuration: number;
	/** Largo del tramo invertido (ticks). */
	tramo: number;
};

function origenDe(element: VideoElement): Origen | null {
	const crudo = element.params[CLAVE_ORIGEN];
	if (typeof crudo !== "string" || crudo === "") return null;
	try {
		const o = JSON.parse(crudo) as Partial<Origen>;
		if (typeof o.mediaId !== "string") return null;
		return {
			mediaId: o.mediaId,
			trimStart: Number(o.trimStart) || 0,
			trimEnd: Number(o.trimEnd) || 0,
			sourceDuration: Number(o.sourceDuration) || 0,
			tramo: Number(o.tramo) || 0,
		};
	} catch {
		return null;
	}
}

export function estaRevertido(element: VideoElement): boolean {
	return origenDe(element) !== null;
}

/** La fuente entera del clip, en ticks (si el clip no la trae, la del medio). */
function fuenteTotal(element: VideoElement, duracionMedio?: number): number {
	if (typeof element.sourceDuration === "number") return element.sourceDuration;
	if (duracionMedio) return Math.round(duracionMedio * TICKS_PER_SECOND);
	// Sin dato: lo que se ve más los recortes (la velocidad no importa acá: la
	// fuente visible es duración × velocidad media, y los recortes son de fuente).
	return element.trimStart + element.trimEnd + element.duration * (element.retime?.rate ?? 1);
}

let enCurso: AbortController | null = null;

export function revirtiendo(): boolean {
	return enCurso !== null;
}

export async function revertirClip(editor: EditorCore): Promise<void> {
	if (enCurso) {
		toast("La reversión del video está en curso. Espera un momento.");
		return;
	}
	const elegido = videoElegido(editor);
	if (!elegido) return;
	const { track, element } = elegido;

	const origen = origenDe(element);
	if (origen) {
		// El original es un medio común de la biblioteca: pudo haberse borrado.
		if (!editor.media.getAssets().some((a) => a.id === origen.mediaId)) {
			toast.error("Se perdieron los materiales. No es posible revertir el proceso.");
			return;
		}
		restaurarOriginal(editor, track.id, element, origen);
		return;
	}

	const proyecto = editor.project.getActiveOrNull();
	const asset = editor.media.getAssets().find((a) => a.id === element.mediaId);
	if (!proyecto || !asset?.file) {
		toast.error("Se perdieron los materiales. No es posible revertir el proceso.");
		return;
	}

	const total = fuenteTotal(element, asset.duration);
	const tramo = Math.max(0, total - element.trimStart - element.trimEnd);
	const desde = element.trimStart / TICKS_PER_SECOND;
	const hasta = (element.trimStart + tramo) / TICKS_PER_SECOND;
	if (hasta - desde > TOPE_REVERTIR_S) {
		toast.error(`El clip es demasiado largo para revertirlo (máx. ${TOPE_REVERTIR_S / 60} min)`);
		return;
	}

	const control = new AbortController();
	enCurso = control;
	const idAviso = toast.loading("Revirtiendo clip... 0%", {
		action: { label: "Cancelar", onClick: () => control.abort() },
		duration: Number.POSITIVE_INFINITY,
	});
	try {
		const base = asset.name.replace(/\.[^.]+$/, "");
		const { file } = await revertirVideo({
			file: asset.file,
			desde,
			hasta,
			nombre: `${base} (revertido)`,
			signal: control.signal,
			onProgreso: (f) =>
				toast.loading(`Revirtiendo clip... ${Math.round(f * 100)}%`, {
					id: idAviso,
					action: { label: "Cancelar", onClick: () => control.abort() },
					duration: Number.POSITIVE_INFINITY,
				}),
		});
		const [procesado] = await processMediaAssets({ files: [file] });
		if (!procesado) throw new Error("El archivo revertido no se pudo leer");
		const medio = await editor.media.addMediaAsset({
			projectId: proyecto.metadata.id,
			asset: { ...procesado, ephemeral: true },
		});
		if (!medio) throw new Error("No se pudo guardar el archivo revertido");

		// El clip pudo cambiar mientras se procesaba: se aplica sobre el vigente.
		const vigente = editor.timeline
			.getElementsWithTracks({ elements: [{ trackId: track.id, elementId: element.id }] })
			.at(0)?.element;
		if (!vigente || vigente.type !== "video" || vigente.mediaId !== element.mediaId) {
			toast.dismiss(idAviso);
			return;
		}

		const largoNuevo = medio.duration
			? Math.round(medio.duration * TICKS_PER_SECOND)
			: tramo;
		const nuevoOrigen: Origen = {
			mediaId: element.mediaId,
			trimStart: element.trimStart,
			trimEnd: element.trimEnd,
			sourceDuration: total,
			tramo,
		};
		const params: ParamValues = { [CLAVE_ORIGEN]: JSON.stringify(nuevoOrigen) };
		editor.timeline.updateElements({
			updates: [
				{
					trackId: track.id,
					elementId: element.id,
					patch: {
						mediaId: medio.id,
						trimStart: roundMediaTime({ time: 0 }),
						// El archivo nuevo puede salir un cuadro más largo que el tramo.
						trimEnd: roundMediaTime({ time: Math.max(0, largoNuevo - tramo) }),
						sourceDuration: roundMediaTime({ time: largoNuevo }),
						params,
					} as Partial<VideoElement>,
				},
			],
		});
		toast.success("Reversión completada", { id: idAviso, action: undefined, duration: 2500 });
	} catch (error) {
		if (error instanceof RevertirCancelado || control.signal.aborted) {
			toast("Reversión cancelada", { id: idAviso, action: undefined, duration: 2500 });
		} else {
			console.error("[revertir] falló", error);
			toast.error("No se pudo revertir. Intenta de nuevo.", {
				id: idAviso,
				action: undefined,
				duration: 4000,
			});
		}
	} finally {
		enCurso = null;
	}
}

/**
 * Vuelve el clip al medio original. Un instante r del archivo invertido es el
 * instante  inicio + tramo − r  del original, así que los recortes de ahora se
 * traducen y lo que se ve sigue siendo lo mismo, pero hacia adelante.
 */
function restaurarOriginal(
	editor: EditorCore,
	trackId: string,
	element: VideoElement,
	origen: Origen,
): void {
	const largoInvertido = element.sourceDuration ?? origen.tramo;
	const trimStart = Math.max(
		0,
		origen.trimStart + (origen.tramo - largoInvertido) + element.trimEnd,
	);
	const trimEnd = Math.max(0, origen.trimEnd + element.trimStart);
	editor.timeline.updateElements({
		updates: [
			{
				trackId,
				elementId: element.id,
				patch: {
					mediaId: origen.mediaId,
					trimStart: roundMediaTime({ time: trimStart }),
					trimEnd: roundMediaTime({ time: trimEnd }),
					sourceDuration: roundMediaTime({ time: origen.sourceDuration }),
					params: { [CLAVE_ORIGEN]: "" },
				} as Partial<VideoElement>,
			},
		],
	});
}
