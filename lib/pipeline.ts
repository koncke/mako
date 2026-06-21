// =============================================================================
// Pipeline del CRM — etapas, paleta y derivación (puro, compartido)
// =============================================================================
// Sin 'server-only': lo importan tanto el server (page) como el cliente
// (CrmBoard). Las funciones que tocan Supabase viven en lib/leads.ts.

import type { EstadoLead } from './leads';

export type StageTone =
  | 'neutral' | 'accent' | 'good' | 'bad' | 'warn' | 'info'
  | 'violet' | 'teal' | 'orange' | 'sky' | 'taupe' | 'rose' | 'indigo' | 'magenta';

export type Stage = {
  key: string;
  label: string;
  dot: string;
  tone: StageTone;
  custom?: boolean;
};

// Etapas por defecto del funnel (idénticas al prototipo y a la semilla SQL).
// "Post Reunión" (nutrición entre R1 y R2) se ubica justo después de Agenda R1.
export const DEFAULT_STAGES: Stage[] = [
  { key: 'lead',        label: 'Lead (Instant form)',      dot: '#3B6FB0', tone: 'info' },
  { key: 'agenda',      label: 'Agenda R1',                dot: '#C8870C', tone: 'accent' },
  { key: 'postreunion', label: 'Nutrición - Post Reunión', dot: '#D9A400', tone: 'warn' },
  { key: 'agendaj2',    label: 'Agenda R2',                dot: '#2E7DBE', tone: 'sky' },
  { key: 'facturando',  label: 'Facturando',               dot: '#0E8E7E', tone: 'teal' },
  { key: 'ganado',      label: 'Ganado',                   dot: '#1C8A54', tone: 'good' },
  { key: 'perdido',     label: 'Perdido',                  dot: '#CF4E29', tone: 'bad' },
  { key: 'descal',      label: 'Descalificado',            dot: '#8A6D3B', tone: 'taupe' },
  { key: 'noshow',      label: 'Nutrición - No Show',      dot: '#B5630A', tone: 'orange' },
  { key: 'nutri',       label: 'Nutrición - No Agenda',    dot: '#6A4BD8', tone: 'violet' },
  { key: 'nopaga',      label: 'Nutrición - No Paga',      dot: '#C7417B', tone: 'rose' },
  { key: 'manual',      label: 'Nutrición - Manual',       dot: '#4F5BD5', tone: 'indigo' },
  { key: 'postagenda',  label: 'Nutrición - Post Agenda',  dot: '#9D4EDD', tone: 'magenta' },
  { key: 'noresp',      label: 'No responde',              dot: '#A39E91', tone: 'neutral' },
];

export const NEW_STAGE_PALETTE = ['#3B6FB0', '#C8870C', '#0E8E7E', '#6A4BD8', '#C7417B', '#B5630A', '#2E7DBE', '#8A6D3B', '#4F5BD5', '#9D4EDD'];
export const NEW_STAGE_TONES: StageTone[] = ['info', 'accent', 'teal', 'violet', 'rose', 'orange', 'sky', 'taupe', 'indigo', 'magenta'];

export const NUTRI_KEYS = ['noshow', 'nutri', 'nopaga', 'manual', 'postagenda', 'postreunion'];

// ── Transiciones del funnel (grafo etapa → etapa) ───────────────────────────
// Editable en la tab "Funnel". Definen, para cada etapa, los pasos posibles
// siguientes; alimentan las opciones contextuales de "Datos sin marcar".
export type TransitionTone = 'accent' | 'good' | 'bad' | 'nutri';

export type FunnelTransition = {
  from: string;          // stage key de origen
  to: string;            // stage key de destino
  label: string;         // texto del botón / flecha
  tone: TransitionTone;  // color
  asistioJ1?: boolean;   // marca asistencia a R1 al aplicar (Datos sin marcar tipo A)
  asistioJ2?: boolean;   // marca asistencia a R2 al aplicar (Datos sin marcar tipo C)
};

// Grafo por defecto (se usa si la tabla funnel_transitions está vacía / sin migrar).
export const DEFAULT_TRANSITIONS: FunnelTransition[] = [
  // Lead → primeros pasos
  { from: 'lead', to: 'agenda', label: 'Agendó R1', tone: 'accent' },
  { from: 'lead', to: 'postagenda', label: 'Nutrición - Post Agenda', tone: 'nutri' },
  { from: 'lead', to: 'nutri', label: 'Nutrición - No Agenda', tone: 'nutri' },
  // Agenda R1 — tras la primera reunión
  { from: 'agenda', to: 'agendaj2', label: 'Asistió · Agenda R2', tone: 'accent', asistioJ1: true },
  { from: 'agenda', to: 'postreunion', label: 'Nutrición - Post Reunión', tone: 'nutri', asistioJ1: true },
  { from: 'agenda', to: 'noshow', label: 'No Show', tone: 'nutri', asistioJ1: false },
  { from: 'agenda', to: 'perdido', label: 'Perdido', tone: 'bad', asistioJ1: true },
  { from: 'agenda', to: 'descal', label: 'Descalificado', tone: 'bad', asistioJ1: true },
  // Post Reunión → R2 o desenlace
  { from: 'postreunion', to: 'agendaj2', label: 'Agenda R2', tone: 'accent' },
  { from: 'postreunion', to: 'perdido', label: 'Perdido', tone: 'bad' },
  { from: 'postreunion', to: 'descal', label: 'Descalificado', tone: 'bad' },
  { from: 'postreunion', to: 'noresp', label: 'No responde', tone: 'bad' },
  // Agenda R2 — tras la segunda reunión
  { from: 'agendaj2', to: 'facturando', label: 'Asistió · Facturando', tone: 'accent', asistioJ2: true },
  { from: 'agendaj2', to: 'ganado', label: 'Ganado', tone: 'good', asistioJ2: true },
  { from: 'agendaj2', to: 'postagenda', label: 'No Show', tone: 'nutri', asistioJ2: false },
  { from: 'agendaj2', to: 'perdido', label: 'Perdido', tone: 'bad', asistioJ2: true },
  { from: 'agendaj2', to: 'descal', label: 'Descalificado', tone: 'bad', asistioJ2: true },
  // Facturando → desenlace
  { from: 'facturando', to: 'ganado', label: 'Ganado', tone: 'good' },
  { from: 'facturando', to: 'nopaga', label: 'Nutrición - No Paga', tone: 'nutri' },
  { from: 'facturando', to: 'perdido', label: 'Perdido', tone: 'bad' },
];

/** Transiciones salientes de una etapa. */
export function transitionsFrom(transitions: FunnelTransition[], from: string): FunnelTransition[] {
  return transitions.filter((t) => t.from === from);
}

export type ChipColor = { bg: string; fg: string; bd: string };

export const CHIP: Record<StageTone, ChipColor> = {
  neutral: { bg: 'var(--surface-2)', fg: 'var(--dim)', bd: 'var(--border-strong)' },
  accent:  { bg: 'rgba(200,135,12,.12)', fg: '#9A6A09', bd: 'rgba(200,135,12,.30)' },
  good:    { bg: 'var(--good-bg)', fg: 'var(--good)', bd: 'var(--good)' },
  bad:     { bg: 'var(--bad-bg)', fg: 'var(--bad)', bd: 'var(--bad)' },
  warn:    { bg: 'var(--warn-bg)', fg: 'var(--warn)', bd: 'var(--warn-fill)' },
  info:    { bg: 'rgba(59,111,176,.11)', fg: '#3B6FB0', bd: 'rgba(59,111,176,.28)' },
  violet:  { bg: 'rgba(122,90,240,.11)', fg: '#6A4BD8', bd: 'rgba(122,90,240,.28)' },
  teal:    { bg: 'rgba(14,158,142,.11)', fg: '#0E8E7E', bd: 'rgba(14,158,142,.28)' },
  orange:  { bg: 'rgba(217,119,6,.12)', fg: '#B5630A', bd: 'rgba(217,119,6,.30)' },
  sky:     { bg: 'rgba(46,125,190,.11)', fg: '#2E7DBE', bd: 'rgba(46,125,190,.28)' },
  taupe:   { bg: 'rgba(138,109,59,.12)', fg: '#8A6D3B', bd: 'rgba(138,109,59,.30)' },
  rose:    { bg: 'rgba(199,65,123,.12)', fg: '#B53A6E', bd: 'rgba(199,65,123,.30)' },
  indigo:  { bg: 'rgba(79,91,213,.12)', fg: '#4F5BD5', bd: 'rgba(79,91,213,.30)' },
  magenta: { bg: 'rgba(157,78,221,.12)', fg: '#8B3FC9', bd: 'rgba(157,78,221,.30)' },
};

export function stageMeta(stages: Stage[], key: string): Stage {
  return stages.find((s) => s.key === key) || stages[0];
}

// Subconjunto de Lead que necesita la derivación (evita acoplar al tipo completo).
export type StageDerivable = {
  estado_lead: EstadoLead;
  pipeline_stage?: string | null;
  fecha_agenda: string | null;
  fecha_junta_1: string | null;
  fecha_junta_2: string | null;
  asistio_j1: boolean | null;
  asistio_j2: boolean | null;
  nutricion_realizada?: boolean;
};

/**
 * Deriva la etapa del tablero a partir de los campos del lead, cuando no hay
 * override manual (`pipeline_stage`). estado_lead es la fuente de verdad del
 * desenlace; lo demás se infiere de fechas/asistencias.
 */
export function deriveStageKey(l: StageDerivable): string {
  switch (l.estado_lead) {
    case 'ganado': return 'ganado';
    case 'perdido': return 'perdido';
    case 'descalificado': return 'descal';
    case 'no_responde': return 'noresp';
  }
  // estado_lead === 'abierto'
  if (l.asistio_j1 === false) return 'noshow';
  if (l.fecha_junta_2) return l.asistio_j2 === true ? 'facturando' : 'agendaj2';
  if (l.fecha_agenda || l.fecha_junta_1) return 'agenda';
  if (l.nutricion_realizada) return 'nutri';
  return 'lead';
}

/** Etapa efectiva: override manual si existe, si no la derivada. */
export function pipelineStageOf(l: StageDerivable): string {
  return l.pipeline_stage || deriveStageKey(l);
}

/**
 * Para etapas terminales, el estado_lead que debe sincronizarse (mantiene
 * Revenue/CAPI correctos). null = etapa no terminal → estado 'abierto'.
 */
export function terminalEstadoFor(stageKey: string): EstadoLead {
  switch (stageKey) {
    case 'ganado': return 'ganado';
    case 'perdido': return 'perdido';
    case 'descal': return 'descalificado';
    case 'noresp': return 'no_responde';
    default: return 'abierto';
  }
}
