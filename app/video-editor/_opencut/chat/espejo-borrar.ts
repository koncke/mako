// =============================================================================
// chat/espejo-borrar — al borrar un proyecto, su copia de lectura sale de la API de MaKo
// =============================================================================
// La llama `ProjectManager.deleteProjects` (core/managers/project-manager.ts), el ÚNICO camino por el que se borra un
// proyecto: el inicio, «Eliminar» del menú del editor, y lo que limpian «Editar en el editor» y «Utilizar plantilla»
// cuando fallan. Ponerlo en una de esas pantallas dejaba a las otras tres sin borrar la copia (AGENTS.md: «una regla
// que vive en un COMPONENTE no la cumple otra entrada»). Chico a propósito: el núcleo del motor no carga el chat.
// La copia la sube ./espejo.ts; la ruta es /api/video-editor/proyectos (DELETE marca `borrado_at`: la fila queda).
// =============================================================================

const oyentes = new Set<(proyectoId: string) => void>();

/** Para olvidar lo que se recordaba de un proyecto borrado (./espejo.ts). */
export function alBorrarCopia(f: (proyectoId: string) => void): () => void {
	oyentes.add(f);
	return () => {
		oyentes.delete(f);
	};
}

/** Saca la copia de un proyecto de las lecturas de la API. No espera ni falla: sin red, la copia queda. */
export function borrarCopiaDelProyecto(proyectoId: string): void {
	for (const f of oyentes) f(proyectoId);
	if (typeof fetch !== "function") return;
	void fetch(`/api/video-editor/proyectos?proyecto=${encodeURIComponent(proyectoId)}`, { method: "DELETE" }).catch(() => {});
}
