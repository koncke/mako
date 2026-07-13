// =============================================================================
// board/types — modelo unificado del tablero /todo (admin y cliente)
// =============================================================================
// Un solo componente <BoardShell> renderiza AMBOS boards (super-admin en
// localStorage, cliente en DB). Cada parent implementa un `Repo` que persiste;
// useBoard tiene toda la lógica (optimista + change history + undo).

export type Prio = 'alta' | 'media' | 'baja' | 'futuro';
export type Actor = 'user' | 'ia';
export type Check = { id: string; text: string; done: boolean };
export type UndoInfo = { field: string; prev: unknown };
export type Hist = { id: string; ts: number; actor: Actor; text: string; undo?: UndoInfo; kind?: 'task' };

export type BoardTask = {
  id: string;
  num: number;              // #n visible
  title: string;
  detalle: string;
  priority: Prio;           // DERIVADA del score (prioFromScore); no la fija el usuario
  score: number;            // 1-100 (MaKo perro guardián). 0 = sin puntuar
  scoreRazon?: string;      // por qué el guardián le puso ese score
  progress: number;         // 0-100
  deadline: string;         // '' | YYYY-MM-DD
  labels: string[];         // ids de Label
  checklist: Check[];
  historial: Hist[];
  origen: Actor;            // quién creó la tarjeta (user | ia=MaKo)
  enPrioridad: boolean;     // "En prioridad" (vista Prioridades, máx 3)
};

export type Label = { id: string; emoji: string; name: string; color: string; score: number; scoreRazon?: string; deadline?: string; detalle: string; historial: Hist[] };
export type BoardUser = { nombre: string; avatarUrl: string };

// Persistencia inyectada por cada parent. Todo async; useBoard es optimista.
export type Repo = {
  labelMode: 'single' | 'multi';          // admin: 1 proyecto/tarea; cliente: n categorías
  labelSingular: string;                   // "Proyecto" | "Categoría"
  labelPlural: string;                     // "Proyectos" | "Categorías"
  // TEMPORAL: en super-admin dejamos cerrar el form bloqueante de Alta mientras
  // se desarrolla el resto. QUITAR cuando exista el guardián (también para admin).
  dismissableGauntlet?: boolean;
  createTask(draft: BoardTask): Promise<BoardTask>;  // devuelve canónica (id puede cambiar)
  saveTask(task: BoardTask): Promise<void>;          // upsert de una tarea existente
  deleteTask(id: string): Promise<void>;
  createLabel(draft: Label): Promise<Label>;         // devuelve canónica (id server)
  saveLabel(label: Label): Promise<void>;
  deleteLabel(id: string): Promise<void>;
};

export const PRIOS: Prio[] = ['alta', 'media', 'baja', 'futuro'];
export const PLABEL: Record<Prio, string> = { alta: 'Alta', media: 'Media', baja: 'Baja', futuro: 'A futuro' };
export const PCOLOR: Record<Prio, string> = { alta: '#D0504A', media: '#C8870C', baja: '#1E9E57', futuro: '#98A0AC' };
export const SWATCHES = ['#98A0AC', '#2F6FED', '#1E9E57', '#C8870C', '#D0504A', '#7C5CFB', '#0E9B8E', '#D6489B'];
export const MAX_PRIORIDAD = 3; // vista "Prioridades": tope de tarjetas marcadas
export const HIST_CAP = 80;     // tope de entradas del change history por tarea

export const uid = () => 'x' + Math.random().toString(36).slice(2, 9);
export const clampPct = (v: number) => Math.max(0, Math.min(100, Math.round(Number.isFinite(v) ? v : 0)));

export function relTime(ts: number, nowMs: number): string {
  const s = Math.max(0, Math.round((nowMs - ts) / 1000));
  if (s < 45) return 'hace unos segundos';
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  return `hace ${Math.round(s / 86400)} d`;
}

// Una tarea Alta (no terminada) está "incompleta" si le falta deadline o checklist.
// Las tareas al 100% no cuentan (ya están hechas, no tiene sentido pedirles plan).
export const altaIncompleta = (t: BoardTask) => t.priority === 'alta' && t.progress < 100 && (!t.deadline || t.checklist.length === 0);

// ── Score 1-100 ⇄ columna (el guardián pone el score; la columna se DERIVA) ──
export const clampScore = (v: number) => Math.max(0, Math.min(100, Math.round(Number.isFinite(v) ? v : 0)));
export const MAX_PROJ = 10; // prioridad del proyecto: 1-10 (para no empatar)
export const clampProj = (v: number) => Math.max(1, Math.min(MAX_PROJ, Math.round(Number.isFinite(v) ? v : 5)));
export function prioFromScore(score: number): Prio {
  if (score >= 75) return 'alta';
  if (score >= 50) return 'media';
  if (score >= 25) return 'baja';
  return 'futuro';
}
// score representativo de cada columna (migración de tareas viejas / bajar prioridad a mano)
export const scoreFromPrio: Record<Prio, number> = { alta: 85, media: 62, baja: 37, futuro: 12 };

// Score a partir del cual una tarea es EMERGENCIA (entra a Alta aunque no sea del
// proyecto top). Ej: cuenta de Meta suspendida.
export const EMERGENCY_SCORE = 90;

// La columna que se MUESTRA respeta la restricción del guardián: ALTA (y las 3
// prioridades) solo para tareas del PROYECTO TOP, sin proyecto, o emergencias.
// Una tarea con score alto pero de otro proyecto se topea en Media.
export function displayPrio(t: BoardTask, topProjectId: string | null): Prio {
  const base = prioFromScore(t.score);
  if (base !== 'alta') return base;
  return puedeSerAlta(t, topProjectId) ? 'alta' : 'media';
}
export const puedeSerAlta = (t: BoardTask, topProjectId: string | null): boolean =>
  (topProjectId != null && t.labels.includes(topProjectId)) || t.labels.length === 0 || t.score >= EMERGENCY_SCORE;
