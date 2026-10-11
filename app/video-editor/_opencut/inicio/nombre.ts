// =============================================================================
// El nombre de un proyecto nuevo: la fecha MMDD, como CapCut
// =============================================================================
// CapCut nombra cada borrador nuevo con el mes y el día («1011» el 11 de
// octubre) y, si ya existe, «1011 (1)», «1011 (2)»… (relevamiento §2, fila 4).
// Lo usan todas las puertas que crean un proyecto: el banner «Crear proyecto»
// del inicio, «Nuevo proyecto» del Menú del editor y el EditorProvider cuando
// abre un id que no existe (el «Editar en el editor» de Video Generator).

import { storageService } from "@/app/video-editor/_opencut/services/storage/service";

export function nombreSegunFecha(fecha = new Date()): string {
	const dos = (n: number) => String(n).padStart(2, "0");
	return `${dos(fecha.getMonth() + 1)}${dos(fecha.getDate())}`;
}

/** El primer «MMDD», «MMDD (1)», «MMDD (2)»… que no esté en `existentes`. */
export function nombreLibre(base: string, existentes: Iterable<string>): string {
	const usados = new Set(existentes);
	if (!usados.has(base)) return base;
	for (let n = 1; ; n++) {
		const candidato = `${base} (${n})`;
		if (!usados.has(candidato)) return candidato;
	}
}

/**
 * Lee los nombres del almacenamiento y no de `editor.project.getSavedProjects()`:
 * dentro del editor esa lista está vacía (sólo la carga el inicio), y cargarla
 * con `loadAllProjects` pone el ProjectManager en «cargando», que frena el
 * guardado automático del proyecto abierto.
 */
export async function nombreProyectoNuevo(): Promise<string> {
	const base = nombreSegunFecha();
	try {
		const proyectos = await storageService.loadAllProjectsMetadata();
		return nombreLibre(base, proyectos.map((p) => p.name));
	} catch {
		return base;
	}
}
