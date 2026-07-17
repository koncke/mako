// =============================================================================
// todo — tablero kanban de tareas (ruta /todo)
// =============================================================================
// Tareas que nacen de una Retro ("hacé esto"), de un experimento, o a mano.
// AMBOS EJES: columnas de estado (por_hacer|en_curso|hecho) para el drag, y por
// tarjeta: prioridad, avance % (progreso), deadline, categorías (multi) y nota.
// `orden` (float) ordena dentro de la columna e inserta entre dos sin renumerar.
// =============================================================================

import 'server-only';
import { getTenantDb } from './workspace';

export type EstadoTarea = 'por_hacer' | 'en_curso' | 'hecho';
export type Prioridad = 'alta' | 'media' | 'baja' | 'futuro';
export type OrigenTarea = 'manual' | 'mako' | 'retro' | 'experimento';
// Espeja app/plan/board/types.ts: 'ia' = MaKo (la IA del producto), 'code' = Claude
// Code (el agente de desarrollo). En el board del CLIENTE 'code' no se genera —
// ningún dev le escribe tarjetas— pero el tipo lo acepta para que una entrada así
// no se degrade a 'user' al leerla (diría que la escribió el cliente: peor mentira).
export type Actor = 'user' | 'ia' | 'code';
export type ChecklistItem = { id: string; text: string; done: boolean };
export type HistUndo = { field: string; prev: unknown };
export type HistEntry = { id: string; ts: number; actor: Actor; text: string; undo?: HistUndo; kind?: 'task' };

const origenActor = (o: OrigenTarea): Actor => (o === 'manual' ? 'user' : 'ia');

export const COLUMNAS: Array<{ key: EstadoTarea; label: string }> = [
  { key: 'por_hacer', label: 'Por hacer' },
  { key: 'en_curso', label: 'En curso' },
  { key: 'hecho', label: 'Hecho' },
];

export type Tarea = {
  id: number;
  titulo: string;
  detalle: string | null;        // nota
  estado: EstadoTarea;
  prioridad: Prioridad;
  progreso: number;              // 0-100
  deadline: string | null;       // YYYY-MM-DD
  categorias: number[];          // ids de tarea_categorias
  checklist: ChecklistItem[];    // ítems {id,text,done}
  historial: HistEntry[];        // change history {ts,actor,text} — user|ia
  en_prioridad: boolean;         // marcada "En prioridad" (vista Prioridades)
  score: number;                 // 1-100 del guardián (define la columna)
  score_razon: string | null;    // por qué el guardián le puso ese score
  origen: OrigenTarea;
  experimento_id: number | null;
  retro_id: number | null;
  orden: number;
  hecho_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Categoria = { id: number; nombre: string; color: string; emoji: string; prioridad: number; score_razon: string | null; deadline: string | null; detalle: string; historial: HistEntry[]; created_at: string };

const COLS = '*';
const rowTo = (r: Record<string, unknown>): Tarea => {
  const t = r as unknown as Tarea;
  // categorias viene como jsonb → array; blindamos a number[].
  const cats = (r.categorias as unknown);
  t.categorias = Array.isArray(cats) ? cats.map(Number).filter((n) => Number.isFinite(n)) : [];
  t.progreso = clampPct((r.progreso as number) ?? 0);
  t.checklist = checklistOk(r.checklist);
  t.historial = histOk(r.historial);
  t.en_prioridad = !!r.en_prioridad;
  t.score = Math.max(0, Math.min(100, Math.round(Number(r.score) || 0)));
  t.score_razon = typeof r.score_razon === 'string' && r.score_razon.trim() ? (r.score_razon as string) : null;
  return t;
};

// estado derivado del avance: 100→hecho, >0→en_curso, 0→por_hacer.
const estadoDeProgreso = (p: number): EstadoTarea => (p >= 100 ? 'hecho' : p > 0 ? 'en_curso' : 'por_hacer');
// score representativo de cada columna, para tareas nuevas (hasta que el guardián puntúe).
const scoreDePrioridad = (p: Prioridad): number => ({ alta: 85, media: 62, baja: 37, futuro: 12 }[p] ?? 62);

const checklistOk = (c: unknown): ChecklistItem[] =>
  Array.isArray(c)
    ? c.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
        .map((o) => ({ id: String(o.id ?? ''), text: String(o.text ?? ''), done: !!o.done }))
        .filter((i) => i.id)
    : [];
const histOk = (h: unknown): HistEntry[] =>
  Array.isArray(h)
    ? h.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
        .map((o) => {
          const ts = Number(o.ts) || 0;
          // La autoría se preserva tal cual: degradar un 'code' a 'user' diría que el
          // cambio lo hizo el cliente, que es peor mentira que no saber quién fue.
          const actor: Actor = o.actor === 'ia' ? 'ia' : o.actor === 'code' ? 'code' : 'user';
          const e: HistEntry = { id: typeof o.id === 'string' && o.id ? o.id : 'h' + ts, ts, actor, text: String(o.text ?? '') };
          const u = o.undo as Record<string, unknown> | undefined;
          if (u && typeof u === 'object' && typeof u.field === 'string') e.undo = { field: u.field, prev: u.prev };
          if (o.kind === 'task') e.kind = 'task';
          return e;
        })
    : [];

function clampPct(v: unknown): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

const estadoOk = (e: unknown): EstadoTarea =>
  e === 'en_curso' || e === 'hecho' ? e : 'por_hacer';
const prioridadOk = (p: unknown): Prioridad =>
  p === 'alta' || p === 'baja' || p === 'futuro' ? p : 'media';
const origenOk = (o: unknown): OrigenTarea =>
  o === 'mako' || o === 'retro' || o === 'experimento' ? o : 'manual';
const dateOk = (d: unknown): string | null =>
  typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
const catsOk = (c: unknown): number[] =>
  Array.isArray(c) ? c.map(Number).filter((n) => Number.isFinite(n)) : [];

/**
 * Las tareas que nacieron de UNA retro. Es el insumo de la rendición de cuentas:
 * la Retro necesita saber qué pasó DE VERDAD con lo que propuso la vez pasada, no
 * si tocaste "Aceptar". Scopeada por workspace como todo lo demás (getTenantDb).
 */
export async function listTareasDeRetro(retroId: number): Promise<Tarea[]> {
  const supabase = await getTenantDb();
  const { data, error } = await supabase.from('experimento_tareas').select(COLS).eq('retro_id', retroId);
  if (error) throw new Error(`listTareasDeRetro: ${error.message}`);
  return ((data ?? []) as Record<string, unknown>[]).map(rowTo);
}

export async function listTareas(): Promise<Tarea[]> {
  const supabase = (await getTenantDb());
  const { data, error } = await supabase
    .from('experimento_tareas')
    .select(COLS)
    .order('orden', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw new Error(`listTareas: ${error.message}`);
  return (data ?? []).map(rowTo);
}

export type NuevaTarea = {
  titulo: string;
  detalle?: string | null;
  estado?: EstadoTarea;
  prioridad?: Prioridad;
  progreso?: number;
  deadline?: string | null;
  categorias?: number[];
  origen?: OrigenTarea;
  experimento_id?: number | null;
  retro_id?: number | null;
};

/** Orden para el tope de una columna (las nuevas entran arriba). */
async function ordenTope(estado: EstadoTarea): Promise<number> {
  const supabase = (await getTenantDb());
  const { data } = await supabase
    .from('experimento_tareas')
    .select('orden')
    .eq('estado', estado)
    .order('orden', { ascending: true })
    .limit(1);
  const min = data && data.length ? Number((data[0] as { orden: number }).orden) : 0;
  return min - 1;
}

export async function crearTarea(input: NuevaTarea): Promise<Tarea> {
  const estado = estadoOk(input.estado);
  const origen = origenOk(input.origen);
  const fila = {
    titulo: (input.titulo || '').trim() || 'Tarea',
    detalle: input.detalle ?? null,
    estado,
    prioridad: prioridadOk(input.prioridad),
    progreso: input.progreso != null ? clampPct(input.progreso) : 0,
    deadline: dateOk(input.deadline),
    categorias: catsOk(input.categorias),
    checklist: [] as ChecklistItem[],
    historial: [{ id: 'h' + Date.now(), ts: Date.now(), actor: origenActor(origen), text: 'Creó la tarjeta' }] as HistEntry[],
    en_prioridad: false,
    score: scoreDePrioridad(prioridadOk(input.prioridad)),
    origen,
    experimento_id: input.experimento_id ?? null,
    retro_id: input.retro_id ?? null,
    orden: await ordenTope(estado),
    updated_at: new Date().toISOString(),
  };
  const supabase = (await getTenantDb());
  const { data, error } = await supabase.from('experimento_tareas').insert(fila).select(COLS).single();
  if (error) throw new Error(`crearTarea: ${error.message}`);
  return rowTo(data);
}

/** Alta en lote (desde una Retro o un experimento). Devuelve cuántas creó. */
export async function crearTareasDesde(
  items: Array<{ titulo: string; detalle?: string | null; prioridad?: Prioridad }>,
  meta: { origen: OrigenTarea; retro_id?: number | null; experimento_id?: number | null },
): Promise<number> {
  const base = await ordenTope('por_hacer');
  const validos = items.filter((it) => (it.titulo || '').trim());
  const n = validos.length;
  // item[0] queda con el orden MENOR → arriba (la columna ordena ascendente),
  // preservando el orden de prioridad con el que MaKo/Retro entregan el lote.
  const filas = validos.map((it, i) => ({
    titulo: it.titulo.trim(),
    detalle: it.detalle ?? null,
    estado: 'por_hacer' as EstadoTarea,
    prioridad: prioridadOk(it.prioridad),
    progreso: 0,
    deadline: null,
    categorias: [] as number[],
    checklist: [] as ChecklistItem[],
    historial: [{ id: 'h' + Date.now() + i, ts: Date.now(), actor: 'ia' as Actor, text: 'Creó la tarjeta' }] as HistEntry[],
    score: scoreDePrioridad(prioridadOk(it.prioridad)),
    origen: origenOk(meta.origen),
    retro_id: meta.retro_id ?? null,
    experimento_id: meta.experimento_id ?? null,
    orden: base - (n - i),
    updated_at: new Date().toISOString(),
  }));
  if (!filas.length) return 0;
  const supabase = (await getTenantDb());
  const { error } = await supabase.from('experimento_tareas').insert(filas);
  if (error) throw new Error(`crearTareasDesde: ${error.message}`);
  return filas.length;
}

/** Mueve una tarea de columna y/o la reordena. Al pasar a 'hecho' completa el avance. */
export async function moverTarea(id: number, estado: EstadoTarea, orden?: number, historial?: HistEntry[]): Promise<Tarea> {
  const est = estadoOk(estado);
  const patch: Record<string, unknown> = {
    estado: est,
    orden: orden ?? (await ordenTope(est)),
    hecho_at: est === 'hecho' ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };
  if (est === 'hecho') patch.progreso = 100;
  if (historial !== undefined) patch.historial = histOk(historial);
  const supabase = (await getTenantDb());
  const { data, error } = await supabase.from('experimento_tareas').update(patch).eq('id', id).select(COLS).single();
  if (error) throw new Error(`moverTarea: ${error.message}`);
  return rowTo(data);
}

export async function editarTarea(
  id: number,
  patch: { titulo?: string; detalle?: string | null; prioridad?: Prioridad; progreso?: number; deadline?: string | null; categorias?: number[]; checklist?: ChecklistItem[]; historial?: HistEntry[]; en_prioridad?: boolean; score?: number; score_razon?: string | null },
): Promise<Tarea> {
  const upd: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.titulo != null) upd.titulo = patch.titulo.trim() || 'Tarea';
  if (patch.detalle !== undefined) upd.detalle = patch.detalle;
  if (patch.prioridad != null) upd.prioridad = prioridadOk(patch.prioridad);
  // El estado se DERIVA del avance (el board /todo ya no muestra "Estado" aparte):
  // 100→hecho, >0→en_curso, 0→por_hacer. hecho_at se sella SOLO en la transición
  // a hecho — si ya estaba hecha, se preserva (no re-sellar en cada edición).
  if (patch.progreso != null) {
    const p = clampPct(patch.progreso);
    const est = estadoDeProgreso(p);
    upd.progreso = p;
    upd.estado = est;
    if (est !== 'hecho') upd.hecho_at = null;
    else {
      const { data: cur } = await (await getTenantDb()).from('experimento_tareas').select('hecho_at').eq('id', id).single();
      upd.hecho_at = (cur as { hecho_at?: string } | null)?.hecho_at ?? new Date().toISOString();
    }
  }
  if (patch.deadline !== undefined) upd.deadline = dateOk(patch.deadline);
  if (patch.categorias !== undefined) upd.categorias = catsOk(patch.categorias);
  if (patch.checklist !== undefined) upd.checklist = checklistOk(patch.checklist);
  if (patch.historial !== undefined) upd.historial = histOk(patch.historial);
  if (patch.en_prioridad !== undefined) upd.en_prioridad = !!patch.en_prioridad;
  if (patch.score !== undefined) upd.score = Math.max(0, Math.min(100, Math.round(patch.score)));
  if (patch.score_razon !== undefined) upd.score_razon = patch.score_razon;
  const supabase = (await getTenantDb());
  const { data, error } = await supabase.from('experimento_tareas').update(upd).eq('id', id).select(COLS).single();
  if (error) throw new Error(`editarTarea: ${error.message}`);
  return rowTo(data);
}

export async function borrarTarea(id: number): Promise<void> {
  const supabase = (await getTenantDb());
  const { error } = await supabase.from('experimento_tareas').delete().eq('id', id);
  if (error) throw new Error(`borrarTarea: ${error.message}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Categorías (etiquetas con color)
// ─────────────────────────────────────────────────────────────────────────────

const catRow = (r: Record<string, unknown>): Categoria => {
  const c = r as unknown as Categoria;
  c.emoji = typeof r.emoji === 'string' && r.emoji ? (r.emoji as string) : '🏷';
  c.prioridad = Math.max(1, Math.min(100, Math.round(Number(r.prioridad) || 50)));
  c.score_razon = typeof r.score_razon === 'string' && r.score_razon.trim() ? (r.score_razon as string) : null;
  c.deadline = dateOk(r.deadline);
  c.detalle = typeof r.detalle === 'string' ? (r.detalle as string) : '';
  c.historial = histOk(r.historial);
  return c;
};

export async function listCategorias(): Promise<Categoria[]> {
  const supabase = (await getTenantDb());
  const { data, error } = await supabase.from('tarea_categorias').select('*').order('created_at', { ascending: true });
  if (error) throw new Error(`listCategorias: ${error.message}`);
  return (data ?? []).map(catRow);
}

export async function crearCategoria(nombre: string, color: string, emoji?: string, prioridad?: number, detalle?: string, historial?: HistEntry[], score_razon?: string | null, deadline?: string | null): Promise<Categoria> {
  const supabase = (await getTenantDb());
  const { data, error } = await supabase.from('tarea_categorias')
    .insert({ nombre: (nombre || '').trim().slice(0, 40) || 'Categoría', color: color || '#9b9ba2', emoji: (emoji || '🏷').slice(0, 4), prioridad: Math.max(1, Math.min(100, Math.round(prioridad ?? 50))), score_razon: score_razon ?? null, deadline: dateOk(deadline), detalle: detalle ?? '', historial: histOk(historial ?? []) })
    .select('*').single();
  if (error) throw new Error(`crearCategoria: ${error.message}`);
  return catRow(data);
}

export async function editarCategoria(id: number, patch: { nombre?: string; color?: string; emoji?: string; prioridad?: number; detalle?: string; historial?: HistEntry[]; score_razon?: string | null; deadline?: string | null }): Promise<Categoria> {
  const upd: Record<string, unknown> = {};
  if (patch.nombre !== undefined) upd.nombre = (patch.nombre || '').trim().slice(0, 40) || 'Categoría';
  if (patch.color !== undefined) upd.color = patch.color || '#9b9ba2';
  if (patch.emoji !== undefined) upd.emoji = (patch.emoji || '🏷').slice(0, 4);
  if (patch.prioridad !== undefined) upd.prioridad = Math.max(1, Math.min(100, Math.round(patch.prioridad)));
  if (patch.score_razon !== undefined) upd.score_razon = patch.score_razon;
  if (patch.deadline !== undefined) upd.deadline = dateOk(patch.deadline);
  if (patch.detalle !== undefined) upd.detalle = patch.detalle;
  if (patch.historial !== undefined) upd.historial = histOk(patch.historial);
  const supabase = (await getTenantDb());
  const { data, error } = await supabase.from('tarea_categorias').update(upd).eq('id', id).select('*').single();
  if (error) throw new Error(`editarCategoria: ${error.message}`);
  return catRow(data);
}

/** Borra la categoría y la quita de todas las tareas que la tenían. */
export async function borrarCategoria(id: number): Promise<void> {
  const supabase = (await getTenantDb());
  const { data: conCat } = await supabase.from('experimento_tareas').select('id, categorias').contains('categorias', [id]);
  await Promise.all((conCat ?? []).map((t) => {
    const cats = catsOk((t as { categorias: unknown }).categorias).filter((c) => c !== id);
    return supabase.from('experimento_tareas').update({ categorias: cats, updated_at: new Date().toISOString() }).eq('id', (t as { id: number }).id);
  }));
  const { error } = await supabase.from('tarea_categorias').delete().eq('id', id);
  if (error) throw new Error(`borrarCategoria: ${error.message}`);
}
