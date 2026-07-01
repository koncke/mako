// =============================================================================
// /api/todo — tablero kanban de tareas (tab To-do de /experimentos)
// =============================================================================
// GET  → { tareas }
// POST { action: 'crear'|'crear-lote'|'mover'|'editar'|'borrar', ... }
// =============================================================================

import type { NextRequest } from 'next/server';
import {
  listTareas, crearTarea, crearTareasDesde, moverTarea, editarTarea, borrarTarea,
  type EstadoTarea, type Prioridad, type OrigenTarea,
} from '@/lib/todo';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    return Response.json({ ok: true, tareas: await listTareas() });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'JSON inválido' }, { status: 400 }); }
  const action = String(body.action ?? '');
  const id = Number(body.id);

  try {
    if (action === 'crear') {
      const t = body.tarea as { titulo?: string; detalle?: string; prioridad?: Prioridad; estado?: EstadoTarea; origen?: OrigenTarea; retro_id?: number | null; experimento_id?: number | null } | undefined;
      if (!t || !t.titulo) return Response.json({ ok: false, error: 'falta el título' }, { status: 400 });
      return Response.json({ ok: true, tarea: await crearTarea({
        titulo: t.titulo, detalle: t.detalle ?? null, prioridad: t.prioridad, estado: t.estado,
        origen: t.origen, retro_id: t.retro_id ?? null, experimento_id: t.experimento_id ?? null,
      }) });
    }
    if (action === 'crear-lote') {
      const items = (body.items as Array<{ titulo: string; detalle?: string; prioridad?: Prioridad }>) ?? [];
      const meta = (body.meta as { origen?: 'retro' | 'experimento' | 'mako' | 'manual'; retro_id?: number; experimento_id?: number }) ?? {};
      const n = await crearTareasDesde(items, { origen: meta.origen ?? 'mako', retro_id: meta.retro_id ?? null, experimento_id: meta.experimento_id ?? null });
      return Response.json({ ok: true, creadas: n });
    }
    if (action === 'mover') {
      if (!Number.isFinite(id)) return Response.json({ ok: false, error: 'id requerido' }, { status: 400 });
      const estado = String(body.estado) as EstadoTarea;
      const orden = body.orden != null ? Number(body.orden) : undefined;
      return Response.json({ ok: true, tarea: await moverTarea(id, estado, orden) });
    }
    if (action === 'editar') {
      if (!Number.isFinite(id)) return Response.json({ ok: false, error: 'id requerido' }, { status: 400 });
      const patch = body.patch as { titulo?: string; detalle?: string | null; prioridad?: Prioridad };
      return Response.json({ ok: true, tarea: await editarTarea(id, patch ?? {}) });
    }
    if (action === 'borrar') {
      if (!Number.isFinite(id)) return Response.json({ ok: false, error: 'id requerido' }, { status: 400 });
      await borrarTarea(id);
      return Response.json({ ok: true });
    }
    return Response.json({ ok: false, error: 'action inválida' }, { status: 400 });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
