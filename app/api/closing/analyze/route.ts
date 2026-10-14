// =============================================================================
// POST /api/closing/analyze — (re)analiza UNA grabación puntual
// =============================================================================
// Body: { recording_id: number }. Baja el contenido de Fathom, corre Claude y
// hace upsert en closing_analyses. Sirve para forzar el re-análisis de una
// llamada (p.ej. clasificada mal, o que falló): «↻ Re-analizar» de la ficha de
// una llamada (app/dashboard/entidades/llamada.tsx).
//
// Puerta (../puerta.ts): admin o closer, el Dashboard en la capa y Fathom conectado.
// Paga IA: un setter no llega acá.
// =============================================================================

import type { NextRequest } from 'next/server';
import { analyzeOne } from '@/lib/closing';
import { puertaClosing } from '../puerta';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const cerrada = await puertaClosing({ fathom: true });
  if (cerrada) return cerrada;
  let body: { recording_id?: number | string };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  const recordingId = Number(body.recording_id);
  if (!Number.isFinite(recordingId) || recordingId <= 0) {
    return Response.json({ ok: false, error: 'recording_id requerido' }, { status: 400 });
  }

  try {
    const status = await analyzeOne(recordingId);
    console.log(`[closing:analyze] recording_id=${recordingId} status=${status}`);
    return Response.json({ ok: true, recording_id: recordingId, status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[closing:analyze] error recording_id=${recordingId}: ${message}`);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
