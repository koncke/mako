// =============================================================================
// Clips mágicos: el video principal cubriendo el cuadro vertical (puro: sin motor, sin `wasm`)
// =============================================================================
// Al pasar el clip a 9:16, cada clip de la pista principal se agranda y se recorta al centro para llenar el cuadro, como
// una plantilla llena su hueco (../plantillas/geometria.ts → `cubrirCelda`): sin bandas negras, que en un Reel se leen
// como un video mal hecho.
//
// Desde el 10/11/2026, un clip donde se encontró a la persona (./seguir.ts) no se recorta al centro: se agranda hasta
// cubrir el alto y se corre para tenerla a la vista (`paramsDelEncuadre`). Si se mueve, `animar` le pone los
// fotogramas clave (lo hace ./seguir-en-editor.ts, que tiene el motor). Sin encuadre para ese clip, el centro de siempre.

import type { SceneTracks, TimelineElement, VideoTrack } from "@/app/video-editor/_opencut/timeline";
import { cubrirCelda, paramsDeCubrir } from "@/app/video-editor/_opencut/plantillas/geometria";
import { paramsDelEncuadre, type EncuadreSeguido } from "./seguir";

export type Tamano = { width: number; height: number };

/** Lo que se encontró siguiendo a la persona, por id de clip, y quién le escribe los fotogramas clave. */
export type Seguimiento = {
	encuadres: ReadonlyMap<string, EncuadreSeguido>;
	animar: (elemento: TimelineElement, encuadre: EncuadreSeguido) => TimelineElement;
};

export function principalCubriendo(
	tracks: SceneTracks,
	lienzo: Tamano,
	tamanoDe: (mediaId: string) => Tamano | null,
	seguimiento?: Seguimiento,
): SceneTracks {
	let cambio = false;
	const elements = (tracks.main.elements as TimelineElement[]).map((el) => {
		if (el.type !== "video" && el.type !== "image") return el;
		const encuadre = seguimiento?.encuadres.get(el.id);
		if (encuadre && seguimiento) {
			cambio = true;
			const encuadrado = { ...el, params: { ...el.params, ...paramsDelEncuadre(encuadre) } } as TimelineElement;
			return seguimiento.animar(encuadrado, encuadre);
		}
		const fuente = tamanoDe(el.mediaId);
		if (!fuente || !(fuente.width > 0) || !(fuente.height > 0)) return el;
		cambio = true;
		const celda = { x: 0, y: 0, ancho: lienzo.width, alto: lienzo.height };
		return { ...el, params: { ...el.params, ...paramsDeCubrir(cubrirCelda({ fuente, celda, lienzo })) } } as TimelineElement;
	});
	if (!cambio) return tracks;
	return { ...tracks, main: { ...tracks.main, elements } as VideoTrack };
}
