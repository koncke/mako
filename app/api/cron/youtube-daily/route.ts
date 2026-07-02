// =============================================================================
// Cron: ingesta diaria de YouTube
// =============================================================================
// Vercel cron lo invoca a las 13:15 UTC (≈6:15 AM Tijuana) cada día,
// 15 minutos después del de Meta para no chocar.
// Procesa los videos configurados (VSL + Thanks si está) y los upsertea
// en marketing_metrics_daily con plataforma='youtube'.
// =============================================================================

import type { NextRequest } from 'next/server';
import { processAllVideos } from '@/lib/youtube';
import { ayerEnTijuana } from '@/lib/date-utils';
import { correrPorWorkspace } from '@/lib/cron-workspaces';

export const dynamic = 'force-dynamic';

function checkAuth(request: NextRequest): Response | null {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return Response.json(
      { ok: false, error: 'CRON_SECRET no configurado en env' },
      { status: 500 },
    );
  }
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return Response.json(
      { ok: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }
  return null;
}

export async function GET(request: NextRequest) {
  const authFail = checkAuth(request);
  if (authFail) return authFail;

  const override = request.nextUrl.searchParams.get('fecha');
  const fecha = override ?? ayerEnTijuana();

  const tStart = Date.now();
  const resultados = await correrPorWorkspace('youtube', async () => {
    const results = await processAllVideos(fecha);
    return {
      fecha,
      total: results.length,
      processed: results.filter((r) => r.status === 'ok').length,
      skipped: results.filter((r) => r.status === 'skipped').length,
      errors: results.filter((r) => r.status === 'error').length,
      results,
    };
  });
  const ms = Date.now() - tStart;

  console.log(`[cron:youtube-daily] fecha=${fecha} workspaces=${resultados.length} ms=${ms}`);

  return Response.json({ ok: true, fecha, workspaces: resultados, ms });
}
