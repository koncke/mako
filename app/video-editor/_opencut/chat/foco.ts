// =============================================================================
// chat/foco — a qué mensaje va el chat del editor cuando el link trae `?propuesta=<id>`
// =============================================================================
// Separado de ./propuestas.ts porque aquél importa el motor (WASM) y un test no lo puede cargar. Puro.
// =============================================================================

/**
 * Lo que dice el editor cuando el link trae `?propuesta=` y el proyecto no está guardado en este navegador (el proyecto
 * vive en el navegador de quien lo editó). Antes creaba un proyecto vacío y la búsqueda de propuestas decía «ya no está
 * abierta», que era falso: la propuesta seguía abierta, en el otro navegador (revisión del 20/10).
 */
export const SIN_PROYECTO_AQUI =
	"El proyecto de esta propuesta no está guardado en este navegador. Ábrela en el navegador donde editaste ese video.";

/** El id del mensaje de una propuesta de la API: estable, así no se repite. */
export const idDeMensaje = (propuestaId: string) => `api-${propuestaId}`;

/**
 * A dónde va el panel con el link `?propuesta=<id>`: el mensaje de esa propuesta y, si ya no está abierta, el porqué.
 * Pura, para el test. `abiertas` son las que la base tiene abiertas AHORA; `hilo`, los mensajes del proyecto.
 */
export function focoDePropuesta(
	propuestaId: string,
	abiertas: ReadonlySet<string>,
	hilo: ReadonlyArray<{ id: string; estado?: string }>,
): { mensajeId: string | null; aviso: string | null } {
	const id = idDeMensaje(propuestaId);
	const enHilo = hilo.find((m) => m.id === id);
	if (abiertas.has(propuestaId)) return { mensajeId: enHilo ? id : null, aviso: enHilo ? null : "Esta propuesta no se pudo mostrar en este proyecto: recarga el editor." };
	if (enHilo?.estado === "aplicada") return { mensajeId: id, aviso: "Esta propuesta ya se aceptó." };
	if (enHilo?.estado === "restaurada") return { mensajeId: id, aviso: "Esta propuesta se aceptó y después se deshizo." };
	if (enHilo) return { mensajeId: id, aviso: "Esta propuesta ya no está abierta: se descartó o se resolvió en otra pestaña." };
	return { mensajeId: null, aviso: "Esa propuesta ya no está abierta: se aceptó o se descartó en otra pestaña." };
}

