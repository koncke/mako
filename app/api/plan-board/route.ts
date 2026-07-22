// =============================================================================
// /api/plan-board — tablero /plan del dueño (agencia), ahora en Supabase (mig 0093)
// =============================================================================
// GET  → { tareas, proyectos, vacio }
// POST { action: 'crear-tarea'|'guardar-tarea'|'borrar-tarea'
//               |'crear-proyecto'|'guardar-proyecto'|'borrar-proyecto'
//               |'migrar', ... }
// Guardado a SUPER-ADMIN: es el board de la agencia (OWNER_WS lo fuerza la capa).
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { getSesionAdmin } from '@/lib/auth';
import {
  listPlanBoard, planVacio, crearPlanTarea, guardarPlanTarea, borrarPlanTarea,
  crearPlanProyecto, guardarPlanProyecto, borrarPlanProyecto, guardarPlanBulk,
} from '@/lib/plan-board';
import type { BoardTask, Label } from '@/app/plan/board/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  if (!(await getSesionAdmin())) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });
  try {
    const [{ tareas, proyectos }, vacio] = await Promise.all([listPlanBoard(), planVacio()]);
    return NextResponse.json({ ok: true, tareas, proyectos, vacio });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await getSesionAdmin())) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 }); }
  const action = String(body.action ?? '');

  try {
    if (action === 'crear-tarea') {
      const t = body.tarea as BoardTask | undefined;
      if (!t?.title?.trim()) return NextResponse.json({ ok: false, error: 'falta el título' }, { status: 400 });
      return NextResponse.json({ ok: true, tarea: await crearPlanTarea(t) });
    }
    if (action === 'guardar-tarea') {
      const t = body.tarea as BoardTask | undefined;
      if (!t?.id) return NextResponse.json({ ok: false, error: 'falta la tarea' }, { status: 400 });
      await guardarPlanTarea(t);
      return NextResponse.json({ ok: true });
    }
    if (action === 'borrar-tarea') {
      const id = String(body.id ?? '');
      if (!id) return NextResponse.json({ ok: false, error: 'id requerido' }, { status: 400 });
      await borrarPlanTarea(id);
      return NextResponse.json({ ok: true });
    }
    if (action === 'crear-proyecto') {
      const p = body.proyecto as Label | undefined;
      if (!p?.name?.trim()) return NextResponse.json({ ok: false, error: 'falta el nombre' }, { status: 400 });
      return NextResponse.json({ ok: true, proyecto: await crearPlanProyecto(p) });
    }
    if (action === 'guardar-proyecto') {
      const p = body.proyecto as Label | undefined;
      if (!p?.id) return NextResponse.json({ ok: false, error: 'falta el proyecto' }, { status: 400 });
      await guardarPlanProyecto(p);
      return NextResponse.json({ ok: true });
    }
    if (action === 'borrar-proyecto') {
      const id = String(body.id ?? '');
      if (!id) return NextResponse.json({ ok: false, error: 'id requerido' }, { status: 400 });
      await borrarPlanProyecto(id);
      return NextResponse.json({ ok: true });
    }
    if (action === 'migrar') {
      const tareas = (body.tareas as BoardTask[] | undefined) ?? [];
      const proyectos = (body.proyectos as Label[] | undefined) ?? [];
      const r = await guardarPlanBulk(tareas, proyectos);
      return NextResponse.json({ ok: true, migrado: r });
    }
    return NextResponse.json({ ok: false, error: 'action inválida' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
