// =============================================================================
// POST /api/ads-manager/campaign-create — crea el árbol en Meta (TODO en PAUSA)
// =============================================================================
// { spec, prompt?, uso? } → crea campaña → conjuntos → creativos → anuncios, todo
// con status PAUSED. Persiste un registro local (meta_campaign_drafts) y rellena
// los ids de Meta a medida que avanza (idempotencia + para verlos sin esperar al
// cron). Mismo manejo de errores que /api/meta-write: Meta manda errores con HTTP
// 200, subcode 4841013 ("Permisos") → 403, y el envelope {ok,code,error_subcode}.
// Activar la campaña se hace después con el toggle de la tabla (op:'status').
// =============================================================================

import type { NextRequest } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { createCampaign, createAdSet, createAdCreative, createAd, metaErrorEnvelope } from '@/lib/meta-ads-create';
import type { CampaignSpec } from '@/lib/campaign-types';
import type { SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  let body: { spec?: CampaignSpec; prompt?: string; uso?: unknown };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  const spec = body.spec;
  if (!spec || !Array.isArray(spec.adsets) || spec.adsets.length === 0) {
    return Response.json({ ok: false, error: 'spec inválido (sin conjuntos)' }, { status: 400 });
  }
  if (spec.adsets.some((a) => !Array.isArray(a.ads) || a.ads.length === 0)) {
    return Response.json({ ok: false, error: 'cada conjunto necesita al menos un anuncio' }, { status: 400 });
  }

  // Registro local (best-effort): si la DB no está, igual creamos en Meta.
  let supabase: SupabaseClient | null = null;
  try { supabase = getSupabaseServer(); } catch { supabase = null; }
  let draftId: number | null = null;
  if (supabase) {
    try {
      const { data } = await supabase.from('meta_campaign_drafts').insert({
        name: spec.name, objective: spec.objective, status: 'creando',
        spec, rationale: spec.rationale ?? null, prompt: body.prompt ?? null, uso: body.uso ?? null,
      }).select('id').single();
      draftId = (data as { id?: number } | null)?.id ?? null;
    } catch { /* noop */ }
  }
  const persist = async (patch: Record<string, unknown>) => {
    if (!supabase || draftId == null) return;
    try { await supabase.from('meta_campaign_drafts').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', draftId); } catch { /* noop */ }
  };

  let campaignId: string | null = null;
  const meta_adset_ids: string[] = [];
  const meta_ad_ids: string[] = [];
  const meta_creative_ids: string[] = [];

  try {
    campaignId = await createCampaign(spec);
    await persist({ meta_campaign_id: campaignId });

    for (const adset of spec.adsets) {
      const adsetId = await createAdSet(campaignId, spec, adset);
      meta_adset_ids.push(adsetId);
      for (const ad of adset.ads) {
        const creativeId = await createAdCreative(ad.creative, ad.name);
        meta_creative_ids.push(creativeId);
        const adId = await createAd(adsetId, ad, creativeId);
        meta_ad_ids.push(adId);
      }
      await persist({ meta_adset_ids, meta_ad_ids, meta_creative_ids });
    }

    await persist({ status: 'publicada', meta_adset_ids, meta_ad_ids, meta_creative_ids, error: null });
    return Response.json({ ok: true, campaign_id: campaignId, adset_ids: meta_adset_ids, ad_ids: meta_ad_ids, creative_ids: meta_creative_ids });
  } catch (err) {
    const env = metaErrorEnvelope(err);
    await persist({ status: 'error', error: env.message, meta_campaign_id: campaignId, meta_adset_ids, meta_ad_ids, meta_creative_ids });
    console.error(`[ads-manager:campaign-create] ${env.message}`);
    return Response.json(
      { ok: false, error: env.message, code: env.code, error_subcode: env.error_subcode, partial: { campaign_id: campaignId, adset_ids: meta_adset_ids, ad_ids: meta_ad_ids } },
      { status: env.status },
    );
  }
}
