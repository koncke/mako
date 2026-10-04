// =============================================================================
// Queries de agregación para el dashboard
// =============================================================================
// getMarketingWindow(start, end) → suma métricas Meta + YouTube de un rango.
// Calcula ratios derivados (1 de cada X).
// =============================================================================

import { getTenantDb } from './workspace';
import { cachedRead, TAG, TTL } from './cache';
import { TIPO_DE_CAMBIO_USD_MXN, RECON_LEADS_VALIDACION, RECON_SPEND_SIN_LEADS_USD, VSL_PRUEBA_VIDEO_ID } from './config';
import { getCashCollectedPeriodo, getOutstandingPeriodo, getCuotasPendientes } from './pagos';
import { listReviewPendientes } from './review-queue';
import { getSettingNum, getSetting } from './settings';
import { lunesDeFecha, diasAntes, ayerEnTijuana } from './date-utils';
import {
  getVslEngagementMap,
  getVisitasLandingMap,
  estadoMadurezLead,
  faltantesDeLead,
  type Lead,
  type EstadoLead,
  type EstadoMadurez,
} from './leads';
import { getPipelineStagesDefault } from './funnels';
import { hayPasoDeWizard, tabDeSolucion, type Step } from './stage-requirements';
import { encuentroGrabable } from './encuentro-ws';
import { adjuntarFathomAutoThrottled } from './fathom-auto';
import { registrarEtapasDerivadas } from './etapa-historial';
import { etapaVigenteDe, slotDeReunion } from './funnel-etapas';
// QUÉ pasos tiene el tramo comercial de ESTE funnel (y de qué contador sale cada
// lado) lo decide UN módulo puro, para que no haya una segunda tabla de keys
// canónicas acá adentro. Ver la cabecera de lib/funnel-comercial.ts.
import {
  pasosComercialesDe,
  rolesComercialesDe,
  type ContadorComercial,
  type RolesComerciales,
} from './funnel-comercial';
import { leerTodo, leerPorPaginas, type OrdenPaginado, type ConsultaPaginada } from './supabase-paginado';

/**
 * Orden de TODO barrido de `marketing_metrics_daily` en este archivo.
 *
 * ⚠️ Las tres columnas son obligatorias y el `id` del final NO es adorno: hay
 * UNA FILA POR ANUNCIO POR DÍA (level=ad desde la mig 0009), así que ni `fecha`
 * ni `ad_id` son únicos, ni por separado ni juntos. Un orden con empates deja
 * que Postgres reparta las filas empatadas distinto en cada request → el
 * `.range()` de la página 2 se aplica sobre otro orden y salen filas repetidas y
 * filas salteadas, sin ningún error. Acá eso es spend y conversiones sumados de
 * más o de menos. Mismo molde que `ORDEN_METRICAS_CRONO` (lib/ads-analyst.ts) y
 * `ORDEN_META` (lib/metricas-negocio.ts).
 *
 * Y el motivo de que TODA lectura de esta tabla pase por el paginado: PostgREST
 * corta en 1000 filas y NO avisa (ver la cabecera de lib/supabase-paginado.ts).
 * Medido en prod el 02/09/2026 sobre el ws1: un mes son 334 filas, un trimestre
 * 838, y el histórico completo 1.614 — así que las tres lecturas SIN filtro de
 * fecha (`getCACAcumulado`, `listCACMensual`, `getRevenueMensual`) ya venían
 * cortadas, no era un riesgo futuro. La falla es silenciosa y siempre hacia
 * abajo: menos spend del real, así que el ROAS y el CAC salen MEJORES de lo que
 * son. Es la dirección que no hace sospechar; por eso no se descubre leyendo el
 * código sino preguntando cuántas filas tiene la tabla por unidad de tiempo.
 */
const ORDEN_METRICAS: OrdenPaginado = [{ col: 'fecha' }, { col: 'ad_id' }, { col: 'id' }];

/** La tabla de las métricas diarias, que este archivo lee en ocho lugares. */
const T_METRICAS = 'marketing_metrics_daily';

export type MarketingWindow = {
  // Rango
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
  dias_con_datos: number;

  // Etapas del funnel (con datos reales cuando están disponibles)
  impressions: number;            // Etapa 1 (Meta)
  landing_page_views: number;     // Etapa 2 (Meta Pixel)
  vsl_views: number | null;       // Etapa 3 (YouTube, null si no configurado)
  // Etapa 4. ⚠️ Son REUNIONES cuya fecha cae en el período (leads con
  // `fecha_junta_1` en rango), NO agendamientos: incluye las reservadas antes
  // del período y las que todavía no ocurrieron. Se llamaba `agendamientos` y su
  // comentario juraba `fecha_agenda`, columna que no lee ninguna query del repo.
  // Las dos preguntas son legítimas y distintas («cuántos reservaron en el
  // período» vs «cuántas reuniones hubo»); ésta contesta la segunda.
  reuniones_en_ventana: number;
  thanks_views: number | null;    // Etapa 5 (YouTube, video 9-min de intent real)

  // Métrica auxiliar (no es etapa del funnel, mide alcance de página Thanks)
  thanks_prep_views: number | null;
  thanks_prep_days_baseline_only: number;

  // Métricas Meta auxiliares
  clicks: number;
  link_clicks: number;
  leads_count: number;            // instant forms completados (Meta Insights) — etapa Click→Formulario (v3 Fase D)
  reach: number;
  spend_usd: number;

  // Cierres en la ventana (por fecha_cierre) + CAC = spend / cierres
  cierres_en_ventana: number;
  cac: number | null;

  // Derivadas
  ctr_global: number | null;
  cpc_global: number | null;
  cpm_global: number | null;
  cpl_global: number | null;

  // Ratios "1 de cada X"
  ratio_imp_landing: number | null;
  ratio_landing_vsl: number | null;     // null si no hay vsl_views
  ratio_vsl_agenda: number | null;      // null hasta Fase 4
  ratio_agenda_thanks: number | null;   // null hasta Fase 4

  // Días con baseline-only de YouTube (sin delta calculable)
  vsl_days_baseline_only: number;
  thanks_days_baseline_only: number;

  // Cumulativo histórico (vistas totales desde publicación del video)
  // No es del rango, es global — sirve para dar contexto cuando los deltas
  // diarios apenas empiezan.
  vsl_cumulative_total: number | null;
  thanks_cumulative_total: number | null;
  thanks_prep_cumulative_total: number | null;

  // Fechas de publicación (YYYY-MM-DD) — para que el "histórico" se contextualice
  vsl_published_at: string | null;
  thanks_published_at: string | null;
  thanks_prep_published_at: string | null;
};

type MetaRow = {
  fecha: string;
  impressions: number | null;
  landing_page_views: number | null;
  clicks: number | null;
  link_clicks: number | null;
  leads_count: number | null;
  reach: number | null;
  spend: number | null;
};

type YouTubeRow = {
  fecha: string;
  youtube_video_id: string | null;
  youtube_video_type: 'vsl' | 'thanks' | 'thanks_prep' | null;
  youtube_views: number | null;
};

function sum(arr: Array<number | null | undefined>): number {
  return arr.reduce<number>((acc, v) => acc + (typeof v === 'number' ? v : 0), 0);
}

function safeDiv(a: number, b: number): number | null {
  if (!b || !Number.isFinite(b)) return null;
  return a / b;
}

// Cacheado por-request con React cache(): dedup de llamadas con los mismos
// (start,end) dentro de un render (se invoca 3x en /marketing: directo, en
// getFunnelEtapas y en getResumenComparativo).
export const getMarketingWindow = cachedRead('getMarketingWindow', _getMarketingWindow, { tags: [TAG.marketing, TAG.leads], revalidate: TTL.cron });
async function _getMarketingWindow(
  start: string,
  end: string,
): Promise<MarketingWindow> {
  const supabase = (await getTenantDb());

  // Query del último cumulativo de cada video (raw_payload de la fila más
  // reciente, sin importar fecha — es la "vistas totales del video desde su
  // publicación", para dar contexto cuando el delta diario apenas arranca).
  const ytLatestRes = await supabase
    .from('marketing_metrics_daily')
    .select('youtube_video_type, raw_payload')
    .eq('plataforma', 'youtube')
    .order('created_at', { ascending: false })
    .limit(50); // suficiente para tener al menos 1 fila por video_type
  if (ytLatestRes.error) {
    throw new Error(`Query latest YouTube falló: ${ytLatestRes.error.message}`);
  }
  const ytLatestRows = (ytLatestRes.data ?? []) as Array<{
    youtube_video_type: 'vsl' | 'thanks' | 'thanks_prep' | null;
    raw_payload: { cumulative_views?: number; published_at?: string } | null;
  }>;
  function getLatest(type: 'vsl' | 'thanks' | 'thanks_prep') {
    return ytLatestRows.find((r) => r.youtube_video_type === type);
  }
  function isoToFecha(iso: string | undefined): string | null {
    if (!iso) return null;
    return iso.slice(0, 10); // YYYY-MM-DD
  }
  const vslLatest = getLatest('vsl');
  const thanksLatest = getLatest('thanks');
  const thanksPrepLatest = getLatest('thanks_prep');
  const vsl_cumulative_total = vslLatest?.raw_payload?.cumulative_views ?? null;
  const thanks_cumulative_total = thanksLatest?.raw_payload?.cumulative_views ?? null;
  const thanks_prep_cumulative_total = thanksPrepLatest?.raw_payload?.cumulative_views ?? null;
  const vsl_published_at = isoToFecha(vslLatest?.raw_payload?.published_at);
  const thanks_published_at = isoToFecha(thanksLatest?.raw_payload?.published_at);
  const thanks_prep_published_at = isoToFecha(thanksPrepLatest?.raw_payload?.published_at);

  // Query paralelas: meta + youtube + panda + leads (reuniones) + cierres.
  // Las tres de métricas van PAGINADAS (ver ORDEN_METRICAS): con una fila por
  // anuncio por día, un trimestre ya son 838 filas contra el techo de 1000.
  const enRango = (q: ConsultaPaginada) => q.gte('fecha', start).lte('fecha', end);
  const [metaRows, ytRows, pandaRows, leadsRes, cierresRes] = await Promise.all([
    leerTodo<MetaRow>(
      supabase, T_METRICAS,
      'id, fecha, ad_id, impressions, landing_page_views, clicks, link_clicks, leads_count, reach, spend',
      { orden: ORDEN_METRICAS, eq: { plataforma: 'meta' }, filtros: enRango },
    ),
    leerTodo<YouTubeRow>(
      supabase, T_METRICAS,
      'id, fecha, ad_id, youtube_video_id, youtube_video_type, youtube_views',
      { orden: ORDEN_METRICAS, eq: { plataforma: 'youtube' }, filtros: enRango },
    ),
    // Panda Video (Fase 5 v2): la fuente honesta del VSL en el presente
    leerTodo<{ fecha: string; video_plays: number | null }>(
      supabase, T_METRICAS, 'id, fecha, ad_id, video_plays',
      { orden: ORDEN_METRICAS, eq: { plataforma: 'panda' }, filtros: enRango },
    ),
    supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .gte('fecha_junta_1', start)
      .lte('fecha_junta_1', end),
    supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('cerro', true)
      .gte('fecha_cierre', start)
      .lte('fecha_cierre', end),
  ]);

  if (leadsRes.error) throw new Error(`Query leads falló: ${leadsRes.error.message}`);
  if (cierresRes.error) throw new Error(`Query cierres falló: ${cierresRes.error.message}`);

  const reuniones_en_ventana = leadsRes.count ?? 0;
  const cierres_en_ventana = cierresRes.count ?? 0;

  // ── Meta aggregates ──
  const impressions = sum(metaRows.map((r) => r.impressions));
  const landing_page_views = sum(metaRows.map((r) => r.landing_page_views));
  const clicks = sum(metaRows.map((r) => r.clicks));
  const link_clicks = sum(metaRows.map((r) => r.link_clicks));
  // Instant forms completados (Meta Insights) — denominador/numerador de las
  // etapas Click→Formulario y Formulario→Agenda (v3 Fase D).
  const leads_count = sum(metaRows.map((r) => r.leads_count));
  const reach = sum(metaRows.map((r) => r.reach));
  // Meta devuelve spend en MXN (la cuenta está en MXN). Convertimos a USD
  // ANTES de cualquier cálculo para que los ratios sean válidos contra el
  // revenue en USD. spend_usd ahora es realmente USD (antes era un alias
  // legacy que guardaba MXN).
  const spend_mxn = sum(metaRows.map((r) => r.spend));
  const spend_usd = spend_mxn / TIPO_DE_CAMBIO_USD_MXN;

  // ── YouTube aggregates por tipo ──
  const vslRows = ytRows.filter((r) => r.youtube_video_type === 'vsl');
  const thanksRows = ytRows.filter((r) => r.youtube_video_type === 'thanks');
  const thanksPrepRows = ytRows.filter((r) => r.youtube_video_type === 'thanks_prep');

  // Solo se cuentan días con dato (no null = delta calculado).
  const vslWithData = vslRows.filter((r) => r.youtube_views !== null);
  const thanksWithData = thanksRows.filter((r) => r.youtube_views !== null);
  const thanksPrepWithData = thanksPrepRows.filter((r) => r.youtube_views !== null);

  // VSL unificado: YouTube aporta la historia (24-abr a 10-jun), Panda el
  // presente. Sumamos los plays de Panda a las vistas YouTube del VSL.
  // (Fase 5 v2: youtube no contaba los embeds con autoplay → daba 0%.)
  const pandaPlays = sum(pandaRows.map((r) => r.video_plays));
  const vslYoutube = vslRows.length === 0 ? null : sum(vslWithData.map((r) => r.youtube_views));
  // VSL anterior de prueba (seed 0023): views reales de un VSL previo. Se suman
  // al total del VSL (igual que en la línea de Tendencias). Marcador por id, no
  // por tipo (su youtube_video_type es NULL).
  const vslPruebaRows = ytRows.filter((r) => r.youtube_video_id === VSL_PRUEBA_VIDEO_ID && r.youtube_views !== null);
  const vslPruebaViews = sum(vslPruebaRows.map((r) => r.youtube_views));
  const vsl_views =
    vslYoutube === null && pandaRows.length === 0 && vslPruebaRows.length === 0
      ? null
      : (vslYoutube ?? 0) + pandaPlays + vslPruebaViews;
  const thanks_views = thanksRows.length === 0 ? null : sum(thanksWithData.map((r) => r.youtube_views));
  const thanks_prep_views = thanksPrepRows.length === 0 ? null : sum(thanksPrepWithData.map((r) => r.youtube_views));

  const vsl_days_baseline_only = vslRows.length - vslWithData.length;
  const thanks_days_baseline_only = thanksRows.length - thanksWithData.length;
  const thanks_prep_days_baseline_only = thanksPrepRows.length - thanksPrepWithData.length;

  // ── Días con datos (algún row meta o youtube ese día) ──
  const fechasUnicas = new Set<string>();
  metaRows.forEach((r) => fechasUnicas.add(r.fecha));
  ytRows.forEach((r) => fechasUnicas.add(r.fecha));
  pandaRows.forEach((r) => fechasUnicas.add(r.fecha));

  // ── Ratios ──
  const ratio_imp_landing = safeDiv(impressions, landing_page_views);

  // Landing → VSL: solo si tenemos vsl_views > 0
  const ratio_landing_vsl =
    vsl_views !== null && vsl_views > 0
      ? safeDiv(landing_page_views, vsl_views)
      : null;

  // VSL → Reuniones: solo si tenemos ambos
  const ratio_vsl_agenda =
    vsl_views !== null && vsl_views > 0 && reuniones_en_ventana > 0
      ? safeDiv(vsl_views, reuniones_en_ventana)
      : null;

  // Reuniones → Thanks: de los que tienen reunión, cuántos vieron el video Thanks
  const ratio_agenda_thanks =
    reuniones_en_ventana > 0 && thanks_views !== null && thanks_views > 0
      ? safeDiv(reuniones_en_ventana, thanks_views)
      : null;

  return {
    start,
    end,
    dias_con_datos: fechasUnicas.size,

    impressions,
    landing_page_views,
    vsl_views,
    reuniones_en_ventana,
    thanks_views,

    clicks,
    link_clicks,
    leads_count,
    reach,
    spend_usd,

    cierres_en_ventana,
    cac: cierres_en_ventana > 0 ? safeDiv(spend_usd, cierres_en_ventana) : null,

    ctr_global: safeDiv(clicks, impressions) !== null ? safeDiv(clicks, impressions)! * 100 : null,
    cpc_global: safeDiv(spend_usd, clicks),
    cpm_global: safeDiv(spend_usd, impressions) !== null ? safeDiv(spend_usd, impressions)! * 1000 : null,
    cpl_global: safeDiv(spend_usd, landing_page_views),

    ratio_imp_landing,
    ratio_landing_vsl,
    ratio_vsl_agenda,
    ratio_agenda_thanks,

    vsl_days_baseline_only,
    thanks_days_baseline_only,

    thanks_prep_views,
    thanks_prep_days_baseline_only,

    vsl_cumulative_total,
    thanks_cumulative_total,
    thanks_prep_cumulative_total,

    vsl_published_at,
    thanks_published_at,
    thanks_prep_published_at,
  };
}

// =============================================================================
// COHORTES COMERCIALES — Fase 5
// =============================================================================

export type EstadoMadurezCohorte = 'madura' | 'madurando' | 'reciente';

export type CohorteSemana = {
  semana_inicio: string;
  total_j1: number;
  asistencias: number;
  limpias: number;
  cierres: number;
  ingreso_total_usd: number;
  ultima_j1_cohorte: string;
  dias_desde_ultima_j1: number;
  estado_madurez: EstadoMadurezCohorte;
  dias_promedio_ciclo: number | null; // J1 → cierre (agregado en 0013)
};

export type CohorteMes = {
  mes_inicio: string;
  total_j1: number;
  asistencias: number;
  limpias: number;
  cierres: number;
  ingreso_total_usd: number;
  ultima_j1_cohorte: string;
  dias_desde_ultima_j1: number;
  dias_promedio_ciclo: number | null;
  estado_madurez: EstadoMadurezCohorte;
};

/**
 * Últimas N semanas de cohortes, más recientes primero.
 */
export const listCohortesSemanales = cachedRead('listCohortesSemanales', _listCohortesSemanales, { tags: [TAG.leads], revalidate: TTL.user });
async function _listCohortesSemanales(limit = 8): Promise<CohorteSemana[]> {
  const supabase = (await getTenantDb());
  const { data, error } = await supabase
    .from('v_cohortes_semanales')
    .select('*')
    .order('semana_inicio', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Query v_cohortes_semanales falló: ${error.message}`);
  return (data ?? []) as CohorteSemana[];
}

/**
 * Últimos N meses de cohortes, más recientes primero.
 */
export const listCohortesMensuales = cachedRead('listCohortesMensuales', _listCohortesMensuales, { tags: [TAG.leads], revalidate: TTL.user });
async function _listCohortesMensuales(limit = 6): Promise<CohorteMes[]> {
  const supabase = (await getTenantDb());
  const { data, error } = await supabase
    .from('v_cohortes_mensuales')
    .select('*')
    .order('mes_inicio', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Query v_cohortes_mensuales falló: ${error.message}`);
  return (data ?? []) as CohorteMes[];
}

export type ResumenComercialMaduras = {
  // Solo cohortes madura — donde la tasa de cierre es confiable
  total_j1: number;
  asistencias: number;
  limpias: number;
  cierres: number;
  ingreso_total_usd: number;
  cohortes_maduras_count: number;
  // Tasa de cierre = ratio joya = cierres / limpias
  tasa_cierre_madura: number | null; // 0–100
  // Ciclo promedio (días J1 → cierre) — pondera por cohortes mensuales maduras
  dias_promedio_ciclo: number | null;
};

/**
 * Agrega las cohortes SEMANALES con estado_madurez='madura'.
 *
 * FUENTE DE VERDAD ÚNICA del KPI de no-show / ratio joya (Fase 8). Antes esto
 * leía las cohortes MENSUALES, y eso generaba el bug medido en producción:
 * el KPI de no-show daba 0% mientras la cohorte madura de la semana del 4-may
 * mostraba 75%. La causa: la madurez del mes se mide por su ÚLTIMO J1, así que
 * un único J1 tardío de fin de mes volvía 'reciente' a TODO el mes y excluía
 * del KPI semanas tempranas ya maduras (que la tabla sí mostraba como madura).
 *
 * Definición elegida: madurez a nivel SEMANA (cohorte madura ⇔ su último J1 fue
 * hace ≥14 días). Como una semana abarca ≤7 días, una semana madura implica que
 * TODOS sus leads tuvieron ≥14 días para convertir. El KPI agrega exactamente
 * las filas verdes de la tabla semanal → KPI y tabla cuentan lo mismo.
 */
export const getResumenComercialMaduras = cachedRead('getResumenComercialMaduras', _getResumenComercialMaduras, { tags: [TAG.leads], revalidate: TTL.user });
async function _getResumenComercialMaduras(start?: string | null, end?: string | null): Promise<ResumenComercialMaduras> {
  const supabase = (await getTenantDb());
  let q = supabase
    .from('v_cohortes_semanales')
    .select('*')
    .eq('estado_madurez', 'madura');
  // Respeta el filtro de fecha global: acota las cohortes maduras por su semana.
  if (start) q = q.gte('semana_inicio', start);
  if (end) q = q.lte('semana_inicio', end);
  const { data, error } = await q;
  if (error) throw new Error(`Query maduras falló: ${error.message}`);
  const cohortes = (data ?? []) as CohorteSemana[];

  const total_j1 = cohortes.reduce((s, c) => s + (c.total_j1 ?? 0), 0);
  const asistencias = cohortes.reduce((s, c) => s + (c.asistencias ?? 0), 0);
  const limpias = cohortes.reduce((s, c) => s + (c.limpias ?? 0), 0);
  const cierres = cohortes.reduce((s, c) => s + (c.cierres ?? 0), 0);
  const ingreso_total_usd = cohortes.reduce((s, c) => s + Number(c.ingreso_total_usd ?? 0), 0);

  // Tasa cierre = cierres / limpias (ratio joya)
  const tasa_cierre_madura = limpias > 0 ? (cierres / limpias) * 100 : null;

  // Ciclo: promedio ponderado por cierres de cada cohorte
  const cohortesConCiclo = cohortes.filter(
    (c) => c.dias_promedio_ciclo !== null && c.cierres > 0,
  );
  const totalCierresConCiclo = cohortesConCiclo.reduce((s, c) => s + c.cierres, 0);
  const dias_promedio_ciclo =
    totalCierresConCiclo > 0
      ? cohortesConCiclo.reduce(
          (s, c) => s + Number(c.dias_promedio_ciclo!) * c.cierres,
          0,
        ) / totalCierresConCiclo
      : null;

  return {
    total_j1,
    asistencias,
    limpias,
    cierres,
    ingreso_total_usd,
    cohortes_maduras_count: cohortes.length,
    tasa_cierre_madura,
    dias_promedio_ciclo,
  };
}

// =============================================================================
// Desgloses por lead para los pop-ups (drill-down)
// =============================================================================

/** Una agenda (lead con J1) para el desglose del "Resumen del mes". */
export type AgendaItem = {
  leadId: number;
  nombre: string;
  empresa: string | null;
  fecha: string | null; // fecha_junta_1
};

/** Leads con Junta 1 en [start, end] — fuente del desglose de Agendas (CRM). */
export async function getAgendasBreakdown(start: string, end: string): Promise<AgendaItem[]> {
  const supabase = (await getTenantDb());
  const { data, error } = await supabase
    .from('leads')
    .select('id, nombre, empresa, fecha_junta_1')
    .not('fecha_junta_1', 'is', null)
    .gte('fecha_junta_1', start)
    .lte('fecha_junta_1', end)
    .order('fecha_junta_1', { ascending: false });
  if (error) throw new Error(`getAgendasBreakdown falló: ${error.message}`);
  return (data ?? []).map((r) => ({
    leadId: Number(r.id),
    nombre: (r.nombre as string) ?? '—',
    empresa: (r.empresa as string | null) ?? null,
    fecha: (r.fecha_junta_1 as string | null) ?? null,
  }));
}

/** Un lead dentro del embudo de cohortes maduras (Salud del Funnel — Comercial). */
export type FunnelLeadItem = {
  leadId: number;
  nombre: string;
  empresa: string | null;
  fechaJ1: string | null;
  asistioJ1: boolean | null;
  calificado: boolean | null;
  cerro: boolean;
  monto: number | null;
  estado: EstadoLead;
};

export type FunnelMadurasLeads = {
  agenda: FunnelLeadItem[];      // todos los J1 de cohortes maduras (= total_j1)
  asistio: FunnelLeadItem[];     // asistio_j1 = true (= asistencias)
  noShow: FunnelLeadItem[];      // asistio_j1 != true (= total_j1 - asistencias)
  calificado: FunnelLeadItem[];  // asistió y calificado (= limpias)
  cierre: FunnelLeadItem[];      // cerro = true (= cierres)
};

/**
 * Leads del embudo de Comercial, bucketeados por etapa, restringidos a las
 * cohortes SEMANALES maduras — el MISMO set que cuenta getResumenComercialMaduras,
 * así los conteos del desglose cuadran exacto con el embudo.
 *
 * Replica DATE_TRUNC('week') con lunesDeFecha (lunes) y filtra por las semanas
 * que la vista marca 'madura' (misma CURRENT_DATE → mismo set).
 */
export async function getFunnelMadurasLeads(start?: string | null, end?: string | null): Promise<FunnelMadurasLeads> {
  const supabase = (await getTenantDb());
  const vacio: FunnelMadurasLeads = { agenda: [], asistio: [], noShow: [], calificado: [], cierre: [] };

  let sq = supabase
    .from('v_cohortes_semanales')
    .select('semana_inicio')
    .eq('estado_madurez', 'madura');
  if (start) sq = sq.gte('semana_inicio', start);
  if (end) sq = sq.lte('semana_inicio', end);
  const { data: semanas, error: semErr } = await sq;
  if (semErr) throw new Error(`getFunnelMadurasLeads (semanas) falló: ${semErr.message}`);
  const weeks = new Set<string>((semanas ?? []).map((r) => String(r.semana_inicio)));
  if (weeks.size === 0) return vacio;

  const starts = [...weeks].sort();
  const min = starts[0];
  const max = diasAntes(starts[starts.length - 1], -6); // domingo de la última semana

  const { data, error } = await supabase
    .from('leads')
    .select('id, nombre, empresa, fecha_junta_1, asistio_j1, calificado, cerro, monto_cierre_usd, estado_lead')
    .not('fecha_junta_1', 'is', null)
    .gte('fecha_junta_1', min)
    .lte('fecha_junta_1', max)
    .order('fecha_junta_1', { ascending: false });
  if (error) throw new Error(`getFunnelMadurasLeads (leads) falló: ${error.message}`);

  const out: FunnelMadurasLeads = { agenda: [], asistio: [], noShow: [], calificado: [], cierre: [] };
  for (const r of (data ?? []) as Array<{ id: number; nombre: string | null; empresa: string | null; fecha_junta_1: string; asistio_j1: boolean | null; calificado: boolean | null; cerro: boolean | null; monto_cierre_usd: number | null; estado_lead: EstadoLead }>) {
    if (!weeks.has(lunesDeFecha(r.fecha_junta_1.slice(0, 10)))) continue;
    const it: FunnelLeadItem = {
      leadId: Number(r.id),
      nombre: r.nombre ?? '—',
      empresa: r.empresa ?? null,
      fechaJ1: r.fecha_junta_1 ?? null,
      asistioJ1: r.asistio_j1,
      calificado: r.calificado,
      cerro: r.cerro === true,
      monto: r.monto_cierre_usd ?? null,
      estado: r.estado_lead,
    };
    out.agenda.push(it);
    if (it.asistioJ1 === true) out.asistio.push(it); else out.noShow.push(it);
    if (it.asistioJ1 === true && it.calificado === true) out.calificado.push(it);
    if (it.cerro) out.cierre.push(it);
  }
  return out;
}

/**
 * Leads con Junta 1 para los desgloses de las filas de Cohortes.
 * `minFecha` acota al rango que realmente se renderiza (las ~8 semanas / 6 meses
 * más recientes) en vez de escanear toda la tabla.
 */
export async function getJ1Leads(minFecha?: string): Promise<FunnelLeadItem[]> {
  const supabase = (await getTenantDb());
  let q = supabase
    .from('leads')
    .select('id, nombre, empresa, fecha_junta_1, asistio_j1, calificado, cerro, monto_cierre_usd, estado_lead')
    .not('fecha_junta_1', 'is', null);
  if (minFecha) q = q.gte('fecha_junta_1', minFecha);
  const { data, error } = await q.order('fecha_junta_1', { ascending: false });
  if (error) throw new Error(`getJ1Leads falló: ${error.message}`);
  return (data ?? []).map((r) => ({
    leadId: Number(r.id),
    nombre: (r.nombre as string) ?? '—',
    empresa: (r.empresa as string | null) ?? null,
    fechaJ1: (r.fecha_junta_1 as string | null) ?? null,
    asistioJ1: (r.asistio_j1 as boolean | null) ?? null,
    calificado: (r.calificado as boolean | null) ?? null,
    cerro: r.cerro === true,
    monto: (r.monto_cierre_usd as number | null) ?? null,
    estado: r.estado_lead as EstadoLead,
  }));
}

/** Un lead con su ciclo completo (agenda → pago) para el desglose de SCL. */
export type SCLLeadItem = {
  leadId: number;
  nombre: string;
  agenda: string | null;
  j1: string | null;
  j2: string | null;
  confirmacion: string | null;
  pago: string | null;
  dias: number;
};

/**
 * Leads con ciclo completo (fecha_agenda y fecha_primer_pago) — misma base que
 * getSCL. Devuelve sus fechas intermedias y la duración total agenda→pago.
 */
export async function getSCLLeads(): Promise<SCLLeadItem[]> {
  const supabase = (await getTenantDb());
  const { data, error } = await supabase
    .from('leads')
    .select('id, nombre, fecha_agenda, fecha_junta_1, fecha_junta_2, fecha_confirmacion, fecha_primer_pago')
    .not('fecha_agenda', 'is', null)
    .not('fecha_primer_pago', 'is', null);
  if (error) throw new Error(`getSCLLeads falló: ${error.message}`);

  const out: SCLLeadItem[] = [];
  for (const r of (data ?? []) as Array<{ id: number; nombre: string | null; fecha_agenda: string; fecha_junta_1: string | null; fecha_junta_2: string | null; fecha_confirmacion: string | null; fecha_primer_pago: string }>) {
    const [ay, am, ad] = r.fecha_agenda.split('-').map(Number);
    const [py, pm, pd] = r.fecha_primer_pago.split('-').map(Number);
    const dias = Math.floor((Date.UTC(py, pm - 1, pd) - Date.UTC(ay, am - 1, ad)) / 86400000);
    if (dias < 0) continue;
    out.push({
      leadId: Number(r.id),
      nombre: r.nombre ?? '—',
      agenda: r.fecha_agenda,
      j1: r.fecha_junta_1,
      j2: r.fecha_junta_2,
      confirmacion: r.fecha_confirmacion,
      pago: r.fecha_primer_pago,
      dias,
    });
  }
  return out.sort((a, b) => b.dias - a.dias);
}

// =============================================================================
// CAC acumulado (global, todo el histórico desde 1-may-2026)
// =============================================================================
// Sirve como referencia de "estado actual" del negocio. Para ver si MEJORAMOS
// mes a mes se debe comparar el CAC de la ventana mensual (mes en curso) vs
// este acumulado o vs meses anteriores.
// =============================================================================

// Toda la app expresa montos en USD post-Fase 1. El spend de Meta llega en
// MXN desde la API; convertimos antes de retornar para que los ratios sean
// matemáticamente válidos.
export type CACAcumulado = {
  spend_total_usd: number;       // convertido desde MXN
  cierres_total: number;
  cac_usd: number | null;        // USD / cliente
};

export const getCACAcumulado = cachedRead('getCACAcumulado', _getCACAcumulado, { tags: [TAG.marketing, TAG.leads], revalidate: TTL.cron });
async function _getCACAcumulado(hastaFecha?: string): Promise<CACAcumulado> {
  const supabase = (await getTenantDb());

  // ⚠️ Sin filtro de fecha: es TODO el histórico, la lectura más grande que este
  // archivo le hace a la tabla. Medida el 02/09/2026 en el ws1 son 1.614 filas,
  // así que sin paginar venía cortada en 1.000 y el CAC acumulado se calculaba
  // con el 62% del gasto — más barato de lo real, que es la dirección que nadie
  // sospecha.
  const spendRowsP = leerTodo<{ spend: number | null }>(
    supabase, T_METRICAS, 'id, fecha, ad_id, spend',
    {
      orden: ORDEN_METRICAS,
      eq: { plataforma: 'meta' },
      filtros: (q) => (hastaFecha ? q.lte('fecha', hastaFecha) : q),
    },
  );

  let cierresQuery = supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('cerro', true);
  if (hastaFecha) cierresQuery = cierresQuery.lte('fecha_cierre', hastaFecha);

  const [spendRows, cierresRes] = await Promise.all([spendRowsP, cierresQuery]);

  if (cierresRes.error) throw new Error(`Query cierres acumulado falló: ${cierresRes.error.message}`);

  const spend_total_mxn = spendRows.reduce(
    (acc, r) => acc + Number(r.spend ?? 0),
    0,
  );
  const spend_total_usd = spend_total_mxn / TIPO_DE_CAMBIO_USD_MXN;
  const cierres_total = cierresRes.count ?? 0;
  const cac_usd = cierres_total > 0 ? spend_total_usd / cierres_total : null;

  return { spend_total_usd, cierres_total, cac_usd };
}

// =============================================================================
// Revenue del período — Prompt 4
// =============================================================================
// Sección 'Revenue del período':
//   - Sold Revenue: SUM(monto_cierre_usd) de leads con cerro=true y
//     fecha_cierre dentro del período (en USD)
//   - Cash Collected: SUM(total_cobrado_usd) de leads con fecha_primer_pago
//     dentro del período (en USD)
//   - Outstanding: Sold Revenue - Cash Collected
//
// Sección 'Eficiencia':
//   - Meta Spend del período: SUM(spend) de marketing_metrics_daily donde
//     plataforma='meta' (en MXN — Meta cobra en pesos)
//   - CAC real: Meta Spend / cantidad de leads con fecha_primer_pago en el
//     período (¡es MXN/cliente, mezclar con USD daría sin sentido!)
//   - ROAS cash: Cash Collected (USD) / Meta Spend (MXN) — magnitud "x" sin
//     unidad porque mezclamos monedas; igual sirve como tendencia
//   - ROAS sold: Sold Revenue (USD) / Meta Spend (MXN) — idem
// =============================================================================

export type RevenuePeriod = {
  start: string;
  end: string;

  // Revenue del período (USD)
  sold_revenue_usd: number;
  cash_collected_usd: number;
  outstanding_usd: number;

  // Conteos de soporte
  cierres_en_periodo: number;
  primeros_pagos_en_periodo: number;

  // Eficiencia — TODO en USD post-Fase 1 (spend convertido vía
  // TIPO_DE_CAMBIO_USD_MXN). Los ROAS ahora son matemáticamente válidos.
  meta_spend_usd: number;
  cac_usd: number | null;        // USD por cliente nuevo (con primer pago)
  roas_cash: number | null;      // Cash USD ÷ Spend USD — ratio válido
  roas_sold: number | null;      // Sold USD ÷ Spend USD — ratio válido
};

// ── MRR — ingreso recurrente de suscripciones activas (#363 F3) ──────────────
// Se muestra APARTE del high-ticket único (los deals de suscripción NO tocan
// monto_cierre_usd, así que NO están en el "sold"/"cash" de arriba). Activa =
// ganado + venta_tipo='suscripcion' + (indefinida O aún dentro del plazo fijo).
export type MrrResumen = { mrr: number; activas: number };

/** yyyy-mm-dd + n meses (conserva el día lo mejor posible). Para el fin de plazo. */
function isoMasMeses(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m - 1) + n, d));
  return dt.toISOString().slice(0, 10);
}

export const getMrrActivo = cachedRead('getMrrActivo', _getMrrActivo, { tags: [TAG.leads], revalidate: TTL.user });
async function _getMrrActivo(hoy: string = new Date().toISOString().slice(0, 10)): Promise<MrrResumen> {
  const supabase = (await getTenantDb());
  const { data, error } = await supabase
    .from('leads')
    .select('suscripcion_monto_usd, suscripcion_meses, fecha_cierre')
    .eq('venta_tipo', 'suscripcion')
    .eq('estado_lead', 'ganado');
  if (error) throw new Error(`getMrrActivo falló: ${error.message}`);
  let mrr = 0;
  let activas = 0;
  for (const r of (data ?? []) as Array<{ suscripcion_monto_usd: number | null; suscripcion_meses: number | null; fecha_cierre: string | null }>) {
    const monto = r.suscripcion_monto_usd ?? 0;
    if (monto <= 0) continue;
    // Plazo fijo con fecha de cierre → activa mientras el fin del plazo sea >= hoy.
    // Indefinida (o sin fecha de cierre) → activa.
    const activa = r.suscripcion_meses && r.suscripcion_meses > 0 && r.fecha_cierre
      ? isoMasMeses(r.fecha_cierre, r.suscripcion_meses) >= hoy
      : true;
    if (activa) { mrr += monto; activas++; }
  }
  return { mrr, activas };
}

// Cacheado por-request: se invoca 2x con el mismo rango en /comercial y /marketing.
export const getRevenuePeriod = cachedRead('getRevenuePeriod', _getRevenuePeriod, { tags: [TAG.pagos, TAG.leads, TAG.marketing], revalidate: TTL.user });
async function _getRevenuePeriod(
  start: string,
  end: string,
): Promise<RevenuePeriod> {
  const supabase = (await getTenantDb());

  // cash_collected y outstanding ahora salen de la tabla `pagos` (Fase 8-bis):
  //   cash    = Σ pagos pagado=true con fecha_pago en el período (inflow real,
  //             incluye cuotas de clientes cerrados en meses previos).
  //   outstanding = Σ pagos no pagados (receivables totales, NO acotado al
  //             período) — es lo que falta cobrar en todo el pipeline.
  const [soldRes, cash_collected_usd, outstanding_usd, spendRes, primerosPagosCountRes] =
    await Promise.all([
      // Sold: cerros del período
      supabase
        .from('leads')
        .select('monto_cierre_usd')
        .eq('cerro', true)
        .gte('fecha_cierre', start)
        .lte('fecha_cierre', end),
      getCashCollectedPeriodo(start, end),
      getOutstandingPeriodo(start, end),
      // Spend Meta del período (MXN). PAGINADO: con una fila por anuncio por
      // día (hasta 28/día en el ws1, medido 17/09/2026) un rango de ~5 meses ya
      // pasa las 1000 filas, y el `.select()` suelto devolvía el gasto cortado
      // → CAC y ROAS mejores que los reales, la dirección que nadie sospecha.
      leerTodo<{ spend: number | null }>(
        supabase, T_METRICAS, 'id, fecha, ad_id, spend',
        { orden: ORDEN_METRICAS, eq: { plataforma: 'meta' }, filtros: (q) => q.gte('fecha', start).lte('fecha', end) },
      ),
      // Count de clientes con primer pago en el período (denominador del CAC real)
      supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .gte('fecha_primer_pago', start)
        .lte('fecha_primer_pago', end),
    ]);

  if (soldRes.error) throw new Error(`Sold falló: ${soldRes.error.message}`);
  if (primerosPagosCountRes.error) {
    throw new Error(`Primeros pagos count falló: ${primerosPagosCountRes.error.message}`);
  }

  const sold_revenue_usd = (soldRes.data ?? []).reduce(
    (acc, r) => acc + Number(r.monto_cierre_usd ?? 0),
    0,
  );
  // outstanding_usd ya viene de getOutstandingTotal() arriba (Σ cuotas no pagadas)

  const meta_spend_mxn = spendRes.reduce(
    (acc, r) => acc + Number(r.spend ?? 0),
    0,
  );
  // Convertir a USD ANTES de cualquier ratio (Fase 1 del mentor)
  const meta_spend_usd = meta_spend_mxn / TIPO_DE_CAMBIO_USD_MXN;

  const cierres_en_periodo = (soldRes.data ?? []).length;
  const primeros_pagos_en_periodo = primerosPagosCountRes.count ?? 0;

  const cac_usd =
    primeros_pagos_en_periodo > 0 ? meta_spend_usd / primeros_pagos_en_periodo : null;
  const roas_cash =
    meta_spend_usd > 0 ? cash_collected_usd / meta_spend_usd : null;
  const roas_sold =
    meta_spend_usd > 0 ? sold_revenue_usd / meta_spend_usd : null;

  return {
    start,
    end,
    sold_revenue_usd,
    cash_collected_usd,
    outstanding_usd,
    cierres_en_periodo,
    primeros_pagos_en_periodo,
    meta_spend_usd,
    cac_usd,
    roas_cash,
    roas_sold,
  };
}

// =============================================================================
// SCL — Sales Cycle Length (Prompt 5)
// =============================================================================
// Días entre fecha_agenda y fecha_primer_pago. Solo cuenta leads que tengan
// AMBAS fechas. Devuelve promedio y P90 (percentil 90 = el 10% más lento).
//
// Es distinto del dias_promedio_ciclo (J1 → cierre) que ya está en
// v_cohortes_mensuales — ese mide cuándo se cierra la venta, no cuándo se
// hace el primer pago real.
//
// Si hay <3 leads con ambas fechas, devolvemos null en ambos números — no es
// honesto mostrar un promedio con muy pocos datos.
// =============================================================================

export type SCL = {
  count: number;
  avg_dias: number | null;
  p90_dias: number | null;
};

export const getSCL = cachedRead('getSCL', _getSCL, { tags: [TAG.leads], revalidate: TTL.user });
async function _getSCL(): Promise<SCL> {
  const supabase = (await getTenantDb());
  const { data, error } = await supabase
    .from('leads')
    .select('fecha_agenda, fecha_primer_pago')
    .not('fecha_agenda', 'is', null)
    .not('fecha_primer_pago', 'is', null);

  if (error) throw new Error(`Query SCL falló: ${error.message}`);

  const rows = (data ?? []) as Array<{ fecha_agenda: string; fecha_primer_pago: string }>;

  // Calcular días para cada lead. Trabajamos en UTC para evitar issues de DST.
  const dias: number[] = [];
  for (const r of rows) {
    const [ay, am, ad] = r.fecha_agenda.split('-').map(Number);
    const [py, pm, pd] = r.fecha_primer_pago.split('-').map(Number);
    const agenda = Date.UTC(ay, am - 1, ad);
    const pago = Date.UTC(py, pm - 1, pd);
    const d = Math.floor((pago - agenda) / (1000 * 60 * 60 * 24));
    if (d >= 0) dias.push(d); // ignoramos negativos (pago antes de agenda = data corrupta)
  }

  const count = dias.length;

  if (count < 3) {
    return { count, avg_dias: null, p90_dias: null };
  }

  const avg_dias = dias.reduce((s, d) => s + d, 0) / count;

  // P90: ordenamos asc, tomamos el valor en la posición floor(0.9 * (n-1))
  const sorted = [...dias].sort((a, b) => a - b);
  const idx = Math.floor(0.9 * (count - 1));
  const p90_dias = sorted[idx];

  return { count, avg_dias, p90_dias };
}

// =============================================================================
// Distribución del pipeline activo (Prompt 10)
// =============================================================================
// Leads "activos" = asistio_j1=true Y cerro distinto de true (no cerraron
// todavía y siguen en el embudo). Los clasificamos por madurez vs hoy real
// usando los mismos thresholds que estadoMadurezLead.
// =============================================================================

export type DistribucionPipeline = {
  total: number;
  reciente: number;          // <5d desde J1
  madurando: number;         // 5-13d
  madura: number;            // ≥14d
  pct_reciente: number;      // 0-100
  pct_madurando: number;
  pct_madura: number;
};

export async function getDistribucionPipeline(): Promise<DistribucionPipeline> {
  const supabase = (await getTenantDb());

  // Activos = asistieron J1 y NO han cerrado (cerro != true)
  const { data, error } = await supabase
    .from('leads')
    .select('fecha_junta_1, cerro, asistio_j1')
    .eq('asistio_j1', true);

  if (error) throw new Error(`Query distribución pipeline falló: ${error.message}`);

  const activos = (data ?? []).filter((r) => r.cerro !== true && r.fecha_junta_1);

  // Hoy en UTC (consistente con estadoMadurezLead)
  const ahora = new Date();
  const hoyUTC = Date.UTC(
    ahora.getUTCFullYear(),
    ahora.getUTCMonth(),
    ahora.getUTCDate(),
  );

  let reciente = 0;
  let madurando = 0;
  let madura = 0;

  for (const r of activos) {
    if (!r.fecha_junta_1) continue;
    const [y, m, d] = r.fecha_junta_1.split('-').map(Number);
    const fechaJ1UTC = Date.UTC(y, m - 1, d);
    const dias = Math.floor((hoyUTC - fechaJ1UTC) / (1000 * 60 * 60 * 24));
    if (dias >= 14) madura++;
    else if (dias >= 5) madurando++;
    else reciente++;
  }

  const total = reciente + madurando + madura;
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);

  return {
    total,
    reciente,
    madurando,
    madura,
    pct_reciente: pct(reciente),
    pct_madurando: pct(madurando),
    pct_madura: pct(madura),
  };
}

// =============================================================================
// CAC mensual (Prompt 11)
// =============================================================================
// CAC del mes = SUM(spend Meta del mes USD) / leads con fecha_primer_pago en
// el mismo mes. USD/cliente. Solo retornamos meses con ≥1 primer pago.
//
// Post-Fase 1: spend convertido a USD vía TIPO_DE_CAMBIO_USD_MXN.
//
// Se devuelve la lista ordenada cronológicamente (más viejo → más reciente),
// limitada a últimos N meses con datos.
// =============================================================================

export type CACMensualEntry = {
  mes: string;              // 'YYYY-MM'
  spend_usd: number;        // convertido desde MXN
  primeros_pagos: number;
  cac_usd: number;          // USD por cliente — siempre definido (>0 por filtro)
};

export async function listCACMensual(limit = 12): Promise<CACMensualEntry[]> {
  const supabase = (await getTenantDb());

  // Pull spend Meta + leads con fecha_primer_pago en paralelo.
  // ⚠️ El spend NO lleva filtro de fecha (la serie cubre todos los meses con
  // pagos), así que es el histórico entero: paginado obligatorio. Y como de cada
  // fila sólo sobrevive un acumulador por mes, va con `leerPorPaginas` — juntar
  // el histórico en un array para terminar con un Map de doce claves es memoria
  // tirada (la misma razón que en lib/ads-analyst.ts).
  const spendPorMes = new Map<string, number>();
  const [, pagosRes] = await Promise.all([
    leerPorPaginas<{ fecha: string | null; spend: number | null }>(
      supabase, T_METRICAS, 'id, fecha, ad_id, spend',
      (filas) => {
        for (const r of filas) {
          if (!r.fecha) continue;
          const ym = r.fecha.slice(0, 7); // YYYY-MM
          spendPorMes.set(ym, (spendPorMes.get(ym) ?? 0) + Number(r.spend ?? 0));
        }
      },
      { orden: ORDEN_METRICAS, eq: { plataforma: 'meta' } },
    ),
    supabase
      .from('leads')
      .select('fecha_primer_pago')
      .not('fecha_primer_pago', 'is', null),
  ]);

  if (pagosRes.error) throw new Error(`Pagos mensual falló: ${pagosRes.error.message}`);

  // Contar primeros pagos por YYYY-MM
  const pagosPorMes = new Map<string, number>();
  for (const r of pagosRes.data ?? []) {
    if (!r.fecha_primer_pago) continue;
    const ym = r.fecha_primer_pago.slice(0, 7);
    pagosPorMes.set(ym, (pagosPorMes.get(ym) ?? 0) + 1);
  }

  // Solo meses con ≥1 primer pago
  const entries: CACMensualEntry[] = [];
  for (const [mes, primeros_pagos] of pagosPorMes) {
    if (primeros_pagos <= 0) continue;
    const spend_mxn = spendPorMes.get(mes) ?? 0;
    const spend_usd = spend_mxn / TIPO_DE_CAMBIO_USD_MXN;
    entries.push({
      mes,
      spend_usd,
      primeros_pagos,
      cac_usd: spend_usd / primeros_pagos,
    });
  }

  // Ordenar cronológicamente y truncar
  entries.sort((a, b) => a.mes.localeCompare(b.mes));
  return entries.slice(-limit);
}

// =============================================================================
// Ingresos vs gasto mensual (gráfico de línea de Comercial)
// =============================================================================
// Una fila por mes del rango (continua, incluye meses en cero): cuánto se cerró
// (sold), cuánto entró (cash cobrado) y cuánto se gastó en ads (Meta, USD). Sirve
// para ver la evolución mes a mes y comparar inversión vs resultados.

export type RevenueMensualPunto = {
  mes: string;        // 'YYYY-MM'
  label: string;      // etiqueta de eje, p.ej. 'jun 26'
  sold_usd: number;   // Sold Revenue: monto firmado de cierres con fecha_cierre en el mes
  cash_usd: number;   // Cash Collected: pagos cobrados con fecha_pago en el mes
  spend_usd: number;  // Ad Spend (Meta), convertido a USD
  cierres: number;    // cantidad de cierres (fecha_cierre en el mes)
  agendas: number;    // cantidad de agendas (fecha_junta_1 en el mes)
};

export const getRevenueMensual = cachedRead('getRevenueMensual', _getRevenueMensual, { tags: [TAG.leads, TAG.pagos, TAG.marketing], revalidate: TTL.user });
// mesesMax = ventana de búsqueda; el resultado RECORTA los meses iniciales sin
// ningún dato (no se extiende antes del primer mes con actividad).
async function _getRevenueMensual(hasta: string, mesesMax = 18): Promise<RevenueMensualPunto[]> {
  const supabase = (await getTenantDb());
  const [hy, hm] = hasta.split('-').map(Number);
  const months: string[] = [];
  for (let i = mesesMax - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(hy, hm - 1 - i, 1));
    months.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  const start = `${months[0]}-01`;

  // ⚠️ `mesesMax` son 18 meses por defecto, o sea prácticamente todo el histórico
  // de la tabla (1.614 filas medidas): paginado. Sin él, este gráfico venía
  // pintando el spend de los meses que entraran en las primeras 1.000 filas — y
  // sin ORDER BY, cuáles entraban no estaba ni definido.
  const [soldRes, cashRes, spendRows, agendaRes] = await Promise.all([
    supabase.from('leads').select('fecha_cierre, monto_cierre_usd').eq('cerro', true).gte('fecha_cierre', start),
    supabase.from('pagos').select('fecha_pago, monto_usd').eq('pagado', true).gte('fecha_pago', start),
    leerTodo<{ fecha: string | null; spend: number | null }>(
      supabase, T_METRICAS, 'id, fecha, ad_id, spend',
      { orden: ORDEN_METRICAS, eq: { plataforma: 'meta' }, filtros: (q) => q.gte('fecha', start) },
    ),
    supabase.from('leads').select('fecha_junta_1').not('fecha_junta_1', 'is', null).gte('fecha_junta_1', start),
  ]);
  if (soldRes.error) throw new Error(`Revenue mensual (sold): ${soldRes.error.message}`);
  if (cashRes.error) throw new Error(`Revenue mensual (cash): ${cashRes.error.message}`);
  if (agendaRes.error) throw new Error(`Revenue mensual (agendas): ${agendaRes.error.message}`);

  const sold = new Map<string, number>();
  const cierres = new Map<string, number>();
  const cash = new Map<string, number>();
  const spendMxn = new Map<string, number>();
  const agendas = new Map<string, number>();
  for (const r of (soldRes.data ?? []) as Array<{ fecha_cierre: string | null; monto_cierre_usd: number | null }>) {
    if (!r.fecha_cierre) continue;
    const ym = r.fecha_cierre.slice(0, 7);
    sold.set(ym, (sold.get(ym) ?? 0) + Number(r.monto_cierre_usd ?? 0));
    cierres.set(ym, (cierres.get(ym) ?? 0) + 1);
  }
  for (const r of (cashRes.data ?? []) as Array<{ fecha_pago: string | null; monto_usd: number | null }>) {
    if (!r.fecha_pago) continue;
    const ym = r.fecha_pago.slice(0, 7);
    cash.set(ym, (cash.get(ym) ?? 0) + Number(r.monto_usd ?? 0));
  }
  for (const r of spendRows) {
    if (!r.fecha) continue;
    const ym = r.fecha.slice(0, 7);
    spendMxn.set(ym, (spendMxn.get(ym) ?? 0) + Number(r.spend ?? 0));
  }
  for (const r of (agendaRes.data ?? []) as Array<{ fecha_junta_1: string | null }>) {
    if (!r.fecha_junta_1) continue;
    const ym = r.fecha_junta_1.slice(0, 7);
    agendas.set(ym, (agendas.get(ym) ?? 0) + 1);
  }

  const labelDe = (ym: string) => {
    const [y, m] = ym.split('-').map(Number);
    return new Intl.DateTimeFormat('es-MX', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1)));
  };

  const puntos = months.map((ym) => ({
    mes: ym,
    label: labelDe(ym),
    sold_usd: Math.round(sold.get(ym) ?? 0),
    cash_usd: Math.round(cash.get(ym) ?? 0),
    spend_usd: Math.round((spendMxn.get(ym) ?? 0) / TIPO_DE_CAMBIO_USD_MXN),
    cierres: cierres.get(ym) ?? 0,
    agendas: agendas.get(ym) ?? 0,
  }));

  // Recortar meses iniciales sin ningún dato (no extender antes del primer mes activo).
  const primerActivo = puntos.findIndex((p) => p.sold_usd || p.cash_usd || p.spend_usd || p.cierres || p.agendas);
  return primerActivo <= 0 ? puntos : puntos.slice(primerActivo);
}


// =============================================================================
// FASE 8 — queries para el rediseño visual
// =============================================================================

// ─────────────────────────────────────────────────────────────────────────────
// Funnel de 6 etapas (Prompt 8B) — conversiones entre etapas en un rango
// ─────────────────────────────────────────────────────────────────────────────

export type BloqueFunnel = 'marketing' | 'puente' | 'comercial';

export type FunnelEtapa = {
  key: string;
  label: string;
  bloque: BloqueFunnel;        // marketing / puente (cruza sistemas) / comercial
  entrada: number;
  salida: number;
  pct: number | null;          // salida/entrada * 100, null si entrada=0
  benchmark: string;           // texto del tooltip de info
  // Umbrales para el bullet bar (bandas) y la salud. max = tope de la escala.
  umbral: { rojo: number; ambar: number; max: number };
  salud: 'verde' | 'ambar' | 'rojo' | 'sin_datos';
  fuenteKey: string | null;    // qué fuente alimenta esta etapa (null = carga manual)
  fuente_pendiente: boolean;   // true si su fuente está off (Fase 7) → no es 0%, no existe
  muestra_chica: boolean;      // true si el denominador < 3 → mostrar conteo, no %
  // v3 Fase D: etapas de CONTENIDO (landing/VSL) que viven fuera del camino
  // principal Click→Formulario→Agenda. Son informativas y NO compiten por ser
  // el cuello de botella (el instant form vive ANTES de la landing).
  contexto: boolean;
};

export type FunnelMes = {
  etapas: FunnelEtapa[];
  cuelloKey: string | null;    // etapa con peor conversión (entre las que tienen datos)
  /**
   * Dónde está cada número del tramo comercial EN ESTE funnel. Viaja acá —y no lo
   * vuelve a resolver cada consumidor— porque el que ya leyó el funnel es esta
   * función: dos resoluciones de la misma pregunta son dos cosas que divergen, y
   * la segunda además pagaría otra lectura a la base.
   */
  roles: RolesComerciales;
};

// Mínimo de denominador para tratar un % como confiable (Fase 7)
export const MIN_MUESTRA = 3;

export async function getFunnelEtapas(
  start: string,
  end: string,
  sourceMap?: Record<string, 'ok' | 'stale' | 'off'>,
): Promise<FunnelMes> {
  const supabase = (await getTenantDb());

  // El funnel del workspace. No entra por parámetro a propósito: ninguno de los
  // cuatro llamadores lo tiene en la mano, y un parámetro opcional que nadie pasa
  // es un segundo lugar donde esta pregunta se puede contestar distinto.
  // Que la lectura falle NO cambia nada: `pasosComercialesDe(null)` cae al tramo de
  // dos reuniones, que es exactamente lo que esta función hacía siempre.
  const stages = await getPipelineStagesDefault().catch(() => null);
  const pasosComerciales = pasosComercialesDe(stages);
  const roles = rolesComercialesDe(stages);
  // Los contadores de la cohorte del ALTA sólo los pide el tramo SIN reuniones, y
  // son una consulta más: se piden únicamente si algún paso los nombra. Un funnel
  // de reuniones no paga nada por esto.
  const necesitaEntradas = pasosComerciales.some(
    (p) => p.entrada === 'entradas' || p.salida === 'cierres_entradas',
  );

  // La cohorte del ALTA se pide como COUNT y no como filas: acá sólo hacen falta
  // dos totales, y un `.select()` de filas topea en las 1000 de PostgREST sin dar
  // error — con 1.066 leads en un workspace, eso es un total redondo que miente.
  const altaDesde = `${start}T00:00:00Z`;
  const altaHasta = `${end}T23:59:59Z`;

  const [mkt, leadsRes, altasRes, altasGanadasRes] = await Promise.all([
    getMarketingWindow(start, end),
    supabase
      .from('leads')
      .select('asistio_j1, calificado, estado_lead, fecha_junta_1')
      .gte('fecha_junta_1', start)
      .lte('fecha_junta_1', end),
    necesitaEntradas
      ? supabase.from('leads').select('id', { count: 'exact', head: true })
          .gte('created_at', altaDesde).lte('created_at', altaHasta)
      : Promise.resolve(null),
    necesitaEntradas
      ? supabase.from('leads').select('id', { count: 'exact', head: true })
          .eq('estado_lead', 'ganado')
          .gte('created_at', altaDesde).lte('created_at', altaHasta)
      : Promise.resolve(null),
  ]);

  if (leadsRes.error) throw new Error(`Funnel leads falló: ${leadsRes.error.message}`);
  if (altasRes?.error) throw new Error(`Funnel altas falló: ${altasRes.error.message}`);
  if (altasGanadasRes?.error) throw new Error(`Funnel altas ganadas falló: ${altasGanadasRes.error.message}`);
  const rows = leadsRes.data ?? [];

  const total_j1 = rows.length;
  const asistencias = rows.filter((r) => r.asistio_j1 === true).length;
  const limpias = rows.filter((r) => r.asistio_j1 === true && r.calificado === true).length;
  // Cierre = estado_lead 'ganado' (Fase 8), no el viejo booleano cerro.
  const cierres = rows.filter((r) => r.estado_lead === 'ganado').length;

  // Un contador por nombre del NEGOCIO. Los pasos del tramo nombran de acá, así
  // que la pregunta «de dónde sale este número» se contesta en un solo lugar.
  const contadores: Record<ContadorComercial, number> = {
    forms: mkt.leads_count,
    agendas: mkt.reuniones_en_ventana,
    r1_cohorte: total_j1,
    asistencias,
    limpias,
    cierres_cohorte: cierres,
    entradas: altasRes?.count ?? 0,
    cierres_entradas: altasGanadasRes?.count ?? 0,
  };

  const pctDe = (salida: number, entrada: number): number | null =>
    entrada > 0 ? (salida / entrada) * 100 : null;

  // Definición en dos bloques + fila puente (Fase 15). Cada etapa lleva su
  // umbral {rojo, ambar, max} — del que se derivan la salud y las bandas del
  // bullet bar.
  const defs: Array<Omit<FunnelEtapa, 'pct' | 'salud' | 'fuente_pendiente' | 'muestra_chica'>> = [
    // ── CAMINO PRINCIPAL · MARKETING (meta_insights) ──
    // v3 Fase D: el camino real es Impresión→Click→Formulario→Agenda. El
    // instant form es un paso de fricción INTENCIONAL antes de la landing, así
    // que la landing/VSL salen del camino principal (van a "contexto", abajo).
    {
      key: 'imp_click',
      label: 'Impresión → Click',
      bloque: 'marketing',
      entrada: mkt.impressions,
      salida: mkt.link_clicks, // CTR de LINK (inline_link_clicks), no clicks totales
      benchmark: 'CTR de link 0.9–1.5% para B2B en MX. <0.5% bajo, >1.5% fuerte. Es link_clicks, no clicks totales.',
      umbral: { rojo: 0.5, ambar: 0.9, max: 3 },
      fuenteKey: 'meta_insights',
      contexto: false,
    },
    {
      key: 'click_form',
      label: 'Click → Formulario',
      bloque: 'marketing',
      entrada: mkt.link_clicks,
      salida: mkt.leads_count, // instant forms completados (Meta Insights)
      benchmark: 'De los clics al link, cuántos completan el instant form. Sano 8–15% en instant forms de Meta. <8% flojo (form largo o mensaje del anuncio que no engancha).',
      umbral: { rojo: 8, ambar: 12, max: 30 },
      fuenteKey: 'meta_insights',
      contexto: false,
    },
    // ── FILA PUENTE (Meta forms → Calendly) + BLOQUE COMERCIAL ──
    // No se escriben acá: los decide `pasosComercialesDe` contra el funnel del
    // workspace. Con el funnel por defecto (dos reuniones) devuelve exactamente
    // los cuatro de siempre, en el mismo orden y con los mismos umbrales.
    ...pasosComerciales.map((p) => ({
      key: p.key,
      label: p.label,
      bloque: p.bloque,
      entrada: contadores[p.entrada],
      salida: contadores[p.salida],
      benchmark: p.benchmark,
      umbral: p.umbral,
      fuenteKey: p.fuenteKey,
      contexto: false,
    })),
    // ── CONTEXTO DE CONTENIDO (landing / VSL) ──
    // No es el camino principal: el instant form vive ANTES de la landing, así
    // que esta caída es esperable. Informativo, NO compite por ser el cuello.
    {
      key: 'click_landing',
      label: 'Click → Landing',
      bloque: 'marketing',
      entrada: mkt.link_clicks,
      salida: mkt.landing_page_views,
      benchmark: 'Informativo, no es cuello: muchos completan el instant form sin pasar por la landing del VSL (o llegan después), así que esta caída es esperable por diseño del embudo.',
      umbral: { rojo: 50, ambar: 70, max: 100 },
      fuenteKey: 'meta_insights',
      contexto: true,
    },
    {
      key: 'landing_vsl',
      label: 'Landing → VSL',
      bloque: 'marketing',
      entrada: mkt.landing_page_views,
      // Fuente del VSL (v3 Fase A): el % del funnel y los plays totales salen
      // de PANDA (agregado, con historia). El "quién vio" por persona sale del
      // BEACON (vsl_events / getVslEngagement). Son widgets distintos a propósito:
      // Panda no conoce el visitor_id; el beacon sí pero arrancó sin historia.
      salida: mkt.vsl_views ?? 0,
      benchmark: 'De los que llegan a la landing, cuántos reproducen el VSL. Referencia interna: <20% flojo. Plays de Panda (agregado); el "quién vio" por persona sale del beacon.',
      umbral: { rojo: 20, ambar: 35, max: 100 },
      fuenteKey: 'vsl_panda',
      contexto: true,
    },
  ];

  const etapas: FunnelEtapa[] = defs.map((d) => {
    const pct = pctDe(d.salida, d.entrada);
    // Fuente off → la etapa no tiene dato (no es 0%), queda fuera del cuello
    const fuente_pendiente = d.fuenteKey != null && sourceMap?.[d.fuenteKey] === 'off';
    // Muestra chica → % no confiable, se trata como sin_datos para el cuello
    const muestra_chica = d.entrada < MIN_MUESTRA;
    const salud: FunnelEtapa['salud'] =
      fuente_pendiente || muestra_chica || pct === null
        ? 'sin_datos'
        : pct < d.umbral.rojo
        ? 'rojo'
        : pct < d.umbral.ambar
        ? 'ambar'
        : 'verde';
    return { ...d, pct, salud, fuente_pendiente, muestra_chica };
  });

  // Cuello de botella: solo etapas del CAMINO PRINCIPAL (contexto excluido,
  // v3 Fase D) con fuente ok y muestra suficiente (las sin_datos ya quedan
  // fuera porque su salud es 'sin_datos'). Así "Click→Landing" deja de
  // aparecer como cuello falso. Tiebreak por SEVERIDAD normalizada contra el
  // propio umbral — así no gana siempre la etapa de escala chica (CTR ~1%)
  // frente a una de escala grande (el cierre ~30%).
  const rojas = etapas.filter((e) => e.salud === 'rojo' && !e.contexto);
  const ambars = etapas.filter((e) => e.salud === 'ambar' && !e.contexto);
  const pool = rojas.length > 0 ? rojas : ambars;
  const severidad = (e: FunnelEtapa): number => {
    const ref = rojas.length > 0 ? e.umbral.rojo : e.umbral.ambar;
    return ref > 0 ? (ref - (e.pct ?? 0)) / ref : 0; // mayor = peor
  };
  const cuello = pool.length > 0
    ? pool.reduce((peor, e) => (severidad(e) > severidad(peor) ? e : peor))
    : null;

  return { etapas, cuelloKey: cuello?.key ?? null, roles };
}

// =============================================================================
// FUNNEL — serie semanal por etapa (Fase 15)
// =============================================================================
// Por cada etapa, el pct de las últimas `semanas` semanas. Semanas sin
// denominador devuelven null (no 0) — una sparkline honesta.
// =============================================================================

export type FunnelSeries = Record<string, Array<number | null>>;

// ⚠️ `TAG.pipeline` NO es de adorno: desde que las claves del tramo comercial salen
// del funnel del workspace, esta lectura DEPENDE de la forma del embudo. Hoy las
// escrituras del embudo ya revientan `TAG.leads` (app/crm/actions.ts), así que el
// caché se invalida igual — y el día que una de ellas deje de hacerlo, la serie
// quedaría con las claves del embudo anterior hasta que venza el `revalidate`.
export const getFunnelSeries = cachedRead('getFunnelSeries', _getFunnelSeries, { tags: [TAG.marketing, TAG.leads, TAG.pipeline], revalidate: TTL.cron });
async function _getFunnelSeries(
  end: string = new Date().toISOString().slice(0, 10),
  semanas = 12,
): Promise<FunnelSeries> {
  const supabase = (await getTenantDb());

  // Semanas (lunes) más viejas → más nuevas
  const ultimoLunes = lunesDeFecha(end);
  const inicios: string[] = [];
  for (let i = semanas - 1; i >= 0; i--) inicios.push(restarDiasISO(ultimoLunes, i * 7));
  const rangoInicio = inicios[0];
  const rangoFin = restarDiasISO(ultimoLunes, -6); // domingo de la última semana

  // 12 semanas = 84 días. Medido el 02/09/2026 en el ws1: 767 filas de Meta, a
  // dos semanas del techo de 1.000. Paginado.
  const enRango = (q: ConsultaPaginada) => q.gte('fecha', rangoInicio).lte('fecha', rangoFin);
  // El tramo comercial de ESTE funnel: las series salen con las keys de los pasos
  // que ese workspace tiene de verdad. Antes emitía siempre las cuatro canónicas, y
  // para un funnel sin reuniones las cuatro eran null en las doce semanas.
  const stages = await getPipelineStagesDefault().catch(() => null);
  const pasosComerciales = pasosComercialesDe(stages);
  const necesitaEntradas = pasosComerciales.some(
    (p) => p.entrada === 'entradas' || p.salida === 'cierres_entradas',
  );

  const [metaRows, pandaRows, agendaRes, j1Res, altasRes] = await Promise.all([
    leerTodo<{ fecha: string; impressions: number | null; link_clicks: number | null; landing_page_views: number | null; leads_count: number | null }>(
      supabase, T_METRICAS,
      'id, fecha, ad_id, impressions, link_clicks, landing_page_views, leads_count',
      { orden: ORDEN_METRICAS, eq: { plataforma: 'meta' }, filtros: enRango },
    ),
    leerTodo<{ fecha: string; video_plays: number | null }>(
      supabase, T_METRICAS, 'id, fecha, ad_id, video_plays',
      { orden: ORDEN_METRICAS, eq: { plataforma: 'panda' }, filtros: enRango },
    ),
    supabase
      .from('leads')
      .select('fecha_junta_1')
      .gte('fecha_junta_1', rangoInicio)
      .lte('fecha_junta_1', rangoFin),
    supabase
      .from('leads')
      .select('fecha_junta_1, asistio_j1, calificado, estado_lead')
      .gte('fecha_junta_1', rangoInicio)
      .lte('fecha_junta_1', rangoFin),
    // La cohorte del ALTA: una lectura más, y sólo cuando algún paso la nombra.
    // ⚠️ PAGINADA. Acá hacen falta las FILAS (hay que repartirlas por semana), así
    // que no se puede resolver con un count — y un `.select()` suelto topea en las
    // 1000 de PostgREST sin dar error: las semanas viejas quedarían vacías.
    necesitaEntradas
      ? leerTodo<{ created_at: string | null; estado_lead: string }>(
          supabase, 'leads', 'id, created_at, estado_lead',
          { orden: 'id', filtros: (q) => q.gte('created_at', `${rangoInicio}T00:00:00Z`).lte('created_at', `${rangoFin}T23:59:59Z`) },
        )
      : Promise.resolve([]),
  ]);

  for (const r of [agendaRes, j1Res]) {
    if (r.error) throw new Error(`getFunnelSeries falló: ${r.error.message}`);
  }

  // Índice de semana de una fecha = lunes de esa fecha
  const semanaDe = (fecha: string): string => lunesDeFecha(fecha);

  // Acumuladores por semana
  type Acc = { imp: number; clk: number; form: number; land: number; vsl: number; agenda: number; j1: number; asis: number; lmp: number; cie: number; alta: number; altaCie: number };
  const porSemana = new Map<string, Acc>();
  for (const s of inicios) porSemana.set(s, { imp: 0, clk: 0, form: 0, land: 0, vsl: 0, agenda: 0, j1: 0, asis: 0, lmp: 0, cie: 0, alta: 0, altaCie: 0 });
  const add = (semana: string, f: (a: Acc) => void) => {
    const a = porSemana.get(semana);
    if (a) f(a);
  };

  for (const r of metaRows) {
    add(semanaDe(r.fecha), (a) => { a.imp += r.impressions ?? 0; a.clk += r.link_clicks ?? 0; a.land += r.landing_page_views ?? 0; a.form += r.leads_count ?? 0; });
  }
  for (const r of pandaRows) {
    add(semanaDe(r.fecha), (a) => { a.vsl += r.video_plays ?? 0; });
  }
  for (const r of (agendaRes.data ?? []) as Array<{ fecha_junta_1: string | null }>) {
    if (r.fecha_junta_1) add(semanaDe(r.fecha_junta_1), (a) => { a.agenda += 1; });
  }
  for (const r of (j1Res.data ?? []) as Array<{ fecha_junta_1: string | null; asistio_j1: boolean | null; calificado: boolean | null; estado_lead: string }>) {
    if (!r.fecha_junta_1) continue;
    add(semanaDe(r.fecha_junta_1), (a) => {
      a.j1 += 1;
      if (r.asistio_j1 === true) a.asis += 1;
      if (r.asistio_j1 === true && r.calificado === true) a.lmp += 1;
      if (r.estado_lead === 'ganado') a.cie += 1;
    });
  }
  for (const r of altasRes) {
    if (!r.created_at) continue;
    add(semanaDe(r.created_at.slice(0, 10)), (a) => {
      a.alta += 1;
      if (r.estado_lead === 'ganado') a.altaCie += 1;
    });
  }

  const ratio = (num: number, den: number): number | null => (den > 0 ? (num / den) * 100 : null);
  const serie = (f: (a: Acc) => number | null): Array<number | null> =>
    inicios.map((s) => f(porSemana.get(s)!));

  // Cada contador del tramo comercial, leído por su nombre del negocio. El mismo
  // mapa que `getFunnelEtapas` usa para el período: si divergieran, la sparkline y
  // el número de arriba medirían dos cosas distintas con el mismo rótulo.
  const semanal: Record<ContadorComercial, (a: Acc) => number> = {
    forms: (a) => a.form,
    agendas: (a) => a.agenda,
    r1_cohorte: (a) => a.j1,
    asistencias: (a) => a.asis,
    limpias: (a) => a.lmp,
    cierres_cohorte: (a) => a.cie,
    entradas: (a) => a.alta,
    cierres_entradas: (a) => a.altaCie,
  };

  // El orden de las claves se conserva (puente entre el camino principal y el
  // contexto, comercial al final): MaKo devuelve esta serie con `Object.entries`,
  // así que el orden es lo que el modelo lee.
  const serieDe = (bloque: 'puente' | 'comercial') =>
    Object.fromEntries(
      pasosComerciales
        .filter((p) => p.bloque === bloque)
        .map((p) => [p.key, serie((a) => ratio(semanal[p.salida](a), semanal[p.entrada](a)))]),
    );

  return {
    imp_click: serie((a) => ratio(a.clk, a.imp)),
    // Camino principal (v3 Fase D): Click→Formulario→Agenda
    click_form: serie((a) => ratio(a.form, a.clk)),
    ...serieDe('puente'),
    // Contexto de contenido (no es el camino principal)
    click_landing: serie((a) => ratio(a.land, a.clk)),
    landing_vsl: serie((a) => ratio(a.vsl, a.land)),
    ...serieDe('comercial'),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Anuncios ganadores (Prompt 8B) — leads agrupados por meta_ad_name
// ─────────────────────────────────────────────────────────────────────────────

// =============================================================================
// PANEL RECON — señales por anuncio (Fase 17)
// =============================================================================
// La metodología de Jan: NO se decide con métricas de consumo (hook/hold/CTR).
// Se decide con dos señales: INTENCIÓN (≥10 instant forms por versión de
// oferta) y RITMO de presupuesto (el adset gasta su techo 3 días seguidos).
// Intención sin ritmo = falso positivo → bolitas de nieve (réplicas), no
// escalar vertical.
// =============================================================================

export type RitmoEstado = 'verde' | 'cruz' | 'sin_datos';
export type ReconVeredicto = 'explorando' | 'validada' | 'falso_positivo' | 'apagar' | 'pausada';

export type SenalRecon = {
  ad_id: string;
  ad_name: string;
  campana: string | null;
  adset_name: string | null;
  spend_usd: number;
  leads: number;                 // leads_count acumulado del rango
  meta_leads: number;            // RECON_LEADS_VALIDACION
  dias_corriendo: number;        // días con spend > 0
  ritmo: RitmoEstado;
  ritmo_dias: Array<{ fecha: string; spend_usd: number; budget_usd: number; ok: boolean }>;
  veredicto: ReconVeredicto;
  // Downstream (de leads matcheados por meta_ad_id)
  agendas: number;
  cierres: number;
  cash_usd: number;
  // Diagnóstico de consumo (solo para arreglar el creativo, NO para decidir)
  hook_rate: number | null;      // video_3s / impresiones
  hold_rate: number | null;      // thruplay / video_3s
  ctr_link: number | null;
  cpl_usd: number | null;
  frequency: number | null;
  // Economía por anuncio (para los desgloses de Costo · CPM · CPC)
  impressions: number;
  link_clicks: number;
  cpm_usd: number | null;        // spend ÷ impresiones × 1000
  cpc_usd: number | null;        // spend ÷ clicks
  // Preview del creativo (0022) — valor más reciente del anuncio
  ad_thumbnail_url: string | null;
  ad_permalink: string | null;
  ad_creative_sin_enlace: boolean;
};

export const getSenalesRecon = cachedRead('getSenalesRecon', _getSenalesRecon, { tags: [TAG.marketing, TAG.leads], revalidate: TTL.cron });
async function _getSenalesRecon(
  start: string,
  end: string,
): Promise<SenalRecon[]> {
  const supabase = (await getTenantDb());
  // Columnas del creativo (migración 0022). Si la migración aún no se aplicó,
  // la query falla con "column ... does not exist" → reintentamos sin ellas para
  // no romper toda la pantalla de Marketing (degradación elegante).
  // Las tres últimas columnas sólo existen si la mig 0022 ya corrió (ver el
  // reintento de abajo).
  type AdRow = { fecha: string; ad_id: string; ad_name: string | null; campaign_name: string | null; adset_id: string | null; adset_name: string | null; spend: number | null; leads_count: number | null; agendas_meta: number | null; impressions: number | null; link_clicks: number | null; video_3s_views: number | null; video_thruplay: number | null; frequency: number | null; ad_thumbnail_url: string | null; ad_permalink: string | null; ad_creative_sin_enlace: boolean | null };

  // El `id` va en el select porque es la última columna del ORDER BY del paginado.
  const BASE_ADS = 'id, fecha, ad_id, ad_name, campaign_name, adset_id, adset_name, spend, leads_count, agendas_meta, impressions, link_clicks, video_3s_views, video_thruplay, frequency';
  const adsQuery = (cols: string) =>
    leerTodo<AdRow>(supabase, T_METRICAS, cols, {
      orden: ORDEN_METRICAS,
      eq: { plataforma: 'meta' },
      filtros: (q) => q.not('ad_id', 'is', null).gte('fecha', start).lte('fecha', end),
    });

  // El reintento sin las columnas de la mig 0022 se mantiene, pero ahora la
  // consulta LANZA en vez de devolver `{ error }`: `leerTodo` no puede seguir
  // paginando sobre una página que falló. El throw incluye el mensaje de
  // PostgREST, así que el test de la columna faltante se hace sobre él.
  let adRows: AdRow[];
  try {
    adRows = await adsQuery(`${BASE_ADS}, ad_thumbnail_url, ad_permalink, ad_creative_sin_enlace`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/ad_thumbnail_url|ad_permalink|ad_creative_sin_enlace/.test(msg)) throw e;
    adRows = await adsQuery(BASE_ADS);
  }

  // downByAd solo se consulta para anuncios presentes en el rango → traer SOLO
  // los leads atribuidos a esos ad_id, no el histórico completo de leads con UTM.
  const adIdsRango = [...new Set(adRows.map((r) => r.ad_id).filter((x): x is string => !!x))];

  // Las dos van PAGINADAS, igual que los anuncios de arriba. Los presupuestos se
  // habían quedado sueltos en el mismo Promise.all: adset_budget_daily es ~47
  // filas/día en ws1, así que cualquier rango de ≥22 días volvía con 1000 filas
  // y la señal de ritmo comparaba el gasto real contra un presupuesto a medias.
  // Su PK es (fecha, adset_id, workspace_id) y el workspace lo fija el proxy,
  // así que (fecha, adset_id) ya es un orden único. Los leads por ad_id andaban
  // en 955/1000 en ws1: se pagina por `id` antes de que crucen.
  let budgetRows: Array<{ fecha: string; adset_id: string; daily_budget_mxn: number | null }>;
  let leadRows: Array<{ meta_ad_id: string | null; fecha_junta_1: string | null; estado_lead: string; total_cobrado_usd: number | null }>;
  try {
    [budgetRows, leadRows] = await Promise.all([
      leerTodo<{ fecha: string; adset_id: string; daily_budget_mxn: number | null }>(
        supabase, 'adset_budget_daily', 'fecha, adset_id, daily_budget_mxn',
        { orden: ['fecha', 'adset_id'], filtros: (q) => q.gte('fecha', start).lte('fecha', end) },
      ),
      adIdsRango.length === 0
        ? Promise.resolve([])
        : leerTodo<{ meta_ad_id: string | null; fecha_junta_1: string | null; estado_lead: string; total_cobrado_usd: number | null }>(
          supabase, 'leads', 'id, meta_ad_id, fecha_junta_1, estado_lead, total_cobrado_usd',
          { filtros: (q) => q.in('meta_ad_id', adIdsRango) },
        ),
    ]);
  } catch (e) {
    throw new Error(`getSenalesRecon falló: ${e instanceof Error ? e.message : String(e)}`);
  }


  // Gasto diario por adset (suma de sus anuncios) — para la señal de ritmo.
  const adsetDaySpendMxn = new Map<string, number>(); // key `${adset_id}|${fecha}`
  for (const r of adRows) {
    if (!r.adset_id) continue;
    const k = `${r.adset_id}|${r.fecha}`;
    adsetDaySpendMxn.set(k, (adsetDaySpendMxn.get(k) ?? 0) + Number(r.spend ?? 0));
  }
  // Presupuestos por adset/fecha
  const budgetByAdsetDay = new Map<string, number>();
  const budgetDaysByAdset = new Map<string, string[]>();
  for (const b of budgetRows) {
    budgetByAdsetDay.set(`${b.adset_id}|${b.fecha}`, Number(b.daily_budget_mxn ?? 0));
    const arr = budgetDaysByAdset.get(b.adset_id) ?? [];
    arr.push(b.fecha);
    budgetDaysByAdset.set(b.adset_id, arr);
  }

  // Downstream por ad_id (leads reales matcheados)
  const downByAd = new Map<string, { agendas: number; cierres: number; cash: number }>();
  for (const l of leadRows) {
    if (!l.meta_ad_id) continue;
    const d = downByAd.get(l.meta_ad_id) ?? { agendas: 0, cierres: 0, cash: 0 };
    if (l.fecha_junta_1) d.agendas += 1;
    if (l.estado_lead === 'ganado') d.cierres += 1;
    d.cash += Number(l.total_cobrado_usd ?? 0);
    downByAd.set(l.meta_ad_id, d);
  }

  // Agregar por anuncio
  type Acc = { ad_name: string | null; campana: string | null; adset_id: string | null; adset_name: string | null; spendMxn: number; leads: number; agendasMeta: number; imp: number; clk: number; v3: number; thru: number; freqVals: number[]; diasSpend: Set<string>; fechasSpend: string[]; thumb: string | null; permalink: string | null; sinEnlace: boolean; lastFecha: string };
  const porAd = new Map<string, Acc>();
  for (const r of adRows) {
    const a = porAd.get(r.ad_id) ?? { ad_name: r.ad_name, campana: r.campaign_name, adset_id: r.adset_id, adset_name: r.adset_name, spendMxn: 0, leads: 0, agendasMeta: 0, imp: 0, clk: 0, v3: 0, thru: 0, freqVals: [], diasSpend: new Set<string>(), fechasSpend: [], thumb: null, permalink: null, sinEnlace: false, lastFecha: '' };
    // Creativo: tomar el valor de la fila más reciente del anuncio.
    if (r.fecha >= a.lastFecha) {
      a.lastFecha = r.fecha;
      a.thumb = r.ad_thumbnail_url ?? null;
      a.permalink = r.ad_permalink ?? null;
      a.sinEnlace = r.ad_creative_sin_enlace ?? false;
    }
    const sp = Number(r.spend ?? 0);
    a.spendMxn += sp;
    a.leads += Number(r.leads_count ?? 0);
    a.agendasMeta += Number(r.agendas_meta ?? 0);
    a.imp += Number(r.impressions ?? 0);
    a.clk += Number(r.link_clicks ?? 0);
    a.v3 += Number(r.video_3s_views ?? 0);
    a.thru += Number(r.video_thruplay ?? 0);
    if (r.frequency) a.freqVals.push(Number(r.frequency));
    if (sp > 0) { a.diasSpend.add(r.fecha); a.fechasSpend.push(r.fecha); }
    porAd.set(r.ad_id, a);
  }

  const ultimos3 = (() => {
    // últimos 3 días del rango (calendario), para "pausada"
    const arr: string[] = [];
    for (let i = 0; i < 3; i++) arr.push(restarDiasISO(end, i));
    return new Set(arr);
  })();

  const señales: SenalRecon[] = [];
  for (const [adId, a] of porAd) {
    const spendUsd = a.spendMxn / TIPO_DE_CAMBIO_USD_MXN;
    const down = downByAd.get(adId) ?? { agendas: 0, cierres: 0, cash: 0 };
    const diasCorriendo = a.diasSpend.size;

    // RITMO: últimos 3 días con presupuesto del adset padre
    let ritmo: RitmoEstado = 'sin_datos';
    const ritmoDias: SenalRecon['ritmo_dias'] = [];
    if (a.adset_id) {
      const days = (budgetDaysByAdset.get(a.adset_id) ?? []).slice().sort().reverse().slice(0, 3);
      if (days.length === 3) {
        let todosOk = true;
        for (const f of days.slice().reverse()) {
          const budgetMxn = budgetByAdsetDay.get(`${a.adset_id}|${f}`) ?? 0;
          const spMxn = adsetDaySpendMxn.get(`${a.adset_id}|${f}`) ?? 0;
          const ok = budgetMxn > 0 && spMxn >= 0.99 * budgetMxn;
          if (!ok) todosOk = false;
          ritmoDias.push({ fecha: f, spend_usd: spMxn / TIPO_DE_CAMBIO_USD_MXN, budget_usd: budgetMxn / TIPO_DE_CAMBIO_USD_MXN, ok });
        }
        ritmo = todosOk ? 'verde' : 'cruz';
      }
    }

    // VEREDICTO
    const conSpendReciente = a.fechasSpend.some((f) => ultimos3.has(f));
    let veredicto: ReconVeredicto;
    if (!conSpendReciente) {
      veredicto = 'pausada';
    } else if (spendUsd >= RECON_SPEND_SIN_LEADS_USD && a.leads === 0 && diasCorriendo >= 4) {
      veredicto = 'apagar';
    } else if (a.leads >= RECON_LEADS_VALIDACION) {
      veredicto = ritmo === 'verde' ? 'validada' : ritmo === 'cruz' ? 'falso_positivo' : 'explorando';
    } else {
      veredicto = 'explorando';
    }

    señales.push({
      ad_id: adId,
      ad_name: a.ad_name ?? adId,
      campana: a.campana,
      adset_name: a.adset_name,
      spend_usd: spendUsd,
      leads: a.leads,
      meta_leads: RECON_LEADS_VALIDACION,
      dias_corriendo: diasCorriendo,
      ritmo,
      ritmo_dias: ritmoDias,
      veredicto,
      // Agendas según Meta (Programaciones) por anuncio. Cierres/cash siguen del
      // CRM (Meta no los conoce). Ver getAgendasComparador para la brecha global.
      agendas: a.agendasMeta,
      cierres: down.cierres,
      cash_usd: down.cash,
      hook_rate: a.imp > 0 ? (a.v3 / a.imp) * 100 : null,
      hold_rate: a.v3 > 0 ? (a.thru / a.v3) * 100 : null,
      ctr_link: a.imp > 0 ? (a.clk / a.imp) * 100 : null,
      cpl_usd: a.leads > 0 ? spendUsd / a.leads : null,
      frequency: a.freqVals.length > 0 ? a.freqVals.reduce((s, v) => s + v, 0) / a.freqVals.length : null,
      impressions: a.imp,
      link_clicks: a.clk,
      cpm_usd: a.imp > 0 ? (spendUsd / a.imp) * 1000 : null,
      cpc_usd: a.clk > 0 ? spendUsd / a.clk : null,
      ad_thumbnail_url: a.thumb,
      ad_permalink: a.permalink,
      ad_creative_sin_enlace: a.sinEnlace,
    });
  }

  return señales.sort((x, y) => y.leads - x.leads || y.spend_usd - x.spend_usd);
}

// =============================================================================
// Comparador de agendas: Meta (Programaciones) vs CRM (agendas reales)
// =============================================================================
// Meta atribuye por su modelo (clic/vista). El CRM cuenta TODAS las agendas
// (leads con fecha_junta_1 en el período), vengan o no de un anuncio rastreable.
// El CRM suele ser MAYOR (incluye orgánico, directo y leads sin UTM/instant form).
export type AgendasComparador = { meta: number; crm: number };

export async function getAgendasComparador(start: string, end: string): Promise<AgendasComparador> {
  const supabase = (await getTenantDb());
  // Las agendas de Meta se SUMAN sobre una fila por anuncio por día: con 28
  // filas/día en el ws1 (17/09/2026), un rango de ~5 meses pasa las 1000 y el
  // `.select()` suelto devolvía la suma cortada — el comparador decía que Meta
  // atribuía menos agendas de las que atribuye. Paginado con ORDEN_METRICAS.
  const [adsRows, crmRes] = await Promise.all([
    leerTodo<{ agendas_meta: number | null }>(
      supabase, T_METRICAS, 'id, fecha, ad_id, agendas_meta',
      {
        orden: ORDEN_METRICAS,
        eq: { plataforma: 'meta' },
        filtros: (q) => q.not('ad_id', 'is', null).gte('fecha', start).lte('fecha', end),
      },
    ).catch((e: unknown) => {
      throw new Error(`getAgendasComparador (Meta) falló: ${e instanceof Error ? e.message : String(e)}`);
    }),
    supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .gte('fecha_junta_1', start)
      .lte('fecha_junta_1', end),
  ]);
  if (crmRes.error) throw new Error(`getAgendasComparador (CRM) falló: ${crmRes.error.message}`);
  const meta = adsRows.reduce((s, r) => s + Number(r.agendas_meta ?? 0), 0);
  return { meta, crm: crmRes.count ?? 0 };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tramos del ciclo de venta (Prompt 8C) — línea de tiempo promedio
// ─────────────────────────────────────────────────────────────────────────────

export type TramoSCL = {
  label: string;
  dias_promedio: number | null;  // null si <1 lead con ambas fechas
  n: number;                     // leads con ambas fechas del tramo
};

export type TramosSCL = {
  tramos: TramoSCL[];
  tramo_mas_lento: string | null;
  // Ciclo completo: suma de los tramos con datos (v3 Fase I). Null si ninguno.
  total_dias: number | null;
};

export const getTramosSCL = cachedRead('getTramosSCL', _getTramosSCL, { tags: [TAG.leads], revalidate: TTL.user });
async function _getTramosSCL(): Promise<TramosSCL> {
  const supabase = (await getTenantDb());
  // Escaneo de TODOS los leads, paginado por `id`. El `.select()` suelto
  // devolvía 1000 de 1066 en ws1 sin avisar, y el ciclo de venta se promediaba
  // sobre una muestra arbitraria (sin ORDER BY caían los más viejos, que son
  // justo los que completaron el ciclo hasta el pago).
  let data: unknown[];
  try {
    data = await leerTodo<unknown>(
      supabase, 'leads',
      'id, created_at, meta_lead_id, fecha_agenda, fecha_junta_1, fecha_junta_2, fecha_confirmacion, fecha_primer_pago',
    );
  } catch (e) {
    throw new Error(`Tramos SCL falló: ${e instanceof Error ? e.message : String(e)}`);
  }

  const dias = (a: string | null, b: string | null): number | null => {
    if (!a || !b) return null;
    const [ay, am, ad] = a.slice(0, 10).split('-').map(Number);
    const [by, bm, bd] = b.slice(0, 10).split('-').map(Number);
    const d = Math.floor((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
    return d >= 0 ? d : null;
  };

  type Row = {
    created_at: string | null;
    meta_lead_id: string | null;
    fecha_agenda: string | null;
    fecha_junta_1: string | null;
    fecha_junta_2: string | null;
    fecha_confirmacion: string | null;
    fecha_primer_pago: string | null;
  };
  const rows = data as Row[];

  const promedioDe = (vals: number[]) =>
    vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : null;

  // Primer tramo (v3 Fase I): Formulario → Agenda. Solo instant forms
  // (meta_lead_id) — para esos, created_at ≈ el momento del formulario.
  const formVals: number[] = [];
  for (const r of rows) {
    if (!r.meta_lead_id) continue;
    const d = dias(r.created_at, r.fecha_agenda);
    if (d !== null) formVals.push(d);
  }
  const tramoForm: TramoSCL = {
    label: 'Formulario → Agenda',
    n: formVals.length,
    dias_promedio: promedioDe(formVals),
  };

  const defs: Array<{ label: string; from: keyof Row; to: keyof Row }> = [
    { label: 'Agenda → Reunión 1', from: 'fecha_agenda', to: 'fecha_junta_1' },
    { label: 'Reunión 1 → Reunión 2', from: 'fecha_junta_1', to: 'fecha_junta_2' },
    { label: 'Reunión 2 → Confirmó', from: 'fecha_junta_2', to: 'fecha_confirmacion' },
    { label: 'Confirmó → Primer pago', from: 'fecha_confirmacion', to: 'fecha_primer_pago' },
  ];

  const tramosResto: TramoSCL[] = defs.map((def) => {
    const vals: number[] = [];
    for (const r of rows) {
      const d = dias(r[def.from], r[def.to]);
      if (d !== null) vals.push(d);
    }
    return { label: def.label, n: vals.length, dias_promedio: promedioDe(vals) };
  });

  const tramos: TramoSCL[] = [tramoForm, ...tramosResto];

  const conDatos = tramos.filter((t) => t.dias_promedio !== null);
  const tramo_mas_lento = conDatos.length > 0
    ? conDatos.reduce((max, t) => ((t.dias_promedio ?? 0) > (max.dias_promedio ?? 0) ? t : max)).label
    : null;
  const total_dias = conDatos.length > 0
    ? conDatos.reduce((s, t) => s + (t.dias_promedio ?? 0), 0)
    : null;

  return { tramos, tramo_mas_lento, total_dias };
}

// ─────────────────────────────────────────────────────────────────────────────
// Resumen comparativo mes actual vs anterior (Prompt 8A) — 4 números + tendencia
// ─────────────────────────────────────────────────────────────────────────────

// Métrica MTD: valor actual (1→hoy), mismo período del mes anterior, y
// proyección de cierre de mes (ritmo diario × días del mes).
export type MetricaMTD = { actual: number; anterior: number; proyeccion: number };

export type ResumenComparativo = {
  inversion_usd: MetricaMTD;
  agendas: MetricaMTD;
  cash_usd: MetricaMTD;
  cierres: MetricaMTD;
  etiqueta_anterior: string;   // "mismo período de mayo"
};

export type CompareMTD = {
  actualInicio: string;
  actualFin: string;       // = hoy
  anteriorInicio: string;
  anteriorFin: string;     // mismo día del mes anterior (capeado al fin de mes)
  etiqueta: string;        // "mismo período de mayo"
  diaDelMes: number;
  diasEnMesActual: number;
};

/**
 * Comparación justa MTD (Fase 16): contra el MISMO rango de días del mes
 * anterior (del 1 al día de hoy), no contra el mes anterior completo.
 */
export function compareMTD(hoy: string): CompareMTD {
  const [y, m, d] = hoy.split('-').map(Number);
  const p2 = (n: number) => String(n).padStart(2, '0');
  const actualInicio = `${y}-${p2(m)}-01`;

  // Mes anterior
  const prev = new Date(Date.UTC(y, m - 2, 1)); // m-2 = mes anterior (0-based)
  const py = prev.getUTCFullYear();
  const pm = prev.getUTCMonth() + 1;
  const anteriorInicio = `${py}-${p2(pm)}-01`;
  const ultimoDiaPrev = new Date(Date.UTC(py, pm, 0)).getUTCDate();
  const diaCap = Math.min(d, ultimoDiaPrev);
  const anteriorFin = `${py}-${p2(pm)}-${p2(diaCap)}`;

  const nombreMes = new Intl.DateTimeFormat('es-MX', { month: 'long', timeZone: 'UTC' })
    .format(new Date(Date.UTC(py, pm - 1, 1)));
  const diasEnMesActual = new Date(Date.UTC(y, m, 0)).getUTCDate();

  return {
    actualInicio,
    actualFin: hoy,
    anteriorInicio,
    anteriorFin,
    etiqueta: `mismo período de ${nombreMes}`,
    diaDelMes: d,
    diasEnMesActual,
  };
}

export async function getResumenComparativo(hoy: string): Promise<ResumenComparativo> {
  const c = compareMTD(hoy);
  const [mktAct, mktAnt, revAct, revAnt] = await Promise.all([
    getMarketingWindow(c.actualInicio, c.actualFin),
    getMarketingWindow(c.anteriorInicio, c.anteriorFin),
    getRevenuePeriod(c.actualInicio, c.actualFin),
    getRevenuePeriod(c.anteriorInicio, c.anteriorFin),
  ]);

  // Proyección a fin de mes: ritmo diario MTD × días del mes.
  const proy = (actual: number) =>
    c.diaDelMes > 0 ? (actual / c.diaDelMes) * c.diasEnMesActual : actual;

  const mtd = (actual: number, anterior: number): MetricaMTD => ({
    actual,
    anterior,
    proyeccion: proy(actual),
  });

  return {
    inversion_usd: mtd(mktAct.spend_usd, mktAnt.spend_usd),
    agendas: mtd(mktAct.reuniones_en_ventana, mktAnt.reuniones_en_ventana),
    cash_usd: mtd(revAct.cash_collected_usd, revAnt.cash_collected_usd),
    cierres: mtd(revAct.cierres_en_periodo, revAnt.cierres_en_periodo),
    etiqueta_anterior: c.etiqueta,
  };
}

// =============================================================================
// Serie diaria del VSL (Fase 5 v2) — para la card del tab Marketing
// =============================================================================
// Unifica YouTube (historia) + Panda (presente) en una sola línea de plays.

export type VslSerie = {
  dias: Array<{ fecha: string; plays: number }>;
  total_plays: number;
  unique_viewers: number | null;     // de Panda (YouTube no lo da por día)
  retention_pct: number | null;      // engagement medio de Panda
  avg_watch_seconds: number | null;
  fuente_panda_activa: boolean;       // hay filas panda recientes
};

export const getVslSerie = cachedRead('getVslSerie', _getVslSerie, { tags: [TAG.marketing], revalidate: TTL.cron });
async function _getVslSerie(dias = 56): Promise<VslSerie> {
  const supabase = (await getTenantDb());
  const hasta = new Date();
  const desde = new Date(hasta.getTime() - dias * 86400_000);
  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  const desdeStr = fmt(desde);
  const hastaStr = fmt(hasta);

  const [ytRes, pandaRes] = await Promise.all([
    supabase
      .from('marketing_metrics_daily')
      .select('fecha, youtube_views')
      .eq('plataforma', 'youtube')
      .eq('youtube_video_type', 'vsl')
      .gte('fecha', desdeStr)
      .lte('fecha', hastaStr),
    supabase
      .from('marketing_metrics_daily')
      .select('fecha, video_plays, video_unique_viewers, video_retention_p50, video_avg_watch_seconds')
      .eq('plataforma', 'panda')
      .gte('fecha', desdeStr)
      .lte('fecha', hastaStr),
  ]);

  if (ytRes.error) throw new Error(`VSL serie YouTube falló: ${ytRes.error.message}`);
  if (pandaRes.error) throw new Error(`VSL serie Panda falló: ${pandaRes.error.message}`);

  const porFecha = new Map<string, number>();
  for (const r of ytRes.data ?? []) {
    porFecha.set(r.fecha, (porFecha.get(r.fecha) ?? 0) + Number(r.youtube_views ?? 0));
  }
  let unique = 0;
  let retSum = 0;
  let retN = 0;
  let watchSum = 0;
  let watchN = 0;
  for (const r of pandaRes.data ?? []) {
    porFecha.set(r.fecha, (porFecha.get(r.fecha) ?? 0) + Number(r.video_plays ?? 0));
    unique += Number(r.video_unique_viewers ?? 0);
    if (r.video_retention_p50 !== null && r.video_retention_p50 !== undefined) {
      retSum += Number(r.video_retention_p50);
      retN++;
    }
    if (r.video_avg_watch_seconds !== null && r.video_avg_watch_seconds !== undefined) {
      watchSum += Number(r.video_avg_watch_seconds);
      watchN++;
    }
  }

  const diasArr = [...porFecha.entries()]
    .map(([fecha, plays]) => ({ fecha, plays }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  const total_plays = diasArr.reduce((s, d) => s + d.plays, 0);
  const pandaRows = pandaRes.data ?? [];

  return {
    dias: diasArr,
    total_plays,
    unique_viewers: pandaRows.length > 0 ? unique : null,
    retention_pct: retN > 0 ? retSum / retN : null,
    avg_watch_seconds: watchN > 0 ? watchSum / watchN : null,
    fuente_panda_activa: pandaRows.length > 0,
  };
}

// =============================================================================
// HIGIENE DE DATOS — pendientes de marcar (Fase 9)
// =============================================================================
// Tres puntos del funnel dependen de una marca manual de Mauricio. Si quedan
// sin cargar, el tablero lee datos viejos y miente con confianza. Esta query
// los detecta para que Vista General los pida como alerta roja ANTES de
// cualquier veredicto.
// =============================================================================

export type TipoPendiente = 'A' | 'B' | 'C' | 'M' | 'R';

export type PendienteItem = {
  lead_id: number;
  lead_nombre: string;
  tipo: TipoPendiente;
  mensaje: string;
  fecha: string;       // la fecha relevante (J1 para A/B, J2 para C)
  /** true = lo que falta son datos estáticos (tel/empresa/detalle): se editan,
   *  no se resuelven con el wizard. El worklist manda a Editar en vez de Solucionar. */
  soloEdit: boolean;
  /** Dónde resolver los faltantes: wizard, Deal Details (cobranza), Meetings, o Editar. */
  solTab: 'wizard' | 'cobranza' | 'reuniones' | 'edit';
  /** Lista exacta de datos faltantes (para abrir el wizard in-place con TODO). */
  faltantes: Step[];
  /**
   * Solo tipo 'R': CUÁL de las dos reuniones es la que ya pasó. Viaja desde acá
   * porque es el server el que la decidió — y lo hace ubicando la etapa del lead
   * entre las reuniones del funnel del workspace (lib/funnel-etapas), no por el
   * nombre de la etapa. El board lo re-derivaba de su etapa local, que un drag
   * optimista o un movimiento previo ya pudieron cambiar — y entonces reagendar
   * pisaba la R1 en vez de la R2.
   */
  cual?: 'r1' | 'r2';
  /**
   * La etapa EFECTIVA del lead cuando se calculó el pendiente: el override
   * (`pipeline_stage`) si sigue existiendo en el funnel, y si no la derivada.
   * Viaja por la misma razón que `cual`: el board la re-derivaba de su estado
   * optimista (`effStage`), así que un drag sin refrescar hacía que el wizard
   * ofreciera los desenlaces de una etapa en la que el lead todavía no está.
   */
  etapa?: string;
};

export type Pendientes = {
  items: PendienteItem[];
  total: number;
  porTipo: { A: number; B: number; C: number; M: number; R: number };
  /**
   * Qué NO se pudo leer al armar la lista ('' = se leyó todo). Existe porque el
   * peor estado de esta pantalla no es una fila mal redactada: es la lista vacía
   * con el ✓ verde de "todo al día" cuando en realidad falló una lectura. Si viene
   * con texto, la UI tiene que decirlo en vez de afirmar que no hay nada que hacer.
   */
  aviso?: string;
};

function fmtFechaPendiente(yyyy_mm_dd: string): string {
  // Convención del proyecto: fecha completa en pantalla → dd/mm/aaaa.
  const [y, m, d] = yyyy_mm_dd.split('-');
  return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
}

function restarDiasISO(yyyy_mm_dd: string, dias: number): string {
  const [y, m, d] = yyyy_mm_dd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - dias)).toISOString().slice(0, 10);
}

/** Días enteros entre dos fechas ISO (b - a). Negativo si b < a. */
function diasEntreISO(a: string, b: string): number {
  const [ay, am, ad] = a.slice(0, 10).split('-').map(Number);
  const [by, bm, bd] = b.slice(0, 10).split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

/**
 * Columnas que consume ESTA pasada, y solo esas. Antes era select('*'): ~60
 * columnas por lead (payloads crudos de Meta, cobranza, contratos, los jsonb de
 * Deal Details) traídas enteras en cada carga de /crm y /general para leer 30.
 *
 * OJO: si le agregás un campo del lead a faltantesDeLead (lib/leads.ts) o a
 * StageDerivable, sumalo acá. No hay error si falta: llega `undefined` y el
 * requisito se evalúa contra un dato que no existe — exactamente el tipo de
 * falla silenciosa que esta función tiene que evitar.
 */
const PENDIENTES_COLS =
  // Identidad + etapa (deriveStageKey / etapa-historial)
  'id, nombre, estado_lead, pipeline_stage, etapa_vista, nutricion_realizada, nutricion_manual_deadline, ' +
  // Reuniones: fecha del día + timestamp real de Calendly (el "ya pasó" mira la hora)
  'fecha_agenda, fecha_junta_1, fecha_junta_2, junta_1_at, junta_2_at, asistio_j1, asistio_j2, calificado, ' +
  // Datos comerciales que el motor de requisitos exige
  'telefono, empresa, setter, closer, fathom_links, monto_cierre_usd, motivo_perdida, ' +
  // Venta recurrente: el importe de una suscripción vive en `suscripcion_monto_usd`
  // y `monto_cierre_usd` queda null a propósito. Sin estas tres, `faltantesDeLead`
  // ve `venta_tipo === undefined`, trata la venta como pago único y le vuelve a
  // pedir «Monto de cierre» y «Plan de pagos» a un cierre que YA está completo.
  'venta_tipo, suscripcion_monto_usd, suscripcion_meses, ' +
  // Deal Details (solo se evalúan en la etapa de cierre)
  'deal_servicio, deal_promesa, deal_fiscal, deal_obligaciones, ' +
  // Excepciones y omisiones declaradas: eximen requisitos de forma persistente
  'sin_r1, sin_r2, fathom_omitido, deal_fiscal_doc_omitido, comprobante_omitido, empresa_omitido, pendientes_ignorados, r2_agenda_externa_motivo';

/**
 * Los leads de la pasada, paginados. Si la lista de columnas explícita falla
 * porque el esquema todavía no tiene alguna (migración pendiente en un entorno
 * viejo), se reintenta con '*': el CRM entero no puede caerse por una columna
 * nueva — antes de acotar las columnas, select('*') toleraba ese caso solo.
 */
async function leerLeadsDePendientes(db: Awaited<ReturnType<typeof getTenantDb>>): Promise<Lead[]> {
  try {
    return await leerTodo<Lead>(db, 'leads', PENDIENTES_COLS);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/does not exist/i.test(msg)) throw e;
    console.error(`[pendientes] columna faltante en PENDIENTES_COLS, releyendo con '*' (¿falta una migración?): ${msg}`);
    return await leerTodo<Lead>(db, 'leads', '*');
  }
}

/**
 * Leads con "Datos sin marcar": TODO lo que la etapa actual del lead adeuda,
 * calculado con el motor de requisitos acumulativos (faltantesDeLead). Un item
 * por lead, con el detalle de qué falta. Casos especiales:
 *   M) Aparcado en "Nutrición - Manual" y venció el deadline sin resolverse.
 *   R) Su reunión ya pasó y sigue parado en esa etapa: falta la DECISIÓN.
 * El resto (tipo 'A' = genérico) se resuelve con el mismo wizard de la ficha.
 */
export const getPendientesDeMarcar = cachedRead('getPendientesDeMarcar', _getPendientesDeMarcar, { tags: [TAG.leads, TAG.pagos], revalidate: TTL.user });
async function _getPendientesDeMarcar(
  hoy: string = new Date().toISOString().slice(0, 10),
): Promise<Pendientes> {
  // EVENT-DRIVEN (sin cron): cada vez que se calculan los "Datos sin marcar",
  // intentamos enganchar solo las grabaciones de Fathom que ya estén disponibles
  // (throttleado, fire-and-forget). Así una reunión que terminó se auto-resuelve
  // apenas se abre el CRM, sin esperar al cron. Ver lib/fathom-auto.
  void adjuntarFathomAutoThrottled();

  const supabase = (await getTenantDb());
  // Las TRES lecturas de acá van paginadas. PostgREST corta en 1000 filas SIN
  // error: con select('*') pelado, el lead 1001 en adelante simplemente no
  // existía para el worklist — y un pendiente que no se ve es peor que uno mal
  // redactado. `pagos` es el que revienta primero (varias cuotas por lead), y su
  // corte no se nota: el wizard de Ganado pide un plan de pagos que ya existe.
  const data = await leerLeadsDePendientes(supabase);

  // Lo que no se pudo leer, para que la pantalla NO diga "todo al día" sobre una
  // lista incompleta. `leerTodo` lanza cuando la página falla (bien: el corte
  // silencioso era el bug original), pero estas dos lecturas son ACCESORIAS y
  // dejarlas propagar cambiaba un worklist con un dato de menos por un worklist
  // VACÍO con un ✓ verde — que es peor: el falso all-clear en el lugar que el
  // producto trata como autoridad. La lectura de `leads` sí sigue rompiendo fuerte:
  // sin leads no hay worklist que valga.
  const avisos: string[] = [];

  // Plan de pagos + comprobantes faltantes (cuotas pagadas sin comprobante) por lead.
  const pagosRows = await leerTodo<{ lead_id: number; pagado: boolean; comprobante_path: string | null }>(
    supabase, 'pagos', 'lead_id, pagado, comprobante_path',
  ).catch((e) => {
    console.error(`[pendientes] no se pudo leer pagos: ${e instanceof Error ? e.message : String(e)}`);
    avisos.push('el plan de pagos');
    return [] as Array<{ lead_id: number; pagado: boolean; comprobante_path: string | null }>;
  });
  const conPlan = new Set<number>();
  const comprobFaltPorLead = new Map<number, number>();
  for (const p of pagosRows) {
    conPlan.add(p.lead_id);
    if (p.pagado && !p.comprobante_path) comprobFaltPorLead.set(p.lead_id, (comprobFaltPorLead.get(p.lead_id) ?? 0) + 1);
  }
  // El historial de la etapa DERIVADA se cierra ACÁ, y no en un cron, porque esta
  // es la única pasada del sistema que ya tiene TODOS los leads en memoria. La
  // etapa que ve el usuario se calcula al leer (deriveStageKey): cuando la R1
  // pasa y asistio_j1 sigue en null el lead cambia de columna sin que nadie
  // escriba nada, así que no hay mutación que interceptar — el lead 1395 llegó a
  // moverse tres veces con cero líneas de historial. Comparar contra etapa_vista
  // cuesta 0 queries si no cambió nada, y como la columna se actualiza junto con
  // la línea, dos cargas seguidas del CRM no escriben dos veces.
  await registrarEtapasDerivadas(data);

  // Leads con respuestas del formulario de Calendly R2 (para el requisito r2Respuestas).
  const respRows = await leerTodo<{ lead_id: number }>(supabase, 'lead_respuestas', 'lead_id', { eq: { reunion: 'R2' } })
    .catch((e) => {
      console.error(`[pendientes] no se pudo leer lead_respuestas: ${e instanceof Error ? e.message : String(e)}`);
      avisos.push('las respuestas del formulario de R2');
      return [] as Array<{ lead_id: number }>;
    });
  const conR2Resp = new Set(respRows.map((r) => r.lead_id));
  // Los requisitos son DEL LEAD, pero hoy se leen UNA sola vez y alcanza: cada
  // workspace tiene exactamente un funnel (mig 0170), así que el del negocio es el
  // de todos. El día que un lead pueda entrar por otro funnel (F3,
  // lead_participaciones) esto pasa a ser un mapa funnel_id → stages leído de una y
  // resuelto POR LEAD; leer uno solo ahí le pondría a la mitad del board los
  // requisitos del embudo equivocado.
  const funnelPipeline = await getPipelineStagesDefault().catch(() => undefined);
  // Un encuentro que no deja grabación no puede tener «falta el link de Fathom»
  // como dato sin marcar: sería una tarea imposible, repetida por cada lead.
  const grabable = await encuentroGrabable();

  const items: PendienteItem[] = [];

  for (const l of data) {
    // M) Nutrición - Manual: si venció el deadline y sigue abierto, vuelve a
    //    "datos sin marcar" con su mensaje propio. Si no venció, está esperando.
    if (l.pipeline_stage === 'manual') {
      if (l.estado_lead === 'abierto' && l.nutricion_manual_deadline && l.nutricion_manual_deadline < hoy) {
        const diasVencida = diasEntreISO(l.nutricion_manual_deadline, hoy);
        items.push({
          lead_id: l.id,
          lead_nombre: l.nombre,
          tipo: 'M',
          mensaje: `Venció hace ${diasVencida} día${diasVencida === 1 ? '' : 's'} (${fmtFechaPendiente(l.nutricion_manual_deadline)}) sin resolverse`,
          fecha: l.nutricion_manual_deadline,
          soloEdit: false,
          solTab: 'wizard',
          faltantes: [],
          etapa: l.pipeline_stage ?? 'manual',
        });
      }
      continue;
    }
    // R) La reunión YA PASÓ y el lead sigue parado en su etapa de reunión. Sus datos
    //    pueden estar todos marcados (asistió, calificado, Fathom) y aun así no hay
    //    nada que hacer con él: falta la DECISIÓN de qué sigue. Sin esta regla el
    //    lead quedaba invisible — el caso real: R1 de hoy 18:00, asistió, calificado
    //    marcado, y a las 19:30 no aparecía en ningún lado esperando su próximo paso.
    //    No se puede ignorar (ver el filtro de abajo): es el lead trabado, no un dato
    //    lindo de tener.
    //
    //    DOS cosas se miraban mal acá (y por eso la regla casi no corría):
    //    1) Las etapas de reunión NO son 'agenda'/'agendaj2' fijas — el funnel es
    //       configurable por workspace y una reunión se marca con kind:'reunion'
    //       (lib/funnel-etapas). Un funnel con 'discovery' nunca producía el aviso.
    //    2) Se miraba `pipeline_stage` CRUDO, que es un override y solo se escribe
    //       cuando alguien mueve el lead a mano. El webhook de Calendly setea
    //       fecha_junta_N y NUNCA pipeline_stage, así que para el flujo natural del
    //       producto —el único que existe— el pendiente no se disparaba jamás. Va
    //       la etapa EFECTIVA, la misma que evalúa faltantesDeLead unas líneas
    //       abajo; si no, las dos mitades de esta función hablan de leads distintos.
    const etapaLead = etapaVigenteDe(l, funnelPipeline);

    // Los faltantes se calculan ANTES de decidir el tipo de item, y no después.
    // Cuando la rama 'R' cortaba primero con `faltantes: []`, todo lead con la
    // reunión pasada se caía de dos cosas a la vez: de BulkHigiene (que arma sus
    // lotes con `m.faltantes`, así que "asignar Setter a 400 leads" perdía justo
    // los que más lo necesitan) y de su propio detalle en la fila, que pasaba de
    // "Faltan: Setter · Empresa" a una frase que no dice qué cargar. Con la etapa
    // efectiva, esa población dejó de ser marginal.
    const faltanRaw = faltantesDeLead(l, conPlan.has(l.id), { comprobantesFaltantes: comprobFaltPorLead.get(l.id), r2RespuestasOk: conR2Resp.has(l.id), pipeline: funnelPipeline, grabable });
    // "Empresa" ignorada (empresa_omitido) NO notifica en el worklist del CRM general
    // (sigue visible como recordatorio suave en la ficha, que usa faltantesDeLead directo).
    const faltanSinEmpresa = l.empresa_omitido ? faltanRaw.filter((f) => f.id !== 'empresa') : faltanRaw;

    // Una reunión que YA PASÓ y sigue sin resolverse NO se puede ignorar. Es el
    // único pendiente que no es "dato lindo de tener": el lead está parado en R1/R2
    // esperando que alguien diga qué ocurrió, y silenciarlo lo deja colgado para
    // siempre. Todo lo demás sí respeta el "ignorar" del lead (mig 0109).
    const NO_IGNORABLES = new Set(['asistenciaR1', 'asistenciaR2']);
    const faltan = l.pendientes_ignorados
      ? faltanSinEmpresa.filter((f) => NO_IGNORABLES.has(f.id))
      : faltanSinEmpresa;

    const slot = l.estado_lead === 'abierto' ? slotDeReunion(funnelPipeline, etapaLead) : null;
    if (slot) {
      const fechaReu = l[slot.colFecha];
      const atReu = l[slot.colAt];
      // "Ya pasó" mira la hora real de Calendly cuando está (con 1h de gracia para
      // no molestar mientras la reunión todavía puede estar en curso).
      const atMs = atReu ? Date.parse(atReu) : NaN;
      const paso = Number.isFinite(atMs) ? Date.now() >= atMs + 60 * 60_000 : !!fechaReu && fechaReu < hoy;
      if (paso && fechaReu) {
        // Informa, no ordena (08-T22). Decía «— define qué sigue»: la fila le hablaba
        // a Mauricio en imperativo, y eso es exactamente lo que citó al explicar por
        // qué abandonaba el CRM («yo veo esto que me dice define no sé cuántas cosas»).
        const detalle = faltan.length ? ` · pendiente: ${faltan.map((f) => f.label).join(' · ')}` : '';
        items.push({
          lead_id: l.id,
          lead_nombre: l.nombre,
          tipo: 'R',
          mensaje: `La Reunión ${slot.numero} del ${fmtFechaPendiente(fechaReu)} ya pasó y todavía no se marcó cómo salió${detalle}`,
          fecha: fechaReu,
          soloEdit: false,
          solTab: 'wizard',
          // Viajan igual que en un item 'A': la decisión la pide el wizard, pero lo
          // que falta se puede seguir resolviendo en lote.
          faltantes: faltan,
          cual: slot.cual,
          etapa: etapaLead,
        });
        continue;
      }
    }
    if (faltan.length === 0) continue;
    const fecha = (l.fecha_junta_2 && l.fecha_junta_2 < hoy) ? l.fecha_junta_2 : (l.fecha_junta_1 ?? l.fecha_agenda ?? hoy);
    const solTab: PendienteItem['solTab'] = hayPasoDeWizard(faltan) ? 'wizard' : (tabDeSolucion(faltan) ?? 'edit');
    items.push({
      lead_id: l.id,
      lead_nombre: l.nombre,
      tipo: 'A',
      mensaje: `Faltan: ${faltan.map((f) => f.label).join(' · ')}`,
      fecha,
      soloEdit: !hayPasoDeWizard(faltan),
      solTab,
      faltantes: faltan,
    });
  }

  const porTipo = {
    R: items.filter((i) => i.tipo === 'R').length,
    A: items.filter((i) => i.tipo === 'A').length,
    B: 0,
    C: 0,
    M: items.filter((i) => i.tipo === 'M').length,
  };

  return {
    items,
    total: items.length,
    porTipo,
    aviso: avisos.length ? `No se pudo leer ${avisos.join(' ni ')}: esta lista puede estar incompleta.` : '',
  };
}

// =============================================================================
// TAB HOY — operación diaria (Fase 11)
// =============================================================================
// getJuntasProximas: las J1/J2 de hoy y mañana con todo el contexto del lead.
// getColaDeAccion: lista tipada de pendientes concretos (marcar, cobrar,
// recontactar, formularios sin agenda, J2 sin match).
// =============================================================================

function masDiasISO(yyyy_mm_dd: string, dias: number): string {
  return restarDiasISO(yyyy_mm_dd, -dias);
}

function origenLegible(lead: Pick<Lead, 'meta_ad_name' | 'meta_campaign_name' | 'utm_campaign'>): string {
  return (
    lead.meta_ad_name?.trim() ||
    lead.meta_campaign_name?.trim() ||
    lead.utm_campaign?.trim() ||
    'directo'
  );
}

export type JuntaProxima = {
  lead_id: number;
  tipo: 'J1' | 'J2';
  fecha: string;
  dia: 'hoy' | 'mañana' | string;  // string para días futuros si dias>2
  nombre: string;
  empresa: string | null;
  respuestas: {
    facturacion: string | null;
    colaboradores: string | null;
    objetivo: string | null;
    cuando_empezar: string | null;
  };
  vsl_plays: number;
  vsl_max_pct: number | null;
  // tri-estado (v3 Fase A): 'vio' / 'sin_ver' (agendó y 0 plays) / 'sin_datos'
  // (no hay visitor_id vinculado — no afirmar que no vio).
  vsl_estado: 'vio' | 'sin_ver' | 'sin_datos';
  origen: string;
  madurez: EstadoMadurez;
  estado_lead: EstadoLead;
};

/**
 * Juntas (J1/J2) en hoy..hoy+dias-1, con el contexto del lead listo para la
 * llamada. Un lead con J1 hoy y J2 mañana produce dos entradas.
 */
export const getJuntasProximas = cachedRead('getJuntasProximas', _getJuntasProximas, { tags: [TAG.leads], revalidate: TTL.user });
async function _getJuntasProximas(
  hoy: string = new Date().toISOString().slice(0, 10),
  dias = 2,
): Promise<JuntaProxima[]> {
  const fechas: string[] = [];
  for (let i = 0; i < dias; i++) fechas.push(masDiasISO(hoy, i));
  const fechasSet = new Set(fechas);
  const enLista = fechas.join(',');

  const supabase = (await getTenantDb());
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .or(`fecha_junta_1.in.(${enLista}),fecha_junta_2.in.(${enLista})`);
  if (error) throw new Error(`Query reuniones próximas falló: ${error.message}`);

  const leads = (data ?? []) as Lead[];
  // VSL engagement + presencia en la landing de todos los visitors en 2 queries
  // (antes: N+1 en el loop). Necesitamos AMBOS para no confundir "no vio" con
  // "no cruzamos su identidad": un lead con visitor_id que no aparece en NINGÚN
  // evento (ni landing ni VSL) NO probó no haber visto — la landing simplemente
  // no pasó bien su identificador (caso mayoritario, ver scripts/diag-tracking).
  const [vslMap, landingMap] = await Promise.all([
    getVslEngagementMap(leads.map((l) => l.visitor_id)),
    getVisitasLandingMap(leads.map((l) => l.visitor_id)),
  ]);
  const juntas: JuntaProxima[] = [];

  for (const lead of leads) {
    const eng = !lead.visitor_id
      ? { plays: 0, max_pct: null, sin_datos: true }
      : vslMap.get(lead.visitor_id) ?? { plays: 0, max_pct: null, sin_datos: false };
    const pisoLanding = !!lead.visitor_id && landingMap.has(lead.visitor_id);
    const candidatas: Array<{ tipo: 'J1' | 'J2'; fecha: string | null }> = [
      { tipo: 'J1', fecha: lead.fecha_junta_1 },
      { tipo: 'J2', fecha: lead.fecha_junta_2 },
    ];
    for (const c of candidatas) {
      if (!c.fecha || !fechasSet.has(c.fecha)) continue;
      // Flag recalibrado (identidad-consciente): 'vio' si hay actividad de VSL
      // (play o retención). 'sin_ver' SOLO si el lead pisó la landing pero no
      // arrancó el VSL — ahí sí es real que "agendó sin verlo". Si NO cruzamos su
      // identidad con ningún evento (ni landing ni VSL) → 'sin_datos': no afirmar
      // que no vio, porque casi siempre es la landing que no pasó el visitor_id.
      const vsl_estado: JuntaProxima['vsl_estado'] =
        (eng.plays > 0 || eng.max_pct != null)
          ? 'vio'
          : pisoLanding
          ? 'sin_ver'
          : 'sin_datos';
      // ¿Ya pasó por HORA? Una reunión de HOY que ya terminó no debe decir "hoy tenés
      // la reunión" (mostraba solo el día). Usa junta_N_at (Calendly) + 1h de gracia.
      const at = c.tipo === 'J1' ? lead.junta_1_at : lead.junta_2_at;
      const atMs = at ? Date.parse(at) : NaN;
      const paso = Number.isFinite(atMs) ? Date.now() >= atMs + 60 * 60_000 : c.fecha < hoy;
      juntas.push({
        lead_id: lead.id,
        tipo: c.tipo,
        fecha: c.fecha,
        // Label visible: pasó / hoy / mañana / dd/mm/aaaa (nunca el ISO crudo).
        dia: paso ? 'pasó' : c.fecha === hoy ? 'hoy' : c.fecha === masDiasISO(hoy, 1) ? 'mañana' : (() => { const [y, m, d] = c.fecha.split('-'); return `${d}/${m}/${y}`; })(),
        nombre: lead.nombre,
        empresa: lead.empresa,
        respuestas: {
          facturacion: lead.respuesta_facturacion,
          colaboradores: lead.respuesta_colaboradores,
          objetivo: lead.respuesta_objetivo,
          cuando_empezar: lead.respuesta_cuando_empezar,
        },
        vsl_plays: eng.plays,
        vsl_max_pct: eng.max_pct,
        vsl_estado,
        origen: origenLegible(lead),
        madurez: estadoMadurezLead(lead),
        estado_lead: lead.estado_lead,
      });
    }
  }

  // Orden: por fecha asc, J1 antes que J2 el mismo día
  juntas.sort((a, b) => (a.fecha === b.fecha ? (a.tipo === b.tipo ? 0 : a.tipo === 'J1' ? -1 : 1) : a.fecha < b.fecha ? -1 : 1));
  return juntas;
}

export type ColaTipo =
  | 'pendiente_marcar'
  | 'cobro_vencido'
  | 'j2_sin_match'
  | 'noshow_recontactar'
  | 'form_sin_agenda'
  | 'j1_sin_j2';

export type ColaItem = {
  tipo: ColaTipo;
  lead_id: number | null;       // null para j2_sin_match (no hay lead aún)
  lead_nombre: string;
  titulo: string;
  detalle: string;
  accion: string;
  link: string;
  // Para resolver pendiente_marcar / j1_sin_j2 inline (controles de Fase 9)
  pendiente_tipo?: TipoPendiente;
  motivo_actual?: string | null;
};

/**
 * Cola de acción del día: pendientes concretos, en orden de prioridad.
 * Orden: pendiente_marcar, cobro_vencido, j2_sin_match, noshow_recontactar,
 * form_sin_agenda, j1_sin_j2.
 */
export const getColaDeAccion = cachedRead('getColaDeAccion', _getColaDeAccion, { tags: [TAG.leads, TAG.pagos], revalidate: TTL.user });
async function _getColaDeAccion(
  hoy: string = new Date().toISOString().slice(0, 10),
): Promise<ColaItem[]> {
  const supabase = (await getTenantDb());
  const items: ColaItem[] = [];

  // ── 1) pendiente_marcar (tipos A y C) y j1_sin_j2 (tipo B) ──
  // Los tipo 'M' (nutrición manual vencida) viven solo en el worklist del CRM, no
  // en esta cola (su copy es de asistencia y no aplica).
  const pend = await getPendientesDeMarcar(hoy);
  const marcarAC = pend.items.filter((i) => i.tipo === 'A' || i.tipo === 'C');
  const tipoB = pend.items.filter((i) => i.tipo === 'B');
  for (const p of marcarAC) {
    items.push({
      tipo: 'pendiente_marcar',
      lead_id: p.lead_id,
      lead_nombre: p.lead_nombre,
      titulo: p.mensaje,
      detalle: p.tipo === 'A' ? 'Marca si asistió a la R1.' : 'Marca si asistió a la R2.',
      accion: 'Marcar asistencia',
      link: `/crm/${p.lead_id}`,
      pendiente_tipo: p.tipo,
    });
  }

  // ── 2) cobro_vencido: cuotas no pagadas con fecha_esperada <= hoy ──
  const { vencidas, porVencer } = await getCuotasPendientes(hoy);
  const cobrosVencidos = [...vencidas, ...porVencer.filter((c) => c.dias === 0)];
  for (const c of cobrosVencidos) {
    const etiqueta = c.numero === 0 ? 'el cobro inicial' : `la cuota ${c.numero}`;
    items.push({
      tipo: 'cobro_vencido',
      lead_id: c.lead_id,
      lead_nombre: c.lead_nombre,
      titulo: `Cobra ${etiqueta} de ${fmtUSDcola(c.monto_usd)} a ${c.lead_nombre}`,
      detalle: c.dias === 0 ? 'Vence hoy.' : `Venció el ${fmtFechaPendiente(c.fecha_esperada)} (hace ${Math.abs(c.dias)} día${Math.abs(c.dias) === 1 ? '' : 's'}).`,
      accion: 'Registrar pago',
      link: `/crm/${c.lead_id}`,
    });
  }

  // ── 3) j2_sin_match: review_queue resuelto=false ──
  const review = await listReviewPendientes();
  for (const r of review.filter((x) => x.tipo === 'j2_sin_match')) {
    items.push({
      tipo: 'j2_sin_match',
      lead_id: null,
      lead_nombre: r.nombre ?? r.email ?? 'desconocido',
      titulo: `Alguien agendó una R2 con ${r.email ?? 'email desconocido'} y no encontré su lead`,
      detalle: r.fecha_evento ? `Fecha de la R2: ${fmtFechaPendiente(r.fecha_evento)}. Busca el lead y carga la R2 a mano.` : 'Busca el lead y carga la R2 a mano.',
      accion: 'Resolver a mano',
      link: '/crm',
    });
  }

  // ── 4) noshow_recontactar: no-show de J1 en los últimos 14 días, sin junta futura, abierto ──
  const cutoff14 = restarDiasISO(hoy, 14);
  const { data: noshowRows, error: nsErr } = await supabase
    .from('leads')
    .select('id, nombre, fecha_junta_1, fecha_junta_2')
    .eq('asistio_j1', false)
    .eq('estado_lead', 'abierto')
    .gte('fecha_junta_1', cutoff14)
    .lt('fecha_junta_1', hoy);
  if (nsErr) throw new Error(`Query no-shows falló: ${nsErr.message}`);
  for (const r of (noshowRows ?? []) as Array<{ id: number; nombre: string; fecha_junta_1: string; fecha_junta_2: string | null }>) {
    if (r.fecha_junta_2 && r.fecha_junta_2 >= hoy) continue; // tiene J2 futura → no es no-show a recontactar
    items.push({
      tipo: 'noshow_recontactar',
      lead_id: r.id,
      lead_nombre: r.nombre,
      titulo: `${r.nombre} no se presentó a la R1: recontacta`,
      detalle: `La R1 era el ${fmtFechaPendiente(r.fecha_junta_1)}. Mándale un mensaje para reagendar.`,
      accion: 'Recontactar',
      link: `/crm/${r.id}`,
    });
  }

  // (form_sin_agenda salió de la cola en v3 Fase G: ahora es su propio bloque
  //  con flujo de nutrición — ver getFormulariosSinAgenda.)

  // ── 6) j1_sin_j2 (tipo B): tuvo J1, sigue abierto, sin J2 ni resolución ──
  for (const p of tipoB) {
    items.push({
      tipo: 'j1_sin_j2',
      lead_id: p.lead_id,
      lead_nombre: p.lead_nombre,
      titulo: p.mensaje,
      detalle: 'Agenda la R2 (Calendly) o marca la resolución.',
      accion: 'Resolver',
      link: `/crm/${p.lead_id}`,
      pendiente_tipo: 'B',
    });
  }

  return items;
}

function fmtUSDcola(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

// =============================================================================
// FORMULARIOS SIN AGENDA — su propio bloque con nutrición (v3 Fase G)
// =============================================================================
// Instant forms (meta_lead_id) que NO agendaron y siguen abiertos. Salen de la
// lista al resolverse (no_responde / perdido / descalificado) o al agendar.
// Orden: más viejos primero (los que llevan más días sin agendar pesan más).

export type FormSinAgenda = {
  lead_id: number;
  nombre: string;
  empresa: string | null;
  fecha_form: string;            // YYYY-MM-DD del instant form
  dias: number;                  // días desde el form
  nutricion_realizada: boolean;
  origen: string | null;         // anuncio/campaña para contexto
};

export async function getFormulariosSinAgenda(
  hoy: string = new Date().toISOString().slice(0, 10),
): Promise<FormSinAgenda[]> {
  const supabase = (await getTenantDb());
  const desde = restarDiasISO(hoy, 30); // ventana amplia para no perder rezagados
  const { data, error } = await supabase
    .from('leads')
    .select('id, nombre, empresa, created_at, nutricion_realizada, meta_ad_name, meta_campaign_name')
    .not('meta_lead_id', 'is', null)
    .is('fecha_agenda', null)
    .eq('estado_lead', 'abierto')
    .gte('created_at', desde)
    .order('created_at', { ascending: true }); // más viejos primero
  if (error) throw new Error(`Formularios sin agenda falló: ${error.message}`);

  const diff = (a: string, b: string) => {
    const [ay, am, ad] = a.split('-').map(Number);
    const [by, bm, bd] = b.split('-').map(Number);
    return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
  };

  return (data ?? []).map((r) => {
    const cd = (r.created_at as string).slice(0, 10);
    return {
      lead_id: r.id as number,
      nombre: (r.nombre as string) ?? 'Sin nombre',
      empresa: (r.empresa as string | null) ?? null,
      fecha_form: cd,
      dias: diff(cd, hoy),
      nutricion_realizada: (r.nutricion_realizada as boolean) ?? false,
      origen: (r.meta_ad_name as string | null) ?? (r.meta_campaign_name as string | null) ?? null,
    };
  });
}

// Total para el badge del tab Pendientes (v3 Fase G): filas accionables en la
// cola + formularios sin agenda.
export async function getPendientesBadge(
  hoy: string = new Date().toISOString().slice(0, 10),
): Promise<number> {
  const [cola, forms] = await Promise.all([getColaDeAccion(hoy), getFormulariosSinAgenda(hoy)]);
  return cola.length + forms.length;
}

// =============================================================================
// OBJETIVO GLOBAL — progreso acumulado (Fase 14)
// =============================================================================
// NO se ata al filtro de rango global: el objetivo es acumulado desde
// objetivo_desde, siempre. Sirve también de auditoría — si el contador de
// cierres no cuadra, faltan leads históricos o resoluciones sin marcar.
// =============================================================================

export type ObjetivoProgreso = {
  desde: string;
  cierres_actual: number;
  cierres_meta: number | null;
  cash_actual: number;
  cash_meta: number | null;
  // Sold = lo FIRMADO (Σ monto_cierre_usd de los ganados) — referencia, no es
  // cash cobrado (v3 Fase H).
  sold_actual: number;
  // Ritmo: cierres en los últimos 30 días → semanas estimadas para la meta
  cierres_30d: number;
  semanas_estimadas: number | null;
  cumplido: boolean;
};

const OBJETIVO_DESDE_DEFAULT = '2025-12-08';

export const getObjetivoProgreso = cachedRead('getObjetivoProgreso', _getObjetivoProgreso, { tags: [TAG.leads, TAG.pagos, TAG.settings], revalidate: TTL.user });
async function _getObjetivoProgreso(
  hoy: string = new Date().toISOString().slice(0, 10),
): Promise<ObjetivoProgreso> {
  const supabase = (await getTenantDb());

  const [cierresMeta, cashMeta, desdeRaw] = await Promise.all([
    getSettingNum('objetivo_cierres'),
    getSettingNum('objetivo_cash_usd'),
    getSetting('objetivo_desde'),
  ]);
  const desde = desdeRaw && /^\d{4}-\d{2}-\d{2}$/.test(desdeRaw) ? desdeRaw : OBJETIVO_DESDE_DEFAULT;

  // Cierres ganados desde `desde` (incluye ganados sin fecha_cierre cargada).
  const { data: ganados, error: gErr } = await supabase
    .from('leads')
    .select('fecha_cierre, monto_cierre_usd')
    .eq('estado_lead', 'ganado');
  if (gErr) throw new Error(`Query objetivo cierres falló: ${gErr.message}`);
  const ganadosRows = (ganados ?? []) as Array<{ fecha_cierre: string | null; monto_cierre_usd: number | null }>;
  const cuentan = ganadosRows.filter((g) => g.fecha_cierre === null || g.fecha_cierre >= desde);
  const cierres_actual = cuentan.length;
  // Sold = total firmado de esos cierres (lo vendido, no lo cobrado).
  const sold_actual = cuentan.reduce((s, g) => s + Number(g.monto_cierre_usd ?? 0), 0);

  // Cash: Σ pagos pagado=true con fecha_pago en [desde, hoy].
  const cash_actual = await getCashCollectedPeriodo(desde, hoy);

  // Ritmo: cierres con fecha_cierre en los últimos 30 días.
  const hace30 = restarDiasISO(hoy, 30);
  const cierres_30d = ganadosRows.filter(
    (g) => g.fecha_cierre !== null && g.fecha_cierre >= hace30 && g.fecha_cierre <= hoy,
  ).length;

  const faltanCierres = cierresMeta !== null ? Math.max(cierresMeta - cierres_actual, 0) : 0;
  const cierresPorSemana = cierres_30d / (30 / 7);
  const semanas_estimadas =
    cierresPorSemana > 0 && faltanCierres > 0 ? Math.ceil(faltanCierres / cierresPorSemana) : null;

  const cumplido =
    cierresMeta !== null &&
    cashMeta !== null &&
    cierres_actual >= cierresMeta &&
    cash_actual >= cashMeta;

  return {
    desde,
    cierres_actual,
    cierres_meta: cierresMeta,
    cash_actual,
    cash_meta: cashMeta,
    sold_actual,
    cierres_30d,
    semanas_estimadas,
    cumplido,
  };
}

// =============================================================================
// REGLAS NUEVAS DEL SEMÁFORO (Fase 16)
// =============================================================================

export type AdsetFatiga = {
  adset_name: string;
  frequency_7d: number;
  cpl_7d_usd: number;
  cpl_28d_usd: number;
};

/**
 * Adsets con posible fatiga de creativo: spend 7d > USD 50, frequency media 7d
 * > 3.5 Y CPL 7d > 1.5 × CPL 28d. (frequency y leads_count ya están por fila.)
 */
export const getFatigaAdsets = cachedRead('getFatigaAdsets', _getFatigaAdsets, { tags: [TAG.marketing], revalidate: TTL.cron });
async function _getFatigaAdsets(
  hoy: string = new Date().toISOString().slice(0, 10),
): Promise<AdsetFatiga[]> {
  const supabase = (await getTenantDb());
  const d28 = restarDiasISO(hoy, 28);
  const d7 = restarDiasISO(hoy, 7);
  type Row = { fecha: string; adset_id: string | null; adset_name: string | null; spend: number | null; frequency: number | null; leads_count: number | null };
  const filas = await leerTodo<Row>(
    supabase, T_METRICAS,
    'id, fecha, ad_id, adset_id, adset_name, spend, frequency, leads_count',
    {
      orden: ORDEN_METRICAS,
      eq: { plataforma: 'meta' },
      filtros: (q) => q.gte('fecha', d28).lte('fecha', hoy),
    },
  );

  const porAdset = new Map<string, Row[]>();
  for (const r of filas) {
    const k = r.adset_id ?? r.adset_name ?? 'sin_adset';
    const arr = porAdset.get(k) ?? [];
    arr.push(r);
    porAdset.set(k, arr);
  }

  const out: AdsetFatiga[] = [];
  for (const rows of porAdset.values()) {
    const en7 = rows.filter((r) => r.fecha >= d7);
    const spend7Mxn = en7.reduce((s, r) => s + Number(r.spend ?? 0), 0);
    const spend7Usd = spend7Mxn / TIPO_DE_CAMBIO_USD_MXN;
    if (spend7Usd <= 50) continue;

    const freqVals = en7.map((r) => Number(r.frequency ?? 0)).filter((v) => v > 0);
    const freq7 = freqVals.length > 0 ? freqVals.reduce((s, v) => s + v, 0) / freqVals.length : 0;
    if (freq7 <= 3.5) continue;

    const leads7 = en7.reduce((s, r) => s + Number(r.leads_count ?? 0), 0);
    const spend28Mxn = rows.reduce((s, r) => s + Number(r.spend ?? 0), 0);
    const leads28 = rows.reduce((s, r) => s + Number(r.leads_count ?? 0), 0);
    if (leads7 === 0 || leads28 === 0) continue;
    const cpl7 = spend7Mxn / TIPO_DE_CAMBIO_USD_MXN / leads7;
    const cpl28 = spend28Mxn / TIPO_DE_CAMBIO_USD_MXN / leads28;
    if (cpl7 <= 1.5 * cpl28) continue;

    out.push({
      adset_name: rows[0].adset_name ?? rows[0].adset_id ?? 'adset',
      frequency_7d: freq7,
      cpl_7d_usd: cpl7,
      cpl_28d_usd: cpl28,
    });
  }
  return out;
}

export type TramoJ1J2 = { promedio: number | null; n: number };

/**
 * Promedio del tramo J1 → J2 (días) sobre leads con J1 en los últimos `dias`
 * días (default 60) y J2 cargada. Para la alerta de "deals que se enfrían".
 */
export async function getTramoJ1J2Reciente(
  hoy: string = new Date().toISOString().slice(0, 10),
  dias = 60,
): Promise<TramoJ1J2> {
  const supabase = (await getTenantDb());
  const desde = restarDiasISO(hoy, dias);
  const { data, error } = await supabase
    .from('leads')
    .select('fecha_junta_1, fecha_junta_2')
    .gte('fecha_junta_1', desde)
    .lte('fecha_junta_1', hoy)
    .not('fecha_junta_2', 'is', null);
  if (error) throw new Error(`Query tramo J1→J2 falló: ${error.message}`);

  const difs: number[] = [];
  for (const r of (data ?? []) as Array<{ fecha_junta_1: string | null; fecha_junta_2: string | null }>) {
    if (!r.fecha_junta_1 || !r.fecha_junta_2) continue;
    const [ay, am, ad] = r.fecha_junta_1.split('-').map(Number);
    const [by, bm, bd] = r.fecha_junta_2.split('-').map(Number);
    const d = Math.floor((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
    if (d >= 0) difs.push(d);
  }
  return {
    promedio: difs.length > 0 ? difs.reduce((s, v) => s + v, 0) / difs.length : null,
    n: difs.length,
  };
}

// =============================================================================
// TENDENCIAS — series semanal/mensual de marketing + comercial (Fase 16)
// =============================================================================

export type FormatoSerie = 'usd' | 'num' | 'pct';
// Cuadro de contexto bajo el gráfico (v3 Fase E). `texto` permite un valor ya
// formateado (ej. tiempo m:ss) que ignora `valor`/`formato`. valor null → el
// cliente lo omite (no mostramos ceros/sin datos).
export type CuadroContexto = {
  label: string;
  valor: number | null;
  formato: FormatoSerie;
  hint?: string;
  texto?: string;
};
export type SerieMetrica = {
  key: string;
  label: string;
  formato: FormatoSerie;
  valores: Array<number | null>;
  cuadros: CuadroContexto[];          // contexto específico de esta métrica (v3 Fase E)
};
export type GranularidadTendencia = 'diario' | 'semanal' | 'mensual';
export type Tendencias = {
  granularidad: GranularidadTendencia;
  periodos: string[];                 // etiquetas eje X
  marketing: SerieMetrica[];
  comercial: SerieMetrica[];
};

function nombreMesCorto(yyyy_mm_dd: string): string {
  const [y, m] = yyyy_mm_dd.split('-').map(Number);
  return new Intl.DateTimeFormat('es-MX', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1)));
}
function diaCorto(yyyy_mm_dd: string): string {
  const [y, m, d] = yyyy_mm_dd.split('-').map(Number);
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
}

export const getTendencias = cachedRead('getTendencias', _getTendencias, { tags: [TAG.marketing, TAG.leads], revalidate: TTL.cron });
async function _getTendencias(
  start: string,
  end: string = new Date().toISOString().slice(0, 10),
): Promise<Tendencias> {
  const supabase = (await getTenantDb());

  // Piso de datos: no mostrar nada anterior a noviembre 2025.
  const PISO_TENDENCIAS = '2025-11-01';
  if (start < PISO_TENDENCIAS) start = PISO_TENDENCIAS;

  // Techo: nunca incluir HOY. El dato del día en curso suele estar en 0 porque
  // los crons todavía no cargaron; cortamos en "ayer" para que la tendencia no
  // termine en un falso desplome a cero.
  const ayer = ayerEnTijuana();
  if (end > ayer && ayer >= start) end = ayer;

  // Helpers de fecha locales
  const primerDiaMes = (s: string) => { const [y, m] = s.split('-').map(Number); return `${y}-${String(m).padStart(2, '0')}-01`; };
  const finDeMes = (s: string) => { const [y, m] = s.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };
  const addMes = (s: string, k: number) => { const [y, m] = s.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + k, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`; };
  const diffDias = (a: string, b: string) => { const [ay, am, ad] = a.split('-').map(Number); const [by, bm, bd] = b.split('-').map(Number); return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000); };

  // Granularidad derivada del LARGO del rango (v3 Fase E, PASO 2): rangos
  // cortos → diario; medianos → semanal; largos → mensual.
  const span = Math.max(0, diffDias(start, end));
  const granularidad: GranularidadTendencia = span <= 31 ? 'diario' : span <= 180 ? 'semanal' : 'mensual';

  // Períodos que cubren [start, end] (viejo → nuevo).
  const periodos: Array<{ inicio: string; fin: string; label: string }> = [];
  if (granularidad === 'diario') {
    let cur = start;
    while (cur <= end) { periodos.push({ inicio: cur, fin: cur, label: diaCorto(cur) }); cur = restarDiasISO(cur, -1); }
  } else if (granularidad === 'semanal') {
    let cur = lunesDeFecha(start);
    while (cur <= end) { periodos.push({ inicio: cur, fin: restarDiasISO(cur, -6), label: diaCorto(cur) }); cur = restarDiasISO(cur, -7); }
  } else {
    let cur = primerDiaMes(start);
    while (cur <= end) { periodos.push({ inicio: cur, fin: finDeMes(cur), label: nombreMesCorto(cur) }); cur = addMes(cur, 1); }
  }
  if (periodos.length === 0) periodos.push({ inicio: start, fin: end, label: diaCorto(start) });

  const rangoInicio = periodos[0].inicio;
  const rangoFin = periodos[periodos.length - 1].fin;
  const idxDe = (fecha: string): number => {
    for (let i = 0; i < periodos.length; i++) if (fecha >= periodos[i].inicio && fecha <= periodos[i].fin) return i;
    return -1;
  };
  const n = periodos.length;
  const z = () => Array.from({ length: n }, () => 0);

  // El rango lo elige quien llama y puede ser de meses: las cuatro lecturas de
  // métricas van paginadas (ver ORDEN_METRICAS).
  const enRango = (q: ConsultaPaginada) => q.gte('fecha', rangoInicio).lte('fecha', rangoFin);
  type YtRow = { fecha: string; youtube_views: number | null };
  const [metaRows, pandaRows, ytRows, vslPruebaRows, leadsRes, pagosRes] = await Promise.all([
    leerTodo<{ fecha: string; impressions: number | null; link_clicks: number | null; landing_page_views: number | null; spend: number | null; leads_count: number | null }>(
      supabase, T_METRICAS,
      'id, fecha, ad_id, impressions, link_clicks, landing_page_views, spend, leads_count',
      { orden: ORDEN_METRICAS, eq: { plataforma: 'meta' }, filtros: enRango },
    ),
    leerTodo<{ fecha: string; video_plays: number | null; video_unique_viewers: number | null; video_retention_p50: number | null; video_avg_watch_seconds: number | null }>(
      supabase, T_METRICAS,
      'id, fecha, ad_id, video_plays, video_unique_viewers, video_retention_p50, video_avg_watch_seconds',
      { orden: ORDEN_METRICAS, eq: { plataforma: 'panda' }, filtros: enRango },
    ),
    // VSL en YouTube (historia, antes de migrar a Panda) — para que la serie de plays no arranque de cero.
    leerTodo<YtRow>(
      supabase, T_METRICAS, 'id, fecha, ad_id, youtube_views',
      { orden: ORDEN_METRICAS, eq: { plataforma: 'youtube', youtube_video_type: 'vsl' }, filtros: enRango },
    ),
    // VSL ANTERIOR de prueba (0023): línea propia en Tendencias, NO entra al funnel
    // (youtube_video_type NULL → ignorado por vsl_views y por la serie 'vsl_plays').
    leerTodo<YtRow>(
      supabase, T_METRICAS, 'id, fecha, ad_id, youtube_views',
      { orden: ORDEN_METRICAS, eq: { plataforma: 'youtube', youtube_video_id: VSL_PRUEBA_VIDEO_ID }, filtros: enRango },
    ),
    supabase.from('leads').select('fecha_agenda, fecha_junta_1, asistio_j1, fecha_cierre, estado_lead').or(`fecha_agenda.gte.${rangoInicio},fecha_junta_1.gte.${rangoInicio},fecha_cierre.gte.${rangoInicio}`),
    supabase.from('pagos').select('fecha_pago, monto_usd, pagado').eq('pagado', true).gte('fecha_pago', rangoInicio).lte('fecha_pago', rangoFin),
  ]);
  for (const r of [leadsRes, pagosRes]) if (r.error) throw new Error(`getTendencias falló: ${r.error.message}`);

  const imp = z(), clk = z(), land = z(), spendMxn = z(), leads = z();
  for (const r of metaRows) {
    const i = idxDe(r.fecha); if (i < 0) continue;
    imp[i] += r.impressions ?? 0; clk[i] += r.link_clicks ?? 0; land[i] += r.landing_page_views ?? 0; spendMxn[i] += Number(r.spend ?? 0); leads[i] += r.leads_count ?? 0;
  }
  // VSL — plays por período + resumen (únicos/retención/tiempo) para sus cuadros.
  const vslPlays = z();
  let uniqueTotal = 0, retSum = 0, retN = 0, watchSum = 0, watchN = 0;
  for (const r of pandaRows) {
    const i = idxDe(r.fecha); if (i >= 0) vslPlays[i] += Number(r.video_plays ?? 0);
    uniqueTotal += Number(r.video_unique_viewers ?? 0);
    if (r.video_retention_p50 != null) { retSum += Number(r.video_retention_p50); retN++; }
    if (r.video_avg_watch_seconds != null) { watchSum += Number(r.video_avg_watch_seconds); watchN++; }
  }
  // YouTube (historia del VSL) — se suma a la misma serie de plays.
  for (const r of ytRows) {
    const i = idxDe(r.fecha); if (i >= 0) vslPlays[i] += Number(r.youtube_views ?? 0);
  }
  // VSL anterior de prueba (0023): se suma a la MISMA línea "Plays del VSL"
  // (visualización histórica de plays a través de las versiones). Sigue FUERA
  // del funnel: vsl_views en getResumenMarketing solo cuenta youtube_video_type='vsl',
  // y este marcador tiene type NULL.
  for (const r of vslPruebaRows) {
    const i = idxDe(r.fecha); if (i >= 0) vslPlays[i] += Number(r.youtube_views ?? 0);
  }
  const agendas = z(), asistencias = z(), cierres = z();
  for (const r of (leadsRes.data ?? []) as Array<{ fecha_agenda: string | null; fecha_junta_1: string | null; asistio_j1: boolean | null; fecha_cierre: string | null; estado_lead: string }>) {
    if (r.fecha_junta_1) { const i = idxDe(r.fecha_junta_1); if (i >= 0) agendas[i] += 1; }
    if (r.fecha_junta_1 && r.asistio_j1 === true) { const i = idxDe(r.fecha_junta_1); if (i >= 0) asistencias[i] += 1; }
    if (r.fecha_cierre && r.estado_lead === 'ganado') { const i = idxDe(r.fecha_cierre); if (i >= 0) cierres[i] += 1; }
  }
  const cash = z();
  let numPagos = 0;
  for (const r of (pagosRes.data ?? []) as Array<{ fecha_pago: string | null; monto_usd: number | null }>) {
    if (!r.fecha_pago) continue; const i = idxDe(r.fecha_pago); if (i >= 0) { cash[i] += Number(r.monto_usd ?? 0); numPagos++; }
  }

  const spendUsd = spendMxn.map((s) => s / TIPO_DE_CAMBIO_USD_MXN);
  const ratio = (num: number[], den: number[], k = 100): Array<number | null> => num.map((v, i) => (den[i] > 0 ? (v / den[i]) * k : null));
  const ctr = ratio(clk, imp);
  const cpl = spendUsd.map((s, i) => (leads[i] > 0 ? s / leads[i] : null));
  const cac = spendUsd.map((s, i) => (cierres[i] > 0 ? s / cierres[i] : null));

  // ── Cuadros de contexto por métrica (v3 Fase E, PASO 3) ──
  const palabra = granularidad === 'diario' ? 'día' : granularidad === 'semanal' ? 'semana' : 'mes';
  const sumDe = (a: number[]) => a.reduce((s, v) => s + v, 0);
  const nn = (a: Array<number | null>) => a.filter((v): v is number => v !== null && Number.isFinite(v));
  const promDe = (a: Array<number | null>) => { const x = nn(a); return x.length ? x.reduce((s, v) => s + v, 0) / x.length : null; };
  const ultimoDe = (a: Array<number | null>) => { const x = nn(a); return x.length ? x[x.length - 1] : null; };
  const extremo = (a: Array<number | null>, menor: boolean) => { let bi = -1, bv = menor ? Infinity : -Infinity; a.forEach((v, i) => { if (v != null && Number.isFinite(v) && (menor ? v < bv : v > bv)) { bv = v; bi = i; } }); return bi < 0 ? null : { valor: bv, label: periodos[bi].label }; };

  const cuadrosSuma = (a: number[], formato: FormatoSerie): CuadroContexto[] => {
    const total = sumDe(a);
    if (total === 0) return [];
    const out: CuadroContexto[] = [
      { label: 'Total del período', valor: total, formato },
      { label: `Promedio por ${palabra}`, valor: promDe(a), formato },
    ];
    const pico = extremo(a, false);
    if (pico) out.push({ label: `Mejor ${palabra}`, valor: pico.valor, formato, hint: pico.label });
    return out;
  };
  const cuadrosTasa = (a: Array<number | null>, formato: FormatoSerie, menorEsMejor = false): CuadroContexto[] => {
    if (promDe(a) === null) return [];
    const out: CuadroContexto[] = [{ label: 'Promedio del período', valor: promDe(a), formato }];
    const mejor = extremo(a, menorEsMejor);
    if (mejor) out.push({ label: `${menorEsMejor ? 'Menor' : 'Mejor'} ${palabra}`, valor: mejor.valor, formato, hint: mejor.label });
    out.push({ label: 'Último período', valor: ultimoDe(a), formato });
    return out;
  };
  const cuadrosLeads = (): CuadroContexto[] => {
    if (sumDe(leads) === 0) return [];
    const cplProm = sumDe(leads) > 0 ? sumDe(spendUsd) / sumDe(leads) : null;
    const out: CuadroContexto[] = [
      { label: 'Total del período', valor: sumDe(leads), formato: 'num' },
      { label: 'CPL promedio', valor: cplProm, formato: 'usd' },
    ];
    const pico = extremo(leads, false);
    if (pico) out.push({ label: `Mejor ${palabra}`, valor: pico.valor, formato: 'num', hint: pico.label });
    return out;
  };
  const cuadrosAgendas = (): CuadroContexto[] => {
    if (sumDe(agendas) === 0) return [];
    const tasa = sumDe(leads) > 0 ? (sumDe(agendas) / sumDe(leads)) * 100 : null;
    const out: CuadroContexto[] = [
      { label: 'Total del período', valor: sumDe(agendas), formato: 'num' },
      { label: 'Tasa form → agenda', valor: tasa, formato: 'pct', hint: 'agendas ÷ forms del período' },
    ];
    const pico = extremo(agendas, false);
    if (pico) out.push({ label: `Mejor ${palabra}`, valor: pico.valor, formato: 'num', hint: pico.label });
    return out;
  };
  const cuadrosCash = (): CuadroContexto[] => {
    if (sumDe(cash) === 0) return [];
    const ticket = numPagos > 0 ? sumDe(cash) / numPagos : null;
    return [
      { label: 'Total del período', valor: sumDe(cash), formato: 'usd' },
      { label: 'Ticket promedio', valor: ticket, formato: 'usd', hint: 'cash ÷ nº de pagos' },
      { label: 'Nº de pagos', valor: numPagos, formato: 'num' },
    ];
  };
  const cuadrosVsl = (): CuadroContexto[] => {
    if (sumDe(vslPlays) === 0) return [];
    const watchTexto = watchN > 0 ? `${Math.floor((watchSum / watchN) / 60)}:${String(Math.round((watchSum / watchN) % 60)).padStart(2, '0')}` : undefined;
    const out: CuadroContexto[] = [{ label: 'Plays totales', valor: sumDe(vslPlays), formato: 'num' }];
    if (pandaRows.length > 0) out.push({ label: 'Espectadores únicos', valor: uniqueTotal, formato: 'num', hint: 'solo Panda' });
    if (retN > 0) out.push({ label: 'Retención media', valor: retSum / retN, formato: 'pct' });
    if (watchTexto) out.push({ label: 'Tiempo promedio', valor: watchSum / watchN, formato: 'num', texto: watchTexto, hint: 'min:seg' });
    return out;
  };

  return {
    granularidad,
    periodos: periodos.map((p) => p.label),
    marketing: [
      { key: 'impresiones', label: 'Impresiones', formato: 'num', valores: imp, cuadros: cuadrosSuma(imp, 'num') },
      { key: 'landing', label: 'Visitas a la landing', formato: 'num', valores: land, cuadros: cuadrosSuma(land, 'num') },
      { key: 'ctr_link', label: 'CTR de link', formato: 'pct', valores: ctr, cuadros: cuadrosTasa(ctr, 'pct') },
      { key: 'spend', label: 'Ad Spend (USD)', formato: 'usd', valores: spendUsd, cuadros: cuadrosSuma(spendUsd, 'usd') },
      { key: 'leads', label: 'Leads (forms)', formato: 'num', valores: leads, cuadros: cuadrosLeads() },
      { key: 'cpl', label: 'CPL (USD)', formato: 'usd', valores: cpl, cuadros: cuadrosTasa(cpl, 'usd', true) },
      { key: 'vsl_plays', label: 'Plays del VSL', formato: 'num', valores: vslPlays, cuadros: cuadrosVsl() },
    ],
    comercial: [
      { key: 'agendas', label: 'Agendas', formato: 'num', valores: agendas, cuadros: cuadrosAgendas() },
      { key: 'asistencias', label: 'Asistencias a R1', formato: 'num', valores: asistencias, cuadros: cuadrosSuma(asistencias, 'num') },
      { key: 'cierres', label: 'Cierres', formato: 'num', valores: cierres, cuadros: cuadrosSuma(cierres, 'num') },
      { key: 'cash', label: 'Cash collected', formato: 'usd', valores: cash, cuadros: cuadrosCash() },
      { key: 'cac', label: 'CAC', formato: 'usd', valores: cac, cuadros: cuadrosTasa(cac, 'usd', true) },
    ],
  };
}

// =============================================================================
// Nombre de campaña desde el ID numérico (Mejoras v3, Fase B bug 2)
// =============================================================================
// Los leads de Calendly traen utm_campaign con el ID numérico de Meta, no el
// nombre. Las métricas a nivel anuncio (Fase 1 v2) sí tienen campaign_id +
// campaign_name: cruzamos para mostrar un nombre legible.

/** Mapa campaign_id → campaign_name (el más reciente). */
// Cacheado por-request: el mapa campaign_id→nombre es un full-scan que varios
// flujos piden por separado (page de leads, crm-map, etc.).
export const getCampaignNameMap = cachedRead('getCampaignNameMap', _getCampaignNameMap, { tags: [TAG.marketing], revalidate: TTL.cron });
async function _getCampaignNameMap(): Promise<Record<string, string>> {
  const supabase = (await getTenantDb());
  // Paginado y agregado al vuelo. Sin paginar volvían 1000 de las 1714 filas
  // meta de ws1, ordenadas por `fecha` desc: la campaña que dejó de correr hace
  // meses caía del corte y la UI la mostraba "(sin nombre)". Y `fecha` NO es
  // única (~8 filas/día), así que ordenar solo por ella tampoco sirve para
  // paginar: va ORDEN_METRICAS (fecha, ad_id, id) ASCENDENTE y el "más
  // reciente" sale solo — cada fila pisa a la anterior, la última gana.
  const map: Record<string, string> = {};
  try {
    await leerPorPaginas<{ campaign_id: string; campaign_name: string }>(
      supabase, T_METRICAS, 'id, fecha, ad_id, campaign_id, campaign_name',
      (filas) => { for (const r of filas) map[r.campaign_id] = r.campaign_name; },
      {
        orden: ORDEN_METRICAS,
        eq: { plataforma: 'meta' },
        filtros: (q) => q.not('campaign_id', 'is', null).not('campaign_name', 'is', null),
      },
    );
  } catch (e) {
    throw new Error(`getCampaignNameMap falló: ${e instanceof Error ? e.message : String(e)}`);
  }
  return map;
}

/**
 * Resuelve el nombre de la campaña a partir de utm_campaign.
 * - Si es texto (no numérico) → tal cual.
 * - Si es ID numérico y está en el mapa → el nombre.
 * - Si es numérico sin nombre → "Campaña <id> (sin nombre)" + id en tooltip.
 * Nunca devuelve un ID numérico pelado.
 */
export function resolverNombreCampana(
  utmCampaign: string | null,
  map: Record<string, string>,
): { texto: string | null; tooltip: string | null } {
  const v = utmCampaign?.trim();
  if (!v) return { texto: null, tooltip: null };
  if (!/^\d+$/.test(v)) return { texto: v, tooltip: null };
  const nombre = map[v];
  if (nombre) return { texto: nombre, tooltip: v };
  return { texto: `Campaña ${v} (sin nombre)`, tooltip: v };
}

/** Mapa ad_id → ad_name (el más reciente), gemelo de getCampaignNameMap. */
// Un ad renombrado en Meta cambia su nombre en las métricas pero NO en el
// leads.meta_ad_name denormalizado; resolvemos por id para reflejar el rename.
export const getAdNameMap = cachedRead('getAdNameMap', _getAdNameMap, { tags: [TAG.marketing], revalidate: TTL.cron });
async function _getAdNameMap(): Promise<Record<string, string>> {
  const supabase = (await getTenantDb());
  // Mismo arreglo que getCampaignNameMap: paginado con orden único ascendente,
  // la última fila de cada ad_id es su nombre más reciente. Sin paginar, un ad
  // viejo caía del corte y volvía a mostrar el meta_ad_name obsoleto.
  const map: Record<string, string> = {};
  try {
    await leerPorPaginas<{ ad_id: string; ad_name: string }>(
      supabase, T_METRICAS, 'id, fecha, ad_id, ad_name',
      (filas) => { for (const r of filas) map[r.ad_id] = r.ad_name; },
      {
        orden: ORDEN_METRICAS,
        eq: { plataforma: 'meta' },
        filtros: (q) => q.not('ad_id', 'is', null).not('ad_name', 'is', null),
      },
    );
  } catch (e) {
    throw new Error(`getAdNameMap falló: ${e instanceof Error ? e.message : String(e)}`);
  }
  return map;
}

/**
 * Nombre del anuncio a mostrar: prefiere el nombre FRESCO resuelto por
 * meta_ad_id (refleja renames); cae al denormalizado meta_ad_name / adset.
 */
export function resolverNombreAd(
  metaAdId: string | null,
  fallback: string | null,
  map: Record<string, string>,
): string | null {
  const id = metaAdId?.trim();
  if (id && map[id]) return map[id];
  return fallback ?? null;
}

// ⚠️ `resolverAdIdPorNombre` y `adIdDeLead` SE MUDARON a lib/atribucion-url.ts, que no
// tiene `server-only`. Son funciones puras que deciden IDENTIDAD —a qué anuncio apunta
// la ficha de un lead— y acá no las podía importar ningún test: quedaban siendo lo único
// sin red justo donde más duele. Es la misma regla que `exigirClienteDePrueba`.
// Se re-exportan para no tocar los cuatro llamadores.
export { resolverAdIdPorNombre, adIdDeLead } from './atribucion-url';
