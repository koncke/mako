// =============================================================================
// Biblioteca › Plantillas › Motion: lo que registra el paquete de motion graphics (lib/motion)
// =============================================================================
// Al lado de «Anuncios» (plantillas/registro.ts): las plantillas animadas de las skills de iart-ai, editables por
// campo y por el chat. Molde: plantillas/registro.ts. Lo importa ce/extensiones.ts.

import { seccionesBiblioteca } from "@/app/video-editor/ce/ranuras";
import { BibliotecaMotion } from "./components/biblioteca-motion";

export const SECCION_PLANTILLAS_MOTION = "plantillas.motion";

seccionesBiblioteca.registrar({
	categoria: "plantillas",
	id: SECCION_PLANTILLAS_MOTION,
	etiqueta: "Motion",
	orden: 20,
	Contenido: BibliotecaMotion,
});
