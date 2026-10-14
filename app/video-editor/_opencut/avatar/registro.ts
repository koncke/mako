// =============================================================================
// Biblioteca › Avatar de IA: lo que registra el paquete del avatar
// =============================================================================
// Una sola sección, «Biblioteca de avatares» (`pc_ai_avatar_library` del es-LA.po
// de CapCut), que es lo que MaKo tiene: generar con un avatar propio. Las demás
// entradas de la columna de CapCut no se dibujan (./AvatarIAView.tsx dice por qué).
//
// Lo importa ce/extensiones.ts.

import { seccionesBiblioteca } from "@/app/video-editor/ce/ranuras";
import { AvatarIAView } from "./AvatarIAView";

export const SECCION_AVATARES = "avatar.biblioteca";

seccionesBiblioteca.registrar({
	categoria: "avatar",
	id: SECCION_AVATARES,
	etiqueta: "Biblioteca de avatares",
	orden: 10,
	Contenido: AvatarIAView,
});
