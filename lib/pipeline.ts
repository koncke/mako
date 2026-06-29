// =============================================================================
// Pipeline del CRM — etapas, paleta y derivación (puro, compartido)
// =============================================================================
// Sin 'server-only': lo importan tanto el server (page) como el cliente
// (CrmBoard). Las funciones que tocan Supabase viven en lib/leads.ts.

import type { EstadoLead } from './leads';

export type StageTone =
  | 'neutral' | 'accent' | 'good' | 'bad' | 'warn' | 'info'
  | 'violet' | 'teal' | 'orange' | 'sky' | 'taupe' | 'rose' | 'indigo' | 'magenta';

// Banda (fila) del funnel: pipeline (Activo) · nutrición · salidas (Descartado).
export type StageBand = 'pipeline' | 'nutricion' | 'salidas';

// Etiqueta visible de cada banda (las KEYS internas no cambian).
export const BAND_LABEL: Record<StageBand, string> = { pipeline: 'Activo', nutricion: 'Nutrición', salidas: 'Descartado' };

// Tipo de una etapa de Activo (pipeline). Determina qué nutrición y qué salidas
// genera automáticamente el funnel — ver generateFunnel().
export type StageKind = 'entrada' | 'reunion' | 'grupo' | 'pago' | 'cierre' | 'paso';

export type Stage = {
  key: string;
  label: string;
  dot: string;
  tone: StageTone;        // color del chip en el Kanban del CRM
  custom?: boolean;
  kind?: StageKind;       // tipo de etapa de Activo (entrada/reunion/grupo/pago/cierre)
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

// Disparador de una transición: qué la hace ocurrir. Los que tienen una SEÑAL
// del sistema son automáticos (el lead avanza solo); 'manual' exige que un
// humano marque cómo quedó. `autoHoy` = si ya está cableado en la app hoy.
export type TransitionTrigger = 'formulario' | 'agenda' | 'pago' | 'asistencia' | 'tiempo' | 'manual';
export const TRIGGER: Record<TransitionTrigger, { label: string; auto: boolean; autoHoy: boolean }> = {
  formulario: { label: 'Formulario',       auto: true,  autoHoy: true },
  agenda:     { label: 'Agenda (Calendly)', auto: true,  autoHoy: true },
  pago:       { label: 'Pago',              auto: true,  autoHoy: false },
  asistencia: { label: 'Asistencia',        auto: true,  autoHoy: false },
  tiempo:     { label: 'Tiempo',            auto: true,  autoHoy: false },
  manual:     { label: 'Manual',            auto: false, autoHoy: false },
};

export type FunnelTransition = {
  from: string;                 // stage key de origen
  to: string;                   // stage key de destino
  label: string;                // texto de la flecha / botón
  category: TransitionCategory; // color
  trigger?: TransitionTrigger;  // qué la dispara (auto vs requiere humano)
  // Nutrición que corre SOLA (ej. Post Agenda: pre-reunión, para que asista) y
  // por eso NO es un resultado que el humano elige en "Datos sin marcar".
  auto?: boolean;
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

// ── Generación automática del funnel a partir de la fila de "Activo" ─────────
// El usuario solo edita el pipeline (Activo): orden + tipo de cada etapa. La
// nutrición y las salidas se DERIVAN. Si el usuario no quiere una nutrición
// sugerida, la "suprime" (set `suppressed` con claves `from>to`).

/** Tipo por defecto de las etapas canónicas del pipeline. */
export const PIPELINE_KIND: Record<string, StageKind> = { lead: 'entrada', agenda: 'reunion', agendaj2: 'reunion', facturando: 'pago', ganado: 'cierre' };
/** Pipeline (Activo) por defecto: las etapas canónicas con su tipo. */
export const DEFAULT_PIPELINE: Stage[] = DEFAULT_STAGES.filter((s) => s.band === 'pipeline').map((s) => ({ ...s, kind: PIPELINE_KIND[s.key] ?? 'paso' }));

/** Etapas de nutrición que no están en DEFAULT_STAGES (generadas por tipo). */
const NUTRI_EXTRA: Record<string, Stage> = {
  nocompro:    { key: 'nocompro',    label: 'Nutrición - No Compró',    dot: '#C7417B', tone: 'rose', band: 'nutricion' },
  nutridiaria: { key: 'nutridiaria', label: 'Nutrición diaria (grupo)', dot: '#1FA855', tone: 'teal', band: 'nutricion' },
};

/**
 * Deriva el funnel COMPLETO (Activo + Nutrición + Descartado) a partir del
 * pipeline ordenado (cada etapa con su `kind`) y el set de nutriciones suprimidas.
 *
 * Reglas por tipo de etapa:
 *  - entrada:  nutri "No agendó" · sale a Descalificado (no es avatar), Perdido
 *              (el setter lo pierde) y No responde.
 *  - reunion:  "Post Agenda" (preparación, SIEMPRE) · "No-show" · si hay otra
 *              reunión después → "Post Reunión"; si lo que sigue es pago/cierre →
 *              "Asistió, no compró". Sale a Perdido (se nutre) y Descalificado (terminal).
 *  - grupo:    nutrición diaria (ventana pre-evento) · se va del grupo.
 *  - pago:     "No paga aún".
 *  - cierre:   nada.
 * Descartado (Perdido/Descalificado/No responde) es fijo. Perdido se nutre
 * (vuelve a la 1ª reunión); Descalificado y No responde son terminales.
 */
export function generateFunnel(pipeline: Stage[], suppressed: string[] = []): { stages: Stage[]; transitions: FunnelTransition[] } {
  const sup = new Set(suppressed);
  const lib = (k: string): Stage | undefined => DEFAULT_STAGES.find((s) => s.key === k) ?? NUTRI_EXTRA[k];
  const stages: Stage[] = [];
  const transitions: FunnelTransition[] = [];
  const placed = new Set<string>();
  const col: Record<StageBand, number> = { pipeline: 0, nutricion: 0, salidas: 0 };
  const place = (s: Stage, band: StageBand) => { if (placed.has(s.key)) return; placed.add(s.key); stages.push({ ...s, band, col: col[band]++ }); };

  pipeline.forEach((p) => place(p, 'pipeline'));
  (['perdido', 'descal', 'noresp'] as const).forEach((k) => { const d = lib(k); if (d) place(d, 'salidas'); });
  // "Nutrición - Manual": catch-all manual SIEMPRE presente (opción del worklist).
  const manualDef = lib('manual'); if (manualDef) place(manualDef, 'nutricion');

  const meetings = pipeline.filter((p) => p.kind === 'reunion');
  const firstMeeting = meetings[0]?.key;
  const asist = (mKey: string, attended: boolean): Partial<FunnelTransition> => {
    const i = meetings.findIndex((m) => m.key === mKey);
    return i === 0 ? { asistioJ1: attended } : i === 1 ? { asistioJ2: attended } : {};
  };
  // Agrega nutrición from→nutriKey (si no está suprimida) + opcional recuperación.
  const nut = (from: string, nutriKey: string, label: string, trigger: TransitionTrigger, recover?: { to: string; label: string }, extra?: Partial<FunnelTransition>) => {
    if (sup.has(`${from}>${nutriKey}`)) return;
    const def = lib(nutriKey); if (!def) return;
    place(def, 'nutricion');
    transitions.push({ from, to: nutriKey, label, category: 'nutricion', trigger, ...extra });
    if (recover) transitions.push({ from: nutriKey, to: recover.to, label: recover.label, category: 'avanza', trigger: 'agenda' });
  };

  pipeline.forEach((p, i) => {
    const next = pipeline[i + 1];
    if (next) {
      // Disparador del avance: entrar a una reunión = agenda (o tiempo si viene
      // de un grupo/evento de fecha fija); salir de una reunión = asistencia;
      // entrar a pago/cierre = pago; entrar a un grupo = formulario (registro).
      const trig: TransitionTrigger =
        next.kind === 'reunion' ? (p.kind === 'grupo' ? 'tiempo' : 'agenda') :
        p.kind === 'reunion' ? 'asistencia' :
        next.kind === 'pago' || next.kind === 'cierre' ? 'pago' :
        next.kind === 'grupo' ? 'formulario' :
        'manual';
      transitions.push({ from: p.key, to: next.key, label: 'Avanza', category: 'avanza', trigger: trig, ...(p.kind === 'reunion' ? asist(p.key, true) : {}) });
    }
    switch (p.kind) {
      case 'entrada':
        nut(p.key, 'nutri', 'No agendó', 'tiempo', next ? { to: next.key, label: next.kind === 'reunion' ? 'Agenda tardío' : 'Retoma' } : undefined);
        transitions.push({ from: p.key, to: 'descal', label: 'No es tu avatar', category: 'perdida', trigger: 'manual' });
        transitions.push({ from: p.key, to: 'perdido', label: 'Setter lo pierde', category: 'perdida', trigger: 'manual' });
        transitions.push({ from: p.key, to: 'noresp', label: 'No responde', category: 'perdida', trigger: 'tiempo' });
        break;
      case 'grupo':
        // Nutrición diaria: corre sola mientras esperan el evento (auto).
        nut(p.key, 'nutridiaria', 'Nutrición diaria', 'tiempo', next ? { to: next.key, label: 'Llega al evento' } : undefined, { auto: true });
        transitions.push({ from: p.key, to: 'noresp', label: 'Se va del grupo', category: 'perdida', trigger: 'tiempo' });
        break;
      case 'reunion':
        // Post Agenda = nutrición PREVIA a la reunión (para que asista). Corre
        // sola; no es un resultado posterior que el humano elija (auto).
        nut(p.key, 'postagenda', 'Post Agenda', 'tiempo', { to: p.key, label: 'Asiste' }, { auto: true });
        nut(p.key, 'noshow', 'No-show', 'asistencia', firstMeeting ? { to: p.key, label: 'Reagenda' } : undefined, asist(p.key, false));
        if (next && next.kind === 'reunion') nut(p.key, 'postreunion', 'Post Reunión', 'manual', { to: next.key, label: 'Agenda siguiente' }, asist(p.key, true));
        else if (next && (next.kind === 'pago' || next.kind === 'cierre')) nut(p.key, 'nocompro', 'Asistió, no compró', 'manual', { to: next.key, label: 'Compra luego' }, asist(p.key, true));
        transitions.push({ from: p.key, to: 'perdido', label: 'Se perdió', category: 'perdida', trigger: 'manual', ...asist(p.key, true) });
        transitions.push({ from: p.key, to: 'descal', label: 'No califica', category: 'perdida', trigger: 'manual', ...asist(p.key, true) });
        break;
      case 'pago':
        nut(p.key, 'nopaga', 'No paga aún', 'pago', { to: p.key, label: 'Paga' });
        break;
    }
  });

  // Perdido SÍ se nutre/recupera (a diferencia de Descalificado, terminal).
  if (firstMeeting && !sup.has(`perdido>${firstMeeting}`)) transitions.push({ from: 'perdido', to: firstMeeting, label: 'Recupera', category: 'avanza', trigger: 'manual' });

  return { stages, transitions };
}

// ── Plantillas de funnel (arrancar sin configurar nada) ──────────────────────
// Una plantilla es solo un PIPELINE (la fila de Activo); la nutrición y las
// salidas las deriva generateFunnel.
export type FunnelTemplate = { id: string; name: string; description: string; pipeline: Stage[] };
const pk = (key: string, kind: StageKind): Stage => ({ ...DEFAULT_STAGES.find((s) => s.key === key)!, kind });

export const FUNNEL_TEMPLATES: FunnelTemplate[] = [
  {
    id: 'highticket',
    name: 'High-ticket · 2 reuniones',
    description: 'Lead → R1 → R2 → cierre. El recomendado para agencias y coaching.',
    pipeline: DEFAULT_PIPELINE,
  },
  {
    id: 'simple',
    name: 'Simple · 1 reunión',
    description: 'Lead → una reunión → cierre. Para ventas de ciclo corto.',
    pipeline: [pk('lead', 'entrada'), pk('agenda', 'reunion'), pk('ganado', 'cierre')],
  },
  {
    id: 'directa',
    name: 'Venta directa · sin reunión',
    description: 'Lead → checkout/pago, sin llamada. Para low-ticket o e-commerce.',
    pipeline: [pk('lead', 'entrada'), pk('facturando', 'pago'), pk('ganado', 'cierre')],
  },
  {
    id: 'vsl',
    name: 'VSL + Webinar (lanzamiento)',
    description: 'Landing → low-ticket → grupo de WhatsApp → webinar → oferta. Con nutrición pre y post evento.',
    pipeline: [
      { key: 'registro', label: 'Registro (landing)', dot: '#2F6DDB', tone: 'info', kind: 'entrada' },
      { key: 'grupo', label: 'Grupo WhatsApp', dot: '#1FA855', tone: 'teal', kind: 'grupo' },
      { key: 'webinar', label: 'Webinar', dot: '#E08A12', tone: 'accent', kind: 'reunion' },
      { key: 'checkout', label: 'Oferta / Checkout', dot: '#C8870C', tone: 'orange', kind: 'pago' },
      pk('ganado', 'cierre'),
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
