// =============================================================================
// La condición «El equipo no contestó en el grupo» (tarjeta #849, 17/10/2026): lo PURO
// =============================================================================
// La lectura vive en lib/nutricion.ts (`equipoContestoDesdeElAviso`): la última tarjeta MaKo de la inscripción en
// `nutricion_envios` y lo que se escribió en el grupo desde entonces (`mako_doer_conv`). Acá, lo que se decide con eso.

import type { PasoGrafo } from './flujo-grafo';

/** El id de la condición en el catálogo (lib/condiciones-catalogo.ts). */
export const CAMPO_EQUIPO_CONTESTO = 'equipo_contesto';

/** ¿Alguna CONDITION del flujo lo pregunta? Sin eso el motor no lee nada (la lectura cuesta dos consultas). */
export const usaEquipoContesto = (pasos: readonly PasoGrafo[]): boolean => pasos.some((p) =>
  !!p && p.nodo === 'condicion' && (p.ramas ?? []).some((r) => (r.filas ?? []).some((f) => f?.campo === CAMPO_EQUIPO_CONTESTO)));

/** Una fila de `mako_doer_conv` del grupo de MaKo: `user` = alguien del grupo, `assistant` = MaKo. */
export type TurnoDelGrupo = { role: string; wa_message_id: string | null };

/**
 * ¿ALGUIEN DEL GRUPO ESCRIBIÓ? Cualquier fila `user`, también un «ok» (la tabla no guarda el autor), salvo un ECO: una
 * fila `user` con el mismo id de WhatsApp que una de MaKo es su propio aviso que volvió, no una respuesta.
 */
export function contestoElEquipo(filas: readonly TurnoDelGrupo[]): boolean {
  const deMako = new Set(filas.filter((f) => f.role === 'assistant' && f.wa_message_id).map((f) => f.wa_message_id));
  return filas.some((f) => f.role === 'user' && !(f.wa_message_id && deMako.has(f.wa_message_id)));
}
