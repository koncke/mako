// =============================================================================
// «Eje de vista previa» (S) de CapCut
// =============================================================================
// Con el eje prendido, pasar el mouse por la línea de tiempo muestra en el
// reproductor el cuadro que está debajo del mouse, SIN mover el cabezal; al
// salir, el reproductor vuelve al cuadro del cabezal. La línea de tiempo
// escribe acá el tiempo del mouse y el reproductor (preview/components) lo lee
// en su bucle de dibujo: `tiempoEjeVistaPrevia() ?? playback.getCurrentTime()`.
//
// Es estado de módulo y no de React a propósito: el reproductor lo lee en cada
// cuadro de animación, y pasar por un store re-renderizaría el árbol entero a
// cada movimiento del mouse.
//
// Sólo video: «Vista previa de video y audio» y «Reproducir el audio mientras
// se navega» (sonido al pasar el mouse) quedan para después.

import type { MediaTime } from "@/app/video-editor/_opencut/wasm";

let tiempo: MediaTime | null = null;
const oyentes = new Set<(t: MediaTime | null) => void>();

/** El tiempo debajo del mouse, o `null` si el reproductor debe mostrar el cabezal. */
export function tiempoEjeVistaPrevia(): MediaTime | null {
	return tiempo;
}

export function fijarTiempoEjeVistaPrevia(nuevo: MediaTime | null): void {
	if (nuevo === tiempo) return;
	tiempo = nuevo;
	for (const oyente of oyentes) oyente(nuevo);
}

export function escucharEjeVistaPrevia(
	oyente: (t: MediaTime | null) => void,
): () => void {
	oyentes.add(oyente);
	return () => {
		oyentes.delete(oyente);
	};
}
