// =============================================================================
// «Eliminar fondo» › «Eliminación automática»: parámetro del clip
// =============================================================================
// `fondo.automatico` prende el recorte de la persona (segmentación en el
// navegador, fondo/recorte-persona.ts). Es un sí/no del clip como el de CapCut,
// sin ◇: CapCut tampoco anima el recorte automático. El Chroma key NO va acá:
// es el efecto `croma` del clip (effects/definitions/croma.ts), con sus params
// en `element.effects`.

import type { ElementType } from "@/app/video-editor/_opencut/timeline";
import type { ElementParamDefinition } from "@/app/video-editor/_opencut/params/registry";

export const FONDO_AUTOMATICO = "fondo.automatico";

export const PARAM_FONDO_AUTOMATICO: ElementParamDefinition = {
	key: FONDO_AUTOMATICO,
	label: "Eliminación automática",
	type: "boolean",
	default: false,
	keyframable: false,
};

const params: ElementParamDefinition[] = [PARAM_FONDO_AUTOMATICO];

export const paramsFondo: Partial<Record<ElementType, ElementParamDefinition[]>> = {
	video: params,
	image: params,
};
