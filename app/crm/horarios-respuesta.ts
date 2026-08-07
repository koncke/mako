// =============================================================================
// Cómo se LEE la respuesta de /api/crm/horarios (fuente única)
// =============================================================================
// Módulo puro: sin 'use client' ni 'server-only', para poder testearlo solo.
//
// El server nunca falla acá: un problema con Google vuelve como 200 con un
// `codigo` distinto de 'ok' y la grilla completa. Toda la inteligencia está en
// leer bien esa respuesta, y ahí es donde estaba el bug caro:
//
//  · el `motivo` se descartaba cuando el `codigo` era 'ok'. Pero 'ok' también
//    trae avisos que NO son errores — el principal: "ya pasaron todos los
//    horarios de hoy" con `slots: []`. Sin ese texto, la pantalla no decía nada.
//  · `slots: []` se leía como "no se sabe" y el selector dibujaba la jornada
//    entera 9:00–19:00 como disponible. El usuario elegía las 10:00 de un día
//    que ya había pasado, se guardaba `junta_N_at` en el pasado y el lead volvía
//    al worklist en el render siguiente, con la asistencia recién borrada.
//  · el `error` crudo del server ("No autorizado", un stack) se mostraba tal
//    cual: el mensaje más alarmante y menos accionable de todo el camino.
//
// La distinción que ordena todo: `null` = NO SE SABE (grilla completa, todo
// elegible), `[]` = ese día no tiene horarios (se dice, no se inventa grilla).
// =============================================================================

/** Un horario del día con su disponibilidad real, tal cual lo emite el server. */
export type SlotAgenda = { hora: string; inicioIso: string; libre: boolean };

/** El JSON de GET /api/crm/horarios (todo opcional: viene de la red). */
export type RespuestaHorarios = {
  ok?: boolean;
  codigo?: string;
  motivo?: string;
  tz?: string;
  slots?: SlotAgenda[];
  error?: string;
};

export type LecturaHorarios = {
  /** La grilla del día, o null cuando no se pudo saber (se cae a la de siempre). */
  slots: SlotAgenda[] | null;
  /** Zona en la que se leyeron los horarios ('' si no se sabe). */
  tz: string;
  /** Lo que se le muestra al usuario, ya en castellano ('' = nada que aclarar). */
  nota: string;
  /** El error crudo del server: va a la consola, NUNCA a la pantalla. */
  errorTecnico: string | null;
};

/** Lo que se dice cuando la agenda no se pudo leer. Nunca bloquea el paso. */
export const AVISO_SIN_AGENDA =
  'No pude leer tu agenda. Elegí la hora igual: el CRM se actualiza y queda en el historial.';

export function leerRespuestaHorarios(j: RespuestaHorarios | null | undefined): LecturaHorarios {
  if (!j || !j.ok || !Array.isArray(j.slots)) {
    return { slots: null, tz: '', nota: AVISO_SIN_AGENDA, errorTecnico: j?.error ?? null };
  }
  return {
    slots: j.slots,
    tz: j.tz ?? '',
    // El motivo viaja SIEMPRE, también con 'ok'.
    nota: j.motivo || (j.codigo === 'ok' ? '' : AVISO_SIN_AGENDA),
    errorTecnico: null,
  };
}
