// =============================================================================
// Lo que registran los clips mágicos en las ranuras del editor
// =============================================================================
// Biblioteca › Multimedia › «Clips mágicos» (después del B-roll): de un video largo a varios cortos
// (./components/clips-view.tsx). Lo importa ce/extensiones.ts.

import { seccionesBiblioteca } from "@/app/video-editor/ce/ranuras";
import { ClipsView } from "./components/clips-view";
import { SECCION_CLIPS } from "./secciones";

seccionesBiblioteca.registrar({
	categoria: "multimedia",
	id: SECCION_CLIPS,
	etiqueta: "Clips mágicos",
	orden: 30,
	Contenido: ClipsView,
});
