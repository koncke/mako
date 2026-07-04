'use server';

// =============================================================================
// Server actions — Insights generativos del lead (botón Generar/Regenerar)
// =============================================================================
// Wrapper fino sobre lib/lead-insights: la validación de requisitos, el armado
// del prompt y el guardado viven en la lib. Acá solo se expone a la UI.

import { revalidatePath } from 'next/cache';
import { generarInsightLead, type GenerarInsightResult } from '@/lib/lead-insights';
import { analizarLlamadasDeLead } from '@/lib/closing';

export async function generateLeadInsightAction(leadId: number): Promise<GenerarInsightResult> {
  if (!Number.isFinite(leadId) || leadId <= 0) {
    return { ok: false, motivo: 'Lead inválido.' };
  }
  return generarInsightLead(leadId);
}

export type AnalizarLlamadaResult =
  | { ok: true; encontradas: number; analizadas: number; yaEstaban: number }
  | { ok: false; motivo: string };

/**
 * Analiza la(s) llamada(s) de Fathom de un lead y las guarda en closing_analyses
 * (para que la tab Insights las tenga). La UI la encadena con generateLeadInsight.
 */
export async function analizarLlamadaLeadAction(leadId: number): Promise<AnalizarLlamadaResult> {
  if (!Number.isFinite(leadId) || leadId <= 0) return { ok: false, motivo: 'Lead inválido.' };
  try {
    const r = await analizarLlamadasDeLead(leadId);
    if (r.encontradas === 0) {
      return { ok: false, motivo: 'No encontré la llamada en Fathom. Revisá que el link de Fathom o el email del lead coincidan con la reunión.' };
    }
    revalidatePath(`/leads/${leadId}`);
    return { ok: true, ...r };
  } catch (e) {
    return { ok: false, motivo: e instanceof Error ? e.message : String(e) };
  }
}
