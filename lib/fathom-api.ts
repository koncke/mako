// =============================================================================
// Fathom — cliente de la REST API (external/v1)
// =============================================================================
// La key va en FATHOM_API_KEY y se manda en el header `X-Api-Key`. Esta capa
// trae las llamadas históricas (paginadas por cursor) para el Closing Analyst.
//
// Dos modos de fetch, para no bajar transcripts gigantes de gusto:
//   - listMeetingsPage / fetchAllMeetings  → barrido de METADATA (título,
//     invitados, fechas, recording_id). Liviano; sirve para clasificar y matchear.
//   - fetchMeetingContent(recording_id)    → UNA llamada con summary + transcript
//     completos. Se usa solo para los candidatos a venta que sí se analizan.
//
// El webhook (lib/fathom.ts) es otra cosa: firma Svix + payload entrante. Acá es
// fetch saliente con API key.
// =============================================================================

import 'server-only';
import { credWs } from './credenciales';

const BASE = 'https://api.fathom.ai/external/v1';

// ── Tipos del payload de la API ─────────────────────────────────────────────

export type FathomInvitee = {
  name?: string | null;
  email?: string | null;
  email_domain?: string | null;
  is_external?: boolean | null;
  matched_speaker_display_name?: string | null;
};

export type FathomTranscriptItem = {
  speaker?: { display_name?: string | null; matched_calendar_invitee_email?: string | null } | null;
  text?: string | null;
  timestamp?: string | null; // "HH:MM:SS"
};

export type FathomSummary = {
  template_name?: string | null;
  markdown_formatted?: string | null;
} | null;

export type FathomActionItem = {
  description?: string | null;
  user_generated?: boolean | null;
  completed?: boolean | null;
  recording_timestamp?: string | null;
  recording_playback_url?: string | null;
  assignee?: { name?: string | null; email?: string | null } | null;
};

export type FathomMeeting = {
  title?: string | null;
  meeting_title?: string | null;
  meeting_type?: string | null;
  url?: string | null;          // https://fathom.video/calls/<id>
  meeting_url?: string | null;  // link de Zoom/Meet
  created_at?: string | null;
  scheduled_start_time?: string | null;
  scheduled_end_time?: string | null;
  recording_id: number;
  recording_start_time?: string | null;
  recording_end_time?: string | null;
  calendar_invitees_domains_type?: string | null;
  transcript?: FathomTranscriptItem[] | null;
  transcript_language?: string | null;
  default_summary?: FathomSummary;
  action_items?: FathomActionItem[] | null;
  highlights?: unknown;
  calendar_invitees?: FathomInvitee[] | null;
  recorded_by?: { name?: string | null; email?: string | null; team?: unknown } | null;
  share_url?: string | null;
  crm_matches?: unknown;
};

type MeetingsPage = { items: FathomMeeting[]; next_cursor: string | null; limit?: number };

// ── HTTP ────────────────────────────────────────────────────────────────────

async function apiKey(): Promise<string> {
  const key = await credWs('FATHOM_API_KEY');
  if (!key) throw new Error('FATHOM_API_KEY no configurada');
  return key;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Fathom NO CONTESTÓ (429, 5xx o la red, después de los reintentos): un fallo PASAJERO, que no es
 * «la grabación no tiene contenido». Es lo que deja que quien lee distinga los dos (16/10/2026,
 * `extraerTareasDeReunion`): tratado como vacío, una reunión leída por el webhook en el minuto en
 * que Fathom tosía quedaba cerrada para siempre como «sin compromisos». Un 4xx sigue siendo un
 * `Error` común: ése no se arregla reintentando.
 */
export class FathomSinRespuestaError extends Error {}

// Reintenta en 429 / 5xx / red, con backoff. El bug del v1 fue tragar estos
// fallos en silencio (transcript vacío → análisis basura con score 0).
async function fathomGet<T>(path: string, params: Record<string, string | number | boolean | undefined> = {}, tries = 4): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  let lastErr = '';
  for (let i = 0; i < tries; i++) {
    const backoff = () => (i < tries - 1 ? sleep(700 * (i + 1)) : Promise.resolve()); // no dormir tras el último intento
    let res: Response;
    try {
      res = await fetch(url, { headers: { 'X-Api-Key': await apiKey(), accept: 'application/json' }, cache: 'no-store' });
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
      await backoff();
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      lastErr = `Fathom ${res.status}`;
      await backoff();
      continue;
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Fathom ${res.status} en ${path}: ${body.slice(0, 200)}`);
    }
    return (await res.json()) as T;
  }
  throw new FathomSinRespuestaError(`Fathom sin respuesta en ${path} tras ${tries} intentos: ${lastErr}`);
}

// ── Listado (metadata) ──────────────────────────────────────────────────────

export type ListOpts = {
  cursor?: string | null;
  limit?: number;
  includeTranscript?: boolean;
  includeSummary?: boolean;
  includeActionItems?: boolean;
  recordedAfter?: string; // ISO — recorded_after
  createdAfter?: string;  // ISO — created_after
};

function listParams(opts: ListOpts): Record<string, string | number | boolean | undefined> {
  return {
    limit: opts.limit ?? 50,
    cursor: opts.cursor ?? undefined,
    include_transcript: opts.includeTranscript ? true : undefined,
    include_summary: opts.includeSummary ? true : undefined,
    include_action_items: opts.includeActionItems ? true : undefined,
    recorded_after: opts.recordedAfter,
    created_after: opts.createdAfter,
  };
}

/** Una página de meetings (metadata por defecto). */
export async function listMeetingsPage(opts: ListOpts = {}): Promise<MeetingsPage> {
  return fathomGet<MeetingsPage>('/meetings', listParams(opts));
}

/**
 * Trae TODAS las meetings paginando por cursor. Por defecto solo metadata (sin
 * transcript) para que el barrido sea barato. `maxPages` es una red de seguridad.
 */
export async function fetchAllMeetings(
  opts: Omit<ListOpts, 'cursor'> & { maxPages?: number } = {},
): Promise<FathomMeeting[]> {
  const maxPages = opts.maxPages ?? 60;
  const out: FathomMeeting[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < maxPages; page++) {
    const res: MeetingsPage = await listMeetingsPage({ ...opts, cursor });
    out.push(...(res.items ?? []));
    cursor = res.next_cursor;
    if (!cursor) break;
  }
  return out;
}

/**
 * Transcript de UNA grabación. El endpoint /recordings/:id/transcript SÍ keyea
 * por id (a diferencia del filtro recording_id del listado, que lo ignora y
 * devuelve las más recientes).
 */
export async function fetchRecordingTranscript(recordingId: number): Promise<FathomTranscriptItem[]> {
  const res = await fathomGet<{ transcript?: FathomTranscriptItem[] }>(`/recordings/${recordingId}/transcript`);
  return res.transcript ?? [];
}

/** Summary (markdown) de UNA grabación. */
export async function fetchRecordingSummary(recordingId: number): Promise<FathomSummary> {
  const res = await fathomGet<{ summary?: FathomSummary }>(`/recordings/${recordingId}/summary`);
  return res.summary ?? null;
}

/**
 * Enriquece la metadata de una meeting (la que vino del listado) con su
 * transcript y summary, vía los endpoints /recordings/:id/*. Si alguno falla,
 * cae a vacío (no rompe el análisis: el otro ya da contexto).
 */
export async function fetchMeetingContent(meta: FathomMeeting): Promise<FathomMeeting> {
  const id = meta.recording_id;
  // El transcript NO se traga: si falla tras los reintentos, propaga para que el
  // caller marque la fila como 'error' (visible), en vez de simular "sin
  // transcript" → 'pendiente' y reintentar para siempre (bug del v1). El summary
  // sí es opcional (complementario), se tolera su fallo.
  const [transcript, summary] = await Promise.all([
    fetchRecordingTranscript(id),
    fetchRecordingSummary(id).catch(() => null),
  ]);
  return { ...meta, transcript, default_summary: summary };
}

// ── Helpers de extracción ───────────────────────────────────────────────────

/** Emails de los invitados EXTERNOS (los prospectos), en minúscula, sin vacíos. */
export function externalInviteeEmails(m: FathomMeeting): string[] {
  return (m.calendar_invitees ?? [])
    .filter((i) => i.is_external && i.email)
    .map((i) => i.email!.trim().toLowerCase())
    .filter(Boolean);
}

/** Título legible de la meeting (cae a meeting_title). */
export function meetingTitle(m: FathomMeeting): string {
  return (m.title || m.meeting_title || '').trim();
}

/** Duración en minutos (recording_end - recording_start), o null. */
export function meetingDurationMin(m: FathomMeeting): number | null {
  if (!m.recording_start_time || !m.recording_end_time) return null;
  const a = new Date(m.recording_start_time).getTime();
  const b = new Date(m.recording_end_time).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return Math.round((b - a) / 60000);
}

/** ISO de inicio de la grabación (cae a scheduled). */
export function meetingStartIso(m: FathomMeeting): string | null {
  return m.recording_start_time || m.scheduled_start_time || null;
}

/** Texto plano del transcript con timestamps, recortado a `maxChars`. */
export function transcriptToText(items: FathomTranscriptItem[] | null | undefined, maxChars = 16000): string {
  if (!items || !items.length) return '';
  const lines: string[] = [];
  let len = 0;
  for (const it of items) {
    const speaker = it.speaker?.display_name ?? '—';
    const text = (it.text ?? '').trim();
    if (!text) continue;
    const line = `[${it.timestamp ?? '00:00:00'}] ${speaker}: ${text}`;
    if (len + line.length > maxChars) {
      lines.push('… (transcript recortado)');
      break;
    }
    lines.push(line);
    len += line.length + 1;
  }
  return lines.join('\n');
}
