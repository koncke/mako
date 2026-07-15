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
  faltantesDeLead,
  getLead,
  getPipelineStages,
  getVisitasLandingMap,
  getVslEngagement,
  getTrackingEvents,
  getLeadRespuestas,
  logLeadChanges,
  logLeadEvent,
  getLeadAudit,
  type LeadMetaInput,
  type LeadAuditRow,
  type FathomLink,
  type Lead,
  type VslEngagement,
  type TrackingEvent,
  type RespuestaQA,
} from '@/lib/leads';
import { DEFAULT_STAGES, terminalEstadoFor, MAKO_SETTER, type Stage } from '@/lib/pipeline';
import { missingForStage, funnelReqInfo } from '@/lib/stage-requirements';
import { hoyEnTijuana } from '@/lib/date-utils';
import { getUsuarioActual } from '@/lib/auth';
import { ensureContactoWhatsapp } from '@/lib/chatwoot';
import { getUltimoInsightGenerado, faltantesParaInsights, type LeadInsightGen } from '@/lib/lead-insights';
import type { Step } from '@/lib/stage-requirements';
import { getSupabaseServer } from '@/lib/supabase';
import { getTenantDb, getWorkspaceActual } from '@/lib/workspace';

/**
 * Autor para el historial: el email del usuario logueado (se resuelve a nombre y
 * foto al leer el historial) o 'CRM' para sesiones sin email (legacy/dev).
 */
async function autorActual(): Promise<string> {
  try {
    const s = await getUsuarioActual();
    return s?.email?.trim() || 'CRM';
  } catch {
    return 'CRM';
  }
}
import { fmtDDMMYYYY } from '@/lib/date-utils';
import { getCampaignNameMap, resolverNombreCampana, getAdNameMap, resolverNombreAd } from '@/lib/queries';
import { savePlanPagos, saveLeadPlanManual, marcarPago, getPagosByLead, type PlanPagos, type Pago } from '@/lib/pagos';
import { type VisitasMap } from './crm-map';

/** Análisis de llamadas (Closing Analyst) matcheados a este lead. */
export type LeadInsightRow = {
  recording_id: number;
  share_url: string | null;
  started_at: string | null;
  tipo: string | null;
  score: number | null;
  outcome: string | null;
  outcome_tone: string | null;
  summary: string | null;
  next_step: string | null;
  dims: Array<{ label?: string; note?: string; quote?: string }> | null;
  objections: Array<{ quote?: string; handled?: boolean; note?: string }> | null;
  closer: string | null;
  duration_min: number | null;
};

/** Llamadas analizadas del lead (más reciente primero). Nunca rompe la ficha. */
export async function getLeadInsights(leadId: number): Promise<LeadInsightRow[]> {
  try {
    const { data, error } = await (await getTenantDb())
      .from('closing_analyses')
      .select('recording_id, share_url, started_at, tipo, score, outcome, outcome_tone, summary, next_step, dims, objections, closer, duration_min')
      .eq('lead_id', leadId)
      .eq('status', 'analizada')
      .order('started_at', { ascending: false })
      .limit(10);
    if (error) return [];
    return (data ?? []) as LeadInsightRow[];
  } catch {
    return [];
  }
}

/** Datos completos para hidratar la ficha (LeadSheet) como modal. */
export type LeadFullData = {
  lead: Lead;
  stages: Stage[];
  pagos: Pago[];
  vslEng: VslEngagement;
  campana: { texto: string | null; tooltip: string | null };
  adNombre: string | null;
  visitas: { total_visitas: number; dias_distintos: number };
  insights: LeadInsightRow[];
  tracking: TrackingEvent[];
  respuestas: { R1: RespuestaQA[]; R2: RespuestaQA[] };
  insightGen: LeadInsightGen | null;
  faltantesInsight: Step[];
  /** Datos sin marcar de la etapa actual (completos: incluye tel/empresa/deal). */
  faltantes: Step[];
  equipo: MiembroEquipo[];
  closerDetectado: string | null;
};

/**
 * Carga TODO lo que la ficha (LeadSheet) necesita para mostrar un lead desde un
 * modal (CRM / WhatsApp / desgloses): el Lead completo, etapas, plan de pagos,
 * engagement del VSL, visitas a la landing y campaña resuelta.
 */
export async function getLeadFullAction(id: number): Promise<LeadFullData | null> {
  const lead = await getLead(id);
  if (!lead) return null;
  const [vslEng, pagos, campMap, adMap, stagesRaw, visitasMap, insights, tracking] = await Promise.all([
    getVslEngagement(lead.visitor_id).catch(() => ({ plays: 0, max_pct: null, sin_datos: true }) as VslEngagement),
    getPagosByLead(lead.id).catch(() => [] as Pago[]),
    getCampaignNameMap().catch(() => ({}) as Record<string, string>),
    getAdNameMap().catch(() => ({}) as Record<string, string>),
    getPipelineStages().catch(() => DEFAULT_STAGES),
    getVisitasLandingMap([lead.visitor_id]).catch(() => new Map() as VisitasMap),
    getLeadInsights(id),
    getTrackingEvents(lead.visitor_id),
  ]);
  const [respuestas, insightGen, equipo] = await Promise.all([getLeadRespuestas(lead), getUltimoInsightGenerado(id), getEquipoAction()]);
  const stages = stagesRaw.length ? stagesRaw : DEFAULT_STAGES;
  const campana = resolverNombreCampana(lead.utm_campaign, campMap);
  const adNombre = resolverNombreAd(lead.meta_ad_id ?? null, lead.meta_ad_name ?? null, adMap);
  const visitas = visitasMap.get(lead.visitor_id ?? '') ?? { total_visitas: 0, dias_distintos: 0 };
  const faltantesInsight = faltantesParaInsights(lead, pagos.length > 0, stages);
  const comprobantesFaltantes = pagos.filter((p) => p.pagado && !p.comprobante_path).length;
  const faltantes = faltantesDeLead(lead, pagos.length > 0, { comprobantesFaltantes, r2RespuestasOk: respuestas.R2.length > 0, pipeline: stages });
  const closerDetectado = insights.find((i) => i.closer?.trim())?.closer ?? null;
  return { lead, stages, pagos, vslEng, campana, adNombre, visitas, insights, tracking, respuestas, insightGen, faltantesInsight, faltantes, equipo, closerDetectado };
}

/** Cuota explícita del plan (modelo simple: monto + fecha). */
export type StageMoveCuota = { monto: number; fecha: string | null };

/** Datos que el wizard de movimiento puede aportar. */
export type StageMoveData = {
  fechaJ1?: string | null;
  fechaJ2?: string | null;
  fathom?: FathomLink[];
  monto?: number | null;
  motivo?: string | null;
  setter?: string | null;
  closer?: string | null;
  empresa?: string | null;
  telefono?: string | null;
  asistioJ1?: boolean | null;
  asistioJ2?: boolean | null;
  calificado?: boolean | null;
  plan?: PlanPagos | null;
  /** Cuotas explícitas (reemplazan al plan por modos). */
  cuotas?: StageMoveCuota[] | null;
  /** Excepciones declaradas: cierre sin R1/R2 (quedan en el historial). */
  sinR1Motivo?: string | null;
  sinR2Motivo?: string | null;
  /** La reunión no se grabó: el link de Fathom no se exige. */
  fathomOmitido?: boolean;
  // ── Deal Details desde el wizard (una sola pasada) ──
  dealServicio?: string | null;   // deal_servicio.que_es
  dealPromesa?: string | null;    // deal_promesa.resultado
  dealFiscal?: { razon?: string | null; id_fiscal?: string | null; domicilio?: string | null; correo?: string | null } | null;
  dealObligaciones?: { cliente?: string[]; prestador?: string[] } | null;
  /** Omisión de documento fiscal / comprobantes (no se vuelven a pedir). */
  dealFiscalDocOmitido?: boolean;
  comprobanteOmitido?: boolean;
  /** La R2 se agendó fuera de Calendly: motivo (satisface respuestas R2). */
  r2AgendaExternaMotivo?: string | null;
};

/**
 * Completa un movimiento de etapa (wizard del Kanban/ficha): guarda los datos
 * aportados y mueve, en una sola acción. Valida los requisitos ACUMULATIVOS
 * server-side (fuente única: lib/stage-requirements).
 */
export async function completeStageMoveAction(id: number, to: string, d: StageMoveData): Promise<void> {
  const before = await getLead(id).catch(() => null);
  const pagosExistentes = to === 'ganado' ? await getPagosByLead(id).catch(() => []) : [];
  const stagesMove = await getPipelineStages().catch(() => DEFAULT_STAGES);
  const faltan = missingForStage(to, {
    ...funnelReqInfo(stagesMove, to),
    fechaJ1: d.fechaJ1 ?? before?.fecha_junta_1 ?? null,
    fechaJ2: d.fechaJ2 ?? before?.fecha_junta_2 ?? null,
    asistioJ1: d.asistioJ1 ?? before?.asistio_j1 ?? null,
    asistioJ2: d.asistioJ2 ?? before?.asistio_j2 ?? null,
    calificado: d.calificado ?? before?.calificado ?? null,
    hasFathomUrl: (d.fathom ?? before?.fathom_links ?? []).some((f) => f.url?.trim()),
    monto: d.monto ?? before?.monto_cierre_usd ?? null,
    motivo: d.motivo ?? before?.motivo_perdida ?? null,
    // Higiene (setter/closer/empresa/deal/comprobante) NO gatea el movimiento.
    tienePlan: to === 'ganado' ? (!!d.plan || !!d.cuotas?.length || pagosExistentes.length > 0) : undefined,
    hoyISO: hoyEnTijuana(),
    // La excepción vale si se declara AHORA o si ya quedó persistida en el lead.
    sinR1: !!d.sinR1Motivo?.trim() || !!before?.sin_r1,
    sinR2: !!d.sinR2Motivo?.trim() || !!before?.sin_r2,
    fathomOmitido: !!d.fathomOmitido || !!before?.fathom_omitido,
  });
  if (faltan.length) throw new Error(`Falta: ${faltan.join(', ')}`);

  // Excepciones declaradas: evento en el historial (auditable) + flag persistente
  // en el lead — sin el flag, cada re-validación (gate de Insights, backstop de
  // movimientos) volvía a exigir el dato eximido y duplicaba estos eventos.
  const autor = await autorActual();
  const flags: Record<string, boolean> = {};
  if (d.sinR1Motivo?.trim() && !before?.sin_r1) {
    await logLeadEvent(id, 'Cierre sin R1', d.sinR1Motivo.trim(), autor);
    flags.sin_r1 = true;
  }
  if (d.sinR2Motivo?.trim() && !before?.sin_r2) {
    await logLeadEvent(id, 'Cierre sin R2', d.sinR2Motivo.trim(), autor);
    flags.sin_r2 = true;
  }
  if (d.fathomOmitido && !before?.fathom_omitido) {
    await logLeadEvent(id, 'Reunión sin grabación', 'El link de Fathom se omitió porque la reunión no se grabó', autor);
    flags.fathom_omitido = true;
  }
  if (Object.keys(flags).length) {
    const { error: flagErr } = await (await getTenantDb()).from('leads').update(flags).eq('id', id);
    if (flagErr) console.error(`[leads] persistir excepciones falló: ${flagErr.message}`);
  }

  // 1) Fechas/fathom/motivo/setter/closer/empresa/teléfono — solo lo que vino.
  const meta: LeadMetaInput = {};
  if (d.fechaJ1 !== undefined) meta.fecha_junta_1 = d.fechaJ1;
  if (d.fechaJ2 !== undefined) meta.fecha_junta_2 = d.fechaJ2;
  if (d.fathom !== undefined) meta.fathom_links = d.fathom;
  if (d.motivo !== undefined) meta.motivo_perdida = d.motivo;
  if (d.setter !== undefined) meta.setter = d.setter;
  if (d.closer !== undefined) meta.closer = d.closer;
  if (d.empresa !== undefined) meta.empresa = d.empresa;
  if (d.telefono !== undefined) meta.telefono = d.telefono;
  if (Object.keys(meta).length) await saveLeadMeta(id, meta);

  // 2) Asistencias + calificado por updateLead (invariantes + CAPI: marcar
  //    calificado=true con asistencia dispara Lead/QualifiedLead a Meta).
  const upd: Parameters<typeof updateLead>[1] = {};
  if (d.asistioJ1 !== undefined && d.asistioJ1 !== null) upd.asistio_j1 = d.asistioJ1;
  if (d.asistioJ2 !== undefined && d.asistioJ2 !== null) upd.asistio_j2 = d.asistioJ2;
  if (d.calificado !== undefined && d.calificado !== null) upd.calificado = d.calificado;
  if (Object.keys(upd).length) await updateLead(id, upd);

  // 3) Plan de pagos (genera las cuotas; el cash del dashboard lee de acá).
  //    Modelo simple: cuotas explícitas (monto + fecha). `plan` queda por compat.
  if (d.cuotas?.length) {
    await saveLeadPlanManual(id, {
      total_usd: d.monto ?? before?.monto_cierre_usd ?? null,
      duracion_meses: null,
      fecha_cierre: null,
      fecha_inicio: null,
      cuotas: d.cuotas.map((c) => ({ monto_usd: c.monto, fecha_esperada: c.fecha })),
    });
  } else if (d.plan) {
    await savePlanPagos(id, d.plan);
  }

  // 4) Deal Details + omisiones + motivo de agenda externa (wizard "una pasada").
  //    Merge con lo existente para no pisar doc_path ni campos ya cargados.
  const dealUpd: Record<string, unknown> = {};
  if (d.dealServicio !== undefined) {
    dealUpd.deal_servicio = { ...(before?.deal_servicio ?? {}), que_es: d.dealServicio?.trim() || null };
  }
  if (d.dealPromesa !== undefined) {
    dealUpd.deal_promesa = { ...(before?.deal_promesa ?? {}), resultado: d.dealPromesa?.trim() || null };
  }
  if (d.dealFiscal !== undefined) {
    dealUpd.deal_fiscal = {
      ...(before?.deal_fiscal ?? {}),
      razon: d.dealFiscal?.razon?.trim() || before?.deal_fiscal?.razon || null,
      id_fiscal: d.dealFiscal?.id_fiscal?.trim() || before?.deal_fiscal?.id_fiscal || null,
      domicilio: d.dealFiscal?.domicilio?.trim() || before?.deal_fiscal?.domicilio || null,
      correo: d.dealFiscal?.correo?.trim() || before?.deal_fiscal?.correo || null,
    };
  }
  if (d.dealObligaciones !== undefined) {
    dealUpd.deal_obligaciones = { cliente: d.dealObligaciones?.cliente ?? [], prestador: d.dealObligaciones?.prestador ?? [] };
  }
  if (Object.keys(dealUpd).length) {
    const { error: dealErr } = await (await getTenantDb()).from('leads').update(dealUpd).eq('id', id);
    if (dealErr) console.error(`[leads] guardar deal falló: ${dealErr.message}`);
  }
  // Omisiones/motivo (columnas de la migración 0069): update APARTE para que, si
  // la migración todavía no corrió, no tumbe el guardado del deal de arriba.
  const omisiones: Record<string, unknown> = {};
  if (d.dealFiscalDocOmitido) omisiones.deal_fiscal_doc_omitido = true;
  if (d.comprobanteOmitido) omisiones.comprobante_omitido = true;
  if (d.r2AgendaExternaMotivo?.trim()) {
    omisiones.r2_agenda_externa_motivo = d.r2AgendaExternaMotivo.trim();
    await logLeadEvent(id, 'Agendada fuera de Calendly', `R2 · ${d.r2AgendaExternaMotivo.trim()}`, autor);
  }
  if (Object.keys(omisiones).length) {
    const { error: omErr } = await (await getTenantDb()).from('leads').update(omisiones).eq('id', id);
    if (omErr) console.error(`[leads] guardar omisiones (¿falta migración 0069?): ${omErr.message}`);
  }

  // 5) Mover (updateLead sincroniza estado primero; override solo si OK).
  await setPipelineStage(id, to, { monto: d.monto ?? null, motivo: d.motivo ?? null });

  const after = await getLead(id).catch(() => null);
  await logLeadChanges(id, before, after, autor);
  bust(TAG.leads, TAG.pagos);
  revalidatePath('/leads');
  revalidatePath(`/leads/${id}`);
  revalidatePath('/general');
}

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
  // Un lead sin email NI teléfono es incontactable: el dato es posible de
  // conseguir al momento de crearlo, así que se exige al menos uno.
  if (!emptyToNull(formData.get('email')) && !emptyToNull(formData.get('telefono'))) {
    throw new Error('Cargá al menos un email o un teléfono: sin eso el lead es incontactable.');
  }
  const created = await createLead({
    nombre,
    email: emptyToNullable(formData.get('email')),
    telefono: emptyToNullable(formData.get('telefono')),
    empresa: emptyToNullable(formData.get('empresa')),
    fecha_agenda: emptyToNullable(formData.get('fecha_agenda')),
    fecha_junta_1: emptyToNullable(formData.get('fecha_junta_1')),
  });
  // Alta del chat: contacto + conversación en Chatwoot (silencioso) para que
  // todo lead con teléfono tenga su hilo de WhatsApp desde el día cero.
  if (created.telefono) await ensureContactoWhatsapp(created.nombre, created.telefono);
  bust(TAG.leads);
  revalidatePath('/leads');
  redirect(`/leads/${created.id}`);
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
  revalidatePath('/comercial');
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
  // Queda registrado en Change History (marcar y desmarcar).
  await logLeadEvent(
    leadId,
    pagado ? 'Pago registrado' : 'Pago desmarcado',
    pagado ? `Cuota marcada como pagada${fechaPago ? ` (${fechaPago})` : ''}` : 'Cuota desmarcada',
    await autorActual(),
  );
  bust(TAG.pagos, TAG.leads);
  revalidatePath(`/leads/${leadId}`);
  revalidatePath('/comercial');
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
  // Backstop server-side: mover a una etapa exige sus datos obligatorios (los
  // "posibles de conseguir": fechas de reunión, Fathom solo si la reunión ya
  // pasó, monto para Ganado, motivo para perdidos). La UI ya lo exige; esto lo
  // garantiza para cualquier caller (MaKo, API). Se evalúa con el dato de la
  // move o el ya cargado en el lead.
  const stagesMove = await getPipelineStages().catch(() => DEFAULT_STAGES);
  const faltanMove = missingForStage(stageKey, {
    ...funnelReqInfo(stagesMove, stageKey),
    fechaJ1: before?.fecha_junta_1 ?? null,
    fechaJ2: before?.fecha_junta_2 ?? null,
    asistioJ1: opts?.asistio_j1 ?? before?.asistio_j1 ?? null,
    asistioJ2: opts?.asistio_j2 ?? before?.asistio_j2 ?? null,
    calificado: before?.calificado ?? null,
    hasFathomUrl: (before?.fathom_links ?? []).some((f) => f.url?.trim()),
    monto: opts?.monto ?? before?.monto_cierre_usd ?? null,
    motivo: opts?.motivo ?? before?.motivo_perdida ?? null,
    setter: before?.setter ?? null,
    hoyISO: hoyEnTijuana(),
    sinR1: !!before?.sin_r1,
    sinR2: !!before?.sin_r2,
    fathomOmitido: !!before?.fathom_omitido,
  });
  if (faltanMove.length) throw new Error(`Para mover falta: ${faltanMove.join(', ')}`);
  await setPipelineStage(id, stageKey, opts);
  const after = await getLead(id).catch(() => null);
  await logLeadChanges(id, before, after, await autorActual());
  bust(TAG.leads, TAG.pagos);
  revalidatePath('/leads');
  revalidatePath('/general');
}

/**
 * Marca EN LOTE un dato de higiene que se repite en muchos leads del worklist
 * "Datos sin marcar" — ej. "todos tienen el mismo Setter". Solo RELLENA los que
 * están vacíos (nunca pisa un valor ya cargado a mano), scoped al workspace
 * (getTenantDb + .in(id)), en chunks, y registra cada relleno en el historial.
 * Devuelve cuántos se actualizaron de verdad.
 */
export async function bulkFillLeadFieldAction(
  field: 'setter' | 'closer' | 'empresa',
  value: string,
  leadIds: number[],
): Promise<{ updated: number }> {
  const v = value.trim();
  if (!v) throw new Error('Poné un valor para asignar.');
  if (field !== 'setter' && field !== 'closer' && field !== 'empresa') throw new Error('Ese campo no se puede marcar en lote.');
  const ids = [...new Set(leadIds)].filter((n) => Number.isInteger(n) && n > 0);
  if (!ids.length) return { updated: 0 };

  const db = await getTenantDb();
  const autor = await autorActual();
  const campo = field === 'setter' ? 'Setter' : field === 'closer' ? 'Closer' : 'Empresa';
  const patch: Record<string, unknown> = { [field]: v };
  let updated = 0;

  // Chunk para no pasar el límite de longitud del .in(). Seguimos aunque un chunk
  // falle (no dejamos la mitad escrita sin reportar lo que sí se hizo).
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    try {
      // ATÓMICO: el propio UPDATE re-chequea que el campo esté vacío (null O '') →
      // nunca pisa un valor cargado a mano entre el read y el write (sin TOCTOU).
      // Matchea '' además de null: el worklist marca faltante con !trim(), así que
      // un setter='' se ve pendiente pero .is(null) no lo agarraba (quedaba trabado).
      // `.select('id')` devuelve EXACTAMENTE las filas que se rellenaron.
      const { data: upd, error: updErr } = await db
        .from('leads').update(patch).in('id', chunk).or(`${field}.is.null,${field}.eq.`).select('id');
      if (updErr) { console.error(`[bulk] update chunk falló: ${updErr.message}`); continue; }
      const hechos = ((upd ?? []) as Array<{ id: number }>).map((r) => Number(r.id));
      if (!hechos.length) continue;
      // Historial (best-effort, pero chequeando el error retornado por supabase-js).
      const { error: audErr } = await db.from('lead_audit')
        .insert(hechos.map((id) => ({ lead_id: id, campo, valor_anterior: null, valor_nuevo: v, autor })));
      if (audErr) console.error(`[bulk] audit falló: ${audErr.message}`);
      updated += hechos.length;
    } catch (e) {
      console.error('[bulk] chunk excepción:', e);
    }
  }

  bust(TAG.leads);
  revalidatePath('/leads');
  revalidatePath('/general');
  return { updated };
}

/**
 * Ignora EN LOTE el dato "Empresa" de varios leads (setea empresa_omitido). Deja de
 * contar como "dato sin marcar" en el CRM general (sigue visible en la ficha).
 * Tenant-scoped, en chunks. Devuelve cuántos marcó.
 */
export async function bulkIgnoreEmpresaAction(leadIds: number[]): Promise<{ updated: number }> {
  const ids = [...new Set(leadIds)].filter((n) => Number.isInteger(n) && n > 0);
  if (!ids.length) return { updated: 0 };
  const db = await getTenantDb();
  let updated = 0;
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    try {
      const { data, error } = await db.from('leads').update({ empresa_omitido: true }).in('id', chunk).select('id');
      if (error) { console.error('[bulk] ignorar empresa:', error.message); continue; }
      updated += (data ?? []).length;
    } catch (e) { console.error('[bulk] ignorar empresa excepción:', e); }
  }
  bust(TAG.leads);
  revalidatePath('/leads');
  revalidatePath('/general');
  return { updated };
}

/** Guarda Closer / Setter / links de Fathom / motivo desde la ficha. */
export async function saveLeadMetaAction(id: number, meta: LeadMetaInput): Promise<void> {
  const before = await getLead(id).catch(() => null);
  await saveLeadMeta(id, meta);
  const after = await getLead(id).catch(() => null);
  await logLeadChanges(id, before, after, await autorActual());
  bust(TAG.leads);
  revalidatePath('/leads');
}

export type MiembroEquipo = { nombre: string; email: string; foto_url: string | null };

/**
 * Equipo del workspace (closers/setters) con su foto, para mostrarla junto al
 * nombre en Meetings y para los desplegables de Setter/Closer del wizard.
 * AISLAMIENTO: la tabla `usuarios` NO es tenant-scoped por el proxy (no está en
 * TENANT_TABLES), así que el filtro por workspace_id es EXPLÍCITO y obligatorio —
 * jamás debe devolver miembros de otros workspaces. Excluye admins de agencia
 * (rol='admin', no son closer/setter) y suspendidos. Fail-closed: un admin sin
 * impersonar (ws null) no tiene un equipo concreto → [].
 */
export async function getEquipoAction(): Promise<MiembroEquipo[]> {
  try {
    const ws = await getWorkspaceActual();
    if (ws == null) return [];
    const { data } = await getSupabaseServer()
      .from('usuarios')
      .select('nombre, email, foto_url, rol, estado, workspace_id')
      .eq('workspace_id', ws)
      .neq('estado', 'suspendido');
    // MaKo NO va acá: no es seleccionable a mano (se asigna solo al pasar a una
    // nutrición automática). Se muestra con su estrella cuando YA es el setter (ver
    // setterMaKoOption / la estrella en la ficha), pero no como opción a elegir.
    return ((data ?? []) as Array<{ nombre: string | null; email: string; foto_url: string | null; rol: string; workspace_id: number | null }>)
      .filter((u) => u.rol !== 'admin' && u.workspace_id === ws && (u.nombre?.trim() || u.email) && u.nombre?.trim() !== MAKO_SETTER)
      .map((u) => ({ nombre: u.nombre?.trim() || u.email, email: u.email, foto_url: u.foto_url ?? null }));
  } catch {
    return [];
  }
}

/** Fila del historial enriquecida con la identidad del autor (si es un usuario). */
export type LeadAuditRowFull = LeadAuditRow & {
  autor_nombre: string;          // nombre legible (usuario o sistema: CRM/Fathom/Calendly)
  autor_foto: string | null;     // foto de perfil si el autor es un usuario
  revertible: boolean;           // si la fila se puede deshacer desde el historial
};

/** Campos del historial que se pueden revertir (mapean 1:1 a una columna). */
const REVERTIBLES = new Set([
  'Etapa', 'Estado', 'Asistió R1', 'Asistió R2', 'Calificado', 'Fecha R1', 'Fecha R2',
  'Fecha de agendamiento', 'Closer', 'Setter', 'Monto de cierre', 'Motivo',
  'Confirmación de pago', 'Deadline de nutrición manual',
  'Nombre', 'Email', 'Teléfono', 'Empresa',
]);

/**
 * Deshace un movimiento de etapa RECIÉN hecho (toast de 5s del tablero): revierte
 * la etapa y BORRA el rastro del movimiento en el historial — un movimiento
 * deshecho al instante no es historia, es un mis-click. Pasada la ventana del
 * toast, lo que corresponde es "Restaurar" desde el historial (ese sí audita).
 */
export async function undoStageMoveAction(
  id: number,
  from: string,
  opts?: { monto?: number | null; motivo?: string | null },
): Promise<void> {
  await setPipelineStage(id, from, { monto: opts?.monto ?? null, motivo: opts?.motivo ?? null });
  try {
    // Ventana corta: solo lo que este movimiento acaba de escribir.
    const desde = new Date(Date.now() - 90_000).toISOString();
    const { error } = await (await getTenantDb())
      .from('lead_audit')
      .delete()
      .eq('lead_id', id)
      .gte('created_at', desde);
    if (error) console.error('[undo] limpiar rastro falló:', error.message);
  } catch { /* si falla, queda la historia — el undo igual se aplicó */ }
  bust(TAG.leads, TAG.pagos);
  revalidatePath('/leads');
  revalidatePath(`/leads/${id}`);
  revalidatePath('/general');
}

/** Historial de cambios de un lead, con autor resuelto (nombre + foto). */
export async function getLeadAuditAction(id: number): Promise<LeadAuditRowFull[]> {
  const rows = await getLeadAudit(id);
  // Autores con pinta de email → resolver contra la tabla usuarios (global).
  const emails = [...new Set(rows.map((r) => r.autor).filter((a) => a.includes('@')))];
  const porEmail = new Map<string, { nombre: string; foto_url: string | null }>();
  if (emails.length) {
    try {
      const { data } = await getSupabaseServer()
        .from('usuarios')
        .select('email, nombre, foto_url')
        .in('email', emails);
      for (const u of (data ?? []) as Array<{ email: string; nombre: string | null; foto_url: string | null }>) {
        porEmail.set(u.email, { nombre: u.nombre?.trim() || u.email, foto_url: u.foto_url ?? null });
      }
    } catch { /* sin enriquecer: se muestra el email pelado */ }
  }
  return rows.map((r) => {
    const u = porEmail.get(r.autor);
    return {
      ...r,
      autor_nombre: u?.nombre ?? (r.autor.includes('@') ? r.autor.split('@')[0] : r.autor),
      autor_foto: u?.foto_url ?? null,
      revertible: REVERTIBLES.has(r.campo),
    };
  });
}

/**
 * Deshace un cambio puntual del historial: vuelve el campo a su valor anterior.
 * Solo campos con mapeo 1:1 a una columna (REVERTIBLES). Queda registrado como
 * un cambio nuevo en el historial (nunca se borra historia).
 */
export async function revertAuditChangeAction(auditId: number, leadId: number): Promise<void> {
  const rows = await getLeadAudit(leadId);
  const row = rows.find((r) => r.id === auditId);
  if (!row) throw new Error('No se encontró ese cambio en el historial.');
  if (!REVERTIBLES.has(row.campo)) throw new Error(`"${row.campo}" no se puede deshacer automáticamente.`);

  const before = await getLead(leadId).catch(() => null);
  const v = row.valor_anterior; // string | null (formato de auditVal)
  const bool = (s: string | null): boolean | null => (s === 'Sí' ? true : s === 'No' ? false : null);

  switch (row.campo) {
    case 'Etapa': {
      if (v) await setPipelineStage(leadId, v);
      else await setBoardStageOverride(leadId, null, null); // volver a derivación
      break;
    }
    case 'Estado': await updateLead(leadId, { estado_lead: (v ?? 'abierto') as Lead['estado_lead'] }); break;
    case 'Asistió R1': await updateLead(leadId, { asistio_j1: bool(v) }); break;
    case 'Asistió R2': await updateLead(leadId, { asistio_j2: bool(v) }); break;
    case 'Calificado': await updateLead(leadId, { calificado: bool(v) }); break;
    case 'Fecha R1': await updateLead(leadId, { fecha_junta_1: v }); break;
    case 'Fecha R2': await updateLead(leadId, { fecha_junta_2: v }); break;
    case 'Fecha de agendamiento': await updateLead(leadId, { fecha_agenda: v }); break;
    case 'Monto de cierre': await updateLead(leadId, { monto_cierre_usd: v ? parseFloat(v) : null }); break;
    case 'Motivo': await updateLead(leadId, { motivo_perdida: v }); break;
    case 'Confirmación de pago': await updateLead(leadId, { fecha_confirmacion: v }); break;
    case 'Closer': await saveLeadMeta(leadId, { closer: v }); break;
    case 'Setter': await saveLeadMeta(leadId, { setter: v }); break;
    case 'Nombre': await saveLeadMeta(leadId, { nombre: v }); break;
    case 'Email': await saveLeadMeta(leadId, { email: v }); break;
    case 'Teléfono': await saveLeadMeta(leadId, { telefono: v }); break;
    case 'Empresa': await saveLeadMeta(leadId, { empresa: v }); break;
    case 'Deadline de nutrición manual': {
      const { error } = await (await getTenantDb()).from('leads').update({ nutricion_manual_deadline: v }).eq('id', leadId);
      if (error) throw new Error(error.message);
      break;
    }
    default: throw new Error(`"${row.campo}" no se puede deshacer automáticamente.`);
  }

  const after = await getLead(leadId).catch(() => null);
  await logLeadChanges(leadId, before, after, await autorActual());
  bust(TAG.leads, TAG.pagos);
  revalidatePath('/leads');
  revalidatePath(`/leads/${leadId}`);
  revalidatePath('/general');
}

/**
 * Revierte un MOVIMIENTO completo del historial (todas las filas escritas en el
 * mismo instante: etapa + estado + monto + fechas juntas). Un drag Ganado→Lead
 * escribe 3 filas a la vez; revertir solo "Etapa" dejaba el monto en null y el
 * estado desincronizado. Acá se restauran TODOS los campos del movimiento en una
 * sola pasada, respetando las invariantes (estado y monto van en el mismo
 * updateLead para que "cerro=true ⇒ monto" no se pise). Queda auditado.
 */
export async function revertMoveAction(leadId: number, createdAt: string): Promise<void> {
  const allAudit = await getLeadAudit(leadId);
  const grupo = allAudit.filter(
    (r) => r.created_at === createdAt && REVERTIBLES.has(r.campo) && r.valor_anterior !== r.valor_nuevo,
  );
  if (!grupo.length) throw new Error('Ese movimiento no tiene cambios reversibles.');

  // STATUS (Etapa/Estado) se deshace SOLO de a uno y empezando por el más
  // reciente: para volver más atrás hay que deshacer antes los posteriores.
  const STATUS = new Set(['Etapa', 'Estado']);
  if (grupo.some((r) => STATUS.has(r.campo))) {
    const ultimo = allAudit.filter((r) => STATUS.has(r.campo)).reduce((mx, r) => (r.created_at > mx ? r.created_at : mx), '');
    if (ultimo && createdAt !== ultimo) throw new Error('Solo se puede deshacer el último cambio de estado. Volvé de a uno, empezando por el más reciente.');
  }

  const bool = (s: string | null): boolean | null => (s === 'Sí' ? true : s === 'No' ? false : null);

  const upd: Parameters<typeof updateLead>[1] = {};
  const meta: LeadMetaInput = {};
  let etapa: { set: boolean; value: string | null } = { set: false, value: null };
  let deadline: { set: boolean; value: string | null } = { set: false, value: null };

  for (const r of grupo) {
    const v = r.valor_anterior;
    switch (r.campo) {
      case 'Etapa': etapa = { set: true, value: v }; break;
      case 'Estado': upd.estado_lead = (v ?? 'abierto') as Lead['estado_lead']; break;
      case 'Asistió R1': upd.asistio_j1 = bool(v); break;
      case 'Asistió R2': upd.asistio_j2 = bool(v); break;
      case 'Calificado': upd.calificado = bool(v); break;
      case 'Fecha R1': upd.fecha_junta_1 = v; break;
      case 'Fecha R2': upd.fecha_junta_2 = v; break;
      case 'Fecha de agendamiento': upd.fecha_agenda = v; break;
      case 'Monto de cierre': upd.monto_cierre_usd = v ? parseFloat(v) : null; break;
      case 'Motivo': upd.motivo_perdida = v; break;
      case 'Confirmación de pago': upd.fecha_confirmacion = v; break;
      case 'Closer': meta.closer = v; break;
      case 'Setter': meta.setter = v; break;
      case 'Nombre': meta.nombre = v ?? undefined; break;
      case 'Email': meta.email = v; break;
      case 'Teléfono': meta.telefono = v; break;
      case 'Empresa': meta.empresa = v; break;
      case 'Deadline de nutrición manual': deadline = { set: true, value: v }; break;
    }
  }

  // 1) Columnas del lead JUNTAS (estado + monto en la misma llamada → invariantes OK).
  if (Object.keys(upd).length) await updateLead(leadId, upd);
  // 2) Meta (closer/setter/contacto).
  if (Object.keys(meta).length) await saveLeadMeta(leadId, meta);
  // 3) Override de la columna del tablero (o null = volver a derivación).
  if (etapa.set) await setBoardStageOverride(leadId, etapa.value, deadline.set ? deadline.value : null);
  else if (deadline.set) {
    const { error } = await (await getTenantDb()).from('leads').update({ nutricion_manual_deadline: deadline.value }).eq('id', leadId);
    if (error) throw new Error(error.message);
  }

  // El deshacer/restaurar NO deja un cambio nuevo: se borra el rastro de ESTE
  // movimiento del historial (un cambio deshecho no es historia — se restaura el
  // estado previo y la acción desaparece).
  try {
    const { error } = await (await getTenantDb()).from('lead_audit').delete().eq('lead_id', leadId).eq('created_at', createdAt);
    if (error) console.error('[revert] borrar rastro del historial falló:', error.message);
  } catch { /* si falla, el revert igual se aplicó */ }
  bust(TAG.leads, TAG.pagos);
  revalidatePath('/leads');
  revalidatePath(`/leads/${leadId}`);
  revalidatePath('/general');
}

/**
 * Mueve un lead a "Nutrición - Manual" con MOTIVO y DEADLINE (desde el worklist).
 * Si el deadline vence sin resolverse, el lead vuelve a "datos sin marcar" (rojo).
 */
export async function markManualNutritionAction(id: number, motivo: string, deadline: string): Promise<void> {
  const before = await getLead(id).catch(() => null);
  await setPipelineStage(id, 'manual', { deadline: deadline || null });
  const after = await getLead(id).catch(() => null);
  await logLeadChanges(id, before, after, await autorActual());
  const nota = [motivo.trim() || null, deadline ? `vence ${fmtDDMMYYYY(deadline)}` : null].filter(Boolean).join(' · ');
  if (nota) await logLeadEvent(id, 'Nutrición manual', nota, await autorActual());
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
  /** Motivo de la excepción cuando se agendó por fuera de Calendly. */
  notaExcepcion?: string | null,
): Promise<void> {
  const before = await getLead(id).catch(() => null);
  await setMeetingManual(id, which, fecha, asistio);
  if (notaExcepcion?.trim()) {
    await logLeadEvent(id, 'Agendada fuera de Calendly', notaExcepcion.trim(), await autorActual());
  }
  const after = await getLead(id).catch(() => null);
  await logLeadChanges(id, before, after, await autorActual());
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
  // Cierre: lo edita el DealDetailsCard (dentro de Pagos). Opcionales acá: si no
  // vienen, saveLeadEditorAction NO los toca (el card los guarda por su cuenta).
  monto_cierre_usd?: number | null;
  fecha_cierre?: string | null;
  fecha_inicio_servicio?: string | null;
  fecha_confirmacion: string | null;
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
  // Backstop: Ganado sin monto positivo cuenta $0. Solo si el caller ENVÍA el
  // monto (el editor de la ficha ya no lo manda: lo maneja el DealDetailsCard).
  if (esGanado && p.monto_cierre_usd !== undefined && !(Number(p.monto_cierre_usd) > 0)) {
    throw new Error('Para Ganado, el monto de cierre debe ser un número positivo.');
  }
  const upd: Parameters<typeof updateLead>[1] = {
    nombre: p.nombre ?? undefined, email: p.email, telefono: p.telefono, empresa: p.empresa,
    fecha_agenda: p.fecha_agenda, fecha_junta_1: p.fecha_junta_1, fecha_junta_2: p.fecha_junta_2,
    asistio_j1: p.asistio_j1, asistio_j2: p.asistio_j2, calificado: p.calificado,
    estado_lead: estado,
    motivo_perdida: esLost ? p.motivo_perdida : null,
    fecha_confirmacion: p.fecha_confirmacion,
  };
  // El Cierre solo se toca si el caller lo mandó (ver LeadEditorInput).
  if (p.monto_cierre_usd !== undefined) upd.monto_cierre_usd = esGanado ? p.monto_cierre_usd : null;
  if (p.fecha_cierre !== undefined) upd.fecha_cierre = esGanado ? p.fecha_cierre : null;
  if (p.fecha_inicio_servicio !== undefined) upd.fecha_inicio_servicio = esGanado ? p.fecha_inicio_servicio : null;
  await updateLead(id, upd);
  await saveLeadMeta(id, { closer: p.closer, setter: p.setter, fathom_links: p.fathom_links });
  await setBoardStageOverride(id, p.stage, p.deadline);
  const after = await getLead(id).catch(() => null);
  await logLeadChanges(id, before, after, await autorActual());
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

