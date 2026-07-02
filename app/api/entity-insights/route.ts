// =============================================================================
// /api/entity-insights — métricas de UNA entidad (campaña o conjunto) para un
// período, directo de Meta. Generaliza /api/ad-insights (que es solo a nivel ad)
// para alimentar el modal de gráficos de campañas/conjuntos del navegador.
// =============================================================================
// Devuelve period (totales), daily (serie diaria) y breakdowns (edad/género,
// plataforma, región). Mismo shape que /api/ad-insights pero sin video/transcript.

import type { NextRequest } from 'next/server';
import { TIPO_DE_CAMBIO_USD_MXN } from '@/lib/config';
import { esWorkspaceDueno } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

const GRAPH = 'https://graph.facebook.com';

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
type Act = Array<{ action_type: string; value: string }>;
function actionVal(actions: Act | undefined, type: string): number {
  if (!actions) return 0;
  const f = actions.find((a) => a.action_type === type);
  return f ? num(f.value) : 0;
}
const usd = (mxn: number) => mxn / TIPO_DE_CAMBIO_USD_MXN;
const isISO = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
const agendasDe = (a: Act | undefined) => actionVal(a, 'offsite_conversion.fb_pixel_custom');
const leadsDe = (a: Act | undefined) => actionVal(a, 'lead') || actionVal(a, 'onsite_conversion.lead_grouped');

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  const desde = req.nextUrl.searchParams.get('desde');
  const hasta = req.nextUrl.searchParams.get('hasta');
  if (!id || !/^\d+$/.test(id)) return Response.json({ error: 'id inválido' }, { status: 400 });
  if (!isISO(desde) || !isISO(hasta)) return Response.json({ error: 'fechas inválidas' }, { status: 400 });

  // Fase 1: Meta es la integración global del dueño. Otros workspaces reciben el
  // mismo shape de éxito pero vacío (sin key `error`) → el modal no rompe.
  if (!(await esWorkspaceDueno())) {
    return Response.json({ period: null, daily: [], demograficos: [], plataformas: [], regiones: [] });
  }

  const ver = process.env.META_API_VERSION;
  const token = process.env.META_ACCESS_TOKEN;
  if (!ver || !token) return Response.json({ error: 'Meta no configurado' }, { status: 500 });

  const timeRange = JSON.stringify({ since: desde, until: hasta });

  async function insights(fields: string, opts: { breakdowns?: string; daily?: boolean } = {}) {
    const u = new URL(`${GRAPH}/${ver}/${id}/insights`);
    u.searchParams.set('fields', fields);
    u.searchParams.set('action_breakdowns', 'action_type');
    if (opts.breakdowns) u.searchParams.set('breakdowns', opts.breakdowns);
    if (opts.daily) u.searchParams.set('time_increment', '1');
    u.searchParams.set('time_range', timeRange);
    u.searchParams.set('limit', '500');
    u.searchParams.set('access_token', token!);
    const out: Record<string, unknown>[] = [];
    let next: string | null = u.toString();
    let pages = 0;
    while (next) {
      if (++pages > 50) break;
      const r: Response = await fetch(next, { cache: 'no-store' });
      const b = await r.json();
      if (b.error) throw new Error(b.error.message);
      for (const row of b.data ?? []) out.push(row);
      next = b.paging?.next ?? null;
    }
    return out;
  }

  const BD_FIELDS = 'impressions,reach,spend,actions';

  try {
    const [pArr, dArr, ageArr, platArr, regArr] = await Promise.all([
      insights('impressions,reach,frequency,clicks,inline_link_clicks,ctr,spend,actions'),
      insights('spend,impressions,reach,clicks,inline_link_clicks,actions', { daily: true }),
      insights(BD_FIELDS, { breakdowns: 'age,gender' }),
      insights(BD_FIELDS, { breakdowns: 'publisher_platform' }),
      insights(BD_FIELDS, { breakdowns: 'region' }),
    ]);

    const p = pArr[0] ?? {};
    const spendMxn = num(p.spend);
    const spendUsd = usd(spendMxn);
    const impressions = num(p.impressions);
    const reach = num(p.reach);
    const linkClicks = num(p.inline_link_clicks);
    const period = {
      impressions, reach, frequency: num(p.frequency),
      clicks: num(p.clicks), link_clicks: linkClicks,
      ctr: p.ctr != null ? num(p.ctr) : null,
      spend_usd: spendUsd, spend_mxn: spendMxn,
      cpm_usd: impressions > 0 ? (spendUsd / impressions) * 1000 : null,
      cpc_usd: linkClicks > 0 ? spendUsd / linkClicks : null,
      agendas: agendasDe(p.actions as Act),
      leads: leadsDe(p.actions as Act),
      landing_views: actionVal(p.actions as Act, 'landing_page_view'),
    };

    const daily = dArr.map((row) => {
      const imp = num(row.impressions);
      const sp = usd(num(row.spend));
      const lc = num(row.inline_link_clicks);
      return {
        fecha: String(row.date_start),
        spend_usd: sp, impressions: imp, reach: num(row.reach),
        clicks: num(row.clicks), link_clicks: lc,
        agendas: agendasDe(row.actions as Act), leads: leadsDe(row.actions as Act),
        ctr: imp > 0 ? (lc / imp) * 100 : 0, cpm_usd: imp > 0 ? (sp / imp) * 1000 : 0,
      };
    }).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));

    const mapBD = (rows: Record<string, unknown>[], label: (r: Record<string, unknown>) => string) =>
      rows.map((r) => ({ label: label(r), impressions: num(r.impressions), reach: num(r.reach), agendas: agendasDe(r.actions as Act), spend_usd: usd(num(r.spend)) }))
        .filter((x) => x.impressions > 0 || x.spend_usd > 0)
        .sort((a, b) => b.impressions - a.impressions);

    const demograficos = ageArr.map((r) => ({
      age: String(r.age ?? '—'),
      genero: (r.gender === 'male' ? 'H' : r.gender === 'female' ? 'M' : '?') as 'H' | 'M' | '?',
      impressions: num(r.impressions), reach: num(r.reach), agendas: agendasDe(r.actions as Act), spend_usd: usd(num(r.spend)),
    })).filter((x) => x.impressions > 0 || x.spend_usd > 0);
    const plataformas = mapBD(platArr, (r) => String(r.publisher_platform ?? '—'));
    const regiones = mapBD(regArr, (r) => String(r.region ?? '—')).slice(0, 40);

    return Response.json({ period, daily, demograficos, plataformas, regiones });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
