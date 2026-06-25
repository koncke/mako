// =============================================================================
// Closing Analyst — matchear llamadas de Fathom con leads, clasificar
// venta vs entrega de servicio, y analizar el desempeño del closer.
// =============================================================================
// Flujo (sync):
//   1. Barrido de metadata de Fathom (fetchAllMeetings, sin transcript).
//   2. Clasificación barata (heurística) que descarta SIN gastar Claude:
//        - internas (invitado del propio equipo / sin invitado externo)
//        - test/demo (título o duración ridícula)
//        - entrega de servicio EXPLÍCITA (prefijos "SERVICIO:", "COACHING:",
//          programas de coaching, weeklies, reportes) — el usuario las nombra así.
//   3. Para el resto (candidatas a venta, con invitado externo): match contra un
//      lead por email y análisis con Claude, que es el árbitro final de
//      venta vs entrega de servicio y, si es venta, puntúa SPIN + ejecución.
//   4. Persistencia en closing_analyses (1 fila por recording_id → no reprocesa).
//
// Por qué Claude decide venta vs servicio: muchas "Junta X" son tanto primeras
// llamadas de venta como sesiones de coaching de un cliente ya cerrado. El
// título no alcanza; el resumen de la llamada sí. Se le pasa el estado del lead
// como pista fuerte (un lead 'ganado' con fecha de cierre vieja → la llamada
// posterior es entrega de servicio).
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';
import { chatClaude } from './anthropic';
import { isoToFechaTijuana } from './calendly';
import {
  fetchAllMeetings,
  fetchMeetingContent,
  externalInviteeEmails,
  meetingTitle,
  meetingDurationMin,
  meetingStartIso,
  transcriptToText,
  type FathomMeeting,
} from './fathom-api';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

export type ClosingCategory = 'venta' | 'entrega_servicio' | 'interna' | 'test' | 'sin_clasificar';
export type ClosingStatus = 'analizada' | 'descartada' | 'pendiente' | 'error';
export type CallTipo = 'R1' | 'R2';
export type DimGroup = 'spin' | 'exec';
export type Tone = 'good' | 'warn' | 'bad';
export type MomentTone = 'good' | 'bad' | 'neutral';

export type ClosingDim = { g: DimGroup; label: string; score: number; note: string };
export type ClosingMoment = { t: string; tone: MomentTone; tag: string; quote: string };

/** Fila persistida en closing_analyses. */
export type ClosingAnalysisRow = {
  recording_id: number;
  call_url: string | null;
  share_url: string | null;
  title: string | null;
  call_date: string | null;
  started_at: string | null;
  duration_min: number | null;
  closer: string | null;
  invitee_email: string | null;
  lead_id: number | null;
  lead_nombre: string | null;
  lead_empresa: string | null;
  category: ClosingCategory;
  origen_clasif: string | null;
  tipo: CallTipo | null;
  score: number | null;
  outcome: string | null;
  outcome_tone: Tone | null;
  summary: string | null;
  dims: ClosingDim[] | null;
  moments: ClosingMoment[] | null;
  recs: string[] | null;
  status: ClosingStatus;
  error: string | null;
  model: string | null;
  analyzed_at: string | null;
};

/** Lead mínimo para el match + pistas de clasificación. */
type LeadMatch = {
  id: number;
  nombre: string;
  empresa: string | null;
  email: string | null;
  closer: string | null;
  estado_lead: string | null;
  fecha_junta_1: string | null;
  fecha_junta_2: string | null;
  fecha_cierre: string | null;
  fecha_inicio_servicio: string | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Clasificación heurística (sin Claude)
// ─────────────────────────────────────────────────────────────────────────────

// Emails / dominios del propio equipo: sus reuniones son internas, no de venta.
const INTERNAL_EMAILS = new Set([
  'martinkoncke@gmail.com',
  'tejadomartin@gmail.com',
]);
const INTERNAL_DOMAINS = new Set(['elevate.com.mx']);

const RE_TEST = /\b(test call|fathom demo|prueba)\b|^test\b|impromptu (google meet|zoom) meeting/i;
// Marcadores INEQUÍVOCOS de entrega de servicio / coaching que el propio usuario
// pone en el título (programas en curso con clientes ya activos). Conservador a
// propósito: ante la duda, no descartamos acá — deja que Claude lea el resumen.
const RE_SERVICIO_EXPLICITO = /^\s*servicio:|^\s*coaching:|paddock\s*&\s*pit|programa\s+via|sesiones\s+programa|reporte\s+semanal|scaling\s*up|mesa\s+de\s+trabajo/i;
// Señales FUERTES de VENTA en el título — sirven para rescatar llamadas que no
// trajeron al prospecto como invitado de calendario (sin email externo) pero que
// claramente son de venta (calificación, diagnóstico, propuesta, primera junta).
const RE_VENTA_FUERTE = /\bpropuesta\b|diagn[oó]stico|calificaci[oó]n|primera\s+(junta|sesi[oó]n|llamada|reuni[oó]n)|junta\s*[12]\b|reuni[oó]n\s*[12]\b/i;

function isInternalEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  if (INTERNAL_EMAILS.has(e)) return true;
  const dom = e.split('@')[1] ?? '';
  return INTERNAL_DOMAINS.has(dom);
}

/**
 * Pre-clasificación barata. Devuelve la categoría si se puede decidir sin
 * Claude, o null si la llamada es CANDIDATA a venta y necesita análisis.
 */
export function preClassify(m: FathomMeeting): ClosingCategory | null {
  const title = meetingTitle(m);
  const dur = meetingDurationMin(m);
  const externals = externalInviteeEmails(m).filter((e) => !isInternalEmail(e));

  // Test / demo / grabaciones basura.
  if (RE_TEST.test(title)) return 'test';
  if (dur != null && dur < 4) return 'test';

  // Entrega de servicio nombrada explícitamente (aunque haya invitado externo).
  if (RE_SERVICIO_EXPLICITO.test(title)) return 'entrega_servicio';

  // Con prospecto externo → candidata a venta (Claude decide venta/servicio).
  if (externals.length > 0) return null;

  // Sin invitado externo: solo es candidata si el título grita venta; si no, es
  // interna/estrategia (weeklies, juntas de equipo, etc.).
  if (RE_VENTA_FUERTE.test(title)) return null;
  return 'interna';
}

// ─────────────────────────────────────────────────────────────────────────────
// Match con leads
// ─────────────────────────────────────────────────────────────────────────────

/** Trae los leads necesarios para matchear, indexados por email en minúscula. */
export async function getLeadsByEmail(): Promise<Map<string, LeadMatch>> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('leads')
    .select('id, nombre, empresa, email, closer, estado_lead, fecha_junta_1, fecha_junta_2, fecha_cierre, fecha_inicio_servicio');
  if (error) throw new Error(`Error trayendo leads para match: ${error.message}`);
  const map = new Map<string, LeadMatch>();
  for (const l of (data ?? []) as LeadMatch[]) {
    const e = l.email?.trim().toLowerCase();
    if (e && !map.has(e)) map.set(e, l);
  }
  return map;
}

/** Matchea una meeting a un lead por el email de algún invitado externo. */
export function matchMeetingToLead(m: FathomMeeting, leadsByEmail: Map<string, LeadMatch>): LeadMatch | null {
  for (const email of externalInviteeEmails(m)) {
    const lead = leadsByEmail.get(email);
    if (lead) return lead;
  }
  return null;
}

/** Closer de la llamada: lead.closer si está, si no el host de Fathom. */
function deriveCloser(m: FathomMeeting, lead: LeadMatch | null): string | null {
  if (lead?.closer && lead.closer.trim()) return lead.closer.trim();
  return m.recorded_by?.name?.trim() || null;
}

/** Email del invitado externo matcheado (o el primero externo no-interno). */
function primaryInviteeEmail(m: FathomMeeting, lead: LeadMatch | null): string | null {
  const externals = externalInviteeEmails(m);
  if (lead?.email) {
    const e = lead.email.trim().toLowerCase();
    if (externals.includes(e)) return e;
  }
  return externals.find((e) => !isInternalEmail(e)) ?? externals[0] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Análisis con Claude
// ─────────────────────────────────────────────────────────────────────────────

const ANALYSIS_MODEL = 'claude-opus-4-8';

const SYSTEM_ANALISIS = `Sos MaKo, analista de cierres de Mauricio Bustos (consultoría/coaching ejecutivo que vende un programa de mentoría a dueños de negocio). Analizás grabaciones de reuniones para evaluar el desempeño del closer.

Tu primera tarea es CLASIFICAR la llamada. Distinguí con cuidado:

• VENTA — el objetivo es vender el programa a un prospecto que todavía NO es cliente:
  - R1 (Reunión 1 / diagnóstico / calificación): primera llamada. Se mapea la situación, se detecta el dolor, se califica fit (presupuesto, decisor, timing). Aún no se presenta precio formal (o recién al final).
  - R2 (Reunión 2 / propuesta / cierre): se presenta la propuesta y el precio, se manejan objeciones y se busca el cierre / primer pago.

• ENTREGA DE SERVICIO — NO es venta. Es trabajo CON un cliente que YA compró: sesiones de coaching/mentoría, accountability, 4DX, OKRs, tableros, planeación estratégica, sprints, seguimiento de compromisos, "Sesión 2/3/4", "Programa", etc. Aunque el título diga "Junta X", si el contenido es ejecutar/acompañar (no vender), es entrega de servicio.

• INTERNA / OTRO — reunión de equipo, estrategia interna, demo, prueba, o algo que no es ni venta ni entrega a un cliente.

Pistas fuertes:
- Si el lead ya está 'ganado' / tiene fecha de cierre o de inicio de servicio ANTERIOR a esta llamada → casi seguro es ENTREGA DE SERVICIO.
- Si se discute precio/propuesta/condiciones y la persona aún decide si contratar → VENTA.
- Si se ejecutan tareas, OKRs, métricas, accountability de un negocio ya en programa → ENTREGA DE SERVICIO.

Si es VENTA, además puntuás (0-10) estas dimensiones:
SPIN (g="spin"): "Situación", "Problema", "Implicación", "Necesidad / beneficio".
Ejecución (g="exec"): "Presentación de la propuesta", "Manejo de objeciones", "CTA / siguientes pasos".
En R1 puede no haber propuesta formal: puntuá esa dimensión por cómo encaminó hacia la R2.

Devolvés EXCLUSIVAMENTE un objeto JSON válido (sin texto fuera del JSON, sin markdown), con este esquema:
{
  "es_venta": boolean,
  "categoria": "venta" | "entrega_servicio" | "interna" | "otro",
  "razon": string,                      // 1 frase: por qué esa categoría
  "tipo": "R1" | "R2" | null,           // solo si es_venta
  "score": number,                       // 0-10, una décima; solo si es_venta (si no, 0)
  "outcome": string,                     // desenlace corto, p.ej. "Cierre ganado", "Pasó a R2", "Perdido", "Facturando", "Sin definir"
  "outcome_tone": "good" | "warn" | "bad",
  "summary": string,                     // 2-4 frases en español rioplatense, análisis del desempeño
  "dims": [ { "g": "spin"|"exec", "label": string, "score": number, "note": string } ],  // 7 items si es_venta, [] si no
  "moments": [ { "t": "MM:SS", "tone": "good"|"bad"|"neutral", "tag": string, "quote": string } ], // 2-4 momentos clave con timestamp; [] si no es venta
  "recs": [ string ]                      // 2-4 recomendaciones de coaching accionables; [] si no es venta
}
Las notas, summary, tags, quotes y recs van en español rioplatense (voseo), concretas y sin relleno. Los timestamps deben salir del transcript.`;

type ClaudeAnalysis = {
  es_venta: boolean;
  categoria: 'venta' | 'entrega_servicio' | 'interna' | 'otro';
  razon?: string;
  tipo?: CallTipo | null;
  score?: number;
  outcome?: string;
  outcome_tone?: Tone;
  summary?: string;
  dims?: ClosingDim[];
  moments?: ClosingMoment[];
  recs?: string[];
};

/** Extrae el primer objeto JSON de un texto (tolera fences ```json). */
function parseJsonObject(text: string): unknown {
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) throw new Error('Respuesta sin JSON');
  return JSON.parse(cleaned.slice(start, end + 1));
}

function clampScore(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(10, Math.round(v * 10) / 10));
}

function normTone(t: unknown): Tone {
  return t === 'good' || t === 'bad' ? t : 'warn';
}

function buildUserPrompt(m: FathomMeeting, lead: LeadMatch | null): string {
  const externals = externalInviteeEmails(m);
  const start = meetingStartIso(m);
  const dur = meetingDurationMin(m);
  const summaryMd = m.default_summary?.markdown_formatted ?? '(sin resumen de Fathom)';
  const actions = (m.action_items ?? [])
    .map((a) => `- ${a.description ?? ''}`)
    .filter((s) => s.trim() !== '-')
    .slice(0, 20)
    .join('\n');
  const transcript = transcriptToText(m.transcript, 16000);

  const leadCtx = lead
    ? [
        `Nombre: ${lead.nombre}`,
        lead.empresa ? `Empresa: ${lead.empresa}` : null,
        `Estado del lead: ${lead.estado_lead ?? 'desconocido'}`,
        lead.fecha_junta_1 ? `Fecha Reunión 1 agendada: ${lead.fecha_junta_1}` : null,
        lead.fecha_junta_2 ? `Fecha Reunión 2 agendada: ${lead.fecha_junta_2}` : null,
        lead.fecha_cierre ? `Fecha de cierre (ya compró): ${lead.fecha_cierre}` : null,
        lead.fecha_inicio_servicio ? `Inicio de servicio: ${lead.fecha_inicio_servicio}` : null,
      ].filter(Boolean).join('\n')
    : 'No hay lead matcheado en el CRM con este email (puede ser un prospecto nuevo o alguien fuera del funnel de venta).';

  return `## Metadatos de la llamada
Título: ${meetingTitle(m)}
Fecha de la grabación: ${start ?? 'desconocida'}
Duración: ${dur ?? '?'} min
Invitados externos: ${externals.join(', ') || '(ninguno)'}
Host (closer): ${m.recorded_by?.name ?? '?'}

## Contexto del lead en el CRM
${leadCtx}

## Resumen de Fathom
${summaryMd}

## Action items
${actions || '(ninguno)'}

## Transcript (extracto, con timestamps)
${transcript || '(sin transcript)'}

Analizá la llamada y devolvé el JSON pedido.`;
}

export type AnalyzeResult =
  | { ok: true; analysis: ClaudeAnalysis }
  | { ok: false; error: string };

/** Corre Claude sobre una meeting con contenido. PURA: nunca tira, devuelve {ok}. */
export async function analyzeMeeting(m: FathomMeeting, lead: LeadMatch | null): Promise<AnalyzeResult> {
  try {
    const text = await chatClaude(SYSTEM_ANALISIS, [{ role: 'user', content: buildUserPrompt(m, lead) }], {
      model: ANALYSIS_MODEL,
      thinking: true,
      effort: 'high',
      maxTokens: 8000,
    });
    const raw = parseJsonObject(text) as ClaudeAnalysis;
    return { ok: true, analysis: raw };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Construcción de la fila + persistencia
// ─────────────────────────────────────────────────────────────────────────────

/** Fecha Tijuana tolerante: null si el ISO es inválido (no tira → no aborta el batch). */
function safeFecha(iso: string | null): string | null {
  if (!iso) return null;
  try { return isoToFechaTijuana(iso); } catch { return null; }
}

/** Fila descartada (no es venta) a partir de la heurística — sin Claude. */
function descartadaRow(m: FathomMeeting, lead: LeadMatch | null, category: ClosingCategory): ClosingAnalysisRow {
  const start = meetingStartIso(m);
  return {
    recording_id: m.recording_id,
    call_url: m.url ?? null,
    share_url: m.share_url ?? null,
    title: meetingTitle(m) || null,
    call_date: safeFecha(start),
    started_at: start,
    duration_min: meetingDurationMin(m),
    closer: deriveCloser(m, lead),
    invitee_email: primaryInviteeEmail(m, lead),
    lead_id: lead?.id ?? null,
    lead_nombre: lead?.nombre ?? null,
    lead_empresa: lead?.empresa ?? null,
    category,
    origen_clasif: 'heuristica',
    tipo: null,
    score: null,
    outcome: null,
    outcome_tone: null,
    summary: null,
    dims: null,
    moments: null,
    recs: null,
    status: 'descartada',
    error: null,
    model: null,
    analyzed_at: null,
  };
}

/** Fila a partir del análisis de Claude. */
function analyzedRow(m: FathomMeeting, lead: LeadMatch | null, a: ClaudeAnalysis): ClosingAnalysisRow {
  const start = meetingStartIso(m);
  const esVenta = a.es_venta === true && a.categoria === 'venta';
  const category: ClosingCategory = esVenta
    ? 'venta'
    : a.categoria === 'entrega_servicio'
      ? 'entrega_servicio'
      : a.categoria === 'interna'
        ? 'interna'
        : 'sin_clasificar';

  const dims = Array.isArray(a.dims)
    ? a.dims
        .filter((d) => d && (d.g === 'spin' || d.g === 'exec') && d.label)
        .map((d) => ({ g: d.g, label: String(d.label), score: clampScore(d.score), note: String(d.note ?? '') }))
    : [];
  const moments = Array.isArray(a.moments)
    ? a.moments
        .filter((mo) => mo && mo.quote)
        .map((mo) => ({
          t: String(mo.t ?? ''),
          tone: (mo.tone === 'good' || mo.tone === 'bad' ? mo.tone : 'neutral') as MomentTone,
          tag: String(mo.tag ?? ''),
          quote: String(mo.quote ?? ''),
        }))
    : [];
  const recs = Array.isArray(a.recs) ? a.recs.map((r) => String(r)).filter(Boolean) : [];

  return {
    recording_id: m.recording_id,
    call_url: m.url ?? null,
    share_url: m.share_url ?? null,
    title: meetingTitle(m) || null,
    call_date: safeFecha(start),
    started_at: start,
    duration_min: meetingDurationMin(m),
    closer: deriveCloser(m, lead),
    invitee_email: primaryInviteeEmail(m, lead),
    lead_id: lead?.id ?? null,
    lead_nombre: lead?.nombre ?? null,
    lead_empresa: lead?.empresa ?? null,
    category,
    origen_clasif: 'claude',
    tipo: esVenta ? (a.tipo === 'R1' || a.tipo === 'R2' ? a.tipo : 'R1') : null,
    score: esVenta ? clampScore(a.score) : null,
    outcome: esVenta ? (a.outcome ?? 'Sin definir') : null,
    outcome_tone: esVenta ? normTone(a.outcome_tone) : null,
    summary: a.summary ?? null,
    dims: esVenta ? dims : null,
    moments: esVenta ? moments : null,
    recs: esVenta ? recs : null,
    status: esVenta ? 'analizada' : 'descartada',
    error: null,
    model: ANALYSIS_MODEL,
    analyzed_at: new Date().toISOString(),
  };
}

async function upsertRow(row: ClosingAnalysisRow): Promise<void> {
  const supabase = getSupabaseServer();
  const { error } = await supabase
    .from('closing_analyses')
    .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: 'recording_id' });
  if (error) throw new Error(`Error guardando análisis ${row.recording_id}: ${error.message}`);
}

/**
 * Procesa UNA meeting candidata: descarga contenido, corre Claude, persiste.
 * PURA respecto del batch (captura sus propios errores en la fila).
 */
export async function processCandidate(
  meta: FathomMeeting,
  leadsByEmail: Map<string, LeadMatch>,
): Promise<{ status: ClosingStatus; category: ClosingCategory }> {
  const lead = matchMeetingToLead(meta, leadsByEmail);
  let m: FathomMeeting = meta;
  try {
    m = await fetchMeetingContent(meta);
  } catch (err) {
    await upsertRow({
      ...descartadaRow(meta, lead, 'sin_clasificar'),
      status: 'error',
      error: `fetch contenido: ${err instanceof Error ? err.message : String(err)}`,
    });
    return { status: 'error', category: 'sin_clasificar' };
  }
  const res = await analyzeMeeting(m, lead);
  if (!res.ok) {
    await upsertRow({ ...descartadaRow(m, lead, 'sin_clasificar'), status: 'error', error: res.error });
    return { status: 'error', category: 'sin_clasificar' };
  }
  const row = analyzedRow(m, lead, res.analysis);
  await upsertRow(row);
  return { status: row.status, category: row.category };
}

// ─────────────────────────────────────────────────────────────────────────────
// Sync (orquestador con presupuesto por corrida)
// ─────────────────────────────────────────────────────────────────────────────

export type SyncResult = {
  total_fathom: number;
  ya_procesadas: number;
  candidatas: number;
  descartadas_heuristica: number;
  analizadas: number;
  ventas: number;
  servicio: number;
  otras: number;        // interna / sin_clasificar resueltas por Claude
  errores: number;
  restantes: number;
  ms: number;
};

const DEFAULT_MAX = 6;
// "Dejar de empezar llamadas nuevas" después de este punto. El maxDuration de las
// rutas es 300s; reservamos ~150s para que la ÚLTIMA llamada a Claude (Opus high)
// termine antes del corte de la plataforma, en vez de chequear el budget solo al
// principio del loop y arrancar una llamada que se pasa de los 300s.
const DEFAULT_TIME_BUDGET_MS = 150_000;

/**
 * Sincroniza llamadas de Fathom → closing_analyses.
 *  1. Barre metadata (sin transcript).
 *  2. Las que ya están en la tabla (cualquier status salvo 'error') se saltan.
 *  3. Las descartables por heurística se guardan al instante (sin Claude).
 *  4. Las candidatas a venta se analizan con Claude hasta agotar el presupuesto.
 */
export async function syncClosingCalls(opts: { max?: number; timeBudgetMs?: number; force?: boolean } = {}): Promise<SyncResult> {
  const tStart = Date.now();
  const max = opts.max ?? DEFAULT_MAX;
  const timeBudget = opts.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS;

  const supabase = getSupabaseServer();
  const [meetings, leadsByEmail, doneRows] = await Promise.all([
    fetchAllMeetings({ includeSummary: false }),
    getLeadsByEmail(),
    supabase.from('closing_analyses').select('recording_id, status'),
  ]);

  if (doneRows.error) throw new Error(`Error leyendo closing_analyses: ${doneRows.error.message}`);
  const doneData = (doneRows.data ?? []) as Array<{ recording_id: number; status: string }>;
  // Ya resueltas: cualquier status menos 'error' (los errores se reintentan).
  const done = new Set(
    doneData.filter((r) => (opts.force ? false : r.status !== 'error')).map((r) => r.recording_id),
  );
  // Grabaciones que ya fallaron antes: se reintentan pero AL FINAL de la cola,
  // para que un cluster de errores determinísticos no acapare el presupuesto y
  // mate de hambre al backlog sin analizar.
  const errorIds = new Set(doneData.filter((r) => r.status === 'error').map((r) => r.recording_id));

  const result: SyncResult = {
    total_fathom: meetings.length,
    ya_procesadas: 0,
    candidatas: 0,
    descartadas_heuristica: 0,
    analizadas: 0,
    ventas: 0,
    servicio: 0,
    otras: 0,
    errores: 0,
    restantes: 0,
    ms: 0,
  };

  const candidatas: FathomMeeting[] = [];

  // Paso 1+2+3: triage barato.
  for (const m of meetings) {
    if (!m.recording_id) continue;
    if (done.has(m.recording_id)) { result.ya_procesadas++; continue; }
    const cat = preClassify(m);
    if (cat !== null) {
      // Descartable sin Claude.
      const lead = matchMeetingToLead(m, leadsByEmail);
      await upsertRow(descartadaRow(m, lead, cat));
      result.descartadas_heuristica++;
      if (cat === 'entrega_servicio') result.servicio++;
      continue;
    }
    candidatas.push(m);
  }
  result.candidatas = candidatas.length;

  // Priorizar: señal fuerte de venta en el título + match de lead primero; los
  // reintentos de error van al fondo (no acaparan el presupuesto).
  const prioridad = (m: FathomMeeting) =>
    (RE_VENTA_FUERTE.test(meetingTitle(m)) ? 2 : 0) +
    (matchMeetingToLead(m, leadsByEmail) ? 1 : 0) -
    (errorIds.has(m.recording_id) ? 10 : 0);
  candidatas.sort((a, b) => prioridad(b) - prioridad(a));

  // Paso 4: análisis con Claude, con presupuesto.
  let analizadasEnCorrida = 0;
  for (const m of candidatas) {
    if (analizadasEnCorrida >= max || Date.now() - tStart > timeBudget) break;
    analizadasEnCorrida++;
    const { status, category } = await processCandidate(m, leadsByEmail);
    if (status === 'error') result.errores++;
    else {
      result.analizadas++;
      if (category === 'venta') result.ventas++;
      else if (category === 'entrega_servicio') result.servicio++;
      else result.otras++;
    }
  }

  result.restantes = candidatas.length - analizadasEnCorrida;
  result.ms = Date.now() - tStart;
  return result;
}

/** Re-analiza UNA grabación puntual (botón "Re-analizar" / endpoint manual). */
export async function analyzeOne(recordingId: number): Promise<ClosingStatus> {
  // No hay endpoint de metadata por id (el filtro recording_id del listado se
  // ignora), así que ubicamos la meta en el barrido y la enriquecemos.
  const [meetings, leadsByEmail] = await Promise.all([fetchAllMeetings(), getLeadsByEmail()]);
  const meta = meetings.find((m) => m.recording_id === recordingId);
  if (!meta) throw new Error(`Grabación ${recordingId} no encontrada en Fathom`);
  return (await processCandidate(meta, leadsByEmail)).status;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lectura para la vista
// ─────────────────────────────────────────────────────────────────────────────

export type ClosingViewData = {
  calls: ClosingAnalysisRow[];     // solo category='venta', más recientes primero
  counts: {
    ventas: number;
    servicio: number;
    internas: number;
    test: number;
    errores: number;
    total: number;
  };
  lastSync: string | null;          // updated_at más reciente
};

const VIEW_COLS =
  'recording_id, call_url, share_url, title, call_date, started_at, duration_min, closer, invitee_email, ' +
  'lead_id, lead_nombre, lead_empresa, category, origen_clasif, tipo, score, outcome, outcome_tone, ' +
  'summary, dims, moments, recs, status, error, model, analyzed_at, updated_at';

/** Datos para /closing: las llamadas de venta analizadas + contadores. */
export async function getClosingViewData(): Promise<ClosingViewData> {
  const supabase = getSupabaseServer();
  const [ventasRes, allRes] = await Promise.all([
    supabase
      .from('closing_analyses')
      .select(VIEW_COLS)
      .eq('category', 'venta')
      .order('call_date', { ascending: false, nullsFirst: false }),
    supabase.from('closing_analyses').select('category, status, updated_at'),
  ]);

  if (ventasRes.error) throw new Error(`Error leyendo cierres: ${ventasRes.error.message}`);

  const calls = (ventasRes.data ?? []) as unknown as ClosingAnalysisRow[];

  const counts = { ventas: 0, servicio: 0, internas: 0, test: 0, errores: 0, total: 0 };
  let lastSync: string | null = null;
  for (const r of (allRes.data ?? []) as Array<{ category: string; status: string; updated_at: string }>) {
    counts.total++;
    if (r.category === 'venta') counts.ventas++;
    else if (r.category === 'entrega_servicio') counts.servicio++;
    else if (r.category === 'interna') counts.internas++;
    else if (r.category === 'test') counts.test++;
    if (r.status === 'error') counts.errores++;
    if (!lastSync || r.updated_at > lastSync) lastSync = r.updated_at;
  }

  return { calls, counts, lastSync };
}
