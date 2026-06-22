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
const AGENDA_STAGES = ['agenda', 'agendaj2', 'facturando'];

/** Semilla de edición para un lead dado su etapa efectiva. */
export function seedEdits(l: CrmLead, effStage: string): Edits {
  const passedJ1 = !!l.agenda || ADV.includes(effStage);
  const passedJ2 = ADV.includes(effStage);
  const fathom: FathomLink[] = l.fathom.length
    ? l.fathom
    : [
        ...(passedJ1 ? [{ label: 'Reunión 1', url: '' }] : []),
        ...(passedJ2 ? [{ label: 'Reunión 2', url: '' }] : []),
      ];
  const isNutri = NUTRI_KEYS.includes(effStage);
  const isGanado = effStage === 'ganado';
  const cuota = isGanado ? String(Math.round(l.monto / 3)) : '';
  return {
    nombre: l.name,
    email: l.email,
    telefono: l.phone === '—' ? '' : l.phone,
    empresa: l.company === 'Sin empresa' ? '' : l.company,
    closer: l.closer,
    setter: l.setter,
    motivo: l.motivo,
    fechaJ1: l.fechaJ1 ?? '',
    fechaJ2: l.fechaJ2 ?? '',
    fathom,
    nutriciones: isNutri ? [{ name: 'Nutrición 1 — WhatsApp', dt: '' }, { name: 'Nutrición 2 — Email', dt: '' }] : [],
    plan: { total: isGanado ? String(l.monto) : '', cierre: '', inicio: '', duracion: '3' },
    cuotas: isGanado ? [{ monto: cuota, fecha: '' }, { monto: cuota, fecha: '' }] : [],
  };
}

const hasFathomUrl = (e: Edits) => e.fathom.some((f) => f.url.trim());
const hasNutricion = (e: Edits) => e.nutriciones.some((n) => n.name.trim() && n.dt.trim());

/**
 * Campos OBLIGATORIOS que faltan para mover a una etapa (vacío = se puede mover).
 * Cada etapa con datos a completar exige lo suyo; ninguna es "blanda".
 */
export function missingFor(stage: string, e: Edits): string[] {
  const m: string[] = [];
  switch (stage) {
    case 'agenda':
      if (!e.fechaJ1.trim()) m.push('Fecha de la Reunión 1');
      if (!hasFathomUrl(e)) m.push('Link de Fathom');
      break;
    case 'agendaj2':
    case 'facturando':
      if (!e.fechaJ2.trim()) m.push('Fecha de la Reunión 2');
      if (!hasFathomUrl(e)) m.push('Link de Fathom');
      break;
    case 'ganado':
      if (!(Number(e.plan.total) > 0)) m.push('Monto de cierre');
      break;
    case 'perdido':
    case 'descal':
      if (!e.motivo.trim()) m.push('Motivo');
      break;
    case 'manual':
      if (!e.setter.trim()) m.push('Setter');
      if (!hasNutricion(e)) m.push('Nutrición (al menos una)');
      break;
    case 'noshow':
    case 'nutri':
    case 'nopaga':
    case 'postagenda':
      if (!hasNutricion(e)) m.push('Nutrición (al menos una)');
      break;
  }
  return m;
}

/**
 * Sección de la ficha (id `lead-sec-…`) a la que saltar y desplegar cuando el
 * lead se mueve a una etapa que pide completar datos. Si devuelve algo, el
 * movimiento abre la ficha enfocada en esa sección (en vez de mover en silencio).
 * `missingFor` decide además qué se exige antes de poder guardar el cambio.
 */
export function sectionForStage(stage: string): string | undefined {
  if (stage === 'perdido' || stage === 'descal') return 'motivo';
  if (stage === 'ganado') return 'plan-pagos';
  if (AGENDA_STAGES.includes(stage)) return 'datos-comerciales';
  if (NUTRI_KEYS.includes(stage)) return 'nutricion';
  return undefined;
}
