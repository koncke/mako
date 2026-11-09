// =============================================================================
// Lo que registra la «Edición automática» en las ranuras del editor
// =============================================================================
// Biblioteca › Multimedia › «Edición automática» (después de «Importar», antes de «B-roll de MaKo»): el panel con los
// agentes y su registro (./components/enjambre-view.tsx).
// Barra de la línea de tiempo: «Edición automática» (centena 300, la de la IA, la primera de ella): arranca la
// edición y abre su panel. Si ya corre, sólo abre el panel.
//
// Lo importa ce/extensiones.ts.

import { WandSparkles } from "lucide-react";
import { toast } from "sonner";
import { herramientasLinea, seccionesBiblioteca } from "@/app/video-editor/ce/ranuras";
import { useAssetsPanelStore } from "@/app/video-editor/_opencut/components/editor/panels/assets/assets-panel-store";
import { EnjambreView } from "./components/enjambre-view";
import { SECCION_ENJAMBRE, useEnjambre } from "./estado";
import { correrEnjambre } from "./correr";

seccionesBiblioteca.registrar({
	categoria: "multimedia",
	id: SECCION_ENJAMBRE,
	etiqueta: "Edición automática",
	orden: 15,
	Contenido: EnjambreView,
});

herramientasLinea.registrar({
	id: "linea-edicion-automatica",
	etiqueta: "Edición automática",
	orden: 305,
	lado: "izquierda",
	Icono: WandSparkles,
	habilitada: ({ editor }) => editor.timeline.getTotalDuration() > 0,
	ejecutar: ({ editor }) => {
		if (useEnjambre.getState().fase === "corriendo") {
			useAssetsPanelStore.getState().irA({ categoria: "multimedia", seccion: SECCION_ENJAMBRE });
			return;
		}
		void correrEnjambre(editor)
			.then((r) => {
				if (!r.ok) toast.error(r.texto);
			})
			.catch((error) => {
				console.error("[edición automática]", error);
				toast.error("La edición automática se cortó por un error.");
			});
	},
});
