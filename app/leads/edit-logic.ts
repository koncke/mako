// =============================================================================
// edit-logic — lógica de edición de un lead compartida por CrmBoard y LeadEditModal
// =============================================================================
// seedEdits / missingFor vivían inline en CrmBoard. Se extrajeron para que el
// modal de edición in-place (usable desde cualquier desglose del dashboard)
// reutilice EXACTAMENTE la misma semilla y validación que el CRM.

import { NUTRI_KEYS } from '@/lib/pipeline';
import type { FathomLink } from '@/lib/leads';
import type { CrmLead, Edits } from './CrmBoard';

const ADV = ['agendaj2', 'facturando', 'ganado'];

/** Semilla de edición para un lead dado su etapa efectiva. */
export function seedEdits(l: CrmLead, effStage: string): Edits {
  const passedJ1 = !!l.agenda || ADV.includes(effStage);
  const passedJ2 = ADV.includes(effStage);
  const fathom: FathomLink[] = l.fathom.length
    ? l.fathom
    : [
        ...(passedJ1 ? [{ label: 'Junta 1', url: '' }] : []),
        ...(passedJ2 ? [{ label: 'Junta 2', url: '' }] : []),
      ];
  const isNutri = NUTRI_KEYS.includes(effStage);
  const isGanado = effStage === 'ganado';
  const cuota = isGanado ? String(Math.round(l.monto / 3)) : '';
  return {
    closer: l.closer,
    setter: l.setter,
    motivo: l.motivo,
    fathom,
    nutriciones: isNutri ? [{ name: 'Nutrición 1 — WhatsApp', dt: '' }, { name: 'Nutrición 2 — Email', dt: '' }] : [],
    plan: { total: isGanado ? String(l.monto) : '', cierre: '', inicio: '', duracion: '3' },
    cuotas: isGanado ? [{ monto: cuota, fecha: '' }, { monto: cuota, fecha: '' }] : [],
  };
}

/** Campos obligatorios que faltan para mover a una etapa. */
export function missingFor(stage: string, e: Edits): string[] {
  if (stage === 'ganado') return [];
  if (stage === 'perdido' || stage === 'descal') return e.motivo.trim() ? [] : ['Motivo'];
  return [];
}

/**
 * Sección de la ficha (id `lead-sec-…`) a la que saltar y desplegar cuando el
 * lead se mueve a una etapa que pide completar datos. Si devuelve algo, el
 * movimiento abre la ficha enfocada en esa sección (en vez de mover en silencio).
 * `missingFor` decide además si el guardado se BLOQUEA hasta llenar lo obligatorio.
 */
export function sectionForStage(stage: string): string | undefined {
  if (stage === 'perdido' || stage === 'descal') return 'motivo';
  if (stage === 'ganado') return 'plan-pagos';
  if (NUTRI_KEYS.includes(stage)) return 'nutricion';
  return undefined;
}
