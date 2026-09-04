// =============================================================================
// POST /api/closing/revise — revisión humana de una valoración
// =============================================================================
// Body:
//   { recording_id, mode:'manual', dims?, outcome?, outcome_tone?, summary?, next_step?, note? }
//   { recording_id, mode:'mako', note }   ← re-evalúa con MaKo dándole el comentario
// Pisa el análisis, recalcula el puntaje y registra el cambio en edit_history.
// Gated por el login del dashboard.
// =============================================================================

import type { NextRequest } from 'next/server';
import { reviseAnalysis, reviseWithMako, type ReviseManualInput, type Tone } from '@/lib/closing';
import { integracionConectada } from '@/lib/credenciales';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  // Fase 1: revisar pisa análisis de las llamadas del Fathom global del dueño → solo él.
  if (!(await integracionConectada('fathom'))) return Response.json({ ok: false, error: 'Fathom no está conectado en este workspace. Conéctalo en Configuraciones → Método.' }, { status: 403 });
  let body: { recording_id?: number | string; mode?: string; note?: string } & ReviseManualInput;
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  const recordingId = Number(body.recording_id);
  if (!Number.isFinite(recordingId) || recordingId <= 0) {
    return Response.json({ ok: false, error: 'recording_id requerido' }, { status: 400 });
  }

  try {
    if (body.mode === 'mako') {
      if (!body.note || !body.note.trim()) return Response.json({ ok: false, error: 'note requerido para re-evaluar con MaKo' }, { status: 400 });
      const { score } = await reviseWithMako(recordingId, body.note.trim(), body.autor);
      console.log(`[closing:revise] mako recording_id=${recordingId} score=${score}`);
      return Response.json({ ok: true, mode: 'mako', score });
    }
    // manual
    const input: ReviseManualInput = {
      dims: Array.isArray(body.dims) ? body.dims : undefined,
      outcome: body.outcome,
      outcome_tone: body.outcome_tone as Tone | undefined,
      summary: body.summary,
      next_step: body.next_step,
      note: body.note,
      autor: body.autor,
    };
    const { score } = await reviseAnalysis(recordingId, input);
    console.log(`[closing:revise] manual recording_id=${recordingId} score=${score}`);
    return Response.json({ ok: true, mode: 'manual', score });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[closing:revise] error recording_id=${recordingId}: ${message}`);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
