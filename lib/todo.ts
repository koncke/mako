// =============================================================================
// todo — tablero kanban de tareas de /experimentos (tab To-do)
// =============================================================================
// Tareas que nacen de una Retro ("hacé esto"), de un experimento, o a mano.
// Tres columnas: por_hacer | en_curso | hecho. `orden` (float) ordena dentro de
// la columna y permite insertar entre dos tarjetas sin renumerar todo.
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';

export type EstadoTarea = 'por_hacer' | 'en_curso' | 'hecho';
export type Prioridad = 'alta' | 'media' | 'baja';
export type OrigenTarea = 'manual' | 'mako' | 'retro' | 'experimento';

export const COLUMNAS: Array<{ key: EstadoTarea; label: string }> = [
  { key: 'por_hacer', label: 'Por hacer' },
  { key: 'en_curso', label: 'En curso' },
  { key: 'hecho', label: 'Hecho' },
];

export type Tarea = {
  id: number;
  titulo: string;
  detalle: string | null;
  estado: EstadoTarea;
  prioridad: Prioridad;
  origen: OrigenTarea;
  experimento_id: number | null;
  retro_id: number | null;
  orden: number;
  hecho_at: string | null;
  created_at: string;
  updated_at: string;
};

const COLS = '*';
const rowTo = (r: Record<string, unknown>): Tarea => r as unknown as Tarea;

const estadoOk = (e: unknown): EstadoTarea =>
  e === 'en_curso' || e === 'hecho' ? e : 'por_hacer';
const prioridadOk = (p: unknown): Prioridad =>
  p === 'alta' || p === 'baja' ? p : 'media';
const origenOk = (o: unknown): OrigenTarea =>
  o === 'mako' || o === 'retro' || o === 'experimento' ? o : 'manual';

export async function listTareas(): Promise<Tarea[]> {
  const supabase = getSupabaseServer();
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
  origen?: OrigenTarea;
  experimento_id?: number | null;
  retro_id?: number | null;
};

/** Orden para el tope de una columna (las nuevas entran arriba). */
async function ordenTope(estado: EstadoTarea): Promise<number> {
  const supabase = getSupabaseServer();
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
    origen: origenOk(input.origen),
    experimento_id: input.experimento_id ?? null,
    retro_id: input.retro_id ?? null,
    orden: await ordenTope(estado),
    updated_at: new Date().toISOString(),
  };
  const supabase = getSupabaseServer();
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
    origen: origenOk(meta.origen),
    retro_id: meta.retro_id ?? null,
    experimento_id: meta.experimento_id ?? null,
    orden: base - (n - i),
    updated_at: new Date().toISOString(),
  }));
  if (!filas.length) return 0;
  const supabase = getSupabaseServer();
  const { error } = await supabase.from('experimento_tareas').insert(filas);
  if (error) throw new Error(`crearTareasDesde: ${error.message}`);
  return filas.length;
}

/** Mueve una tarea de columna y/o la reordena. `orden` opcional (default: tope). */
export async function moverTarea(id: number, estado: EstadoTarea, orden?: number): Promise<Tarea> {
  const est = estadoOk(estado);
  const patch: Record<string, unknown> = {
    estado: est,
    orden: orden ?? (await ordenTope(est)),
    hecho_at: est === 'hecho' ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };
  const supabase = getSupabaseServer();
  const { data, error } = await supabase.from('experimento_tareas').update(patch).eq('id', id).select(COLS).single();
  if (error) throw new Error(`moverTarea: ${error.message}`);
  return rowTo(data);
}

export async function editarTarea(
  id: number,
  patch: { titulo?: string; detalle?: string | null; prioridad?: Prioridad },
): Promise<Tarea> {
  const upd: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.titulo != null) upd.titulo = patch.titulo.trim() || 'Tarea';
  if (patch.detalle !== undefined) upd.detalle = patch.detalle;
  if (patch.prioridad != null) upd.prioridad = prioridadOk(patch.prioridad);
  const supabase = getSupabaseServer();
  const { data, error } = await supabase.from('experimento_tareas').update(upd).eq('id', id).select(COLS).single();
  if (error) throw new Error(`editarTarea: ${error.message}`);
  return rowTo(data);
}

export async function borrarTarea(id: number): Promise<void> {
  const supabase = getSupabaseServer();
  const { error } = await supabase.from('experimento_tareas').delete().eq('id', id);
  if (error) throw new Error(`borrarTarea: ${error.message}`);
}
