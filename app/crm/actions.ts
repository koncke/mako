'use server';

// =============================================================================
// Server actions para la UI de leads
// =============================================================================
// Convierten FormData (HTML forms) o input parseado a llamadas a lib/leads.ts
// y revalidan las páginas relevantes.
// =============================================================================

import { getVideosLanding, landingRecibioEventos } from '@/lib/landing-token';
import { urlSesionesDeLead, urlPanel, grabacionVigente } from '@/lib/clarity';
import { replayDeLead } from '@/lib/replay-leer';
import type { ReplayEnLaFicha } from '@/lib/replay-ficha';
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
import { listLeadsDeFunnel, contarLeadsDeFunnel,
  createLead,
  vendedorUnicoDelWorkspace,
  updateLead,
  deleteLead,
  setPipelineStage,
  setMeetingManual,
  setBoardStageOverride,
  saveLeadMeta,
  faltantesDeLead,
  getLead,
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
  moverLeadDeFunnel,
  enriquecerLead,
} from '@/lib/leads';
import { LeadDuplicadoError } from '@/lib/leads-duplicados';
// Los dos lectores del funnel, separados a propósito: el del NEGOCIO (columnas del
// board, catálogos de etapa) y el DEL LEAD (requisitos de un movimiento concreto).
import { getFunnelDefault, getFunnelDe, getPipelineStagesDefault, getPipelineStagesDeLead, saveFunnelDefault, saveFunnelDe, listarFunnels,
  renombrarFunnel, archivarFunnel, restaurarFunnel, listarFunnelsArchivados, eliminarFunnelDefinitivo,
  productosPorFunnel } from '@/lib/funnels';
import { type EntradaId, type EventoFunnel, generateFunnel, labelDeCatalogo,
  conTerminales, esTerminal, etapaDeGanado, problemasDePipeline, ETAPAS_SIN_SECUENCIA, MAX_LABEL_ETAPA, DEFAULT_STAGES, deriveStageKey, stageMeta, terminalEstadoFor, withLayout, MAKO_SETTER, type Stage, type StageBand, type StageDerivable } from '@/lib/pipeline';
import {
  CAMPOS_LEAD, COLUMNAS_POR_CAMPO, PREGUNTAS_FORM, SIN_ASIGNAR,
  alcanceLegible, esColumnaDerivada, filtrosLegibles, incluyeLegible, rangoDePeriodo,
  type CampoFechaLeads, type FiltrosLeads, type OrdenLeads,
} from './leads-exportar';
import { eventTypeDeReunion } from '@/lib/calendly-agenda';
import { leadsAMarkdown, type LeadDoc } from './leads-markdown';
import { MAX_FILAS_IMPORT, MAX_MONTO_IMPORT, MOTIVO_DECIDIBLE, destinoDe, entra, entraGanado, type FilaImport } from './leads-importar';
import { ORIGEN_LEAD, origenLista } from './origen-lead';
import { VIA_INLINE, esCampoInline, montoEnRiesgo, ponerLinkFathom, valorDeCampo, type ValorInline } from './campo-inline';
// Qué grabación es de la R2: la MISMA función que reparte los análisis entre los
// dos bloques de la ficha. Con una copia acá, el link caería en un bloque y su
// análisis en el otro.
import { etiquetaEsR2 } from '@/lib/insights-llamada-reparto';
import { marcarExistentes } from './importar-server';
import { stepsForStage, funnelReqInfo, type StageReqValues } from '@/lib/stage-requirements';
import { encuentroGrabable } from '@/lib/encuentro-ws';
import { parseEntradas, parseEvento, etapasVisibles, type EtapaVisible } from '@/lib/pipeline';
import { canalEfectivo, type CanalId } from '@/lib/fase-diagnostico';
import { getDiagnosticoFase } from '@/lib/fase-store';
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
import { getTenantDb, getWorkspaceActual, getRolWsEfectivo, rutaConWs } from '@/lib/workspace';

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
import { crearProductoConFunnel } from '@/lib/producto-con-funnel';
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
  /** Link a las grabaciones de ESTA persona en Clarity, o null. Se resuelve en el
   *  server porque necesita la credencial del workspace, que el cliente no ve. */
  urlClarity: string | null;
  /** El mapa de calor de la página, que es del PROYECTO y no de este lead. */
  urlMapaCalor: string | null;
  /** Existió pero Clarity ya la borró. Distinto de «nunca hubo». */
  grabacionVencida: boolean;
  /** Las grabaciones PROPIAS (rrweb) de esta persona, o POR QUÉ no hay ninguna.
   *  Se resuelve en el server: necesita el apagador del workspace y el índice
   *  scopeado por cliente, que el navegador no puede leer. */
  replay: ReplayEnLaFicha;
  campana: { texto: string | null; tooltip: string | null };
  adNombre: string | null;
  /** ad_id resuelto (meta_ad_id, utm_content numérico o por nombre) para el deep-link. */
  adId: string | null;
  visitas: { total_visitas: number; dias_distintos: number };
  insights: LeadInsightRow[];
  tracking: TrackingEvent[];
  /** El Pixel de MaKo está midiendo. Gobierna el vacío de la tarjeta de tracking. */
  pixelPuesto: boolean;
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
  const [vslEng, pagos, campMap, adMap, stagesRaw, visitasMap, insights, tracking, videos, urlClarity, urlMapaCalor, pixelPuesto] = await Promise.all([
    getVslEngagement(lead.visitor_id).catch(() => ({ plays: 0, max_pct: null, sin_datos: true, porVideo: [] }) as VslEngagement),
    getPagosByLead(lead.id).catch(() => [] as Pago[]),
    getCampaignNameMap().catch(() => ({}) as Record<string, string>),
    getAdNameMap().catch(() => ({}) as Record<string, string>),
    // DEL LEAD: la ficha pinta los requisitos de SU recorrido.
    getPipelineStagesDeLead(lead).catch(() => DEFAULT_STAGES),
    getVisitasLandingMap([lead.visitor_id]).catch(() => new Map() as VisitasMap),
    getLeadInsights(id),
    getTrackingEvents(lead.visitor_id),
    getVideosLanding(),
    urlSesionesDeLead(lead.visitor_id).catch(() => null),
    // Del PROYECTO: Clarity agrega los clics de todos y no se filtra por persona.
    urlPanel(undefined, 'heatmaps').catch(() => null),
  // ¿El Pixel de MaKo está midiendo? Es para el VACÍO de la tarjeta de tracking:
  // sin código pegado, «sin eventos» no es un lead que no interactuó, es un negocio
  // que todavía no mide — y eso se arregla en otra pantalla. Misma señal que el
  // semáforo de /integraciones (1 fila con LIMIT 1 sobre un índice) para que las dos
  // pantallas no puedan contradecirse. Nunca rompe la ficha.
    landingRecibioEventos().catch(() => true),
  ]);

  // ⚠️ EL LINK A LA GRABACIÓN SE GATEA POR LA RETENCIÓN, no por «tiene
  // identificador». Clarity borra a los 30 días: sobre un lead más viejo, el
  // botón abre su panel sin nada y se lee como que la medición no funciona.
  // Se mira la ÚLTIMA actividad —no el alta— porque alguien de marzo que volvió
  // ayer sí tiene grabación.
  const ultimaActividad = tracking.length
    ? tracking.map((e) => e.ts).sort().at(-1) ?? null
    : lead.created_at;
  const grabacionVigente_ = grabacionVigente(ultimaActividad);
  const urlClarityVigente = grabacionVigente_ ? urlClarity : null;
  const grabacionVencida = !!urlClarity && !grabacionVigente_;
  // La grabación propia va DESPUÉS de `ultimaActividad`, que es el mismo dato con el
  // que se gatea el link de Clarity: así las dos tarjetas de la misma pantalla no
  // pueden contradecirse sobre cuándo fue la última vez que esta persona entró.
  // Nunca rompe la ficha: `replayDeLead` no tira y distingue «no pude leer».
  const [respuestas, insightGen, equipo, grabable, replay] = await Promise.all([getLeadRespuestas(lead), getUltimoInsightGenerado(id), getEquipoAction(), encuentroGrabable(), replayDeLead(lead.visitor_id, ultimaActividad)]);
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
  return { lead, stages, pagos, vslEng, videos, urlClarity: urlClarityVigente, urlMapaCalor, grabacionVencida, replay, campana, adNombre, adId: adIdCand, visitas, insights, tracking, pixelPuesto, respuestas, insightGen, faltantesInsight, faltantes, equipo, closerDetectado };
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
  // DEL LEAD: qué pide la etapa para ÉL. Sin lead legible cae al del negocio, que es
  // lo mismo que hacía antes — estas preguntas no deciden permisos.
  const [stagesMove, grabable] = await Promise.all([
    (before ? getPipelineStagesDeLead(before) : getPipelineStagesDefault()).catch(() => DEFAULT_STAGES),
    encuentroGrabable(),
  ]);
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
  | { ok: true; pendientes?: Step[] }
  | { ok: false; faltan: Step[]; mensaje: string };

/**
 * GUARDAR NUNCA SE BLOQUEA POR DATOS QUE FALTAN (decisión del 17/09, 08-T22).
 *
 * Hasta acá mover a una etapa exigía todos sus datos en el momento («ninguna
 * blanda», 21/06 y 03/07): si faltaba uno, el movimiento no ocurría. El resultado
 * medido fue el contrario al buscado. Mauricio, 08/09: «me pregunta un chorro de
 * cosas… quiero nomás cambiar este… lo abandono porque no tengo tiempo de
 * contestarlo», y actualizaba el CRM una vez por semana. La regla existía sobre
 * todo por Meta, y a Meta le llegaban los datos una semana tarde — o nunca.
 *
 * Ahora el movimiento se guarda siempre, y lo que falta vuelve como `pendientes`:
 * la UI lo muestra sin bloquear, queda en la ficha como dato por completar y
 * MaKo lo pide después, fuera del momento en que la persona está operando. Faltar
 * datos sigue sin ser un error; ahora tampoco es un freno.
 *
 * Deja una línea en el historial para que se sepa que se guardó incompleto a
 * propósito y quién lo hizo — no es lo mismo que un dato que nadie vio.
 */
async function registrarPendientes(id: number, faltan: Step[], autor: string): Promise<void> {
  if (!faltan.length) return;
  const valor = faltan.map((f) => f.label).join(' · ');
  try {
    // Sin duplicar: abrir «Completar ahora» y guardar sin contestar nada volvería
    // a escribir la misma lista. Si lo pendiente no cambió, no hay nada que contar.
    const { data } = await (await getTenantDb()).from('lead_audit')
      .select('valor_nuevo').eq('lead_id', id).eq('campo', 'Datos pendientes')
      .order('created_at', { ascending: false }).limit(1);
    if (data?.[0]?.valor_nuevo === valor) return;
  } catch { /* sin poder comparar, se registra: mejor una línea de más que ninguna */ }
  await logLeadEvent(id, 'Datos pendientes', valor, autor).catch(() => {});
}

/**
 * Completa un movimiento de etapa (wizard del Kanban/ficha): guarda los datos
 * aportados y mueve, en una sola acción. Valida los requisitos ACUMULATIVOS
 * server-side (fuente única: `valoresDeRequisitos` + lib/stage-requirements).
 */
export async function completeStageMoveAction(id: number, to: string, d: StageMoveData): Promise<StageMoveResultado> {
  const before = await getLead(id).catch(() => null);
  // DEL LEAD: el wizard arma las preguntas del recorrido de ESE lead.
  const [stagesMove, grabable] = await Promise.all([
    (before ? getPipelineStagesDeLead(before) : getPipelineStagesDefault()).catch(() => DEFAULT_STAGES),
    encuentroGrabable(),
  ]);
  // Ya no se corta acá si falta algo (ver registrarPendientes): se guarda lo que
  // vino y los pendientes se calculan al final, sobre el lead YA guardado — así
  // no se reclama lo que este mismo guardado completó (el setter que se asigna
  // solo, las cuotas recién cargadas).

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
  //    calificado=true manda SubmitApplication + QualifiedLead a Meta, con o sin
  //    reunión; la asistencia sola no le manda nada).
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
  // Lo que todavía falta, medido sobre el lead guardado.
  const pagosDespues = to === 'ganado' ? await getPagosByLead(id).catch(() => []) : [];
  const pendientes = after ? stepsForStage(to, valoresDeRequisitos(to, after, pagosDespues, stagesMove, {}, grabable)) : [];
  await registrarPendientes(id, pendientes, autor);
  bust(TAG.leads, TAG.pagos);
  revalidatePath('/crm');
  revalidatePath(`/crm/${id}`);
  revalidatePath('/general');
  return { ok: true, pendientes };
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
/**
 * El alta en sí: valida, crea y deja el hilo de WhatsApp listo. Devuelve el id.
 *
 * ⚠️ NO REDIRIGE, y por eso existe separada. El alta entra por dos puertas —la
 * ruta /crm/new, que navega a la ficha nueva, y el modal del tablero, que se cierra
 * y la abre en su lugar— y la única diferencia entre las dos es a dónde se va
 * después. Con el `redirect` adentro, la segunda puerta no se podía escribir sin
 * copiar la validación, que es cómo se desincronizan las dos.
 */
async function altaDeLead(formData: FormData, funnelId?: number | null, permitirDuplicado?: boolean): Promise<{ id: number }> {
  const nombre = emptyToNull(formData.get('nombre'));
  if (!nombre) {
    throw new Error('Nombre es requerido');
  }
  // Un lead sin email NI teléfono es incontactable: el dato es posible de
  // conseguir al momento de crearlo, así que se exige al menos uno.
  if (!emptyToNull(formData.get('email')) && !emptyToNull(formData.get('telefono'))) {
    throw new Error('Carga al menos un email o un teléfono: sin eso el lead es incontactable.');
  }
  const created = await createLead({
    nombre,
    email: emptyToNullable(formData.get('email')),
    telefono: emptyToNullable(formData.get('telefono')),
    empresa: emptyToNullable(formData.get('empresa')),
    fecha_agenda: emptyToNullable(formData.get('fecha_agenda')),
    fecha_junta_1: emptyToNullable(formData.get('fecha_junta_1')),
    // ⚠️ El lead nace en el tablero DESDE EL QUE SE LO CREÓ. Sin esto se iba al funnel
    // del negocio y desaparecía de la pantalla donde se acababa de cargar.
    funnel_id: funnelId ?? null,
    // El «Crear igual» de la pantalla de duplicados. Nunca es el default: lo pide una
    // persona que ya vio con quién choca.
    permitirDuplicado,
    // ⚠️ DE DÓNDE VINO: alguien lo tipeó. Es el único camino que lo puede afirmar —
    // nadie dejó sus datos en ningún lado— y sin esto el lead nacía con la columna en
    // NULL, indistinguible de uno que llenó un formulario de la landing. Lo usan la
    // tarjeta del tablero, el filtro de origen y la ficha.
    origen_lead: ORIGEN_LEAD.carga_manual.id,
  });
  // Alta del chat: contacto + conversación en Chatwoot (silencioso) para que
  // todo lead con teléfono tenga su hilo de WhatsApp desde el día cero.
  if (created.telefono) await ensureContactoWhatsapp(created.nombre, created.telefono);
  // (setter/closer se auto-asignan dentro de createLead si hay un único vendedor.)
  bust(TAG.leads);
  revalidatePath('/crm');
  return { id: created.id };
}

/**
 * Alta desde el MODAL del tablero: crea y devuelve el id, sin navegar.
 *
 * Devuelve el error en vez de tirarlo porque el que llama es un modal abierto
 * encima del tablero: una excepción ahí sube al error boundary y se lleva puesta la
 * pantalla entera, con los filtros y el scroll que este cambio vino a preservar.
 */
/**
 * Un producto nuevo con su tablero, sin salir del CRM.
 *
 * Devuelve el error en vez de tirarlo: el que llama es un modal abierto encima del
 * tablero, y una excepción ahí sube al error boundary y se lleva la pantalla entera.
 */
/**
 * ⚠️ RECIBE EL CANAL, y es lo que hace que el tablero nuevo sea DISTINTO del de al lado.
 * Sin él, el funnel nacía sin etapas y caía a la plantilla genérica — que en un workspace
 * que nunca tocó su funnel es idéntica a la del negocio.
 */
export async function crearProductoAction(nombre: string, canal?: string | null): Promise<{ funnelId: number } | { error: string }> {
  try {
    const { funnelId } = await crearProductoConFunnel(nombre, canal);
    bust(TAG.leads);
    revalidatePath('/crm');
    revalidatePath('/funnel');
    return { funnelId };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'No se pudo crear el producto.' };
  }
}

/**
 * Lo que la pantalla necesita para OFRECER algo cuando el lead ya existe.
 *
 * ⚠️ NO ES UN STRING. Antes esta action devolvía `{ error }` pelado, así que las
 * coincidencias —que `LeadDuplicadoError` trae adentro justamente para esto— se tiraban
 * en el `catch` y la pantalla sólo podía mostrar una frase. Sin los ids no hay forma de
 * ofrecer «abre el que ya tienes» ni «muévelo a este producto», que es lo que pidió
 * Martín: «que le advierta que el lead ya existe y que le pregunte si lo quiere traer».
 */
export type ChoqueDeLead = {
  error: string;
  /** Con quién choca. Vacío = el error no es un duplicado. */
  coincidencias: Array<{ id: number; nombre: string; funnelId: number | null; producto: string | null; motivo: string }>;
};

/** Un lead de otro producto, como lo dibuja la tabla de «traer». */
export type LeadParaTraer = {
  id: number;
  nombre: string;
  email: string | null;
  telefono: string | null;
  empresa: string | null;
  /** La etapa donde está HOY, ya resuelta a su nombre. */
  etapa: string;
  /** La clave de esa etapa, para poder filtrar sin comparar textos. */
  etapaKey: string;
  creado: string | null;
};

/**
 * Los leads de UN producto, para elegir cuáles traer a otro.
 *
 * Pedido de Martín (30/09/2026): «al seleccionar traer de otro producto, se seleccione de
 * qué otro producto y aparezcan todas las columnas, los filtros, la barra de búsqueda. Y
 * que se pueda hacer selección múltiple».
 *
 * ⚠️ LA ETAPA SE RESUELVE ACÁ, EN EL SERVER, y no en el navegador. Derivarla exige el
 * pipeline de ESE embudo (no el del que se está mirando) más el switch de
 * `deriveStageKey` sobre ocho columnas del lead; mandarlas todas al navegador para que las
 * derive sería bajar la mitad de la tabla `leads` para pintar una columna de texto.
 *
 * ⚠️ Y SE PAGINA CON `leerTodo`: un producto con 1.146 leads —el ws1 tiene exactamente eso—
 * toca el techo de 1.000 filas de PostgREST y devolvería 1.000 redondo, que es un número
 * plausible. Acá el tope es de la PANTALLA y se dice cuántos quedaron afuera.
 */
export async function leadsDeProductoAction(funnelId: number | null): Promise<{ filas: LeadParaTraer[]; total: number }> {
  try {
    const [leads, cfg] = await Promise.all([
      listLeadsDeFunnel(funnelId),
      funnelId != null ? getFunnelDe(funnelId) : getFunnelDefault(),
    ]);
    const stages = cfg.origen === 'error' ? DEFAULT_STAGES : cfg.stages;
    const filas = leads.map((l) => {
      // El override manual gana sobre lo derivado, igual que en el tablero — pero sólo si
      // ESTE embudo tiene esa etapa: una clave de otro embudo se dibujaría como una
      // columna que no existe.
      const override = l.pipeline_stage && stages.some((st) => st.key === l.pipeline_stage) ? l.pipeline_stage : null;
      const key = override ?? deriveStageKey(l as unknown as StageDerivable);
      const meta = stages.length ? stageMeta(stages, key) : null;
      return {
        id: l.id,
        nombre: (l.nombre ?? '').trim() || 'Sin nombre',
        email: l.email ?? null,
        telefono: l.telefono ?? null,
        empresa: l.empresa ?? null,
        etapa: meta?.label ?? key,
        etapaKey: key,
        creado: l.created_at ?? null,
      };
    });
    return { filas, total: filas.length };
  } catch (e) {
    console.error('[leadsDeProducto]', e instanceof Error ? e.message : e);
    return { filas: [], total: 0 };
  }
}
/**
 * Traduce un fallo del alta a lo que la pantalla puede OFRECER.
 *
 * Vive acá y no en `lib/leads` porque resolver el nombre del producto es una lectura del
 * workspace y el módulo de duplicados es puro a propósito. Y vive en UNA función porque
 * la usan los DOS caminos de alta —el tablero y la conversación de WhatsApp—: con una
 * copia por camino, el día que cambie cómo se nombra un embudo lo arregla uno solo.
 */
async function choqueDeLead(e: unknown): Promise<ChoqueDeLead> {
  if (!(e instanceof LeadDuplicadoError)) {
    return { error: e instanceof Error ? e.message : 'No se pudo crear el lead.', coincidencias: [] };
  }
  // El nombre del producto se resuelve ACÁ y no en `lib/leads`: la lista de embudos
  // es una lectura del workspace y el módulo de duplicados es puro a propósito.
  const funnels = await listarFunnels().catch(() => []);
  const porId = new Map(funnels.map((f) => [f.id, f.nombre]));
  // ⚠️ `null` ES EL EMBUDO DEL NEGOCIO, no «sin producto». Medido: `leads.funnel_id`
  // está en NULL en las 1.530 filas de producción, así que éste es el caso NORMAL y
  // no el raro. Se resuelve al `es_default`, que es donde el tablero los dibuja.
  const delNegocio = funnels.find((f) => f.esDefault) ?? null;
  const nombreDe = (fid: number | null) => (fid == null ? delNegocio?.nombre ?? null : porId.get(fid) ?? null);
  return {
    error: e.message,
    coincidencias: e.coincidencias.map((c) => ({
      id: c.lead.id,
      nombre: (c.lead.nombre ?? '').trim() || 'Sin nombre',
      funnelId: c.lead.funnel_id ?? null,
      producto: nombreDe(c.lead.funnel_id ?? null),
      motivo: c.texto,
    })),
  };
}

export async function crearLeadEnTableroAction(formData: FormData, funnelId?: number | null, permitirDuplicado?: boolean): Promise<{ id: number } | ChoqueDeLead> {
  try {
    return await altaDeLead(formData, funnelId, permitirDuplicado);
  } catch (e) {
    return await choqueDeLead(e);
  }
}

/**
 * Mueve un lead que ya existe al producto que se está mirando.
 *
 * Es la salida del pedido de Martín: «si se detecta que se está agregando un lead nuevo,
 * pero que ya está en otro funnel… que le pregunte si lo quiere traer».
 *
 * ⚠️ MUEVE, NO COPIA — y el botón tiene que decirlo con esa palabra. Hoy el producto de
 * un lead es UNA columna (`leads.funnel_id`), así que la persona no puede estar en dos
 * tableros a la vez: traerla acá es sacarla de allá, con su recorrido entero (etapa,
 * fechas de reunión, montos). Copiarla exigiría que el RECORRIDO sea una entidad aparte
 * de la PERSONA, que es la tabla que todavía no existe. Decir «traer» sobre un movimiento
 * destructivo es la clase de promesa que se descubre cuando ya no se puede deshacer.
 */
/**
 * Mover VARIOS leads a un producto, de una.
 *
 * Es el «importar leads de otro producto» del pedido 8: traer diez de a uno es la
 * fricción que el pop-up de importar vino a sacar.
 *
 * ⚠️ NO ES ATÓMICO Y LO DICE: devuelve cuántos entraron y cuántos no. Envolverlo en una
 * transacción exigiría una función en la base; contar y reportar cuesta una línea y no
 * miente. Lo que NO puede pasar es devolver «listo» sobre diez cuando entraron seis.
 */
export async function moverLeadsAFunnelAction(ids: number[], funnelId: number | null): Promise<{ movidos: number; fallaron: number }> {
  let movidos = 0;
  let fallaron = 0;
  const cfg = funnelId != null ? await getFunnelDe(funnelId) : await getFunnelDefault();
  const entrada = cfg.stages.find((st) => st.kind === 'entrada') ?? cfg.stages[0];
  for (const id of ids) {
    try {
      await moverLeadDeFunnel(id, funnelId);
      // La etapa se escribe aparte y su fallo NO cuenta como fallo del movimiento: el
      // lead YA cambió de producto, y decir que no se movió mandaría a hacerlo otra vez.
      if (entrada) await setPipelineStage(id, entrada.key).catch(() => {});
      movidos += 1;
    } catch {
      fallaron += 1;
    }
  }
  bust(TAG.leads);
  revalidatePath('/crm');
  return { movidos, fallaron };
}
export async function moverLeadAFunnelAction(leadId: number, funnelId: number | null): Promise<{ ok: true } | { error: string }> {
  try {
    await moverLeadDeFunnel(leadId, funnelId);
    // ⚠️ Y ENTRA POR LA PUERTA, no con la etapa que traía. Es literal del pedido («que lo
    // cargue automáticamente como lead entrante») y además es lo único que no miente: la
    // etapa de un embudo es una CLAVE suya, y la del embudo A puede no existir en el B.
    // Sin esto el lead cae en una columna que su nuevo tablero no tiene y se dibuja como
    // «fuera del embudo» — un lead recién traído que aparece roto.
    const cfg = funnelId != null ? await getFunnelDe(funnelId) : await getFunnelDefault();
    const entrada = cfg.stages.find((st) => st.kind === 'entrada') ?? cfg.stages[0];
    // Si el embudo no declara entrada NO se inventa una: mover es el hecho, la etapa es
    // una comodidad, y escribir una clave al azar sería peor que dejarlo donde cayó.
    if (entrada) await setPipelineStage(leadId, entrada.key);
    bust(TAG.leads);
    revalidatePath('/crm');
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'No se pudo mover el lead.' };
  }
}

export async function createLeadAction(formData: FormData): Promise<void> {
  const created = await altaDeLead(formData);
  // El barrido de redirects buscaba `redirect('/…')` con comilla simple y este se le
  // escapó por ser un template literal. Misma regla: la navegación lleva la pestaña.
  redirect(await rutaConWs(`/crm/${created.id}`));
}

/**
 * Crea un lead desde una conversación de WhatsApp (plan #381): el contacto no
 * estaba en el CRM. Usa la MISMA vía que el alta manual (createLead) + asegura el
 * contacto en Chatwoot. Devuelve el id para abrir la ficha en el acto. La
 * conversación se enlaza sola al lead por teléfono en la próxima carga.
 *
 * ⚠️ DEVUELVE EL CHOQUE, NO LO TIRA. Un `throw` de una server action llega al navegador
 * como un mensaje genérico —Next redacta el error en producción—, así que los ids que
 * `LeadDuplicadoError` trae adentro justamente para poder ofrecer «abre el que ya tienes»
 * se perdían en el camino y lo único que la pantalla podía hacer era un cartel. Es el
 * mismo contrato que el alta del tablero (`ChoqueDeLead`), que ya lo resolvió así.
 */
export async function crearLeadDesdeWhatsappAction(nombre: string, telefono: string): Promise<{ id: number } | ChoqueDeLead> {
  const n = (nombre ?? '').trim();
  const t = (telefono ?? '').trim();
  if (!n) return { error: 'Falta el nombre del contacto.', coincidencias: [] };
  if (!t) return { error: 'Falta el teléfono del contacto.', coincidencias: [] };
  // De dónde vino: de una conversación del inbox, o sea que ya hay un hilo abierto
  // con esta persona. No dice QUIÉN escribió primero —desde acá no se puede saber, y
  // un dato que se afirma sin medirlo es peor que la columna vacía—: dice por qué
  // puerta entró, que es lo que separa a este lead de los 1.000 de una lista en frío.
  try {
    const created = await createLead({ nombre: n, telefono: t, origen_lead: ORIGEN_LEAD.chat_whatsapp.id });
    if (created.telefono) await ensureContactoWhatsapp(created.nombre, created.telefono).catch(() => {});
    bust(TAG.leads);
    revalidatePath('/crm');
    revalidatePath('/whatsapp');
    return { id: created.id };
  } catch (e) {
    return await choqueDeLead(e);
  }
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
  redirect(await rutaConWs('/crm'));
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
  opts?: {
    monto?: number | null; motivo?: string | null;
    asistio_j1?: boolean | null; asistio_j2?: boolean | null;
    /** Uno de los dos toques opcionales que se ofrecen al mover (ver setPipelineStage). */
    calificado?: boolean | null;
  },
): Promise<StageMoveResultado> {
  const before = await getLead(id).catch(() => null);
  // Mover se guarda SIEMPRE (ver registrarPendientes). Lo que la etapa pide y
  // falta se mide igual —con el MISMO builder que el wizard, no una copia— y
  // vuelve como `pendientes` para que la UI lo muestre sin frenar a nadie.
  // DEL LEAD: lo que la etapa le pide a ÉL es lo que vuelve como `pendientes`.
  const [stagesMove, grabable] = await Promise.all([
    (before ? getPipelineStagesDeLead(before) : getPipelineStagesDefault()).catch(() => DEFAULT_STAGES),
    encuentroGrabable(),
  ]);
  const autor = await autorActual();
  await setPipelineStage(id, stageKey, { ...opts, autor });
  const after = await getLead(id).catch(() => null);
  await logLeadChanges(id, before, after, autor);
  const pagosDespues = stageKey === 'ganado' ? await getPagosByLead(id).catch(() => []) : [];
  const pendientes = after ? stepsForStage(stageKey, valoresDeRequisitos(stageKey, after, pagosDespues, stagesMove, {}, grabable)) : [];
  await registrarPendientes(id, pendientes, autor);
  bust(TAG.leads, TAG.pagos);
  revalidatePath('/crm');
  revalidatePath('/general');
  return { ok: true, pendientes };
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
  /**
   * PISAR lo que ya tiene valor. Por defecto NO, que es lo que el worklist de higiene
   * necesita: ahi los leads los eligio un filtro («a estos les falta el Setter»), asi que
   * sobrescribir seria cambiar un dato que nadie miro.
   *
   * La barra de seleccion es el caso OPUESTO y por eso existe este parametro: ahi los
   * leads los tildo una persona de a uno, mirandolos. Con el default puesto, asignarle un
   * Closer a doce leads que ya tienen otro no escribe NADA y contesta «0 actualizados» —
   * un control que no puede hacer nada se lee como que la app esta rota, y encima el cero
   * es plausible.
   *
   * ⚠️ Quien lo pasa en `true` tiene que DECIR cuantos va a pisar antes de hacerlo: el
   * dato viejo no vuelve solo, y el historial es el unico lugar donde queda.
   */
  pisar = false,
): Promise<{ updated: number }> {
  const v = value.trim();
  if (!v) throw new Error('Pon un valor para asignar.');
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
      // Con `pisar` no va el `.or(...)`: se escribe sobre los doce que la persona tildo.
      // Sin el, el UPDATE re-chequea que el campo este vacio en la MISMA sentencia, asi que
      // no hay ventana entre el read y el write.
      const q = db.from('leads').update(patch).in('id', chunk);
      const { data: upd, error: updErr } = await (pisar ? q : q.or(`${field}.is.null,${field}.eq.`)).select('id');
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
 * El techo de una accion en lote. No es una restriccion del motor: es el tamano a partir
 * del cual «lo hice» deja de ser una respuesta util y lo que hace falta es un filtro.
 *
 * ⚠️ NO SE EXPORTA, y no es una preferencia de estilo: en un archivo `use server` SOLO se
 * pueden exportar funciones async. Un `export const` tipa perfecto, pasa el typecheck y
 * TIRA EL BUILD entero con «Only async functions are allowed to be exported in a use
 * server file» — 125 errores que nombran a media app y a ningun archivo culpable. Ya se
 * pago una vez (05/10/2026, deploy en Error con produccion sirviendo la version vieja).
 */
const TOPE_LOTE = 200;

/**
 * Mueve VARIOS leads a una etapa.
 *
 * ⚠️ LLAMA AL MISMO `setLeadStageAction` DE A UNO, y es a proposito: ese es el unico camino
 * que escribe la etapa, el historial, los pendientes y lo que la etapa dispare. Un UPDATE
 * masivo seria la segunda implementacion de «mover de etapa» —mas rapida y sin historial,
 * sin pendientes y sin automatismos—, que es exactamente como divergen dos escrituras del
 * mismo dato en este repo.
 *
 * ⚠️ Y NO BLOQUEA, igual que el camino de a uno: mover se guarda SIEMPRE y lo que la etapa
 * pide y falta vuelve como pendiente (decision del 17/09/2026). Por eso el resultado
 * distingue TRES numeros y no uno: cuantos se movieron, a cuantos de esos les falta algo, y
 * cuantos fallaron. Con un solo «N movidos», un lote entero que quedo a medias se lee como
 * un exito.
 */
export async function moverLeadsDeEtapaAction(
  leadIds: number[],
  stageKey: string,
): Promise<{ movidos: number; conPendientes: number; fallaron: number }> {
  const ids = [...new Set(leadIds)].filter((n) => Number.isInteger(n) && n > 0).slice(0, TOPE_LOTE);
  let movidos = 0, conPendientes = 0, fallaron = 0;
  // SECUENCIAL: cada vuelta son ~6 consultas y un `revalidatePath`. En paralelo no se gana
  // nada util y se multiplica la chance de que un lote quede a medias sin poder decir donde.
  for (const id of ids) {
    try {
      const r = await setLeadStageAction(id, stageKey);
      // ⚠️ `StageMoveResultado` ES UNA UNION, y la rama `ok: false` NO movio el lead.
      // Contarla como movida seria exactamente el «N movidos» mentiroso que esta action
      // existe para evitar: el numero se leeria como exito sobre un lote a medias.
      if (!r.ok) { fallaron += 1; continue; }
      movidos += 1;
      if (r.pendientes?.length) conPendientes += 1;
    } catch (e) {
      fallaron += 1;
      console.error(`[lote] no se pudo mover el lead ${id} a ${stageKey}:`, e instanceof Error ? e.message : e);
    }
  }
  return { movidos, conPendientes, fallaron };
}

/**
 * Borra VARIOS leads. Irreversible: quien la llama PREGUNTA antes, nombrando el numero.
 *
 * Mismo criterio que la de arriba: `deleteLead` de a uno, que es el que se lleva por delante
 * lo que cuelga del lead (pagos, historial, pendientes). Un `delete ... in (...)` dejaria
 * huerfano todo eso.
 */
export async function eliminarLeadsAction(leadIds: number[]): Promise<{ borrados: number; fallaron: number }> {
  const ids = [...new Set(leadIds)].filter((n) => Number.isInteger(n) && n > 0).slice(0, TOPE_LOTE);
  let borrados = 0, fallaron = 0;
  for (const id of ids) {
    try { await deleteLead(id); borrados += 1; }
    catch (e) { fallaron += 1; console.error(`[lote] no se pudo borrar el lead ${id}:`, e instanceof Error ? e.message : e); }
  }
  bust(TAG.leads, TAG.pagos);
  revalidatePath('/crm');
  revalidatePath('/general');
  return { borrados, fallaron };
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

/**
 * Origen a nivel CAMPAÑA: es el corte con el que se piensa "de dónde vino esta gente".
 *
 * ⚠️ EL FALLBACK DEVOLVÍA EL ID CRUDO (`return o ?? 'Directo / orgánico'`), así que
 * cualquier valor sin su renglón se le escapaba a la pantalla con su nombre interno.
 * Con las tres altas estampando desde el 03/10/2026 eso habría puesto «carga_manual»
 * y «chat_whatsapp» en el export, que es justo lo que la casa prohíbe: el nombre
 * interno de una cosa no es el nombre de la cosa. Ahora el rótulo sale del catálogo,
 * que es el único lugar donde viven los valores posibles.
 */
function origenDeFila(l: FilaLead): string {
  const camp = sTxt(l.meta_campaign_name) ?? sTxt(l.utm_campaign);
  if (camp) return camp;
  return origenLista(sTxt(l.origen_lead));
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
  // MIXTO: el ORDEN de las columnas es del negocio y la ETIQUETA es de cada lead.
  // Queda en el del negocio, que es lo que hace hoy; con dos funnels hay que
  // resolver `stageMeta` por lead o el export rotula con la etiqueta del otro.
  const stagesRaw = await getPipelineStagesDefault().catch(() => DEFAULT_STAGES);
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
  // DEFAULT: el wizard de export ofrece el catálogo de etapas del negocio.
  const stagesRaw = await getPipelineStagesDefault().catch(() => DEFAULT_STAGES);
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
export type ImportLeadsResult = {
  creados: number;
  /**
   * Fichas que ya existían y a las que se les COMPLETÓ algún campo vacío (#623).
   *
   * Es un campo aparte y no parte de `creados`: «3 leads nuevos» sobre una importación
   * que no creó ninguno es la clase de número correcto sobre la pregunta equivocada que
   * esta pantalla ya pagó una vez.
   */
  enriquecidos: number;
  /**
   * De los `creados`, cuántos entraron como VENTA en vez de en la primera etapa (#622).
   *
   * ⚠️ Está DENTRO de `creados` y no al lado: son los mismos leads, creados por el mismo
   * camino y después movidos de etapa. Sumarlo aparte diría «5 nuevos y 3 ganados» sobre
   * una importación de 5 filas.
   */
  ganados: number;
  omitidos: number;
  errores: string[];
};

/** Crea los leads de las filas ya revisadas y tildadas por el usuario. */
/**
 * ⚠️ RECIBE EL FUNNEL, y hasta el 30/09/2026 no lo recibía: **todo lo importado desde un
 * producto secundario nacía en el embudo del negocio y desaparecía de la pantalla donde se
 * lo acababa de importar**. Es el mismo bug que el alta manual ya tenía arreglado
 * (`altaDeLead` lo pasa desde el 28/09) por el otro camino, y nadie lo cruzó: `createLead`
 * escribe `funnel_id` y `listLeadsDeFunnel` filtra estricto, así que la fila entraba bien y
 * el tablero la buscaba en otro lado. Sin error y sin una fila perdida — el peor final
 * posible para una importación de 200 contactos.
 *
 * ⚠️ Y ES OPCIONAL porque uno de los tres llamadores NO TIENE producto a la vista: la
 * pantalla que confirma lo que propuso un canal (`/crm/revisar`) no sabe a qué tablero van,
 * y ahí `undefined` significa «el del negocio», que es donde caían todos hasta hoy.
 */
export async function importarLeadsRevisadosAction(filas: FilaImport[], funnelId?: number | null): Promise<ImportLeadsResult> {
  if (!Array.isArray(filas) || !filas.length) return { creados: 0, enriquecidos: 0, ganados: 0, omitidos: 0, errores: ['No llegó ninguna fila.'] };
  if (filas.length > MAX_FILAS_IMPORT) {
    return { creados: 0, enriquecidos: 0, ganados: 0, omitidos: 0, errores: [`Son ${filas.length} filas y el tope por importación es ${MAX_FILAS_IMPORT}. Parte el archivo en dos.`] };
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
    // El id NO se copia del cliente: lo resuelve `marcarExistentes` contra la base de
    // ahora. Es el id al que se le ESCRIBE si la persona eligió completar, así que un
    // id que viaja en el payload es un id que cualquiera puede cambiar.
    leadExistenteId: null,
    enriquecer: f?.enriquecer === true,
    // La propuesta de entrar como venta (#622). `pagoEnArchivo` es el GATE —lo manda el
    // cliente, así que no autoriza nada por sí solo, pero frena la fila que llega
    // marcada como venta sin que el archivo lo dijera— y `comoGanado` es la decisión.
    pagoEnArchivo: f?.pagoEnArchivo === true,
    comoGanado: f?.comoGanado === true,
    // ⚠️ EL MONTO SE ACOTA ACÁ, y no es paranoia de tipos: esto se escribe en
    // `monto_cierre_usd`, o sea en el número que después suman Revenue, el Segundo
    // Cerebro y la ficha del cliente. Lo que no es un número positivo y en escala no es
    // un monto: queda en null y la venta entra sin importe, que es un estado legítimo.
    montoPago: Number.isFinite(Number(f?.montoPago)) && Number(f?.montoPago) > 0 && Number(f?.montoPago) <= MAX_MONTO_IMPORT
      ? Number(f?.montoPago)
      : null,
    bajaConfianza: f?.bajaConfianza === true,
  }));

  // Lo que la PANTALLA alcanzó a ver sobre cada fila. No es un dato de confianza —lo
  // manda el cliente— y no se usa para dejar pasar nada: se usa sólo para FRENAR.
  const vioDuplicado = filas.map((f) => f?.motivo === MOTIVO_DECIDIBLE);
  /**
   * Y SOBRE CUÁL lead la pantalla le ofreció completar. Mismo criterio que `vioDuplicado`
   * y por la misma razón: el server resuelve el id de nuevo, y si ahora apunta a OTRO
   * lead —entró un webhook en el medio, o la fila se editó— la decisión de completar no
   * era sobre ése. Completar escribe sobre una ficha que alguien viene trabajando, así
   * que acá no se elige el lead que quedó a mano: se cae al default, que es no tocarla.
   */
  const idQueVio = filas.map((f) => (typeof f?.leadExistenteId === 'number' ? f.leadExistenteId : null));

  // El motivo lo recalcula el SERVER contra la base de ahora (marcarExistentes
  // vuelve a consultar los duplicados y corre las mismas reglas que vio el usuario).
  //
  // ⚠️ Y SI EL SERVER DESCUBRE UN DUPLICADO QUE LA PANTALLA NO MOSTRÓ, EL TILDE DE ESA
  // FILA NO ES UNA DECISIÓN SOBRE ESO. `entra()` honra el tilde de un duplicado porque
  // la persona lo vio marcado y lo tildó igual — eso vale para el modal de importar,
  // que pinta el motivo antes de que nadie toque nada. Pero `/crm/revisar/[id]` siembra
  // sus filas con `incluir: true` y `yaExiste: false` (RevisarLead.tsx), así que el
  // «ya existe» aparece ACÁ, después de que la pantalla se dibujó: honrar ese tilde es
  // crear el duplicado y además atribuirle la decisión a alguien que nunca la tomó.
  // Se baja el tilde y la fila cuenta como omitida, igual que en el modal.
  const validadas = (await marcarExistentes(limpias)).map((f, i) => {
    if (f.motivo === MOTIVO_DECIDIBLE && !vioDuplicado[i]) return { ...f, incluir: false, enriquecer: false };
    if (f.enriquecer && f.leadExistenteId !== idQueVio[i]) return { ...f, enriquecer: false };
    return f;
  });

  let creados = 0;
  let enriquecidos = 0;
  let ganados = 0;
  let omitidos = 0;
  const errores: string[] = [];
  const emailsNuevos = new Set<string>();
  const telsNuevos = new Set<string>();

  /**
   * LA ETAPA DE VENTA DEL EMBUDO AL QUE ENTRAN ESTAS FILAS (#622).
   *
   * ⚠️ SALE DEL PIPELINE DE *ESE* EMBUDO, nunca de la constante `'ganado'`. Escribir en
   * `pipeline_stage` una clave que el embudo no tiene no falla —no hay FK, no hay check— y
   * deja al lead en una columna que el tablero no dibuja: así desaparecieron 1.057 leads
   * fuera del embudo. Si el embudo no la tiene, `etapaDeGanado` devuelve null y la
   * propuesta no se honra: el lead entra como cualquier otro y la respuesta lo DICE, que
   * es la única forma de que alguien se entere.
   *
   * Se resuelve UNA vez y sólo si hay algo que mover: es una lectura por importación, no
   * una por fila.
   */
  const hayGanados = validadas.some((f) => entraGanado(f));
  const etapaGanado = hayGanados
    ? etapaDeGanado((funnelId != null ? await getFunnelDe(funnelId) : await getFunnelDefault()).stages)
    : null;
  if (hayGanados && !etapaGanado) {
    errores.push('Este embudo no tiene etapa de cierre: esos leads entraron en la primera etapa.');
  }

  for (const f of validadas) {
    const email = f.email.toLowerCase();
    const tel = f.telefono.replace(/\D/g, '');
    // Además del motivo, se chequea contra lo insertado EN ESTA MISMA corrida:
    // marcarExistentes miró la base antes de empezar y no ve lo que vamos creando.
    const chocaAcá = (!!email && emailsNuevos.has(email)) || (!!tel && telsNuevos.has(tel));
    const duplicado = f.motivo === 'duplicado';
    // ⚠️ EL PORTÓN ES `entra()`, LA MISMA FUNCIÓN QUE DIBUJA LA CASILLA Y QUE CUENTA EL
    // BOTÓN. Hasta el 03/10/2026 acá había una tercera condición escrita a mano
    // —`!f.incluir || chocaAcá`— y las tres contestaban distinto: la pantalla dibujaba
    // la fila repetida atenuada y sin tilde, el botón decía «Crear 80 leads» contando
    // sólo las limpias, y este bucle creaba 80 MÁS las repetidas, encima con
    // `permitirDuplicado: !!f.motivo` → true justo para las marcadas, o sea con la
    // guarda anti-duplicado apagada. Ningún error, ningún log, siete semanas a la vista.
    //
    // Lo que se decidió el 14/08 sigue en pie y ahora SÍ existe: tildar un duplicado es
    // una decisión de la persona y el server la respeta. Lo que faltaba era que la
    // pantalla pudiera tomarla —la casilla estaba deshabilitada justo en esas filas— y
    // que los tres lectores contestaran lo mismo. Un tilde que la persona no puede mover
    // no es una decisión: es un default, y el default era duplicar en silencio.
    //
    // `chocaAcá` es otra cosa y sigue frenando: son dos filas del MISMO archivo
    // pisándose. Ahí no hay decisión que respetar, hay un archivo con la misma persona
    // dos veces, y `marcarExistentes` no lo puede ver porque miró la base antes de
    // empezar.
    /**
     * EL TERCER DESTINO: completar la ficha que ya está (#623). Va ANTES del portón
     * porque `entra()` contesta «¿se va a CREAR?» y la respuesta acá es no — y las dos
     * salen de `destinoDe`, que es la única función que decide qué le pasa a una fila.
     *
     * `chocaAcá` sigue frenando: dos filas del mismo archivo completando el mismo lead
     * es el archivo con la misma persona dos veces, igual que al crear.
     *
     * Y «no había nada que llenar» cuenta como OMITIDA, no como completada: la ficha
     * tenía todo cargado y no se escribió una sola columna. Decir «completé 3» sobre eso
     * es afirmar un cambio que no pasó.
     */
    if (destinoDe(f) === 'enriquecer' && !chocaAcá && f.leadExistenteId != null) {
      try {
        const llenados = await enriquecerLead(f.leadExistenteId, {
          nombre: f.nombre || null,
          email: f.email || null,
          telefono: f.telefono || null,
          empresa: f.empresa || null,
        });
        if (llenados.length) enriquecidos++;
        else omitidos++;
      } catch (e) {
        omitidos++;
        errores.push(`${f.nombre}: ${e instanceof Error ? e.message : 'error'}`);
      }
      continue;
    }
    if (!entra(f) || chocaAcá) { omitidos++; continue; }
    try {
      const creado = await createLead({
        nombre: f.nombre,
        email: f.email || null,
        telefono: f.telefono || null,
        empresa: f.empresa || null,
        // La persona lo vio marcado como «ya existe» y lo tildó igual: eso ES la
        // autorización, y sin esto `createLead` lo volvería a frenar. Ahora es cierto que
        // alguien lo decidió — la casilla de esas filas se puede mover y nacen
        // destildadas, así que el tilde sólo está puesto si alguien lo puso.
        //
        // Para toda fila que NO es un duplicado tildado, `duplicado` es false y la guarda
        // de `createLead` queda prendida: es la segunda red, porque `marcarExistentes`
        // compara exacto (email en minúsculas, teléfono en dígitos) y `duplicadosDeLead`
        // compara más flojo (los últimos 10 dígitos). Lo que se le escapa al índice lo
        // frena el alta y sale contado en `errores` CON EL NOMBRE, no creado en silencio.
        permitirDuplicado: duplicado,
        // De dónde vino: entró en un archivo. Sin esto el lead importado es
        // indistinguible de uno que llenó un formulario, que es el caso que importa —
        // una lista en frío de 1.000 contactos conviviendo con los que llegaron solos.
        origen_lead: ORIGEN_LEAD.importacion.id,
        // El lead nace en el tablero DESDE EL QUE SE LO IMPORTÓ, igual que en el alta.
        funnel_id: funnelId ?? null,
      });
      creados++;
      if (email) emailsNuevos.add(email);
      if (tel) telsNuevos.add(tel);
      /**
       * LA VENTA (#622): el lead se crea igual que todos y DESPUÉS se lo mueve, por el
       * MISMO camino que usa el tablero (`setPipelineStage`).
       *
       * ⚠️ NO SE LE AGREGÓ UNA COLUMNA A `createLead`, y el porqué es «una cosa, un
       * lugar»: poner una etapa es sincronizar `estado_lead`, escribir el monto y dejar
       * la línea en el historial del lead. Eso ya vive en un lugar; una segunda forma de
       * hacerlo se desincroniza, y lo que queda mal es el número que suma la facturación.
       *
       * `requisitos: { omitir }` porque acá no hay a quién preguntarle, y el motivo queda
       * en el historial: un salteo se saltea DICIÉNDOLO. Y si falla, el lead ya está
       * creado —eso no se deshace—: se cuenta con su nombre en `errores`, que es lo único
       * que permite ir a moverlo a mano.
       */
      if (etapaGanado && entraGanado(f)) {
        try {
          await setPipelineStage(creado.id, etapaGanado, {
            monto: f.montoPago ?? null,
            requisitos: { omitir: 'Importación: el archivo traía un pago cargado para este contacto' },
          });
          ganados++;
        } catch (e) {
          errores.push(`${f.nombre}: entró, pero no pude marcarlo como ganado (${e instanceof Error ? e.message : 'error'}).`);
        }
      }
    } catch (e) {
      omitidos++;
      errores.push(`${f.nombre}: ${e instanceof Error ? e.message : 'error'}`);
    }
  }

  bust(TAG.leads);
  revalidatePath('/crm');
  revalidatePath('/general');
  return { creados, enriquecidos, ganados, omitidos, errores: errores.slice(0, 20) };
}

// ⚠️ ACÁ VIVÍAN `previsualizarImportLeadsAction` e `importLeadsCsvAction`, y se
// borraron el 04/10/2026 con CERO call sites en todo el repo. No era código muerto
// inocente: `importLeadsCsvAction` era el camino «sin revisión previa» y le pasaba
// a `importarLeadsRevisadosAction` las filas tal como salen de `filasDesdeCsv`, o
// sea con `incluir: true` de fábrica — así que el portón de `entra()` las dejaba
// pasar TODAS, duplicados incluidos y con la guarda anti-duplicado apagada. Era
// exactamente el bug que el portón vino a cerrar, esperando a que alguien la
// llamara. Si hace falta volver a tener un camino sin revisión, tiene que sembrar
// `incluir: false` en las filas con motivo antes de llegar al portón, igual que
// hace hoy `ImportarLeadsModal`.

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
  if (!nuevoIso) return { ok: false, accion: 'nada', mensaje: 'Carga también la hora si quieres que se mueva el evento del calendario.', reconectar: false, invitado: null };
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

/**
 * Guarda UN campo de la ficha editado EN EL LUGAR (sin modo edición).
 *
 * «Que ya no exista el botón de "editar" … sino que simplemente le doy click
 * arriba y ya puedo sobre escribir» (Martín, 05/10/2026).
 *
 * ⚠️ NO ES UN CAMINO NUEVO DE ESCRITURA. Es el MISMO que ya usa «Deshacer» del
 * historial (`revertAuditChangeAction`, unas líneas más abajo): campo por campo,
 * `updateLead` para las columnas con invariante y evento de Meta, `saveLeadMeta`
 * para las que no, y `logLeadChanges` al final — así un cambio hecho en la ficha
 * queda en el historial igual que cualquier otro, y se puede deshacer desde ahí.
 * Qué campo va por dónde lo decide `app/crm/campo-inline.ts`, que es el catálogo
 * que también lee la pantalla.
 *
 * ⚠️ `campo` ES UN ARGUMENTO DE UNA SERVER ACTION, o sea una URL: se valida contra
 * el catálogo antes de tocar nada. Sin eso, cualquier columna de `leads` —
 * `workspace_id` incluido— sería escribible desde el navegador.
 */
export async function guardarCampoLeadAction(id: number, campo: string, valor: ValorInline): Promise<void> {
  if (!esCampoInline(campo)) throw new Error('Ese campo no se edita desde la ficha.');
  const v = valorDeCampo(campo, valor);
  // El `before` se LEE (y no se asume) porque además del historial decide si hay
  // que rescatar el monto de cierre: ver `montoEnRiesgo`.
  const before = await getLead(id);
  if (!before) throw new Error(`Lead ${id} no existe`);

  const via = VIA_INLINE[campo];
  if (via === 'fathom') {
    // ⚠️ SE PARCHEA EL SLOT, NO SE REESCRIBE EL ARRAY. `fathom_links` guarda un
    // link por reunión y el formulario lo rearmaba entero en cada guardado: tocar
    // la R1 te borraba la R2 (y cualquier tercer link). Editando campo por campo
    // eso pasaría en cada click, así que el array se lee y se parchea.
    const links = (before.fathom_links ?? []) as FathomLink[];
    await saveLeadMeta(id, {
      fathom_links: ponerLinkFathom(links, campo as 'fathom_r1' | 'fathom_r2', v as string | null, etiquetaEsR2),
    });
  } else if (via === 'meta') {
    await saveLeadMeta(id, { [campo]: v as string | null });
  } else {
    await updateLead(id, { [campo]: v } as Parameters<typeof updateLead>[1]);
    // ⚠️ RESCATE DEL MONTO. `updateLead` fuerza monto/fecha de cierre a null cuando
    // `cerro != true`, haya mandado el caller lo que haya mandado — y un lead en
    // «Facturando» tiene monto con `cerro` null (lo escribe lib/pagos.ts directo).
    // Sin esto, corregirle «asistió a R1» le borraba la venta en silencio.
    if (montoEnRiesgo(before)) {
      const { error } = await (await getTenantDb())
        .from('leads')
        .update({ monto_cierre_usd: before.monto_cierre_usd ?? null, fecha_cierre: before.fecha_cierre ?? null })
        .eq('id', id);
      if (error) throw new Error(`No se pudo conservar el monto de cierre del lead ${id}: ${error.message}`);
    }
  }

  const after = await getLead(id).catch(() => null);
  await logLeadChanges(id, before, after, await autorActual());
  bust(TAG.leads, TAG.pagos);
  revalidatePath('/crm');
  revalidatePath(`/crm/${id}`);
  revalidatePath('/general');
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
    if (ultimo && createdAt !== ultimo) throw new Error('Solo se puede deshacer el último cambio de estado. Vuelve de a uno, empezando por el más reciente.');
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

/**
 * ⚠️ ACÁ VIVÍA `LeadEditorInput` + `saveLeadEditorAction`, el guardado en lote del
 * formulario de «Editar lead →» (app/crm/[id]/EditLeadForm.tsx). Los dos se fueron el
 * 05/10/2026 con el botón: los 15 campos se editan en la ficha y cada uno guarda por
 * `guardarCampoLeadAction`, que es el mismo choke point (updateLead/saveLeadMeta +
 * logLeadChanges).
 *
 * ⚠️ Y SE BORRÓ EN VEZ DE DEJARLA SIN CALLERS A PROPÓSITO: una server action es una URL.
 * Ésta escribía los 15 campos Y la etapa (`setBoardStageOverride`) sin más guard que la
 * sesión del workspace, así que dejarla viva es la versión afilada de la «pantalla
 * huérfana a la que se llega por un link viejo». Lo que de ella NO se replica campo por
 * campo está enumerado en el comentario de `app/crm/campo-inline.ts`.
 */
/**
 * Persiste la config del funnel (pipeline de Activo + nutriciones suprimidas)
 * desde la tab "Funnel".
 *
 * `funnelId` viaja desde el desplegable de /funnel, que sólo se pinta cuando hay
 * más de uno. Sin él se edita el del NEGOCIO, que es lo que hacen los tres
 * editores embebidos (/onboarding, /second-brain) y lo que pasaba siempre hasta
 * la mig 0170.
 */
export async function saveFunnelAction(pipeline: Stage[], suppressed: string[], funnelId?: number): Promise<void> {
  // El guard faltaba: cualquier miembro del workspace podía reescribir el funnel
  // entero —que decide requisitos, nutrición y qué audios se piden— invocando la
  // server action. Ya estaba anotado en docs/hallazgos-crm.md.
  if ((await getRolWsEfectivo()) !== 'admin') throw new Error('Solo el administrador del workspace puede editar el funnel.');
  // El `.eq('workspace_id')` de getTenantDb hace que un id de otro cliente no
  // toque ninguna fila, y `saveFunnelDe` tira cuando el UPDATE no tocó nada: un
  // id ajeno da error, no un guardado mudo sobre el funnel equivocado.
  // ⚠️ LAS TERMINALES SE GARANTIZAN ACA, que es el lugar que manda: `pipeline` es un
  // ARGUMENTO de una server action, asi que la pantalla no es la ultima palabra — el
  // cuerpo lo escribe quien quiera. Decision de Martin: las cuatro terminales estan
  // siempre y son unicas; lo unico que se puede es renombrarlas.
  //
  // Tres de las cuatro ya eran imborrables porque las inyecta la derivacion. `ganado` no:
  // vivia en el pipeline editable y el boton de borrar la aceptaba. Y borrarla no rompe
  // nada ruidoso — ninguna venta vuelve a escribir estado_lead=ganado y los ocho lectores
  // de facturacion cuentan cero, sin error y sin log.
  const conGanado = conTerminales(pipeline);
  if (funnelId != null) await saveFunnelDe(funnelId, conGanado, suppressed);
  else await saveFunnelDefault(conGanado, suppressed);
  bust(TAG.pipeline, TAG.leads);
  revalidatePath('/crm');
  revalidatePath('/funnel');
}

/** Una etapa como la dibuja el pop-up: lo justo para nombrarla y ubicarla. */
/**
 * Una etapa del embudo, como la dibuja el pop-up.
 *
 * ⚠️ ES UN ALIAS, no una copia: el mismo tipo lo usa el tablero para pintar el pop-up
 * con lo que ya tiene en pantalla mientras esta action contesta.
 */
export type EtapaDelFunnel = EtapaVisible;

/** Una nutrición del embudo: de qué etapa sale, a qué secuencia lleva, y si está puesta. */
/**
 * Una nutrición del embudo, como la dibuja el pop-up.
 *
 * ⚠️ ES UNA FILA POR DESTINO, NO POR ARISTA. «Reactivación» sale de DOS etapas (de «No
 * responde» y de «Perdido»), así que antes eran dos casillas con el mismo nombre: apagar
 * una dejaba la nutrición corriendo y la pantalla decía dos veces lo mismo. Por eso el
 * toggle escribe TODOS los ids del grupo.
 */
/**
 * Por qué se dispara una nutrición, en una frase.
 *
 * Es el «de qué depende» que pidió Martín. ⚠️ NO sale del label del trigger: ésos son
 * `Tiempo`, `Asistencia`, `Manual`, `Pago`, `Agenda (Calendly)` y `Formulario`, y pegarlos
 * da «Sale de Agenda R1 · Asistencia», que no es una frase. El mismo trigger significa
 * cosas distintas según de dónde salga: `tiempo` desde la entrada es «no agendó» y desde
 * «No responde» es «no volvió».
 */
function porqueSeDispara(trigger: string, kindOrigen?: string): string {
  if (trigger === 'asistencia') return 'no asiste a la reunión';
  if (trigger === 'pago') return 'no aparece el pago';
  if (trigger === 'manual') return 'alguien lo marca a mano';
  if (trigger === 'formulario') return 'no completa el registro';
  if (trigger === 'agenda') return 'no llega a agendar';
  if (trigger === 'tiempo') {
    if (kindOrigen === 'entrada') return 'pasa el tiempo sin que agende';
    if (kindOrigen === 'grupo') return 'espera el día del evento';
    return 'pasa el tiempo sin que vuelva';
  }
  return 'pasa el tiempo';
}
export type NutricionDelFunnel = {
  /** El primero de sus ids `"desde>hacia"`. Sirve de key en la lista. */
  id: string;
  /** TODOS los ids que hay que escribir en `suppressed` para apagarla. */
  ids: string[];
  /** Cómo se llama, sin el prefijo «Nutrición». Con dos reuniones lleva de cuál es. */
  nombre: string;
  /** De qué etapa sale, con el nombre que el cliente le puso. Varias = «A» y «B». */
  desdeLabel: string;
  /** Por qué se dispara, en una frase. Es el «de qué depende» del pedido. */
  porque: string;
  activa: boolean;
};

/** Todo lo que el pop-up del CRM necesita saber de UN embudo. */
export type EmbudoEnDetalle = {
  /** null = el embudo del NEGOCIO. */
  id: number | null;
  /** El nombre que la persona ve: el del producto si lo hay, si no el del embudo. */
  nombre: string;
  /** El principal del workspace: no se puede eliminar. */
  esDefault: boolean;

  /** Las etapas que se reordenan y se quitan. */
  etapas: EtapaDelFunnel[];
  /** Las cuatro que están en todo embudo: sólo se renombran. */
  fijas: EtapaDelFunnel[];
  nutriciones: NutricionDelFunnel[];
  /** Cómo ENTRA la gente a este embudo. `[]` = no declarado, y nunca afirma nada. */
  entradas: EntradaId[];
  /** El encuentro de fecha fija, si el canal tiene uno (el taller de todos los miércoles). */
  evento: EventoFunnel | null;

  /**
   * Lo que está mal armado en este embudo, en frases.
   *
   * ⚠️ SE CALCULA EN EL SERVER PORQUE EL PIPELINE CRUDO NUNCA SALE DE ACÁ. Al pop-up le
   * llegan las etapas ya DERIVADAS, y `problemasDePipeline` mira el `kind` y el ORDEN del
   * pipeline — o sea justo lo que la derivación normaliza. Pedirle a la pantalla que las
   * calcule sería calcularlas sobre otra cosa.
   *
   * ⚠️ Y AVISAN, NO BLOQUEAN. Es la decisión del 17/09: mover y cambiar se guardan
   * siempre, y lo que falta queda pendiente. Un embudo a medio armar se guarda igual; lo
   * que no puede es quedar roto Y CALLADO — que es el caso real de la inmobiliaria que
   * tipó su descarte como «cierre» y el sistema le pidió el monto de la venta para
   * descalificar a alguien.
   */
  problemas: string[];
};

/**
 * Un embudo entero, para el pop-up que lo edita dentro del CRM.
 *
 * ⚠️ EXISTE PORQUE EL POP-UP EDITA UN EMBUDO QUE NO ES EL QUE EL TABLERO DIBUJA. El
 * lápiz vive en cada renglón del selector de producto, así que se puede abrir el de
 * «Mentoría» estando parado en «Curso»: las etapas de la pantalla no sirven, hay que ir
 * a buscar las de ESE embudo.
 *
 * ⚠️ Y LAS ETAPAS VIENEN PARTIDAS EN DOS, que es el pedido de Martín del 29/09: «que no
 * aparezcan en el editable las etapas que no se puedan editar... Como Ganado etc». Las
 * cuatro terminales siguen existiendo y se siguen pudiendo renombrar —eso lo decidió él
 * mismo el 28/09 y no se toca— pero salen del lote que se reordena. El corte se hace ACÁ
 * y no en la pantalla: es la misma pregunta que contesta `esTerminal` del lado del server
 * cuando alguien intenta borrarlas, y tenerla en dos lugares es cómo se separan.
 *
 * ⚠️ LAS NUTRICIONES SE CALCULAN CON `suppressed` VACÍO, a propósito. Una nutrición
 * suprimida no aparece en la salida de `generateFunnel` —`nut()` sale temprano— así que
 * pidiendo la lista real no hay forma de ofrecer RESTAURARLA: lo apagado sería invisible,
 * que es exactamente lo que se quiere poder deshacer. Se piden todas las posibles y se
 * marca cuáles están puestas.
 */
export async function embudoEnDetalleAction(funnelId?: number): Promise<{ ok: true; embudo: EmbudoEnDetalle } | { ok: false; error: string }> {
  try {
    const cfg = funnelId != null ? await getFunnelDe(funnelId) : await getFunnelDefault();
    // El mismo guard que el resto de la familia: con la lectura en ERROR lo que se lee es
    // el pipeline GENÉRICO, y dibujarlo le diría a la persona que su embudo es otro.
    if (cfg.origen === 'error') return { ok: false, error: 'No se pudieron leer las etapas. Vuelve a intentarlo.' };

    const { propias, fijas } = etapasVisibles(cfg.stages);

    // Las nutriciones POSIBLES de este pipeline, puestas o no.
    const sup = new Set(cfg.suppressed);
    /**
     * El nombre de una etapa, con el que el CLIENTE le puso.
     *
     * ⚠️ `cfg.stages` VA PRIMERO, y ése era el bug que Martín reportó: «si yo cambio el
     * nombre, si pongo R1, R2… las nutriciones deben respetar eso». Sin esa fuente se
     * caía a `cfg.labels` (que sólo tiene las terminales renombradas) y de ahí al
     * catálogo de fábrica, que no conoce las claves de un pipeline propio. Medido el
     * 30/09/2026: un cliente real veía **`st0` y `st1`** en esta lista, y la plantilla de
     * VSL mostraba `registro`, `grupo`, `webinar` y `checkout`. El último eslabón no se
     * puede sacar: una nutrición suprimida no está en `cfg.stages`.
     */
    const deStages = new Map(cfg.stages.map((st) => [st.key, st.label]));
    const etiqueta = (k: string) => deStages.get(k) ?? cfg.labels[k] ?? labelDeCatalogo(k) ?? k;
    /** Sin el prefijo de fábrica, y sin dejar la primera letra en minúscula. */
    const limpiarNombre = (txt: string) => {
      const sinPrefijo = txt.replace(/^Nutrición\s*-?\s*/i, '').trim() || txt;
      return sinPrefijo.charAt(0).toUpperCase() + sinPrefijo.slice(1);
    };

    const todas = generateFunnel(cfg.pipeline, [], cfg.labels).transitions
      .filter((t) => t.category === 'nutricion')
      // ⚠️ `manual` y `reunion_excepcional` NO son nutriciones que se nutran, y el repo ya
      // lo había decidido en `ETAPAS_SIN_SECUENCIA` — la pantalla no lo sabía. Sin esto,
      // la lista trae una fila que dice, literal, «No Paga → Reunión excepcional»: una
      // nutrición cuyo origen es otra nutrición.
      .filter((t) => !ETAPAS_SIN_SECUENCIA.includes(t.to));

    // Se agrupa por DESTINO: una nutrición es una, salga de una etapa o de tres.
    const porDestino = new Map<string, typeof todas>();
    for (const t of todas) porDestino.set(t.to, [...(porDestino.get(t.to) ?? []), t]);

    /** Cuántas de la misma familia hay: con dos «No Show» hay que decir de cuál reunión. */
    const familia = (k: string) => k.replace(/_r\d+$/, '');
    const porFamilia = new Map<string, number>();
    for (const k of porDestino.keys()) porFamilia.set(familia(k), (porFamilia.get(familia(k)) ?? 0) + 1);

    const nutriciones: NutricionDelFunnel[] = [...porDestino].map(([to, ts]) => {
      const desdes = [...new Set(ts.map((t) => etiqueta(t.from)))];
      const base = limpiarNombre(etiqueta(to));
      // Con una sola de la familia el nombre alcanza; con dos, se dice de cuál sale — que
      // es exactamente lo que pidió Martín («la de No show tiene obligatoriamente que venir
      // de Agenda R1») y se mueve solo cuando él renombra la etapa.
      const unaSola = (porFamilia.get(familia(to)) ?? 1) <= 1;
      // ⚠️ Y EL «R1» DEL NOMBRE DE FÁBRICA SE VA cuando se dice de qué reunión sale: el
      // label del catálogo es «Nutrición No Show R1» y pegarle la etapa daba «No Show R1 ·
      // Agenda R1» — el mismo número dos veces, y el de la izquierda es el nuestro, no el
      // que el cliente le puso. Queda «No Show · Agenda R1», que se mueve solo si él
      // renombra la etapa. Con una sola reunión el nombre base ya alcanza: «No Show».
      const sinNumero = base.replace(/\s*R\d+$/i, '').trim() || base;
      const nombre = unaSola || desdes.length !== 1 ? base : `${sinNumero} · ${desdes[0]}`;
      return {
        id: `${ts[0].from}>${to}`,
        ids: ts.map((t) => `${t.from}>${t.to}`),
        nombre,
        desdeLabel: desdes.length > 1 ? `${desdes.slice(0, -1).join(', ')} y ${desdes.at(-1)}` : (desdes[0] ?? ''),
        porque: porqueSeDispara(ts[0].trigger ?? 'tiempo', cfg.stages.find((st) => st.key === ts[0].from)?.kind),
        // Apagada sólo si TODOS sus ids lo están: con uno encendido la nutrición corre.
        activa: ts.some((t) => !sup.has(`${t.from}>${t.to}`)),
      };
    });


    return {
      ok: true,
      embudo: {
        id: funnelId ?? null,
        // ⚠️ EL NOMBRE ES EL DEL PRODUCTO, que es lo que el tipo de acá arriba declara y
        // lo que el desplegable ya mostraba. Devolver `cfg.nombre` pelado ponía «Funnel
        // principal» en el título del pop-up mientras el selector decía «Negocio que
        // Escala» — y como el título es un input, renombrar arrancaba desde el valor
        // equivocado. Se pide sólo por ESTE id: el mapa entero es para el desplegable.
        nombre: (cfg.id != null ? (await productosPorFunnel([cfg.id])).get(cfg.id) : null)?.trim()
          || cfg.nombre || 'Tu embudo',
        esDefault: cfg.esDefault,
        etapas: propias,
        fijas,
        nutriciones,
        // ⚠️ `origen` manda sobre `entradas`: con la fila sin declarar, `filaAFunnel` las
        // devuelve vacías aunque el pipeline caiga al default. Acá se pasa tal cual — la
        // pantalla tiene que poder decir «todavía no lo declaraste».
        problemas: problemasDePipeline(cfg.pipeline),
        entradas: cfg.entradas,
        evento: cfg.evento,

      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Lo que el pop-up necesita para DECIDIR: los conteos por etapa, el total y el canal.
 *
 * ⚠️ VA APARTE DE `embudoEnDetalleAction` PORQUE ES CARO Y NO HACE FALTA PARA DIBUJAR. La
 * etapa de un lead se DERIVA (`deriveStageKey` es un switch sobre sus columnas, no una
 * columna de la tabla), así que contar exige TRAER los leads. Medido el 29/09/2026: con
 * todo junto, el pop-up tardaba ~550 ms de server en abrir y se reportó dos veces como
 * «queda en cargando». Ahora el detalle es UNA consulta y esto llega detrás.
 *
 * Hasta que llega, quitar una etapa PREGUNTA: el default seguro es la fricción.
 */
/** Lo que el pop-up necesita para DECIDIR, pero no para dibujarse. */
export type ExtrasDelEmbudo = {
  /** Cuántos leads hay en cada etapa. Todas las claves del embudo, incluso en 0. */
  conteos: Record<string, number>;
  /** El total del embudo. Es el dato que convierte «Eliminar» en una decisión. */
  leads: number;
  /** El BOFU efectivo: decide si se pregunta por el encuentro de fecha fija. */
  canal: CanalId | null;
};

export async function extrasDelEmbudoAction(funnelId?: number): Promise<ExtrasDelEmbudo> {
  try {
    const [leads, cfg, diag] = await Promise.all([
      listLeadsDeFunnel(funnelId ?? null),
      funnelId != null ? getFunnelDe(funnelId) : getFunnelDefault(),
      getDiagnosticoFase().catch(() => null),
    ]);
    // ⚠️ TODAS LAS ETAPAS ARRANCAN EN 0, y esto no es cosmética. Contando sólo lo que
    // aparece, una etapa VACÍA no entra al mapa y el lector recibe `undefined` — que la
    // pantalla interpreta, con razón, como «no pude contar» y pregunta. O sea que la
    // fricción que se pidió sacar («si no tiene ningún lead, nada de fricción») volvía
    // justo en el único caso donde no tiene que estar. Clave ausente y valor cero no son
    // lo mismo, y acá la diferencia es toda la feature.
    const out: Record<string, number> = {};
    for (const st of cfg.stages) out[st.key] = 0;
    // ⚠️ `deriveStageKey` es un switch PURO sobre las columnas del lead: no mira el funnel.
    // Por eso un lead puede caer en una clave que ESTE embudo ya no tiene — y eso está bien,
    // es lo que el tablero marca como «fuera del embudo». Acá suma igual: lo que se pregunta
    // es si quitar la etapa deja gente afuera, y un lead en una clave huérfana ya lo está.
    for (const l of leads) {
      const k = deriveStageKey(l as unknown as StageDerivable);
      out[k] = (out[k] ?? 0) + 1;
    }
    return { conteos: out, leads: leads.length, canal: canalEfectivo(cfg.canal, diag?.canal) };
  } catch (e) {
    console.error('[crm] extrasDelEmbudoAction:', e instanceof Error ? e.message : e);
    // ⚠️ Un error NO es «cero leads en todas»: devolverlo así haría que la pantalla borrara
    // sin preguntar sobre etapas llenas. Vacío se lee como «no sé», y «no sé» pregunta.
    return { conteos: {}, leads: -1, canal: null };
  }
}
/**
 * Renombra el embudo que el pop-up está mostrando.
 *
 * ⚠️ Puede terminar escribiendo en `productos` y no en `funnels`: la pantalla muestra el
 * nombre del PRODUCTO. El porqué completo está en `renombrarFunnel` (lib/funnels.ts).
 */
export async function renombrarEmbudoAction(funnelId: number | null, nombre: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if ((await getRolWsEfectivo()) !== 'admin') return { ok: false, error: 'Solo el administrador del workspace puede editar el embudo.' };
  try {
    // Sin id es el del NEGOCIO, y hay que resolver cuál es: `renombrarFunnel` necesita una fila.
    let id = funnelId;
    if (id == null) {
      const cfg = await getFunnelDefault();
      if (cfg.origen === 'error' || cfg.id == null) return { ok: false, error: 'No se pudo leer tu embudo principal. Vuelve a intentarlo.' };
      id = cfg.id;
    }
    await renombrarFunnel(id, nombre);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  bust(TAG.pipeline, TAG.leads);
  revalidatePath('/crm');
  return { ok: true };
}

/**
 * ARCHIVA un embudo. No borra nada: `activo = false` y la fila se queda entera.
 *
 * ⚠️ LOS LEADS NO SE TOCAN, y eso es lo que hay que decirle a la persona ANTES de que
 * confirme: siguen existiendo con su `funnel_id` apuntando acá, así que mientras el embudo
 * esté archivado no se ven en ningún tablero. Restaurarlo los devuelve a todos.
 *
 * Se devuelve cuántos leads quedan adentro para que la pantalla lo pueda decir después,
 * no para decidir: guardar NUNCA se bloquea, y esto tampoco.
 */
export async function archivarEmbudoAction(funnelId: number): Promise<{ ok: true; leads: number } | { ok: false; error: string }> {
  if ((await getRolWsEfectivo()) !== 'admin') return { ok: false, error: 'Solo el administrador del workspace puede eliminar un embudo.' };
  try {
    const leads = await contarLeadsDeFunnel(funnelId).catch(() => -1);
    await archivarFunnel(funnelId);
    bust(TAG.pipeline, TAG.leads);
    revalidatePath('/crm');
    return { ok: true, leads };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Devuelve un embudo archivado a la lista, con sus leads. */
/**
 * Borra un producto archivado para siempre. Sus leads vuelven al producto del negocio.
 *
 * Pedido de Martín (30/09/2026): «dentro la opción de eliminarlos definitivamente».
 */
export async function eliminarEmbudoDefinitivoAction(funnelId: number): Promise<{ ok: true; rescatados: number } | { ok: false; error: string }> {
  try {
    const { rescatados } = await eliminarFunnelDefinitivo(funnelId);
    bust(TAG.pipeline, TAG.leads);
    revalidatePath('/crm');
    return { ok: true, rescatados };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo borrar el producto.' };
  }
}
export async function restaurarEmbudoAction(funnelId: number): Promise<{ ok: true } | { ok: false; error: string }> {
  if ((await getRolWsEfectivo()) !== 'admin') return { ok: false, error: 'Solo el administrador del workspace puede restaurar un embudo.' };
  try {
    await restaurarFunnel(funnelId);
    bust(TAG.pipeline, TAG.leads);
    revalidatePath('/crm');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Los embudos archivados, para poder recuperarlos. Una copia que nadie ve no es una copia. */
export async function embudosArchivadosAction(): Promise<Array<{ id: number; nombre: string; leads: number }>> {
  const filas = await listarFunnelsArchivados();
  return Promise.all(filas.map(async (f) => ({
    id: f.id,
    nombre: f.producto?.trim() || f.nombre,
    leads: await contarLeadsDeFunnel(f.id).catch(() => -1),
  })));
}
/**
 * Editar UNA etapa del funnel desde la cabecera de su columna en el Kanban.
 *
 * Pedido de Martín (28/09/2026): «que estén 3 puntitos para opciones de editar esa
 * columna/etapa del funnel. Y que los cambios se guarden. Que se pueda renombrar o
 * eliminar, y otra opción de agregar nueva etapa».
 *
 * ⚠️ POR QUÉ ES UNA ACCIÓN ANGOSTA Y NO `saveFunnelAction`. Ésa recibe el pipeline ENTERO
 * desde el navegador, y el tablero no lo tiene: a `/crm` le llegan las etapas YA
 * GENERADAS (`filaAFunnel` corre en el server), no el pipeline crudo. Mandar el pipeline
 * reconstruido desde las etapas dibujadas le haría perder todo lo que la derivación agrega
 * y quita. Acá se lee, se parcha y se guarda del lado del server, que es el único que
 * tiene el original.
 *
 * ⚠️ Y EL RENOMBRE VA A DOS LUGARES DISTINTOS, según qué etapa sea. Las del pipeline
 * guardan su label ahí; las tres terminales derivadas (`perdido`, `descal`, `noresp`) no
 * existen en el pipeline —las pone la derivación en cada lectura— así que su nombre vive
 * en `data.labels`. El llamador no tiene que saber cuál es cuál: lo decide esto.
 */
export type OpEtapa =
  | { op: 'renombrar'; key: string; label: string }
  | { op: 'eliminar'; key: string }
  /**
   * Devolver una etapa que se acaba de quitar, TAL CUAL ESTABA.
   *
   * ⚠️ NO ES `agregar` OTRA VEZ. `agregar` acuña una clave nueva, y la clave es lo que ata
   * a los leads a su etapa: deshacer con ella devolvería una columna con el mismo nombre y
   * los leads afuera, que es peor que no deshacer. Acá vuelve la MISMA clave, en la MISMA
   * posición.
   */
  | { op: 'insertar'; etapa: { key: string; label: string; dot?: string; kind?: string }; at: number }
  | { op: 'agregar'; despuesDe?: string; label?: string }
  /**
   * Apagar o encender una nutrición. `id` es `"desde>hacia"`, la misma clave que vive en
   * `data.suppressed`.
   *
   * ⚠️ UNA NUTRICIÓN NO ES UNA ETAPA: es una TRANSICIÓN que deriva `generateFunnel` de la
   * forma del pipeline. No se crea ni se borra — se suprime, que es agregar su id a la
   * lista. Por eso no hay «agregar nutrición»: las que puede haber las decide el
   * recorrido, y lo único que elige el negocio es cuáles NO usa.
   */
  | { op: 'nutricion'; id: string; activa: boolean;
      /**
       * Los OTROS ids de la misma nutrición, si sale de más de una etapa.
       *
       * ⚠️ «Reactivación» sale de «No responde» Y de «Perdido»: son dos transiciones con
       * dos ids, y la pantalla las dibuja como UNA fila (que es lo que son). Apagar sólo
       * uno dejaba la nutrición corriendo desde el otro lado, con la casilla desmarcada —
       * o sea, un interruptor que dice que está apagado sobre algo que sigue mandando.
       */
      tambien?: string[] }
  /**
   * Subir o bajar una etapa un lugar. `delta` es -1 (antes) o 1 (después).
   *
   * ⚠️ NO ES UN ARRASTRE, y es a propósito: «que sea simple la edición, nada compleja».
   * El orden de las etapas se toca una vez cada varios meses; un arrastre acá costaría
   * la copia que sigue al cursor, el auto-scroll y el hueco de destino —las tres reglas
   * de esta casa sobre el drag— para un gesto que casi nadie va a hacer dos veces.
   */
  | { op: 'mover'; key: string; delta: -1 | 1 }
  /**
   * El orden COMPLETO de las etapas propias, tal como quedó después de arrastrar.
   *
   * ⚠️ NO ES «mandar el pipeline». Viajan sólo las CLAVES, y el server reordena el
   * pipeline que ya tiene: nada de lo que la derivación agrega o quita depende de lo que
   * mande el navegador, y una clave que no exista se ignora. Un arrastre puede mover una
   * etapa varios lugares de una, y hacerlo con N `mover` sería N escrituras.
   */
  | { op: 'reordenar'; keys: string[] };

/** Lo que hace falta para DESHACER un quitado: la etapa entera y dónde estaba. */
export type DeshacerEtapa = { etapa: { key: string; label: string; dot?: string; kind?: string }; at: number };

export async function editarEtapaAction(op: OpEtapa, funnelId?: number): Promise<{ ok: true; deshacer?: DeshacerEtapa } | { ok: false; error: string }> {
  if ((await getRolWsEfectivo()) !== 'admin') return { ok: false, error: 'Solo el administrador del workspace puede editar el funnel.' };
  // ⚠️ FUERA DEL `try`, a propósito: declarado adentro, el `return` de abajo no lo puede
  // nombrar. Es la misma trampa de scope que ya costó cobrarle dos veces a un cliente en el
  // puente a Flow, y acá lo que se perdería es el deshacer de una etapa borrada.
  let deshacer: DeshacerEtapa | undefined;
  try {
    const actual = funnelId != null ? await getFunnelDe(funnelId) : await getFunnelDefault();
    // ⚠️ El mismo guard que `declararEntradasAction`: con la lectura en ERROR lo que se lee
    // es el pipeline GENÉRICO, y guardarlo le pisa al cliente su funnel real. Una caída de
    // Supabase no puede reescribir un dato declarado.
    if (actual.origen === 'error') return { ok: false, error: 'No se pudo leer el funnel; no se guardó nada para no pisarlo. Vuelve a intentarlo.' };

    let pipeline = actual.pipeline;
    let labels = actual.labels;

    if (op.op === 'renombrar') {
      const label = op.label.trim().replace(/\s+/g, ' ').slice(0, MAX_LABEL_ETAPA);
      if (!label) return { ok: false, error: 'El nombre no puede quedar vacío.' };
      const enPipeline = pipeline.some((st) => st.key === op.key);
      if (enPipeline) pipeline = pipeline.map((st) => (st.key === op.key ? { ...st, label } : st));
      else labels = { ...labels, [op.key]: label };
    } else if (op.op === 'eliminar') {
      // Las cuatro terminales no se borran en ningún funnel: es la decisión de Martín, y
      // acá se hace cumplir del lado del server porque la pantalla no es la última palabra.
      if (esTerminal(op.key)) return { ok: false, error: 'Esa etapa está en todos los funnels y no se puede eliminar. Sí puedes cambiarle el nombre.' };
      if (!pipeline.some((st) => st.key === op.key)) {
        return { ok: false, error: 'Esa etapa no es del pipeline: no se puede eliminar, solo renombrar.' };
      }
      if (pipeline.length <= 1) return { ok: false, error: 'Tu embudo se quedaría sin etapas.' };
      // La etapa de ENTRADA tampoco: sin ella el embudo no tiene por dónde llegar un lead,
      // y es de donde cuelga la declaración de cómo entra la gente.
      if (pipeline.find((st) => st.key === op.key)?.kind === 'entrada') {
        return { ok: false, error: 'Por esa etapa entra tu gente: no se puede eliminar. Sí puedes cambiarle el nombre.' };
      }
      // Lo que se saca viaja de vuelta para poder DESHACERLO sin fricción: es la decisión de
      // Martín (29/09), «si no tiene ningún lead no debería haber nada de fricción, sólo que
      // me salte el pop-up de deshacer». Sin esto, deshacer tendría que acuñar una clave nueva.
      const iQuita = pipeline.findIndex((st) => st.key === op.key);
      const quitada = pipeline[iQuita];
      deshacer = { etapa: { key: quitada.key, label: quitada.label, dot: quitada.dot, kind: quitada.kind }, at: iQuita };
      pipeline = pipeline.filter((st) => st.key !== op.key);
    } else if (op.op === 'reordenar') {
      // Las claves que el navegador mandó, en su orden, y SÓLO las que existen.
      const vistas = new Set<string>();
      const ordenadas: Stage[] = [];
      for (const k of op.keys) {
        const st = pipeline.find((x) => x.key === k);
        if (st && !vistas.has(k)) { vistas.add(k); ordenadas.push(st); }
      }
      // ⚠️ Y LO QUE EL NAVEGADOR NO NOMBRÓ SE CONSERVA, al final. El pop-up sólo dibuja las
      // etapas propias, así que `ganado` —que vive en el pipeline y no se arrastra— nunca
      // viaja en la lista: sin esto, un arrastre la borraría del embudo.
      for (const st of pipeline) if (!vistas.has(st.key)) ordenadas.push(st);
      // ⚠️ Y LA ENTRADA VUELVE A SU LUGAR, la pantalla haya mandado lo que haya mandado.
      // El navegador ya no deja soltar nada encima, pero el que decide es el server: una
      // pestaña vieja —o un pedido armado a mano— dejaría el embudo empezando por otra
      // etapa, y ahí la declaración de cómo entra la gente cuelga de la que no es.
      const iEnt = ordenadas.findIndex((st) => st.kind === 'entrada');
      if (iEnt > 0) pipeline = [ordenadas[iEnt], ...ordenadas.filter((_, k) => k !== iEnt)];
      else pipeline = ordenadas;
    } else if (op.op === 'insertar') {
      // El deshacer de un quitado. Si la clave ya volvió por otro lado, no se duplica.
      if (pipeline.some((st) => st.key === op.etapa.key)) return { ok: true };
      const vuelveLabel = op.etapa.label.trim().slice(0, MAX_LABEL_ETAPA) || 'Etapa';
      const vuelve = { key: op.etapa.key, label: vuelveLabel, dot: op.etapa.dot ?? '#5B6472', tone: 'neutral', kind: op.etapa.kind ?? 'paso' } as Stage;
      // Nunca por delante de la entrada: si la etapa se quitó de ahí, volvió de otro lado.
      const piso = pipeline.findIndex((st) => st.kind === 'entrada') + 1;
      const at = Math.max(piso, Math.min(op.at, pipeline.length));
      pipeline = [...pipeline.slice(0, at), vuelve, ...pipeline.slice(at)];
    } else if (op.op === 'nutricion') {
      // El id se valida contra las nutriciones que ESTE pipeline puede tener, y no se
      // acepta crudo: `suppressed` es texto libre en un jsonb, así que sin esto se puede
      // llenar de ids que no significan nada y que nadie va a limpiar nunca.
      const posibles = new Set(
        generateFunnel(actual.pipeline, [], labels).transitions
          .filter((t) => t.category === 'nutricion')
          .map((t) => `${t.from}>${t.to}`),
      );
      if (!posibles.has(op.id)) return { ok: false, error: 'Esa nutrición no es de este embudo.' };
      const sup = new Set(actual.suppressed);
      // Todos los ids de la MISMA nutrición se escriben juntos: con uno solo, apagarla la
      // deja corriendo desde la otra etapa de la que sale.
      const ids = [...new Set([op.id, ...(op.tambien ?? [])])].filter((k) => posibles.has(k));
      for (const k of ids) { if (op.activa) sup.delete(k); else sup.add(k); }
      // ⚠️ Se guarda con el pipeline INTACTO: esta operación sólo toca `suppressed`.
      const conGanadoNut = conTerminales(actual.pipeline);
      if (funnelId != null) await saveFunnelDe(funnelId, conGanadoNut, [...sup], { labels });
      else await saveFunnelDefault(conGanadoNut, [...sup], { labels });
      bust(TAG.pipeline, TAG.leads);
      revalidatePath('/crm');
      revalidatePath('/funnel');
      return { ok: true };
    } else if (op.op === 'mover') {
      // ⚠️ SOLO SE MUEVE LO QUE VIVE EN EL PIPELINE. Las tres terminales derivadas
      // (`perdido`, `descal`, `noresp`) no están ahí: las agrega `generateFunnel` al final
      // en cada lectura, así que su lugar no es un dato que se pueda guardar. Moverlas
      // «funcionaría» —el guardado no fallaría— y la pantalla volvería a mostrarlas donde
      // estaban, que es la peor forma de no hacer nada.
      const i = pipeline.findIndex((st) => st.key === op.key);
      if (i < 0) return { ok: false, error: 'Esa etapa la pone MaKo al final del embudo y no se puede mover. Sí puedes cambiarle el nombre.' };
      const j = i + op.delta;
      if (j < 0 || j >= pipeline.length) return { ok: false, error: 'Esa etapa ya está en la punta.' };
      // El cierre va último: es de donde salen los datos de la venta, y `problemasDePipeline`
      // ya avisa cuando no lo está. Acá se impide de entrada en vez de dejar hacerlo y quejarse.
      if (pipeline[i].kind === 'cierre' || pipeline[j].kind === 'cierre') {
        return { ok: false, error: 'La etapa donde se cierra la venta va última.' };
      }
      // Y la de entrada va PRIMERA, por lo mismo: ni se mueve ni se la pasa por encima.
      if (pipeline[i].kind === 'entrada' || pipeline[j].kind === 'entrada') {
        return { ok: false, error: 'Por esa etapa entra tu gente: va primera.' };
      }
      const orden = [...pipeline];
      [orden[i], orden[j]] = [orden[j], orden[i]];
      pipeline = orden;
    } else {
      // La clave se acuña acá, en el server, y se comprueba contra el pipeline real: si se
      // eligiera en el navegador, dos pestañas abiertas acuñan la misma y la segunda pisa a
      // la primera sin que nada falle.
      let n = 0;
      let key = 'st0';
      while (pipeline.some((st) => st.key === key)) { n += 1; key = 'st' + n; }
      const label = (op.label ?? 'Nueva etapa').trim().replace(/\s+/g, ' ').slice(0, MAX_LABEL_ETAPA) || 'Nueva etapa';
      const nueva = { key, label, dot: '#5B6472', tone: 'neutral', kind: 'paso' } as Stage;
      // Se mete DESPUÉS de la etapa desde cuyo menú se pidió; sin referencia, antes del
      // cierre, que es donde una etapa nueva tiene sentido (el cierre va último).
      const iRef = op.despuesDe ? pipeline.findIndex((st) => st.key === op.despuesDe) : -1;
      const iCierre = pipeline.findIndex((st) => st.kind === 'cierre');
      const iEntrada = pipeline.findIndex((st) => st.kind === 'entrada');
      const at = Math.max(iEntrada + 1, iRef >= 0 ? iRef + 1 : (iCierre >= 0 ? iCierre : pipeline.length));
      pipeline = [...pipeline.slice(0, at), nueva, ...pipeline.slice(at)];
    }

    const conGanado = conTerminales(pipeline);
    if (funnelId != null) await saveFunnelDe(funnelId, conGanado, actual.suppressed, { labels });
    else await saveFunnelDefault(conGanado, actual.suppressed, { labels });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  bust(TAG.pipeline, TAG.leads);
  revalidatePath('/crm');
  revalidatePath('/funnel');
  return { ok: true, deshacer };
}
/**
 * Declara CÓMO ENTRA la gente a este negocio (y, si corresponde, dónde y cuándo
 * es su encuentro de fecha fija).
 *
 * Va separada de `saveFunnelAction` a propósito: el pipeline se autoguarda con un
 * debounce en cada tecla del editor, y esto se guarda cuando la persona confirma.
 * Mezclarlas haría que un tipeo cualquiera reescribiera una declaración.
 */
export async function declararEntradasAction(entradas: string[], evento: unknown, funnelId?: number): Promise<{ ok: true } | { ok: false; error: string }> {
  if ((await getRolWsEfectivo()) !== 'admin') return { ok: false, error: 'Solo el administrador del workspace puede declarar esto.' };
  // Se saneа con las MISMAS funciones que leen el jsonb: si el saneo de escritura
  // y el de lectura fueran dos, divergen y se guarda algo que después no se lee.
  const limpias = parseEntradas(entradas);
  if (!limpias.length) return { ok: false, error: 'Elige al menos una forma en la que te llega la gente.' };
  const ev = parseEvento(evento);
  try {
    // Sin `funnelId`, cómo entra la gente es del NEGOCIO. Con él, es el TOFU de
    // ESE funnel — que es justo lo que diferencia dos funnels entre sí.
    const actual = funnelId != null ? await getFunnelDe(funnelId) : await getFunnelDefault();
    // ⚠️ El mismo guard que ya tenía guardarEntradas (lib/api-mako/areas/crm.helpers.ts)
    // y que acá faltaba: con el funnel leído en ERROR lo que se lee es DEFAULT_PIPELINE,
    // y guardarlo le pisa al cliente su funnel real con la plantilla genérica. Una
    // caída de Supabase no puede reescribir un dato declarado.
    if (actual.origen === 'error') return { ok: false, error: 'No se pudo leer el funnel actual; no se guardó nada para no pisarlo. Vuelve a intentarlo.' };
    if (funnelId != null) await saveFunnelDe(funnelId, actual.pipeline, actual.suppressed, { entradas: limpias, evento: ev });
    else await saveFunnelDefault(actual.pipeline, actual.suppressed, { entradas: limpias, evento: ev });
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
