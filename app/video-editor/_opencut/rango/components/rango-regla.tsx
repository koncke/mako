"use client";

// =============================================================================
// El rango (I / O) dibujado en la regla de la línea de tiempo
// =============================================================================
// Una franja del azul de la casa entre la entrada y la salida, con las dos
// puntas marcadas, detrás de las marcas de la regla. No recibe el mouse: la
// regla sigue llevando el cabezal con un clic o arrastrando.
//
// ⚠️ El dibujo NO está copiado de una captura: el relevamiento
// (relevamiento-capcut-armazon §7.4) dice qué hacen I/O pero no cómo se ven, y
// la ayuda de CapCut no se pudo abrir desde la nube. Es la forma de siempre de
// un rango en una regla; los colores y el grosor se ajustan mirando el CapCut
// de Martín.
//
// El tramo se CALCULA con la duración de ahora (reglas.ts → tramoEfectivo): si
// se borran clips y la línea se acorta, la franja se recorta sola.

import { timelineTimeToSnappedPixels } from "@/app/video-editor/_opencut/timeline";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import { useRangoStore } from "../rango-store";
import { tramoEfectivo } from "../reglas";

export function RangoEnRegla({ zoomLevel }: { zoomLevel: number }) {
	const duracion = useEditor((e) => e.timeline.getTotalDuration());
	const proyecto = useEditor((e) => e.project.getActiveOrNull()?.metadata.id ?? null);
	const marcas = useRangoStore((s) => (proyecto ? s.porProyecto[proyecto] : undefined));
	const tramo = tramoEfectivo(marcas, duracion);
	if (!tramo) return null;

	const izquierda = timelineTimeToSnappedPixels({ time: tramo.desde, zoomLevel });
	const derecha = timelineTimeToSnappedPixels({ time: tramo.hasta, zoomLevel });
	return (
		<div
			aria-hidden
			data-ce-rango=""
			className="pointer-events-none absolute inset-y-0 border-x-2 border-(--cc-accent) bg-(--cc-accent)/25"
			style={{ left: `${izquierda}px`, width: `${Math.max(2, derecha - izquierda)}px` }}
		/>
	);
}
