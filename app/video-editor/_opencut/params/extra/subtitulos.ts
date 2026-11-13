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

/**
 * «Resaltar palabras clave»: el color de las palabras clave de cada subtítulo (hex).
 * Las palabras van en `subtitulo.claves` (subtitles/claves.ts), que NO se declara: es
 * de SU texto, como los tiempos. El color sí es estilo: viaja con «Aplicar en todos»,
 * con los presets de la marca y con «Pegar atributos».
 */
export const PARAM_CLAVES_COLOR = "subtitulo.clavesColor";

/**
 * «Animación de la palabra» (lo de Submagic y el estilo Hormozi, 10/11/2026): cómo se mueve la palabra que se está
 * diciendo. `pop`: entra de abajo hacia arriba, crece y se asienta un poco más grande («pop-in» del blog de Submagic
 * sobre los subtítulos de Hormozi); `crecer`: queda más grande mientras se dice, sin moverse. Necesita los tiempos por
 * palabra, como el karaoke, pero no el color: va con o sin «Subtítulos pronunciados». Lo calcula text/resaltado.ts.
 */
export const PARAM_ANIM_PALABRA = "subtitulo.animPalabra";
export type AnimPalabra = "ninguna" | "pop" | "crecer";
export const ANIMS_PALABRA: readonly AnimPalabra[] = ["ninguna", "pop", "crecer"];

/**
 * «Tamaño de las palabras clave», en % (100 = igual que el resto). El blog de Submagic: las claves de Hormozi van
 * «con otro color o más grandes». Es estilo, como el color de las claves.
 */
export const PARAM_CLAVES_TAMANO = "subtitulo.clavesTamano";

export type ModoResaltar = "ninguno" | "palabra" | "frase";
export const MODOS_RESALTAR: readonly ModoResaltar[] = ["ninguno", "palabra", "frase"];

export const DEFAULTS_RESALTADO = {
	modo: "ninguno" as ModoResaltar,
	// El amarillo de la casa (el de las plantillas «Amarillo» y «Titular»).
	color: "#ffe14d",
	noDichasOpacidad: 100,
};

/** Verde y no amarillo: con el karaoke prendido (amarillo), la palabra que se dice y la clave se distinguen. */
export const DEFAULTS_CLAVES = { color: "#4ade80", tamano: 100 };

export const DEFAULTS_ANIM_PALABRA: AnimPalabra = "ninguna";

/**
 * Topes del tamaño de las claves. Hasta el 13/11/2026 era 160 % («más tapa a las vecinas»): desde entonces el renglón le
 * reserva a la clave su ancho al partirse (subtitles/build-subtitle-text-element.ts) y su alto al dibujarse
 * (text/resaltado.ts → centrosDeRenglones), y «La palabra clave gigante» la pide 3 veces más grande.
 */
export const TOPES_CLAVES_TAMANO = { min: 100, max: 300 };

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
			key: PARAM_CLAVES_COLOR,
			label: "Color de las palabras clave",
			type: "color",
			default: DEFAULTS_CLAVES.color,
			...sinFotograma,
		},
		{
			key: PARAM_ANIM_PALABRA,
			label: "Animación de la palabra",
			type: "select",
			default: DEFAULTS_ANIM_PALABRA,
			options: [
				{ value: "ninguna", label: "Ninguna" },
				{ value: "pop", label: "Salta" },
				{ value: "crecer", label: "Crece" },
			],
			...sinFotograma,
		},
		{
			key: PARAM_CLAVES_TAMANO,
			label: "Tamaño de las palabras clave",
			type: "number",
			default: DEFAULTS_CLAVES.tamano,
			min: TOPES_CLAVES_TAMANO.min,
			max: TOPES_CLAVES_TAMANO.max,
			step: 5,
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
