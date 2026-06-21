'use server';

// =============================================================================
// Server actions para la UI de leads
// =============================================================================
// Convierten FormData (HTML forms) o input parseado a llamadas a lib/leads.ts
// y revalidan las páginas relevantes.
// =============================================================================

import { revalidatePath, updateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { TAG } from '@/lib/cache';

// Invalida la caché de lectura por dominio. Toda mutación de lead toca 'leads'
// (y cohortes/objetivo que derivan de leads); las de cobranza tocan 'pagos'.
// updateTag (Next 16) invalida la Data Cache global + read-your-own-writes desde
// la server action. Va en try/catch: la mutación ya ocurrió, y si la caché
// fallara igual vence sola por su TTL — nunca debe romper el guardado.
function bust(...tags: string[]) {
  try {
    for (const t of tags) updateTag(t);
  } catch {
    /* no-op: la caché vence por TTL */
  }
}
import {
  createLead,
  updateLead,
  deleteLead,
  setPipelineStage,
  saveLeadMeta,
  saveFunnel,
  getLead,
  getPipelineStages,
  getVisitasLandingMap,
  type LeadUpdateInput,
  type LeadMetaInput,
} from '@/lib/leads';
import { DEFAULT_STAGES, type Stage, type FunnelTransition } from '@/lib/pipeline';
import { getCampaignNameMap } from '@/lib/queries';
import { savePlanPagos, saveLeadPlanManual, marcarPago, type PlanPagos, type PlanManual } from '@/lib/pagos';
import { mapToCrmLead, type VisitasMap } from './crm-map';
import type { CrmLead } from './CrmBoard';

function emptyToNull(v: FormDataEntryValue | null): string | null {
  if (v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function emptyToNullable<T extends FormDataEntryValue | null>(
  v: T,
): string | null {
  return emptyToNull(v);
}

/**
 * Crea un lead nuevo desde el form de /leads/new.
 * Redirige a la vista detalle del lead creado.
 */
export async function createLeadAction(formData: FormData): Promise<void> {
  const nombre = emptyToNull(formData.get('nombre'));
  if (!nombre) {
    throw new Error('Nombre es requerido');
  }
  const created = await createLead({
    nombre,
    email: emptyToNullable(formData.get('email')),
    telefono: emptyToNullable(formData.get('telefono')),
    empresa: emptyToNullable(formData.get('empresa')),
    fecha_agenda: emptyToNullable(formData.get('fecha_agenda')),
    fecha_junta_1: emptyToNullable(formData.get('fecha_junta_1')),
  });
  bust(TAG.leads);
  revalidatePath('/leads');
  redirect(`/leads/${created.id}`);
}

/**
 * Actualiza un lead desde el form de detalle. Recibe input ya parseado
 * (el client component lo construye con sus toggles y validaciones).
 */
export async function updateLeadAction(
  id: number,
  input: LeadUpdateInput,
): Promise<void> {
  await updateLead(id, input);
  bust(TAG.leads);
  revalidatePath('/leads');
  revalidatePath(`/leads/${id}`);
}

/**
 * Guarda el plan de pagos de un lead y regenera las cuotas no pagadas.
 */
export async function savePlanPagosAction(
  leadId: number,
  plan: PlanPagos,
): Promise<void> {
  await savePlanPagos(leadId, plan);
  bust(TAG.pagos, TAG.leads);
  revalidatePath(`/leads/${leadId}`);
  revalidatePath('/revenue');
  revalidatePath('/general');
}

/**
 * Guarda el plan del CRM con las cuotas tal cual (monto + fecha por cuota).
 */
export async function savePlanManualAction(leadId: number, plan: PlanManual): Promise<void> {
  await saveLeadPlanManual(leadId, plan);
  bust(TAG.pagos, TAG.leads);
  revalidatePath('/leads');
  revalidatePath(`/leads/${leadId}`);
  revalidatePath('/revenue');
  revalidatePath('/general');
}

/**
 * Marca (o desmarca) una cuota como cobrada. fechaPago editable.
 */
export async function marcarPagoAction(
  pagoId: number,
  leadId: number,
  pagado: boolean,
  fechaPago: string | null,
): Promise<void> {
  await marcarPago(pagoId, pagado, fechaPago);
  bust(TAG.pagos, TAG.leads);
  revalidatePath(`/leads/${leadId}`);
  revalidatePath('/revenue');
  revalidatePath('/general');
}

/**
 * Borra un lead. Después redirige a la lista.
 */
export async function deleteLeadAction(id: number): Promise<void> {
  await deleteLead(id);
  bust(TAG.leads, TAG.pagos);
  revalidatePath('/leads');
  redirect('/leads');
}

/**
 * Borra un lead SIN redirigir — para el modal de edición in-place abierto desde
 * cualquier tab del dashboard (no expulsa al usuario de la pantalla actual).
 */
export async function deleteLeadInlineAction(id: number): Promise<void> {
  await deleteLead(id);
  bust(TAG.leads, TAG.pagos);
  revalidatePath('/leads');
  revalidatePath('/general');
}

// ─────────────────────────────────────────────────────────────────────────────
// Rediseño CRM — pipeline editable + Closer/Setter/Fathom
// ─────────────────────────────────────────────────────────────────────────────

/** Mueve un lead a una etapa del Kanban (drag&drop o chips de la ficha). */
export async function setLeadStageAction(
  id: number,
  stageKey: string,
  opts?: { monto?: number | null; motivo?: string | null; asistio_j1?: boolean | null; asistio_j2?: boolean | null },
): Promise<void> {
  await setPipelineStage(id, stageKey, opts);
  bust(TAG.leads, TAG.pagos);
  revalidatePath('/leads');
  revalidatePath('/general');
}

/** Guarda Closer / Setter / links de Fathom / motivo desde la ficha. */
export async function saveLeadMetaAction(id: number, meta: LeadMetaInput): Promise<void> {
  await saveLeadMeta(id, meta);
  bust(TAG.leads);
  revalidatePath('/leads');
}

/** Persiste toda la config del funnel (etapas + flechas) desde la tab "Funnel". */
export async function saveFunnelAction(stages: Stage[], transitions: FunnelTransition[]): Promise<void> {
  await saveFunnel(stages, transitions);
  bust(TAG.pipeline, TAG.leads);
  revalidatePath('/leads');
  revalidatePath('/funnel');
}

/**
 * Carga un lead como CrmLead (+ etapas) para el modal de edición in-place que se
 * abre desde cualquier desglose del dashboard. Mismo view-model que /leads.
 */
export async function getCrmLeadAction(
  id: number,
): Promise<{ lead: CrmLead; stages: Stage[] } | null> {
  const l = await getLead(id);
  if (!l) return null;
  const [campMap, stages] = await Promise.all([
    getCampaignNameMap().catch(() => ({}) as Record<string, string>),
    getPipelineStages().catch(() => DEFAULT_STAGES),
  ]);
  const visitasMap: VisitasMap = await getVisitasLandingMap([l.visitor_id]).catch(
    () => new Map(),
  );
  return { lead: mapToCrmLead(l, campMap, visitasMap), stages };
}
