// =============================================================================
// Qué pasa con la animación cuando el clip se DIVIDE
// =============================================================================
// Como CapCut: la Entrada es del comienzo y la Salida del final. Al dividir en
// dos, la mitad izquierda se queda con la Entrada y la derecha con la Salida; si
// las dos mitades las conservaran, el corte del medio tendría una salida y una
// entrada que nadie eligió. Combinado y Bucle quedan en las dos (son del clip
// entero). Con «Borrar a la izquierda / derecha» la mitad que queda conserva
// todo, igual que al recortar un borde.
//
// Lo usa commands/timeline/element/split-elements.ts.

import type { ParamValues } from "@/app/video-editor/_opencut/params";
import { ANIM } from "@/app/video-editor/_opencut/params/extra/animaciones";
import { ID_NINGUNO } from "./catalogo";

function sinCategoria(params: ParamValues, clave: string): ParamValues {
	const actual = params[clave];
	if (actual === undefined || actual === ID_NINGUNO) return params;
	return { ...params, [clave]: ID_NINGUNO };
}

/** La mitad IZQUIERDA de un clip dividido: sin la Salida. */
export function sinSalida(params: ParamValues): ParamValues {
	return sinCategoria(params, ANIM.salida.id);
}

/** La mitad DERECHA de un clip dividido: sin la Entrada. */
export function sinEntrada(params: ParamValues): ParamValues {
	return sinCategoria(params, ANIM.entrada.id);
}
