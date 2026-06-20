// =============================================================================
// /api/ad-insights — métricas de UN anuncio para un período, directo de Meta
// =============================================================================
// El modal de /anuncios consume esto para mostrar datos que COINCIDEN con Meta:
//   - Totales del período (frecuencia con alcance ÚNICO, impresiones, alcance,
//     clics, CPM/CPC, agendas, video) — un insights SIN time_increment.
//   - Serie diaria (time_increment=1) para los gráficos y para detectar el rango
//     activo y los intervalos inactivos.
// Derivar estos números de las filas diarias agregadas daba mal (la frecuencia
// no es promediable; el alcance no es aditivo). Por eso se piden a Meta aquí.

import type { NextRequest } from 'next/server';
import { TIPO_DE_CAMBIO_USD_MXN } from '@/lib/config';

export const dynamic = 'force-dynamic';

const GRAPH = 'https://graph.facebook.com';

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function actionVal(actions: Array<{ action_type: string; value: string }> | undefined, type: string): number {
  if (!actions) return 0;
  const f = actions.find((a) => a.action_type === type);
  return f ? num(f.value) : 0;
}
function addDays(iso: string, d: number): string {
  const [y, m, dd] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, dd + d));
  return dt.toISOString().slice(0, 10);
}
const isISO = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

export async function GET(req: NextRequest) {
  const adId = req.nextUrl.searchParams.get('ad_id');
  const desde = req.nextUrl.searchParams.get('desde');
  const hasta = req.nextUrl.searchParams.get('hasta');
  if (!adId || !/^\d+$/.test(adId)) return Response.json({ error: 'ad_id inválido' }, { status: 400 });
  if (!isISO(desde) || !isISO(hasta)) return Response.json({ error: 'fechas inválidas' }, { status: 400 });

  const ver = process.env.META_API_VERSION;
  const token = process.env.META_ACCESS_TOKEN;
  if (!ver || !token) return Response.json({ error: 'Meta no configurado' }, { status: 500 });

  const timeRange = JSON.stringify({ since: desde, until: hasta });
  const periodFields = 'ad_name,impressions,reach,frequency,clicks,inline_link_clicks,ctr,spend,actions,video_thruplay_watched_actions,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p100_watched_actions,video_avg_time_watched_actions';

  try {
    // 1) Totales del período (alcance único → frecuencia correcta)
    const pUrl = new URL(`${GRAPH}/${ver}/${adId}/insights`);
    pUrl.searchParams.set('fields', periodFields);
    pUrl.searchParams.set('action_breakdowns', 'action_type');
    pUrl.searchParams.set('time_range', timeRange);
    pUrl.searchParams.set('access_token', token);
    const pRes = await fetch(pUrl, { cache: 'no-store' });
    const pBody = await pRes.json();
    if (pBody.error) return Response.json({ error: pBody.error.message }, { status: 502 });
    const p = pBody.data?.[0] ?? {};

    const spendMxn = num(p.spend);
    const spendUsd = spendMxn / TIPO_DE_CAMBIO_USD_MXN;
    const impressions = num(p.impressions);
    const reach = num(p.reach);
    const linkClicks = num(p.inline_link_clicks);
    const clicks = num(p.clicks);
    const video3s = actionVal(p.actions, 'video_view');
    const period = {
      ad_name: p.ad_name ?? null,
      impressions,
      reach,
      frequency: num(p.frequency),
      clicks,
      link_clicks: linkClicks,
      ctr: p.ctr != null ? num(p.ctr) : null, // % (Meta)
      spend_usd: spendUsd,
      spend_mxn: spendMxn,
      cpm_usd: impressions > 0 ? (spendUsd / impressions) * 1000 : null,
      cpc_usd: linkClicks > 0 ? spendUsd / linkClicks : null,
      agendas: actionVal(p.actions, 'offsite_conversion.fb_pixel_custom'),
      leads: actionVal(p.actions, 'lead') || actionVal(p.actions, 'onsite_conversion.lead_grouped'),
      landing_views: actionVal(p.actions, 'landing_page_view'),
      video_plays_3s: video3s,
      video_thruplay: actionVal(p.video_thruplay_watched_actions, 'video_view'),
      video_p25: actionVal(p.video_p25_watched_actions, 'video_view'),
      video_p50: actionVal(p.video_p50_watched_actions, 'video_view'),
      video_p75: actionVal(p.video_p75_watched_actions, 'video_view'),
      video_p100: actionVal(p.video_p100_watched_actions, 'video_view'),
      video_avg_watch_s: actionVal(p.video_avg_time_watched_actions, 'video_view'),
    };

    // 2) Serie diaria (para gráficos + actividad)
    const dUrl = new URL(`${GRAPH}/${ver}/${adId}/insights`);
    dUrl.searchParams.set('fields', 'spend,impressions,reach,inline_link_clicks,actions');
    dUrl.searchParams.set('action_breakdowns', 'action_type');
    dUrl.searchParams.set('time_increment', '1');
    dUrl.searchParams.set('time_range', timeRange);
    dUrl.searchParams.set('limit', '500');
    dUrl.searchParams.set('access_token', token);
    const daily: Array<{ fecha: string; spend_usd: number; impressions: number; reach: number; link_clicks: number; agendas: number }> = [];
    let next: string | null = dUrl.toString();
    let pages = 0;
    while (next) {
      if (++pages > 50) break;
      const r: Response = await fetch(next, { cache: 'no-store' });
      const b = await r.json();
      if (b.error) break;
      for (const row of b.data ?? []) {
        daily.push({
          fecha: row.date_start,
          spend_usd: num(row.spend) / TIPO_DE_CAMBIO_USD_MXN,
          impressions: num(row.impressions),
          reach: num(row.reach),
          link_clicks: num(row.inline_link_clicks),
          agendas: actionVal(row.actions, 'offsite_conversion.fb_pixel_custom'),
        });
      }
      next = b.paging?.next ?? null;
    }
    daily.sort((a, b) => (a.fecha < b.fecha ? -1 : 1));

    // 3) Rango activo + intervalos inactivos (días con gasto 0 entre primero y último activo)
    const activos = daily.filter((d) => d.spend_usd > 0).map((d) => d.fecha);
    let activity: { primero: string | null; ultimo: string | null; dias_activos: number; gaps: Array<{ desde: string; hasta: string; dias: number }> } = { primero: null, ultimo: null, dias_activos: activos.length, gaps: [] };
    if (activos.length > 0) {
      const set = new Set(activos);
      const primero = activos[0];
      const ultimo = activos[activos.length - 1];
      const gaps: Array<{ desde: string; hasta: string; dias: number }> = [];
      let cur = primero, gapStart: string | null = null;
      while (cur <= ultimo) {
        if (!set.has(cur)) { if (!gapStart) gapStart = cur; }
        else if (gapStart) { gaps.push({ desde: gapStart, hasta: addDays(cur, -1), dias: 0 }); gapStart = null; }
        cur = addDays(cur, 1);
      }
      for (const g of gaps) { const [y1, m1, d1] = g.desde.split('-').map(Number); const [y2, m2, d2] = g.hasta.split('-').map(Number); g.dias = Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000) + 1; }
      activity = { primero, ultimo, dias_activos: activos.length, gaps };
    }

    return Response.json({ period, daily, activity });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
