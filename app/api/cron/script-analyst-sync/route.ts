// =============================================================================
// GET /api/cron/script-analyst-sync — drena el análisis de guiones en background
// =============================================================================
// Cada corrida procesa un lote (presupuesto de tiempo) y se autocompleta en las
// siguientes, después de que transcribe-ads haya generado los transcripts.
// Auth por CRON_SECRET (Vercel Cron manda el header Authorization: Bearer …).
// =============================================================================

import type { NextRequest } from 'next/server';
import { syncScriptAnalyses } from '@/lib/script-analyst';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function checkAuth(request: NextRequest): Response | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ ok: false, error: 'CRON_SECRET no configurado' }, { status: 500 });
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

export async function GET(request: NextRequest) {
  const authFail = checkAuth(request);
  if (authFail) return authFail;

  try {
    const res = await syncScriptAnalyses();
    console.log(
      `[cron:script-analyst-sync] cand=${res.candidatos} ya=${res.ya_procesados} ` +
      `analizados=${res.analizados} descartados=${res.descartados} err=${res.errores} ` +
      `restantes=${res.restantes} ms=${res.ms}`,
    );
    return Response.json({ ok: true, ...res });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[cron:script-analyst-sync] error: ${message}`);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
