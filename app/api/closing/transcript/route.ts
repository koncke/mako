// =============================================================================
// GET /api/closing/transcript?recording_id=N — transcript de una grabación
// =============================================================================
// Lo consume la pestaña «Transcript» de la ficha de una llamada
// (app/dashboard/bloques/extra/FichaLlamada.tsx) para mostrar el transcript completo
// con timestamps clicables. Devuelve líneas con t_seconds ya calculados.
//
// Puerta (../puerta.ts): admin o closer y el Dashboard en la capa. Es lo que se dijo
// en una llamada: un setter no lo lee. Sin Fathom contesta vacío (lo decide acá).
// =============================================================================

import type { NextRequest } from 'next/server';
import { fetchRecordingTranscript } from '@/lib/fathom-api';
import { integracionConectada } from '@/lib/credenciales';
import { puertaClosing } from '../puerta';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function toSeconds(ts: string | null | undefined): number {
  if (!ts) return 0;
  const p = String(ts).split(':').map(Number);
  if (p.some((n) => Number.isNaN(n))) return 0;
  if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
  if (p.length === 2) return p[0] * 60 + p[1];
  return p[0] || 0;
}

export async function GET(req: NextRequest) {
  const cerrada = await puertaClosing({ fathom: false });
  if (cerrada) return cerrada;
  const idRaw = req.nextUrl.searchParams.get('recording_id');
  const recordingId = Number(idRaw);
  // Fase 1: los transcripts vienen del Fathom global del dueño → otros vacío benigno.
  if (!(await integracionConectada('fathom'))) {
    return Response.json({ ok: true, recording_id: Number.isFinite(recordingId) ? recordingId : 0, count: 0, lines: [] });
  }
  if (!Number.isFinite(recordingId) || recordingId <= 0) {
    return Response.json({ ok: false, error: 'recording_id requerido' }, { status: 400 });
  }
  try {
    const items = await fetchRecordingTranscript(recordingId);
    const lines = items
      .map((it) => ({
        t_seconds: toSeconds(it.timestamp),
        speaker: it.speaker?.display_name ?? null,
        text: (it.text ?? '').trim(),
      }))
      .filter((l) => l.text);
    return Response.json({ ok: true, recording_id: recordingId, count: lines.length, lines });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
