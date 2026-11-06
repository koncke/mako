// =============================================================================
// Clips mágicos: el video principal cubriendo el cuadro vertical (puro: sin motor, sin `wasm`)
// =============================================================================
// Al pasar el clip a 9:16, cada clip de la pista principal se agranda y se recorta al centro para llenar el cuadro, como
// una plantilla llena su hueco (../plantillas/geometria.ts → `cubrirCelda`): sin bandas negras, que en un Reel se leen
// como un video mal hecho.

import type { SceneTracks, TimelineElement, VideoTrack } from "@/app/video-editor/_opencut/timeline";
import { cubrirCelda, paramsDeCubrir } from "@/app/video-editor/_opencut/plantillas/geometria";

export type Tamano = { width: number; height: number };

export function principalCubriendo(
	tracks: SceneTracks,
	lienzo: Tamano,
	tamanoDe: (mediaId: string) => Tamano | null,
): SceneTracks {
	let cambio = false;
	const elements = (tracks.main.elements as TimelineElement[]).map((el) => {
		if (el.type !== "video" && el.type !== "image") return el;
		const fuente = tamanoDe(el.mediaId);
		if (!fuente || !(fuente.width > 0) || !(fuente.height > 0)) return el;
		cambio = true;
		const celda = { x: 0, y: 0, ancho: lienzo.width, alto: lienzo.height };
		return { ...el, params: { ...el.params, ...paramsDeCubrir(cubrirCelda({ fuente, celda, lienzo })) } } as TimelineElement;
	});
	if (!cambio) return tracks;
	return { ...tracks, main: { ...tracks.main, elements } as VideoTrack };
}
