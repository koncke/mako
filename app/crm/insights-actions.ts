'use server';

// =============================================================================
// Server actions — Insights generativos del lead (botón Generar/Regenerar)
// =============================================================================
// Wrapper fino sobre lib/lead-insights: la validación de requisitos, el armado
// del prompt y el guardado viven en la lib. Acá solo se expone a la UI.

import { revalidatePath } from 'next/cache';
import { generarInsightLead, type GenerarInsightResult } from '@/lib/lead-insights';
import { analizarLlamadasDeLead } from '@/lib/closing';
import { insightsDeLlamadaDeLead, type InsightLlamada } from '@/lib/insights-llamada';
import { exigirSesion } from '@/lib/sesion-accion';
import { leerPorPaginas } from '@/lib/supabase-paginado';

export async function generateLeadInsightAction(leadId: number): Promise<GenerarInsightResult> {
  await exigirSesion();
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
  await exigirSesion();
  if (!Number.isFinite(leadId) || leadId <= 0) return { ok: false, motivo: 'Lead inválido.' };
  try {
    const r = await analizarLlamadasDeLead(leadId);
    if (r.encontradas === 0 && r.relinkeadas === 0) {
      return { ok: false, motivo: 'No encontré la llamada en Fathom ni entre las analizadas. Revisa que el link de Fathom o el email del lead coincidan con la reunión.' };
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
  await exigirSesion();
  if (!Number.isFinite(leadId) || leadId <= 0) return false;
  const { getTenantDb } = await import('@/lib/workspace');
  const supabase = await getTenantDb();
  const { data: lr } = await supabase.from('leads').select('email, fathom_links').eq('id', leadId).maybeSingle();
  const row = (lr ?? {}) as { email?: string | null; fathom_links?: Array<{ url?: string }> | null };
  const emailNorm = (row.email ?? '').trim().toLowerCase();
  const norm = (u: string) => u.trim().replace(/[?#].*$/, '').replace(/\/+$/, '').toLowerCase();
  const shareSet = new Set((row.fathom_links ?? []).map((f) => norm(f.url ?? '')).filter(Boolean));
  // ⚠️ PAGINADO (P20, 18/11/2026). `closing_analyses` tiene una fila por llamada del negocio y pasa las 1000:
  // un `.select()` plano devolvía las primeras 1000 y, si la llamada de este lead estaba después, contestaba
  // «no tiene llamada» y la pantalla ofrecía pagar otro análisis. Se barre página por página y se corta en
  // cuanto aparece. La tabla NO tiene `id`: el orden único es `recording_id` (PK workspace_id + recording_id,
  // mig 0057; el mismo de `leerClosingAnalyses` en lib/closing.ts). Si la lectura falla, contesta `false`, como antes.
  const cumple = (r: { lead_id: number | null; invitee_email: string | null; share_url: string | null }): boolean =>
    r.lead_id === leadId
    || (!!emailNorm && (r.invitee_email ?? '').trim().toLowerCase() === emailNorm)
    || (!!r.share_url && shareSet.has(norm(r.share_url)));
  let tiene = false;
  try {
    await leerPorPaginas<{ lead_id: number | null; invitee_email: string | null; share_url: string | null }>(
      supabase, 'closing_analyses', 'recording_id, lead_id, invitee_email, share_url, status',
      (filas) => { if (filas.some(cumple)) { tiene = true; return false; } },
      { orden: 'recording_id', filtros: (q) => q.neq('status', 'error') },
    );
  } catch (e) {
    console.error(`[leadTieneLlamada] no pude leer closing_analyses: ${e instanceof Error ? e.message : String(e)}`);
    return false;
  }
  return tiene;
}

export type InsightsDeLlamadaResult =
  | { ok: true; llamadas: InsightLlamada[] }
  | { ok: false; motivo: string };

/**
 * Lo que salió de la LLAMADA, para el apartado de la ficha (ReunionesCard).
 *
 * NO GASTA IA: lee la fila que el Closing Analyst ya escribió por grabación. El
 * botón que paga un análisis es otro y vive en /crm/[id]/resumen.
 *
 * ⚠️ DEVUELVE EL MOTIVO EN VEZ DE UN ARRAY VACÍO. Con un `catch(() => [])`, «no
 * pude leer» se ve igual que «esta llamada no se analizó» — y el apartado
 * ofrecería analizarla, o sea pagarle de nuevo a un análisis que ya está hecho.
 */
export async function insightsDeLlamadaAction(leadId: number): Promise<InsightsDeLlamadaResult> {
  await exigirSesion();
  if (!Number.isFinite(leadId) || leadId <= 0) return { ok: false, motivo: 'Lead inválido.' };
  try {
    return { ok: true, llamadas: await insightsDeLlamadaDeLead(leadId) };
  } catch (e) {
    return { ok: false, motivo: e instanceof Error ? e.message : String(e) };
  }
}
