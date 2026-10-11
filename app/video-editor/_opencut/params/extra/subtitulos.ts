// =============================================================================
// «Subtítulos»: la marca que distingue un subtítulo de un texto cualquiera
// =============================================================================
// `subtitulo` = true en un texto lo hace subtítulo (contrato del paquete K,
// docs/diseno-editor-video.md §4.1): la pista se rotula «Subtítulos» si todos sus
// textos lo son, «Exportar › Subtítulos» los lleva al .srt, la pestaña
// «Subtítulos» del panel derecho los lista, y las plantillas de subtítulo y
// «Aplicar en todos los subtítulos» los cambian juntos. Lo ponen «Subtítulos
// automáticos», «Subtítulos locales» y «Agregar subtítulos» (subtitles/).
//
// ⚠️ No es un atributo de ESTILO: copiar/pegar atributos no lo tiene que llevar
// a un texto común (lo convertiría en subtítulo sin que nadie lo pida).

import type { ElementType } from "@/app/video-editor/_opencut/timeline";
import type { ElementParamDefinition } from "@/app/video-editor/_opencut/params/registry";

export const PARAM_SUBTITULO = "subtitulo";

export const paramsSubtitulos: Partial<Record<ElementType, ElementParamDefinition[]>> = {
	text: [
		{
			key: PARAM_SUBTITULO,
			label: "Subtítulo",
			type: "boolean",
			default: false,
			keyframable: false,
		},
	],
};
