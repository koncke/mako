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
  origen: OrigenTarea;
  experimento_id: number | null;
  retro_id: number | null;
  orden: number;
  hecho_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Categoria = { id: number; nombre: string; color: string; created_at: string };

const COLS = '*';
const rowTo = (r: Record<string, unknown>): Tarea => {
  const t = r as unknown as Tarea;
  // categorias viene como jsonb → array; blindamos a number[].
  const cats = (r.categorias as unknown);
  t.categorias = Array.isArray(cats) ? cats.map(Number).filter((n) => Number.isFinite(n)) : [];
  t.progreso = clampPct((r.progreso as number) ?? 0);
  return t;
};

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
  const fila = {
    titulo: (input.titulo || '').trim() || 'Tarea',
    detalle: input.detalle ?? null,
    estado,
    prioridad: prioridadOk(input.prioridad),
    progreso: input.progreso != null ? clampPct(input.progreso) : 0,
    deadline: dateOk(input.deadline),
    categorias: catsOk(input.categorias),
    origen: origenOk(input.origen),
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
export async function moverTarea(id: number, estado: EstadoTarea, orden?: number): Promise<Tarea> {
  const est = estadoOk(estado);
  const patch: Record<string, unknown> = {
    estado: est,
    orden: orden ?? (await ordenTope(est)),
    hecho_at: est === 'hecho' ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };
  if (est === 'hecho') patch.progreso = 100;
  const supabase = (await getTenantDb());
  const { data, error } = await supabase.from('experimento_tareas').update(patch).eq('id', id).select(COLS).single();
  if (error) throw new Error(`moverTarea: ${error.message}`);
  return rowTo(data);
}

export async function editarTarea(
  id: number,
  patch: { titulo?: string; detalle?: string | null; prioridad?: Prioridad; progreso?: number; deadline?: string | null; categorias?: number[] },
): Promise<Tarea> {
  const upd: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.titulo != null) upd.titulo = patch.titulo.trim() || 'Tarea';
  if (patch.detalle !== undefined) upd.detalle = patch.detalle;
  if (patch.prioridad != null) upd.prioridad = prioridadOk(patch.prioridad);
  // El avance es una MÉTRICA independiente del estado (columna): editar el
  // progreso NO mueve de columna. "Hecho" se marca moviendo la tarjeta (moverTarea).
  if (patch.progreso != null) upd.progreso = clampPct(patch.progreso);
  if (patch.deadline !== undefined) upd.deadline = dateOk(patch.deadline);
  if (patch.categorias !== undefined) upd.categorias = catsOk(patch.categorias);
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

const catRow = (r: Record<string, unknown>): Categoria => r as unknown as Categoria;

export async function listCategorias(): Promise<Categoria[]> {
  const supabase = (await getTenantDb());
  const { data, error } = await supabase.from('tarea_categorias').select('*').order('created_at', { ascending: true });
  if (error) throw new Error(`listCategorias: ${error.message}`);
  return (data ?? []).map(catRow);
}

export async function crearCategoria(nombre: string, color: string): Promise<Categoria> {
  const supabase = (await getTenantDb());
  const { data, error } = await supabase.from('tarea_categorias')
    .insert({ nombre: (nombre || '').trim().slice(0, 40) || 'Categoría', color: color || '#9b9ba2' })
    .select('*').single();
  if (error) throw new Error(`crearCategoria: ${error.message}`);
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
