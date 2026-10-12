// =============================================================================
// «Transiciones»: parámetros del clip de la IZQUIERDA del corte
// =============================================================================
// Contrato del paquete G (docs/diseno-editor-video.md §4.1): `transicion.id` (el
// id del catálogo de transiciones/catalogo.ts; vacío = ninguna) y
// `transicion.duracion` (segundos, 0,5 por defecto). El tope —la mitad del clip
// más corto del corte— no se guarda: lo aplica la escena al dibujar, así acortar
// un clip no pierde la duración elegida.
//
// No se animan (CapCut no pone ◇ a la transición) y no viajan con «Pegar
// atributos» ni con «Congelar» (los dos excluyen el prefijo `transicion.`).
// La pestaña «Transición» del panel derecho las edita (transiciones/components/panel.tsx);
// ninguna lista genérica las dibuja: el respaldo de video no existe y el de audio
// filtra por `audio.`.

import type { ElementType } from "@/app/video-editor/_opencut/timeline";
import type { ElementParamDefinition } from "@/app/video-editor/_opencut/params/registry";
import {
	DURACION_MINIMA,
	DURACION_POR_DEFECTO,
	PARAM_TRANSICION_DURACION,
	PARAM_TRANSICION_ID,
} from "@/app/video-editor/_opencut/transiciones/claves";

export { PARAM_TRANSICION_DURACION, PARAM_TRANSICION_ID };

/** La definición de «Duración»; el panel la usa con el `max` del corte. */
export const DEF_DURACION_TRANSICION: ElementParamDefinition = {
	key: PARAM_TRANSICION_DURACION,
	label: "Duración",
	type: "number",
	default: DURACION_POR_DEFECTO,
	min: DURACION_MINIMA,
	step: 0.1,
	keyframable: false,
};

const params: ElementParamDefinition[] = [
	{
		key: PARAM_TRANSICION_ID,
		label: "Transición",
		type: "text",
		default: "",
		keyframable: false,
	},
	DEF_DURACION_TRANSICION,
];

export const paramsTransiciones: Partial<Record<ElementType, ElementParamDefinition[]>> = {
	video: params,
	image: params,
};
