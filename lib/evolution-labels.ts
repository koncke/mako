// =============================================================================
// Etiquetas de WhatsApp (no oficial) ↔ etapa del funnel.
// El catálogo de etiquetas se sincroniza desde Evolution (findLabels) y por el
// webhook labels.edit. El mapeo etapa→etiqueta se configura en /configuraciones.
// Al cambiar de etapa un lead, se le pone/saca la etiqueta en WhatsApp.
// =============================================================================

import 'server-only';
import { getTenantDb } from '@/lib/workspace';
import { listarLabelsEvolution, asignarLabel } from '@/lib/evolution';
import { derivarEtapa, type LeadEtapaFields } from '@/lib/wa-etapas';

export type LabelCat = { labelId: string; name: string | null; color: number | null };

// Sincroniza el catálogo de labels de Evolution → evolution_labels. Best-effort.
export async function sincronizarCatalogoLabels(): Promise<LabelCat[]> {
  const labels = await listarLabelsEvolution().catch(() => []);
  const supabase = await getTenantDb();
  if (labels.length) {
    await supabase.from('evolution_labels').upsert(
      labels.map((l) => ({ label_id: l.id, name: l.name, color: l.color, updated_at: new Date().toISOString() })),
      { onConflict: 'workspace_id,label_id' },
    );
  }
  return labels.map((l) => ({ labelId: l.id, name: l.name, color: l.color }));
}

// Catálogo cacheado (evolution_labels), sin llamar a Evolution.
export async function getCatalogoLabels(): Promise<LabelCat[]> {
  const supabase = await getTenantDb();
  const { data } = await supabase.from('evolution_labels').select('label_id, name, color').order('name');
  return ((data ?? []) as Array<{ label_id: string; name: string | null; color: number | null }>).map((r) => ({ labelId: r.label_id, name: r.name, color: r.color }));
}

// Webhook labels.edit: alta/edición/borrado de una etiqueta en el celular.
export async function upsertLabelCatalogo(labelId: string, name: string | null, color: number | null): Promise<void> {
  if (!labelId) return;
  await (await getTenantDb()).from('evolution_labels').upsert(
    { label_id: labelId, name, color, updated_at: new Date().toISOString() },
    { onConflict: 'workspace_id,label_id' },
  );
}
export async function borrarLabelCatalogo(labelId: string): Promise<void> {
  if (!labelId) return;
  await (await getTenantDb()).from('evolution_labels').delete().eq('label_id', labelId);
}

// Mapeo etapa → labelId (configuración).
export async function getMapeoEtapaLabels(): Promise<Record<string, string>> {
  const supabase = await getTenantDb();
  const { data } = await supabase.from('evolution_stage_labels').select('etapa, label_id');
  const map: Record<string, string> = {};
  for (const r of (data ?? []) as Array<{ etapa: string; label_id: string }>) map[r.etapa] = r.label_id;
  return map;
}
export async function setMapeoEtapaLabel(etapa: string, labelId: string | null): Promise<void> {
  const supabase = await getTenantDb();
  if (!labelId) { await supabase.from('evolution_stage_labels').delete().eq('etapa', etapa); return; }
  await supabase.from('evolution_stage_labels').upsert(
    { etapa, label_id: labelId, updated_at: new Date().toISOString() },
    { onConflict: 'workspace_id,etapa' },
  );
}

// Deja en el número EXACTAMENTE la etiqueta de su etapa actual: saca las otras
// etiquetas mapeadas y pone la de la etapa. Idempotente (no necesita la anterior).
export async function aplicarEtiquetaActual(telefono: string, etapaKey: string, mapa: Record<string, string>): Promise<void> {
  const tel = (telefono || '').replace(/\D/g, '');
  if (!tel || !Object.keys(mapa).length) return;
  const target = mapa[etapaKey] || null;
  const otros = [...new Set(Object.values(mapa))].filter((id) => id && id !== target);
  for (const labelId of otros) await asignarLabel(tel, labelId, 'remove').catch(() => {});
  if (target) await asignarLabel(tel, target, 'add').catch(() => {});
}

// Recomputa la etapa de un lead y aplica su etiqueta en WhatsApp. Fire-and-forget
// desde los call-sites de cambio de etapa. No lanza (best-effort).
export async function actualizarEtiquetaLead(leadId: number): Promise<void> {
  try {
    const mapa = await getMapeoEtapaLabels();
    if (!Object.keys(mapa).length) return; // sin mapeo → nada que hacer
    const supabase = await getTenantDb();
    const { data } = await supabase.from('leads')
      .select('id, telefono_normalizado, pipeline_stage, fecha_primer_pago, fecha_confirmacion, cerro, asistio_j1, asistio_j2, fecha_junta_2, fecha_agenda, visitor_id, meta_lead_id')
      .eq('id', leadId).maybeSingle();
    const l = data as ({ telefono_normalizado: string | null; pipeline_stage: string | null } & LeadEtapaFields) | null;
    if (!l?.telefono_normalizado) return;
    const etapa = l.pipeline_stage === 'manual' ? 'manual' : derivarEtapa(l).key;
    await aplicarEtiquetaActual(l.telefono_normalizado, etapa, mapa);
  } catch { /* best-effort */ }
}
