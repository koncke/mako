// =============================================================================
// El gancho visual de «Animación»
// =============================================================================
// Corre en resolve.ts después de los keyframes, para clips (video, imagen,
// sticker, forma) y textos: la animación se SUMA a lo que el clip ya tiene, así
// una Entrada «Deslizar a la izquierda» sobre un texto con fotogramas de
// posición llega a donde dicen los fotogramas.
//
// Orden 100: antes del reflejo (1000, recorte/ganchos.ts) y de las transiciones
// (1100, transiciones/gancho.ts), que necesitan el signo FINAL de la escala.
// `aplicarPose` conserva los `pases` del estado, como pide ganchos-ce.ts.
//
// Un texto se reconoce por sus params (`content`): el contexto del gancho no
// trae el tipo, y un texto se desliza menos que un clip (ver catalogo.ts).

import { registrarGanchoVisual } from "@/app/video-editor/_opencut/services/renderer/ganchos-ce";
import { aplicarPose, poseEn } from "./calcular";

export const ORDEN_GANCHO_ANIMACION = 100;

registrarGanchoVisual({
	id: "ce-animacion",
	orden: ORDEN_GANCHO_ANIMACION,
	aplicar: (estado, ctx) => {
		const pose = poseEn(
			ctx.params,
			ctx.localTime,
			ctx.duration,
			typeof ctx.params.content === "string",
		);
		return aplicarPose(estado, pose, ctx.lienzo);
	},
});
