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
//
// En LOS DOS caminos (revisión del 10/11/2026) se sacan los fotogramas clave de la posición y la escala del clip
// (`sinAnimacionDelEncuadre`): estaban pensados para el cuadro horizontal, y una animación le gana al valor de base, así
// que dejarlos tapaba el encuadre (o el recorte al centro). Antes los sacaba sólo el camino que sigue, y sin decirlo:
// ahora quien abre el clip lo avisa (`clipsConAnimacionDelEncuadre`, ./abrir.ts).

import type { ImageElement, SceneTracks, TimelineElement, VideoElement, VideoTrack } from "@/app/video-editor/_opencut/timeline";
import type { ElementAnimations } from "@/app/video-editor/_opencut/animation/types";
import { cubrirCelda, paramsDeCubrir } from "@/app/video-editor/_opencut/plantillas/geometria";
import { paramsDelEncuadre, type EncuadreSeguido } from "./seguir";

export type Tamano = { width: number; height: number };

/** Lo que se encontró siguiendo a la persona, por id de clip, y quién le escribe los fotogramas clave. */
export type Seguimiento = {
	encuadres: ReadonlyMap<string, EncuadreSeguido>;
	animar: (elemento: TimelineElement, encuadre: EncuadreSeguido) => TimelineElement;
};

/** Lo animado que mandaría sobre el encuadre (una animación le gana al valor de base). */
export const ANIMADO_DEL_ENCUADRE = ["transform.positionX", "transform.positionY", "transform.scaleX", "transform.scaleY"] as const;

const esDelPrincipalQueCubre = (el: TimelineElement): el is VideoElement | ImageElement => el.type === "video" || el.type === "image";

/** El clip sin los fotogramas clave de su posición y su escala (lo demás animado queda). El mismo si no tenía. */
export function sinAnimacionDelEncuadre(el: TimelineElement): TimelineElement {
	const animaciones = el.animations as ElementAnimations | undefined;
	if (!animaciones || !ANIMADO_DEL_ENCUADRE.some((c) => animaciones[c] !== undefined)) return el;
	const resto: ElementAnimations = { ...animaciones };
	for (const camino of ANIMADO_DEL_ENCUADRE) delete resto[camino];
	return { ...el, animations: Object.keys(resto).length ? resto : undefined } as TimelineElement;
}

/** El tamaño de la fuente que se usa para cubrir, o null (sin tamaño, el clip queda como estaba). */
const fuenteValida = (el: VideoElement | ImageElement, tamanoDe: (mediaId: string) => Tamano | null) => {
	const fuente = tamanoDe(el.mediaId);
	return fuente && fuente.width > 0 && fuente.height > 0 ? fuente : null;
};

/**
 * Cuántos clips de la pista principal pierden fotogramas clave de posición o escala al pasar a vertical (para avisar):
 * los que `principalCubriendo` toca, con la MISMA pregunta (los que siguen a la persona y los que tienen tamaño).
 */
export function clipsConAnimacionDelEncuadre(
	tracks: SceneTracks,
	tamanoDe: (mediaId: string) => Tamano | null,
	encuadres?: ReadonlyMap<string, EncuadreSeguido>,
): number {
	return (tracks.main.elements as TimelineElement[]).filter(
		(el) => esDelPrincipalQueCubre(el) && (encuadres?.has(el.id) || fuenteValida(el, tamanoDe)) && sinAnimacionDelEncuadre(el) !== el,
	).length;
}

export function principalCubriendo(
	tracks: SceneTracks,
	lienzo: Tamano,
	tamanoDe: (mediaId: string) => Tamano | null,
	seguimiento?: Seguimiento,
): SceneTracks {
	let cambio = false;
	const elements = (tracks.main.elements as TimelineElement[]).map((el) => {
		if (!esDelPrincipalQueCubre(el)) return el;
		const encuadre = seguimiento?.encuadres.get(el.id);
		if (encuadre && seguimiento) {
			cambio = true;
			const encuadrado = { ...sinAnimacionDelEncuadre(el), params: { ...el.params, ...paramsDelEncuadre(encuadre) } } as TimelineElement;
			return seguimiento.animar(encuadrado, encuadre);
		}
		const fuente = fuenteValida(el, tamanoDe);
		if (!fuente) return el;
		cambio = true;
		const celda = { x: 0, y: 0, ancho: lienzo.width, alto: lienzo.height };
		return { ...sinAnimacionDelEncuadre(el), params: { ...el.params, ...paramsDeCubrir(cubrirCelda({ fuente, celda, lienzo })) } } as TimelineElement;
	});
	if (!cambio) return tracks;
	return { ...tracks, main: { ...tracks.main, elements } as VideoTrack };
}
