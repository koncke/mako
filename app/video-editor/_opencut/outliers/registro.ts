// =============================================================================
// Lo que registran los outliers en las ranuras del editor (11/11/2026)
// =============================================================================
// Biblioteca › Multimedia › «Outliers», justo después de «Importar» (orden 12; «Edición automática» es 15): Martín, 11/11/2026,
// «que en alguna parte, por ejemplo del lado de Importar, estén estos outliers». El panel: ./components/outliers-view.tsx.
//
// Lo importa ce/extensiones.ts.

import { seccionesBiblioteca } from "@/app/video-editor/ce/ranuras";
import { OutliersView } from "./components/outliers-view";

export const SECCION_OUTLIERS = "multimedia.outliers";

seccionesBiblioteca.registrar({
	categoria: "multimedia",
	id: SECCION_OUTLIERS,
	etiqueta: "Outliers",
	orden: 12,
	Contenido: OutliersView,
});
