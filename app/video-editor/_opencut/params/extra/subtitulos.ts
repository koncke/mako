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
//
// «Animaciones de subtítulos» de CapCut (el karaoke): «Subtítulos pronunciados»
// con «Palabra pronunciada» / «Frase pronunciada» y su color, y «Subtítulos no
// pronunciados» con su «Opacidad». Lo calcula text/resaltado.ts con los tiempos
// por palabra (`subtitulo.palabras`, subtitles/palabras.ts) y lo dibuja
// text/dibujar.ts. Éstos SÍ son estilo: viajan con «Aplicar en todos los
// subtítulos», con las plantillas y con «Pegar atributos». En un texto sin
// tiempos por palabra no hacen nada. El color es CONTENIDO (lo que se dibuja en
// el video): va en hex, no con los tokens del tema.

import type { ElementType } from "@/app/video-editor/_opencut/timeline";
import type { ElementParamDefinition } from "@/app/video-editor/_opencut/params/registry";

export const PARAM_SUBTITULO = "subtitulo";

/** «Subtítulos pronunciados»: `ninguno` · `palabra` (sólo la que se dice) · `frase` (todo lo ya dicho). */
export const PARAM_RESALTAR = "subtitulo.resaltar";
/** El color de lo pronunciado (hex). */
export const PARAM_RESALTAR_COLOR = "subtitulo.resaltarColor";
/** «Subtítulos no pronunciados › Opacidad», 0–100: 100 = sin efecto. */
export const PARAM_NO_DICHAS_OPACIDAD = "subtitulo.noDichasOpacidad";

export type ModoResaltar = "ninguno" | "palabra" | "frase";
export const MODOS_RESALTAR: readonly ModoResaltar[] = ["ninguno", "palabra", "frase"];

export const DEFAULTS_RESALTADO = {
	modo: "ninguno" as ModoResaltar,
	// El amarillo de la casa (el de las plantillas «Amarillo» y «Titular»).
	color: "#ffe14d",
	noDichasOpacidad: 100,
};

const sinFotograma = { keyframable: false } as const;

export const paramsSubtitulos: Partial<Record<ElementType, ElementParamDefinition[]>> = {
	text: [
		{
			key: PARAM_SUBTITULO,
			label: "Subtítulo",
			type: "boolean",
			default: false,
			keyframable: false,
		},
		{
			key: PARAM_RESALTAR,
			label: "Subtítulos pronunciados",
			type: "select",
			default: DEFAULTS_RESALTADO.modo,
			options: [
				{ value: "ninguno", label: "Ninguno" },
				{ value: "palabra", label: "Palabra pronunciada" },
				{ value: "frase", label: "Frase pronunciada" },
			],
			...sinFotograma,
		},
		{
			key: PARAM_RESALTAR_COLOR,
			label: "Color",
			type: "color",
			default: DEFAULTS_RESALTADO.color,
			...sinFotograma,
		},
		{
			key: PARAM_NO_DICHAS_OPACIDAD,
			label: "Opacidad",
			type: "number",
			default: DEFAULTS_RESALTADO.noDichasOpacidad,
			min: 0,
			max: 100,
			step: 1,
			...sinFotograma,
		},
	],
};
