// =============================================================================
// Pipeline del CRM — etapas, paleta y derivación (puro, compartido)
// =============================================================================
// Sin 'server-only': lo importan tanto el server (page) como el cliente
// (CrmBoard). Las funciones que tocan Supabase viven en lib/leads.ts.

import type { EstadoLead } from './leads';

export type StageTone =
  | 'neutral' | 'accent' | 'good' | 'bad' | 'warn' | 'info'
  | 'violet' | 'teal' | 'orange' | 'sky' | 'taupe' | 'rose' | 'indigo' | 'magenta';

// Banda (fila) del funnel: pipeline (camino al cierre) · nutrición · salidas.
export type StageBand = 'pipeline' | 'nutricion' | 'salidas';

export type Stage = {
  key: string;
  label: string;
  dot: string;
  tone: StageTone;        // color del chip en el Kanban del CRM
  custom?: boolean;
  // Layout del diagrama del funnel (tab /funnel)
  band?: StageBand;       // fila
  col?: number;           // columna dentro de la fila
  bg?: string;            // fondo de la tarjeta (etapas destacadas: ganado/perdido)
  fg?: string;            // color del texto de la tarjeta
  border?: string;        // color del borde de la tarjeta
};

// Etapas por defecto del funnel (rediseño Claude Design: 3 bandas, R1/R2).
export const DEFAULT_STAGES: Stage[] = [
  { key: 'lead',        label: 'Lead (Instant form)',      dot: '#2F6DDB', tone: 'info',    band: 'pipeline',  col: 0 },
  { key: 'agenda',      label: 'Agenda R1',                dot: '#E08A12', tone: 'accent',  band: 'pipeline',  col: 1 },
  { key: 'agendaj2',    label: 'Agenda R2',                dot: '#2F6DDB', tone: 'sky',     band: 'pipeline',  col: 2 },
  { key: 'facturando',  label: 'Facturando',               dot: '#C8870C', tone: 'teal',    band: 'pipeline',  col: 3 },
  { key: 'ganado',      label: 'Ganado',                   dot: '#3B6D11', tone: 'good',    band: 'pipeline',  col: 4, bg: '#EAF3DE', fg: '#27500A', border: '#3B6D11' },
  { key: 'nutri',       label: 'Nutrición - No Agenda',    dot: '#7C4DD6', tone: 'violet',  band: 'nutricion', col: 0 },
  { key: 'noshow',      label: 'Nutrición - No Show',      dot: '#E8762B', tone: 'orange',  band: 'nutricion', col: 1 },
  { key: 'postagenda',  label: 'Nutrición - Post Agenda',  dot: '#8A52C8', tone: 'magenta', band: 'nutricion', col: 2 },
  { key: 'nopaga',      label: 'Nutrición - No Paga',      dot: '#D6438F', tone: 'rose',    band: 'nutricion', col: 3 },
  { key: 'manual',      label: 'Nutrición - Manual',       dot: '#4F5BD6', tone: 'indigo',  band: 'nutricion', col: 4 },
  { key: 'postreunion', label: 'Nutrición - Post Reunión', dot: '#D9A400', tone: 'warn',    band: 'nutricion', col: 5 },
  { key: 'descal',      label: 'Descalificado',            dot: '#5A463A', tone: 'taupe',   band: 'salidas',   col: 0 },
  { key: 'perdido',     label: 'Perdido',                  dot: '#CF4E29', tone: 'bad',     band: 'salidas',   col: 2, bg: '#FCEBEB', fg: '#791F1F', border: '#A32D2D' },
  { key: 'noresp',      label: 'No responde',              dot: '#A39E91', tone: 'neutral', band: 'salidas',   col: 4 },
];

/** Layout por defecto (banda/col/colores) por key — para enriquecer etapas que vengan sin layout. */
export const STAGE_LAYOUT: Record<string, Pick<Stage, 'band' | 'col' | 'bg' | 'fg' | 'border' | 'dot'>> =
  Object.fromEntries(DEFAULT_STAGES.map((s) => [s.key, { band: s.band, col: s.col, bg: s.bg, fg: s.fg, border: s.border, dot: s.dot }]));

export const NEW_STAGE_PALETTE = ['#3B6FB0', '#C8870C', '#0E8E7E', '#6A4BD8', '#C7417B', '#B5630A', '#2E7DBE', '#8A6D3B', '#4F5BD5', '#9D4EDD'];
export const NEW_STAGE_TONES: StageTone[] = ['info', 'accent', 'teal', 'violet', 'rose', 'orange', 'sky', 'taupe', 'indigo', 'magenta'];

export const NUTRI_KEYS = ['noshow', 'nutri', 'nopaga', 'manual', 'postagenda', 'postreunion'];

// ── Transiciones del funnel (grafo etapa → etapa) ───────────────────────────
// Editable en la tab "Funnel". Definen, para cada etapa, los pasos posibles
// siguientes; alimentan las opciones contextuales de "Datos sin marcar".
// La categoría define el color de la flecha y del botón en el worklist.
export type TransitionCategory = 'avanza' | 'nutricion' | 'perdida';

export const CATEGORY: Record<TransitionCategory, { c: string; label: string }> = {
  avanza:    { c: '#3B6D11', label: 'Avanza' },
  nutricion: { c: '#C8870C', label: 'Nutrición' },
  perdida:   { c: '#CF4E29', label: 'Pérdida' },
};

export type FunnelTransition = {
  from: string;                 // stage key de origen
  to: string;                   // stage key de destino
  label: string;                // texto de la flecha / botón
  category: TransitionCategory; // color
  asistioJ1?: boolean;          // marca asistencia a R1 al aplicar (Datos sin marcar tipo A)
  asistioJ2?: boolean;          // marca asistencia a R2 al aplicar (Datos sin marcar tipo C)
};

// Grafo por defecto (se usa si funnel_config aún no está guardado).
export const DEFAULT_TRANSITIONS: FunnelTransition[] = [
  { from: 'lead', to: 'agenda', label: 'Agendó R1', category: 'avanza' },
  { from: 'lead', to: 'postagenda', label: 'Nutrición - Post Agenda', category: 'nutricion' },
  { from: 'lead', to: 'nutri', label: 'No agendó', category: 'nutricion' },
  { from: 'lead', to: 'noresp', label: 'No responde', category: 'perdida' },
  { from: 'agenda', to: 'agendaj2', label: 'Avanza a R2', category: 'avanza', asistioJ1: true },
  { from: 'agenda', to: 'postreunion', label: 'Nutrición - Post Reunión', category: 'nutricion', asistioJ1: true },
  { from: 'agenda', to: 'noshow', label: 'No-show R1', category: 'nutricion', asistioJ1: false },
  { from: 'agenda', to: 'descal', label: 'No califica', category: 'perdida', asistioJ1: true },
  { from: 'agenda', to: 'perdido', label: 'No avanza', category: 'perdida', asistioJ1: true },
  { from: 'agendaj2', to: 'facturando', label: 'Cerró', category: 'avanza', asistioJ2: true },
  { from: 'agendaj2', to: 'ganado', label: 'Ganado', category: 'avanza', asistioJ2: true },
  { from: 'agendaj2', to: 'noshow', label: 'No-show R2', category: 'nutricion', asistioJ2: false },
  { from: 'agendaj2', to: 'nopaga', label: 'No paga aún', category: 'nutricion', asistioJ2: true },
  { from: 'agendaj2', to: 'perdido', label: 'No cierra', category: 'perdida', asistioJ2: true },
  { from: 'postreunion', to: 'agendaj2', label: 'Agenda R2', category: 'avanza' },
  { from: 'postreunion', to: 'perdido', label: 'Desiste', category: 'perdida' },
  { from: 'facturando', to: 'ganado', label: 'Pagó', category: 'avanza' },
  { from: 'facturando', to: 'nopaga', label: 'Falta pago', category: 'nutricion' },
  { from: 'noshow', to: 'agenda', label: 'Reagenda R1', category: 'avanza' },
  { from: 'nutri', to: 'agenda', label: 'Agenda tardío', category: 'avanza' },
  { from: 'nopaga', to: 'ganado', label: 'Pagó tarde', category: 'avanza' },
  { from: 'nopaga', to: 'perdido', label: 'Desiste', category: 'perdida' },
  { from: 'manual', to: 'agendaj2', label: 'Recupera', category: 'avanza' },
  { from: 'postagenda', to: 'agenda', label: 'Agenda', category: 'avanza' },
];

/** Transiciones salientes de una etapa. */
export function transitionsFrom(transitions: FunnelTransition[], from: string): FunnelTransition[] {
  return transitions.filter((t) => t.from === from);
}

/**
 * Categoría de una transición inferida por la banda de la etapa DESTINO:
 * pipeline→avanza · nutrición→nutricion · salidas→perdida. Así el usuario solo
 * elige "a dónde puede ir un lead" y el color/categoría se derivan solos —
 * no hay que configurar la categoría a mano.
 */
export function bandToCategory(band: StageBand | undefined): TransitionCategory {
  return band === 'salidas' ? 'perdida' : band === 'nutricion' ? 'nutricion' : 'avanza';
}

/**
 * Caminos de nutrición RECOMENDADOS (derivados de los defaults). El usuario casi
 * siempre conoce su pipeline pero deja la nutrición "abierta"; se la sugerimos
 * nosotros. Cada una, al agregarse, queda lista para enganchar mensajes
 * automáticos de WhatsApp/Email más adelante.
 */
export const NUTRITION_SUGGESTIONS: FunnelTransition[] = DEFAULT_TRANSITIONS.filter((t) => t.category === 'nutricion');

// ── Plantillas de funnel (arrancar sin dibujar nada) ─────────────────────────
export type FunnelTemplate = { id: string; name: string; description: string; stages: Stage[]; transitions: FunnelTransition[] };
const tplStage = (key: string, col: number): Stage => ({ ...DEFAULT_STAGES.find((s) => s.key === key)!, col });

export const FUNNEL_TEMPLATES: FunnelTemplate[] = [
  {
    id: 'highticket',
    name: 'High-ticket · 2 reuniones',
    description: 'Lead → R1 → R2 → cierre, con nutrición y salidas completas. El recomendado para agencias y coaching.',
    stages: DEFAULT_STAGES,
    transitions: DEFAULT_TRANSITIONS,
  },
  {
    id: 'simple',
    name: 'Simple · 1 reunión',
    description: 'Lead → una reunión → cierre. Para ventas de ciclo corto.',
    stages: [
      tplStage('lead', 0), tplStage('agenda', 1), tplStage('ganado', 2),
      tplStage('nutri', 0), tplStage('noshow', 1), tplStage('postreunion', 2),
      tplStage('noresp', 0), tplStage('perdido', 1),
    ],
    transitions: [
      { from: 'lead', to: 'agenda', label: 'Agendó', category: 'avanza' },
      { from: 'lead', to: 'nutri', label: 'No agendó', category: 'nutricion' },
      { from: 'lead', to: 'noresp', label: 'No responde', category: 'perdida' },
      { from: 'agenda', to: 'ganado', label: 'Cerró', category: 'avanza', asistioJ1: true },
      { from: 'agenda', to: 'noshow', label: 'No-show', category: 'nutricion', asistioJ1: false },
      { from: 'agenda', to: 'postreunion', label: 'No cerró aún', category: 'nutricion', asistioJ1: true },
      { from: 'agenda', to: 'perdido', label: 'No avanza', category: 'perdida', asistioJ1: true },
      { from: 'noshow', to: 'agenda', label: 'Reagenda', category: 'avanza' },
      { from: 'nutri', to: 'agenda', label: 'Agenda tardío', category: 'avanza' },
      { from: 'postreunion', to: 'ganado', label: 'Cerró', category: 'avanza' },
      { from: 'postreunion', to: 'perdido', label: 'Desiste', category: 'perdida' },
    ],
  },
  {
    id: 'directa',
    name: 'Venta directa · sin reunión',
    description: 'Lead → checkout/pago, sin llamada. Para ofertas low-ticket o e-commerce.',
    stages: [
      tplStage('lead', 0), tplStage('facturando', 1), tplStage('ganado', 2),
      tplStage('nutri', 0), tplStage('nopaga', 1),
      tplStage('noresp', 0), tplStage('perdido', 1),
    ],
    transitions: [
      { from: 'lead', to: 'facturando', label: 'Inició compra', category: 'avanza' },
      { from: 'lead', to: 'nutri', label: 'No avanza', category: 'nutricion' },
      { from: 'lead', to: 'noresp', label: 'No responde', category: 'perdida' },
      { from: 'facturando', to: 'ganado', label: 'Pagó', category: 'avanza' },
      { from: 'facturando', to: 'nopaga', label: 'No paga aún', category: 'nutricion' },
      { from: 'nopaga', to: 'ganado', label: 'Pagó tarde', category: 'avanza' },
      { from: 'nopaga', to: 'perdido', label: 'Desiste', category: 'perdida' },
      { from: 'nutri', to: 'facturando', label: 'Retoma', category: 'avanza' },
    ],
  },
];

/** Enriquece una etapa con su layout por defecto (banda/col/colores) si no lo trae. */
export function withLayout(s: Stage): Stage {
  if (s.band && s.col != null) return s;
  const d = STAGE_LAYOUT[s.key];
  if (d) return { ...d, ...s, band: s.band ?? d.band, col: s.col ?? d.col };
  return { band: 'nutricion', col: 0, ...s };
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
