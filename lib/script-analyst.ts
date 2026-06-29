// =============================================================================
// Scripts Analyst — analizar los GUIONES de los video ads.
// =============================================================================
// Cruza dos mundos para decir qué guion vale la pena escalar y por qué:
//   • Lo CUALITATIVO (estable, derivado del transcript con Claude/Opus y guardado
//     en script_analyses): ángulo, tipo de gancho, formato, tags, el guion partido
//     en bloques (beats) y un diagnóstico estructural + un gancho a probar.
//   • Lo CUANTITATIVO (vivo, nunca se guarda): spend, hook rate, retención por
//     cuartiles de Meta, frecuencia, agendas (Meta) y cierres (CRM) — se calcula
//     en cada render agregando marketing_metrics_daily por ad_id (getScriptMetrics,
//     paginado y de todo el histórico) + cierres del CRM, así las métricas no
//     quedan stale ni dependen de un rango de fechas.
//
// La retención NO viene como curva por segundo (Meta no la da por API en este
// proyecto). Se reconstruye desde los CUARTILES (video_p25/p50/p75/p100 sobre los
// plays de 3s) y se interpola por beat. Los tiempos de cada beat los ESTIMA Claude
// (el transcript no trae timestamps). Ambas cosas se rotulan en la UI.
//
// Flujo (sync):
//   1. Candidatos = anuncios con transcript de VIDEO en ad_transcripts (0025).
//   2. Los que ya tienen fila (analizada/descartada) se saltan; error/pendiente
//      se reintentan. La presencia de la fila evita re-gastar Claude.
//   3. Por cada candidato dentro del presupuesto: Claude clasifica + segmenta +
//      diagnostica el guion. Se persiste en script_analyses (1 fila por ad_id).
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';
import { chatClaude } from './anthropic';
import { TIPO_DE_CAMBIO_USD_MXN } from './config';
import { getAngles, type Angle } from './script-angles';
import { getAvatares, type Avatar } from './script-avatares';
import { renderPrompt } from './prompt-render';

// ─────────────────────────────────────────────────────────────────────────────
// Vocabularios controlados (deben coincidir con los del diseño / la vista)
// ─────────────────────────────────────────────────────────────────────────────

// Ángulos base que usa la IA para clasificar. El usuario puede corregir el ángulo
// de un anuncio a mano (angle_override) a cualquier valor del vocabulario editable
// (lib/script-angles.ts), por eso ScriptAngle es un string libre, no una unión.
export const ANGLES = ['visionario', 'capataz', 'dolor', 'testimonio', 'oferta'] as const;
export type ScriptAngle = string;

export const HOOK_TYPES = ['promesa', 'testimonio', 'pregunta', 'dolor', 'resultado', 'recordatorio'] as const;
export type HookType = (typeof HOOK_TYPES)[number];

export const BEAT_KINDS = ['gancho', 'contexto', 'problema', 'mecanismo', 'prueba', 'objecion', 'recordatorio', 'oferta', 'cta'] as const;
export type BeatKind = (typeof BEAT_KINDS)[number];

// Tags del guion → alimentan los "Patrones ganadores" de la vista.
export const TAG_VOCAB = [
  'sistema', 'sin-frio', 'caso-exito', 'dashboard', 'testimonio',
  'pregunta-hook', 'cifra-hook', 'dolor', 'cupos', 'recordatorio', 'implementacion',
] as const;
export type ScriptTag = (typeof TAG_VOCAB)[number];

export type ScriptStatus = 'analizada' | 'descartada' | 'pendiente' | 'error';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

/** Bloque del guion. `ret` (retención) se calcula en vivo en la vista. */
export type StoredBeat = { kind: BeatKind; t0: number; text: string };
export type ViewBeat = StoredBeat & { ret: number };

export type ScriptNote = { title: string; text: string };

/** Fila persistida en script_analyses (solo lo cualitativo y estable). */
export type ScriptAnalysisRow = {
  ad_id: string;
  ad_name: string | null;
  short: string | null;
  angle: ScriptAngle | null;
  avatar: string | null;
  hook_type: HookType | null;
  format: string | null;
  tags: string[] | null;
  beats: StoredBeat[] | null;
  note_title: string | null;
  note_text: string | null;
  suggestion: string | null;
  dur: number | null;
  es_imagen: boolean;
  transcript_chars: number | null;
  status: ScriptStatus;
  origen_clasif: string | null;
  error: string | null;
  model: string | null;
  analysis_version: number | null;
  analyzed_at: string | null;
};

/** Lo que consume la vista: análisis (cualitativo) + métricas vivas (cuantitativo). */
export type ScriptView = {
  id: string;            // = ad_id
  adId: string;
  name: string;
  short: string;
  angle: ScriptAngle;
  avatar: string;        // clave del avatar (override || IA || ''); '' = sin avatar
  hookType: HookType;
  format: string;
  tags: string[];
  // métricas vivas
  dur: number;           // duración del video (s)
  hookRate: number;      // % (video_3s / impresiones)
  ctr: number;           // % CTR link
  agendas: number;       // Meta (agendas_meta)
  cierres: number;       // CRM
  spend: number;         // USD
  impressions: number;
  reach: number;
  freq: number;
  days: number;
  lastFecha: string | null;   // última fecha con datos (para filtrar por actividad)
  plays3s: number;
  thru: number;          // thruplays
  finalRet: number;      // % que llegó al final (cuartil p100 / 3s)
  beats: ViewBeat[];
  note: ScriptNote | null;
  suggestion: string | null;
  // creativo + agrupadores (para la vista preview/filtros de "Guiones")
  thumbnail: string | null;
  permalink: string | null;
  creativeSinEnlace: boolean;
  campana: string | null;
  adset: string | null;
  esImagen: boolean;     // creativo de imagen (sin video → sin retención/embudo)
};

export type ScriptAnalystView = {
  scripts: ScriptView[];
  counts: {
    enVista: number;       // analizados con señal en el período
    analizadas: number;    // total con análisis completo
    pendientes: number;    // con transcript pendiente / sin analizar
    descartadas: number;   // sin transcript (las imágenes con texto ahora SÍ se analizan)
    sinTranscript: number; // ads de Meta con métricas pero sin fila en script_analyses (aún sin analizar)
    errores: number;
    total: number;         // filas en script_analyses
  };
  lastSync: string | null;
};

export type SyncResult = {
  candidatos: number;
  ya_procesados: number;
  analizados: number;
  descartados: number;
  errores: number;
  restantes: number;
  ms: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers numéricos / parseo
// ─────────────────────────────────────────────────────────────────────────────

function clampPct(n: unknown): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, v));
}
const r0 = (n: number) => Math.round(n);

/** Extrae el primer objeto JSON de un texto (tolera fences ```json). */
function parseJsonObject(text: string): unknown {
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) throw new Error('Respuesta sin JSON');
  return JSON.parse(cleaned.slice(start, end + 1));
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return (typeof v === 'string' && (allowed as readonly string[]).includes(v)) ? (v as T) : fallback;
}

// ── Curva de retención reconstruida desde los cuartiles de Meta ──
// Puntos: f=0 → 100% (todos los que pasaron los 3s), y 25/50/75/100% de la
// duración → pXX/plays3s. Monótona no-creciente. Interpolación lineal por beat.
type RetSums = { v3s: number; thru: number; p25: number; p50: number; p75: number; p100: number };

function retentionCurve(s: RetSums | undefined, holdRateFallback: number): Array<{ f: number; ret: number }> {
  // Hace falta v3s > 0 Y al menos un cuartil con datos: si Meta trae plays de 3s
  // pero los cuartiles vienen en cero (hueco de datos), caemos al fallback de
  // hold_rate en vez de pintar finalRet 0% junto a thruplays > 0.
  if (s && s.v3s > 0 && (s.p25 + s.p50 + s.p75 + s.p100) > 0) {
    let prev = 100;
    const pts = [
      { f: 0, ret: 100 },
      { f: 0.25, ret: clampPct((s.p25 / s.v3s) * 100) },
      { f: 0.5, ret: clampPct((s.p50 / s.v3s) * 100) },
      { f: 0.75, ret: clampPct((s.p75 / s.v3s) * 100) },
      { f: 1, ret: clampPct((s.p100 / s.v3s) * 100) },
    ];
    // forzar monotonía no-creciente (los cuartiles de Meta lo son por naturaleza)
    for (const p of pts) { p.ret = Math.min(p.ret, prev); prev = p.ret; }
    return pts;
  }
  // Sin cuartiles: curva burda de 2 puntos usando hold_rate como proxy del final.
  const end = clampPct(holdRateFallback);
  return [{ f: 0, ret: 100 }, { f: 1, ret: end }];
}

function retAt(curve: Array<{ f: number; ret: number }>, f: number): number {
  const x = Math.max(0, Math.min(1, f));
  for (let i = 0; i < curve.length - 1; i++) {
    const a = curve[i], b = curve[i + 1];
    if (x >= a.f && x <= b.f) {
      const span = b.f - a.f || 1;
      return r0(a.ret + ((x - a.f) / span) * (b.ret - a.ret));
    }
  }
  return r0(curve[curve.length - 1].ret);
}

// ─────────────────────────────────────────────────────────────────────────────
// Análisis con Claude (transcript-only → cualitativo y durable)
// ─────────────────────────────────────────────────────────────────────────────

const ANALYSIS_MODEL = 'claude-opus-4-8';
const ANALYSIS_VERSION = 1;

// El vocabulario de ÁNGULOS es editable (lib/script-angles.ts) → el prompt se
// arma con la lista vigente. Con los DEFAULT_ANGLES (los 5 base) el texto queda
// idéntico al original, así no cambia el comportamiento cuando no hay custom.
// Esqueleto editable. {{angleBullets}} = lista de ángulos vigentes (clave: desc),
// {{anglePipe}} = ángulos separados por "|" para el enum del JSON.
export const SCRIPT_ANALYSIS_SYSTEM_TEMPLATE = `Sos MaKo, analista de guiones publicitarios de Mauricio Bustos (consultoría/coaching ejecutivo que le vende un programa de mentoría a dueños de negocio mediante video ads en Meta). Te paso el TRANSCRIPT de un video ad y tenés que leer el GUION y devolver su anatomía.

NO tenés métricas de performance: no inventes números de spend, hook rate ni retención. Tu trabajo es puramente sobre el guion: clasificarlo, partirlo en bloques y diagnosticar su ESTRUCTURA (qué promete el gancho, si el cuerpo cumple, dónde probablemente se aburre la audiencia, si el CTA cierra). El dashboard le pone los números al lado.

Clasificá con estos vocabularios CERRADOS (elegí exactamente uno donde corresponda):

• angle (el ángulo del mensaje, elegí exactamente uno de esta lista, devolvé la CLAVE en minúsculas):
{{angleBullets}}

• hook_type (qué hace el PRIMER bloque para frenar el scroll):
  - promesa, testimonio, pregunta, dolor, resultado (abre con una cifra concreta), recordatorio.

• tags (0 a 5, SOLO de esta lista, las que apliquen de verdad):
  sistema, sin-frio, caso-exito, dashboard, testimonio, pregunta-hook, cifra-hook, dolor, cupos, recordatorio, implementacion.
  ("dashboard" = menciona o muestra un panel/tablero; "implementacion" = muestra cómo se implementa/el setup; "cifra-hook" = abre con un número; "pregunta-hook" = abre con una pregunta; "sin-frio" = promete dejar de prospectar en frío; "cupos" = urgencia por lugares).

• beats: partí el guion en 3 a 7 bloques EN ORDEN. Cada bloque:
  - kind: gancho | contexto | problema | mecanismo | prueba | objecion | recordatorio | oferta | cta.
  - t0: segundo estimado de inicio (entero). El primero SIEMPRE 0; estrictamente creciente; basate en el ritmo de lectura (~2.5 palabras/seg en español). Que el último t0 sea menor que la duración del video.
  - text: la línea/idea del guion, parafraseada corta y fiel (podés citar el original).

format: describí el formato del creativo en 2-4 palabras (ej. "UGC · talking head", "Testimonio en cámara", "Screen-recording", "B-roll + voz en off"). Inferilo del transcript/tipo.
short: etiqueta de 1 a 3 palabras para identificarlo en tablas/mapa (ej. "Hook pregunta", "Caso Indubel", "Demo panel").
note.title: 4-7 palabras, el veredicto estructural (ej. "Gran gancho, cuerpo que no paga").
note.text: 2-4 frases, concreto y sin relleno: qué hace bien el guion y dónde está su freno estructural. NADA de cifras de spend/retención (esas las muestra el dashboard).
suggestion: si el problema está en la ENTRADA (gancho flojo), proponé un gancho nuevo para probar (1 frase, en voz del anuncio). Si el gancho ya funciona, devolvé null.

Devolvé EXCLUSIVAMENTE un objeto JSON válido (sin texto fuera del JSON, sin markdown), con este esquema:
{
  "angle": "{{anglePipe}}",
  "hook_type": "promesa|testimonio|pregunta|dolor|resultado|recordatorio",
  "format": string,
  "short": string,
  "tags": [string],
  "beats": [ { "kind": string, "t0": number, "text": string } ],
  "note": { "title": string, "text": string },
  "suggestion": string | null
}
Todo en español rioplatense (voseo), concreto. Si el transcript es muy pobre o no parece un guion de video (ej. solo una imagen con texto), devolvé igual la mejor clasificación posible y beats mínimos.`;

// El AVATAR (público objetivo) es opcional y específico del cliente: si no hay
// avatares definidos, no se le pide a la IA. Se APENDE al system (no es un slot de
// la plantilla editable) para no acoplar con el registro de prompts ni romper si
// la plantilla ya fue editada a mano.
function avatarInstruction(avatares: Avatar[]): string {
  if (!avatares.length) return '';
  const bullets = avatares.map((a) => `  - ${a.key}: ${a.desc ?? a.label}.`).join('\n');
  return `\n\n• avatar (a QUIÉN le habla el anuncio): agregá AL JSON un campo extra "avatar" con EXACTAMENTE una de estas claves (la que mejor describa al público objetivo del guion), en minúsculas. Si ninguno aplica, devolvé "avatar": "".\n${bullets}`;
}

async function buildSystemAnalisis(angles: Angle[], avatares: Avatar[]): Promise<string> {
  const angleBullets = angles.map((a) => `  - ${a.key}: ${a.desc ?? a.label}.`).join('\n');
  const anglePipe = angles.map((a) => a.key).join('|');
  const base = await renderPrompt('script_analyst.analysis.system', SCRIPT_ANALYSIS_SYSTEM_TEMPLATE, { angleBullets, anglePipe });
  return base + avatarInstruction(avatares);
}

type Seccion = { titulo?: string; texto?: string };

// {{ad_name}} {{tipo}} {{idioma}} {{duracion}} = metadatos · {{cuerpo}} = guion.
export const SCRIPT_ANALYSIS_USER_TEMPLATE = `## Anuncio
Nombre: {{ad_name}}
Tipo de creativo: {{tipo}}
Idioma: {{idioma}}
Duración del video: {{duracion}}

## Transcript del guion
{{cuerpo}}

Analizá el guion y devolvé el JSON pedido.`;

function buildUserPrompt(t: { ad_name: string | null; tipo: string | null; idioma: string | null; duracion_s: number | null; secciones: Seccion[] | null; transcript: string | null }): Promise<string> {
  const secciones = Array.isArray(t.secciones) && t.secciones.length
    ? t.secciones.map((s) => `[${s.titulo ?? 'Sección'}] ${s.texto ?? ''}`).join('\n')
    : '';
  const cuerpo = secciones || (t.transcript ?? '(sin transcript)');
  return renderPrompt('script_analyst.analysis.user', SCRIPT_ANALYSIS_USER_TEMPLATE, {
    ad_name: t.ad_name ?? '(sin nombre)',
    tipo: t.tipo ?? 'video',
    idioma: t.idioma ?? 'es',
    duracion: t.duracion_s != null ? `${Math.round(t.duracion_s)}s` : 'desconocida',
    cuerpo,
  });
}

type ClaudeScript = {
  angle?: string;
  avatar?: string;
  hook_type?: string;
  format?: string;
  short?: string;
  tags?: unknown;
  beats?: Array<{ kind?: string; t0?: number; text?: string }>;
  note?: { title?: string; text?: string };
  suggestion?: string | null;
};

export type AnalyzeResult = { ok: true; analysis: ClaudeScript } | { ok: false; error: string };

/** Corre Claude sobre un transcript. PURA: nunca tira, devuelve {ok}. */
async function analyzeTranscript(t: TranscriptRow, angles: Angle[], avatares: Avatar[]): Promise<AnalyzeResult> {
  try {
    const [system, user] = await Promise.all([buildSystemAnalisis(angles, avatares), buildUserPrompt(t)]);
    const text = await chatClaude(system, [{ role: 'user', content: user }], {
      model: ANALYSIS_MODEL,
      thinking: true,
      effort: 'high',
      maxTokens: 6000,
      feature: 'script-analyst',
    });
    const raw = parseJsonObject(text) as ClaudeScript;
    return { ok: true, analysis: raw };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Construcción de filas + persistencia
// ─────────────────────────────────────────────────────────────────────────────

function sanitizeBeats(raw: ClaudeScript['beats'], dur: number | null): StoredBeat[] {
  if (!Array.isArray(raw)) return [];
  // Tope ESTRICTO bajo la duración: el último beat nunca llega a `dur`, así el
  // último segmento del embudo conserva ancho (no degenera a 0).
  const ceil = dur && dur > 0 ? Math.max(1, Math.floor(dur)) : Infinity;
  let prev = -1;
  const out: StoredBeat[] = [];
  for (const b of raw) {
    if (!b || !b.text) continue;
    const kind = oneOf<BeatKind>(b.kind, BEAT_KINDS, 'mecanismo');
    const first = out.length === 0;
    let t0 = Number(b.t0);
    if (!Number.isFinite(t0) || t0 < 0) t0 = first ? 0 : prev + 4;
    if (first) t0 = 0;
    else if (t0 <= prev) t0 = prev + 2;
    if (Number.isFinite(ceil) && t0 >= ceil) t0 = Math.max(first ? 0 : prev, ceil - 1);
    t0 = Math.round(t0);
    prev = t0;
    out.push({ kind, t0, text: String(b.text).trim() });
  }
  return out;
}

function analyzedRow(t: TranscriptRow, a: ClaudeScript, angleKeys: string[], avatarKeys: string[]): ScriptAnalysisRow {
  const tags = Array.isArray(a.tags)
    ? [...new Set(a.tags.map(String).filter((x) => (TAG_VOCAB as readonly string[]).includes(x)))]
    : [];
  const beats = sanitizeBeats(a.beats, t.duracion_s);
  const suggestion = typeof a.suggestion === 'string' && a.suggestion.trim() ? a.suggestion.trim() : null;
  const angleAllowed = angleKeys.length ? angleKeys : (ANGLES as readonly string[]);
  // avatar: solo si el cliente definió avatares y la IA devolvió uno válido; si no, '' (sin avatar).
  const avatar = avatarKeys.length && typeof a.avatar === 'string' && avatarKeys.includes(a.avatar) ? a.avatar : null;
  return {
    ad_id: t.ad_id,
    ad_name: t.ad_name ?? null,
    short: a.short ? String(a.short).trim().slice(0, 40) : (t.ad_name ?? t.ad_id).slice(0, 24),
    angle: oneOf<ScriptAngle>(a.angle, angleAllowed, angleAllowed[0] ?? 'capataz'),
    avatar,
    hook_type: oneOf<HookType>(a.hook_type, HOOK_TYPES, 'promesa'),
    format: a.format ? String(a.format).trim().slice(0, 60) : (t.tipo === 'imagen' ? 'Imagen' : 'Video'),
    tags,
    beats,
    note_title: a.note?.title ? String(a.note.title).trim() : null,
    note_text: a.note?.text ? String(a.note.text).trim() : null,
    suggestion,
    dur: t.duracion_s != null ? Math.round(t.duracion_s) : null,
    es_imagen: t.tipo === 'imagen',
    transcript_chars: t.transcript ? t.transcript.length : null,
    // Las imágenes (sin video → sin beats de retención) igual cuentan como analizadas.
    status: (t.tipo === 'imagen' || beats.length > 0) ? 'analizada' : 'descartada',
    origen_clasif: 'claude',
    error: null,
    model: ANALYSIS_MODEL,
    analysis_version: ANALYSIS_VERSION,
    analyzed_at: new Date().toISOString(),
  };
}

function descartadaRow(t: TranscriptRow, motivo: string): ScriptAnalysisRow {
  return {
    ad_id: t.ad_id,
    ad_name: t.ad_name ?? null,
    short: (t.ad_name ?? t.ad_id).slice(0, 24),
    angle: null, avatar: null, hook_type: null, format: t.tipo === 'imagen' ? 'Imagen' : null,
    tags: null, beats: null, note_title: null, note_text: null, suggestion: null,
    dur: t.duracion_s != null ? Math.round(t.duracion_s) : null,
    es_imagen: t.tipo === 'imagen',
    transcript_chars: t.transcript ? t.transcript.length : null,
    status: 'descartada',
    origen_clasif: 'heuristica',
    error: motivo,
    model: null,
    analysis_version: ANALYSIS_VERSION,
    analyzed_at: null,
  };
}

async function upsertRow(row: ScriptAnalysisRow): Promise<void> {
  const supabase = getSupabaseServer();
  const { error } = await supabase
    .from('script_analyses')
    .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: 'ad_id' });
  if (error) throw new Error(`Error guardando análisis ${row.ad_id}: ${error.message}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Lectura de transcripts (candidatos del sync)
// ─────────────────────────────────────────────────────────────────────────────

type TranscriptRow = {
  ad_id: string;
  ad_name: string | null;
  video_id: string | null;
  status: string | null;
  tipo: string | null;
  idioma: string | null;
  duracion_s: number | null;
  transcript: string | null;
  secciones: Seccion[] | null;
};

const PAGE = 1000;

/** Trae los transcripts de video utilizables (status='ok', con texto). Paginado. */
async function getVideoTranscripts(): Promise<TranscriptRow[]> {
  const supabase = getSupabaseServer();
  const out: TranscriptRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('ad_transcripts')
      .select('ad_id, video_id, status, tipo, idioma, duracion_s, transcript, secciones')
      .eq('status', 'ok')
      .order('ad_id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Error leyendo ad_transcripts: ${error.message}`);
    const rows = (data ?? []) as Omit<TranscriptRow, 'ad_name'>[];
    for (const r of rows) out.push({ ...r, ad_name: null });
    if (rows.length < PAGE) break;
  }
  return out;
}

/** Nombre del anuncio (más reciente) por ad_id, para denormalizar en la fila. */
async function getAdNames(adIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!adIds.length) return map;
  const supabase = getSupabaseServer();
  for (let i = 0; i < adIds.length; i += 300) {
    const chunk = adIds.slice(i, i + 300);
    // Paginado + orden estable (fecha desc, ad_id) para no truncar en el tope de
    // 1000 filas de PostgREST: el nombre más reciente gana por el first-wins.
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('marketing_metrics_daily')
        .select('ad_id, ad_name, fecha')
        .eq('plataforma', 'meta')
        .in('ad_id', chunk)
        .order('fecha', { ascending: false })
        .order('ad_id', { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw new Error(`Error leyendo nombres de anuncios: ${error.message}`);
      const rows = (data ?? []) as Array<{ ad_id: string; ad_name: string | null }>;
      for (const r of rows) {
        if (r.ad_id && r.ad_name && !map.has(r.ad_id)) map.set(r.ad_id, r.ad_name);
      }
      if (rows.length < PAGE) break;
    }
  }
  return map;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sync (orquestador con presupuesto por corrida)
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_MAX = 6;
// maxDuration de las rutas = 300s; reservamos ~150s para que la ÚLTIMA llamada a
// Claude (Opus high) termine antes del corte de plataforma.
const DEFAULT_TIME_BUDGET_MS = 150_000;

/** Procesa UN transcript: corre Claude, persiste. PURA respecto del batch. */
async function processCandidate(t: TranscriptRow, angles: Angle[], avatares: Avatar[]): Promise<ScriptStatus> {
  const res = await analyzeTranscript(t, angles, avatares);
  if (!res.ok) {
    await upsertRow({ ...descartadaRow(t, res.error), status: 'error' });
    return 'error';
  }
  const row = analyzedRow(t, res.analysis, angles.map((a) => a.key), avatares.map((a) => a.key));
  await upsertRow(row);
  return row.status;
}

export async function syncScriptAnalyses(opts: { max?: number; timeBudgetMs?: number; force?: boolean } = {}): Promise<SyncResult> {
  const tStart = Date.now();
  const max = opts.max ?? DEFAULT_MAX;
  const timeBudget = opts.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS;

  const supabase = getSupabaseServer();
  const [transcripts, doneRows, angles, avatares] = await Promise.all([
    getVideoTranscripts(),
    supabase.from('script_analyses').select('ad_id, status'),
    getAngles(),
    getAvatares(),
  ]);
  if (doneRows.error) throw new Error(`Error leyendo script_analyses: ${doneRows.error.message}`);

  const doneData = (doneRows.data ?? []) as Array<{ ad_id: string; status: string }>;
  // Las imágenes que quedaron 'descartada' de antes (cuando NO se analizaban)
  // ahora SÍ deben analizarse → se reabren. Se detectan por ad_transcripts.tipo
  // (no por es_imagen, que en esas filas viejas quedó en false). Si una imagen no
  // tiene texto útil, se re-descarta gratis en el pre-loop (sin gastar Claude).
  const imageAds = new Set(transcripts.filter((t) => t.tipo === 'imagen').map((t) => t.ad_id));
  const retryable = (r: { ad_id: string; status: string }) =>
    r.status === 'error' || r.status === 'pendiente' || (r.status === 'descartada' && imageAds.has(r.ad_id));
  const done = new Set(doneData.filter((r) => (opts.force ? false : !retryable(r))).map((r) => r.ad_id));

  const result: SyncResult = { candidatos: 0, ya_procesados: 0, analizados: 0, descartados: 0, errores: 0, restantes: 0, ms: 0 };

  // Solo se descarta lo que NO tiene transcript. Las imágenes SÍ se analizan
  // (Claude clasifica del texto/descripción OCR); no tienen retención de video.
  const candidatos: TranscriptRow[] = [];
  for (const t of transcripts) {
    if (done.has(t.ad_id)) { result.ya_procesados++; continue; }
    if (!t.transcript || !t.transcript.trim()) {
      await upsertRow(descartadaRow(t, 'sin transcript'));
      result.descartados++;
      continue;
    }
    candidatos.push(t);
  }
  result.candidatos = candidatos.length;

  // Denormalizar nombres de anuncio para el batch que SÍ vamos a analizar.
  const names = await getAdNames(candidatos.map((c) => c.ad_id));
  for (const c of candidatos) c.ad_name = names.get(c.ad_id) ?? c.ad_id;

  let enCorrida = 0;
  for (const t of candidatos) {
    if (enCorrida >= max || Date.now() - tStart > timeBudget) break;
    enCorrida++;
    const status = await processCandidate(t, angles, avatares);
    if (status === 'error') result.errores++;
    else if (status === 'analizada') result.analizados++;
    else result.descartados++;
  }

  result.restantes = candidatos.length - enCorrida;
  result.ms = Date.now() - tStart;
  return result;
}

/** Re-analiza UN anuncio puntual (botón "Re-analizar" / endpoint manual). */
export async function analyzeOne(adId: string): Promise<ScriptStatus> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('ad_transcripts')
    .select('ad_id, video_id, status, tipo, idioma, duracion_s, transcript, secciones')
    .eq('ad_id', adId)
    .maybeSingle();
  if (error) throw new Error(`Error leyendo transcript ${adId}: ${error.message}`);
  if (!data) throw new Error(`Anuncio ${adId} sin transcript en ad_transcripts`);
  const [names, angles, avatares] = await Promise.all([getAdNames([adId]), getAngles(), getAvatares()]);
  const t: TranscriptRow = { ...(data as Omit<TranscriptRow, 'ad_name'>), ad_name: names.get(adId) ?? adId };
  if (!t.transcript || !t.transcript.trim()) {
    await upsertRow(descartadaRow(t, 'sin transcript'));
    return 'descartada';
  }
  return processCandidate(t, angles, avatares);
}

// ─────────────────────────────────────────────────────────────────────────────
// Métricas vivas por anuncio — TODO el histórico, restringido a los ad_ids
// analizados (acotado) y paginado → no depende de un rango de fechas ni trunca.
// ─────────────────────────────────────────────────────────────────────────────

type AdMetrics = {
  adName: string | null; lastFecha: string | null;
  thumbnail: string | null; permalink: string | null; creativeSinEnlace: boolean; campana: string | null; adset: string | null;
  spendUsd: number; impressions: number; leads: number; agendas: number; linkClicks: number;
  v3s: number; thru: number; p25: number; p50: number; p75: number; p100: number;
  freqSum: number; freqN: number; dias: Set<string>;
};

/** Agrega marketing_metrics_daily para los ad_ids dados. Sin fechas = todo el
 *  histórico; con desde/hasta = solo esa ventana (para el filtro del cuadrante). */
async function getScriptMetrics(adIds: string[], desde?: string, hasta?: string): Promise<Map<string, AdMetrics>> {
  const map = new Map<string, AdMetrics>();
  if (!adIds.length) return map;
  const supabase = getSupabaseServer();
  const ids = new Set(adIds);
  for (let i = 0; i < adIds.length; i += 200) {
    const chunk = adIds.slice(i, i + 200);
    for (let from = 0; ; from += PAGE) {
      let q = supabase
        .from('marketing_metrics_daily')
        .select('ad_id, ad_name, fecha, spend, leads_count, agendas_meta, impressions, link_clicks, video_3s_views, video_thruplay, frequency, video_p25, video_p50, video_p75, video_p100, campaign_name, adset_name, ad_thumbnail_url, ad_permalink, ad_creative_sin_enlace')
        .eq('plataforma', 'meta')
        .in('ad_id', chunk);
      if (desde) q = q.gte('fecha', desde);
      if (hasta) q = q.lte('fecha', hasta);
      const { data, error } = await q
        .order('ad_id', { ascending: true })
        .order('fecha', { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw new Error(`Error leyendo métricas de anuncios: ${error.message}`);
      const rows = (data ?? []) as Array<Record<string, string | number | boolean | null>>;
      for (const row of rows) {
        const id = String(row.ad_id ?? '');
        if (!ids.has(id)) continue;
        const m = map.get(id) ?? { adName: null, lastFecha: null, thumbnail: null, permalink: null, creativeSinEnlace: false, campana: null, adset: null, spendUsd: 0, impressions: 0, leads: 0, agendas: 0, linkClicks: 0, v3s: 0, thru: 0, p25: 0, p50: 0, p75: 0, p100: 0, freqSum: 0, freqN: 0, dias: new Set<string>() };
        const spendMxn = Number(row.spend ?? 0);
        m.spendUsd += spendMxn / TIPO_DE_CAMBIO_USD_MXN;
        m.impressions += Number(row.impressions ?? 0);
        m.leads += Number(row.leads_count ?? 0);
        m.agendas += Number(row.agendas_meta ?? 0);
        m.linkClicks += Number(row.link_clicks ?? 0);
        m.v3s += Number(row.video_3s_views ?? 0);
        m.thru += Number(row.video_thruplay ?? 0);
        m.p25 += Number(row.video_p25 ?? 0);
        m.p50 += Number(row.video_p50 ?? 0);
        m.p75 += Number(row.video_p75 ?? 0);
        m.p100 += Number(row.video_p100 ?? 0);
        const f = row.frequency == null ? null : Number(row.frequency);
        if (f != null && Number.isFinite(f) && f > 0) { m.freqSum += f; m.freqN++; } // paridad con getSenalesRecon: excluye 0/null
        const fecha = String(row.fecha ?? '');
        if (spendMxn > 0 && fecha) m.dias.add(fecha);
        if (fecha && (!m.lastFecha || fecha > m.lastFecha)) { m.lastFecha = fecha; if (row.ad_name) m.adName = String(row.ad_name); }
        // Creativo + campaña/adset: el valor no-nulo más reciente (rows ordenadas por fecha asc).
        if (row.ad_thumbnail_url != null) m.thumbnail = String(row.ad_thumbnail_url);
        if (row.ad_permalink != null) m.permalink = String(row.ad_permalink);
        if (row.ad_creative_sin_enlace != null) m.creativeSinEnlace = row.ad_creative_sin_enlace === true;
        if (row.campaign_name != null) m.campana = String(row.campaign_name);
        if (row.adset_name != null) m.adset = String(row.adset_name);
        map.set(id, m);
      }
      if (rows.length < PAGE) break;
    }
  }
  return map;
}

/** Cierres por anuncio: leads con estado 'ganado' atribuidos a cada ad_id. */
async function getCierresByAd(adIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!adIds.length) return map;
  const supabase = getSupabaseServer();
  for (let i = 0; i < adIds.length; i += 200) {
    const chunk = adIds.slice(i, i + 200);
    // Paginado con orden estable (id, único) — hay 1 fila por lead 'ganado' y
    // crecen con el tiempo: sin paginar, PostgREST truncaría a 1000 y subcontaría.
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('leads')
        .select('meta_ad_id')
        .in('meta_ad_id', chunk)
        .eq('estado_lead', 'ganado')
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw new Error(`Error leyendo cierres: ${error.message}`);
      const rows = (data ?? []) as Array<{ meta_ad_id: string | null }>;
      for (const r of rows) {
        const id = String(r.meta_ad_id ?? '');
        if (id) map.set(id, (map.get(id) ?? 0) + 1);
      }
      if (rows.length < PAGE) break;
    }
  }
  return map;
}

/** Todos los ad_id de Meta con métricas (para el contador de cobertura). */
async function getAllMetaAdIds(): Promise<Set<string>> {
  const supabase = getSupabaseServer();
  const set = new Set<string>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('marketing_metrics_daily')
      .select('ad_id')
      .eq('plataforma', 'meta')
      .not('ad_id', 'is', null)
      .order('ad_id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Error leyendo ad_ids: ${error.message}`);
    const rows = (data ?? []) as Array<{ ad_id: string | null }>;
    for (const r of rows) if (r.ad_id) set.add(r.ad_id);
    if (rows.length < PAGE) break;
  }
  return set;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lectura para la vista
// ─────────────────────────────────────────────────────────────────────────────

const VIEW_COLS =
  'ad_id, ad_name, short, angle, angle_override, avatar, avatar_override, es_imagen, hook_type, format, tags, beats, note_title, note_text, suggestion, dur, status, updated_at';

type StoredView = {
  ad_id: string; ad_name: string | null; short: string | null;
  angle: ScriptAngle | null; angle_override: string | null;
  avatar: string | null; avatar_override: string | null; es_imagen: boolean | null;
  hook_type: HookType | null; format: string | null;
  tags: string[] | null; beats: StoredBeat[] | null;
  note_title: string | null; note_text: string | null; suggestion: string | null;
  dur: number | null; status: ScriptStatus; updated_at: string;
};

/** Arma UNA ScriptView desde su fila + métricas vivas. Devuelve null si el
 *  anuncio no tiene señal (ni leads, ni agendas, ni gasto). Compartido por la
 *  vista completa y por getScriptView (pestaña Guion de la vista unificada). */
function buildScriptView(r: StoredView, m: AdMetrics, cierres: number): ScriptView | null {
  const spend = m.spendUsd, impressions = m.impressions;
  if (!(m.leads > 0 || m.agendas > 0 || spend > 0)) return null;
  const hookRate = impressions > 0 ? clampPct((m.v3s / impressions) * 100) : 0;
  const holdRate = m.v3s > 0 ? clampPct((m.thru / m.v3s) * 100) : 0;
  const ctr = impressions > 0 ? (m.linkClicks / impressions) * 100 : 0;
  const freq = m.freqN > 0 ? m.freqSum / m.freqN : 0;
  const ret: RetSums = { v3s: m.v3s, thru: m.thru, p25: m.p25, p50: m.p50, p75: m.p75, p100: m.p100 };
  const dur = r.dur && r.dur > 0 ? r.dur : Math.max(...(r.beats ?? []).map((b) => b.t0), 30) + 4;
  const curve = retentionCurve(ret, holdRate);
  const plays3s = m.v3s || r0((hookRate / 100) * impressions);
  const thru = m.thru || r0((holdRate / 100) * plays3s);
  const beats: ViewBeat[] = (r.beats ?? []).map((b) => ({ ...b, ret: retAt(curve, dur > 0 ? b.t0 / dur : 0) }));
  return {
    id: r.ad_id, adId: r.ad_id,
    name: r.ad_name ?? m.adName ?? r.ad_id,
    short: r.short ?? (r.ad_name ?? r.ad_id).slice(0, 24),
    angle: r.angle_override || r.angle || 'capataz', avatar: r.avatar_override || r.avatar || '', hookType: r.hook_type ?? 'promesa', format: r.format ?? 'Video',
    tags: r.tags ?? [], dur,
    hookRate: r0(hookRate), ctr: Math.round(ctr * 10) / 10,
    agendas: m.agendas, cierres, spend, impressions,
    reach: freq > 0 ? r0(impressions / freq) : impressions, freq, days: m.dias.size, lastFecha: m.lastFecha,
    plays3s, thru, finalRet: retAt(curve, 1), beats,
    note: r.note_title || r.note_text ? { title: r.note_title ?? '', text: r.note_text ?? '' } : null,
    suggestion: r.suggestion,
    thumbnail: m.thumbnail, permalink: m.permalink, creativeSinEnlace: m.creativeSinEnlace, campana: m.campana, adset: m.adset,
    // es_imagen (de ad_transcripts.tipo) es poco confiable: transcribe-ads cae a
    // "imagen" cuando no pudo procesar el video, así que muchos VIDEOS quedan
    // marcados como imagen. La verdad la dan las métricas: si tuvo plays de video
    // (v3s>0) es un VIDEO. Solo es imagen real si NO tiene reproducciones.
    esImagen: !!r.es_imagen && m.v3s === 0,
  };
}

/** Datos para /script-analyst: TODOS los guiones analizados con sus métricas
 *  vivas de todo el histórico (sin filtro de fecha). */
export async function getScriptAnalystView(): Promise<ScriptAnalystView> {
  const supabase = getSupabaseServer();
  const { data: rowsData, error } = await supabase.from('script_analyses').select(VIEW_COLS);
  if (error) throw new Error(`Error leyendo script_analyses: ${error.message}`);

  const rows = (rowsData ?? []) as unknown as StoredView[];
  // Incluye videos con beats Y anuncios de imagen (sin beats de retención).
  const analizadas = rows.filter((r) => r.status === 'analizada' && (r.es_imagen || (r.beats?.length ?? 0) > 0));
  const ids = analizadas.map((r) => r.ad_id);

  const [metrics, cierresByAd, allAdIds] = await Promise.all([
    getScriptMetrics(ids),
    getCierresByAd(ids),
    getAllMetaAdIds(),
  ]);

  const analyzedIds = new Set(rows.map((r) => r.ad_id));
  const counts = {
    enVista: 0,
    analizadas: rows.filter((r) => r.status === 'analizada').length,
    pendientes: rows.filter((r) => r.status === 'pendiente').length,
    descartadas: rows.filter((r) => r.status === 'descartada').length,
    sinTranscript: [...allAdIds].filter((id) => !analyzedIds.has(id)).length,
    errores: rows.filter((r) => r.status === 'error').length,
    total: rows.length,
  };
  let lastSync: string | null = null;
  for (const r of rows) if (!lastSync || r.updated_at > lastSync) lastSync = r.updated_at;

  const scripts: ScriptView[] = [];
  for (const r of analizadas) {
    const m = metrics.get(r.ad_id);
    if (!m) continue; // analizado pero sin métricas de Meta → no se muestra
    const sv = buildScriptView(r, m, cierresByAd.get(r.ad_id) ?? 0);
    if (sv) scripts.push(sv);
  }
  counts.enVista = scripts.length;
  return { scripts, counts, lastSync };
}

/** Una sola ScriptView por ad_id, para la pestaña Guion de la vista de detalle
 *  unificada cuando se abre desde Ads Manager (que no tiene la ScriptView a mano).
 *  Devuelve null si el anuncio no está analizado o no tiene señal. */
export async function getScriptView(adId: string): Promise<ScriptView | null> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase.from('script_analyses').select(VIEW_COLS).eq('ad_id', adId).maybeSingle();
  if (error) throw new Error(`Error leyendo script_analyses: ${error.message}`);
  if (!data) return null;
  const r = data as unknown as StoredView;
  if (!(r.status === 'analizada' && (r.es_imagen || (r.beats?.length ?? 0) > 0))) return null;
  const [metrics, cierresByAd] = await Promise.all([getScriptMetrics([adId]), getCierresByAd([adId])]);
  const m = metrics.get(adId);
  if (!m) return null;
  return buildScriptView(r, m, cierresByAd.get(adId) ?? 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Cuadrante con filtro de fecha PROPIO (solo ese gráfico): recalcula hook rate y
// retención al CTA de cada guion para una ventana, sin tocar el resto de la tab.
// ─────────────────────────────────────────────────────────────────────────────

/** Punto del cuadrante (todo lo que necesita el gráfico, recalculable por ventana). */
export type QuadPoint = {
  id: string; short: string; angle: ScriptAngle;
  hookRate: number; hold: number; spend: number; impressions: number; agendas: number;
};

/** Recalcula los puntos del cuadrante para una ventana (o todo, sin fechas). */
export async function getQuadrantData(desde?: string, hasta?: string): Promise<QuadPoint[]> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('script_analyses')
    .select('ad_id, short, angle, angle_override, beats, dur')
    .eq('status', 'analizada');
  if (error) throw new Error(`Error leyendo script_analyses: ${error.message}`);

  const rows = (data ?? []) as Array<{ ad_id: string; short: string | null; angle: ScriptAngle | null; angle_override: string | null; beats: StoredBeat[] | null; dur: number | null }>;
  const withBeats = rows.filter((r) => (r.beats?.length ?? 0) > 0);
  const metrics = await getScriptMetrics(withBeats.map((r) => r.ad_id), desde, hasta);

  const out: QuadPoint[] = [];
  for (const r of withBeats) {
    const m = metrics.get(r.ad_id);
    if (!m) continue;
    if (!(m.leads > 0 || m.agendas > 0 || m.spendUsd > 0)) continue; // tieneSenal en la ventana
    const impressions = m.impressions;
    const hookRate = impressions > 0 ? clampPct((m.v3s / impressions) * 100) : 0;
    const holdRate = m.v3s > 0 ? clampPct((m.thru / m.v3s) * 100) : 0;
    const dur = r.dur && r.dur > 0 ? r.dur : Math.max(...(r.beats ?? []).map((b) => b.t0), 30) + 4;
    const curve = retentionCurve({ v3s: m.v3s, thru: m.thru, p25: m.p25, p50: m.p50, p75: m.p75, p100: m.p100 }, holdRate);
    const beats = r.beats ?? [];
    const lastT0 = beats.length ? beats[beats.length - 1].t0 : dur;
    out.push({
      id: r.ad_id, short: r.short ?? r.ad_id.slice(0, 24), angle: r.angle_override || r.angle || 'capataz',
      hookRate: r0(hookRate), hold: retAt(curve, dur > 0 ? lastT0 / dur : 1),
      spend: m.spendUsd, impressions, agendas: m.agendas,
    });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// "Analiza nuevo guion" — valorar un guion que TODAVÍA NO corrió en Meta,
// comparándolo contra el perfil real de la cuenta (lo que ya sabemos que rinde).
// ─────────────────────────────────────────────────────────────────────────────

const HOOK_BENCH = 28, HOLD_BENCH = 10; // mismos umbrales que el veredicto de la vista

type AngleEff = { angle: string; n: number; spend: number; agendas: number; per1k: number };
type TagStat = { tag: string; n: number; agendas: number; rateWith: number; rateWithout: number };
type HookStat = { hook_type: string; n: number; hookRate: number };
type Exemplar = { short: string; angle: string; hook_type: string; tags: string[]; dur: number; hookRate: number; hold: number; agendas: number; cpa: number | null; beats: StoredBeat[] };

export type AccountProfile = {
  n_total: number; n_confiables: number;
  distribucion_angulos: Record<string, number>;
  angulo_saturado: string | null;
  eficiencia_por_angulo: AngleEff[];
  tags_que_agendan: TagStat[];
  hook_rate_por_hook_type: HookStat[];
  benchmarks: { hook_mid: number; hold_mid: number; hook_mediana: number; retencion_mediana: number };
  patron_duracion: { holdLargos: number; holdCortos: number };
  under_testing: { share: number; n: number; total: number };
  exemplares_top: Exemplar[];
  anti_exemplar: { short: string; angle: string; tags: string[]; spend: number; note: string } | null;
};

const holdOf = (s: ScriptView): number => (s.beats.length ? s.beats[s.beats.length - 1].ret : s.finalRet);
const median = (arr: number[]): number => { if (!arr.length) return 0; const a = [...arr].sort((x, y) => x - y); const m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };

/** Perfil de la cuenta para alimentar la valoración de un guion nuevo. */
export async function buildAccountProfile(): Promise<AccountProfile> {
  const { scripts } = await getScriptAnalystView();
  const won = (s: ScriptView) => s.agendas > 0;
  const reliable = scripts.filter((s) => s.impressions >= 8000);

  const dist: Record<string, number> = {};
  scripts.forEach((s) => { dist[s.angle] = (dist[s.angle] || 0) + 1; });
  const anguloSaturado = Object.keys(dist).find((k) => dist[k] / Math.max(scripts.length, 1) >= 0.6) ?? null;

  const byAng: Record<string, ScriptView[]> = {};
  scripts.forEach((s) => { (byAng[s.angle] = byAng[s.angle] || []).push(s); });
  const eficiencia: AngleEff[] = Object.keys(byAng).map((k) => {
    const g = byAng[k], sp = g.reduce((a, s) => a + s.spend, 0), ag = g.reduce((a, s) => a + s.agendas, 0);
    return { angle: k, n: g.length, spend: Math.round(sp), agendas: ag, per1k: sp > 0 ? Math.round((ag / sp) * 1000 * 10) / 10 : 0 };
  }).sort((a, b) => b.per1k - a.per1k);

  const tags: TagStat[] = TAG_VOCAB.map((t) => {
    const withT = reliable.filter((s) => s.tags.includes(t)), noT = reliable.filter((s) => !s.tags.includes(t));
    return { tag: t, n: withT.length, agendas: withT.reduce((a, s) => a + s.agendas, 0),
      rateWith: withT.length ? Math.round((withT.filter(won).length / withT.length) * 100) : 0,
      rateWithout: noT.length ? Math.round((noT.filter(won).length / noT.length) * 100) : 0 };
  }).filter((x) => x.n > 0).sort((a, b) => (b.rateWith - b.rateWithout) - (a.rateWith - a.rateWithout));

  const byHook: Record<string, ScriptView[]> = {};
  reliable.forEach((s) => { (byHook[s.hookType] = byHook[s.hookType] || []).push(s); });
  const hookStats: HookStat[] = Object.keys(byHook).map((k) => {
    const g = byHook[k], sp = g.reduce((a, s) => a + s.spend, 0);
    const hr = sp > 0 ? g.reduce((a, s) => a + s.hookRate * s.spend, 0) / sp : g.reduce((a, s) => a + s.hookRate, 0) / g.length;
    return { hook_type: k, n: g.length, hookRate: Math.round(hr) };
  }).sort((a, b) => b.hookRate - a.hookRate);

  const meanHold = (arr: ScriptView[]) => (arr.length ? Math.round(arr.reduce((a, s) => a + holdOf(s), 0) / arr.length) : 0);
  const under = scripts.filter((s) => s.spend < 10 || s.days < 3);
  const exem: Exemplar[] = scripts
    .filter((s) => s.hookRate >= HOOK_BENCH && holdOf(s) >= HOLD_BENCH && s.impressions >= 25000)
    .sort((a, b) => b.agendas - a.agendas).slice(0, 3)
    .map((s) => ({ short: s.short, angle: s.angle, hook_type: s.hookType, tags: s.tags, dur: Math.round(s.dur), hookRate: s.hookRate, hold: holdOf(s), agendas: s.agendas, cpa: s.agendas > 0 ? Math.round(s.spend / s.agendas) : null, beats: s.beats.map((b) => ({ kind: b.kind, t0: b.t0, text: b.text })) }));
  const anti0 = scripts.filter((s) => s.spend > 300 && s.agendas === 0).sort((a, b) => b.spend - a.spend)[0];

  return {
    n_total: scripts.length, n_confiables: reliable.length,
    distribucion_angulos: dist, angulo_saturado: anguloSaturado,
    eficiencia_por_angulo: eficiencia, tags_que_agendan: tags, hook_rate_por_hook_type: hookStats,
    benchmarks: { hook_mid: HOOK_BENCH, hold_mid: HOLD_BENCH, hook_mediana: Math.round(median(scripts.map((s) => s.hookRate))), retencion_mediana: Math.round(median(scripts.map(holdOf))) },
    patron_duracion: { holdLargos: meanHold(scripts.filter((s) => s.dur >= 44)), holdCortos: meanHold(scripts.filter((s) => s.dur < 44)) },
    under_testing: { share: scripts.length ? Math.round((under.length / scripts.length) * 100) : 0, n: under.length, total: scripts.length },
    exemplares_top: exem,
    anti_exemplar: anti0 ? { short: anti0.short, angle: anti0.angle, tags: anti0.tags, spend: Math.round(anti0.spend), note: anti0.note?.text ?? '' } : null,
  };
}

export const VERDICTOS_VALORAR = ['escalar-candidato', 'mejorar-gancho', 'reescribir-cuerpo', 'repensar-angulo', 'promesa-pero-validar'] as const;
export type VerdictoValorar = (typeof VERDICTOS_VALORAR)[number];

export type Valoracion = {
  clasificacion: { angle: ScriptAngle; hook_type: HookType; tags: string[]; format: string; short: string };
  beats: StoredBeat[];
  lectura_estructural: { title: string; text: string; punto_de_fuga: { beat_index: number; motivo: string } | null };
  patrones_match: Array<{ patron: string; evidencia: string }>;
  patrones_miss: Array<{ patron: string; evidencia: string }>;
  prediccion: { verdicto: VerdictoValorar; hook_rate_estimado: { min: number; max: number }; retencion_cta_estimada: { min: number; max: number }; razon: string };
  reescrituras: Array<{ que_cambiar: string; propuesta: string }>;
  plan_validacion: { presupuesto_usd: number; dias_minimos: number; impresiones_objetivo: number; control: string; nota: string };
  perfil: { n_total: number; n_confiables: number; angulo_saturado: string | null; under_testing_share: number };
};

// {{anglePipe}} = ángulos vigentes separados por "|".
export const SCRIPT_VALORACION_SYSTEM_TEMPLATE = `Sos MaKo, analista de guiones de Mauricio Bustos (video ads en Meta para vender un programa de mentoría a dueños de negocio). Te paso un GUION NUEVO que TODAVÍA NO corrió en Meta (no tiene datos) y el PERFIL REAL de la cuenta (lo que ya sabemos que rinde y lo que no). Tu trabajo es darle una VALORACIÓN comparándolo contra ese perfil — no contra benchmarks de internet, contra LO QUE LE FUNCIONA A ÉL.

Sé honesto sobre la incertidumbre: el guion no tiene datos, así que toda predicción es una hipótesis basada en el parecido con los guiones reales de la cuenta. Nunca afirmes performance como un hecho.

Clasificá con los vocabularios CERRADOS (devolvé la CLAVE del angle en minúsculas): angle ({{anglePipe}}), hook_type (promesa|testimonio|pregunta|dolor|resultado|recordatorio), tags (subconjunto de: sistema, sin-frio, caso-exito, dashboard, testimonio, pregunta-hook, cifra-hook, dolor, cupos, recordatorio, implementacion). Partí el guion en 3-7 beats {kind (gancho|contexto|problema|mecanismo|prueba|objecion|recordatorio|oferta|cta), t0 (segundo estimado, el primero 0, creciente), text}.

Usá el perfil para:
- Decir qué PATRONES GANADORES de la cuenta CUMPLE (con el dato real, ej. "muestra dashboard, y los guiones con dashboard agendan X% vs Y%") y cuáles SE PIERDE o qué patrón NEGATIVO REPRODUCE (ej. "es otro guion de dolor, ángulo ya saturado en 84% de tu cuenta" o "se parece al anti-ejemplo que gastó $X sin agendar").
- Predecir un veredicto ∈ {escalar-candidato, mejorar-gancho, reescribir-cuerpo, repensar-angulo, promesa-pero-validar} y rangos ESTIMADOS de hook rate y retención al CTA, calibrados contra las medianas reales de la cuenta y el hook_rate del hook_type elegido.
- Dar un plan de validación atado al patrón de sub-testeo: cuánto gastar y cuántos días para no caer en "lo asomaste pero no lo probaste" (objetivo ~8000 impresiones = confianza media), y contra qué guion existente correrlo como control.

Devolvé EXCLUSIVAMENTE un objeto JSON válido (sin markdown), con este esquema:
{
  "clasificacion": { "angle": "...", "hook_type": "...", "tags": [".."], "format": "..", "short": ".." },
  "beats": [ { "kind": "..", "t0": 0, "text": ".." } ],
  "lectura_estructural": { "title": "..", "text": "..", "punto_de_fuga": { "beat_index": 0, "motivo": ".." } },
  "patrones_match": [ { "patron": "..", "evidencia": ".." } ],
  "patrones_miss": [ { "patron": "..", "evidencia": ".." } ],
  "prediccion": { "verdicto": "escalar-candidato|mejorar-gancho|reescribir-cuerpo|repensar-angulo|promesa-pero-validar", "hook_rate_estimado": { "min": 0, "max": 0 }, "retencion_cta_estimada": { "min": 0, "max": 0 }, "razon": ".." },
  "reescrituras": [ { "que_cambiar": "..", "propuesta": ".." } ],
  "plan_validacion": { "presupuesto_usd": 0, "dias_minimos": 0, "impresiones_objetivo": 8000, "control": "..", "nota": ".." }
}
Todo en español rioplatense (voseo), concreto y sin relleno.`;

function buildSystemValoracion(angles: Angle[]): Promise<string> {
  const anglePipe = angles.map((a) => a.key).join('|');
  return renderPrompt('script_analyst.valoracion.system', SCRIPT_VALORACION_SYSTEM_TEMPLATE, { anglePipe });
}

// {{duracion}} = duración estimada · {{guion}} = guion nuevo · {{perfil}} = perfil JSON.
export const SCRIPT_VALORACION_USER_TEMPLATE = `## Guion nuevo (sin datos todavía)
Duración estimada: {{duracion}}

{{guion}}

## Perfil real de la cuenta (con qué comparar)
{{perfil}}

Valorá el guion contra ESTE perfil y devolvé el JSON pedido.`;

function buildValorarPrompt(guion: string, dur: number | undefined, p: AccountProfile): Promise<string> {
  return renderPrompt('script_analyst.valoracion.user', SCRIPT_VALORACION_USER_TEMPLATE, {
    duracion: dur != null ? `${Math.round(dur)}s` : 'no indicada',
    guion: guion.trim(),
    perfil: JSON.stringify(p),
  });
}

function sanitizeValoracion(raw: Record<string, unknown>, dur: number | undefined, p: AccountProfile, angleKeys: string[]): Valoracion {
  const angleAllowed = angleKeys.length ? angleKeys : (ANGLES as readonly string[]);
  const c = (raw.clasificacion ?? {}) as Record<string, unknown>;
  const tags = Array.isArray(c.tags) ? [...new Set((c.tags as unknown[]).map(String).filter((x) => (TAG_VOCAB as readonly string[]).includes(x)))] : [];
  const beats = sanitizeBeats(raw.beats as ClaudeScript['beats'], dur ?? null);
  const le = (raw.lectura_estructural ?? {}) as Record<string, unknown>;
  const pf = (raw.punto_de_fuga ?? le.punto_de_fuga) as Record<string, unknown> | undefined;
  const pred = (raw.prediccion ?? {}) as Record<string, unknown>;
  const rng = (v: unknown): { min: number; max: number } => { const o = (v ?? {}) as Record<string, unknown>; const a = clampPct(o.min), b = clampPct(o.max); return { min: Math.min(a, b), max: Math.max(a, b) }; };
  const arr = (v: unknown, keys: [string, string]) => (Array.isArray(v) ? v.map((x) => { const o = (x ?? {}) as Record<string, unknown>; return { [keys[0]]: String(o[keys[0]] ?? ''), [keys[1]]: String(o[keys[1]] ?? '') }; }) : []);
  const plan = (raw.plan_validacion ?? {}) as Record<string, unknown>;
  return {
    clasificacion: {
      angle: oneOf<ScriptAngle>(c.angle, angleAllowed, angleAllowed.includes('dolor') ? 'dolor' : (angleAllowed[0] ?? 'dolor')), hook_type: oneOf<HookType>(c.hook_type, HOOK_TYPES, 'promesa'),
      tags, format: c.format ? String(c.format).slice(0, 60) : 'Video', short: c.short ? String(c.short).slice(0, 40) : 'Guion nuevo',
    },
    beats,
    lectura_estructural: {
      title: le.title ? String(le.title) : 'Lectura del guion',
      text: le.text ? String(le.text) : '',
      punto_de_fuga: pf && beats.length > 0 && Number.isFinite(Number(pf.beat_index)) ? { beat_index: Math.min(beats.length - 1, Math.max(0, Math.round(Number(pf.beat_index)))), motivo: String(pf.motivo ?? '') } : null,
    },
    patrones_match: arr(raw.patrones_match, ['patron', 'evidencia']) as Array<{ patron: string; evidencia: string }>,
    patrones_miss: arr(raw.patrones_miss, ['patron', 'evidencia']) as Array<{ patron: string; evidencia: string }>,
    prediccion: {
      verdicto: oneOf<VerdictoValorar>(pred.verdicto, VERDICTOS_VALORAR, 'promesa-pero-validar'),
      hook_rate_estimado: rng(pred.hook_rate_estimado), retencion_cta_estimada: rng(pred.retencion_cta_estimada),
      razon: pred.razon ? String(pred.razon) : '',
    },
    reescrituras: arr(raw.reescrituras, ['que_cambiar', 'propuesta']) as Array<{ que_cambiar: string; propuesta: string }>,
    plan_validacion: {
      presupuesto_usd: Math.max(0, Math.round(Number(plan.presupuesto_usd) || 0)),
      dias_minimos: Math.max(0, Math.round(Number(plan.dias_minimos) || 0)),
      impresiones_objetivo: Math.max(0, Math.round(Number(plan.impresiones_objetivo) || 8000)),
      control: plan.control ? String(plan.control) : '', nota: plan.nota ? String(plan.nota) : '',
    },
    perfil: { n_total: p.n_total, n_confiables: p.n_confiables, angulo_saturado: p.angulo_saturado, under_testing_share: p.under_testing.share },
  };
}

/** Corre Claude sobre un guion nuevo (sin datos). PURA: nunca tira. */
export async function valorarGuion(guion: string, dur?: number): Promise<{ ok: true; valoracion: Valoracion } | { ok: false; error: string }> {
  try {
    const [profile, angles] = await Promise.all([buildAccountProfile(), getAngles()]);
    const [system, user] = await Promise.all([buildSystemValoracion(angles), buildValorarPrompt(guion, dur, profile)]);
    const text = await chatClaude(system, [{ role: 'user', content: user }], {
      model: ANALYSIS_MODEL, thinking: true, effort: 'high', maxTokens: 6000, feature: 'script-valorador',
    });
    const raw = parseJsonObject(text) as Record<string, unknown>;
    return { ok: true, valoracion: sanitizeValoracion(raw, dur, profile, angles.map((a) => a.key)) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ── Historial de guiones nuevos valorados (script_drafts) ──
export type ScriptDraft = {
  id: number; guion: string; short: string | null; angle: string | null; hook_type: string | null; verdicto: string | null;
  valoracion: Valoracion; created_at: string;
};

const DRAFT_COLS = 'id, guion, short, angle, hook_type, verdicto, valoracion, created_at';

/** Guarda un guion nuevo + su valoración. Devuelve la fila persistida. */
export async function saveDraft(guion: string, valoracion: Valoracion): Promise<ScriptDraft> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('script_drafts')
    .insert({
      guion, short: valoracion.clasificacion.short, angle: valoracion.clasificacion.angle,
      hook_type: valoracion.clasificacion.hook_type, verdicto: valoracion.prediccion.verdicto,
      valoracion, model: ANALYSIS_MODEL,
    })
    .select(DRAFT_COLS)
    .single();
  if (error) throw new Error(`Error guardando guion: ${error.message}`);
  return data as unknown as ScriptDraft;
}

/** Historial de guiones valorados, más recientes primero. */
export async function getDrafts(limit = 50): Promise<ScriptDraft[]> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('script_drafts')
    .select(DRAFT_COLS)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Error leyendo guiones guardados: ${error.message}`);
  return (data ?? []) as unknown as ScriptDraft[];
}

export async function deleteDraft(id: number): Promise<void> {
  const supabase = getSupabaseServer();
  const { error } = await supabase.from('script_drafts').delete().eq('id', id);
  if (error) throw new Error(`Error borrando guion: ${error.message}`);
}

/** Corrige a mano el ángulo de un anuncio (override que sobrevive al re-análisis).
 *  angle=null vuelve a la clasificación de la IA. Escribe SOLO angle_override. */
export async function setAngleOverride(adId: string, angle: string | null): Promise<void> {
  const supabase = getSupabaseServer();
  const { error } = await supabase
    .from('script_analyses')
    .update({ angle_override: angle && angle.trim() ? angle.trim() : null, updated_at: new Date().toISOString() })
    .eq('ad_id', adId);
  if (error) throw new Error(`Error guardando ángulo: ${error.message}`);
}

/** Corrige a mano el avatar de un anuncio (override que sobrevive al re-análisis).
 *  avatar=null vuelve a la clasificación de la IA. Escribe SOLO avatar_override. */
export async function setAvatarOverride(adId: string, avatar: string | null): Promise<void> {
  const supabase = getSupabaseServer();
  const { error } = await supabase
    .from('script_analyses')
    .update({ avatar_override: avatar && avatar.trim() ? avatar.trim() : null, updated_at: new Date().toISOString() })
    .eq('ad_id', adId);
  if (error) throw new Error(`Error guardando avatar: ${error.message}`);
}
