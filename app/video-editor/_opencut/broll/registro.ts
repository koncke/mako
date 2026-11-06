// =============================================================================
// Lo que registra el B-roll de MaKo en las ranuras del editor
// =============================================================================
// Biblioteca › Multimedia › «B-roll de MaKo» (después de «Importar»): proponer imágenes y cambios de plano y dejar o
// sacar cada uno (./components/broll-view.tsx).
// Barra de la línea de tiempo: «B-roll de MaKo» (centena 300, la de la IA), que abre esa sección, como «Edición basada
// en la transcripción».
//
// Lo importa ce/extensiones.ts.

import { Images } from "lucide-react";
import { herramientasLinea, seccionesBiblioteca } from "@/app/video-editor/ce/ranuras";
import { useAssetsPanelStore } from "@/app/video-editor/_opencut/components/editor/panels/assets/assets-panel-store";
import { BrollView } from "./components/broll-view";

export const SECCION_BROLL = "multimedia.broll";

seccionesBiblioteca.registrar({
	categoria: "multimedia",
	id: SECCION_BROLL,
	etiqueta: "B-roll de MaKo",
	orden: 20,
	Contenido: BrollView,
});

herramientasLinea.registrar({
	id: "linea-broll",
	etiqueta: "B-roll de MaKo",
	orden: 330,
	lado: "izquierda",
	Icono: Images,
	habilitada: ({ editor }) => editor.timeline.getTotalDuration() > 0,
	ejecutar: () => useAssetsPanelStore.getState().irA({ categoria: "multimedia", seccion: SECCION_BROLL }),
});
