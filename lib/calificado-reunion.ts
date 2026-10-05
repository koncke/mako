// =============================================================================
// «¿Era calificado?» — cuándo ese dato se descarta, y cuándo NO
// =============================================================================
// Módulo PURO (sin 'server-only' ni 'use client') porque la misma regla la usan
// tres lugares que no pueden tener tres copias:
//   · `updateLead` (lib/leads.ts), que es quien la aplica al guardar;
//   · la ficha, para no dibujar un control que guardaría y rebotaría;
//   · el canal de MaKo, para no rechazar lo que la ficha sí permite.
//
// ⚠️ LA REGLA VIEJA EXIGÍA UNA REUNIÓN, y eso dejaba el dato sin cargar justo en
// los funnels que no tienen reuniones. `updateLead` forzaba `calificado` a null
// cuando faltaba `fecha_junta_1` o cuando `asistio_j1` no era `true`, así que un
// lead que entró por WhatsApp y nunca tuvo llamada NO se podía marcar: la columna
// se guardaba y la siguiente lectura la traía en null. Y «calificado» es una de
// las dos únicas señales del CRM que viajan a Meta (el evento `Lead`), o sea que
// esos funnels le mandaban a Meta menos de lo que tenían.
//
// Lo que queda es el único caso en que el dato se CONTRADICE con lo que ya se
// sabe: hay una R1 con fecha y consta que la persona NO vino. Ahí calificarla no
// significa nada y el dato se descarta — igual que antes.
//
// La ausencia de reunión NO es una contradicción: es un funnel distinto.
// =============================================================================

/** Lo mínimo del lead que esta regla mira. */
export type LeadCalificable = {
  fecha_junta_1: string | null;
  asistio_j1: boolean | null;
};

/**
 * ¿Hay que borrar el «calificado» de este lead?
 *
 * Sólo cuando CONSTA que no vino a una R1 que sí existía. Sin fecha de R1 (no hay
 * reunión en este funnel) o con la asistencia sin marcar, el dato se conserva.
 */
export function calificadoSeDescarta(l: LeadCalificable): boolean {
  return !!l.fecha_junta_1 && l.asistio_j1 === false;
}
