// =============================================================================
// onboarding-extract — extracción HISTÓRICA de datos de un cliente nuevo
// =============================================================================
// Motor por tandas reanudables (el techo serverless es 300s por request): cada
// tick corre EL primer job no terminado en orden de dependencias, con un
// presupuesto de tiempo, persiste el cursor en onboarding.state y devuelve el
// estado. La UI del wizard repite ticks mientras extraction.status='running'
// (patrón del botón Sincronizar de /closing); si el usuario cierra, el próximo
// login retoma donde quedó. Todo corre en el WORKSPACE del request (sesión del
// admin-cliente o super admin impersonando) → getTenantDb/credWs ya scopean.
//
// Orden (dependencias reales de los crons):
//   meta_metrics    → marketing_metrics_daily (ayer → 365 días atrás, cursor)
//   meta_leads      → leads (poll de 90 días, lo que Meta retiene)
//   ad_transcripts  → transcribe TODOS los ads ingestados (sin límite de 45d)
//   script_analyses → syncScriptAnalyses drenado (depende de transcripts)
//   fathom_calls    → syncClosingCalls drenado (matchea contra leads)
//   vsl_metrics     → YouTube/Panda por RANGO (una llamada por video)
// Jobs sin integración/config → 'skipped' (JAMÁS caer al dato del dueño).

import 'server-only';
import {
  fetchMetaInsights, parseInsightsToMetrics, upsertMetrics, fetchAdCreatives, applyCreatives,
  fetchAdsetBudgets, MetaRateLimitError, MetaTokenError,
} from './meta-ads';
import type { MarketingMetricRow } from './types';
import { pollMetaLeads } from './meta-leads';
import { transcribeAd, STRUCTURE_SYSTEM_BASE, IMAGE_PROMPT_BASE } from './transcribe';
import { getPromptText } from './prompt-render';
import { syncScriptAnalyses } from './ads-analyst';
import { syncClosingCalls, RESERVA_LLAMADA_MS } from './closing';
import { fetchYouTubeAnalyticsDaily } from './youtube-analytics';
import { fetchPandaRangeStats } from './panda';
import { getTenantDb } from './workspace';
import { leerTodo, leerPorPaginas } from './supabase-paginado';
import { enTandas } from './ids-con-filas';
import { credWs, integracionConectada } from './credenciales';
import { getSetting } from './settings';
import { ayerEnTijuana, diasAntes } from './date-utils';
import {
  getEstadoOnboarding, setEstadoOnboarding, patchEstadoOnboarding, JOB_KEYS,
  type JobKey, type JobState, type OnboardingState,
} from './onboarding-state';

/** Ventana histórica de métricas (días hacia atrás desde ayer). */
const DIAS_HISTORICO = 365;
/** Pausa entre días con datos (respeto al rate limit de Meta, como backfill-meta). */
const PAUSA_DIA_MS = 1500;
const PAUSA_DIA_VACIO_MS = 150;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ahora = () => new Date().toISOString();

// ─────────────────────────────────────────────────────────────────────────────
// Inicio: decidir qué jobs corren y cuáles se saltean (según lo conectado)
// ─────────────────────────────────────────────────────────────────────────────

async function jobAplica(key: JobKey): Promise<{ aplica: boolean; motivo?: string }> {
  switch (key) {
    case 'meta_metrics':
      return (await integracionConectada('meta'))
        ? { aplica: true }
        : { aplica: false, motivo: 'Meta no conectado' };
    case 'meta_leads': {
      if (!(await integracionConectada('meta'))) return { aplica: false, motivo: 'Meta no conectado' };
      const pageToken = await credWs('META_PAGE_ACCESS_TOKEN');
      const pageId = await getSetting('meta_page_id');
      if (!pageToken || !pageId) return { aplica: false, motivo: 'Falta token de página o ID de página' };
      return { aplica: true };
    }
    case 'ad_transcripts':
    case 'script_analyses':
      // Dependen de meta_metrics; el candidateo sobre tablas vacías da 0 y done.
      return (await integracionConectada('meta'))
        ? { aplica: true }
        : { aplica: false, motivo: 'Meta no conectado' };
    case 'fathom_calls':
      return (await integracionConectada('fathom'))
        ? { aplica: true }
        : { aplica: false, motivo: 'Fathom no conectado' };
    case 'vsl_metrics': {
      const yt = (await integracionConectada('youtube')) && !!(await getSetting('youtube_vsl_video_id'));
      const panda = (await integracionConectada('panda')) && !!(await getSetting('panda_vsl_video_ids'));
      return yt || panda ? { aplica: true } : { aplica: false, motivo: 'Sin YouTube/Panda con videos configurados' };
    }
  }
}

/**
 * Arranca (o re-evalúa) la extracción del workspace actual: los jobs sin
 * integración quedan 'skipped'; si el cliente conecta algo después, volver a
 * llamar esto revive el job (skipped → pending). Nunca degrada done/running.
 */
export async function iniciarExtraccion(): Promise<OnboardingState> {
  const s = await getEstadoOnboarding();

  if (s.extraction.status === 'idle') {
    s.extraction.status = 'running';
    s.extraction.startedAt = ahora();
  } else if (s.extraction.status === 'done' || s.extraction.status === 'error') {
    // re-evaluación (conectó algo nuevo o reintenta): volver a correr
    s.extraction.status = 'running';
    s.extraction.finishedAt = null;
  }

  for (const key of JOB_KEYS) {
    const job = s.extraction.jobs[key];
    if (job.status === 'done' || job.status === 'running') continue;
    const { aplica, motivo } = await jobAplica(key);
    if (aplica) {
      if (job.status !== 'pending') { job.status = 'pending'; job.error = null; }
    } else {
      job.status = 'skipped';
      job.detail = motivo ?? null;
    }
    job.updatedAt = ahora();
  }

  // ¿Quedó algo por hacer?
  if (!JOB_KEYS.some((k) => s.extraction.jobs[k].status === 'pending' || s.extraction.jobs[k].status === 'running')) {
    s.extraction.status = 'done';
    s.extraction.finishedAt = ahora();
  }
  await setEstadoOnboarding(s);
  return s;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tick: correr el siguiente job con presupuesto
// ─────────────────────────────────────────────────────────────────────────────

/** TTL del lease del runner: mayor que la sub-corrida más larga (~150s). */
const LEASE_MS = 300_000;

/** Rate limit transitorio de Meta (no es un error del cliente): reintentar solo. */
function esRateLimit(e: unknown, msg: string): boolean {
  return e instanceof MetaRateLimitError || /rate limit/i.test(msg) || /Graph error \((?:4|17|613)\)/.test(msg);
}

export async function tickExtraccion(budgetMs = 240_000): Promise<OnboardingState> {
  const deadline = Date.now() + budgetMs;
  let s = await getEstadoOnboarding();
  if (s.extraction.status !== 'running') return s;

  // Lease anti doble-runner (dos pestañas / retry mientras un tick sigue vivo):
  // si otro runner refrescó el lease hace poco, este tick no hace nada. La
  // ventana de carrera del acquire es de milisegundos (mejor-esfuerzo, las
  // escrituras de los jobs son idempotentes igual).
  const lease = s.extraction.leaseAt ? Date.parse(s.extraction.leaseAt) : 0;
  if (Number.isFinite(lease) && Date.now() - lease < LEASE_MS) return s;
  await patchEstadoOnboarding((st) => { st.extraction.leaseAt = ahora(); });

  // Mientras quede presupuesto, avanzar jobs en orden.
  while (Date.now() < deadline - 5_000) {
    s = await getEstadoOnboarding();
    const key = JOB_KEYS.find((k) => {
      const st = s.extraction.jobs[k].status;
      return st === 'pending' || st === 'running';
    });
    if (!key) {
      return patchEstadoOnboarding((st) => {
        st.extraction.status = 'done';
        st.extraction.finishedAt = ahora();
        st.extraction.leaseAt = null;
      });
    }

    // Cada persistencia del job refresca el lease (runner vivo).
    const marcar = (fn: (j: JobState) => void) =>
      patchEstadoOnboarding((st) => {
        fn(st.extraction.jobs[key]);
        st.extraction.jobs[key].updatedAt = ahora();
        st.extraction.leaseAt = ahora();
      });

    await marcar((j) => { j.status = 'running'; });

    try {
      const terminado = await correrJob(key, s.extraction.jobs[key], deadline, marcar);
      if (terminado) {
        await marcar((j) => { j.status = 'done'; j.error = null; });
      } else {
        // presupuesto agotado a mitad del job → queda running con cursor; el
        // próximo tick retoma (soltamos el lease: este runner ya terminó).
        return patchEstadoOnboarding((st) => { st.extraction.leaseAt = null; });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (esRateLimit(e, msg)) {
        // Transitorio: NO matar el pipeline. Pausa para no martillar a Meta
        // (el loop de ticks del wizard sigue enseguida) y el job queda pending.
        await sleep(30_000);
        return patchEstadoOnboarding((st) => {
          const j = st.extraction.jobs[key];
          j.status = 'pending';
          j.detail = 'rate limit de Meta — reintentando…';
          j.updatedAt = ahora();
          st.extraction.leaseAt = null;
        });
      }
      return patchEstadoOnboarding((st) => {
        const j = st.extraction.jobs[key];
        j.status = 'error';
        j.error = msg.slice(0, 300);
        j.updatedAt = ahora();
        st.extraction.status = 'error';
        st.extraction.leaseAt = null;
      });
    }
  }
  // Presupuesto agotado entre jobs → soltar el lease para el próximo tick.
  return patchEstadoOnboarding((st) => { st.extraction.leaseAt = null; });
}

type Marcar = (fn: (j: JobState) => void) => Promise<OnboardingState>;

/** Corre un job hasta terminarlo o agotar el presupuesto. true = terminado. */
async function correrJob(key: JobKey, job: JobState, deadline: number, marcar: Marcar): Promise<boolean> {
  switch (key) {
    case 'meta_metrics': return jobMetaMetrics(job, deadline, marcar);
    case 'meta_leads': return jobMetaLeads(marcar);
    case 'ad_transcripts': return jobTranscripts(deadline, marcar);
    case 'script_analyses': return jobScripts(deadline, marcar);
    case 'fathom_calls': return jobFathom(deadline, marcar);
    case 'vsl_metrics': return jobVsl(marcar);
  }
}

// ── meta_metrics: ayer → 365 días atrás, cursor = última fecha procesada ─────
async function jobMetaMetrics(job: JobState, deadline: number, marcar: Marcar): Promise<boolean> {
  const ayer = ayerEnTijuana();
  const fechaFin = diasAntes(ayer, DIAS_HISTORICO); // límite viejo (exclusive)
  let fecha = job.cursor ? diasAntes(job.cursor, 1) : ayer;

  // Presupuestos de adsets: snapshot solo del día actual (Meta no da histórico).
  if (!job.cursor) {
    try { await fetchAdsetBudgets(ayer); } catch { /* no fatal */ }
  }

  while (fecha >= fechaFin) {
    if (Date.now() > deadline - 15_000) return false; // margen para persistir

    let insights;
    try {
      insights = await fetchMetaInsights(fecha);
    } catch (e) {
      if (e instanceof MetaRateLimitError) {
        // una espera corta y reintento único; si persiste, corta el tick y el
        // próximo retoma desde el cursor.
        await sleep(30_000);
        try { insights = await fetchMetaInsights(fecha); } catch { return false; }
      } else if (e instanceof MetaTokenError) {
        throw new Error(`Token de Meta inválido: ${e.message}`);
      } else {
        throw e;
      }
    }

    if (insights.length > 0) {
      const metrics = parseInsightsToMetrics(insights, fecha);
      try {
        const creatives = await fetchAdCreatives(metrics.map((m) => m.ad_id).filter((v): v is string => !!v));
        applyCreatives(metrics, creatives);
      } catch { /* creativos no fatales */ }
      await upsertMetrics(metrics);
    }

    const diaN = Math.min(DIAS_HISTORICO, Math.max(1, Math.round((new Date(ayer).getTime() - new Date(fecha).getTime()) / 86400_000) + 1));
    await marcar((j) => {
      j.cursor = fecha;
      j.detail = `día ${diaN} de ${DIAS_HISTORICO} (${fecha})`;
    });
    fecha = diasAntes(fecha, 1);
    await sleep(insights.length > 0 ? PAUSA_DIA_MS : PAUSA_DIA_VACIO_MS);
  }
  await marcar((j) => { j.detail = `${DIAS_HISTORICO} días de métricas ingestados`; });
  return true;
}

// ── meta_leads: una pasada de 90 días (dedup por meta_lead_id) ───────────────
async function jobMetaLeads(marcar: Marcar): Promise<boolean> {
  const r = await pollMetaLeads(90);
  await marcar((j) => {
    j.detail = `${r.creados} leads nuevos (${r.leads_vistos} vistos en ${r.forms_revisados} formularios)`;
  });
  return true;
}

// Postgres rechaza \u0000 en text/jsonb (22P05) — Whisper puede emitirlo.
const sinNulos = (s: string | null): string | null => (s == null ? s : s.replace(/\u0000/g, ''));

// ── ad_transcripts: drenar TODOS los ads ingestados sin transcript ───────────
// Reintenta también las filas con status='error' (rate limits transitorios de
// Meta/OpenAI): cada pasada o achica el set de errores o cierra el job con la
// advertencia — nunca loopea infinito.
async function jobTranscripts(deadline: number, marcar: Marcar): Promise<boolean> {
  const supabase = await getTenantDb();

  // Los ad_id distintos, juntados página por página. El `.select('ad_id')`
  // suelto volvía 1000 de las 1714 filas meta de ws1 (una fila por anuncio POR
  // DÍA): los anuncios que caían del corte nunca entraban a pendientes, nunca se
  // transcribían, y el job igual reportaba «N creativos transcriptos» como si
  // hubiera terminado. Orden por `id` (única): el Set no necesita otro.
  const adIdSet = new Set<string>();
  await leerPorPaginas<{ ad_id: string }>(
    supabase, 'marketing_metrics_daily', 'id, ad_id',
    (pag) => { for (const r of pag) adIdSet.add(r.ad_id); },
    { eq: { plataforma: 'meta' }, filtros: (q) => q.not('ad_id', 'is', null) },
  );
  const adIds = [...adIdSet];

  // Una fila por anuncio (141 hoy), pero crece 1:1 con los anuncios: paginado
  // por `ad_id`, que es único dentro del workspace (unique workspace_id, ad_id).
  const doneData = await leerTodo<{ ad_id: string; status: string }>(
    supabase, 'ad_transcripts', 'ad_id, status', { orden: 'ad_id' },
  );
  const filas = new Map(doneData.map((r) => [r.ad_id, r.status]));
  const pendientes = adIds.filter((id) => !filas.has(id) || filas.get(id) === 'error');
  const terminados = adIds.length - pendientes.length;
  if (pendientes.length === 0) {
    await marcar((j) => { j.detail = `${terminados} creativos transcriptos`; });
    return true;
  }

  // Thumbnails (fuente de imagen para ads sin video)
  // Paginado: sin filtro de fecha, 400 anuncios son muchas más de 1000 filas
  // (una por día) y los que caían del corte se quedaban sin thumbnail. Orden
  // único (fecha, ad_id, id) ASCENDENTE: cada fila pisa a la anterior, así que
  // queda la miniatura más reciente de cada anuncio. Tandas de 200 ids para no
  // reventar la URL del `.in()`. El tope de 400 anuncios es el de siempre: el
  // bucle de abajo corta por deadline mucho antes.
  const thumbs = new Map<string, string>();
  for (const tanda of enTandas(pendientes.slice(0, 400), 200)) {
    await leerPorPaginas<{ ad_id: string; ad_thumbnail_url: string }>(
      supabase, 'marketing_metrics_daily', 'id, fecha, ad_id, ad_thumbnail_url',
      (pag) => { for (const r of pag) thumbs.set(r.ad_id, r.ad_thumbnail_url); },
      {
        orden: ['fecha', 'ad_id', 'id'],
        eq: { plataforma: 'meta' },
        filtros: (q) => q.in('ad_id', tanda).not('ad_thumbnail_url', 'is', null),
      },
    ).catch((e: unknown) => {
      // Igual que antes: sin miniatura se transcribe igual (el video manda); se
      // pierde solo la imagen de respaldo, y no vale tirar el job por eso.
      console.error('[jobTranscripts] thumbnails:', e instanceof Error ? e.message : e);
    });
  }

  const [structureSystem, imagePrompt, whisperGlossary] = await Promise.all([
    getPromptText('transcribe.structure.system', STRUCTURE_SYSTEM_BASE),
    getPromptText('transcribe.analyze_image.user', IMAGE_PROMPT_BASE),
    getPromptText('transcribe.whisper.prompt', ''),
  ]);
  const prompts = { structureSystem, imagePrompt, whisperGlossary };
  // FAIL-CLOSED: si el token del cliente desapareció/quedó ilegible a mitad de
  // la extracción, cortar acá — transcribeAd sin metaToken caería al env del
  // dueño (token ajeno para los ads del cliente).
  const metaToken = await credWs('META_ACCESS_TOKEN');
  if (!metaToken) throw new Error('META_ACCESS_TOKEN no configurado para este workspace — reconecta Meta en el paso 1.');

  let procesados = 0;
  let exitos = 0;
  let erroresRun = 0;
  for (const adId of pendientes) {
    if (Date.now() > deadline - 60_000) return false; // una transcripción puede tardar ~1 min; el próximo tick retoma
    const res = await transcribeAd(adId, { imageUrl: thumbs.get(adId), prompts, metaToken });
    const { error: upErr } = await supabase.from('ad_transcripts').upsert({
      ad_id: res.ad_id, video_id: res.video_id, tipo: res.tipo, status: res.status, transcript: sinNulos(res.transcript),
      secciones: res.secciones, idioma: res.idioma, duracion_s: res.duracion_s, model: res.model, error: sinNulos(res.error), updated_at: new Date().toISOString(),
    }, { onConflict: 'workspace_id,ad_id' });
    // Un upsert que falla NO se traga: sin fila, el ad quedaría "pendiente" para
    // siempre y cada tick re-pagaría Whisper/GPT (livelock silencioso).
    if (upErr) throw new Error(`No se pudo guardar la transcripción de ${adId}: ${upErr.message}`);
    procesados++;
    if (res.status === 'error') erroresRun++;
    else exitos++;
    await marcar((j) => { j.detail = `${terminados + exitos} transcriptos · ${pendientes.length - procesados} restantes`; });
  }
  // Pasada completa: sin errores → listo. Con errores pero ALGÚN éxito → otra
  // pasada (los reintenta el próximo tick). Solo errores → cerrar con aviso
  // (los que queden se reintentan a mano desde Ads Analyst).
  if (erroresRun === 0) return true;
  if (exitos > 0) return false;
  await marcar((j) => { j.detail = `${terminados} transcriptos · ${erroresRun} con error (se reintentan después)`; });
  return true;
}

// ── script_analyses: syncScriptAnalyses drenado ──────────────────────────────
async function jobScripts(deadline: number, marcar: Marcar): Promise<boolean> {
  let prevRestantes = -1;
  for (;;) {
    const restanteMs = deadline - Date.now();
    if (restanteMs < 60_000) return false;
    const r = await syncScriptAnalyses({ max: 6, timeBudgetMs: Math.min(restanteMs - 20_000, 150_000) });
    await marcar((j) => { j.detail = `${r.analizados + r.ya_procesados} guiones analizados · ${r.restantes} restantes`; });
    if (r.restantes <= 0) return true;
    // Sin avance (todos errores repetidos) → cerrar el job en vez de loopear.
    if (r.analizados === 0 && r.restantes === prevRestantes) {
      await marcar((j) => { j.detail = `${r.ya_procesados} analizados · ${r.restantes} con error (reintenta después)`; });
      return true;
    }
    prevRestantes = r.restantes;
  }
}

// ── fathom_calls: syncClosingCalls drenado ───────────────────────────────────
async function jobFathom(deadline: number, marcar: Marcar): Promise<boolean> {
  let prevRestantes = -1;
  for (;;) {
    const restanteMs = deadline - Date.now();
    // Se corta cuando no entra UNA llamada entera (+ el barrido de Fathom que la
    // precede). Antes el piso era 60 s: alcanzaba para pagar el barrido y no analizar
    // ni una, o para arrancar una llamada que el job mataba a mitad.
    if (restanteMs < RESERVA_LLAMADA_MS + 25_000) return false;
    // `deadline` ABSOLUTO, no un presupuesto relativo: syncClosingCalls ya reserva
    // adentro el peor caso de una llamada a Opus, así que le pasamos el corte real
    // del job menos el margen de salida.
    const r = await syncClosingCalls({ max: 6, deadline: deadline - 20_000 });
    await marcar((j) => { j.detail = `${r.analizadas + r.ya_procesadas} llamadas procesadas · ${r.restantes} restantes`; });
    if (r.restantes <= 0) return true;
    if (r.analizadas === 0 && r.restantes === prevRestantes) {
      await marcar((j) => { j.detail = `${r.ya_procesadas} procesadas · ${r.restantes} con error (reintenta después)`; });
      return true;
    }
    prevRestantes = r.restantes;
  }
}

// ── vsl_metrics: YouTube/Panda por rango (una llamada por video) ─────────────
async function jobVsl(marcar: Marcar): Promise<boolean> {
  const supabase = await getTenantDb();
  const ayer = ayerEnTijuana();
  const desde = diasAntes(ayer, DIAS_HISTORICO);
  const detalles: string[] = [];

  // YouTube: los 3 videos configurados, con Analytics por rango.
  if (await integracionConectada('youtube')) {
    const videos: Array<{ id: string | null; type: 'vsl' | 'thanks' | 'thanks_prep' }> = [
      { id: await getSetting('youtube_vsl_video_id'), type: 'vsl' },
      { id: await getSetting('youtube_thanks_video_id'), type: 'thanks' },
      { id: await getSetting('youtube_thanks_prep_video_id'), type: 'thanks_prep' },
    ];
    for (const v of videos) {
      if (!v.id) continue;
      const serie = await fetchYouTubeAnalyticsDaily(v.id, desde, ayer);
      await supabase.from('marketing_metrics_daily').delete()
        .eq('plataforma', 'youtube').eq('youtube_video_id', v.id).gte('fecha', desde);
      const rows: MarketingMetricRow[] = serie.map((d) => ({
        fecha: d.fecha, plataforma: 'youtube',
        ad_account_id: null, campaign_id: null, campaign_name: null, adset_id: null, adset_name: null,
        impressions: null, reach: null, frequency: null, clicks: null, link_clicks: null,
        ctr: null, cpc: null, cpm: null, spend: null,
        landing_page_views: null, page_views: null, cost_per_landing_page_view: null,
        youtube_video_id: v.id, youtube_video_type: v.type, youtube_views: d.views,
        youtube_minutes_watched: d.estimated_minutes_watched, youtube_avg_view_duration: d.average_view_duration,
        raw_payload: { source: 'youtube-analytics-api-backfill' },
      }));
      for (let i = 0; i < rows.length; i += 200) {
        const { error } = await supabase.from('marketing_metrics_daily').insert(rows.slice(i, i + 200));
        if (error) throw new Error(`youtube backfill: ${error.message}`);
      }
      detalles.push(`YouTube ${v.type}: ${rows.length} días`);
    }
  }

  // Panda: cada external id, serie por rango.
  if (await integracionConectada('panda')) {
    const raw = await getSetting('panda_vsl_video_ids');
    const ids = (raw ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    for (const extId of ids) {
      const serie = await fetchPandaRangeStats(extId, desde, ayer);
      await supabase.from('marketing_metrics_daily').delete()
        .eq('plataforma', 'panda').eq('video_id', extId).gte('fecha', desde);
      const rows = serie.map((d) => ({
        fecha: d.fecha, plataforma: 'panda',
        video_id: extId, video_variant: extId,
        video_plays: d.plays, video_unique_viewers: d.unique_viewers,
        video_retention_p50: null, video_avg_watch_seconds: null,
        raw_payload: { source: 'panda-backfill' },
      }));
      for (let i = 0; i < rows.length; i += 200) {
        const { error } = await supabase.from('marketing_metrics_daily').insert(rows.slice(i, i + 200));
        if (error) throw new Error(`panda backfill: ${error.message}`);
      }
      detalles.push(`Panda ${extId.slice(0, 8)}…: ${rows.length} días`);
    }
  }

  await marcar((j) => { j.detail = detalles.join(' · ') || 'sin videos configurados'; });
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Conteos reales por workspace (panel lateral del wizard)
// ─────────────────────────────────────────────────────────────────────────────

export type ConteosExtraccion = {
  metricas_filas: number;
  metricas_desde: string | null;
  metricas_hasta: string | null;
  leads: number;
  transcripts: number;
  scripts: number;
  llamadas: number;
  vsl_filas: number;
};

export async function conteosExtraccion(): Promise<ConteosExtraccion> {
  const supabase = await getTenantDb();
  // head+count no trae filas; min/max de fecha con order+limit 1 (liviano — el
  // panel del wizard pollea esto cada pocos segundos).
  const count = async (tabla: string, extra?: Record<string, string>): Promise<number> => {
    let q = supabase.from(tabla).select('*', { head: true, count: 'exact' });
    for (const [col, val] of Object.entries(extra ?? {})) q = q.eq(col, val);
    const { count: c } = await q;
    return c ?? 0;
  };

  const [metaFilas, desdeQ, hastaQ, leads, transcripts, scripts, llamadas, yt, panda] = await Promise.all([
    count('marketing_metrics_daily', { plataforma: 'meta' }),
    supabase.from('marketing_metrics_daily').select('fecha').eq('plataforma', 'meta').order('fecha', { ascending: true }).limit(1).maybeSingle(),
    supabase.from('marketing_metrics_daily').select('fecha').eq('plataforma', 'meta').order('fecha', { ascending: false }).limit(1).maybeSingle(),
    count('leads'),
    count('ad_transcripts'),
    count('script_analyses'),
    count('closing_analyses'),
    count('marketing_metrics_daily', { plataforma: 'youtube' }),
    count('marketing_metrics_daily', { plataforma: 'panda' }),
  ]);

  return {
    metricas_filas: metaFilas,
    metricas_desde: (desdeQ.data as { fecha: string } | null)?.fecha ?? null,
    metricas_hasta: (hastaQ.data as { fecha: string } | null)?.fecha ?? null,
    leads,
    transcripts,
    scripts,
    llamadas,
    vsl_filas: yt + panda,
  };
}
