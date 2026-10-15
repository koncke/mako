// =============================================================================
// Cron: ingesta diaria de YouTube
// =============================================================================
// Vercel cron lo invoca a las 13:15 UTC (≈6:15 AM Tijuana) cada día,
// 15 minutos después del de Meta para no chocar.
// Procesa los videos configurados (VSL + Thanks si está) y los upsertea
// en marketing_metrics_daily con plataforma='youtube'.
// =============================================================================

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { processAllVideos } from '@/lib/youtube';
import { ayerEnTijuana } from '@/lib/date-utils';
import { correrPorWorkspace } from '@/lib/cron-workspaces';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authFail = checkCronAuth(request);
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

  // Mismo criterio que panda-daily (y que nutricion:152): un cron que no ingestó NADA
  // de lo que SÍ estaba configurado no puede responder ok:true — así la falta de datos
  // era invisible desde afuera. Un workspace con todo 'skipped' es config faltante, no
  // un fallo: se omite del cálculo en vez de contarse como error, o el cron viviría en
  // 500 por un cliente que legítimamente no cargó ningún video.
  const configurados = resultados.filter((w) => {
    const r = w.resultado as { total?: number; skipped?: number } | undefined;
    return !!r && (r.total ?? 0) > (r.skipped ?? 0);
  });
  const conError = configurados.filter((w) => !w.ok || ((w.resultado as { errors?: number } | undefined)?.errors ?? 0) > 0);
  const ingestó = configurados.some((w) => ((w.resultado as { processed?: number } | undefined)?.processed ?? 0) > 0);
  const ok = configurados.length === 0 || ingestó;

  console.log(`[cron:youtube-daily] fecha=${fecha} ws=${resultados.length} configurados=${configurados.length} conError=${conError.length} ingesto=${ingestó} ms=${ms}`);

  return Response.json({ ok, parcial: conError.length > 0, fecha, workspaces: resultados, ms }, { status: ok ? 200 : 500 });
}
