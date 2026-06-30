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
  setMeetingManual,
  setBoardStageOverride,
  saveLeadMeta,
  saveFunnel,
  getLead,
  getPipelineStages,
  getVisitasLandingMap,
  logLeadChanges,
  logLeadEvent,
  getLeadAudit,
  type LeadUpdateInput,
  type LeadMetaInput,
  type LeadAuditRow,
  type FathomLink,
} from '@/lib/leads';
import { DEFAULT_STAGES, terminalEstadoFor, type Stage } from '@/lib/pipeline';
import { fmtDDMMYYYY } from '@/lib/date-utils';
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
  const before = await getLead(id).catch(() => null);
  await setPipelineStage(id, stageKey, opts);
  const after = await getLead(id).catch(() => null);
  await logLeadChanges(id, before, after, 'CRM');
  bust(TAG.leads, TAG.pagos);
  revalidatePath('/leads');
  revalidatePath('/general');
}

/** Guarda Closer / Setter / links de Fathom / motivo desde la ficha. */
export async function saveLeadMetaAction(id: number, meta: LeadMetaInput): Promise<void> {
  const before = await getLead(id).catch(() => null);
  await saveLeadMeta(id, meta);
  const after = await getLead(id).catch(() => null);
  await logLeadChanges(id, before, after, 'CRM');
  bust(TAG.leads);
  revalidatePath('/leads');
}

/** Historial de cambios de un lead (para la ficha). */
export async function getLeadAuditAction(id: number): Promise<LeadAuditRow[]> {
  return getLeadAudit(id);
}

/**
 * Mueve un lead a "Nutrición - Manual" con MOTIVO y DEADLINE (desde el worklist).
 * Si el deadline vence sin resolverse, el lead vuelve a "datos sin marcar" (rojo).
 */
export async function markManualNutritionAction(id: number, motivo: string, deadline: string): Promise<void> {
  const before = await getLead(id).catch(() => null);
  await setPipelineStage(id, 'manual', { deadline: deadline || null });
  const after = await getLead(id).catch(() => null);
  await logLeadChanges(id, before, after, 'CRM');
  const nota = [motivo.trim() || null, deadline ? `vence ${fmtDDMMYYYY(deadline)}` : null].filter(Boolean).join(' · ');
  if (nota) await logLeadEvent(id, 'Nutrición manual', nota, 'CRM');
  bust(TAG.leads, TAG.pagos);
  revalidatePath('/leads');
  revalidatePath('/general');
}

/**
 * Marca una reunión (R1/R2) a mano, sin Calendly — para casos viejos cuya reunión
 * ya ocurrió. Setea la fecha (+ asistencia si se sabe) y deja que el lead avance.
 */
export async function markMeetingManualAction(
  id: number,
  which: 'agenda' | 'agendaj2',
  fecha: string,
  asistio: boolean | null,
): Promise<void> {
  const before = await getLead(id).catch(() => null);
  await setMeetingManual(id, which, fecha, asistio);
  const after = await getLead(id).catch(() => null);
  await logLeadChanges(id, before, after, 'CRM');
  bust(TAG.leads, TAG.pagos);
  revalidatePath('/leads');
  revalidatePath('/general');
}

/** Input del editor completo del lead (ruta /leads/[id]). */
export type LeadEditorInput = {
  stage: string;
  deadline: string | null;        // deadline de nutrición manual (solo si stage='manual')
  nombre: string | null;
  email: string | null;
  telefono: string | null;
  empresa: string | null;
  fecha_agenda: string | null;
  fecha_junta_1: string | null;
  fecha_junta_2: string | null;
  asistio_j1: boolean | null;
  asistio_j2: boolean | null;
  calificado: boolean | null;
  motivo_perdida: string | null;
  monto_cierre_usd: number | null;
  fecha_cierre: string | null;
  fecha_confirmacion: string | null;
  fecha_inicio_servicio: string | null;
  closer: string | null;
  setter: string | null;
  fathom_links: FathomLink[];
};

/**
 * Guarda TODO el editor del lead (ruta /leads/[id]) en una sola acción:
 *  1) updateLead: datos + estado_lead derivado de la etapa (invariantes + Meta CAPI),
 *  2) saveLeadMeta: closer/setter/fathom,
 *  3) setBoardStageOverride: columna del tablero (pipeline_stage) + deadline manual.
 * Registra el diff en el historial.
 */
export async function saveLeadEditorAction(id: number, p: LeadEditorInput): Promise<void> {
  const before = await getLead(id).catch(() => null);
  const estado = terminalEstadoFor(p.stage);
  const esGanado = estado === 'ganado';
  const esLost = estado === 'perdido' || estado === 'descalificado';
  await updateLead(id, {
    nombre: p.nombre ?? undefined, email: p.email, telefono: p.telefono, empresa: p.empresa,
    fecha_agenda: p.fecha_agenda, fecha_junta_1: p.fecha_junta_1, fecha_junta_2: p.fecha_junta_2,
    asistio_j1: p.asistio_j1, asistio_j2: p.asistio_j2, calificado: p.calificado,
    estado_lead: estado,
    motivo_perdida: esLost ? p.motivo_perdida : null,
    monto_cierre_usd: esGanado ? p.monto_cierre_usd : null,
    fecha_cierre: esGanado ? p.fecha_cierre : null,
    fecha_confirmacion: p.fecha_confirmacion,
    fecha_inicio_servicio: esGanado ? p.fecha_inicio_servicio : null,
  });
  await saveLeadMeta(id, { closer: p.closer, setter: p.setter, fathom_links: p.fathom_links });
  await setBoardStageOverride(id, p.stage, p.deadline);
  const after = await getLead(id).catch(() => null);
  await logLeadChanges(id, before, after, 'CRM');
  bust(TAG.leads, TAG.pagos);
  revalidatePath('/leads');
  revalidatePath(`/leads/${id}`);
  revalidatePath('/general');
}

/** Persiste la config del funnel (pipeline de Activo + nutriciones suprimidas) desde la tab "Funnel". */
export async function saveFunnelAction(pipeline: Stage[], suppressed: string[]): Promise<void> {
  await saveFunnel(pipeline, suppressed);
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
  // Mismo criterio que /leads: ignorar overrides huérfanos (etapa ya no en el funnel).
  const validStageKeys = new Set(stages.map((s) => s.key));
  return { lead: mapToCrmLead(l, campMap, visitasMap, validStageKeys), stages };
}
