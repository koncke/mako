// =============================================================================
// edit-logic — helpers de etapa para el CRM
// =============================================================================
// La semilla/validación de edición vivía acá cuando el modal era read-only con
// una máquina de "Edits". Con la ficha editable (LeadSheet) eso desapareció; las
// reglas de requisitos viven en lib/stage-requirements. Queda solo el mapeo de
// etapa → sección a completar, que usa el Kanban para decidir si abre la ficha.

import { NUTRI_KEYS } from '@/lib/pipeline';

const AGENDA_STAGES = ['agenda', 'agendaj2', 'facturando'];

/**
 * Sección de la ficha que una etapa "pide completar". Si devuelve algo, mover a
 * esa etapa abre la ficha (en vez de mover en silencio) para cargar esos datos.
 */
export function sectionForStage(stage: string): string | undefined {
  if (stage === 'perdido' || stage === 'descal') return 'motivo';
  if (stage === 'ganado') return 'plan-pagos';
  if (AGENDA_STAGES.includes(stage)) return 'datos-comerciales';
  if (NUTRI_KEYS.includes(stage)) return 'nutricion';
  return undefined;
}
