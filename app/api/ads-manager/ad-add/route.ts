// =============================================================================
// /api/ads-manager/ad-add — agregar anuncios a un conjunto existente (PAUSA)
// =============================================================================
// GET  ?adset_id=<id>              → { name, optimization_goal, needsForm }
// POST { adset_id, creative, name} → crea el creativo + el anuncio (PAUSED)
// POST { adset_id, ads: [{name, creative}], campaign_id?, campaign_name?,
//        adset_name?, prompt?, uso? }
//   → lote del wizard "Subir creativos a una campaña": crea los anuncios en orden
//     (PAUSED) y persiste el registro en meta_campaign_drafts vinculado a la
//     campaña (meta_campaign_id). Si Meta rechaza a mitad de camino NO se revierte
//     (los ya creados están en pausa y no gastan): se devuelve `created` con
//     cuántos entraron para que la UI lo diga tal cual.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { getAdsetForAdd, addAdToAdset, metaErrorEnvelope } from '@/lib/meta-ads-create';
import { guardAdsDueno } from '@/lib/ads-guard';
import type { Creative } from '@/lib/campaign-types';
import type { SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const no = await guardAdsDueno(); if (no) return no;
  const adsetId = req.nextUrl.searchParams.get('adset_id') ?? '';
  if (!/^\d+$/.test(adsetId)) return Response.json({ ok: false, error: 'adset_id inválido' }, { status: 400 });
  try {
    return Response.json({ ok: true, adset: await getAdsetForAdd(adsetId) });
  } catch (err) {
    const env = metaErrorEnvelope(err);
    console.error(`[ads-manager:ad-add GET] ${env.message}`);
    return Response.json({ ok: false, error: env.message, code: env.code, error_subcode: env.error_subcode }, { status: env.status });
  }
}

type BatchAd = { name?: string; creative?: Creative };
type Body = {
  adset_id?: string;
  // modo simple (AgregarAnuncioModal): un anuncio
  creative?: Creative; name?: string;
  // modo lote (wizard "Subir creativos a una campaña")
  ads?: BatchAd[]; campaign_id?: string | null; campaign_name?: string | null; campaign_objective?: string | null; adset_name?: string | null;
  prompt?: string; uso?: unknown;
};

// Un ganador reusado viaja con su ad id; validarlo acá evita que un id armado
// (p.ej. "act_x/campaigns?…") se interpole crudo en el path de la Graph API.
function creativoInvalido(c: Creative): string | null {
  if (c.source === 'existing') {
    if (!/^\d+$/.test(String(c.source_ad_id ?? ''))) return 'source_ad_id inválido';
  }
  return null;
}

export async function POST(req: NextRequest) {
  const no = await guardAdsDueno(); if (no) return no;
  let body: Body;
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }
  const adsetId = String(body.adset_id ?? '');
  if (!/^\d+$/.test(adsetId)) return Response.json({ ok: false, error: 'adset_id inválido' }, { status: 400 });

  // ── modo simple (compatibilidad: un creativo, un anuncio) ──
  if (!Array.isArray(body.ads)) {
    if (!body.creative || typeof body.creative !== 'object') return Response.json({ ok: false, error: 'falta el creativo' }, { status: 400 });
    const inv = creativoInvalido(body.creative);
    if (inv) return Response.json({ ok: false, error: inv }, { status: 400 });
    const name = (body.name ?? '').trim() || 'Anuncio nuevo';
    try {
      const r = await addAdToAdset(adsetId, body.creative, name);
      return Response.json({ ok: true, ...r });
    } catch (err) {
      const env = metaErrorEnvelope(err);
      console.error(`[ads-manager:ad-add POST] ${env.message}`);
      return Response.json({ ok: false, error: env.message, code: env.code, error_subcode: env.error_subcode }, { status: env.status });
    }
  }

  // ── modo lote ──
  const ads = body.ads;
  if (ads.length === 0) return Response.json({ ok: false, error: 'sin anuncios para crear' }, { status: 400 });
  if (ads.length > 20) return Response.json({ ok: false, error: 'máximo 20 anuncios por lote (divídelo en tandas)' }, { status: 400 });
  if (ads.some((a) => !a.creative || typeof a.creative !== 'object')) return Response.json({ ok: false, error: 'cada anuncio necesita su creativo' }, { status: 400 });
  for (const a of ads) {
    const inv = creativoInvalido(a.creative as Creative);
    if (inv) return Response.json({ ok: false, error: inv }, { status: 400 });
  }
  const campaignId = body.campaign_id && /^\d+$/.test(String(body.campaign_id)) ? String(body.campaign_id) : null;

  // Registro local (best-effort, como campaign-create): la campaña ya existe en Meta,
  // acá solo se anota QUÉ anuncios le agregó MaKo, vinculados por meta_campaign_id.
  let supabase: SupabaseClient | null = null;
  try { supabase = getSupabaseServer(); } catch { supabase = null; }
  let draftId: number | null = null;
  if (supabase) {
    try {
      const { data } = await supabase.from('meta_campaign_drafts').insert({
        name: `${(body.campaign_name ?? '').trim() || 'Campaña existente'} — +${ads.length} anuncio${ads.length === 1 ? '' : 's'}`,
        status: 'creando',
        // objective real de la campaña destino (si el cliente lo sabe); si no, el default de la tabla
        ...(typeof body.campaign_objective === 'string' && body.campaign_objective ? { objective: body.campaign_objective.slice(0, 40) } : {}),
        spec: { name: body.campaign_name ?? null, adsets: [{ name: body.adset_name ?? null, ads }] },
        prompt: body.prompt ?? null, uso: body.uso ?? null,
        meta_campaign_id: campaignId, meta_adset_ids: [adsetId],
      }).select('id').single();
      draftId = (data as { id?: number } | null)?.id ?? null;
    } catch { /* noop */ }
  }
  const persist = async (patch: Record<string, unknown>) => {
    if (!supabase || draftId == null) return;
    try { await supabase.from('meta_campaign_drafts').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', draftId); } catch { /* noop */ }
  };

  const ad_ids: string[] = [];
  const creative_ids: string[] = [];
  try {
    // Secuencial a propósito: no chocar con el rate-limit de escritura de Meta.
    for (let i = 0; i < ads.length; i++) {
      const name = (ads[i].name ?? '').trim() || `Anuncio ${i + 1}`;
      const r = await addAdToAdset(adsetId, ads[i].creative as Creative, name);
      ad_ids.push(r.ad_id); creative_ids.push(r.creative_id);
      await persist({ meta_ad_ids: ad_ids, meta_creative_ids: creative_ids });
    }
    await persist({ status: 'publicada', error: null });
    return Response.json({ ok: true, ad_ids, creative_ids });
  } catch (err) {
    const env = metaErrorEnvelope(err);
    await persist({ status: 'error', error: `${env.message} (creados ${ad_ids.length}/${ads.length})` });
    console.error(`[ads-manager:ad-add POST lote] ${env.message} (creados ${ad_ids.length}/${ads.length})`);
    return Response.json(
      { ok: false, error: env.message, code: env.code, error_subcode: env.error_subcode, created: ad_ids.length, ad_ids, creative_ids },
      { status: env.status },
    );
  }
}
