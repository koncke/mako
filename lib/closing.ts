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

// v2: dims y moments llevan evidencia citada + t_seconds (deep-link al clip).
export type ClosingDim = { g: DimGroup; label: string; score: number; note: string; quote?: string; t_seconds?: number };
export type ClosingMoment = { t: string; t_seconds?: number; tone: MomentTone; tag: string; quote: string };
export type ClosingEvidence = { title: string; quote: string; t_seconds: number; note: string };
export type ClosingObjection = { quote: string; t_seconds: number; handled: boolean; note: string };
export type ClosingAnnotation = { t_seconds: number; tone: 'good' | 'bad'; label: string };
export type ClosingEdit = { at: string; autor: string; tipo: 'manual' | 'mako'; resumen: string; score_antes: number | null; score_despues: number | null };

/** Fila persistida en closing_analyses. */
export type ClosingAnalysisRow = {
  recording_id: number;
  call_url: string | null;
  share_url: string | null;
  embed_token: string | null;
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
  next_step: string | null;
  dims: ClosingDim[] | null;
  moments: ClosingMoment[] | null;
  recs: string[] | null;
  strengths: ClosingEvidence[] | null;
  weaknesses: ClosingEvidence[] | null;
  objections: ClosingObjection[] | null;
  annotations: ClosingAnnotation[] | null;
  has_transcript: boolean | null;
  transcript_items: number | null;
  analysis_version: number | null;
  edit_history: ClosingEdit[] | null;
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

Si el transcript dice "(sin transcript)": poné has_transcript=false y NO inventes análisis (arrays vacíos, score null).

Si es VENTA y hay transcript, hacé un análisis PROFUNDO, específico y CITADO (nada de frases genéricas). Cada evidencia cita el transcript con su t_seconds real (el número de [Ns]). Puntuás (0-10):
SPIN (g="spin"): "Situación", "Problema", "Implicación", "Necesidad / beneficio".
Ejecución (g="exec"): "Presentación de la propuesta", "Manejo de objeciones", "CTA / siguientes pasos".
En R1 puede no haber propuesta formal: puntuá esa dimensión por cómo encaminó hacia la R2.

Devolvés EXCLUSIVAMENTE un objeto JSON válido (sin texto fuera del JSON, sin markdown), con este esquema:
{
  "es_venta": boolean,
  "categoria": "venta" | "entrega_servicio" | "interna" | "otro",
  "razon": string,                      // 1 frase
  "tipo": "R1" | "R2" | null,
  "has_transcript": boolean,
  "score": number,                       // de 0 a 10 con una décima (ej. 7.5), NUNCA escala 0-100; null si no es venta o sin transcript
  "outcome": string,                     // "Cierre ganado" / "Pasó a R2" / "Perdido" / "Sin definir"
  "outcome_tone": "good" | "warn" | "bad",
  "summary": string,                     // 4-6 frases: contexto, desarrollo, quiebre, resultado
  "next_step": string,                   // qué hacer ahora con el lead
  "dims": [ { "g":"spin"|"exec", "label": string, "score": number, "note": string, "quote": string, "t_seconds": number } ],  // 7 items
  "strengths": [ { "title": string, "quote": string, "t_seconds": number, "note": string } ],   // 2-4
  "weaknesses": [ { "title": string, "quote": string, "t_seconds": number, "note": string } ],  // 2-4
  "objections": [ { "quote": string, "t_seconds": number, "handled": boolean, "note": string } ], // las que aparezcan
  "moments": [ { "t_seconds": number, "tone":"good"|"bad"|"neutral", "tag": string, "quote": string } ], // 6-12 hitos
  "annotations": [ { "t_seconds": number, "tone":"good"|"bad", "label": string } ],   // 8-20 marcadores sobre TODA la llamada
  "recs": [ string ]                      // 3-5 recomendaciones de coaching accionables
}
Para entrega_servicio/interna/otro: completá categoria, razon, summary (1-2 frases), arrays vacíos y score null. Todo en español rioplatense (voseo), concreto y sin relleno. Los t_seconds salen de los [Ns] del transcript.`;

type EvidenceJson = { title?: string; quote?: string; t_seconds?: number; note?: string };
type ObjectionJson = { quote?: string; t_seconds?: number; handled?: boolean; note?: string };
type AnnotationJson = { t_seconds?: number; tone?: string; label?: string };
type ClaudeAnalysis = {
  es_venta: boolean;
  categoria: 'venta' | 'entrega_servicio' | 'interna' | 'otro';
  razon?: string;
  tipo?: CallTipo | null;
  has_transcript?: boolean;
  score?: number;
  outcome?: string;
  outcome_tone?: Tone;
  summary?: string;
  next_step?: string;
  dims?: ClosingDim[];
  moments?: ClosingMoment[];
  recs?: string[];
  strengths?: EvidenceJson[];
  weaknesses?: EvidenceJson[];
  objections?: ObjectionJson[];
  annotations?: AnnotationJson[];
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
  let v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return 0;
  if (v > 10) v = v / 10; // tolera respuestas en escala 0-100
  return Math.max(0, Math.min(10, Math.round(v * 10) / 10));
}

function normTone(t: unknown): Tone {
  return t === 'good' || t === 'bad' ? t : 'warn';
}

/** Transcript con segundos precomputados: "[123s · 2:03] Hablante: texto". */
function transcriptWithSeconds(items: FathomMeeting['transcript'], maxChars = 60000): string {
  if (!items || !items.length) return '';
  const toSec = (ts?: string | null) => {
    if (!ts) return 0;
    const p = String(ts).split(':').map(Number);
    if (p.some((n) => Number.isNaN(n))) return 0;
    if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
    if (p.length === 2) return p[0] * 60 + p[1];
    return p[0] || 0;
  };
  const out: string[] = [];
  let len = 0;
  for (const it of items) {
    const tx = (it.text ?? '').trim();
    if (!tx) continue;
    const s = toSec(it.timestamp);
    const line = `[${s}s · ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}] ${it.speaker?.display_name ?? '—'}: ${tx}`;
    if (len + line.length > maxChars) { out.push('… (transcript recortado)'); break; }
    out.push(line);
    len += line.length + 1;
  }
  return out.join('\n');
}

function buildUserPrompt(m: FathomMeeting, lead: LeadMatch | null, feedback?: string): string {
  const externals = externalInviteeEmails(m);
  const start = meetingStartIso(m);
  const dur = meetingDurationMin(m);
  const summaryMd = m.default_summary?.markdown_formatted ?? '(sin resumen de Fathom)';
  const actions = (m.action_items ?? [])
    .map((a) => `- ${a.description ?? ''}`)
    .filter((s) => s.trim() !== '-')
    .slice(0, 20)
    .join('\n');
  const transcript = transcriptWithSeconds(m.transcript);

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

## Transcript completo  [segundos · mm:ss] Hablante: texto
${transcript || '(sin transcript)'}
${feedback ? `\n## Revisión humana (IMPORTANTE — tenelo en cuenta y ajustá tu análisis)\nQuien escuchó la llamada dice: "${feedback}"\nRe-evaluá la llamada incorporando esta observación; si corresponde, ajustá scores, outcome, notas y momentos.\n` : ''}
Analizá la llamada y devolvé el JSON pedido.`;
}

export type AnalyzeResult =
  | { ok: true; analysis: ClaudeAnalysis }
  | { ok: false; error: string };

/** Corre Claude sobre una meeting con contenido. PURA: nunca tira, devuelve {ok}. */
export async function analyzeMeeting(m: FathomMeeting, lead: LeadMatch | null, feedback?: string): Promise<AnalyzeResult> {
  try {
    const text = await chatClaude(SYSTEM_ANALISIS, [{ role: 'user', content: buildUserPrompt(m, lead, feedback) }], {
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

function embedTokenOf(shareUrl: string | null): string | null {
  const mm = (shareUrl ?? '').match(/\/share\/([^/?]+)/);
  return mm ? mm[1] : null;
}
const toSec = (n: unknown): number => { const v = Math.round(Number(n)); return Number.isFinite(v) && v >= 0 ? v : 0; };
const toMmss = (s: number): string => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// Canonicaliza los 7 labels de dimensión (algunos análisis vienen sin acentos).
const DIM_CANON: Record<string, string> = {
  'situacion': 'Situación', 'problema': 'Problema', 'implicacion': 'Implicación',
  'necesidad / beneficio': 'Necesidad / beneficio', 'necesidad/beneficio': 'Necesidad / beneficio',
  'presentacion de la propuesta': 'Presentación de la propuesta',
  'manejo de objeciones': 'Manejo de objeciones',
  'cta / siguientes pasos': 'CTA / siguientes pasos', 'cta/siguientes pasos': 'CTA / siguientes pasos',
};
function canonDimLabel(s: string): string {
  const k = s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  return DIM_CANON[k] ?? s;
}

/** Campos comunes a toda fila (identidad + grabación). */
function baseFields(m: FathomMeeting, lead: LeadMatch | null) {
  const start = meetingStartIso(m);
  const tn = m.transcript?.length ?? null;
  return {
    recording_id: m.recording_id,
    call_url: m.url ?? null,
    share_url: m.share_url ?? null,
    embed_token: embedTokenOf(m.share_url ?? null),
    title: meetingTitle(m) || null,
    call_date: safeFecha(start),
    started_at: start,
    duration_min: meetingDurationMin(m),
    closer: deriveCloser(m, lead),
    invitee_email: primaryInviteeEmail(m, lead),
    lead_id: lead?.id ?? null,
    lead_nombre: lead?.nombre ?? null,
    lead_empresa: lead?.empresa ?? null,
    has_transcript: tn != null ? tn > 0 : null,
    transcript_items: tn,
  };
}

const NULL_V2 = {
  tipo: null, score: null, outcome: null, outcome_tone: null, next_step: null,
  dims: null, moments: null, recs: null, strengths: null, weaknesses: null, objections: null, annotations: null,
  edit_history: null,
} as const;

/** Fila descartada (no es venta) a partir de la heurística — sin Claude. */
function descartadaRow(m: FathomMeeting, lead: LeadMatch | null, category: ClosingCategory): ClosingAnalysisRow {
  return {
    ...baseFields(m, lead),
    category,
    origen_clasif: 'heuristica',
    ...NULL_V2,
    summary: null,
    analysis_version: 2,
    status: 'descartada',
    error: null,
    model: null,
    analyzed_at: null,
  };
}

/** Fila a partir del análisis de Claude (v2). */
function analyzedRow(m: FathomMeeting, lead: LeadMatch | null, a: ClaudeAnalysis): ClosingAnalysisRow {
  const base = baseFields(m, lead);
  const hasTr = a.has_transcript !== false && base.has_transcript !== false;
  const esVenta = a.es_venta === true && a.categoria === 'venta';
  const category: ClosingCategory = esVenta
    ? 'venta'
    : a.categoria === 'entrega_servicio'
      ? 'entrega_servicio'
      : a.categoria === 'interna'
        ? 'interna'
        : 'sin_clasificar';

  const dims: ClosingDim[] = Array.isArray(a.dims)
    ? a.dims.filter((d) => d && (d.g === 'spin' || d.g === 'exec') && d.label)
        .map((d) => ({ g: d.g, label: canonDimLabel(String(d.label)), score: clampScore(d.score), note: String(d.note ?? ''), quote: String((d as { quote?: string }).quote ?? ''), t_seconds: toSec((d as { t_seconds?: number }).t_seconds) }))
    : [];
  const moments: ClosingMoment[] = Array.isArray(a.moments)
    ? a.moments.filter((mo) => mo && mo.quote)
        .map((mo) => { const s = toSec((mo as { t_seconds?: number }).t_seconds); return { t_seconds: s, t: toMmss(s), tone: (mo.tone === 'good' || mo.tone === 'bad' ? mo.tone : 'neutral') as MomentTone, tag: String(mo.tag ?? ''), quote: String(mo.quote ?? '') }; })
        .sort((x, y) => (x.t_seconds ?? 0) - (y.t_seconds ?? 0))
    : [];
  const ev = (x: EvidenceJson) => ({ title: String(x.title ?? ''), quote: String(x.quote ?? ''), t_seconds: toSec(x.t_seconds), note: String(x.note ?? '') });
  const strengths = Array.isArray(a.strengths) ? a.strengths.filter((x) => x && (x.title || x.quote)).map(ev) : [];
  const weaknesses = Array.isArray(a.weaknesses) ? a.weaknesses.filter((x) => x && (x.title || x.quote)).map(ev) : [];
  const objections = Array.isArray(a.objections)
    ? a.objections.filter((x) => x && x.quote).map((x) => ({ quote: String(x.quote ?? ''), t_seconds: toSec(x.t_seconds), handled: !!x.handled, note: String(x.note ?? '') })).sort((p, q) => p.t_seconds - q.t_seconds)
    : [];
  const annotations = Array.isArray(a.annotations)
    ? a.annotations.filter((x) => x && Number.isFinite(Number(x.t_seconds))).map((x) => ({ t_seconds: toSec(x.t_seconds), tone: (x.tone === 'bad' ? 'bad' : 'good') as 'good' | 'bad', label: String(x.label ?? '') })).sort((p, q) => p.t_seconds - q.t_seconds)
    : [];
  const recs = Array.isArray(a.recs) ? a.recs.map((r) => String(r)).filter(Boolean) : [];

  // venta sin transcript real → no fabricamos score; queda pendiente de re-análisis.
  const ventaOk = esVenta && hasTr;
  return {
    ...base,
    has_transcript: hasTr,
    category,
    origen_clasif: 'claude',
    tipo: esVenta ? (a.tipo === 'R1' || a.tipo === 'R2' ? a.tipo : null) : null,
    score: ventaOk ? clampScore(a.score) : null,
    outcome: esVenta ? (a.outcome ?? 'Sin definir') : null,
    outcome_tone: esVenta ? normTone(a.outcome_tone) : null,
    summary: a.summary ?? null,
    next_step: esVenta ? (a.next_step ?? null) : null,
    dims: ventaOk ? dims : null,
    moments: ventaOk ? moments : null,
    recs: ventaOk ? recs : null,
    strengths: ventaOk ? strengths : null,
    weaknesses: ventaOk ? weaknesses : null,
    objections: ventaOk ? objections : null,
    annotations: ventaOk ? annotations : null,
    analysis_version: 2,
    edit_history: null,
    status: esVenta ? (hasTr ? 'analizada' : 'pendiente') : 'descartada',
    error: null,
    model: ANALYSIS_MODEL,
    analyzed_at: new Date().toISOString(),
  };
}

async function upsertRow(row: ClosingAnalysisRow): Promise<void> {
  const supabase = getSupabaseServer();
  // No tocamos edit_history desde el análisis/sync — solo lo manejan las
  // revisiones humanas (así un re-análisis no borra el historial de cambios).
  const { edit_history: _eh, ...rest } = row;
  void _eh;
  const { error } = await supabase
    .from('closing_analyses')
    .upsert({ ...rest, updated_at: new Date().toISOString() }, { onConflict: 'recording_id' });
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
  // Se reintentan: 'error' (falló) y 'pendiente' (venta sin transcript). El resto
  // ya está resuelto y se saltea.
  const retryable = (s: string) => s === 'error' || s === 'pendiente';
  const done = new Set(
    doneData.filter((r) => (opts.force ? false : !retryable(r.status))).map((r) => r.recording_id),
  );
  // Los reintentos van AL FINAL de la cola, para que un cluster de fallos
  // determinísticos no acapare el presupuesto y mate de hambre al backlog nuevo.
  const errorIds = new Set(doneData.filter((r) => retryable(r.status)).map((r) => r.recording_id));

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
// Revisión humana del análisis (editar a mano o re-evaluar con MaKo) + historial
// ─────────────────────────────────────────────────────────────────────────────

export type ReviseManualInput = {
  dims?: Array<{ label: string; score: number }>;   // overrides de score por dimensión
  outcome?: string;
  outcome_tone?: Tone;
  summary?: string;
  next_step?: string;
  note?: string;     // comentario del revisor (para el historial)
  autor?: string;
};

function pushHistory(prev: ClosingEdit[] | null, e: ClosingEdit): ClosingEdit[] {
  return [...(Array.isArray(prev) ? prev : []), e];
}

/** Edición MANUAL: pisa scores de dimensiones / outcome / resumen y recalcula el
 *  puntaje final como promedio de las dimensiones. Registra el cambio. */
export async function reviseAnalysis(recordingId: number, input: ReviseManualInput): Promise<{ score: number | null }> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('closing_analyses')
    .select('score, dims, outcome, outcome_tone, summary, next_step, edit_history')
    .eq('recording_id', recordingId)
    .maybeSingle();
  if (error) throw new Error(`Error leyendo análisis ${recordingId}: ${error.message}`);
  if (!data) throw new Error(`Análisis ${recordingId} no existe`);

  const prevScore = data.score == null ? null : Number(data.score);
  const curDims = (Array.isArray(data.dims) ? data.dims : []) as ClosingDim[];
  // aplicar overrides de score por label
  const overrideBy = new Map((input.dims ?? []).map((d) => [d.label, clampScore(d.score)]));
  const newDims = curDims.map((d) => (overrideBy.has(d.label) ? { ...d, score: overrideBy.get(d.label)! } : d));
  // el score final = promedio de dimensiones (los cambios afectan el puntaje)
  const dimScores = newDims.map((d) => d.score).filter((s) => typeof s === 'number');
  const newScore = dimScores.length ? Math.round((dimScores.reduce((a, b) => a + b, 0) / dimScores.length) * 10) / 10 : prevScore;

  const patch: Record<string, unknown> = {
    dims: newDims,
    score: newScore,
    origen_clasif: 'manual',
    edited_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (input.outcome !== undefined) patch.outcome = input.outcome;
  if (input.outcome_tone !== undefined) patch.outcome_tone = normTone(input.outcome_tone);
  if (input.summary !== undefined) patch.summary = input.summary;
  if (input.next_step !== undefined) patch.next_step = input.next_step;
  patch.edit_history = pushHistory(data.edit_history as ClosingEdit[] | null, {
    at: new Date().toISOString(), autor: input.autor || 'manual', tipo: 'manual',
    resumen: input.note || 'Edición manual de la valoración', score_antes: prevScore, score_despues: newScore,
  });

  const { error: upErr } = await supabase.from('closing_analyses').update(patch).eq('recording_id', recordingId);
  if (upErr) throw new Error(`Error guardando revisión ${recordingId}: ${upErr.message}`);
  return { score: newScore };
}

/** Re-evaluación CON MaKo: re-corre el análisis pasándole el comentario del
 *  revisor; pisa el análisis y registra el cambio (conservando el historial). */
export async function reviseWithMako(recordingId: number, note: string, autor?: string): Promise<{ score: number | null }> {
  const supabase = getSupabaseServer();
  const { data: prev } = await supabase
    .from('closing_analyses').select('score, edit_history').eq('recording_id', recordingId).maybeSingle();
  const prevScore = prev?.score == null ? null : Number(prev.score);

  const [meetings, leadsByEmail] = await Promise.all([fetchAllMeetings(), getLeadsByEmail()]);
  const meta = meetings.find((m) => m.recording_id === recordingId);
  if (!meta) throw new Error(`Grabación ${recordingId} no encontrada en Fathom`);
  const lead = matchMeetingToLead(meta, leadsByEmail);
  const m = await fetchMeetingContent(meta);
  const res = await analyzeMeeting(m, lead, note);
  if (!res.ok) throw new Error(`MaKo no pudo re-evaluar: ${res.error}`);
  const row = analyzedRow(m, lead, res.analysis);

  const { edit_history: _eh, recording_id: _rid, ...analysisFields } = row;
  void _eh; void _rid;
  const patch: Record<string, unknown> = {
    ...analysisFields,
    origen_clasif: 'mako_revisado',
    edited_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    edit_history: pushHistory((prev?.edit_history as ClosingEdit[] | null) ?? null, {
      at: new Date().toISOString(), autor: autor || 'MaKo', tipo: 'mako',
      resumen: note, score_antes: prevScore, score_despues: row.score,
    }),
  };
  const { error: upErr } = await supabase.from('closing_analyses').update(patch).eq('recording_id', recordingId);
  if (upErr) throw new Error(`Error guardando re-evaluación ${recordingId}: ${upErr.message}`);
  return { score: row.score };
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
    pendientes: number;            // venta sin transcript (análisis incompleto)
    total: number;
  };
  kpis: {
    scorePromedio: number | null;  // solo ventas con transcript y score
    conScore: number;              // n de ventas con score válido
    ganadas: number;               // outcome_tone good
    r1Prom: number | null;
    r2Prom: number | null;
  };
  lastSync: string | null;          // updated_at más reciente
};

const VIEW_COLS =
  'recording_id, call_url, share_url, embed_token, title, call_date, started_at, duration_min, closer, invitee_email, ' +
  'lead_id, lead_nombre, lead_empresa, category, origen_clasif, tipo, score, outcome, outcome_tone, ' +
  'summary, next_step, dims, moments, recs, strengths, weaknesses, objections, annotations, ' +
  'has_transcript, transcript_items, analysis_version, edit_history, status, error, model, analyzed_at, updated_at';

function avg(nums: number[]): number | null {
  return nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10 : null;
}

/** Datos para /closing: las llamadas de venta analizadas + contadores + KPIs. */
export async function getClosingViewData(): Promise<ClosingViewData> {
  const supabase = getSupabaseServer();
  const [ventasRes, allRes] = await Promise.all([
    supabase
      .from('closing_analyses')
      .select(VIEW_COLS)
      .eq('category', 'venta')
      .eq('status', 'analizada')        // solo ventas con análisis completo (v2)
      .order('call_date', { ascending: false, nullsFirst: false }),
    supabase.from('closing_analyses').select('category, status, updated_at'),
  ]);

  if (ventasRes.error) throw new Error(`Error leyendo cierres: ${ventasRes.error.message}`);

  // PostgREST serializa NUMERIC como STRING (precisión). Coercionamos score a
  // número para que los KPIs (typeof === 'number') y el promedio funcionen.
  const numScore = (v: unknown): number | null => { const n = Number(v); return v != null && Number.isFinite(n) ? n : null; };
  const calls = ((ventasRes.data ?? []) as unknown as ClosingAnalysisRow[]).map((c) => ({ ...c, score: numScore(c.score) }));

  const counts = { ventas: 0, servicio: 0, internas: 0, test: 0, errores: 0, pendientes: 0, total: 0 };
  let lastSync: string | null = null;
  for (const r of (allRes.data ?? []) as Array<{ category: string; status: string; updated_at: string }>) {
    counts.total++;
    if (r.category === 'venta') counts.ventas++;
    else if (r.category === 'entrega_servicio') counts.servicio++;
    else if (r.category === 'interna') counts.internas++;
    else if (r.category === 'test') counts.test++;
    if (r.status === 'error') counts.errores++;
    if (r.category === 'venta' && r.status === 'pendiente') counts.pendientes++;
    if (!lastSync || r.updated_at > lastSync) lastSync = r.updated_at;
  }

  // KPIs SOLO sobre ventas con transcript real y score (no promediar 0s falsos).
  const scored = calls.filter((c) => c.has_transcript !== false && typeof c.score === 'number');
  const kpis = {
    scorePromedio: avg(scored.map((c) => c.score as number)),
    conScore: scored.length,
    ganadas: calls.filter((c) => c.outcome_tone === 'good').length,
    r1Prom: avg(scored.filter((c) => c.tipo === 'R1').map((c) => c.score as number)),
    r2Prom: avg(scored.filter((c) => c.tipo === 'R2').map((c) => c.score as number)),
  };

  return { calls, counts, kpis, lastSync };
}
