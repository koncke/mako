// =============================================================================
// Cron: los números por día del VSL cuando está en Wistia o en Bunny Stream (25/10/2026)
// =============================================================================
// «Otros alojadores de video» (Martín, por el Cerebro): lo mismo que app/api/cron/panda-daily para los dos alojadores que
// dan reproducciones por día por API sin ser Enterprise. Una fila por día con plataforma = el alojador, en las columnas
// video_* (la serie del VSL, el funnel y /general las leen de TODAS las plataformas de video: PLATAFORMAS_VIDEO).
//
// ⚠️ SÓLO EL VIDEO QUE EL NEGOCIO MARCÓ COMO SU VSL («Nombrar videos», `vslDe`), no toda la cuenta: Panda escribe sólo los
// ids que se le configuraron, y escribir todos los videos de Wistia o Bunny metería las clases de un curso en el paso
// «vio el VSL» del funnel. Sin VSL de ese alojador, el negocio se OMITE (no es un error).
// Auth: Bearer ${CRON_SECRET}. Schedule: 35 13 * * * (6:35 AM Tijuana), antes del de Panda.
// =============================================================================

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { getTenantDb } from '@/lib/workspace';
import { correrPorWorkspace } from '@/lib/cron-workspaces';
import { ayerEnTijuana } from '@/lib/date-utils';
import { getVideosLanding } from '@/lib/landing-token';
import { vslDe } from '@/lib/landing-videos';
import { numerosDelDia } from '@/lib/alojadores-video-api';
import type { MarketingMetricRow } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const PREFIJO = { wistia: 'w:', bunny: 'bunny:' } as const;

export async function GET(request: NextRequest) {
  const authFail = checkCronAuth(request);
  if (authFail) return authFail;
  const fecha = request.nextUrl.searchParams.get('fecha') ?? ayerEnTijuana();
  const tStart = Date.now();

  const rondas: Record<string, Awaited<ReturnType<typeof correrPorWorkspace>>> = {};
  for (const alojador of ['wistia', 'bunny'] as const) {
    rondas[alojador] = await correrPorWorkspace(alojador, async () => {
      const vsl = vslDe(await getVideosLanding());
      if (!vsl || !vsl.id.startsWith(PREFIJO[alojador])) return { omitido: `el VSL no está en ${alojador}` };
      const n = await numerosDelDia(alojador, vsl.id, fecha);
      if (!n) return { omitido: 'ese día no tiene números' };
      const row: MarketingMetricRow & {
        video_id?: string | null; video_variant?: string | null; video_plays?: number | null;
        video_unique_viewers?: number | null; video_retention_p50?: number | null; video_avg_watch_seconds?: number | null;
      } = {
        fecha, plataforma: alojador, video_id: vsl.id, video_variant: vsl.id, video_plays: n.plays,
        // Ni Wistia ni Bunny dan espectadores únicos ni una retención por día: null (no se sabe), nunca cero.
        video_unique_viewers: null, video_retention_p50: null, video_avg_watch_seconds: n.promedioSeg,
        raw_payload: n.crudo,
      };
      const supabase = await getTenantDb();
      await supabase.from('marketing_metrics_daily').delete().eq('fecha', fecha).eq('plataforma', alojador).eq('video_id', vsl.id);
      const { error } = await supabase.from('marketing_metrics_daily').insert(row);
      if (error) throw new Error(error.message);
      return { video: vsl.id, plays: n.plays };
    });
  }

  // Como panda-daily: 500 sólo si NADA de lo configurado entró; un negocio omitido no es un error.
  const todos = Object.values(rondas).flat();
  const configurados = todos.filter((w) => !(w.resultado as { omitido?: string } | undefined)?.omitido);
  const algunoOk = configurados.some((w) => w.ok);
  const ok = configurados.length === 0 || algunoOk;
  console.log(`[cron:videos-daily] fecha=${fecha} configurados=${configurados.length} ok=${ok} ms=${Date.now() - tStart}`);
  return Response.json({ ok, fecha, rondas, ms: Date.now() - tStart }, { status: ok ? 200 : 500 });
}
