// =============================================================================
// /api/account-insights — desgloses (edad/género, plataforma, región) de TODA
// la cuenta para un período, directo de Meta.
// =============================================================================
// El resumen de la tab Marketing lo consume para mostrar los mismos gráficos del
// detalle de anuncio (barras + mapa), pero agregando toda la cuenta en vez de un
// solo anuncio. Mismo shape de breakdowns que /api/ad-insights.

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

export async function GET(req: NextRequest) {
  const desde = req.nextUrl.searchParams.get('desde');
  const hasta = req.nextUrl.searchParams.get('hasta');
  if (!isISO(desde) || !isISO(hasta)) return Response.json({ error: 'fechas inválidas' }, { status: 400 });

  // Fase 1: Meta es la integración global del dueño. Otros workspaces reciben el
  // mismo shape de éxito pero con desgloses vacíos (sin key `error`).
  if (!(await esWorkspaceDueno())) {
    return Response.json({ demograficos: [], plataformas: [], regiones: [] });
  }

  const ver = process.env.META_API_VERSION;
  const token = process.env.META_ACCESS_TOKEN;
  const account = process.env.META_AD_ACCOUNT_ID; // ya incluye el prefijo act_
  if (!ver || !token || !account) return Response.json({ error: 'Meta no configurado' }, { status: 500 });

  const timeRange = JSON.stringify({ since: desde, until: hasta });

  // Insights a nivel cuenta con un breakdown. Pagina por seguridad.
  async function insights(breakdowns: string) {
    const u = new URL(`${GRAPH}/${ver}/${account}/insights`);
    u.searchParams.set('fields', 'impressions,reach,spend,actions');
    u.searchParams.set('action_breakdowns', 'action_type');
    u.searchParams.set('breakdowns', breakdowns);
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

  try {
    const [ageArr, platArr, regArr] = await Promise.all([
      insights('age,gender'),
      insights('publisher_platform'),
      insights('region'),
    ]);

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

    return Response.json({ demograficos, plataformas, regiones });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
