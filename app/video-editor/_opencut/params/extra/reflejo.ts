// =============================================================================
// «Reflejar» (Voltear de CapCut): parámetros del clip
// =============================================================================
// `reflejo.horizontal` es lo que alterna el botón «Reflejar» de la barra de la
// línea de tiempo; `reflejo.vertical` queda para el panel (CapCut guarda los dos
// en `clip.flip`). No se animan: CapCut tampoco pone ◇ al volteo. Los aplica el
// gancho visual de recorte/ganchos.ts (escala negativa → el compositor espeja).

import type { ElementType } from "@/app/video-editor/_opencut/timeline";
import type { ElementParamDefinition } from "@/app/video-editor/_opencut/params/registry";

export const REFLEJO_HORIZONTAL = "reflejo.horizontal";
export const REFLEJO_VERTICAL = "reflejo.vertical";

const params: ElementParamDefinition[] = [
	{
		key: REFLEJO_HORIZONTAL,
		label: "Reflejar",
		type: "boolean",
		default: false,
		keyframable: false,
	},
	{
		key: REFLEJO_VERTICAL,
		label: "Voltear",
		type: "boolean",
		default: false,
		keyframable: false,
	},
];

export const paramsReflejo: Partial<Record<ElementType, ElementParamDefinition[]>> = {
	video: params,
	image: params,
};
