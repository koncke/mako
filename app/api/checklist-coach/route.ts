// =============================================================================
// /api/checklist-coach — MaKo ayuda a armar la checklist de una tarea
// =============================================================================
// POST { action: 'ask', tarea, contexto? }      → { ok, preguntas }   (texto)
// POST { action: 'propose', tarea, respuestas }  → { ok, items }       (JSON)
// =============================================================================

import type { NextRequest } from 'next/server';
import { preguntarChecklist, proponerChecklist } from '@/lib/checklist-coach';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function POST(req: NextRequest) {
  let body: { action?: string; tarea?: string; contexto?: string; respuestas?: string };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  const tarea = String(body.tarea ?? '').trim();
  if (!tarea) return Response.json({ ok: false, error: 'Falta la tarea.' }, { status: 400 });

  try {
    if (body.action === 'ask') {
      const preguntas = await preguntarChecklist(tarea, String(body.contexto ?? ''));
      return Response.json({ ok: true, preguntas });
    }
    if (body.action === 'propose') {
      const items = await proponerChecklist(tarea, String(body.respuestas ?? ''));
      return Response.json({ ok: true, items });
    }
    return Response.json({ ok: false, error: 'action inválida' }, { status: 400 });
  } catch (e) {
    console.error(`[api:checklist-coach] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
