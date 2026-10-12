// =============================================================================
// «Animación» (Entrada · Salida · Combinado / Bucle): parámetros del elemento
// =============================================================================
// Cada ranura de animación es un par «id del preset + duración en segundos»
// (CapCut guarda lo mismo en `material_animations`: tipo, id y duración). Las
// lee el gancho visual de animaciones/gancho.ts; las escribe la pestaña
// «Animación» del panel derecho (animaciones/components/pestana-animacion.tsx).
//
//   video, imagen          Entrada · Salida · Combinado
//   texto, sticker, forma  Entrada · Salida · Bucle  (CapCut no tiene Combinado
//                          para texto ni stickers: tiene Bucle)
//
// No se animan con ◇ (CapCut tampoco): son la animación misma. Se copian con
// «Pegar atributos» porque están declaradas, como en CapCut («Animación» es una
// de las categorías del diálogo).

import type { ElementType } from "@/app/video-editor/_opencut/timeline";
import type { ElementParamDefinition } from "@/app/video-editor/_opencut/params/registry";
import {
	ID_NINGUNO,
	presetsPara,
	type CategoriaAnimacion,
} from "@/app/video-editor/_opencut/animaciones/catalogo";

export const ANIM = {
	entrada: { id: "anim.entrada.id", duracion: "anim.entrada.duracion" },
	salida: { id: "anim.salida.id", duracion: "anim.salida.duracion" },
	combo: { id: "anim.combo.id", duracion: "anim.combo.duracion" },
	bucle: { id: "anim.bucle.id", duracion: "anim.bucle.duracion" },
} as const satisfies Record<CategoriaAnimacion, { id: string; duracion: string }>;

/** Lo que se ve en el rótulo de la sub-pestaña (los del es-LA.po: `animation_out`, `combo`, `animation_loop`). */
export const ROTULO_CATEGORIA: Record<CategoriaAnimacion, string> = {
	entrada: "Entrada",
	salida: "Salida",
	combo: "Combinado",
	bucle: "Bucle",
};

function paramsDe(categoria: CategoriaAnimacion, esTexto: boolean): ElementParamDefinition[] {
	const claves = ANIM[categoria];
	return [
		{
			key: claves.id,
			label: ROTULO_CATEGORIA[categoria],
			type: "select",
			default: ID_NINGUNO,
			keyframable: false,
			options: [
				{ value: ID_NINGUNO, label: "Ninguno" },
				...presetsPara(categoria, esTexto).map((p) => ({ value: p.id, label: p.nombre })),
			],
		},
		{
			key: claves.duracion,
			label: "Duración",
			type: "number",
			default: 0.5,
			min: 0.1,
			step: 0.1,
			keyframable: false,
		},
	];
}

const clip = [
	...paramsDe("entrada", false),
	...paramsDe("salida", false),
	...paramsDe("combo", false),
];
const conBucle = (esTexto: boolean) => [
	...paramsDe("entrada", esTexto),
	...paramsDe("salida", esTexto),
	...paramsDe("bucle", esTexto),
];

export const paramsAnimaciones: Partial<Record<ElementType, ElementParamDefinition[]>> = {
	video: clip,
	image: clip,
	text: conBucle(true),
	sticker: conBucle(false),
	graphic: conBucle(false),
};

/** Las categorías que muestra CapCut para cada tipo de elemento, en su orden. */
export function categoriasPara(tipo: ElementType): CategoriaAnimacion[] {
	if (tipo === "video" || tipo === "image") return ["entrada", "salida", "combo"];
	if (tipo === "text" || tipo === "sticker" || tipo === "graphic") return ["entrada", "salida", "bucle"];
	return [];
}
