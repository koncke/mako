// =============================================================================
// «Ver cómo queda»: al elegir una animación, el reproductor la muestra una vez
// =============================================================================
// Como CapCut: elegir una Entrada reproduce el comienzo del clip, una Salida el
// final, un Combinado o un Bucle el clip, y se detiene solo. Si el cliente toca
// el reproductor en el medio (pausa o mueve el cabezal), se deja de vigilar y
// manda él.
//
// Se mueve el cabezal con `seek` y la reproducción normal: NUNCA con
// `setScrubbing`, que prende el auto-scroll de la regla (hallazgos → «El
// teclado: actions/ escucha en captura…»).

import type { EditorCore } from "@/app/video-editor/_opencut/core";
import type { TimelineElement } from "@/app/video-editor/_opencut/timeline";
import { mediaTime, type MediaTime } from "@/app/video-editor/_opencut/wasm";
import { TICKS_PER_SECOND } from "@/app/video-editor/_opencut/wasm";
import type { CategoriaAnimacion } from "./catalogo";

let cancelarAnterior: (() => void) | null = null;

export function reproducirTramo(editor: EditorCore, desde: MediaTime, hasta: MediaTime): void {
	cancelarAnterior?.();
	if (hasta <= desde) return;
	const playback = editor.playback;
	playback.pause();
	playback.seek({ time: desde });

	const terminar = () => {
		quitarUpdate();
		quitarSeek();
		quitarEstado();
		if (cancelarAnterior === terminar) cancelarAnterior = null;
	};
	const quitarUpdate = playback.onUpdate((t) => {
		if (t >= hasta) {
			terminar();
			playback.pause();
		}
	});
	// Lo que mueva el cabezal desde ahora es del cliente.
	const quitarSeek = playback.onSeek(() => terminar());
	const quitarEstado = playback.subscribe(() => {
		if (!playback.getIsPlaying()) terminar();
	});
	cancelarAnterior = terminar;
	playback.play();
}

/** El tramo que muestra cada categoría al elegir un preset (un poco de margen después). */
export function reproducirAnimacion(
	editor: EditorCore,
	element: TimelineElement,
	categoria: CategoriaAnimacion,
	duracionSegundos: number,
): void {
	const inicio = element.startTime;
	const fin = element.startTime + element.duration;
	const margen = Math.round(0.3 * TICKS_PER_SECOND);
	const ticks = Math.round(duracionSegundos * TICKS_PER_SECOND);
	let desde: number = inicio;
	let hasta: number = fin;
	if (categoria === "entrada") hasta = Math.min(fin, inicio + ticks + margen);
	if (categoria === "salida") desde = Math.max(inicio, fin - ticks - margen);
	// Combinado y Bucle: el clip entero, con un tope para no reproducir un minuto.
	if (categoria === "combo" || categoria === "bucle") {
		hasta = Math.min(fin, inicio + Math.max(ticks, 3 * TICKS_PER_SECOND));
	}
	// Un cuadro antes del final: en `fin` el clip ya no se ve.
	hasta = Math.min(hasta, fin - 1);
	reproducirTramo(editor, mediaTime({ ticks: desde }), mediaTime({ ticks: hasta }));
}
