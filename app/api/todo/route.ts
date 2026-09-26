// =============================================================================
// /api/todo — tablero kanban /todo (tareas + categorías)
// =============================================================================
// GET  → { tareas, categorias }
// POST { action: 'crear'|'crear-lote'|'mover'|'editar'|'borrar'
//               |'categoria-crear'|'categoria-borrar', ... }
// =============================================================================

import type { NextRequest } from 'next/server';
import {
  listTareas, crearTarea, crearTareasDesde, moverTarea, editarTarea, borrarTarea,
  listCategorias, crearCategoria, editarCategoria, borrarCategoria,
  type EstadoTarea, type Prioridad, type OrigenTarea, type ChecklistItem, type HistEntry, type CamposResponsable,
} from '@/lib/todo';
import { priorizarNuevasCliente } from '@/lib/todo-guardian';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
// El Perro hace DOS llamadas de IA (puntuar + checklists) sobre varias tareas: con el
// default se cortaba a la mitad y el board se quedaba esperando sin enterarse.
export const maxDuration = 120;

export async function GET() {
  try {
    const [tareas, categorias] = await Promise.all([listTareas(), listCategorias().catch(() => [])]);
    return Response.json({ ok: true, tareas, categorias });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

type TareaBody = {
  titulo?: string; detalle?: string | null; prioridad?: Prioridad; estado?: EstadoTarea;
  progreso?: number; deadline?: string | null; quarter?: string | null; recurrente?: boolean; categorias?: number[];
  checklist?: ChecklistItem[]; historial?: HistEntry[]; en_prioridad?: boolean; score?: number; score_razon?: string | null;
  origen?: OrigenTarea; retro_id?: number | null; experimento_id?: number | null;
  // DE DÓNDE SALIÓ la tarea (reunión de Fathom + minuto, archivo, WhatsApp). La tabla
  // y lib/todo.ts siempre la soportaron, pero esta ruta no la declaraba ni la pasaba:
  // por eso las tareas del cliente que venían de una reunión perdían el chip de origen
  // y el link al minuto de la grabación, mientras que en el board del dueño sí salían.
  fuente?: { tipo: string; etiqueta?: string; url?: string } | null;
} & CamposResponsable;

/** Los campos de QUIÉN, tal cual vinieron (lib/todo los sanea). Una persona puede
 *  corregir el responsable o el cliente; los del CRITERIO no pasan por esta ruta: son
 *  lo que dijo el juez, y si el cliente los pudiera reescribir dejarían de servir para
 *  saber en qué se equivocó el criterio. */
const responsableDe = (t: TareaBody): CamposResponsable => ({
  responsable: t.responsable, responsable_email: t.responsable_email, responsable_tipo: t.responsable_tipo,
  cliente_nombre: t.cliente_nombre, cliente_lead_id: t.cliente_lead_id, tema: t.tema,
});

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'JSON inválido' }, { status: 400 }); }
  const action = String(body.action ?? '');
  const id = Number(body.id);

  try {
    // El Perro Guardián para el board del CLIENTE. Antes esta acción no existía y el
    // tablero del cliente no tenía forma de invocarlo: sus tareas entraban con el
    // score que había adivinado la extracción, sin razón, sin detalle y sin checklist
    // — que es justo lo que se veía en el tablero de Mauricio.
    if (action === 'priorizar-nuevas') {
      const ids = Array.isArray(body.ids) ? body.ids.map(Number).filter(Number.isFinite) : [];
      if (!ids.length) return Response.json({ ok: false, error: 'sin ids' }, { status: 400 });
      const contexto = typeof body.contexto === 'string' ? body.contexto : '';
      const r = await priorizarNuevasCliente(ids, contexto);
      return Response.json({ ok: true, n: r.n, patches: r.patches });
    }
    if (action === 'crear') {
      const t = body.tarea as TareaBody | undefined;
      if (!t || !t.titulo) return Response.json({ ok: false, error: 'falta el título' }, { status: 400 });
      return Response.json({ ok: true, tarea: await crearTarea({
        titulo: t.titulo, detalle: t.detalle ?? null, prioridad: t.prioridad, estado: t.estado,
        progreso: t.progreso, deadline: t.deadline, categorias: t.categorias,
        origen: t.origen, retro_id: t.retro_id ?? null, experimento_id: t.experimento_id ?? null,
        // La fuente va EN EL ALTA: si se escribiera en un editar posterior, la tarjeta
        // nace sin chip y el Perro la puntúa sin saber de dónde salió.
        fuente: t.fuente ?? null,
        ...responsableDe(t),
      }) });
    }
    if (action === 'crear-lote') {
      const items = (body.items as Array<{ titulo: string; detalle?: string; prioridad?: Prioridad }>) ?? [];
      const meta = (body.meta as { origen?: OrigenTarea; retro_id?: number; experimento_id?: number }) ?? {};
      const n = await crearTareasDesde(items, { origen: meta.origen ?? 'mako', retro_id: meta.retro_id ?? null, experimento_id: meta.experimento_id ?? null });
      return Response.json({ ok: true, creadas: n });
    }
    if (action === 'mover') {
      if (!Number.isFinite(id)) return Response.json({ ok: false, error: 'id requerido' }, { status: 400 });
      const estado = String(body.estado) as EstadoTarea;
      const orden = body.orden != null ? Number(body.orden) : undefined;
      const historial = (body.historial as HistEntry[] | undefined);
      return Response.json({ ok: true, tarea: await moverTarea(id, estado, orden, historial) });
    }
    if (action === 'editar') {
      if (!Number.isFinite(id)) return Response.json({ ok: false, error: 'id requerido' }, { status: 400 });
      const patch = (body.patch as TareaBody) ?? {};
      return Response.json({ ok: true, tarea: await editarTarea(id, {
        titulo: patch.titulo, detalle: patch.detalle, prioridad: patch.prioridad,
        progreso: patch.progreso, deadline: patch.deadline, quarter: patch.quarter, recurrente: patch.recurrente, categorias: patch.categorias,
        checklist: patch.checklist, historial: patch.historial, en_prioridad: patch.en_prioridad, score: patch.score, score_razon: patch.score_razon,
        fuente: patch.fuente,
        ...responsableDe(patch),
      }) });
    }
    if (action === 'borrar') {
      if (!Number.isFinite(id)) return Response.json({ ok: false, error: 'id requerido' }, { status: 400 });
      await borrarTarea(id);
      return Response.json({ ok: true });
    }
    if (action === 'categoria-crear') {
      const nombre = String(body.nombre ?? '');
      const color = String(body.color ?? '#9b9ba2');
      const emoji = body.emoji != null ? String(body.emoji) : undefined;
      const prioridad = body.prioridad != null ? Number(body.prioridad) : undefined;
      const detalle = body.detalle != null ? String(body.detalle) : undefined;
      const historial = body.historial as HistEntry[] | undefined;
      const scoreRazon = body.score_razon != null ? String(body.score_razon) : undefined;
      const deadline = body.deadline != null ? String(body.deadline) : undefined;
      const quarter = body.quarter != null ? String(body.quarter) : undefined;
      if (!nombre.trim()) return Response.json({ ok: false, error: 'falta el nombre' }, { status: 400 });
      return Response.json({ ok: true, categoria: await crearCategoria(nombre, color, emoji, prioridad, detalle, historial, scoreRazon, deadline, quarter) });
    }
    if (action === 'categoria-editar') {
      if (!Number.isFinite(id)) return Response.json({ ok: false, error: 'id requerido' }, { status: 400 });
      const patch = (body.patch as { nombre?: string; color?: string; emoji?: string; prioridad?: number; detalle?: string; historial?: HistEntry[]; score_razon?: string | null; deadline?: string | null; quarter?: string | null }) ?? {};
      return Response.json({ ok: true, categoria: await editarCategoria(id, patch) });
    }
    if (action === 'categoria-borrar') {
      if (!Number.isFinite(id)) return Response.json({ ok: false, error: 'id requerido' }, { status: 400 });
      await borrarCategoria(id);
      return Response.json({ ok: true });
    }
    return Response.json({ ok: false, error: 'action inválida' }, { status: 400 });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
