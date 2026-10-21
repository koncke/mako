// =============================================================================
// chat/foco — a qué mensaje va el chat del editor cuando el link trae `?propuesta=<id>`
// =============================================================================
// Separado de ./propuestas.ts porque aquél importa el motor (WASM) y un test no lo puede cargar. Puro.
// =============================================================================

import { claveDeOperacion, restarOperaciones } from "@/lib/editor-video/propuestas";

/**
 * Lo que dice el editor cuando el link trae `?propuesta=` y el proyecto no está guardado en este navegador (el proyecto
 * vive en el navegador de quien lo editó). Antes creaba un proyecto vacío y la búsqueda de propuestas decía «ya no está
 * abierta», que era falso: la propuesta seguía abierta, en el otro navegador (revisión del 20/10).
 */
export const SIN_PROYECTO_AQUI =
	"El proyecto de esta propuesta no está guardado en este navegador. Ábrela en el navegador donde editaste ese video.";

/** El id del mensaje de una propuesta de la API: estable, así no se repite. */
export const idDeMensaje = (propuestaId: string) => `api-${propuestaId}`;

/** Un mensaje del hilo, lo que estas reglas miran de él. */
export type MensajeDeHilo = { id: string; estado?: string; propuestaApi?: { id: string } };

/** Los mensajes de una propuesta: por su `propuestaApi` (una propuesta puede tener varios), o por el id de siempre. */
const deLaPropuesta = <M extends MensajeDeHilo>(propuestaId: string, hilo: readonly M[]): M[] =>
	hilo.filter((m) => m.propuestaApi?.id === propuestaId || m.id === idDeMensaje(propuestaId));

/**
 * A dónde va el panel con el link `?propuesta=<id>`: el mensaje de esa propuesta y, si ya no está abierta, el porqué.
 * Pura, para el test. `abiertas` son las que la base tiene abiertas AHORA; `hilo`, los mensajes del proyecto. Una
 * propuesta puede tener varios mensajes (lo que se aceptó y lo que llegó después): se va al pendiente, si hay.
 */
export function focoDePropuesta(
	propuestaId: string,
	abiertas: ReadonlySet<string>,
	hilo: ReadonlyArray<MensajeDeHilo>,
): { mensajeId: string | null; aviso: string | null } {
	const suyos = deLaPropuesta(propuestaId, hilo);
	const pendiente = [...suyos].reverse().find((m) => m.estado === "pendiente");
	const ultimo = suyos[suyos.length - 1];
	if (abiertas.has(propuestaId)) {
		if (pendiente) return { mensajeId: pendiente.id, aviso: null };
		return { mensajeId: ultimo?.id ?? null, aviso: "Esta propuesta no se pudo mostrar en este proyecto: recarga el editor." };
	}
	if (ultimo?.estado === "aplicada") return { mensajeId: ultimo.id, aviso: "Esta propuesta ya se aceptó." };
	if (ultimo?.estado === "restaurada") return { mensajeId: ultimo.id, aviso: "Esta propuesta se aceptó y después se deshizo." };
	if (ultimo) return { mensajeId: ultimo.id, aviso: "Esta propuesta ya no está abierta: se descartó o se resolvió en otra pestaña." };
	return { mensajeId: null, aviso: "Esa propuesta ya no está abierta: se aceptó o se descartó en otra pestaña." };
}

/** Lo que el editor hace con una propuesta abierta: nada, reemplazar el mensaje pendiente, o sumar uno nuevo. */
export type QueMostrar = { accion: "nada" } | { accion: "reemplazar" | "nuevo"; id: string; quedan: number[] };

/**
 * Qué mostrar de una propuesta abierta, dado lo que ya hay en el hilo. `serverOps` son sus operaciones en la base
 * (validadas), y `mensajes` los de esta propuesta con las operaciones que cada uno mostró.
 *
 * ⚠️ SE OFRECE SÓLO LO QUE NINGÚN MENSAJE MANEJÓ. Lo aceptado, descartado o en curso (aplicando, sin versión) ya se
 * manejó, haya llegado o no su cierre a la base: si el cierre falló y la propuesta creció, ofrecer «todo lo abierto»
 * volvía a ofrecer lo ya aplicado, y se aplicaba dos veces (revisión del 21/10). Y no se renombra nada: el renombre
 * dejaba al mensaje viejo como el «de» la propuesta y cada apertura sumaba uno más.
 */
export function queMostrar(propuestaId: string, serverOps: readonly unknown[], mensajes: ReadonlyArray<{ id: string; estado?: string; ops: readonly unknown[] }>): QueMostrar {
	const manejadas = mensajes.filter((m) => m.estado !== "pendiente").flatMap((m) => m.ops);
	const quedan = restarOperaciones(serverOps, manejadas);
	if (!quedan.length) return { accion: "nada" };
	const pendiente = [...mensajes].reverse().find((m) => m.estado === "pendiente");
	if (pendiente) {
		const muestra = pendiente.ops.map(claveDeOperacion).join("\n");
		const deberia = quedan.map((i) => claveDeOperacion(serverOps[i])).join("\n");
		return muestra === deberia ? { accion: "nada" } : { accion: "reemplazar", id: pendiente.id, quedan };
	}
	const usados = new Set(mensajes.map((m) => m.id));
	let id = idDeMensaje(propuestaId);
	for (let n = 2; usados.has(id); n++) id = `${idDeMensaje(propuestaId)}-${n}`;
	return { accion: "nuevo", id, quedan };
}
