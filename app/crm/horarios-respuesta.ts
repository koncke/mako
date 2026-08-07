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
  // Un código distinto de 'ok' significa que NO se pudo leer la agenda. El server
  // igual manda la grilla del día para que el paso sea usable, pero con todos los
  // slots en `libre: true` — o sea, indistinguible de "tenés el día entero libre".
  // Devolverla como grilla verificada era lo que hacía convivir el aviso de error
  // con un sub que prometía "los ocupados se ven tachados": el usuario leía que no
  // había nada tachado y agendaba encima de otra reunión. Sin verificar = null.
  if (j.codigo !== 'ok') {
    return { slots: null, tz: j.tz ?? '', nota: j.motivo || AVISO_SIN_AGENDA, errorTecnico: null };
  }
  return {
    slots: j.slots,
    tz: j.tz ?? '',
    // El motivo viaja SIEMPRE, también con 'ok' (ej: "ya pasaron todos los horarios").
    nota: j.motivo || '',
    errorTecnico: null,
  };
}

/**
 * Traduce el fallo de Google a una frase accionable en castellano.
 *
 * El caso que motivó esto salió en producción: la API de Calendar no estaba
 * habilitada en el proyecto de Google Cloud, y el párrafo de Google —con el id del
 * proyecto y un link a la consola de desarrolladores— se imprimió tal cual arriba
 * de la grilla de horarios. Un mensaje así no es un aviso: es ruido alarmante que
 * el usuario no puede accionar. Cada rama dice QUÉ pasó y QUÉ hacer, en una línea.
 */
export function motivoLegible(status: number, crudo: string): string {
  const t = (crudo || '').toLowerCase();
  // 403 accessNotConfigured / SERVICE_DISABLED: falta prender la API en Cloud.
  if (t.includes('has not been used in project') || t.includes('accessnotconfigured') || t.includes('service_disabled') || t.includes('is disabled')) {
    return 'Falta habilitar la API de Google Calendar en tu proyecto de Google Cloud. Mientras tanto elegí la hora a mano: el CRM se actualiza igual.';
  }
  if (status === 401) return 'Tu conexión con Google venció: reconectala desde Integraciones.';
  if (status === 429 || t.includes('rate limit') || t.includes('quota')) {
    return 'Google está limitando las consultas en este momento. Probá de nuevo en un rato o elegí la hora a mano.';
  }
  if (status >= 500) return 'Google no está respondiendo en este momento. Elegí la hora a mano: el CRM se actualiza igual.';
  return 'No pude leer tu agenda: los horarios de abajo no están verificados.';
}
