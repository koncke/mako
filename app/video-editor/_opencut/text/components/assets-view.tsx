"use client";

// =============================================================================
// Texto › Agregar texto: la tarjeta «Texto predeterminado» de CapCut
// =============================================================================
// Un clic, el ⊕ o arrastrarla a la línea de tiempo agrega un texto de 3 s (lo
// que dura en CapCut) que dice «Texto predeterminado», en el cabezal si es por
// clic. Los estilos de texto («Efectos de texto», «Plantilla de texto») los
// registra el paquete de texto en sus propias secciones de esta pestaña.

import { DraggableItem } from "@/app/video-editor/_opencut/components/editor/panels/assets/draggable-item";
import {
	ContenidoBiblioteca,
	GrillaBiblioteca,
} from "@/app/video-editor/_opencut/components/editor/panels/assets/views/biblioteca-ui";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import { buildTextElement } from "@/app/video-editor/_opencut/timeline/element-utils";
import { mediaTimeFromSeconds, type MediaTime } from "@/app/video-editor/_opencut/wasm";

/** El rótulo de CapCut (`default_text`), que también es el contenido del texto nuevo. */
export const TEXTO_PREDETERMINADO = "Texto predeterminado";
const SEGUNDOS_TEXTO_NUEVO = 3;

export function TextView() {
	const editor = useEditor();
	const duracion = mediaTimeFromSeconds({ seconds: SEGUNDOS_TEXTO_NUEVO });

	const agregar = (startTime: MediaTime) => {
		if (!editor.scenes.getActiveSceneOrNull()) return;
		editor.timeline.insertElement({
			element: buildTextElement({
				raw: {
					name: TEXTO_PREDETERMINADO,
					duration: duracion,
					params: { content: TEXTO_PREDETERMINADO },
				},
				startTime,
			}),
			placement: { mode: "auto" },
		});
	};

	return (
		<ContenidoBiblioteca>
			<GrillaBiblioteca>
				<DraggableItem
					name={TEXTO_PREDETERMINADO}
					preview={
						<div className="flex size-full items-center justify-center bg-[var(--cc-sunken)] p-2">
							<span className="text-center text-[13px] leading-tight font-semibold text-white select-none">
								{TEXTO_PREDETERMINADO}
							</span>
						</div>
					}
					dragData={{
						id: "texto-predeterminado",
						type: "text",
						name: TEXTO_PREDETERMINADO,
						content: TEXTO_PREDETERMINADO,
						duration: duracion,
					}}
					aspectRatio={1}
					shouldShowLabel={false}
					onClick={() => agregar(editor.playback.getCurrentTime())}
					onAddToTimeline={({ currentTime }) => agregar(currentTime)}
					containerClassName="w-full"
				/>
			</GrillaBiblioteca>
		</ContenidoBiblioteca>
	);
}
