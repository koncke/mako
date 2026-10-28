// =============================================================================
// Qué etapa se mueve directo y cuál abre el wizard (08-T22) — módulo puro
// =============================================================================
// Sin 'use client' ni 'server-only' para poder testearlo solo. Lo usan las dos
// fichas (LeadSheet y LeadDetailBody); el tablero hace la misma separación en su
// handleDrop (manual → su wizard de plazo; reunión → la elección de Calendly).

import { slotDeReunion, type EtapaLite } from '@/lib/funnel-etapas';

/**
 * ¿Elegir esta etapa desde la ficha tiene que abrir el wizard? Solo las que
 * encierran una decisión que no es un dato suelto: una etapa de reunión (hay que
 * decir si se agenda o si ya ocurrió) y la nutrición manual (el plazo ES el
 * movimiento). Todo lo demás se mueve directo, y lo que falta queda pendiente.
 */
export function pideWizardAlElegir(stages: readonly EtapaLite[], key: string, reuniones?: ReunionesCargadas): boolean {
  // La reunión ya cargada (a mano o por la reserva) no tiene nada que preguntar: se mueve directo (27/10/2026).
  if (reuniones && reunionYaCargada(stages, key, reuniones)) return false;
  if (key === 'manual' || slotDeReunion(stages, key) !== null) return true;
  // Sin `kind` en ninguna etapa no hay de dónde saber cuáles son reuniones: pasa
  // con DEFAULT_STAGES, que es lo que recibe la ficha cuando no se pudo leer el
  // funnel (getLeadFullAction). Ahí se cae a las dos keys canónicas, para que un
  // funnel ilegible no mueva a Agenda R1 salteando la pregunta de la fecha.
  const sinKind = !stages.some((s) => s.kind);
  return sinKind && (key === 'agenda' || key === 'agendaj2');
}

/** Lo de las reuniones de un lead que decide si la de una etapa ya está cargada. */
export type ReunionesCargadas = { fechaJ1?: string | null; fechaJ2?: string | null; asistioJ1?: boolean | null; asistioJ2?: boolean | null };

/**
 * ¿La reunión de ESA etapa ya está cargada y sin marcar? (27/10/2026, Martín: mover a R1 «solo funciona con llamada de
 * Calendly o Cal, pero no si la agendé a mano».) Con la fecha cargada (a mano o por la reserva) y sin saber todavía si se
 * tuvo, mover a su etapa no tiene nada que preguntar: ni Calendly ni la fecha. Se mueve directo, como cualquier etapa. Si ya
 * se marcó la asistencia, moverla a esa etapa es REAGENDARLA, y ahí sí se pregunta.
 */
export function reunionYaCargada(stages: readonly EtapaLite[], key: string, l: ReunionesCargadas): boolean {
  const slot = slotDeReunion(stages, key);
  const indice = slot ? slot.indice : !stages.some((s) => s.kind) ? (key === 'agenda' ? 0 : key === 'agendaj2' ? 1 : null) : null;
  if (indice === 0) return !!l.fechaJ1 && l.asistioJ1 == null;
  if (indice === 1) return !!l.fechaJ2 && l.asistioJ2 == null;
  return false;
}
