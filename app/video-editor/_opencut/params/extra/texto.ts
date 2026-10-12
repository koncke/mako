// =============================================================================
// Texto › Básico: los parámetros que CapCut tiene y el motor de OpenCut no
// =============================================================================
// OpenCut trae contenido, fuente, tamaño, negrita/cursiva/subrayado, color,
// espaciado, interlineado, alineación y fondo (params/registry.ts). CapCut suma:
//
//   May./min.   Mayúscula · Minúscula · Tipo título (`pc_capitalization_*`)
//   Trazo       Color · Grosor · Posición (Dentro / Centro / Fuera)
//   Sombra      Color · Opacidad · Desenfocar · Distancia · Ángulo
//   Fondo       Opacidad (el color, las esquinas, el alto/ancho y el
//               desplazamiento ya son del motor)
//   Brillo      Color · Intensidad · Intervalo (`pc_glow_effect`)
//   Curva       Fuerza (`pc_text_bend`, `pc_text_bend_degree`). CapCut no curva
//               un texto con fondo ni subrayado: el dibujo lo deja recto.
//
// Los dibuja text/dibujar.ts y los lee text/estilo.ts. Las unidades son las de
// la pantalla de CapCut (0–100), y el dibujo las pasa a píxeles en proporción
// al tamaño de la letra: así un trazo de 20 se ve igual en un lienzo vertical y
// en uno horizontal (la trampa del tamaño absoluto, hallazgos → «Todo se mide en
// píxeles del LIENZO»).
//
// Ninguno se anima con ◇: CapCut tampoco pone fotograma clave a trazo ni sombra.
// Los colores de acá son CONTENIDO (lo que se dibuja en el video), por eso van
// en hex y no con los tokens del tema.

import type { ElementType } from "@/app/video-editor/_opencut/timeline";
import type { ElementParamDefinition } from "@/app/video-editor/_opencut/params/registry";

export const TEXTO = {
	mayusculas: "texto.mayusculas",
	trazoActivo: "trazo.activo",
	trazoColor: "trazo.color",
	trazoGrosor: "trazo.grosor",
	trazoPosicion: "trazo.posicion",
	sombraActiva: "sombra.activa",
	sombraColor: "sombra.color",
	sombraOpacidad: "sombra.opacidad",
	sombraDesenfoque: "sombra.desenfoque",
	sombraDistancia: "sombra.distancia",
	sombraAngulo: "sombra.angulo",
	fondoOpacidad: "texto.fondoOpacidad",
	brilloActivo: "brillo.activo",
	brilloColor: "brillo.color",
	brilloIntensidad: "brillo.intensidad",
	brilloIntervalo: "brillo.intervalo",
	curvaActiva: "curva.activa",
	curvaFuerza: "curva.fuerza",
} as const;

export type Mayusculas = "ninguno" | "mayusculas" | "minusculas" | "titulo";
export type PosicionTrazo = "dentro" | "centro" | "fuera";

// Los valores por defecto de CapCut (relevamiento §4.1, del borrador): trazo
// negro de 0,06 al activarse (≈ 20 en la escala de la pantalla), sombra negra
// con opacidad 0,9, desenfoque 0,45, distancia 5 y ángulo −45°.
export const DEFAULTS_TEXTO = {
	mayusculas: "ninguno" as Mayusculas,
	trazoColor: "#000000",
	trazoGrosor: 20,
	trazoPosicion: "fuera" as PosicionTrazo,
	sombraColor: "#000000",
	sombraOpacidad: 90,
	sombraDesenfoque: 45,
	sombraDistancia: 5,
	sombraAngulo: -45,
	fondoOpacidad: 100,
	// Brillo y Curva: los valores por defecto de CapCut no están en el
	// relevamiento; son nuestros, a ojo (un halo que se nota sin tapar la letra,
	// y un arco que se lee como arco sin cerrarse en círculo).
	brilloColor: "#ffffff",
	brilloIntensidad: 50,
	brilloIntervalo: 30,
	curvaFuerza: 50,
};

const sinFotograma = { keyframable: false } as const;

export const paramsTexto: Partial<Record<ElementType, ElementParamDefinition[]>> = {
	text: [
		{
			key: TEXTO.mayusculas,
			label: "May./min.",
			type: "select",
			default: DEFAULTS_TEXTO.mayusculas,
			options: [
				{ value: "ninguno", label: "Ninguno" },
				{ value: "mayusculas", label: "Mayúscula" },
				{ value: "minusculas", label: "Minúscula" },
				{ value: "titulo", label: "Tipo título" },
			],
			...sinFotograma,
		},
		{ key: TEXTO.trazoActivo, label: "Trazo", type: "boolean", default: false, ...sinFotograma },
		{ key: TEXTO.trazoColor, label: "Color", type: "color", default: DEFAULTS_TEXTO.trazoColor, ...sinFotograma },
		{
			key: TEXTO.trazoGrosor,
			label: "Grosor",
			type: "number",
			default: DEFAULTS_TEXTO.trazoGrosor,
			min: 0,
			max: 100,
			step: 1,
			...sinFotograma,
		},
		{
			key: TEXTO.trazoPosicion,
			label: "Posición",
			type: "select",
			default: DEFAULTS_TEXTO.trazoPosicion,
			options: [
				// `CC_PC_material_text_effect_stroke_position_{in,middle,out}`.
				{ value: "dentro", label: "Dentro" },
				{ value: "centro", label: "Centro" },
				{ value: "fuera", label: "Fuera" },
			],
			...sinFotograma,
		},
		{ key: TEXTO.sombraActiva, label: "Sombra", type: "boolean", default: false, ...sinFotograma },
		{ key: TEXTO.sombraColor, label: "Color", type: "color", default: DEFAULTS_TEXTO.sombraColor, ...sinFotograma },
		{
			key: TEXTO.sombraOpacidad,
			label: "Opacidad",
			type: "number",
			default: DEFAULTS_TEXTO.sombraOpacidad,
			min: 0,
			max: 100,
			step: 1,
			...sinFotograma,
		},
		{
			key: TEXTO.sombraDesenfoque,
			label: "Desenfocar",
			type: "number",
			default: DEFAULTS_TEXTO.sombraDesenfoque,
			min: 0,
			max: 100,
			step: 1,
			...sinFotograma,
		},
		{
			key: TEXTO.sombraDistancia,
			label: "Distancia",
			type: "number",
			default: DEFAULTS_TEXTO.sombraDistancia,
			min: 0,
			max: 100,
			step: 1,
			...sinFotograma,
		},
		{
			key: TEXTO.sombraAngulo,
			label: "Ángulo",
			type: "number",
			default: DEFAULTS_TEXTO.sombraAngulo,
			min: -180,
			max: 180,
			step: 1,
			...sinFotograma,
		},
		{
			key: TEXTO.fondoOpacidad,
			label: "Opacidad",
			type: "number",
			default: DEFAULTS_TEXTO.fondoOpacidad,
			min: 0,
			max: 100,
			step: 1,
			dependencies: [{ param: "background.enabled", equals: true }],
			...sinFotograma,
		},
		{ key: TEXTO.brilloActivo, label: "Brillo", type: "boolean", default: false, ...sinFotograma },
		{ key: TEXTO.brilloColor, label: "Color", type: "color", default: DEFAULTS_TEXTO.brilloColor, ...sinFotograma },
		{
			key: TEXTO.brilloIntensidad,
			label: "Intensidad",
			type: "number",
			default: DEFAULTS_TEXTO.brilloIntensidad,
			min: 0,
			max: 100,
			step: 1,
			...sinFotograma,
		},
		{
			key: TEXTO.brilloIntervalo,
			// `effects_adjust_range`: «Range» es «Intervalo» en el .po.
			label: "Intervalo",
			type: "number",
			default: DEFAULTS_TEXTO.brilloIntervalo,
			min: 0,
			max: 100,
			step: 1,
			...sinFotograma,
		},
		{ key: TEXTO.curvaActiva, label: "Curva", type: "boolean", default: false, ...sinFotograma },
		{
			key: TEXTO.curvaFuerza,
			label: "Fuerza",
			type: "number",
			default: DEFAULTS_TEXTO.curvaFuerza,
			// Positivo = arco hacia arriba (como un arcoíris); negativo, hacia abajo.
			min: -100,
			max: 100,
			step: 1,
			...sinFotograma,
		},
	],
};
