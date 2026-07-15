// =============================================================================
// GET /api/cron/closing-sync — drena el análisis de cierres en background
// =============================================================================
// Cada corrida procesa un lote (presupuesto de tiempo) y se autocompleta en las
// siguientes; el histórico se siembra una vez con scripts/backfill-closing.mjs.
// Auth por CRON_SECRET (Vercel Cron manda el header Authorization: Bearer …).
// =============================================================================

import type { NextRequest } from 'next/server';
import { syncClosingCalls } from '@/lib/closing';
import { adjuntarFathomAuto } from '@/lib/fathom-auto';
import { correrPorWorkspace } from '@/lib/cron-workspaces';

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
    const resultados = await correrPorWorkspace('fathom', async () => {
      const res = await syncClosingCalls();
      console.log(
        `[cron:closing-sync] fathom=${res.total_fathom} ya=${res.ya_procesadas} cand=${res.candidatas} ` +
        `analizadas=${res.analizadas} ventas=${res.ventas} servicio=${res.servicio} otras=${res.otras} err=${res.errores} ` +
        `restantes=${res.restantes} ms=${res.ms}`,
      );
      // Auto-adjuntar la grabación de Fathom a los leads con reunión reciente ya
      // pasada y sin grabación (seguro; no mueve al lead de etapa).
      const fa = await adjuntarFathomAuto().catch((e) => { console.error(`[cron:closing-sync] fathom-auto: ${e instanceof Error ? e.message : String(e)}`); return { revisados: 0, adjuntados: 0 }; });
      console.log(`[cron:closing-sync] fathom-auto revisados=${fa.revisados} adjuntados=${fa.adjuntados}`);
      return { ...res, fathom_auto: fa };
    });
    return Response.json({ ok: true, workspaces: resultados });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[cron:closing-sync] error: ${message}`);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
