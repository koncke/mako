// =============================================================================
// /api/ads-manager/adset-targeting — leer y EDITAR el público de un conjunto
// =============================================================================
// GET  ?adset_id=<id>            → segmentación actual (para prellenar el editor)
// POST { adset_id, targeting }   → actualiza la segmentación (POST /{adset_id})
// =============================================================================

import type { NextRequest } from 'next/server';
import { getAdsetTargeting, updateAdsetTargeting, metaErrorEnvelope } from '@/lib/meta-ads-create';
import type { Targeting } from '@/lib/campaign-types';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const adsetId = req.nextUrl.searchParams.get('adset_id') ?? '';
  if (!/^\d+$/.test(adsetId)) return Response.json({ ok: false, error: 'adset_id inválido' }, { status: 400 });
  try {
    return Response.json({ ok: true, adset: await getAdsetTargeting(adsetId) });
  } catch (err) {
    const env = metaErrorEnvelope(err);
    console.error(`[ads-manager:adset-targeting GET] ${env.message}`);
    return Response.json({ ok: false, error: env.message, code: env.code, error_subcode: env.error_subcode }, { status: env.status });
  }
}

export async function POST(req: NextRequest) {
  let body: { adset_id?: string; targeting?: Targeting };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }
  const adsetId = String(body.adset_id ?? '');
  if (!/^\d+$/.test(adsetId)) return Response.json({ ok: false, error: 'adset_id inválido' }, { status: 400 });
  if (!body.targeting || typeof body.targeting !== 'object') return Response.json({ ok: false, error: 'falta la segmentación' }, { status: 400 });
  try {
    await updateAdsetTargeting(adsetId, body.targeting);
    return Response.json({ ok: true });
  } catch (err) {
    const env = metaErrorEnvelope(err);
    console.error(`[ads-manager:adset-targeting POST] ${env.message}`);
    return Response.json({ ok: false, error: env.message, code: env.code, error_subcode: env.error_subcode }, { status: env.status });
  }
}
