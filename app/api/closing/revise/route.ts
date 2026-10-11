// =============================================================================
// POST /api/closing/revise — revisión humana de una valoración
// =============================================================================
// Body:
//   { recording_id, mode:'manual', dims?, outcome?, outcome_tone?, summary?, next_step?, note? }
//   { recording_id, mode:'mako', note }   ← re-evalúa con MaKo dándole el comentario
// Pisa el análisis, recalcula el puntaje y registra el cambio en edit_history.
// Lo usan «Revisar a mano» y «Re-evaluar con MaKo» de la ficha de una llamada
// (app/dashboard/bloques/extra/FichaLlamada.tsx).
//
// Puerta (../puerta.ts): admin o closer, el Dashboard en la capa y Fathom conectado
// (re-evaluar con MaKo paga IA). El AUTOR del historial lo pone el server con la
// sesión: el `autor` del cuerpo se ignora (lo escribiría cualquiera).
// =============================================================================

import type { NextRequest } from 'next/server';
import { reviseAnalysis, reviseWithMako, type ReviseManualInput, type Tone } from '@/lib/closing';
import { getUsuarioActual } from '@/lib/auth';
import { puertaClosing } from '../puerta';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const cerrada = await puertaClosing({ fathom: true });
  if (cerrada) return cerrada;
  let body: { recording_id?: number | string; mode?: string; note?: string } & ReviseManualInput;
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  const recordingId = Number(body.recording_id);
  if (!Number.isFinite(recordingId) || recordingId <= 0) {
    return Response.json({ ok: false, error: 'recording_id requerido' }, { status: 400 });
  }
  const quien = (await getUsuarioActual())?.nombre?.trim() || null;

  try {
    if (body.mode === 'mako') {
      if (!body.note || !body.note.trim()) return Response.json({ ok: false, error: 'Escribe qué viste distinto para que MaKo re-evalúe' }, { status: 400 });
      const { score } = await reviseWithMako(recordingId, body.note.trim(), quien ? `MaKo (pidió ${quien})` : undefined);
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
      autor: quien ?? undefined,
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
