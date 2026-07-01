// =============================================================================
// /api/ads-manager/adset-add — agregar un conjunto a una campaña (todo en PAUSA)
// =============================================================================
// GET  ?campaign_id=<id>           → { objective, budgetLevel, optimization, needsForm, needsConv }
// POST { campaign_id, adset }      → crea el conjunto + sus anuncios (PAUSED)
// El objetivo/nivel de presupuesto se derivan de la campaña (no del cliente).
// =============================================================================

import type { NextRequest } from 'next/server';
import { getCampaignBasics, addAdsetToCampaign, metaErrorEnvelope } from '@/lib/meta-ads-create';
import type { AdSetSpec } from '@/lib/campaign-types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const campaignId = req.nextUrl.searchParams.get('campaign_id') ?? '';
  if (!/^\d+$/.test(campaignId)) return Response.json({ ok: false, error: 'campaign_id inválido' }, { status: 400 });
  try {
    return Response.json({ ok: true, campaign: await getCampaignBasics(campaignId) });
  } catch (err) {
    const env = metaErrorEnvelope(err);
    console.error(`[ads-manager:adset-add GET] ${env.message}`);
    return Response.json({ ok: false, error: env.message, code: env.code, error_subcode: env.error_subcode }, { status: env.status });
  }
}

export async function POST(req: NextRequest) {
  let body: { campaign_id?: string; adset?: AdSetSpec };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }
  const campaignId = String(body.campaign_id ?? '');
  if (!/^\d+$/.test(campaignId)) return Response.json({ ok: false, error: 'campaign_id inválido' }, { status: 400 });
  const adset = body.adset;
  if (!adset || !Array.isArray(adset.ads) || adset.ads.length === 0) return Response.json({ ok: false, error: 'el conjunto necesita al menos un anuncio' }, { status: 400 });
  try {
    const basics = await getCampaignBasics(campaignId);
    const r = await addAdsetToCampaign(campaignId, basics.objective, basics.budgetLevel, adset);
    return Response.json({ ok: true, ...r });
  } catch (err) {
    const env = metaErrorEnvelope(err);
    console.error(`[ads-manager:adset-add POST] ${env.message}`);
    return Response.json({ ok: false, error: env.message, code: env.code, error_subcode: env.error_subcode }, { status: env.status });
  }
}
