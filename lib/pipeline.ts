// =============================================================================
// Pipeline del CRM — etapas, paleta y derivación (puro, compartido)
// =============================================================================
// Sin 'server-only': lo importan tanto el server (page) como el cliente
// (CrmBoard). Las funciones que tocan Supabase viven en lib/leads.ts.

import type { EstadoLead } from './leads';
// Quién es reunión y cuál es su slot (R1/R2) lo decide UN solo módulo. El ciclo
// de imports entre los dos está documentado en la cabecera de funnel-etapas.ts:
// es inocuo porque acá solo se usan DENTRO de generateFunnel, nunca al cargar.
import { reunionesDe, slotPorIndice } from './funnel-etapas';
// Solo el TIPO del canal: `fase-diagnostico` no importa nada, así que no hay ciclo.
import type { CanalId } from './fase-diagnostico';

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

// Nutriciones NEGATIVAS (cambian la etapa; con deadline y desenlace posible). La
// nutrición POSITIVA (post-agenda / post-reunión) ya NO es etapa: es derivada
// (ver nutricionPositivaDe). Se deja 'noshow' legacy por compatibilidad.
export const NUTRI_KEYS = ['noshow_r1', 'noshow_r2', 'noshow_r3', 'nutri', 'nopaga', 'manual', 'reunion_excepcional', 'nocompro', 'reactivacion', 'noshow'];

/** MaKo como setter: corre las nutriciones AUTOMÁTICAS (No Agenda, No Show,
 *  Reactivación…). Todo lead de esas etapas lleva este setter (nunca vacío). */
export const MAKO_SETTER = 'MaKo';
/** Nutriciones AUTOMÁTICAS (las corre MaKo). 'manual' NO: la maneja un humano. */
export const NUTRI_AUTO_KEYS = ['nutri', 'noshow', 'noshow_r1', 'noshow_r2', 'noshow_r3', 'postagenda', 'postreunion', 'nopaga', 'nocompro', 'nutridiaria', 'reunion_excepcional', 'reactivacion'];

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

// ── Desenlaces posibles de una etapa (fuente única de "¿a dónde puede ir?") ──
//
// Antes cada pantalla armaba su propia lista filtrando `stages` a mano. Eso es lo
// que producía las dos quejas del dueño sobre el form "¿Qué hacer ahora?": la
// opción "ya avanzó" ofrecía Perdido / Descalificado / No responde, y la de "no
// asistió" NO ofrecía la nutrición No Show — la única respuesta correcta— porque
// el filtro sacaba la banda entera de nutrición. El funnel del workspace ya sabe
// las dos cosas; lo que faltaba era preguntárselo.

/** Un desenlace posible: la etapa destino + qué implica para la asistencia. */
export type OpcionSalida = {
  to: string;
  /** Label de la ETAPA destino (lo que el usuario reconoce en el tablero). */
  label: string;
  /** Label de la TRANSICIÓN ("Avanza", "Se perdió"): el matiz, como subtítulo. */
  sub: string;
  category: TransitionCategory;
  asistioJ1?: boolean;
  asistioJ2?: boolean;
};

const ORDEN_CATEGORIA: Record<TransitionCategory, number> = { avanza: 0, nutricion: 1, perdida: 2 };

/**
 * Los desenlaces que el funnel del workspace contempla para `from`, ordenados
 * avanza → nutrición → pérdida.
 *
 * `opts.asistio` es el HECHO que el humano ya declaró sobre la reunión que acaba
 * de pasar, y filtra la lista para que nunca se pueda elegir un destino que lo
 * contradiga:
 *   - `true`  → se sacan las transiciones de no-show; el flag viaja en true.
 *   - `false` → quedan las que no implican asistencia (no-show) más las salidas,
 *     con el flag FORZADO a false. Esto contradice a propósito lo que dice el
 *     funnel: `generateFunnel` marca `Se perdió` con `asist(p.key, true)` (línea
 *     ~273), y copiar ese flag es lo que hacía que dar por perdido un lead
 *     escribiera "asistió" a la reunión que nadie sabe si ocurrió. NO lo
 *     "arregles" volviendo a leer la transición.
 *   - `null`/ausente → no se toca la asistencia (pendientes que no vienen de una
 *     reunión, como la nutrición manual vencida).
 *
 * NUNCA devuelve []: si el funnel no tiene aristas salientes (pasa con 'manual'
 * en todo funnel generado) cae al layout — pipeline hacia adelante + salidas.
 */
export function salidasDeEtapa(
  stages: Stage[],
  transitions: FunnelTransition[],
  from: string,
  opts: { asistio?: boolean | null; cual?: 'r1' | 'r2' } = {},
): OpcionSalida[] {
  const asistio = opts.asistio ?? null;
  const cual = opts.cual ?? 'r1';
  const flagDe = (t: FunnelTransition) => (cual === 'r2' ? t.asistioJ2 : t.asistioJ1);
  // El hecho declarado gana sobre lo que diga la transición.
  const flags: Pick<OpcionSalida, 'asistioJ1' | 'asistioJ2'> =
    asistio == null ? {} : cual === 'r2' ? { asistioJ2: asistio } : { asistioJ1: asistio };
  const colDe = (k: string) => stageMetaOpt(stages, k)?.col ?? 0;

  const out: OpcionSalida[] = [];
  const vistos = new Set<string>();
  for (const t of transitionsFrom(transitions, from)) {
    // La nutrición que corre sola (Post Agenda, diaria) no es una decisión humana.
    if (t.auto) continue;
    if (t.to === from) continue;
    if (asistio === true && flagDe(t) === false) continue;
    if (asistio === false && flagDe(t) === true && t.category !== 'perdida') continue;
    // stageMetaOpt y no stageMeta: una key que el funnel ya no lista caería en
    // stages[0] y pintaríamos una etapa falsa.
    const meta = stageMetaOpt(stages, t.to);
    if (!meta) continue;
    if (vistos.has(t.to)) continue;
    vistos.add(t.to);
    out.push({ to: t.to, label: meta.label, sub: t.label, category: t.category, ...flags });
  }
  // ── Cierre directo: cerró en esta misma reunión, sin la siguiente ──
  // El funnel solo modela el camino de a un paso (agenda → agendaj2 → facturando),
  // así que "cerró en la R1" no era ofrecible y el usuario tenía que mover el lead
  // dos veces inventando una R2 que nunca existió. Se agregan las etapas de Activo
  // que están MÁS DE UN PASO adelante: son, por definición, las que se saltean una
  // reunión. Solo con asistencia declarada — no se cierra una venta en una reunión
  // que no ocurrió. El motivo de por qué no hubo R2 lo pide el server después
  // (StageMoveDialog: huboR2 → motivoNoR2), que es donde ya vive esa pregunta.
  if (asistio === true) {
    const colFrom = colDe(from);
    for (const s of stages) {
      if ((s.band ?? 'pipeline') !== 'pipeline') continue;
      if ((s.col ?? 0) <= colFrom + 1) continue;
      if (vistos.has(s.key) || s.key === from) continue;
      vistos.add(s.key);
      out.push({ to: s.key, label: s.label, sub: 'Cerró en esta reunión, sin la siguiente', category: 'avanza', ...flags });
    }
  }

  if (out.length) {
    out.sort((a, b) => ORDEN_CATEGORIA[a.category] - ORDEN_CATEGORIA[b.category] || colDe(a.to) - colDe(b.to));
    return out;
  }

  // Fallback por layout. Sin esto, un funnel custom sin transiciones cargadas
  // dejaría la pantalla sin una sola opción — el mismo agujero que la regla
  // "Prioridades nunca vacía" prohíbe en el board.
  const desde = stageMetaOpt(stages, from);
  const desdePipeline = (desde?.band ?? 'pipeline') === 'pipeline';
  return stages
    .filter((s) => {
      if (s.key === from || s.key === 'lead') return false;
      const band = s.band ?? 'pipeline';
      if (band === 'pipeline') return !desdePipeline || (s.col ?? 0) > (desde?.col ?? 0);
      return band === 'salidas';
    })
    .sort((a, b) => {
      const ca = ORDEN_CATEGORIA[bandToCategory(a.band)];
      const cb = ORDEN_CATEGORIA[bandToCategory(b.band)];
      return ca - cb || (a.col ?? 0) - (b.col ?? 0);
    })
    .map((s) => ({ to: s.key, label: s.label, sub: '', category: bandToCategory(s.band), ...flags }));
}

/**
 * La etapa a la que va un lead que NO se presentó, según el funnel del workspace.
 * null = el funnel no la modela (hay que preguntar).
 *
 * Se deduce por la TRANSICIÓN y nunca por una key literal: el grafo default usa
 * 'noshow' y todo funnel generado usa 'noshow_r1'/'noshow_r2'. Hardcodear
 * cualquiera de las dos rompe la otra.
 */
export function etapaNoShowDe(
  stages: Stage[],
  transitions: FunnelTransition[],
  from: string,
  cual: 'r1' | 'r2',
): string | null {
  const flagDe = (t: FunnelTransition) => (cual === 'r2' ? t.asistioJ2 : t.asistioJ1);
  const t = transitionsFrom(transitions, from).find((x) => flagDe(x) === false && !!stageMetaOpt(stages, x.to));
  return t ? t.to : null;
}

// ── CRM automático — reglas de auto-transición (metadata legible) ────────────
// El MOTOR vive en lib/crm-auto.ts (server). Acá solo la descripción para la tab
// Funnel: qué mueve un lead solo, con qué señal, y si pide confirmación humana.
export type AutoReglaMeta = { id: string; titulo: string; desde: string; senal: string; hacia: string; confirmar: boolean };
export const AUTO_REGLAS: AutoReglaMeta[] = [
  { id: 'T1', titulo: 'Detecta asistencia y No Show', desde: 'Agenda R1 / R2',        senal: 'unas horas después de la reunión busca la grabación en Fathom', hacia: 'Asistió (marca todo) · o No Show R1/R2',      confirmar: true },
  { id: 'T2', titulo: 'Lead que no agenda',           desde: 'Lead (Instant form)',   senal: 'pasan los días sin agendar: reciente vs. frío (hace mucho)',    hacia: 'Nutrición - No Agenda · o Reactivación si ya está frío', confirmar: false },
  { id: 'T3', titulo: 'Nutrición manual vencida',     desde: 'Nutrición - Manual',    senal: 'vence el plazo → revisa el chat de WhatsApp',                  hacia: 'No responde / Perdido · o Datos sin marcar',  confirmar: true },
  { id: 'T4', titulo: 'Cierre de R2',                 desde: 'R2 asistida',           senal: 'Fathom detecta que confirmó que va a arrancar',                hacia: 'Facturando',                                  confirmar: true },
  { id: 'T5', titulo: 'Completa datos sin marcar',    desde: 'Cualquier etapa',       senal: 'lee contrato · Calendly · Fathom · Calendar',                  hacia: 'Datos completados solos',                     confirmar: false },
  { id: 'T6', titulo: 'Reactivación de fríos',        desde: 'No responde / Perdido', senal: 'lleva tiempo enfriado o vuelve a dar señales',                 hacia: 'Nutrición - Reactivación',                    confirmar: true },
];

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
  nocompro:    { key: 'nocompro',    label: 'Nutrición - No Compró',    dot: '#C7417B', tone: 'rose',   band: 'nutricion' },
  nutridiaria: { key: 'nutridiaria', label: 'Nutrición diaria (grupo)', dot: '#1FA855', tone: 'teal',   band: 'nutricion' },
  // Nutrición NEGATIVA: No Show separado por reunión (R1/R2/R3).
  noshow_r1:   { key: 'noshow_r1',   label: 'Nutrición No Show R1',     dot: '#E8762B', tone: 'orange', band: 'nutricion' },
  noshow_r2:   { key: 'noshow_r2',   label: 'Nutrición No Show R2',     dot: '#E8762B', tone: 'orange', band: 'nutricion' },
  noshow_r3:   { key: 'noshow_r3',   label: 'Nutrición No Show R3',     dot: '#E8762B', tone: 'orange', band: 'nutricion' },
  // Reunión excepcional: intento extra tras no pagar (nutrición especial).
  reunion_excepcional: { key: 'reunion_excepcional', label: 'Reunión excepcional', dot: '#6A4BD8', tone: 'violet', band: 'nutricion' },
  // Reactivación: re-contacto de leads fríos (No responde / Perdido). MaKo decide
  // cuándo caen acá; de acá pueden reagendar y volver al pipeline.
  reactivacion: { key: 'reactivacion', label: 'Nutrición - Reactivación', dot: '#7A5AF0', tone: 'violet', band: 'nutricion' },
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

  // Keys de las reuniones, en orden. `reunionesDe` (no `etapasDeReunion`): acá NO
  // se cae al funnel por defecto — un pipeline sin reuniones no tiene ninguna, y
  // heredar 'agenda'/'agendaj2' le inventaría a este funnel un firstMeeting y sus
  // transiciones de recuperación.
  const meetings = reunionesDe(pipeline);
  const firstMeeting = meetings[0];
  const asist = (mKey: string, attended: boolean): Partial<FunnelTransition> => {
    const slot = slotPorIndice(meetings.indexOf(mKey));
    if (!slot) return {};  // de la 3ª reunión en adelante no hay columnas donde marcar
    return slot.cual === 'r1' ? { asistioJ1: attended } : { asistioJ2: attended };
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
      case 'reunion': {
        // Nutrición POSITIVA (post-agenda / post-reunión) NO es etapa: es una
        // ventana derivada mientras el lead avanza (ver nutricionPositivaDe). Acá
        // solo se generan las nutriciones NEGATIVAS (el lead NO avanzó).
        const mi = meetings.indexOf(p.key);
        const rn = Math.min(mi + 1, 3);
        // No Show separado por reunión: R1 / R2 / R3.
        nut(p.key, `noshow_r${rn}`, `No Show R${rn}`, 'asistencia', firstMeeting ? { to: p.key, label: 'Reagenda' } : undefined, asist(p.key, false));
        if (next && (next.kind === 'pago' || next.kind === 'cierre')) nut(p.key, 'nocompro', 'Asistió, no compró', 'manual', { to: next.key, label: 'Compra luego' }, asist(p.key, true));
        transitions.push({ from: p.key, to: 'perdido', label: 'Se perdió', category: 'perdida', trigger: 'manual', ...asist(p.key, true) });
        transitions.push({ from: p.key, to: 'descal', label: 'No califica', category: 'perdida', trigger: 'manual', ...asist(p.key, true) });
        break;
      }
      case 'pago':
        nut(p.key, 'nopaga', 'No paga aún', 'pago', { to: p.key, label: 'Paga' });
        // Reunión excepcional: intento extra tras no pagar (nutrición ESPECIAL,
        // no avanza el pipeline). Desde "No paga aún" → reunión extra; de ahí sale
        // a No Show R3 (no asiste), de vuelta al pago (retoma) o a Perdido.
        if (!sup.has(`nopaga>reunion_excepcional`)) {
          const re = lib('reunion_excepcional');
          if (re) {
            place(re, 'nutricion');
            transitions.push({ from: 'nopaga', to: 'reunion_excepcional', label: 'Reunión excepcional', category: 'nutricion', trigger: 'manual' });
            const ns3 = lib('noshow_r3');
            if (ns3) { place(ns3, 'nutricion'); transitions.push({ from: 'reunion_excepcional', to: 'noshow_r3', label: 'No Show R3', category: 'nutricion', trigger: 'asistencia' }); }
            transitions.push({ from: 'reunion_excepcional', to: p.key, label: 'Retoma el pago', category: 'avanza', trigger: 'manual' });
            transitions.push({ from: 'reunion_excepcional', to: 'perdido', label: 'Se perdió', category: 'perdida', trigger: 'manual' });
          }
        }
        break;
    }
  });

  // Perdido SÍ se nutre/recupera (a diferencia de Descalificado, terminal).
  if (firstMeeting && !sup.has(`perdido>${firstMeeting}`)) transitions.push({ from: 'perdido', to: firstMeeting, label: 'Recupera', category: 'avanza', trigger: 'manual' });

  // Reactivación: re-contacto de leads fríos (No responde / Perdido). El motor del
  // CRM automático los mueve acá por tiempo/re-engagement (ver lib/crm-auto.ts); de
  // la reactivación pueden reagendar y volver a la 1ª reunión.
  const reac = lib('reactivacion');
  if (reac && firstMeeting) {
    let usada = false;
    (['noresp', 'perdido'] as const).forEach((from) => {
      if (sup.has(`${from}>reactivacion`)) return;
      place(reac, 'nutricion'); usada = true;
      transitions.push({ from, to: 'reactivacion', label: 'Reactivar', category: 'nutricion', trigger: 'tiempo' });
    });
    if (usada) {
      transitions.push({ from: 'reactivacion', to: firstMeeting, label: 'Reagenda', category: 'avanza', trigger: 'agenda' });
      transitions.push({ from: 'reactivacion', to: 'noresp', label: 'No responde', category: 'perdida', trigger: 'tiempo' });
    }
  }

  return { stages, transitions };
}

// ── Cómo ENTRA un lead ───────────────────────────────────────────────────────
/**
 * EL EJE QUE FALTABA. Un funnel modelado solo por sus etapas describe el
 * RECORRIDO y no dice nada de los ACTIVOS que lo hacen posible: si hay landing,
 * si hay video, si existe un formulario de anuncio, si la gente agenda sola. El
 * pipeline es lo que le pasa al lead DESPUÉS; esto es cómo llegó.
 *
 * ⚠️ El síntoma que lo trajo: una clienta que prospecta en frío por WhatsApp
 * grabó, porque el sistema se lo pidió, un audio que arranca «vi que dejaste tus
 * datos en el anuncio». Sus leads tienen `meta_lead_id = 0` y `origen_lead` NULL:
 * ninguno dejó sus datos en ningún lado. Y no fue por falta de contexto — el
 * funnel textual YA viajaba en el prompt (`resumenFunnel`); perdía contra el
 * bullet imperativo del catálogo de audios, quince líneas más abajo. Por eso el
 * consumo de este eje es DETERMINISTA (el guion se arma en código) y encima
 * manda una prohibición explícita al modelo. Ver `guionDe` en lib/audios-paso.ts.
 *
 * ⚠️ NO vive adentro de `Stage`, a propósito, y no es una preferencia de estilo:
 * `applyTemplate` en app/funnel/FunnelEditor.tsx hace `setPipeline(tpl.pipeline)`
 * y `pk()` reconstruye cada Stage desde DEFAULT_STAGES. Un campo colgado del
 * Stage sobrevive por spread accidental y se borra con UN clic en «Aplicar
 * plantilla», sin error y sin log. Vive en `funnel_config.data.entradas`.
 */
export type EntradaId = 'formulario_anuncio' | 'landing' | 'agenda_sola' | 'chat_entrante' | 'chat_saliente';

export type EntradaDef = {
  id: EntradaId;
  label: string;
  /** El subtexto de la tarjeta. Es lo que desambigua, así que se escribe con ejemplos. */
  desc: string;
  /**
   * ¿Existe un dato que él dejó? Gobierna dos cosas que hoy están hardcodeadas:
   * si el audio puede decir «de dónde llegó tu dato», y si «no me acuerdo de
   * haber dejado mis datos» es una objeción fuera de tema o la reacción más
   * probable del ensayo.
   */
  dejoDatos: boolean;
  /** Quién dio el primer paso. Decide si el primer audio se presenta o retoma. */
  empieza: 'lead' | 'negocio';
  /** La premisa del lead en los escenarios del ensayo. Segunda persona, como le habla el bot. */
  quien: string;
  /** El objetivo de campaña de Meta que corresponde. Lo consume campaign-structurer. */
  objetivoMeta: 'leads_instant' | 'leads_web' | 'mensajes' | 'trafico';
};

/**
 * ⚠️ Son CINCO y no más, y las dos que faltan son deliberadas:
 *
 * - NO hay `referido`: un audio de referido tiene que decir QUIÉN lo refirió, y
 *   eso es una variable por lead. Los guiones de audio no admiten variables (la
 *   restricción está escrita en la cabecera de lib/audios-paso.ts). Prospección,
 *   lista fría, campaña de mensajes y el referido que contactás vos caen todos en
 *   `chat_saliente`, que es la verdad a nivel de la frase que se escucha.
 * - NO hay `carga_manual`: `origen_lead = NULL` es un tacho (alta a mano, import,
 *   lead creado desde el inbox), no una señal. Una entrada se afirma con evidencia
 *   positiva, nunca por descarte.
 */
export const ENTRADAS: Record<EntradaId, EntradaDef> = {
  formulario_anuncio: {
    id: 'formulario_anuncio', label: 'Dejan sus datos en el anuncio',
    desc: 'El formulario de Facebook o Instagram, sin salir de la app.',
    dejoDatos: true, empieza: 'lead', objetivoMeta: 'leads_instant',
    quien: 'dejaste tus datos en un anuncio y todavía no hablaste con nadie',
  },
  landing: {
    id: 'landing', label: 'Llenan un formulario en tu página',
    desc: 'Una landing, tu web o un lead magnet que se descarga.',
    dejoDatos: true, empieza: 'lead', objetivoMeta: 'leads_web',
    quien: 'llenaste un formulario en su página y todavía no hablaste con nadie',
  },
  agenda_sola: {
    id: 'agenda_sola', label: 'Agendan solos, desde un link',
    desc: 'Eligen horario sin hablar con nadie antes.',
    dejoDatos: true, empieza: 'lead', objetivoMeta: 'trafico',
    quien: 'agendaste directamente desde un link, sin hablar con nadie antes',
  },
  chat_entrante: {
    id: 'chat_entrante', label: 'Te escriben ellos primero',
    desc: 'Por WhatsApp, un DM o un comentario.',
    dejoDatos: false, empieza: 'lead', objetivoMeta: 'mensajes',
    quien: 'le escribiste tú primero, por WhatsApp, y todavía no te contestó nadie',
  },
  chat_saliente: {
    id: 'chat_saliente', label: 'Le escribes tú primero',
    desc: 'Prospección, una lista, una campaña de mensajes.',
    dejoDatos: false, empieza: 'negocio', objetivoMeta: 'mensajes',
    quien: 'no lo conocés de ningún lado: te escribe él, de la nada, sin que hayas pedido nada',
  },
};

export const esEntrada = (x: unknown): x is EntradaId =>
  typeof x === 'string' && Object.prototype.hasOwnProperty.call(ENTRADAS, x);

/** Dónde y cuándo ocurre el encuentro de fecha fija. `dias`: 0=domingo … 6=sábado. */
export type EventoFunnel = { lugar: string | null; dias: number[]; hora: string | null; tz: string | null; cupo: number | null };

// ⚠️ EL SANEO VIVE ACÁ, no en lib/leads.ts, y no es una preferencia de orden: ese
// módulo tiene `server-only`, así que ningún test lo puede importar — y esto es
// exactamente lo que decide si un prompt afirma «dejaste tus datos en el anuncio»
// sobre alguien que nunca los dejó. Es el mismo criterio que `exigirClienteDePrueba`
// y `lib/model-catalogo.ts`: la regla que más duele si falla va donde se pueda probar.

/** Whitelist + dedup + tope. Cualquier basura cae a `[]`, que es «no declarado». */
export function parseEntradas(v: unknown): EntradaId[] {
  if (!Array.isArray(v)) return [];
  const out: EntradaId[] = [];
  for (const x of v) if (esEntrada(x) && !out.includes(x)) out.push(x);
  return out.slice(0, 3);
}

export function parseEvento(v: unknown): EventoFunnel | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const txt = (x: unknown): string | null => (typeof x === 'string' && x.trim() ? x.trim().slice(0, 200) : null);
  const dias = Array.isArray(o.dias)
    ? [...new Set(o.dias.filter((d): d is number => typeof d === 'number' && Number.isInteger(d) && d >= 0 && d <= 6))]
    : [];
  const cupo = typeof o.cupo === 'number' && Number.isFinite(o.cupo) && o.cupo > 0 ? Math.floor(o.cupo) : null;
  const hora = typeof o.hora === 'string' && /^\d{1,2}:\d{2}$/.test(o.hora.trim()) ? o.hora.trim() : null;
  const ev: EventoFunnel = { lugar: txt(o.lugar), dias, hora, tz: txt(o.tz), cupo };
  // Un evento sin un solo dato no es un evento: sería una caja vacía que igual
  // hace que la pantalla y los guiones se comporten como si hubiera uno.
  return ev.lugar || ev.dias.length || ev.hora || ev.cupo != null ? ev : null;
}

/** Un pipeline guardado tiene que ser una lista de etapas con clave; si no, no es un pipeline. */
export function sanearPipeline(v: unknown): Stage[] | null {
  if (!Array.isArray(v) || !v.length) return null;
  const ok = v.filter((s): s is Stage => !!s && typeof s === 'object' && typeof (s as Stage).key === 'string' && !!(s as Stage).key);
  return ok.length ? ok : null;
}

/**
 * El MERGE del jsonb de `funnel_config.data`, separado de la escritura para que
 * se pueda probar sin Supabase.
 *
 * ⚠️ Existe porque `saveFunnel` escribía `data: { pipeline, suppressed }` —
 * reemplazo total— y el editor de /funnel autoguarda en cada tecla. Cualquier
 * otra clave del jsonb se borraba sola con un tipeo. Hoy `data.umbrales` (que
 * lib/crm-auto.ts sí lee) no está escrito en ninguna fila, así que el daño no
 * había ocurrido todavía; con `entradas` y `evento` viviendo ahí, dejaba de ser
 * latente el primer día.
 */
export function mergeFunnelData(
  previo: unknown,
  pipeline: Stage[],
  suppressed: string[],
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  const base = previo && typeof previo === 'object' && !Array.isArray(previo) ? (previo as Record<string, unknown>) : {};
  return { ...base, pipeline, suppressed, ...(extra ?? {}) };
}

// ── Dónde se ENCUENTRAN (derivado del canal, nunca preguntado aparte) ────────
/**
 * La naturaleza del encuentro NO es un campo: se DERIVA del canal de cierre que
 * el cliente ya declara. Preguntarla otra vez sería un segundo lugar para el
 * mismo dato — y el canal ya la determina por completo.
 *
 * Lo que cambia con cada valor, que es la prueba de que el eje se gana su lugar:
 *  · `modalidad` — un encuentro presencial se va a un LUGAR; el audio no puede
 *    decir «te paso el link» y sí tiene que poder decir la dirección.
 *  · `formato` — a un taller grupal no se le pide grabación de Fathom ni tiene
 *    sentido concluir No Show por ausencia de video.
 *  · `agenda` — si la fecha la pone el lead, hay un audio de «agendaste»; si la
 *    pone el negocio (el taller es siempre el mismo miércoles), ese audio no
 *    existe y el que sí existe es el de «nos vemos el miércoles».
 */
export type Encuentro = { modalidad: 'remoto' | 'presencial'; formato: 'uno_a_uno' | 'grupal'; agenda: 'lead' | 'fija' };

export const ENCUENTRO_POR_CANAL: Record<CanalId, Encuentro | null> = {
  llamadas: { modalidad: 'remoto', formato: 'uno_a_uno', agenda: 'lead' },
  webinar: { modalidad: 'remoto', formato: 'grupal', agenda: 'fija' },
  presencial: { modalidad: 'presencial', formato: 'grupal', agenda: 'fija' },
  conversaciones: null,
  carrito: null,
};

const encuentroDe = (c: CanalId | null | undefined): Encuentro | null => (c ? ENCUENTRO_POR_CANAL[c] ?? null : null);

/**
 * ¿Se espera que este encuentro deje grabación? Solo un 1:1 remoto Y con Fathom
 * conectado. Se pasa la conexión como parámetro —estado vivo, no recordado— para
 * que esto siga siendo puro y testeable.
 *
 * ⚠️ El default importa: con `canal` sin declarar devuelve lo mismo que hoy
 * (grabable si Fathom está conectado). Un campo sin declarar no puede AFIRMAR un
 * hecho nuevo, pero tampoco puede APAGAR una automatización que ya funciona.
 */
export const seGraba = (canal: CanalId | null | undefined, fathomConectado: boolean): boolean => {
  if (!fathomConectado) return false;
  const e = encuentroDe(canal);
  if (!e) return !canal;  // sin canal declarado, se comporta como siempre
  return e.modalidad === 'remoto' && e.formato === 'uno_a_uno';
};

/** ¿La fecha del encuentro la elige el lead? (Calendly, link de agenda) */
export const agendaElLead = (canal: CanalId | null | undefined): boolean => encuentroDe(canal)?.agenda === 'lead';

/** ¿El encuentro tiene fecha FIJA que pone el negocio? (el taller de todos los miércoles) */
export const fechaFijaDelEvento = (canal: CanalId | null | undefined): boolean => encuentroDe(canal)?.agenda === 'fija';

// ── Plantillas de funnel (arrancar sin configurar nada) ──────────────────────
// Una plantilla es solo un PIPELINE (la fila de Activo); la nutrición y las
// salidas las deriva generateFunnel.
// `suppressed` viaja con la plantilla porque hay pipelines que generan nutrición
// que no aplica: uno con una sola sesión y `kind:'pago'` siembra igual «Reunión
// excepcional» y «No Show R3» (ver generateFunnel), y el cliente las ve el día 1.
export type FunnelTemplate = { id: string; name: string; description: string; pipeline: Stage[]; suppressed?: string[] };
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
  {
    // El único canal cuya operación ENTERA es la conversación, y el único sin plantilla
    // hasta ahora. Las dos con reunión están descartadas por definición («sin llamada»)
    // y `directa` va del lead al pago sin ningún lugar donde parar la charla: todos los
    // leads con los que estás hablando quedarían mezclados con los que nadie tocó.
    // ⚠️ 'conversando' es la única clave de este archivo que no conoce `deriveStageKey`
    // (que habla 11 claves canónicas derivadas de fechas y estado). O sea que a esta
    // etapa se llega SOLO moviendo el lead a mano — que es lo correcto: la abre una
    // persona o MaKo, no un webhook. Y `kind: 'paso'` es deliberado: no tiene case en
    // el switch de generateFunnel, así que no inventa nutrición, y `funnelReqInfo` le da
    // nivel 0, así que mover un lead ahí no dispara ningún requisito.
    id: 'conversaciones',
    name: 'Conversaciones · sin llamada',
    description: 'Lead → conversación abierta → cobro. Para quien vende por WhatsApp o DM.',
    pipeline: [
      pk('lead', 'entrada'),
      { key: 'conversando', label: 'Conversación abierta', dot: '#1FA855', tone: 'teal', kind: 'paso' },
      pk('facturando', 'pago'),
      pk('ganado', 'cierre'),
    ],
  },
  {
    // Chatear hasta llevarlo a una sesión presencial gratuita, y cerrar ahí. Es
    // `conversaciones` con una parada más: la sesión.
    //
    // ⚠️ LA SESIÓN USA LA CLAVE CANÓNICA `agenda`, solo renombrada, y eso es lo
    // que hace barata a esta plantilla. `deriveStageKey` la conoce, `slotPorIndice(0)`
    // le da `fecha_junta_1`/`asistio_j1`, `funnelReqInfo` le da nivel 1, y las
    // cohortes y /comercial la cuentan. O sea que «fue a la sesión» —la bisagra del
    // negocio de quien vende así— es un hito de primera sin escribir una línea:
    // `fecha_junta_1` es a qué fecha lo invitaste y `asistio_j1` si apareció.
    // Inventar una clave nueva (`sesion`) la deja fuera de `deriveStageKey` y hace
    // caer `effStage` a la PRIMERA etapa — la falla ya documentada de la plantilla
    // `vsl`. Y usar `kind:'grupo'` en vez de `reunion` borra la asistencia entera,
    // porque `reunionesDe` filtra solo por `kind === 'reunion'`.
    id: 'presencial',
    name: 'Sesión presencial · sin llamada',
    description: 'Lead → conversación → sesión presencial gratuita → cobro. Para quien cierra en persona.',
    pipeline: [
      pk('lead', 'entrada'),
      { key: 'conversando', label: 'Conversación abierta', dot: '#1FA855', tone: 'teal', kind: 'paso' },
      { ...pk('agenda', 'reunion'), label: '1ª sesión sin costo' },
      pk('facturando', 'pago'),
      pk('ganado', 'cierre'),
    ],
    // Sin esto, `kind:'pago'` le siembra «Reunión excepcional» y «No Show R3» a un
    // funnel de UNA sola sesión, y el cliente las ve en su primer día.
    suppressed: ['nopaga>reunion_excepcional'],
  },
]

/**
 * QUÉ FUNNEL LE TOCA A CADA CANAL DE VENTA.
 *
 * ⚠️ ESTO NO EXISTÍA, y esa era la falla: `app/api/onboarding/route.ts` guardaba el canal
 * que el cliente declaraba y después sembraba `FUNNEL_TEMPLATES[0]` —el de dos
 * reuniones— para todos. El canal quedaba escrito y no lo leía nadie. Un e-commerce que
 * vende por carrito arrancaba con Agenda R1, Agenda R2, tres etapas de No Show y avisos
 * de «La Reunión 2 ya pasó».
 *
 * LO QUE DECIDE EL MAPEO NO ES EL NOMBRE DEL CANAL SINO CUÁNTAS ETAPAS `kind: 'reunion'`
 * corresponden, porque es lo único que se consume: `reunionesDe()` y `funnelReqInfo()`
 * leen solo eso, y de ahí salen los requisitos para mover un lead, la nutrición de No
 * Show, los huecos de secuencias y hasta qué audios se le piden al dueño en el
 * onboarding del Chat Agent.
 *
 * ⚠️ Y EQUIVOCARSE PARA ARRIBA NO ES EL LADO SEGURO, aunque lo parezca. Con dos
 * reuniones, para marcar Ganado el wizard exige fecha, asistencia y Fathom de una R2 que
 * no existe: el cliente NO PUEDE cerrar el lead sin inventarla. Sub-pedir, en cambio, se
 * arregla con un click en /funnel. Por eso 'llamadas' —cuyo texto dice «agendas una
 * llamada y cierras la venta ahí», o sea UNA— arranca en `simple` y no en `highticket`.
 * Evidencia de que sobre-pedir molesta de verdad: `salidasDeEtapa` tiene un bloque
 * entero llamado «Cierre directo: cerró en esta misma reunión, sin la siguiente», que
 * existe porque la gente tenía que mover el lead dos veces inventando una R2.
 *
 * `Record<CanalId, …>` es a propósito: el compilador exige la fila cuando se agrega un
 * canal. Y `tests/funnel-por-canal.test.ts` verifica que cada id exista de verdad en
 * FUNNEL_TEMPLATES — el tipo no puede ver eso.
 */
export const TEMPLATE_POR_CANAL: Record<CanalId, string> = {
  llamadas: 'simple',
  conversaciones: 'conversaciones',
  carrito: 'directa',
  webinar: 'vsl',
  presencial: 'presencial',
};

/**
 * ¿Dos pipelines son el MISMO? Comparación estructural y estricta: misma cantidad de
 * etapas, en el mismo orden, con la misma clave, la misma etiqueta y el mismo `kind`.
 *
 * Existe para poder preguntar «¿este cliente ya tocó su funnel?» sin adivinar. No hay
 * historial de funnel en ningún lado —`funnel_config` guarda un solo `data` que se pisa
 * en cada guardado, sin versiones ni auditoría—, así que la única forma honesta de
 * saber si alguien lo editó es comparar contra lo que se le habría dado.
 *
 * ⚠️ Estricta A PROPÓSITO: cualquier diferencia, hasta un label cambiado a mano, cuenta
 * como «lo editaron». Si mañana alguien toca una etiqueta de DEFAULT_STAGES, todos los
 * funnels viejos dejan de ser idénticos y nadie los va a pisar. Ese falso negativo es
 * el lado seguro: no sembrar de más nunca rompió nada; sembrar encima de un funnel en
 * uso mueve leads de etapa en silencio.
 *
 * Se ignoran `dot`, `tone`, `band` y `col`: son layout del Kanban, no la forma del
 * embudo, y `withLayout` los rellena solo.
 */
export function mismoPipeline(a: Stage[] | null | undefined, b: Stage[] | null | undefined): boolean {
  const x = a ?? [], y = b ?? [];
  if (x.length !== y.length) return false;
  return x.every((s, i) => s.key === y[i].key && s.label === y[i].label && (s.kind ?? 'paso') === (y[i].kind ?? 'paso'));
}

/** La plantilla de un canal, o `null` si el canal no existe. Falla CERRADO a propósito:
 *  un canal desconocido —el endpoint del hub no lo valida contra CANALES— no siembra
 *  nada en vez de caer a una plantilla por default, que es como nació este problema. */
export function templateDeCanal(canal: string | null | undefined): FunnelTemplate | null {
  if (!canal) return null;
  const id = (TEMPLATE_POR_CANAL as Record<string, string>)[canal];
  return id ? FUNNEL_TEMPLATES.find((t) => t.id === id) ?? null : null;
}

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

/**
 * Igual que stageMeta pero SIN inventar: si la key no existe devuelve undefined.
 * Es lo que necesita el historial — ahí caer a la 1ª etapa no es "un default",
 * es mostrar un dato falso (pintaba todo el recorrido como "Lead (Instant form)").
 */
export function stageMetaOpt(stages: Stage[], key: string): Stage | undefined {
  // Cae a las libs para resolver el label de keys legacy (noshow_r1/postagenda/…)
  // que el funnel del workspace ya no lista.
  return stages.find((s) => s.key === key) || DEFAULT_STAGES.find((s) => s.key === key) || NUTRI_EXTRA[key];
}

export function stageMeta(stages: Stage[], key: string): Stage {
  return stageMetaOpt(stages, key) || stages[0];
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
  if (l.asistio_j1 === false) return 'noshow_r1';
  if (l.fecha_junta_2) {
    if (l.asistio_j2 === true) return 'facturando';
    if (l.asistio_j2 === false) return 'noshow_r2';
    return 'agendaj2';
  }
  if (l.fecha_agenda || l.fecha_junta_1) return 'agenda';
  if (l.nutricion_realizada) return 'nutri';
  return 'lead';
}

/** Etapa efectiva: override manual si existe, si no la derivada. */
export function pipelineStageOf(l: StageDerivable): string {
  return l.pipeline_stage || deriveStageKey(l);
}

// ─────────────────────────────────────────────────────────────────────────────
// Nutrición POSITIVA — ventana derivada, NO es una etapa
// ─────────────────────────────────────────────────────────────────────────────
// El lead que avanza no "cae" en una etapa de nutrición: sigue en Agenda R1/R2 y
// atraviesa una ventana INFORMATIVA que termina en la fecha de su próxima
// reunión. Solo si NO avanza (no-show / no reagenda) pasa a una nutrición
// NEGATIVA (cambio de etapa real, con deadline y desenlace posible).
//   - post-agenda:  agendó R1, espera la R1  → hasta fecha_junta_1
//   - post-reunion: asistió R1, espera la R2 → hasta fecha_junta_2

export type NutriPositiva = { tipo: 'post-agenda' | 'post-reunion'; hasta: string; dias: number };

function diasHastaISO(hoyISO: string, hastaISO: string): number {
  const [hy, hm, hd] = hoyISO.slice(0, 10).split('-').map(Number);
  const [ty, tm, td] = hastaISO.slice(0, 10).split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(hy, hm - 1, hd)) / 86400000);
}

/**
 * Ventana de nutrición positiva del lead (o null si no está en una). Derivada:
 * no cambia la etapa. `hasta` = fecha de la próxima reunión; `dias` = cuántos
 * faltan (0 = es hoy). Solo aplica a leads abiertos con reunión futura sin marcar.
 */
export function nutricionPositivaDe(l: StageDerivable, hoyISO: string): NutriPositiva | null {
  if (l.estado_lead !== 'abierto') return null;
  const hoy = hoyISO.slice(0, 10);
  // Post-reunión R1: asistió a la R1 y tiene R2 futura todavía sin marcar.
  if (l.asistio_j1 === true && l.fecha_junta_2 && l.asistio_j2 == null && l.fecha_junta_2.slice(0, 10) >= hoy) {
    return { tipo: 'post-reunion', hasta: l.fecha_junta_2.slice(0, 10), dias: diasHastaISO(hoy, l.fecha_junta_2) };
  }
  // Post-agenda: tiene la R1 (o el agendamiento) a futuro y todavía no la marcó.
  const r1 = l.fecha_junta_1 ?? l.fecha_agenda;
  if (l.asistio_j1 == null && r1 && r1.slice(0, 10) >= hoy) {
    return { tipo: 'post-agenda', hasta: r1.slice(0, 10), dias: diasHastaISO(hoy, r1) };
  }
  return null;
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
