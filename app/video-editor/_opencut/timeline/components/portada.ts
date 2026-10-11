// =============================================================================
// La «Portada» del proyecto (botón a la izquierda de la pista principal)
// =============================================================================
// En CapCut la portada es un cuadro del video o una imagen propia, y se exporta
// con el video. Se guarda en `project.settings.portada` (viaja con el proyecto
// y se deshace con Ctrl+Z, porque pasa por `updateSettings`).
//
// Para el diálogo Exportar (paquete A): `leerPortada(editor)` devuelve lo
// elegido, o `null` si nunca se eligió (CapCut usa entonces el primer cuadro).
// `imagenDePortada(editor)` la resuelve a una imagen (data URL JPEG) del cuadro
// de la pista principal o de la imagen cargada.

import type { EditorCore } from "@/app/video-editor/_opencut/core";
import type { TPortada } from "@/app/video-editor/_opencut/project/types";
import type { MediaTime } from "@/app/video-editor/_opencut/wasm";
import { TICKS_PER_SECOND } from "@/app/video-editor/_opencut/wasm";
import { getSourceTimeAtClipTime } from "@/app/video-editor/_opencut/retime";
import { cuadroGrande } from "./miniaturas";

export type { TPortada };

export function leerPortada(editor: EditorCore): TPortada | null {
	return editor.project.getActiveOrNull()?.settings.portada ?? null;
}

export async function fijarPortada({
	editor,
	portada,
}: {
	editor: EditorCore;
	portada: TPortada | undefined;
}): Promise<void> {
	await editor.project.updateSettings({ settings: { portada } });
}

/**
 * La fuente del cuadro de la pista principal en un instante: el video
 * decodificado en ese punto, o la imagen. `null` si no hay clip ahí.
 */
export async function cuadroPrincipalEn({
	editor,
	tiempo,
	alto = 360,
}: {
	editor: EditorCore;
	tiempo: MediaTime;
	alto?: number;
}): Promise<CanvasImageSource | null> {
	const scene = editor.scenes.getActiveSceneOrNull();
	if (!scene) return null;
	const clip = scene.tracks.main.elements.find(
		(e) => tiempo >= e.startTime && tiempo < e.startTime + e.duration,
	) ?? scene.tracks.main.elements[0];
	if (!clip) return null;
	const asset = editor.media.getAssets().find((a) => a.id === clip.mediaId);
	if (!asset) return null;

	if (clip.type === "image") {
		const url = asset.url ?? asset.thumbnailUrl;
		if (!url) return null;
		return cargarImagen(url);
	}
	if (!asset.file) return null;
	const enClip = Math.max(0, (tiempo - clip.startTime) / TICKS_PER_SECOND);
	const fuente =
		clip.trimStart / TICKS_PER_SECOND +
		getSourceTimeAtClipTime({ clipTime: enClip, retime: clip.retime });
	return cuadroGrande({
		mediaId: asset.id,
		file: asset.file,
		tiempo: Math.round(fuente * 30) / 30,
		alto,
	});
}

function cargarImagen(url: string): Promise<HTMLImageElement | null> {
	return new Promise((resolve) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => resolve(null);
		img.src = url;
	});
}

/** La portada como imagen JPEG (data URL), para quien la exporte. */
export async function imagenDePortada(editor: EditorCore): Promise<string | null> {
	const portada = leerPortada(editor);
	if (portada?.tipo === "imagen") return portada.imagen;
	const tiempo = (portada?.tipo === "cuadro" ? portada.tiempo : 0) as MediaTime;
	const fuente = await cuadroPrincipalEn({ editor, tiempo, alto: 720 });
	if (!fuente) return null;
	const { width, height } = medidas(fuente);
	if (!width || !height) return null;
	const lienzo = document.createElement("canvas");
	lienzo.width = width;
	lienzo.height = height;
	lienzo.getContext("2d")?.drawImage(fuente, 0, 0, width, height);
	return lienzo.toDataURL("image/jpeg", 0.9);
}

export function medidas(fuente: CanvasImageSource): { width: number; height: number } {
	if (fuente instanceof HTMLImageElement) {
		return { width: fuente.naturalWidth, height: fuente.naturalHeight };
	}
	if (fuente instanceof HTMLVideoElement) {
		return { width: fuente.videoWidth, height: fuente.videoHeight };
	}
	const conMedidas = fuente as { width?: number | SVGAnimatedLength; height?: number | SVGAnimatedLength };
	const w = typeof conMedidas.width === "number" ? conMedidas.width : 0;
	const h = typeof conMedidas.height === "number" ? conMedidas.height : 0;
	return { width: w, height: h };
}

/** Achica una imagen cargada por el usuario a JPEG ≤ 1280 px (se guarda en el proyecto). */
export async function imagenLocalAPortada(file: File): Promise<string | null> {
	const url = URL.createObjectURL(file);
	try {
		const img = await cargarImagen(url);
		if (!img) return null;
		const escala = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
		const lienzo = document.createElement("canvas");
		lienzo.width = Math.round(img.naturalWidth * escala);
		lienzo.height = Math.round(img.naturalHeight * escala);
		lienzo.getContext("2d")?.drawImage(img, 0, 0, lienzo.width, lienzo.height);
		return lienzo.toDataURL("image/jpeg", 0.88);
	} finally {
		URL.revokeObjectURL(url);
	}
}
