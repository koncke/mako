// =============================================================================
// retro-reporte — CONTRATO del reporte compuesto de una Retro (v3)
// =============================================================================
// Tipos PUROS (sin 'server-only'): los importa el pipeline (server), el
// componente RetroReport (client, como types) y el demo. El "cerebro" de MaKo
// compone un RetroReporte eligiendo qué findings mostrar, la tesis, la fuga en
// plata y el plan; el CÓDIGO aporta charts (series reales), seguimiento,
// cobertura y el log del proceso. Se persiste entero en retros.reporte (jsonb).
//
// Diseño de referencia: "Retro MaKo (3).dc.html" — 3 vistas (Overview · Plan ·
// Detail) + modal de hallazgo (evidencia num/bars/spark) + modal de acción
// (aceptar/posponer/descartar con motivo) + seguimiento del retro pasado +
// banda de cobertura de datos.
// =============================================================================

// ── Áreas y herramientas ─────────────────────────────────────────────────────

export type AreaId = 'adquisicion' | 'nutricion' | 'conversion' | 'creativos' | 'revenue' | 'experimentos';
export type SaludArea = 'good' | 'warn' | 'bad' | 'gris';

/** Herramientas/tabs del Detail (id estable → label). */
export type ToolId =
  | 'market' | 'crm' | 'closing' | 'script' | 'graphics' | 'crosses'
  | 'vsl' | 'landing' | 'offer' | 'cs' | 'todo' | 'chats';

export const TOOL_LABEL: Record<ToolId, string> = {
  market: 'Market Analyst', crm: 'CRM', closing: 'Closing Analyst', script: 'Ads Analyst',
  graphics: 'Graphics', crosses: 'Cruces', vsl: 'VSL Analyst', landing: 'Landing Analyst',
  offer: 'Offer Analyst', cs: 'CS Analyst', todo: 'To-do', chats: 'Chats (WA, Email, IG)',
};

/** Ruta real de la app para "Ver en {tab} →" (null = todavía no existe la tab). */
export const TOOL_HREF: Partial<Record<ToolId, string>> = {
  market: '/marketing', crm: '/crm', closing: '/closing', script: '/ads-analyst',
  graphics: '/dashboard', todo: '/plan',
};

// ── Evidencia (el bloque visual del modal de hallazgo) ───────────────────────

export type TonoEv = 'good' | 'bad' | 'warn' | 'blue' | 'gris';

export type EvNum = { type: 'num'; value: string; label: string; tone: TonoEv };
export type EvBarRow = { label: string; val: string; pct: number; strong?: boolean; tone: TonoEv | 'gray' };
export type EvBars = { type: 'bars'; rows: EvBarRow[] };
export type EvSpark = { type: 'spark'; vals: number[]; tone: TonoEv; note: string };
export type Evidencia = EvNum | EvBars | EvSpark;

// ── Hallazgos ────────────────────────────────────────────────────────────────

export type FindingTipo = 'hallazgo' | 'cruce' | 'anomalia';

export type RetroFinding = {
  id: string;                 // estable dentro del reporte (f1, f2…)
  tipo: FindingTipo;
  area: AreaId;
  tool: ToolId;               // en qué herramienta del Detail vive
  cross?: string;             // solo cruces: "Nutrición × Conversión"
  ev: Evidencia;
  short: string;              // para la card (1 línea, con el número)
  insight: string;            // para el modal (1-2 líneas)
  source: string;             // "CRM + Closing · nov a jun"
  tab: string;                // label de la tab origen ("CRM")
  recId?: string;             // id del item del plan que nace de este hallazgo
};

// ── Plan (Experiments + To-dos) ──────────────────────────────────────────────

export type PlanStatus = {
  estado: 'aceptada' | 'pospuesta' | 'descartada';
  motivo?: string;            // motivo del descarte
  experimento_id?: number;    // si aceptar creó un experimento real
  tarea_id?: number;          // si aceptar creó una tarea real (experimento_tareas).
                              // Es lo que deja al seguimiento leer si la tarea se HIZO
                              // en vez de asumir que "aceptada" = hecha.
  at: string;                 // ISO
};

export type RetroPlanItem = {
  id: string;
  kind: 'exp' | 'tarea';
  destacado?: boolean;        // la carta estrella (borde azul)
  prio?: 'alta' | 'media' | 'baja';
  origen: string;             // "Nace del cruce Nutrición × Conversión"
  titulo: string;
  why: string;
  impacto: string;            // "~$18k/período"
  chain?: string[];           // tareas "para poder probarlo" (se crean al aceptar)
  experimento?: {             // spec para crear el experimento real al aceptar
    hipotesis: string; cambio: string; metrica: string; direccion: 'subir' | 'bajar';
    objetivo_valor: number | null; criterio_exito: string; ventana_dias: number;
  };
  tarea?: { detalle: string };
  status?: PlanStatus;        // se persiste al actuar (no lo pone el cerebro)
  /** Id del experimento que creó una aceptación previa. Sobrevive al "deshacer"
   *  para que re-aceptar NO cree un duplicado (reusa este id). */
  expCreado?: number;
};

// ── Seguimiento del retro anterior ───────────────────────────────────────────

export type RetroSeguimientoItem = {
  st: 'done' | 'curso' | 'no';
  title: string;
  estado: string;             // "Hecho" / "En curso" / "Sin tocar"
  fx: string;                 // efecto: "+9 agendas" / "sin efecto"
  fxT: 'good' | 'warn' | 'bad' | 'gris';
};

// ── Cobertura de datos (huecos de medición) ──────────────────────────────────

export type RetroCoberturaItem = {
  label: string;              // "UTM de Calendly sin configurar"
  tone: 'gris' | 'warn';
  accion?: string;            // label del botón ("Configurar") — opcional
};

// ── Charts reales por herramienta (los arma el CÓDIGO, no MaKo) ──────────────

export type PuntoXY = { x: string; [serie: string]: number | string | null };

export type RetroCharts = {
  /** Market Analyst: tendencia semanal, series ['spend','cpl'] (u otras 2). */
  market?: { puntos: PuntoXY[]; series: [string, string] };
  /** Graphics: embudo completo con conteos. */
  graphics?: { funnel: Array<{ label: string; valor: number; fuga?: boolean }> };
  /** CRM: split de nutrición. */
  crm?: { split: Array<{ label: string; valor: number; tone: 'good' | 'bad' | 'gris' }> };
  /** Closing: embudo comercial corto + score. */
  closing?: { pasos: Array<{ label: string; valor: number }>; score?: number | null };
  /** Ads Analyst: guiones para el cuadrante hook × retención. */
  script?: { guiones: Array<{ nombre: string; hook: number; ret: number; spend: number }> };
};

// ── El reporte completo ──────────────────────────────────────────────────────

export type RetroReporte = {
  version: 3;
  tesis: { texto: string; highlight?: string };  // highlight: subcadena a pintar en rojo
  fuga?: { valor: string; unidad: string; titulo: string; texto: string };
  areas: Array<{ id: AreaId; name: string; st: SaludArea; line: string }>;
  findings: RetroFinding[];
  plan: RetroPlanItem[];
  seguimiento: RetroSeguimientoItem[];
  cobertura: RetroCoberturaItem[];
  charts: RetroCharts;
  proceso: Array<{ fase: string; label: string }>;
};

// ── Eventos del stream de generación (para la pantalla de ejecución) ─────────

export type RetroFaseId =
  | 'memoria' | 'recoleccion' | 'auditoria' | 'diagnostico' | 'cruces' | 'cerebro' | 'verificacion' | 'redaccion';

export const RETRO_FASES: Array<{ id: RetroFaseId; label: string }> = [
  { id: 'memoria', label: 'Memoria' },
  { id: 'recoleccion', label: 'Recolección' },
  { id: 'auditoria', label: 'Auditoría' },
  { id: 'diagnostico', label: 'Diagnóstico' },
  { id: 'cruces', label: 'Cruces' },
  { id: 'cerebro', label: 'Organizando' },
  { id: 'verificacion', label: 'Verificando' },
  { id: 'redaccion', label: 'Redactando' },
];

export type RetroStreamEvent =
  | { t: 'plan'; fases: Array<{ id: RetroFaseId; label: string }>; tabs: Array<{ id: string; label: string; icon?: string }> }
  | { t: 'fase'; fase: RetroFaseId }
  | { t: 'step'; fase: RetroFaseId; label: string; tab?: string; hallazgo?: string }
  | { t: 'done'; retro: unknown }
  | { t: 'error'; error: string };
