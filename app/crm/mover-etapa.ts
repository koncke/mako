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
export function pideWizardAlElegir(stages: readonly EtapaLite[], key: string): boolean {
  if (key === 'manual' || slotDeReunion(stages, key) !== null) return true;
  // Sin `kind` en ninguna etapa no hay de dónde saber cuáles son reuniones: pasa
  // con DEFAULT_STAGES, que es lo que recibe la ficha cuando no se pudo leer el
  // funnel (getLeadFullAction). Ahí se cae a las dos keys canónicas, para que un
  // funnel ilegible no mueva a Agenda R1 salteando la pregunta de la fecha.
  const sinKind = !stages.some((s) => s.kind);
  return sinKind && (key === 'agenda' || key === 'agendaj2');
}
