// =============================================================================
// /api/checklist-coach — MaKo te ayuda a optimizar tareas y crear proyectos
// =============================================================================
// POST { action: 'ask', tarea, contexto? }        → { ok, preguntas }        (texto)
// POST { action: 'propose', tarea, respuestas }    → { ok, titulo, detalle, items }
// POST { action: 'proyecto', descripcion }         → { ok, nombre, emoji }
// =============================================================================

import type { NextRequest } from 'next/server';
import { preguntarChecklist, optimizarTarea, proponerProyecto } from '@/lib/checklist-coach';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function POST(req: NextRequest) {
  let body: { action?: string; tarea?: string; contexto?: string; respuestas?: string; descripcion?: string };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  try {
    if (body.action === 'proyecto') {
      const descripcion = String(body.descripcion ?? '').trim();
      if (!descripcion) return Response.json({ ok: false, error: 'Falta la descripción.' }, { status: 400 });
      const p = await proponerProyecto(descripcion);
      return Response.json({ ok: true, ...p });
    }
    const tarea = String(body.tarea ?? '').trim();
    if (!tarea) return Response.json({ ok: false, error: 'Falta la tarea.' }, { status: 400 });
    if (body.action === 'ask') {
      const preguntas = await preguntarChecklist(tarea, String(body.contexto ?? ''));
      return Response.json({ ok: true, preguntas });
    }
    if (body.action === 'propose') {
      const r = await optimizarTarea(tarea, String(body.respuestas ?? ''));
      return Response.json({ ok: true, ...r });
    }
    return Response.json({ ok: false, error: 'action inválida' }, { status: 400 });
  } catch (e) {
    console.error(`[api:checklist-coach] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
