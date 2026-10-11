// =============================================================================
// «Guías y reglas» de CapCut: la lógica (sin dibujo)
// =============================================================================
// Las guías del usuario viven en preview-store (por proyecto, en fracción del
// lienzo). Acá se convierten a los espacios que usa el resto del reproductor:
//   · píxeles del lienzo desde el borde (lo que muestra «Editar guía»);
//   · píxeles desde el CENTRO (el espacio de las posiciones y del imán).
// No confundir con guides/registry.tsx: eso son las superposiciones de OpenCut
// (cuadrícula, zonas seguras de TikTok…), que CapCut no tiene.

import type { TCanvasSize } from "@/app/video-editor/_opencut/project/types";
import type { GuiasIman } from "@/app/video-editor/_opencut/preview/preview-snap";
import {
	guiasDe,
	usePreviewStore,
	type GuiaUsuario,
} from "@/app/video-editor/_opencut/preview/preview-store";

export type UnidadGuia = "pixeles" | "porcentaje";

/** El largo del lienzo sobre el que se mide una guía de este eje. */
export function largoDelEje(eje: GuiaUsuario["eje"], lienzo: TCanvasSize): number {
	return eje === "horizontal" ? lienzo.height : lienzo.width;
}

/** Fracción → valor en la unidad elegida (lo que se ve en «Editar guía»). */
export function aUnidad({
	fraccion,
	eje,
	lienzo,
	unidad,
}: {
	fraccion: number;
	eje: GuiaUsuario["eje"];
	lienzo: TCanvasSize;
	unidad: UnidadGuia;
}): number {
	return unidad === "porcentaje"
		? Math.round(fraccion * 1000) / 10
		: Math.round(fraccion * largoDelEje(eje, lienzo));
}

/** Valor en la unidad elegida → fracción. */
export function desdeUnidad({
	valor,
	eje,
	lienzo,
	unidad,
}: {
	valor: number;
	eje: GuiaUsuario["eje"];
	lienzo: TCanvasSize;
	unidad: UnidadGuia;
}): number {
	return unidad === "porcentaje" ? valor / 100 : valor / largoDelEje(eje, lienzo);
}

/**
 * Las guías visibles del proyecto como destinos del imán. `undefined` si están
 * ocultas: una guía que no se ve no puede atraer nada (se sentiría como un bug).
 */
export function guiasParaIman({
	proyecto,
	lienzo,
}: {
	proyecto: string | undefined;
	lienzo: TCanvasSize;
}): GuiasIman | undefined {
	const estado = usePreviewStore.getState();
	if (!estado.mostrarGuias) return undefined;
	const guias = guiasDe(estado, proyecto);
	if (guias.length === 0) return undefined;
	return {
		vertical: guias
			.filter((g) => g.eje === "vertical")
			.map((g) => g.fraccion * lienzo.width - lienzo.width / 2),
		horizontal: guias
			.filter((g) => g.eje === "horizontal")
			.map((g) => g.fraccion * lienzo.height - lienzo.height / 2),
	};
}
