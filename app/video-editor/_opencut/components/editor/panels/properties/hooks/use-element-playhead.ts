import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import { EditorCore } from "@/app/video-editor/_opencut/core";
import { getElementLocalTime } from "@/app/video-editor/_opencut/animation";
import { addMediaTime, mediaTime, type MediaTime } from "@/app/video-editor/_opencut/wasm";

/**
 * El cabezal visto desde un elemento: su tiempo local y si está sobre él.
 *
 * `seguirTiempo: false` (12/11/2026): sin fotogramas clave, lo único del cabezal que cambia lo que se ve es si está o no
 * sobre el clip. Escuchar el TIEMPO redibujaba cada grupo del panel (Escala, Posición, Mezcla… con sus tooltips) en cada
 * salto y en cada cuadro reproduciendo: 167–477 componentes por salto con un clip elegido, medido en producción
 * (docs/hallazgos-video-editor.md → «Se me traba…»). Así se escucha sólo el booleano; `leerTiempoLocal()` lee el de AHORA
 * para un clic (crear el primer fotograma clave).
 */
export function useElementPlayhead({
	startTime,
	duration,
	seguirTiempo = true,
}: {
	startTime: MediaTime;
	duration: MediaTime;
	seguirTiempo?: boolean;
}) {
	const tiempoSeguido = useEditor((editor) => (seguirTiempo ? editor.playback.getCurrentTime() : null));
	const dentroSinTiempo = useEditor((editor) =>
		seguirTiempo ? null : cabezalDentro(editor.playback.getCurrentTime(), startTime, duration),
	);
	const local = (t: MediaTime) =>
		mediaTime({
			ticks: getElementLocalTime({
				timelineTime: t,
				elementStartTime: startTime,
				elementDuration: duration,
			}),
		});
	const leerTiempoLocal = () => local(EditorCore.getInstance().playback.getCurrentTime());
	if (tiempoSeguido === null) {
		return { localTime: leerTiempoLocal(), isPlayheadWithinElementRange: dentroSinTiempo === true, leerTiempoLocal };
	}
	return {
		localTime: local(tiempoSeguido),
		isPlayheadWithinElementRange: cabezalDentro(tiempoSeguido, startTime, duration),
		leerTiempoLocal,
	};
}

export function cabezalDentro(cabezal: MediaTime, startTime: MediaTime, duration: MediaTime): boolean {
	return cabezal >= startTime && cabezal <= addMediaTime({ a: startTime, b: duration });
}
