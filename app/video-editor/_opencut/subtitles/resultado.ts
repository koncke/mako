// =============================================================================
// Lo que devuelve «Generar» de Subtítulos, y lo que se le dice a la persona
// =============================================================================
// generarSubtitulos (./generar.ts) no lanza: cada salida es un resultado, y cada
// falla un motivo con UN texto que dice qué pasó y qué hacer. Lo leen los que lo
// llaman: el panel (abajo del botón, por el store), el botón de Transcripción (un
// aviso) y el chat (su descarte, chat/aplicar.ts). Antes el motivo quedaba sólo en
// el store, y el chat —que mira si la línea cambió— decía «no se pudo generar los
// subtítulos» por cualquiera (ticket 23, 28/10/2026).
//
// Sin imports pesados: el test lo carga en node.

import type { FaseGenerar } from "./estado";

export type MotivoSubtitulos =
	| "sin-proyecto"
	| "ocupado"
	| "audio"
	| "descarga"
	| "reconocer"
	| "sin-voz"
	| "falta-medio"
	| "poner"
	| "cancelado"
	| "otro-proyecto";

export type ResultadoSubtitulos = { ok: true; subtitulos: number } | { ok: false; motivo: MotivoSubtitulos };

/** En minúscula: el chat lo pone detrás de «No se aplica:». */
export const MOTIVO_SUBTITULOS: Record<MotivoSubtitulos, string> = {
	"sin-proyecto": "no hay un proyecto abierto: abre uno y prueba de nuevo",
	ocupado: "ya se están generando los subtítulos: espera a que terminen",
	audio: "no se pudo leer el audio del video: prueba de nuevo y, si vuelve a fallar, recarga la página",
	descarga: "no se pudo bajar el reconocedor de voz: revisa la conexión y prueba de nuevo",
	reconocer: "no se pudo reconocer la voz: prueba de nuevo y, si vuelve a fallar, recarga la página",
	"sin-voz": "no se reconoció la voz: el clip no tiene voz o es sólo música",
	// 11/11/2026, probado en producción: con el archivo borrado del navegador, la pista sonaba muda y decía «sin voz».
	"falta-medio": "falta en este navegador el archivo de un video del proyecto: vuelve a importarlo y prueba de nuevo",
	poner: "no se pudieron poner los subtítulos en el video: prueba de nuevo",
	cancelado: "se cancelaron los subtítulos antes de terminar",
	"otro-proyecto": "se cambió de proyecto mientras se generaban: vuelve a pedirlos en este",
};

/** El mismo texto, para el panel y los avisos (con mayúscula). */
export function textoDeSubtitulos(motivo: MotivoSubtitulos): string {
	const t = MOTIVO_SUBTITULOS[motivo];
	return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * Lo que va pasando mientras se generan, para el panel Y para la tarjeta del chat (9/11/2026: medido en producción, el
 * chat mostraba sólo un círculo durante el minuto que tarda la primera vez, mientras baja el reconocedor).
 */
export function rotuloProgresoSubtitulos(fase: FaseGenerar, progreso: number): string {
	const { que, cuanto } = partesProgresoSubtitulos(fase, progreso);
	return cuanto ? `${que} ${cuanto}` : que;
}

/**
 * Lo mismo en dos partes, para un hueco angosto: el panel de Subtítulos mide ~220 px y con «Cancelar» al lado cortaba el
 * porcentaje («Generando subtítulos… 0…», medido el 10/11/2026). Lo que se corta es el qué; el cuánto se ve siempre.
 */
export function partesProgresoSubtitulos(fase: FaseGenerar, progreso: number): { que: string; cuanto: string | null } {
	switch (fase) {
		case "modelo":
			// La primera vez baja el modelo (~250 MB); después sale de la caché.
			return { que: "Descargando…", cuanto: `${progreso} %` };
		case "transcribiendo":
			return { que: "Generando subtítulos…", cuanto: `${progreso} %` };
		default:
			return { que: "Generando subtítulos…", cuanto: null };
	}
}

/**
 * ¿Algún clip de video o de audio de la línea apunta a un archivo que no está? Pasa cuando el navegador perdió el archivo
 * (los proyectos viven en el navegador): el editor arma la línea igual, sin ese medio, y su audio sale MUDO. Sin esto,
 * los subtítulos decían «no se reconoció la voz» de un video que sí habla (probado en producción el 11/11/2026).
 * La música de la biblioteca viene por URL: no cuenta.
 */
export function faltaAlgunArchivo(
	tracks: { main: { elements: readonly unknown[] }; overlay: ReadonlyArray<{ elements: readonly unknown[] }>; audio: ReadonlyArray<{ elements: readonly unknown[] }> },
	idsDeMedios: ReadonlySet<string>,
): boolean {
	for (const pista of [tracks.main, ...tracks.overlay, ...tracks.audio]) {
		for (const e of pista.elements as Array<{ type?: string; mediaId?: unknown; sourceType?: string }>) {
			if (e.type !== "video" && e.type !== "audio") continue;
			if (e.type === "audio" && e.sourceType === "library") continue;
			if (typeof e.mediaId === "string" && !idsDeMedios.has(e.mediaId)) return true;
		}
	}
	return false;
}

/** Algo lanzó: la fase en la que iba dice qué fue (Whisper ya probó WebGPU y WASM). */
export function motivoDeLaFalla(fase: FaseGenerar): MotivoSubtitulos {
	if (fase === "audio") return "audio";
	if (fase === "modelo") return "descarga";
	if (fase === "armando") return "poner";
	return "reconocer";
}
