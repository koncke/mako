// =============================================================================
// Los subtítulos siguen a la voz cuando el CHAT cambia la velocidad de un clip (10/11/2026)
// =============================================================================
// Medido en producción el 10/11/2026 (ws9, el proyecto «1110»: dos clips con voz y 10 subtítulos): «Poné todo el video un
// poco más rápido» → 1,3× en los dos clips, y MaKo contestó «Los textos se ajustan automáticamente a los nuevos tiempos».
// No: la Vinculación (ripple/iman.ts, la de CapCut) CORRE en bloque lo que está encima de cada clip, pero no lo reescala.
// Los clips terminaban en 16,6 s y los subtítulos en 18,8 s (2 s de negro con texto), «Por eso creé una app» salía 1,3 s
// después de dicho y dos subtítulos se pisaban.
//
// LA REGLA: cuando el chat le cambia la velocidad a un clip que lleva la voz (pista principal o de audio) y la velocidad es
// constante antes y después, cada subtítulo que toca su tramo pasa por la misma cuenta que la voz:
//   · lo que estaba a d s del inicio del clip queda a d·f s (f = duración nueva / vieja);
//   · lo que estaba después del fin del clip se corre lo mismo que el clip siguiente: con el imán, fin nuevo − fin viejo;
//     sin imán, nada (el siguiente no se mueve);
//   · los tiempos por palabra (subtitles/palabras.ts) pasan por la misma cuenta, así el resaltado sigue cayendo en la palabra.
// Los subtítulos que EMPIEZAN después del clip no se tocan acá: los corre la Vinculación con su clip. Con una curva de
// velocidad la cuenta no es lineal: no se toca nada (y MaKo no lo promete, lib/editor-video/chat-catalogo.ts).
// El panel Velocidad sigue como CapCut (no los toca): esto es lo que MaKo promete al editar por chat.
//
// PURO (sin el motor): lo usa chat/comandos.ts y lo prueba tests/video-editor-velocidad-subtitulos.test.ts.
// =============================================================================

import { PARAM_PALABRAS, codificarPalabras, palabrasDe } from "@/app/video-editor/_opencut/subtitles/palabras";

/** Un subtítulo de la línea de tiempo, en ticks (lo que el motor guarda). */
export type SubtituloEnTramo = {
	trackId: string;
	elementId: string;
	startTime: number;
	duration: number;
	trimStart: number;
	/** El texto del subtítulo (`params.content`): las palabras guardadas valen sólo si lo siguen diciendo. */
	contenido: string;
	/** `params["subtitulo.palabras"]`, tal cual. */
	palabras: unknown;
};

export type ReajusteSubtitulo = {
	trackId: string;
	elementId: string;
	patch: { startTime: number; duration: number; params?: Record<string, string> };
};

/**
 * Lo que hay que cambiarles a los subtítulos cuando el clip `clip` (ANTES del cambio, en ticks) pasa a terminar en
 * `finNuevo`. `iman`: el clip es de la pista principal con el imán prendido (lo de después se corre con él).
 * `tps`: ticks por segundo del motor. Vacío si no hay nada que cambiar.
 */
export function reajustarSubtitulos({
	subtitulos,
	clip,
	finNuevo,
	iman,
	tps,
}: {
	subtitulos: readonly SubtituloEnTramo[];
	clip: { startTime: number; duration: number };
	finNuevo: number;
	iman: boolean;
	tps: number;
}): ReajusteSubtitulo[] {
	const inicio = clip.startTime;
	const finViejo = clip.startTime + clip.duration;
	if (clip.duration <= 0 || finNuevo <= inicio || finNuevo === finViejo) return [];
	const f = (finNuevo - inicio) / clip.duration;
	const corrimiento = iman ? finNuevo - finViejo : 0;
	/** Dónde queda, en ticks, lo que estaba en el tick `t`. */
	const mapa = (t: number) => (t <= inicio ? t : t < finViejo ? inicio + (t - inicio) * f : t + corrimiento);

	const salida: ReajusteSubtitulo[] = [];
	for (const s of subtitulos) {
		const fin = s.startTime + s.duration;
		if (s.startTime >= finViejo || fin <= inicio) continue;
		const startTime = Math.round(mapa(s.startTime));
		const duration = Math.max(1, Math.round(mapa(fin)) - startTime);
		const patch: ReajusteSubtitulo["patch"] = { startTime, duration };
		const g = palabrasDe({
			contenido: s.contenido,
			param: s.palabras,
			inicio: s.startTime / tps,
			recorteInicio: s.trimStart / tps,
			duracion: s.duration / tps,
		});
		if (g && g.palabras.length > 0) {
			const enSegundos = (seg: number) => mapa(seg * tps) / tps;
			patch.params = {
				[PARAM_PALABRAS]: codificarPalabras({
					palabras: g.palabras.map((p) => ({ ...p, inicio: enSegundos(p.inicio), fin: enSegundos(p.fin) })),
					origen: (startTime - s.trimStart) / tps,
					precision: g.precision,
				}),
			};
		}
		salida.push({ trackId: s.trackId, elementId: s.elementId, patch });
	}
	return salida;
}
