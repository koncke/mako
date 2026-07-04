'use server';

// =============================================================================
// Server actions — Insights generativos del lead (botón Generar/Regenerar)
// =============================================================================
// Wrapper fino sobre lib/lead-insights: la validación de requisitos, el armado
// del prompt y el guardado viven en la lib. Acá solo se expone a la UI.

import { generarInsightLead, type GenerarInsightResult } from '@/lib/lead-insights';

export async function generateLeadInsightAction(leadId: number): Promise<GenerarInsightResult> {
  if (!Number.isFinite(leadId) || leadId <= 0) {
    return { ok: false, motivo: 'Lead inválido.' };
  }
  return generarInsightLead(leadId);
}
