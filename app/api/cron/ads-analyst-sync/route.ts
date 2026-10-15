// =============================================================================
// GET /api/cron/ads-analyst-sync — drena el análisis de guiones en background
// =============================================================================
// Cada corrida procesa un lote (presupuesto de tiempo) y se autocompleta en las
// siguientes, después de que transcribe-ads haya generado los transcripts.
// Auth por CRON_SECRET (Vercel Cron manda el header Authorization: Bearer …).
// =============================================================================

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { syncScriptAnalyses } from '@/lib/ads-analyst';
import { correrPorWorkspace } from '@/lib/cron-workspaces';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const authFail = checkCronAuth(request);
  if (authFail) return authFail;

  try {
    const resultados = await correrPorWorkspace('meta', async () => {
      const res = await syncScriptAnalyses();
      console.log(
        `[cron:ads-analyst-sync] cand=${res.candidatos} ya=${res.ya_procesados} ` +
        `analizados=${res.analizados} descartados=${res.descartados} err=${res.errores} ` +
        `restantes=${res.restantes} ms=${res.ms}`,
      );
      return res;
    });
    return Response.json({ ok: true, workspaces: resultados });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[cron:ads-analyst-sync] error: ${message}`);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
