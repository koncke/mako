// =============================================================================
// Biblioteca › Plantillas: lo que registra el paquete de las plantillas de anuncio
// =============================================================================
// Una sola sección, «Anuncios»: las plantillas PROPIAS de anuncio vertical
// (lib/editor-video/plantillas.ts). Las de CapCut vienen de su servidor y son de
// ByteDance: no se copian (diseño §1.2). Molde: avatar/registro.ts.
//
// Lo importa ce/extensiones.ts.

import { seccionesBiblioteca } from "@/app/video-editor/ce/ranuras";
import { BibliotecaPlantillas } from "./components/biblioteca-plantillas";

export const SECCION_PLANTILLAS_ANUNCIOS = "plantillas.anuncios";

seccionesBiblioteca.registrar({
	categoria: "plantillas",
	id: SECCION_PLANTILLAS_ANUNCIOS,
	etiqueta: "Anuncios",
	orden: 10,
	Contenido: BibliotecaPlantillas,
});
