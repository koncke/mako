// =============================================================================
// GET /api/closing/transcript?recording_id=N — transcript de una grabación
// =============================================================================
// Lo consume el panel de detalle de /closing para mostrar el transcript completo
// con timestamps clicables (deep-link al player embebido). Gated por el login del
// dashboard. Devuelve líneas con t_seconds ya calculados.
// =============================================================================

import type { NextRequest } from 'next/server';
import { fetchRecordingTranscript } from '@/lib/fathom-api';
import { esWorkspaceDueno } from '@/lib/workspace';

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
  const idRaw = req.nextUrl.searchParams.get('recording_id');
  const recordingId = Number(idRaw);
  // Fase 1: los transcripts vienen del Fathom global del dueño → otros vacío benigno.
  if (!(await esWorkspaceDueno())) {
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
