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
export type Hist = { ts: number; actor: Actor; text: string; undo?: UndoInfo };

export type BoardTask = {
  id: string;
  num: number;              // #n visible
  title: string;
  detalle: string;
  priority: Prio;
  progress: number;         // 0-100
  deadline: string;         // '' | YYYY-MM-DD
  labels: string[];         // ids de Label
  checklist: Check[];
  historial: Hist[];
  origen: Actor;            // quién creó la tarjeta (user | ia=MaKo)
  enPrioridad: boolean;     // "En prioridad" (vista Prioridades, máx 3)
};

export type Label = { id: string; emoji: string; name: string; color: string };
export type BoardUser = { nombre: string; avatarUrl: string };

// Persistencia inyectada por cada parent. Todo async; useBoard es optimista.
export type Repo = {
  labelMode: 'single' | 'multi';          // admin: 1 proyecto/tarea; cliente: n categorías
  labelSingular: string;                   // "Proyecto" | "Categoría"
  labelPlural: string;                     // "Proyectos" | "Categorías"
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

export const uid = () => 'x' + Math.random().toString(36).slice(2, 9);
export const clampPct = (v: number) => Math.max(0, Math.min(100, Math.round(Number.isFinite(v) ? v : 0)));

export function relTime(ts: number, nowMs: number): string {
  const s = Math.max(0, Math.round((nowMs - ts) / 1000));
  if (s < 45) return 'hace unos segundos';
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  return `hace ${Math.round(s / 86400)} d`;
}

// Una tarea Alta está "completa" si tiene deadline Y al menos un ítem de checklist.
export const altaIncompleta = (t: BoardTask) => t.priority === 'alta' && (!t.deadline || t.checklist.length === 0);
