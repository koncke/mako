'use server';

// =============================================================================
// Server actions para la UI de leads
// =============================================================================
// Convierten FormData (HTML forms) o input parseado a llamadas a lib/leads.ts
// y revalidan las páginas relevantes.
// =============================================================================

import { getVideosLanding } from '@/lib/landing-token';
import type { VideoLanding } from '@/lib/landing-videos';
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
  vendedorUnicoDelWorkspace,
  updateLead,
  deleteLead,
  setPipelineStage,
  setMeetingManual,
  setBoardStageOverride,
  saveLeadMeta,
  saveFunnel,
  getFunnel,
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
  type EstadoLead,
} from '@/lib/leads';
import { DEFAULT_STAGES, deriveStageKey, stageMeta, terminalEstadoFor, withLayout, MAKO_SETTER, type Stage, type StageBand, type StageDerivable } from '@/lib/pipeline';
import {
  CAMPOS_LEAD, COLUMNAS_POR_CAMPO, PREGUNTAS_FORM, SIN_ASIGNAR,
  alcanceLegible, esColumnaDerivada, filtrosLegibles, incluyeLegible, rangoDePeriodo,
  type CampoFechaLeads, type FiltrosLeads, type OrdenLeads,
} from './leads-exportar';
import { eventTypeDeReunion } from '@/lib/calendly-agenda';
import { leadsAMarkdown, type LeadDoc } from './leads-markdown';
import { MAX_FILAS_IMPORT, filasDesdeCsv, type FilaImport } from './leads-importar';
import { marcarExistentes } from './importar-server';
import { stepsForStage, funnelReqInfo, type StageReqValues } from '@/lib/stage-requirements';
import { encuentroGrabable } from '@/lib/encuentro-ws';
import { parseEntradas, parseEvento } from '@/lib/pipeline';
import { alinearEtapaVista } from '@/lib/etapa-historial';
import { hoyEnTijuana } from '@/lib/date-utils';
import { getUsuarioActual } from '@/lib/auth';
import { ensureContactoWhatsapp } from '@/lib/chatwoot';
import { getUltimoInsightGenerado, faltantesParaInsights, type LeadInsightGen } from '@/lib/lead-insights';
import { duracionDeReunionEnAgendaMin, moverEventoDeReunion, permisoCalendarioGoogle } from '@/lib/google-calendar';
import { etapaVigenteDe } from '@/lib/funnel-etapas';
import { DURACION_DEFECTO_MIN, instanteDeLocal } from './horarios-respuesta';
import { tzDeWorkspace, TZ_DEFAULT } from '@/lib/timezone';
import type { Step } from '@/lib/stage-requirements';
import { getSupabaseServer } from '@/lib/supabase';
import { getTenantDb, getWorkspaceActual, getRolWsEfectivo } from '@/lib/workspace';

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
import { getCampaignNameMap, resolverNombreCampana, getAdNameMap, resolverNombreAd, adIdDeLead } from '@/lib/queries';
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
  /** El catálogo `landing.videos`: cómo llama el negocio a cada video. */
  videos: VideoLanding[];
  campana: { texto: string | null; tooltip: string | null };
  adNombre: string | null;
  /** ad_id resuelto (meta_ad_id, utm_content numérico o por nombre) para el deep-link. */
  adId: string | null;
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
  const [vslEng, pagos, campMap, adMap, stagesRaw, visitasMap, insights, tracking, videos] = await Promise.all([
    getVslEngagement(lead.visitor_id).catch(() => ({ plays: 0, max_pct: null, sin_datos: true, porVideo: [] }) as VslEngagement),
    getPagosByLead(lead.id).catch(() => [] as Pago[]),
    getCampaignNameMap().catch(() => ({}) as Record<string, string>),
    getAdNameMap().catch(() => ({}) as Record<string, string>),
    getPipelineStages().catch(() => DEFAULT_STAGES),
    getVisitasLandingMap([lead.visitor_id]).catch(() => new Map() as VisitasMap),
    getLeadInsights(id),
    getTrackingEvents(lead.visitor_id),
    getVideosLanding(),
  ]);
  const [respuestas, insightGen, equipo, grabable] = await Promise.all([getLeadRespuestas(lead), getUltimoInsightGenerado(id), getEquipoAction(), encuentroGrabable()]);
  const stages = stagesRaw.length ? stagesRaw : DEFAULT_STAGES;
  const campana = resolverNombreCampana(lead.utm_campaign, campMap);
  // El anuncio puede venir por meta_ad_id (instant form) o por utm_content (Calendly):
  // si utm_content es un id numérico, lo resolvemos a nombre con el mapa de anuncios.
  const utmC = lead.utm_content?.trim() || null;
  const adIdCand = adIdDeLead(lead.meta_ad_id, utmC, adMap);
  const adNombre = resolverNombreAd(adIdCand, lead.meta_ad_name ?? utmC, adMap);
  const visitas = visitasMap.get(lead.visitor_id ?? '') ?? { total_visitas: 0, dias_distintos: 0 };
  const faltantesInsight = faltantesParaInsights(lead, pagos.length > 0, stages);
  const comprobantesFaltantes = pagos.filter((p) => p.pagado && !p.comprobante_path).length;
  const faltantes = faltantesDeLead(lead, pagos.length > 0, { comprobantesFaltantes, r2RespuestasOk: respuestas.R2.length > 0, pipeline: stages, grabable });
  const closerDetectado = insights.find((i) => i.closer?.trim())?.closer ?? null;
  return { lead, stages, pagos, vslEng, videos, campana, adNombre, adId: adIdCand, visitas, insights, tracking, respuestas, insightGen, faltantesInsight, faltantes, equipo, closerDetectado };
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
  // ── Venta recurrente / suscripción (#363) ──
  ventaTipo?: 'unico' | 'suscripcion' | null;
  suscripcionMonto?: number | null;   // importe MENSUAL (MRR)
  suscripcionMeses?: number | null;    // plazo fijo en meses; null = indefinida
};

/**
 * FUENTE ÚNICA de "qué pide la etapa `to` para este lead".
 *
 * Lo consumen los DOS lados del wizard: `requisitosDeEtapaAction` (lo que el
 * formulario tiene que PREGUNTAR) y `completeStageMoveAction` (lo que el server
 * VALIDA al confirmar), con `d` = lo que el usuario acaba de contestar.
 *
 * Que sean la misma función no es cosmético: mientras fueron dos listas armadas
 * por caminos distintos, el wizard preguntaba cinco cosas y el server exigía
 * otras cuatro que nunca aparecieron en pantalla — el usuario completaba todo el
 * formulario y recién al confirmar se comía un error de Server Components. Si
 * cambiás una condición acá, cambia en los dos lados a la vez. Ese es el punto.
 */
function valoresDeRequisitos(
  to: string,
  before: Lead | null,
  pagosExistentes: Pago[],
  stagesMove: Stage[],
  d: StageMoveData = {},
  /** ¿Se espera grabación de este encuentro? De encuentroGrabable(). undefined = se exige, como siempre. */
  grabable?: boolean,
): StageReqValues {
  return {
    // El funnel del WORKSPACE (no el default): un funnel de 1 reunión no puede
    // exigir una R2 que no existe. El wizard mira este mismo pipeline.
    ...funnelReqInfo(stagesMove, to),
    fechaJ1: d.fechaJ1 ?? before?.fecha_junta_1 ?? null,
    fechaJ2: d.fechaJ2 ?? before?.fecha_junta_2 ?? null,
    asistioJ1: d.asistioJ1 ?? before?.asistio_j1 ?? null,
    asistioJ2: d.asistioJ2 ?? before?.asistio_j2 ?? null,
    calificado: d.calificado ?? before?.calificado ?? null,
    hasFathomUrl: (d.fathom ?? before?.fathom_links ?? []).some((f) => f.url?.trim()),
    monto: d.monto ?? before?.monto_cierre_usd ?? null,
    // Venta recurrente: el importe es el MENSUAL y `monto` viaja null a propósito
    // (el wizard manda uno u otro, nunca los dos). Se lee el tipo EFECTIVO —lo que
    // el usuario acaba de elegir gana sobre lo persistido— para que pasar de
    // suscripción a pago único no deje el monto viejo dando el paso por cargado.
    suscripcionMonto: (d.ventaTipo ?? before?.venta_tipo) === 'suscripcion'
      ? (d.suscripcionMonto ?? before?.suscripcion_monto_usd ?? null)
      : null,
    // El motivo va PARTIDO en dos porque no valen lo mismo: al mover un lead a
    // perdido/descal, el `motivo_perdida` que ya trae es el de una pérdida
    // anterior y no puede dar por contestada la de ahora. Quien decide es
    // stepsForStage con `etapaActual` — acá solo se le dan los tres datos.
    motivo: before?.motivo_perdida ?? null,
    motivoNuevo: d.motivo ?? null,
    // De DÓNDE viene el lead: la etapa efectiva de hoy (override o derivada).
    //
    // Va etapaVigenteDe y NO pipelineStageOf: este último devuelve el override
    // CRUDO, y en ws1 hay cientos de leads apuntando a etapas que su funnel ya no
    // tiene. La ficha decide en qué etapa estás con la regla de vigencia
    // (LeadDetailBody), así que con el override crudo las dos mitades discrepaban
    // justo en esos leads: uno con pipeline_stage='reactivacion' (etapa muerta) y
    // estado 'perdido' abría "Completar datos" hacia perdido, acá se calculaba
    // 'reactivacion' ≠ 'perdido' → "estás ENTRANDO" → se exigía un motivo nuevo y
    // el guardado quedaba bloqueado sin salida.
    //
    // Sin `before` (lead que no se pudo leer) queda null = "no sé", y el corte se
    // comporta como antes.
    etapaActual: before ? etapaVigenteDe(before, stagesMove) : null,
    // Higiene (setter/closer/empresa/deal/comprobante) NO gatea el movimiento.
    // Una suscripción (aunque sea indefinida y sin cuotas) es un plan válido: el
    // monto mensual ES el plan, así que no se exige el plan de cuotas fijo.
    tienePlan: to === 'ganado'
      ? (!!d.plan || !!d.cuotas?.length || pagosExistentes.length > 0 || d.ventaTipo === 'suscripcion' || before?.venta_tipo === 'suscripcion')
      : undefined,
    hoyISO: hoyEnTijuana(),
    // Hora real de Calendly: una reunión de HOY que ya terminó sí exige su Fathom.
    // Sin esto el server y el worklist (que sí las mira) discrepaban por un día.
    atJ1: before?.junta_1_at ?? null,
    atJ2: before?.junta_2_at ?? null,
    // La excepción vale si se declara AHORA o si ya quedó persistida en el lead.
    sinR1: !!d.sinR1Motivo?.trim() || !!before?.sin_r1,
    sinR2: !!d.sinR2Motivo?.trim() || !!before?.sin_r2,
    fathomOmitido: !!d.fathomOmitido || !!before?.fathom_omitido,
    // Un taller presencial o un webinar grupal no dejan grabación, y un workspace
    // sin Fathom tampoco: exigir el link ahí es pedir un dato imposible.
    grabable,
  };
}

/**
 * Qué datos va a EXIGIR el server para mover este lead a `to`, tal cual, hoy.
 *
 * El wizard la llama al abrirse y funde el resultado con lo que ya sabía, así la
 * lista de preguntas nunca queda corta contra la validación. Es de solo lectura.
 *
 * `d` = lo que el usuario YA contestó en la pantalla anterior. Sin ese parámetro
 * el server calculaba con `before` a secas y volvía a reclamar la asistencia que
 * el humano acababa de declarar: el worklist preguntaba "¿no se presentó?" y el
 * segundo wizard abría con "¿Asistió a la Reunión 1?". Es de solo lectura: sirve
 * para armar PREGUNTAS, nunca para decidir permisos.
 */
export async function requisitosDeEtapaAction(id: number, to: string, d: StageMoveData = {}): Promise<Step[]> {
  const before = await getLead(id).catch(() => null);
  const pagosExistentes = to === 'ganado' ? await getPagosByLead(id).catch(() => []) : [];
  const [stagesMove, grabable] = await Promise.all([getPipelineStages().catch(() => DEFAULT_STAGES), encuentroGrabable()]);
  return stepsForStage(to, valoresDeRequisitos(to, before, pagosExistentes, stagesMove, d, grabable));
}

/**
 * Resultado de un movimiento de etapa. NO es `void` ni una excepción a propósito:
 * "faltan datos" es una respuesta esperable del negocio, no una falla del sistema.
 * Cuando salía como `throw`, Next lo mostraba como «An error occurred in the
 * Server Components render…» — un cartel rojo en inglés que no dice qué falta ni
 * cómo salir. Ahora vuelve tipado y el modal lo pinta en español, con los campos.
 */
export type StageMoveResultado =
  | { ok: true }
  | { ok: false; faltan: Step[]; mensaje: string };

/**
 * Completa un movimiento de etapa (wizard del Kanban/ficha): guarda los datos
 * aportados y mueve, en una sola acción. Valida los requisitos ACUMULATIVOS
 * server-side (fuente única: `valoresDeRequisitos` + lib/stage-requirements).
 */
export async function completeStageMoveAction(id: number, to: string, d: StageMoveData): Promise<StageMoveResultado> {
  const before = await getLead(id).catch(() => null);
  const pagosExistentes = to === 'ganado' ? await getPagosByLead(id).catch(() => []) : [];
  const [stagesMove, grabable] = await Promise.all([getPipelineStages().catch(() => DEFAULT_STAGES), encuentroGrabable()]);
  const faltan = stepsForStage(to, valoresDeRequisitos(to, before, pagosExistentes, stagesMove, d, grabable));
  if (faltan.length) {
    const etapa = stageMeta(stagesMove, to)?.label ?? to;
    return {
      ok: false,
      faltan,
      mensaje: `Para pasar a ${etapa} todavía falta cargar: ${faltan.map((f) => f.label).join(', ')}.`,
    };
  }

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
  // Auto-asignar setter/closer al ÚNICO vendedor del workspace (#2): si no se
  // aportó y el lead no lo tenía, y hay una sola persona, se asigna sola.
  const solo = await vendedorUnicoDelWorkspace();
  if (solo) {
    if (meta.setter === undefined && !before?.setter?.trim()) meta.setter = solo;
    if (meta.closer === undefined && !before?.closer?.trim()) meta.closer = solo;
  }
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

  // Venta recurrente / suscripción (#363, mig 0115): tipo + monto mensual + plazo.
  // Update aparte para no tumbar lo de arriba si la migración aún no corrió.
  if (d.ventaTipo !== undefined) {
    const sub: Record<string, unknown> = { venta_tipo: d.ventaTipo ?? 'unico' };
    if (d.ventaTipo === 'suscripcion') {
      sub.suscripcion_monto_usd = d.suscripcionMonto ?? null;
      sub.suscripcion_meses = d.suscripcionMeses ?? null;
    } else {
      sub.suscripcion_monto_usd = null;
      sub.suscripcion_meses = null;
    }
    const { error: subErr } = await (await getTenantDb()).from('leads').update(sub).eq('id', id);
    if (subErr) console.error(`[leads] guardar suscripción (¿falta migración 0115?): ${subErr.message}`);
  }

  // 5) Mover (updateLead sincroniza estado primero; override solo si OK).
  await setPipelineStage(id, to, { monto: d.monto ?? null, motivo: d.motivo ?? null });

  const after = await getLead(id).catch(() => null);
  await logLeadChanges(id, before, after, autor);
  bust(TAG.leads, TAG.pagos);
  revalidatePath('/crm');
  revalidatePath(`/crm/${id}`);
  revalidatePath('/general');
  return { ok: true };
}

/**
 * "¿Qué hacer ahora?" resuelto de una: mueve el lead y deja la DECISIÓN en el
 * historial, no solo sus efectos.
 *
 * Es un envoltorio fino a propósito. `completeStageMoveAction` sigue siendo el
 * único que valida y el único que escribe; acá no hay ni una regla nueva. Lo que
 * agrega es la frase en castellano de por qué se movió ("No se presentó a la
 * Reunión 1 — pasa a Nutrición No Show R1"), que es lo que después se lee en la
 * ficha. `logLeadChanges` cuenta qué campos cambiaron; esto cuenta el motivo.
 *
 * El `{ ok:false, faltan }` vuelve INTACTO: el wizard lo usa para abrir el
 * diálogo de completar datos con lo ya contestado, no para pintar un error rojo.
 * Por eso el evento se escribe solo cuando el movimiento salió bien — si no,
 * quedaría historia de algo que no pasó.
 */
export async function resolverQueHacerAction(
  leadId: number,
  to: string,
  datos: StageMoveData,
  frase: string,
): Promise<StageMoveResultado> {
  const r = await completeStageMoveAction(leadId, to, datos);
  if (r.ok && frase.trim()) {
    await logLeadEvent(leadId, 'Datos sin marcar', frase.trim(), await autorActual()).catch(() => {});
  }
  return r;
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
 * Crea un lead nuevo desde el form de /crm/new.
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
  // (setter/closer se auto-asignan dentro de createLead si hay un único vendedor.)
  bust(TAG.leads);
  revalidatePath('/crm');
  redirect(`/crm/${created.id}`);
}

/**
 * Crea un lead desde una conversación de WhatsApp (plan #381): el contacto no
 * estaba en el CRM. Usa la MISMA vía que el alta manual (createLead) + asegura el
 * contacto en Chatwoot. Devuelve el id para abrir la ficha en el acto. La
 * conversación se enlaza sola al lead por teléfono en la próxima carga.
 */
export async function crearLeadDesdeWhatsappAction(nombre: string, telefono: string): Promise<number> {
  const n = (nombre ?? '').trim();
  const t = (telefono ?? '').trim();
  if (!n) throw new Error('Falta el nombre del contacto.');
  if (!t) throw new Error('Falta el teléfono del contacto.');
  const created = await createLead({ nombre: n, telefono: t });
  if (created.telefono) await ensureContactoWhatsapp(created.nombre, created.telefono).catch(() => {});
  bust(TAG.leads);
  revalidatePath('/crm');
  revalidatePath('/whatsapp');
  return created.id;
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
  revalidatePath(`/crm/${leadId}`);
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
  revalidatePath(`/crm/${leadId}`);
  revalidatePath('/comercial');
  revalidatePath('/general');
}

/**
 * Borra un lead. Después redirige a la lista.
 */
export async function deleteLeadAction(id: number): Promise<void> {
  await deleteLead(id);
  bust(TAG.leads, TAG.pagos);
  revalidatePath('/crm');
  redirect('/crm');
}

/**
 * Borra un lead SIN redirigir — para el modal de edición in-place abierto desde
 * cualquier tab del dashboard (no expulsa al usuario de la pantalla actual).
 */
export async function deleteLeadInlineAction(id: number): Promise<void> {
  await deleteLead(id);
  bust(TAG.leads, TAG.pagos);
  revalidatePath('/crm');
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
): Promise<StageMoveResultado> {
  const before = await getLead(id).catch(() => null);
  // Backstop server-side: mover a una etapa exige sus datos obligatorios (los
  // "posibles de conseguir": fechas de reunión, Fathom solo si la reunión ya
  // pasó, monto para Ganado, motivo para perdidos). La UI ya lo exige; esto lo
  // garantiza para cualquier caller (MaKo, API). Se evalúa con el MISMO builder
  // que el wizard (`valoresDeRequisitos`), no con una copia paralela.
  const [stagesMove, grabable] = await Promise.all([getPipelineStages().catch(() => DEFAULT_STAGES), encuentroGrabable()]);
  const pagosExistentes = stageKey === 'ganado' ? await getPagosByLead(id).catch(() => []) : [];
  const faltanMove = stepsForStage(stageKey, valoresDeRequisitos(stageKey, before, pagosExistentes, stagesMove, {
    asistioJ1: opts?.asistio_j1,
    asistioJ2: opts?.asistio_j2,
    monto: opts?.monto,
    motivo: opts?.motivo,
  }, grabable));
  // Faltar datos no es una excepción: el board lo usa para abrir el wizard en vez
  // de tragarse el error y revertir la card en silencio.
  if (faltanMove.length) {
    const etapa = stageMeta(stagesMove, stageKey)?.label ?? stageKey;
    return {
      ok: false,
      faltan: faltanMove,
      mensaje: `Para pasar a ${etapa} todavía falta cargar: ${faltanMove.map((f) => f.label).join(', ')}.`,
    };
  }
  await setPipelineStage(id, stageKey, opts);
  const after = await getLead(id).catch(() => null);
  await logLeadChanges(id, before, after, await autorActual());
  bust(TAG.leads, TAG.pagos);
  revalidatePath('/crm');
  revalidatePath('/general');
  return { ok: true };
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
  revalidatePath('/crm');
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
  revalidatePath('/crm');
  revalidatePath('/general');
  return { updated };
}

// ── Ignorar "Datos sin marcar" a nivel LEAD (individual + en masa) ──
// A diferencia de empresa_omitido (ignora un campo), esto silencia TODO el
// worklist del lead: deja de notificar en el CRM general y de sumar al conteo,
// pero los mismos avisos siguen vivos en la ficha (con opción de reactivar).

/** Ignora los datos sin marcar de UN lead (deja de contar en el worklist). */
export async function ignorarPendientesAction(leadId: number): Promise<void> {
  const db = await getTenantDb();
  const { error } = await db.from('leads').update({ pendientes_ignorados: new Date().toISOString() }).eq('id', leadId);
  if (error) throw new Error(`No se pudo ignorar: ${error.message}`);
  await logLeadEvent(leadId, 'Datos sin marcar', 'ignorados', await autorActual()).catch(() => {});
  bust(TAG.leads);
  revalidatePath('/crm');
  revalidatePath('/general');
}

/** Ignora los datos sin marcar de MUCHOS leads de una (worklist en masa). */
export async function ignorarPendientesMasaAction(leadIds: number[]): Promise<{ updated: number }> {
  const ids = [...new Set(leadIds)].filter((n) => Number.isInteger(n) && n > 0);
  if (!ids.length) return { updated: 0 };
  const db = await getTenantDb();
  const ahora = new Date().toISOString();
  let updated = 0;
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    try {
      const { data, error } = await db.from('leads').update({ pendientes_ignorados: ahora }).in('id', chunk).select('id');
      if (error) { console.error('[bulk] ignorar pendientes:', error.message); continue; }
      updated += (data ?? []).length;
    } catch (e) { console.error('[bulk] ignorar pendientes excepción:', e); }
  }
  bust(TAG.leads);
  revalidatePath('/crm');
  revalidatePath('/general');
  return { updated };
}

/** Reactiva los avisos de un lead ignorado (vuelve al worklist normal). */
export async function reactivarPendientesAction(leadId: number): Promise<void> {
  const db = await getTenantDb();
  const { error } = await db.from('leads').update({ pendientes_ignorados: null }).eq('id', leadId);
  if (error) throw new Error(`No se pudo reactivar: ${error.message}`);
  await logLeadEvent(leadId, 'Datos sin marcar', 'reactivados', await autorActual()).catch(() => {});
  bust(TAG.leads);
  revalidatePath('/crm');
  revalidatePath('/general');
}

// ─────────────────────────────────────────────────────────────────────────────
// Exportar leads (plan #364)
// ─────────────────────────────────────────────────────────────────────────────
// El usuario arma el filtro de a una pregunta (ver ExportarLeadsModal) y acá se
// resuelve contra la base.
//
// ⚠️ EL BUG QUE ARREGLA ESTA SECCIÓN: antes la etapa se filtraba con
// `.in('pipeline_stage', …)`. Esa columna es un OVERRIDE MANUAL y está en NULL en
// la mayoría de los leads — la etapa real del CRM es `pipeline_stage ?? deriveStageKey`.
// Consecuencia medida: el alcance "nutrición" devolvía CERO leads mientras el Kanban
// mostraba cientos, y "activos" dejaba entrar leads que en el tablero estaban en
// nutrición. Ahora se traen las columnas que necesita la derivación y se filtra EN
// MEMORIA con la MISMA etapa efectiva que pinta el board (ver app/crm/crm-map.ts).
//
// El precio de filtrar en memoria es traer la tabla: se pagina con .range() porque
// PostgREST corta en 1000 filas pase lo que pase (.limit() no sube ese techo).

type FilaLead = Record<string, unknown>;

/**
 * Columnas que SIEMPRE se traen: las que necesita derivar la etapa (lib/pipeline →
 * deriveStageKey) más las que miran los filtros de fecha, dinero, persona y origen.
 * Sin estas, el filtro es adivinanza.
 */
const COLS_FILTRO: string[] = [
  'id', 'nombre',
  'estado_lead', 'pipeline_stage', 'asistio_j1', 'asistio_j2',
  'fecha_agenda', 'fecha_junta_1', 'fecha_junta_2', 'nutricion_realizada',
  'created_at', 'fecha_cierre', 'fecha_primer_pago',
  'monto_cierre_usd', 'total_cobrado_usd', 'venta_tipo',
  'closer', 'setter',
  'meta_campaign_name', 'utm_campaign', 'origen_lead',
];

const sTxt = (v: unknown): string | null => { const t = v == null ? '' : String(v).trim(); return t || null; };
const nNum = (v: unknown): number => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const bTri = (v: unknown): boolean | null => (v === true ? true : v === false ? false : null);
const diaDe = (v: unknown): string | null => { const t = sTxt(v); return t ? t.slice(0, 10) : null; };

/**
 * Etapa efectiva del lead, igual que el board: el override manual SOLO si esa etapa
 * sigue existiendo en el funnel del workspace; si quedó huérfana (se borró del
 * funnel), se ignora y vale la derivada.
 */
function etapaEfectivaDe(l: FilaLead, validas: Set<string>): string {
  const d: StageDerivable = {
    estado_lead: (sTxt(l.estado_lead) ?? 'abierto') as EstadoLead,
    pipeline_stage: sTxt(l.pipeline_stage),
    fecha_agenda: diaDe(l.fecha_agenda),
    fecha_junta_1: diaDe(l.fecha_junta_1),
    fecha_junta_2: diaDe(l.fecha_junta_2),
    asistio_j1: bTri(l.asistio_j1),
    asistio_j2: bTri(l.asistio_j2),
    nutricion_realizada: l.nutricion_realizada === true,
  };
  const derivada = deriveStageKey(d);
  return d.pipeline_stage && validas.has(d.pipeline_stage) ? d.pipeline_stage : derivada;
}

/** Origen a nivel CAMPAÑA: es el corte con el que se piensa "de dónde vino esta gente". */
function origenDeFila(l: FilaLead): string {
  const camp = sTxt(l.meta_campaign_name) ?? sTxt(l.utm_campaign);
  if (camp) return camp;
  const o = sTxt(l.origen_lead);
  if (o === 'instant_form') return 'Meta · sin campaña';
  if (o === 'calendly') return 'Calendly · sin campaña';
  return o ?? 'Directo / orgánico';
}

/** Qué fecha mira el filtro por período (la eligió el usuario en el paso 6). */
function fechaDeFiltro(l: FilaLead, campo: CampoFechaLeads): string | null {
  switch (campo) {
    case 'r1': return diaDe(l.fecha_junta_1) ?? diaDe(l.fecha_agenda);
    case 'cierre': return diaDe(l.fecha_cierre);
    case 'primer-pago': return diaDe(l.fecha_primer_pago);
    default: return diaDe(l.created_at);
  }
}

function pasaFiltros(
  l: FilaLead, f: FiltrosLeads, etapa: string, banda: StageBand,
  rango: { desde: string; hasta: string } | null,
): boolean {
  if (f.banda === 'elegir') { if (!f.etapas.includes(etapa)) return false; }
  else if (f.banda !== 'todo' && banda !== f.banda) return false;

  const on = new Set(f.acotar);

  if (on.has('fecha') && rango) {
    // Un lead sin esa fecha queda AFUERA a propósito: "los que cerraron este mes"
    // no puede incluir a los que nunca cerraron.
    const d = fechaDeFiltro(l, f.campoFecha);
    if (!d || d < rango.desde || d > rango.hasta) return false;
  }

  if (on.has('origen') && f.origenes.length && !f.origenes.includes(origenDeFila(l))) return false;

  if (on.has('persona') && f.personas.length) {
    const closer = sTxt(l.closer);
    const setter = sTxt(l.setter);
    // Matchea closer O setter: "los de Juan" son los que él agendó y los que cerró.
    const ok = f.personas.some((p) => (p === SIN_ASIGNAR ? !closer && !setter : p === closer || p === setter));
    if (!ok) return false;
  }

  if (on.has('dinero') && f.dinero !== 'no-importa') {
    const vendido = nNum(l.monto_cierre_usd);
    const cobrado = nNum(l.total_cobrado_usd);
    switch (f.dinero) {
      case 'con-monto': if (!(vendido > 0)) return false; break;
      case 'con-cobro': if (!(cobrado > 0)) return false; break;
      case 'debe': if (!(vendido - cobrado > 0)) return false; break;
      case 'suscripcion': if (sTxt(l.venta_tipo) !== 'suscripcion') return false; break;
      case 'ganado-sin-monto': if (sTxt(l.estado_lead) !== 'ganado' || vendido > 0) return false; break;
    }
  }
  return true;
}

/** Trae los leads del workspace paginando (PostgREST corta en 1000 filas). */
async function traerLeads(columnas: string[]): Promise<FilaLead[]> {
  const db = await getTenantDb();
  const sel = [...new Set(columnas.filter((c) => !esColumnaDerivada(c)))].join(', ');
  const filas: FilaLead[] = [];
  const PAGE = 1000;
  // Ordenado por id y no por created_at: con empates de timestamp el .range()
  // repite o saltea filas entre páginas (el orden deja de ser estable).
  for (let desde = 0; desde < 200_000; desde += PAGE) {
    const { data, error } = await db.from('leads').select(sel).order('id', { ascending: true }).range(desde, desde + PAGE - 1);
    if (error) throw new Error(`No se pudieron leer los leads: ${error.message}`);
    const chunk = (data ?? []) as unknown as FilaLead[];
    filas.push(...chunk);
    if (chunk.length < PAGE) break;
  }
  return filas;
}

function ordenarLeads(filas: FilaLead[], orden: OrdenLeads, ordenEtapas: string[]): void {
  const idx = (k: unknown) => { const i = ordenEtapas.indexOf(String(k)); return i < 0 ? ordenEtapas.length : i; };
  const monto = (l: FilaLead) => nNum(l.monto_cierre_usd);
  const nombre = (l: FilaLead) => String(l.nombre ?? '');
  // '￿' y no 'zzz': quien no tiene closer va al final sin depender del alfabeto.
  const closer = (l: FilaLead) => sTxt(l.closer) ?? '￿';
  filas.sort((a, b) => {
    switch (orden) {
      case 'monto': return monto(b) - monto(a) || nombre(a).localeCompare(nombre(b));
      case 'fecha': return String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''));
      case 'closer': return closer(a).localeCompare(closer(b)) || monto(b) - monto(a);
      default: return idx(a['#etapaKey']) - idx(b['#etapaKey']) || monto(b) - monto(a);
    }
  });
}

/**
 * El corazón del export: trae, deriva la etapa, filtra en memoria y ordena.
 * `columnasExtra` son las columnas de los grupos que el usuario eligió llevarse.
 */
async function leadsFiltrados(f: FiltrosLeads, columnasExtra: string[]): Promise<{ filas: FilaLead[]; stages: Stage[]; ordenEtapas: string[] }> {
  const stagesRaw = await getPipelineStages().catch(() => DEFAULT_STAGES);
  const stages = (stagesRaw.length ? stagesRaw : DEFAULT_STAGES).map(withLayout);
  const validas = new Set(stages.map((s) => s.key));
  const ordenEtapas = stages.map((s) => s.key);
  const rango = f.acotar.includes('fecha') ? rangoDePeriodo(f.periodo, hoyEnTijuana()) : null;

  const todas = await traerLeads([...COLS_FILTRO, ...columnasExtra]);
  const filas: FilaLead[] = [];
  for (const l of todas) {
    const key = etapaEfectivaDe(l, validas);
    // stageMeta resuelve también las keys legacy que el funnel ya no genera
    // (noshow_r1, postagenda…), así no salen etiquetadas con la primera etapa.
    const meta = withLayout(stageMeta(stages, key));
    const banda: StageBand = meta.band ?? 'nutricion';
    if (!pasaFiltros(l, f, key, banda, rango)) continue;
    l['#etapaKey'] = key;
    l['#etapa'] = meta.label ?? key;
    l['#falta'] = Math.max(0, nNum(l.monto_cierre_usd) - nNum(l.total_cobrado_usd));
    l['#origen'] = origenDeFila(l);
    filas.push(l);
  }
  ordenarLeads(filas, f.orden, ordenEtapas);
  return { filas, stages, ordenEtapas };
}

/** Cuántos leads saldrían con estos filtros — el contador que muestra el wizard. */
export async function contarLeadsExportAction(f: FiltrosLeads): Promise<number> {
  const { filas } = await leadsFiltrados(f, []);
  return filas.length;
}

/** Lo que el wizard necesita para preguntar: etapas del funnel, orígenes reales y equipo. */
export type OpcionesExport = {
  etapas: Array<{ key: string; label: string; band: StageBand; dot: string; n: number }>;
  origenes: Array<{ valor: string; n: number }>;
  equipo: MiembroEquipo[];
  /** Cuántos leads no tienen closer NI setter (la opción "Sin asignar"). */
  sinAsignar: number;
};

/**
 * Un solo viaje para llenar los pasos condicionales. Los orígenes y los conteos por
 * etapa salen de la base, no de una lista fija: preguntar "¿de qué origen?" con
 * opciones que no existen en el CRM del cliente es peor que no preguntar.
 */
export async function getOpcionesExportAction(): Promise<OpcionesExport> {
  const stagesRaw = await getPipelineStages().catch(() => DEFAULT_STAGES);
  const stages = (stagesRaw.length ? stagesRaw : DEFAULT_STAGES).map(withLayout);
  const validas = new Set(stages.map((s) => s.key));
  const [todas, equipo] = await Promise.all([traerLeads(COLS_FILTRO), getEquipoAction()]);

  const porEtapa = new Map<string, number>();
  const porOrigen = new Map<string, number>();
  let sinAsignar = 0;
  for (const l of todas) {
    const key = etapaEfectivaDe(l, validas);
    porEtapa.set(key, (porEtapa.get(key) ?? 0) + 1);
    const o = origenDeFila(l);
    porOrigen.set(o, (porOrigen.get(o) ?? 0) + 1);
    if (!sTxt(l.closer) && !sTxt(l.setter)) sinAsignar++;
  }

  // Las etapas van en el orden del funnel; las derivadas que ya no están en el
  // funnel (overrides viejos) se agregan al final para que se puedan elegir igual.
  const etapas: OpcionesExport['etapas'] = stages.map((s) => ({
    key: s.key, label: s.label, band: s.band ?? 'nutricion', dot: s.dot, n: porEtapa.get(s.key) ?? 0,
  }));
  for (const [key, n] of porEtapa) {
    if (validas.has(key)) continue;
    const meta = withLayout(stageMeta(stages, key));
    etapas.push({ key, label: meta.label ?? key, band: meta.band ?? 'nutricion', dot: meta.dot, n });
  }

  return {
    etapas,
    origenes: [...porOrigen.entries()].map(([valor, n]) => ({ valor, n })).sort((a, b) => b.n - a.n || a.valor.localeCompare(b.valor)),
    equipo,
    sinAsignar,
  };
}

/** Una fila cruda → la ficha que imprime el documento. */
function filaALeadDoc(l: FilaLead): LeadDoc {
  return {
    id: Number(l.id),
    nombre: String(l.nombre ?? ''),
    empresa: sTxt(l.empresa),
    etapaKey: String(l['#etapaKey'] ?? ''),
    etapaLabel: String(l['#etapa'] ?? ''),
    email: sTxt(l.email),
    telefono: sTxt(l.telefono),
    estado: sTxt(l.estado_lead),
    calificado: bTri(l.calificado),
    monto: l.monto_cierre_usd == null ? null : nNum(l.monto_cierre_usd),
    cobrado: l.total_cobrado_usd == null ? null : nNum(l.total_cobrado_usd),
    ventaTipo: sTxt(l.venta_tipo),
    suscripcionMonto: l.suscripcion_monto_usd == null ? null : nNum(l.suscripcion_monto_usd),
    suscripcionMeses: l.suscripcion_meses == null ? null : nNum(l.suscripcion_meses),
    fechaR1: diaDe(l.fecha_junta_1) ?? diaDe(l.fecha_agenda),
    asistioR1: bTri(l.asistio_j1),
    fechaR2: diaDe(l.fecha_junta_2),
    asistioR2: bTri(l.asistio_j2),
    closer: sTxt(l.closer),
    setter: sTxt(l.setter),
    origen: sTxt(l['#origen']),
    anuncio: sTxt(l.meta_ad_name),
    campana: sTxt(l.meta_campaign_name),
    utmCampaign: sTxt(l.utm_campaign),
    utmContent: sTxt(l.utm_content),
    creado: diaDe(l.created_at),
    agenda: diaDe(l.fecha_agenda),
    cierre: diaDe(l.fecha_cierre),
    primerPago: diaDe(l.fecha_primer_pago),
    visitorId: sTxt(l.visitor_id),
    respuestas: PREGUNTAS_FORM.map(([col, q]) => ({ q, a: sTxt(l[col]) ?? '' })).filter((r) => r.a),
    motivoPerdida: sTxt(l.motivo_perdida),
  };
}

/** Dentro de cada etapa el documento respeta el orden que el usuario eligió. */
function comparadorDoc(orden: OrdenLeads): (a: LeadDoc, b: LeadDoc) => number {
  const monto = (l: LeadDoc) => nNum(l.monto);
  switch (orden) {
    case 'fecha': return (a, b) => String(b.creado ?? '').localeCompare(String(a.creado ?? ''));
    case 'closer': return (a, b) => (a.closer ?? '￿').localeCompare(b.closer ?? '￿') || monto(b) - monto(a);
    default: return (a, b) => monto(b) - monto(a) || a.nombre.localeCompare(b.nombre);
  }
}

export async function exportLeadsAction(f: FiltrosLeads): Promise<string> {
  // id y nombre van SIEMPRE; el resto según los grupos elegidos.
  const columnas: Array<[string, string]> = [['id', 'ID'], ['nombre', 'Nombre']];
  for (const c of CAMPOS_LEAD.map((x) => x.id)) {
    if (f.campos.includes(c)) columnas.push(...COLUMNAS_POR_CAMPO[c]);
  }
  // El documento necesita empresa y montos aunque no se hayan tildado: el resumen
  // por etapa y la línea de identidad son la columna vertebral del formato.
  const extraDoc = f.formato === 'md' ? ['empresa', 'monto_cierre_usd', 'total_cobrado_usd'] : [];
  const { filas, stages, ordenEtapas } = await leadsFiltrados(f, [...columnas.map(([k]) => k), ...extraDoc]);

  if (f.formato === 'md') {
    const etapasRef = stages.map((s) => ({ key: s.key, label: s.label, band: s.band ?? ('nutricion' as StageBand) }));
    return leadsAMarkdown(
      filas.map(filaALeadDoc),
      f.campos,
      {
        alcance: alcanceLegible(f, etapasRef),
        filtros: filtrosLegibles(f),
        incluye: incluyeLegible(f),
        hoyISO: hoyEnTijuana(),
      },
      ordenEtapas,
      comparadorDoc(f.orden),
    );
  }

  const val = (v: unknown): string => (v == null ? '' : typeof v === 'boolean' ? (v ? 'Sí' : 'No') : String(v));
  const esc = (v: unknown): string => {
    const s = val(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lineas = [columnas.map(([, l]) => l).join(',')];
  for (const fila of filas) lineas.push(columnas.map(([k]) => esc(fila[k])).join(','));
  // BOM: sin él Excel abre el CSV en Windows-1252 y los acentos salen rotos
  // («Diseño» → «DiseÃ±o»). Un export ilegible no es un export.
  return `﻿${lineas.join('\r\n')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Importar leads (plan #383)
// ─────────────────────────────────────────────────────────────────────────────
// El archivo lo lee /api/crm/importar-leads (route: el body de una server action
// tope en 1 MB y acá suben PDFs y fotos). Acá vive el paso que CREA los leads, y
// vuelve a validar todo: lo que manda el cliente es una propuesta, no la verdad.
// Un lead pudo entrar por el webhook de Calendly o Meta entre la revisión y el OK,
// y el navegador no tiene forma de saberlo.
export type ImportLeadsResult = { creados: number; omitidos: number; errores: string[] };

/** Crea los leads de las filas ya revisadas y tildadas por el usuario. */
export async function importarLeadsRevisadosAction(filas: FilaImport[]): Promise<ImportLeadsResult> {
  if (!Array.isArray(filas) || !filas.length) return { creados: 0, omitidos: 0, errores: ['No llegó ninguna fila.'] };
  if (filas.length > MAX_FILAS_IMPORT) {
    return { creados: 0, omitidos: 0, errores: [`Son ${filas.length} filas y el tope por importación es ${MAX_FILAS_IMPORT}. Partí el archivo en dos.`] };
  }

  // Sanitizar ANTES de mirar nada: el cliente pudo mandar cualquier cosa en cada
  // campo (o un `motivo` en null para colar una fila que en realidad se descarta).
  const limpias: FilaImport[] = filas.map((f, i) => ({
    id: String(f?.id ?? `r${i}`),
    nombre: String(f?.nombre ?? '').trim().slice(0, 200),
    email: String(f?.email ?? '').trim().slice(0, 200),
    telefono: String(f?.telefono ?? '').trim().slice(0, 60),
    empresa: String(f?.empresa ?? '').trim().slice(0, 200),
    incluir: f?.incluir === true,
    yaExiste: false,
    bajaConfianza: f?.bajaConfianza === true,
  }));

  // El motivo lo recalcula el SERVER contra la base de ahora (marcarExistentes
  // vuelve a consultar los duplicados y corre las mismas reglas que vio el usuario).
  const validadas = await marcarExistentes(limpias);

  let creados = 0;
  let omitidos = 0;
  const errores: string[] = [];
  const emailsNuevos = new Set<string>();
  const telsNuevos = new Set<string>();

  for (const f of validadas) {
    const email = f.email.toLowerCase();
    const tel = f.telefono.replace(/\D/g, '');
    // Además del motivo, se chequea contra lo insertado EN ESTA MISMA corrida:
    // marcarExistentes miró la base antes de empezar y no ve lo que vamos creando.
    const chocaAcá = (!!email && emailsNuevos.has(email)) || (!!tel && telsNuevos.has(tel));
    if (!f.incluir || f.motivo || chocaAcá) { omitidos++; continue; }
    try {
      await createLead({
        nombre: f.nombre,
        email: f.email || null,
        telefono: f.telefono || null,
        empresa: f.empresa || null,
      });
      creados++;
      if (email) emailsNuevos.add(email);
      if (tel) telsNuevos.add(tel);
    } catch (e) {
      omitidos++;
      errores.push(`${f.nombre}: ${e instanceof Error ? e.message : 'error'}`);
    }
  }

  bust(TAG.leads);
  revalidatePath('/crm');
  revalidatePath('/general');
  return { creados, omitidos, errores: errores.slice(0, 20) };
}

/** Lo que el wizard muestra ANTES de importar: cuántos entran y cuántos se saltean. */
export type PreviewImportLeads = { total: number; nuevos: number; omitidos: number; error?: string };

/**
 * Previsualización de un CSV pegado como texto. Queda para los callers que solo
 * tienen el texto (no un File) y no pasan por el modal: cuenta sin insertar nada.
 */
export async function previsualizarImportLeadsAction(csvText: string): Promise<PreviewImportLeads> {
  const { filas, error } = filasDesdeCsv(csvText);
  if (error) return { total: 0, nuevos: 0, omitidos: 0, error };
  const validadas = await marcarExistentes(filas);
  const nuevos = validadas.filter((f) => !f.motivo).length;
  return { total: validadas.length, nuevos, omitidos: validadas.length - nuevos };
}

/** Importa un CSV entero sin revisión previa (todo lo importable entra). */
export async function importLeadsCsvAction(csvText: string): Promise<ImportLeadsResult> {
  const { filas, error } = filasDesdeCsv(csvText);
  if (error) return { creados: 0, omitidos: 0, errores: [error] };
  return importarLeadsRevisadosAction(filas);
}

/**
 * Lo que el modal de reagendar muestra DESPUÉS de guardar. El CRM ya quedó
 * actualizado sí o sí (si esto vuelve, no hubo error de base): esto cuenta qué
 * pasó *además* con el evento del calendario.
 */
export type ReagendarResultado = {
  /** true = la reunión también se movió (o se creó) en Google Calendar. */
  ok: boolean;
  accion: 'movido' | 'creado' | 'nada';
  /** Frase lista para mostrar. Vacía cuando no hay nada que aclarar. */
  mensaje: string;
  /** true = ofrecerle el link a /integraciones para reconectar la agenda. */
  reconectar: boolean;
  /** A quién avisó Google. null = el lead no tiene email, así que NO se avisó a nadie. */
  invitado: string | null;
};

/**
 * Mueve el evento en Google, best-effort. Devuelve SIEMPRE un resultado: el
 * reagendado del CRM ya ocurrió y no puede caerse porque Google falle.
 *
 * Sin hora nueva no se intenta: mover un evento a "un día" no existe, y crear
 * uno inventándole horario sería peor que no hacer nada.
 */
async function moverEnCalendario(lead: Lead | null, cual: 'r1' | 'r2', nuevoIso: string | null, duracionMin?: number): Promise<ReagendarResultado> {
  const n = cual === 'r2' ? 2 : 1;
  if (!nuevoIso) return { ok: false, accion: 'nada', mensaje: 'Cargá también la hora si querés que se mueva el evento del calendario.', reconectar: false, invitado: null };
  // Sin el lead no hay ancla (ni fecha vieja, ni email, ni nombre): el buscador no
  // encontraría nada y terminaría CREANDO un evento vacío por una lectura fallida.
  if (!lead) return { ok: false, accion: 'nada', mensaje: 'No se pudo leer el lead para ubicar el evento en el calendario.', reconectar: false, invitado: null };
  const r = await moverEventoDeReunion({
    nuevoInicioIso: nuevoIso,
    // El ancla para encontrar el evento es dónde estaba ANTES de este cambio.
    inicioAnteriorIso: cual === 'r2' ? lead.junta_2_at : lead.junta_1_at,
    fechaAnterior: cual === 'r2' ? lead.fecha_junta_2 : lead.fecha_junta_1,
    emailInvitado: lead.email,
    // Para BUSCAR va el nombre pelado; el título largo solo se usa si hay que crear.
    titulo: lead.nombre,
    tituloSiSeCrea: lead.nombre?.trim() ? `Reunión ${n} · ${lead.nombre}` : `Reunión ${n}`,
    // La MISMA duración con la que se calcularon los huecos. Solo pesa cuando hay
    // que CREAR el evento (o no se pudo leer el original): si no, un evento nuevo
    // duraba 45' fijos mientras la grilla había reservado 60 y el hueco siguiente
    // quedaba libre de mentira.
    duracionMin,
  });
  return { ok: r.ok, accion: r.accion, mensaje: r.motivo, reconectar: r.codigo === 'sin-permiso' || r.codigo === 'sin-conexion', invitado: r.ok ? r.invitado : null };
}

/**
 * Reagenda una reunión desde el worklist ("¿Qué hacer ahora?" de una reunión que
 * ya pasó). Mueve la fecha y BORRA el timestamp de Calendly: ese `junta_N_at` es
 * la hora vieja y es justamente lo que hace que el lead siga marcado como vencido.
 * Sin limpiarlo, reagendar no sacaba al lead del pendiente.
 *
 * Y mueve el evento en Google Calendar, que es lo que hace que el invitado se
 * entere. Calendly no sirve para esto (no tiene reschedule por API, menos sobre
 * un evento pasado). Si Google falla, la fecha del CRM se guarda igual y el
 * motivo vuelve a la UI y al historial: nada silencioso.
 */
export async function reagendarReunionAction(
  leadId: number,
  cual: 'r1' | 'r2',
  fecha: string,
  hora: string | null,
  opts: {
    /** El lead NO se presentó y por eso se reagenda. Se registra ANTES del update. */
    noShowPrevio?: boolean;
    /** Cuánto dura la reunión: la MISMA con la que la UI calculó los huecos. */
    duracionMin?: number;
  } = {},
): Promise<ReagendarResultado> {
  const f = (fecha ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) throw new Error('Fecha inválida.');

  // ── LA HORA SE RESUELVE ACÁ, EN LA ZONA DEL WORKSPACE ──────────────────────
  // El cliente manda 'HH:MM' pelado y NUNCA un instante. Antes mandaba el ISO ya
  // armado y solo el camino con slot verificado estaba bien: sin Google conectado
  // (o con el token vencido, un 403, un timeout…) `slots` llega en null y el
  // navegador hacía `new Date('YYYY-MM-DDTHH:mm')`, que por spec es hora LOCAL DEL
  // NAVEGADOR. O sea: en todo workspace sin agenda conectada, el 100% de los
  // reagendados se guardaba en el huso del closer. Con el negocio en Montevideo y
  // la laptop en Ciudad de México, elegir las 18:00 guardaba las 21:00 — el CRM
  // decía una hora, `junta_N_at` otra, `fecha_junta_N` podía caer en OTRO DÍA, y
  // el mail de Google (sendUpdates=all) le llegaba al invitado con la hora mala.
  //
  // La zona del negocio solo la sabe el server, así que la conversión vive acá y
  // usa el MISMO instanteDeLocal que arma la grilla: el instante que se guarda es
  // idéntico al `inicioIso` del slot que el usuario vio.
  const wsActual = await getWorkspaceActual();
  const tzWs = wsActual != null ? await tzDeWorkspace(wsActual).catch(() => TZ_DEFAULT) : TZ_DEFAULT;
  const mHora = /^(\d{1,2}):(\d{2})$/.exec((hora ?? '').trim());
  const minDelDia = mHora ? Number(mHora[1]) * 60 + Number(mHora[2]) : NaN;
  // La HORA importa: el pendiente de "reunión pasada" se decide por junta_N_at, y
  // sin hora el lead volvía a marcarse vencido apenas cambiaba el día. Si no vino
  // hora se limpia el timestamp y se cae al día (comportamiento viejo).
  const at = Number.isFinite(minDelDia) && minDelDia >= 0 && minDelDia < 24 * 60
    ? instanteDeLocal(f, minDelDia, tzWs)
    : null;
  // ANTES del update: la fecha VIEJA es el ancla para reconocer el evento en la
  // agenda. Si se lee después, ya la pisamos y el buscador miraría el día nuevo.
  const antes = await getLead(leadId).catch(() => null);
  // El no-show se anota ANTES del update y no después: el patch pone
  // `asistio_jN = null` y hay UN solo par de campos por reunión, no un registro
  // por intento. Si no queda acá, el hecho de que no se presentó desaparece.
  if (opts.noShowPrevio) {
    const fechaVieja = cual === 'r2' ? antes?.fecha_junta_2 : antes?.fecha_junta_1;
    await logLeadEvent(
      leadId,
      cual === 'r2' ? 'Reunión 2 — no asistió' : 'Reunión 1 — no asistió',
      fechaVieja ? `No se presentó a la reunión del ${fmtDDMMYYYY(fechaVieja)} — se reagenda` : 'No se presentó — se reagenda',
      await autorActual(),
    ).catch(() => {});
  }
  const db = await getTenantDb();
  const patch = cual === 'r2'
    ? { fecha_junta_2: f, junta_2_at: at, asistio_j2: null }
    : { fecha_junta_1: f, junta_1_at: at, asistio_j1: null };
  const { error } = await db.from('leads').update(patch).eq('id', leadId);
  if (error) throw new Error(`No se pudo reagendar: ${error.message}`);
  // El historial se escribe en la zona del WORKSPACE, no en un 'America/Tijuana'
  // fijo: con el negocio en Uruguay, la línea decía 14:00 sobre una reunión de las
  // 19:00 y quien la leía después no tenía cómo saber que estaba corrida.
  const cuando = at
    ? new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short', timeZone: tzWs }).format(new Date(at))
    : f;
  const autor = await autorActual();
  await logLeadEvent(leadId, cual === 'r2' ? 'Reunión 2 reagendada' : 'Reunión 1 reagendada', cuando, autor).catch(() => {});

  // El calendario deja rastro SIEMPRE, salió bien o mal: si el invitado nunca se
  // enteró, el historial tiene que decir por qué. Es el pedido explícito del dueño.
  const cal = await moverEnCalendario(antes, cual, at, opts.duracionMin).catch((e): ReagendarResultado => ({
    ok: false, accion: 'nada', mensaje: e instanceof Error ? e.message : 'Error inesperado con Google Calendar.', reconectar: false, invitado: null,
  }));
  if (cal.mensaje) await logLeadEvent(leadId, 'Google Calendar', cal.ok ? cal.mensaje : `No se pudo mover el evento: ${cal.mensaje}`, autor).catch(() => {});

  bust(TAG.leads);
  revalidatePath('/crm');
  revalidatePath(`/crm/${leadId}`);
  revalidatePath('/general');
  return cal;
}

/**
 * Cuánto dura DE VERDAD esa reunión, en minutos, según el evento que ya está en la
 * agenda. Cae a DURACION_DEFECTO_MIN cuando no se puede saber.
 *
 * Lo pide el wizard de reagendar al ABRIRSE (no en el paso de la hora) para que la
 * consulta a Google no se sume a la espera de la grilla. Con ese número, los huecos
 * se calculan con la duración real en vez de 45' fijos: una R1 de 60' ya no se
 * ofrece a las 18:30 teniendo algo agendado a las 19:15.
 */
export async function duracionReunionAction(leadId: number, cual: 'r1' | 'r2'): Promise<number> {
  const lead = await getLead(leadId).catch(() => null);
  if (!lead) return DURACION_DEFECTO_MIN;
  const min = await duracionDeReunionEnAgendaMin({
    inicioAnteriorIso: cual === 'r2' ? lead.junta_2_at : lead.junta_1_at,
    fechaAnterior: cual === 'r2' ? lead.fecha_junta_2 : lead.fecha_junta_1,
    emailInvitado: lead.email,
    titulo: lead.nombre,
  }).catch(() => null);
  return min && min > 0 ? min : DURACION_DEFECTO_MIN;
}

/**
 * ¿La agenda conectada alcanza para mover reuniones? Lo consulta el modal de
 * reagendar al abrirse, para poder avisar ANTES —y no después de que el invitado
 * no se enteró— que el permiso quedó en solo lectura. Nunca lanza: en la duda
 * decimos que no se puede y ofrecemos reconectar.
 */
export async function permisoCalendarioAction(): Promise<{ conectado: boolean; puedeMover: boolean }> {
  try {
    const p = await permisoCalendarioGoogle();
    return { conectado: p.conectado, puedeMover: p.puedeMover };
  } catch {
    return { conectado: false, puedeMover: false };
  }
}

/** Guarda Closer / Setter / links de Fathom / motivo desde la ficha. */
export async function saveLeadMetaAction(id: number, meta: LeadMetaInput): Promise<void> {
  const before = await getLead(id).catch(() => null);
  await saveLeadMeta(id, meta);
  const after = await getLead(id).catch(() => null);
  await logLeadChanges(id, before, after, await autorActual());
  bust(TAG.leads);
  revalidatePath('/crm');
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
  revalidatePath('/crm');
  revalidatePath(`/crm/${id}`);
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

/** Notas de seguimiento MANUAL del lead (eventos 'Nota' del historial), con autor. */
export async function getLeadNotasAction(id: number): Promise<LeadAuditRowFull[]> {
  const rows = await getLeadAuditAction(id);
  return rows.filter((r) => r.campo === 'Nota');
}

/**
 * Agrega una nota de seguimiento manual al lead. Disponible en CUALQUIER etapa
 * (WhatsApp/llamada/lo que sea): queda con fecha y autor en el historial.
 */
export async function addLeadNoteAction(id: number, texto: string): Promise<void> {
  const t = texto.trim();
  if (!t) return;
  await logLeadEvent(id, 'Nota', t, await autorActual());
  bust(TAG.leads);
  revalidatePath(`/crm/${id}`);
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
  revalidatePath('/crm');
  revalidatePath(`/crm/${leadId}`);
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

  // 4) La MEMORIA del historial (`etapa_vista`) también vuelve atrás.
  //    Acá no pasamos por logLeadChanges (que la mueve solo) porque este camino
  //    escribe con setBoardStageOverride/updateLead, que no auditan. Sin esto, la
  //    columna quedaba apuntando a la etapa post-movimiento y la próxima pasada de
  //    registrarEtapasDerivadas (cada carga de /crm o /general) veía
  //    `vista !== etapa` y escribía "Etapa: <deshecha> → <restaurada>" firmada por
  //    MaKo: el deshacer reaparecía como un movimiento del sistema, justo lo que el
  //    borrado de abajo quiere evitar. Va también cuando el grupo NO traía fila
  //    'Etapa': revertir 'Asistió R1'/'Estado' cambia la etapa DERIVADA igual.
  //    Best-effort como el borrado de abajo: el revert ya se aplicó y no puede
  //    quedar a medias por esto (el peor caso vuelve a ser una línea de más).
  try {
    await alinearEtapaVista(await getLead(leadId).catch(() => null));
  } catch (e) {
    console.error('[revert] alinear etapa_vista falló:', e);
  }

  // El deshacer/restaurar NO deja un cambio nuevo: se borra el rastro de ESTE
  // movimiento del historial (un cambio deshecho no es historia — se restaura el
  // estado previo y la acción desaparece).
  try {
    const { error } = await (await getTenantDb()).from('lead_audit').delete().eq('lead_id', leadId).eq('created_at', createdAt);
    if (error) console.error('[revert] borrar rastro del historial falló:', error.message);
  } catch { /* si falla, el revert igual se aplicó */ }
  bust(TAG.leads, TAG.pagos);
  revalidatePath('/crm');
  revalidatePath(`/crm/${leadId}`);
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
  revalidatePath('/crm');
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
  revalidatePath('/crm');
  revalidatePath('/general');
}

/** Input del editor completo del lead (ruta /crm/[id]). */
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
 * Guarda TODO el editor del lead (ruta /crm/[id]) en una sola acción:
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
  revalidatePath('/crm');
  revalidatePath(`/crm/${id}`);
  revalidatePath('/general');
}

/** Persiste la config del funnel (pipeline de Activo + nutriciones suprimidas) desde la tab "Funnel". */
export async function saveFunnelAction(pipeline: Stage[], suppressed: string[]): Promise<void> {
  // El guard faltaba: cualquier miembro del workspace podía reescribir el funnel
  // entero —que decide requisitos, nutrición y qué audios se piden— invocando la
  // server action. Ya estaba anotado en docs/hallazgos-crm.md.
  if ((await getRolWsEfectivo()) !== 'admin') throw new Error('Solo el administrador del workspace puede editar el funnel.');
  await saveFunnel(pipeline, suppressed);
  bust(TAG.pipeline, TAG.leads);
  revalidatePath('/crm');
  revalidatePath('/funnel');
}

/**
 * Declara CÓMO ENTRA la gente a este negocio (y, si corresponde, dónde y cuándo
 * es su encuentro de fecha fija).
 *
 * Va separada de `saveFunnelAction` a propósito: el pipeline se autoguarda con un
 * debounce en cada tecla del editor, y esto se guarda cuando la persona confirma.
 * Mezclarlas haría que un tipeo cualquiera reescribiera una declaración.
 */
export async function declararEntradasAction(entradas: string[], evento: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  if ((await getRolWsEfectivo()) !== 'admin') return { ok: false, error: 'Solo el administrador del workspace puede declarar esto.' };
  // Se saneа con las MISMAS funciones que leen el jsonb: si el saneo de escritura
  // y el de lectura fueran dos, divergen y se guarda algo que después no se lee.
  const limpias = parseEntradas(entradas);
  if (!limpias.length) return { ok: false, error: 'Elegí al menos una forma en la que te llega la gente.' };
  const ev = parseEvento(evento);
  try {
    const actual = await getFunnel();
    await saveFunnel(actual.pipeline, actual.suppressed, { entradas: limpias, evento: ev });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  bust(TAG.pipeline, TAG.leads);
  revalidatePath('/funnel');
  revalidatePath('/chatbot');
  return { ok: true };
}


/**
 * El link de Calendly para agendar la R1/R2 de ESTE workspace.
 *
 * Existe porque hasta el 13/08/2026 esa URL era una constante en un módulo de
 * cliente (`app/crm/calendly-widget.ts`) con la agenda DEL DUEÑO adentro: el CRM
 * de cualquier clienta abría la página de Calendly de otra persona, y su
 * prospecto reservaba en el calendario ajeno. Un dato que depende de quién está
 * mirando no puede vivir en el bundle.
 *
 * Resuelve contra la cuenta de Calendly del workspace actual (`credWs` adentro de
 * `eventTypeDeReunion`), así que un workspace sin Calendly cargado recibe `null`
 * y el motivo — nunca la agenda de otro.
 */
export async function linkDeAgendaAction(which: 'agenda' | 'agendaj2'): Promise<{ url: string | null; motivo: string | null }> {
  try {
    const et = await eventTypeDeReunion(which === 'agenda' ? 'R1' : 'R2');
    const url = et.schedulingUrl?.trim() || null;
    return url
      ? { url, motivo: null }
      : { url: null, motivo: 'Ese event type de Calendly no tiene página pública de agenda.' };
  } catch (e) {
    return { url: null, motivo: e instanceof Error ? e.message : String(e) };
  }
}
