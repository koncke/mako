"use client";

// =============================================================================
// Volver a partir un subtítulo cuando el panel «Texto» le cambia la medida
// =============================================================================
// El motor no parte líneas: un subtítulo lleva los saltos que le puso
// build-subtitle-text-element.ts al crearlo, medidos con SU fuente y SU tamaño.
// Si después Texto › Básico o Texto › Efectos (paquete de texto) le cambian la
// fuente, el tamaño o el espaciado, esos renglones ya no son los que entran en el
// lienzo: más grande, el subtítulo se sale por los costados. Es el contrato de
// subtítulos con el panel de texto (docs/diseno-editor-video.md §4.1).
//
// Se vuelve a partir con el borde de ABAJO donde estaba antes del cambio (como
// «Aplicar en todos los subtítulos»): crecer empuja hacia arriba, no hacia el
// borde del video. Va SIN paso de deshacer propio: Ctrl+Z del cambio de fuente
// restaura el estado guardado por ese comando, que trae los renglones de antes.
// Durante el arrastre de un deslizador (vista previa) no se toca nada; se parte
// una vez, al soltar.

import { useEffect, useRef } from "react";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import type { ParamValues } from "@/app/video-editor/_opencut/params";
import type { TimelineElement } from "@/app/video-editor/_opencut/timeline";
import { bordeInferiorDe, partirYUbicar } from "./build-subtitle-text-element";
import { cargarFuentes, esSubtitulo, lienzoDe } from "./insert";

/** Lo que cambia el ANCHO de un renglón (el color o el trazo no parten distinto). */
const CLAVES_QUE_PARTEN = ["fontFamily", "fontSize", "fontWeight", "fontStyle", "letterSpacing"] as const;

const firmaDe = (params: ParamValues) => CLAVES_QUE_PARTEN.map((k) => String(params[k] ?? "")).join("|");

export function useRepartirSubtitulo({ element, trackId }: { element: TimelineElement; trackId: string }): void {
	const editor = useEditor();
	const enVistaPrevia = useEditor((e) => e.timeline.isPreviewActive());
	const anterior = useRef<{ id: string; firma: string; params: ParamValues } | null>(null);
	const subtitulo = esSubtitulo(element);
	const firma = firmaDe(element.params);

	useEffect(() => {
		if (!subtitulo) {
			anterior.current = null;
			return;
		}
		// Se espera a que se suelte el deslizador: la referencia queda en la de antes.
		if (enVistaPrevia) return;
		const previo = anterior.current;
		anterior.current = { id: element.id, firma, params: element.params };
		if (!previo || previo.id !== element.id || previo.firma === firma) return;

		const lienzo = lienzoDe(editor);
		const borde = bordeInferiorDe({ params: previo.params, lienzo });
		void (async () => {
			// Medir con la fuente de respaldo parte mal (insert.ts → cargarFuentes).
			await cargarFuentes([String(element.params.fontFamily ?? "")]);
			// Se relee: mientras cargaba la fuente pudo cambiar otra cosa (un color,
			// que no se pierde) o la medida otra vez (la parte la corrida siguiente).
			const [par] = editor.timeline.getElementsWithTracks({
				elements: [{ trackId, elementId: element.id }],
			});
			if (!par || !esSubtitulo(par.element) || firmaDe(par.element.params) !== firma) return;
			const params = par.element.params;
			const ubicado = partirYUbicar({
				params,
				lienzo,
				repartir: true,
				ubicacion: borde != null ? { bordeInferior: borde } : {},
			});
			if (
				ubicado.content === params.content &&
				ubicado["transform.positionY"] === params["transform.positionY"]
			) {
				return;
			}
			editor.timeline.updateElements({
				updates: [
					{
						trackId,
						elementId: element.id,
						patch: {
							params: {
								...params,
								content: ubicado.content,
								"transform.positionY": ubicado["transform.positionY"],
							},
						},
					},
				],
				pushHistory: false,
			});
		})();
	}, [editor, element.id, element.params, enVistaPrevia, firma, subtitulo, trackId]);
}
