// =============================================================================
// board/types — modelo unificado del tablero /todo (admin y cliente)
// =============================================================================
// Un solo componente <BoardShell> renderiza AMBOS boards (super-admin en
// localStorage, cliente en DB). Cada parent implementa un `Repo` que persiste;
// useBoard tiene toda la lógica (optimista + change history + undo).

export type Prio = 'alta' | 'media' | 'baja' | 'futuro';
// Quién tocó algo. Los dos últimos son IA pero NO son lo mismo, y confundirlos es
// mentir sobre el producto:
//   'ia'   = MaKo, la IA que corre DENTRO de la app (el Perro puntuando, el doer,
//            la Retro creando tareas). Es una función del producto: le pasa igual
//            al cliente.
//   'code' = Claude Code, el agente de desarrollo que edita el repo y despliega.
//            Nada de lo que hace acá lo puede hacer MaKo, ni le pasa a un cliente.
// Firmar como 'ia' algo que hizo 'code' hace parecer que el Perro trabaja cuando
// en realidad lo escribió un dev con un deploy.
export type Actor = 'user' | 'ia' | 'code';
export const esIA = (a: Actor) => a !== 'user';
export const ACTOR_LABEL: Record<Actor, string> = { user: '', ia: 'MaKo', code: 'Claude Code' };

// La FUENTE de una tarjeta: DE DÓNDE salió (más rico que `origen`, que solo dice quién).
// Fathom (una reunión), WhatsApp, un archivo, o Claude Code (con nombre + link del chat).
export type FuenteTipo = 'manual' | 'mako' | 'fathom' | 'whatsapp' | 'archivo' | 'claude-code' | 'retro' | 'experimento';
export type Fuente = { tipo: FuenteTipo; etiqueta?: string; url?: string }; // etiqueta = reunión/archivo/chat; url = link
// Si la tarjeta no tiene fuente explícita, se deriva del origen (compat con lo ya guardado).
export function fuenteEfectiva(t: { origen: Actor; fuente?: Fuente }): Fuente {
  if (t.fuente?.tipo) return t.fuente;
  return { tipo: t.origen === 'user' ? 'manual' : t.origen === 'code' ? 'claude-code' : 'mako' };
}

// Fecha y hora EXACTAS (feedback jul-19): "hace 6 días" no sirve cuando el chat es largo.
// Formato propio (24h, hora local) para no depender de los caprichos del locale ("p. m.").
const MESES_ABR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export function fechaHora(ts: number): string {
  try {
    const d = new Date(ts);
    if (!Number.isFinite(d.getTime())) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    const anio = d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : '';
    return `${dd} ${MESES_ABR[d.getMonth()]}${anio} · ${hh}:${mi}`;
  } catch { return ''; }
}
export type Check = { id: string; text: string; done: boolean };
export type UndoInfo = { field: string; prev: unknown };
export type Hist = { id: string; ts: number; actor: Actor; text: string; undo?: UndoInfo; kind?: 'task' };

export type BoardTask = {
  id: string;
  num: number;              // #n visible
  emoji: string;            // ícono de la tarjeta (antes del título, como el proyecto)
  title: string;
  detalle: string;
  priority: Prio;           // DERIVADA del score (prioFromScore); no la fija el usuario
  score: number;            // 1-100 (MaKo perro guardián). 0 = sin puntuar
  scoreRazon?: string;      // por qué el guardián le puso ese score (comparando con el resto)
  deadlineRazon?: string;   // por qué el guardián puso ESA fecha (se debate igual que el score)
  /** Notas libres del dueño. La IA nunca las escribe ni las pisa (mig 0114). */
  notas?: string;
  /** id de lib/mako-capacidades: esta tarea se resuelve DENTRO de MaKo, en esa tab.
   *  Vacío = se hace afuera, que es la mitad del trabajo de un negocio (mig 0115). */
  haceloEn?: string;
  impacto?: number;         // 1-100: cuánto mueve la aguja (dinero / métrica norte)
  esfuerzo?: number;        // 1-100: cuánto cuesta hacerla (menos esfuerzo = mejor)
  progress: number;         // 0-100
  deadline: string;         // '' | YYYY-MM-DD
  labels: string[];         // ids de Label
  checklist: Check[];
  historial: Hist[];
  origen: Actor;            // quién creó la tarjeta (user | ia=MaKo | code=Claude Code)
  fuente?: Fuente;          // DE DÓNDE salió (Fathom/WhatsApp/archivo/Claude Code…); si falta, se deriva del origen
  enPrioridad: boolean;     // "En prioridad" (vista Prioridades, máx 3)
};

export type Label = { id: string; pid?: string; emoji: string; name: string; color: string; score: number; scoreRazon?: string; impacto?: number; esfuerzo?: number; deadline?: string; detalle: string; notas?: string; historial: Hist[]; fuente?: Fuente };
// El id VISIBLE de un proyecto (P1, P2…): distinto del #num de las tareas a propósito,
// para que de un vistazo se sepa si un id es de tarea o de proyecto. Estable por orden.
export const pidDe = (l: { pid?: string }, i: number) => l.pid || `P${i + 1}`;
export type BoardUser = { nombre: string; avatarUrl: string };

// Lo que el Perro server-side le dejó a UNA tarjeta. Vuelve al navegador para que el
// board lo aplique en el acto: si no vuelve, la UI sigue mostrando el score viejo y el
// próximo saveTask (upsert de la fila entera) le pisa lo que el Perro acaba de escribir.
export type GuardPatch = {
  id: string; score?: number; scoreRazon?: string; impacto?: number; esfuerzo?: number; deadline?: string; deadlineRazon?: string; haceloEn?: string;
  priority?: Prio; detalle?: string; checklist?: Check[]; historialEntry?: Hist;
};
/** Ídem para un proyecto nuevo (emoji + descripción + score del Perro). */
export type GuardProjPatch = { id: string; score: number; scoreRazon: string; impacto?: number; esfuerzo?: number; emoji: string; detalle: string };
// `sinPuntuar` es el número de tareas que el Perro NO alcanzó a puntuar. Tiene que
// viajar hasta la pantalla: el 5/8 entraron 20 tareas con el score de fábrica (62), sin
// razón y sin fecha, porque el JSON del modelo se cortó — y nadie se enteró hasta
// mirar la base a mano. Un fallo silencioso en el Perro envenena todo el tablero.
export type GuardResult = { tareas: Record<Prio, number>; proyectos: number; patches: GuardPatch[]; proyectosPatch: GuardProjPatch[]; sinPuntuar?: number };

// Persistencia inyectada por cada parent. Todo async; useBoard es optimista.
export type Repo = {
  labelMode: 'single' | 'multi';          // admin: 1 proyecto/tarea; cliente: n categorías
  labelSingular: string;                   // "Proyecto" | "Categoría"
  labelPlural: string;                     // "Proyectos" | "Categorías"
  // Habilita "Extraer de una reunión" (G3): lee Fathom y crea tareas. Solo el
  // super-admin de la agencia (usa la Fathom key de la agencia).
  fathomExtract?: boolean;
  /**
   * La lista CERRADA de proyectos grandes. Cada tablero trae la suya: el del dueño las
   * tabs del producto (lib/plan-proyectos-catalogo) y el de un cliente las ÁREAS de su
   * marketing (lib/todo-proyectos-catalogo) — sus CLIENTES no van acá, los resuelve el
   * server contra el CRM. Cuando está, la extracción de reuniones solo puede proponer
   * proyectos de acá: es lo que impide que una reunión abra un proyecto nuevo con el
   * nombre que se le ocurra al modelo.
   */
  catalogo?: Array<{ nombre: string; emoji: string; que: string }>;
  createTask(draft: BoardTask): Promise<BoardTask>;  // devuelve canónica (id puede cambiar)
  saveTask(task: BoardTask): Promise<void>;          // upsert de una tarea existente
  deleteTask(id: string): Promise<void>;
  createLabel(draft: Label): Promise<Label>;         // devuelve canónica (id server)
  saveLabel(label: Label): Promise<void>;
  deleteLabel(id: string): Promise<void>;
  // El PERRO GUARDIÁN server-side puntúa/describe tareas nuevas ya creadas (por ids),
  // ubicándolas en la pirámide existente + checklists. Lo implementa SOLO el board del
  // dueño (plan_tareas); así Fathom/archivo/alta reciben el MISMO trato que WhatsApp.
  // El board del cliente no lo tiene (usa su Perro client-side) → opcional.
  priorizarNuevas?(ids: string[], proyectoIds?: string[], contexto?: string): Promise<GuardResult | null>;
  /**
   * AMPLIAR una tarjeta que ya existe en vez de crear una segunda igual. Es lo que
   * pasa cuando se cargan varias reuniones seguidas: la misma tarea se habla en tres
   * llamadas. Devuelve los patches para pintarlo sin recargar.
   */
  ampliarTareas?(items: Array<{ id: string; detalle: string }>, fuente?: Fuente): Promise<GuardPatch[]>;
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
export const MAX_PROJ = 100; // prioridad del proyecto: 1-100 (igual que las tareas; con 34+ proyectos, 1-10 se quedaba corto y empataba)
export const clampProj = (v: number) => Math.max(1, Math.min(MAX_PROJ, Math.round(Number.isFinite(v) ? v : 50)));

// Curva las tareas a una PIRÁMIDE sana usando el RANKING del guardián (el modelo
// tiende a inflar: mete casi todo en Alta/Media y casi nada en "A futuro"). Toma el
// orden por score y reasigna scores por banda: top ~15% Alta, ~25% Media, ~30% Baja,
// ~30% A futuro. Devuelve id → score nuevo. (En planes chicos, <5 tareas, no fuerza.)
export function curveTaskScores(items: Array<{ id: string; score: number }>): Record<string, number> {
  const out: Record<string, number> = {};
  const n = items.length;
  if (n === 0) return out;
  if (n < 5) { items.forEach((x) => { out[x.id] = x.score; }); return out; }
  const order = items.map((x, i) => ({ id: x.id, score: x.score, i })).sort((a, b) => b.score - a.score || a.i - b.i);
  order.forEach((o, k) => {
    const frac = k / (n - 1); // 0 = la más importante … 1 = la menos
    let s: number;
    if (frac < 0.15) s = Math.round(93 - (frac / 0.15) * 17);            // 93 → 76  (Alta)
    else if (frac < 0.40) s = Math.round(72 - ((frac - 0.15) / 0.25) * 21); // 72 → 51  (Media)
    else if (frac < 0.70) s = Math.round(48 - ((frac - 0.40) / 0.30) * 22); // 48 → 26  (Baja)
    else s = Math.round(23 - ((frac - 0.70) / 0.30) * 21);              // 23 → 2   (A futuro)
    out[o.id] = Math.max(1, Math.min(100, s));
  });
  return out;
}

// Reparte los scores de proyectos en 1-10 SIN empatar, conservando el orden por score
// (el guardián decide el RANKING; nosotros garantizamos valores distintos y usando la
// escala completa — el modelo tiende a amontonar y empatar). Devuelve id → score nuevo.
export function spreadProjScores(items: Array<{ id: string; score: number }>): Record<string, number> {
  const n = items.length;
  const order = items.map((x, i) => ({ id: x.id, score: x.score, i })).sort((a, b) => b.score - a.score || a.i - b.i);
  const out: Record<string, number> = {};
  let prev = MAX_PROJ + 1;
  order.forEach((o, k) => {
    let v = n <= 1 ? MAX_PROJ : Math.round(MAX_PROJ - k * ((MAX_PROJ - 1) / (n - 1)));
    if (v >= prev) v = prev - 1;   // fuerza estrictamente decreciente (sin empates)
    if (v < 1) v = 1;
    prev = v;
    out[o.id] = v;
  });
  return out;
}
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

// La columna sale DIRECTO del score (pirámide real). Con 34+ proyectos finitos ya no
// tiene sentido topear a Media todo lo que no sea del Objetivo Principal: la prioridad
// se juzga entre TODAS las tareas. El foco en el norte vive en la vista Prioridades.
// (El 2º arg queda por compatibilidad de call-sites; ya no restringe.)
export function displayPrio(t: BoardTask, _topProjectId?: string | null): Prio {
  return prioFromScore(t.score);
}
export const puedeSerAlta = (t: BoardTask, topProjectId: string | null): boolean =>
  (topProjectId != null && t.labels.includes(topProjectId)) || t.labels.length === 0 || t.score >= EMERGENCY_SCORE;
