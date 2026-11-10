// =============================================================================
// chat/respuesta — lo que dice el chat cuando la propuesta se quedó sin nada que aplicar (9/11/2026)
// =============================================================================
// Medido en producción el 9/11/2026 (ws9, el proyecto «1109»):
//   · «Quita las muletillas del video» → «Aquí tienes la limpieza de muletillas para dejar el video al hueso.» y debajo
//     «No se aplica: no se identificaron muletillas». Sin tarjeta: no se hizo nada.
//   · «Los subtítulos en amarillo y con la fuente Bebas Neue» → «Cambiando los subtítulos a fuente Bebas Neue y color
//     amarillo.» y el MISMO motivo repetido tres veces (uno por subtítulo). Tampoco se hizo nada.
// El titular es el `resumen` del modelo, escrito ANTES de que el editor revise sus operaciones: afirma lo que iba a hacer,
// no lo que quedó (AGENTS.md, «Un mensaje HONESTO también puede afirmar de más»). Si el modelo propuso cambios y la revisión
// los descartó TODOS, el titular lo dice el código: no cambió nada, y los motivos van debajo, una vez cada uno.
// Si el modelo no propuso nada (contestó una pregunta, dijo que eso no existe), su texto es la respuesta y queda.
//
// PURO: lo usa PanelChat.tsx (`pedirEdicion`) y lo prueba tests/video-editor-respuesta-chat.test.ts.
// =============================================================================

export const SIN_CAMBIOS = "No cambié nada.";

/** Los motivos sin repetir, en el orden en que llegaron (tres subtítulos con el mismo motivo son un motivo). */
export function sinRepetir(descartes: readonly string[]): string[] {
	return [...new Set(descartes.map((d) => d.trim()).filter(Boolean))];
}

/**
 * Lo que no se aplica de un pedido: lo que tiró la RUTA (la forma, en el server), lo que tiró la segunda validación del
 * editor y lo que tiró la revisión contra la línea de tiempo. Las tres, una vez cada motivo.
 */
export function descartesDelPedido(d: { ruta?: readonly string[] | null; forma: readonly string[]; revision: readonly string[] }): string[] {
	return sinRepetir([...(d.ruta ?? []), ...d.forma, ...d.revision]);
}

/**
 * El texto del mensaje cuando no queda nada que aceptar. `propuso`: cuántas operaciones devolvió el modelo (antes de la
 * revisión del editor). Con alguna, el resumen del modelo afirma de más: se dice que no cambió nada.
 */
export function textoSinCambios({ resumen, propuso }: { resumen: string | null | undefined; propuso: number }): string {
	const r = String(resumen ?? "").trim();
	if (propuso === 0) return r || "Sin cambios.";
	// La línea del ticket la escribe el SERVER (lib/no-pude.ts, `lineaDelTicket`), no el modelo: es un hecho y se queda.
	const ticket = r.match(/Quedó el ticket #\d+ para el equipo de MaKo\./)?.[0];
	return ticket ? `${SIN_CAMBIOS} ${ticket}` : SIN_CAMBIOS;
}
