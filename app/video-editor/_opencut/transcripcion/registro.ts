// =============================================================================
// Lo que registra la edición por transcripción en las ranuras del editor
// =============================================================================
// Biblioteca › Subtítulos › «Transcripción» (después de «Subtítulos automáticos»):
//   la transcripción para editar el video borrando texto, y «Eliminar las muletillas».
// Barra de la línea de tiempo: «Edición basada en la transcripción» (centena 300, la
//   de la IA), que abre esa sección, como el botón de CapCut.
//
// Lo importa ce/extensiones.ts.

import { FileText } from "lucide-react";
import { herramientasLinea, seccionesBiblioteca } from "@/app/video-editor/ce/ranuras";
import { useAssetsPanelStore } from "@/app/video-editor/_opencut/components/editor/panels/assets/assets-panel-store";
import { TranscripcionView } from "./components/transcripcion-view";

export const SECCION_TRANSCRIPCION = "subtitulos.transcripcion";

seccionesBiblioteca.registrar({
	categoria: "subtitulos",
	id: SECCION_TRANSCRIPCION,
	// `pc_text_cut_transcript`.
	etiqueta: "Transcripción",
	orden: 15,
	Contenido: TranscripcionView,
});

herramientasLinea.registrar({
	id: "linea-transcripcion",
	// `pc_text_cut_text_clip_mode`.
	etiqueta: "Edición basada en la transcripción",
	orden: 320,
	lado: "izquierda",
	Icono: FileText,
	habilitada: ({ editor }) => editor.timeline.getTotalDuration() > 0,
	ejecutar: () =>
		useAssetsPanelStore.getState().irA({ categoria: "subtitulos", seccion: SECCION_TRANSCRIPCION }),
});
