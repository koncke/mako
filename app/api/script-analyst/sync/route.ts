// =============================================================================
// POST /api/script-analyst/sync — analiza los guiones pendientes (Scripts Analyst)
// =============================================================================
// Toma los anuncios con transcript de video en ad_transcripts, corre Claude sobre
// los que no tienen fila todavía (presupuesto por corrida) y persiste en
// script_analyses. Lo dispara el botón "Sincronizar" de la vista; el cron
// script-analyst-sync drena el resto en background. Gateado por el middleware.
// =============================================================================

import type { NextRequest } from 'next/server';
import { syncScriptAnalyses } from '@/lib/script-analyst';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  let body: { max?: number; force?: boolean } = {};
  try { body = await req.json(); } catch { /* body opcional */ }

  try {
    const res = await syncScriptAnalyses({ max: body.max, force: body.force });
    console.log(
      `[script-analyst:sync] cand=${res.candidatos} ya=${res.ya_procesados} ` +
      `analizados=${res.analizados} descartados=${res.descartados} err=${res.errores} ` +
      `restantes=${res.restantes} ms=${res.ms}`,
    );
    return Response.json({ ok: true, ...res });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[script-analyst:sync] error: ${message}`);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
