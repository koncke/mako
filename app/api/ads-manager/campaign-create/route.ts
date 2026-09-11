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
import { createCampaign, createAdSet, createAdCreative, createAd, deleteEntity, metaErrorEnvelope, adoptarTranscripcionDelCreativo, appDelToken } from '@/lib/meta-ads-create';
import { explicarRechazoPublicacion, SUB_APP_EN_DESARROLLO } from '@/lib/meta-publicar-errores';
import { type CampaignSpec, objetivoDef } from '@/lib/campaign-types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { guardAdsWs } from '@/lib/ads-guard';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  // Fase 1: crear campañas escribe en la cuenta de Meta global del dueño.
  // Mismo predicado que sus 10 hermanas, y ahora también el mismo TEXTO (lib/ads-guard.ts).
  const no = await guardAdsWs(); if (no) return no;

  let body: { spec?: CampaignSpec; prompt?: string; uso?: unknown };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  const spec = body.spec;
  if (!spec || !Array.isArray(spec.adsets) || spec.adsets.length === 0) {
    return Response.json({ ok: false, error: 'spec inválido (sin conjuntos)' }, { status: 400 });
  }
  if (spec.adsets.some((a) => !Array.isArray(a.ads) || a.ads.length === 0)) {
    return Response.json({ ok: false, error: 'cada conjunto necesita al menos un anuncio' }, { status: 400 });
  }
  // Guarda: las conversiones web necesitan pixel. Sin él Meta rechaza el conjunto y
  // dejaría la campaña huérfana → cortamos antes de crear nada.
  if (!process.env.META_PIXEL_ID) {
    // Conversión por EVENTO estándar necesita el pixel del entorno; por conversión
    // personalizada (custom_conversion_id) NO (la conversión ya referencia su pixel).
    const needsPixel = spec.adsets.some((a) => (a.optimization_goal || objetivoDef(spec.objective).optimization_goal) === 'OFFSITE_CONVERSIONS' && !a.conversion?.custom_conversion_id && !a.conversion?.pixel_id);
    if (needsPixel) return Response.json({ ok: false, error: 'Optimizar por una conversión web por EVENTO del pixel requiere META_PIXEL_ID configurado. Configúralo, elige una conversión personalizada, o usa Leads con formulario / Tráfico.' }, { status: 400 });
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
        // La transcripción ya se hizo al subir el video: la adoptamos con el ad_id
        // para que el cron no vuelva a bajar el mp4 y pagar whisper de nuevo.
        await adoptarTranscripcionDelCreativo(adId, ad.creative.video_id);
        meta_ad_ids.push(adId);
      }
      await persist({ meta_adset_ids, meta_ad_ids, meta_creative_ids });
    }

    await persist({ status: 'publicada', meta_adset_ids, meta_ad_ids, meta_creative_ids, error: null });
    return Response.json({ ok: true, campaign_id: campaignId, adset_ids: meta_adset_ids, ad_ids: meta_ad_ids, creative_ids: meta_creative_ids });
  } catch (err) {
    const env = metaErrorEnvelope(err);
    // El texto crudo de Meta («No tienes permiso de anunciante en la página») no dice
    // de quién es ni qué hacer, y se leía como que MaKo no dejaba publicar. Los tres
    // rechazos reproducidos en ws13 se explican; el resto queda con el texto de Meta.
    const reusaGanador = spec.adsets.some((a) => a.ads.some((x) => x.creative?.source === 'existing'));
    const pideFormulario = spec.adsets.some((a) => (a.optimization_goal || objetivoDef(spec.objective).optimization_goal) === 'LEAD_GENERATION');
    const app = env.error_subcode === SUB_APP_EN_DESARROLLO ? await appDelToken().catch(() => null) : null;
    const mensaje = explicarRechazoPublicacion(env.error_subcode, { app, reusaGanador, pideFormulario }) ?? env.message;
    // Rollback best-effort: borrar lo creado (todo en PAUSA, no gastó) para no dejar
    // una campaña huérfana. Borrar la campaña cascadea a conjuntos/anuncios; los
    // creativos son a nivel cuenta, se borran aparte.
    let rolledBack = false;
    if (campaignId) {
      try { await deleteEntity(campaignId); for (const cid of meta_creative_ids) { await deleteEntity(cid).catch(() => { /* */ }); } rolledBack = true; }
      catch (e) { console.error('[ads-manager:campaign-create] rollback falló', e); }
    }
    await persist({ status: 'error', error: mensaje + (rolledBack ? ' (revertido)' : ''), meta_campaign_id: campaignId, meta_adset_ids, meta_ad_ids, meta_creative_ids });
    console.error(`[ads-manager:campaign-create] ${env.message} (subcode ${env.error_subcode ?? '-'})`);
    return Response.json(
      { ok: false, error: mensaje, code: env.code, error_subcode: env.error_subcode, rolledBack },
      { status: env.status },
    );
  }
}
