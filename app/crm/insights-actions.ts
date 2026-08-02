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
  | { ok: true; encontradas: number; analizadas: number; relinkeadas: number; yaEstaban: number }
  | { ok: false; motivo: string };

/**
 * Analiza (o re-linkea) la(s) llamada(s) de un lead en closing_analyses para que
 * la tab Insights las tenga. La UI la encadena con generateLeadInsight.
 */
export async function analizarLlamadaLeadAction(leadId: number): Promise<AnalizarLlamadaResult> {
  if (!Number.isFinite(leadId) || leadId <= 0) return { ok: false, motivo: 'Lead inválido.' };
  try {
    const r = await analizarLlamadasDeLead(leadId);
    if (r.encontradas === 0 && r.relinkeadas === 0) {
      return { ok: false, motivo: 'No encontré la llamada en Fathom ni en Closing Analyst. Revisá que el link de Fathom o el email del lead coincidan con la reunión.' };
    }
    revalidatePath(`/crm/${leadId}`);
    return { ok: true, ...r };
  } catch (e) {
    return { ok: false, motivo: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * ¿El lead YA tiene una llamada analizada en Closing Analyst? (linkeada por
 * lead_id, o matcheable por email/share_url). Para decidir si mostrar la
 * confirmación antes de analizar.
 */
export async function leadTieneLlamadaAction(leadId: number): Promise<boolean> {
  if (!Number.isFinite(leadId) || leadId <= 0) return false;
  const { getTenantDb } = await import('@/lib/workspace');
  const supabase = await getTenantDb();
  const { data: lr } = await supabase.from('leads').select('email, fathom_links').eq('id', leadId).maybeSingle();
  const row = (lr ?? {}) as { email?: string | null; fathom_links?: Array<{ url?: string }> | null };
  const emailNorm = (row.email ?? '').trim().toLowerCase();
  const norm = (u: string) => u.trim().replace(/[?#].*$/, '').replace(/\/+$/, '').toLowerCase();
  const shareSet = new Set((row.fathom_links ?? []).map((f) => norm(f.url ?? '')).filter(Boolean));
  const { data } = await supabase.from('closing_analyses').select('lead_id, invitee_email, share_url, status').neq('status', 'error');
  for (const r of ((data ?? []) as Array<{ lead_id: number | null; invitee_email: string | null; share_url: string | null }>)) {
    if (r.lead_id === leadId) return true;
    if (emailNorm && (r.invitee_email ?? '').trim().toLowerCase() === emailNorm) return true;
    if (r.share_url && shareSet.has(norm(r.share_url))) return true;
  }
  return false;
}
