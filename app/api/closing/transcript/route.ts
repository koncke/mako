// =============================================================================
// GET /api/closing/transcript?recording_id=N — transcript de una grabación
// =============================================================================
// Lo consume la pestaña «Transcript» de la ficha de una llamada
// (app/dashboard/entidades/llamada.tsx) para mostrar el transcript completo
// con timestamps clicables. Devuelve líneas con t_seconds ya calculados.
//
// Puerta (../puerta.ts): admin o closer y el Dashboard en la capa. Es lo que se dijo
// en una llamada: un setter no lo lee. Sin un grabador conectado contesta vacío (lo decide acá).
// De cualquier grabador (lib/grabadores, 26/10/2026): el de esa llamada, por su clave.
// =============================================================================

import type { NextRequest } from 'next/server';
import { hayGrabadorConectado, leerTranscripcionPorClave } from '@/lib/grabadores';
import { puertaClosing } from '../puerta';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const cerrada = await puertaClosing({ fathom: false });
  if (cerrada) return cerrada;
  const idRaw = req.nextUrl.searchParams.get('recording_id');
  const recordingId = Number(idRaw);
  // Sin un grabador conectado no hay de dónde leer: vacío benigno, como siempre.
  if (!(await hayGrabadorConectado())) {
    return Response.json({ ok: true, recording_id: Number.isFinite(recordingId) ? recordingId : 0, count: 0, lines: [] });
  }
  // La clave de la reunión: Fathom, positiva; los demás grabadores, negativa (lib/grabadores/reunion.ts).
  if (!Number.isSafeInteger(recordingId) || recordingId === 0) {
    return Response.json({ ok: false, error: 'recording_id requerido' }, { status: 400 });
  }
  try {
    const items = await leerTranscripcionPorClave(recordingId);
    const lines = items
      .map((it) => ({
        t_seconds: it.segundo ?? 0,
        speaker: it.hablante,
        text: (it.texto ?? '').trim(),
      }))
      .filter((l) => l.text);
    return Response.json({ ok: true, recording_id: recordingId, count: lines.length, lines });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
