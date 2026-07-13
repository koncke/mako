// =============================================================================
// /api/mako-guardian — el perro guardián puntúa el plan (score 1-100 / 1-5)
// =============================================================================
// POST { proyectos:[{id,nombre}], tareas:[{id,titulo,detalle,...}], contexto? }
//   → { ok, proyectos:[{id,score,razon}], tareas:[{id,score,razon}] }
// =============================================================================

import type { NextRequest } from 'next/server';
import { puntuarPlan, debatirPrioridad, debatirProyecto, type GuardProjIn, type GuardTaskIn } from '@/lib/mako-guardian';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function POST(req: NextRequest) {
  let body: { action?: string; proyectos?: GuardProjIn[]; tareas?: GuardTaskIn[]; contexto?: string; tarea?: string; proyecto?: string; scoreActual?: number; argumento?: string; plan?: string };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  try {
    if (body.action === 'debatir') {
      const tarea = String(body.tarea ?? '').trim();
      const argumento = String(body.argumento ?? '').trim();
      if (!tarea || !argumento) return Response.json({ ok: false, error: 'Falta la tarea o el argumento.' }, { status: 400 });
      const out = await debatirPrioridad(tarea, Number(body.scoreActual) || 0, argumento, String(body.plan ?? ''));
      return Response.json({ ok: true, ...out });
    }
    if (body.action === 'debatir-proyecto') {
      const proyecto = String(body.proyecto ?? '').trim();
      const argumento = String(body.argumento ?? '').trim();
      if (!proyecto || !argumento) return Response.json({ ok: false, error: 'Falta el proyecto o el argumento.' }, { status: 400 });
      const out = await debatirProyecto(proyecto, Number(body.scoreActual) || 5, argumento, String(body.plan ?? ''));
      return Response.json({ ok: true, ...out });
    }
    // default: puntuar todo el plan
    const proyectos = Array.isArray(body.proyectos) ? body.proyectos : [];
    const tareas = Array.isArray(body.tareas) ? body.tareas : [];
    if (tareas.length === 0) return Response.json({ ok: false, error: 'No hay tareas para priorizar.' }, { status: 400 });
    const out = await puntuarPlan(proyectos, tareas, String(body.contexto ?? ''));
    return Response.json({ ok: true, ...out });
  } catch (e) {
    console.error(`[api:mako-guardian] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
