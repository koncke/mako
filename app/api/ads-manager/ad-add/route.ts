// =============================================================================
// /api/ads-manager/ad-add — agregar un anuncio a un conjunto existente (PAUSA)
// =============================================================================
// GET  ?adset_id=<id>              → { name, optimization_goal, needsForm }
// POST { adset_id, creative, name} → crea el creativo + el anuncio (PAUSED)
// =============================================================================

import type { NextRequest } from 'next/server';
import { getAdsetForAdd, addAdToAdset, metaErrorEnvelope } from '@/lib/meta-ads-create';
import type { Creative } from '@/lib/campaign-types';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(req: NextRequest) {
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

export async function POST(req: NextRequest) {
  let body: { adset_id?: string; creative?: Creative; name?: string };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }
  const adsetId = String(body.adset_id ?? '');
  if (!/^\d+$/.test(adsetId)) return Response.json({ ok: false, error: 'adset_id inválido' }, { status: 400 });
  if (!body.creative || typeof body.creative !== 'object') return Response.json({ ok: false, error: 'falta el creativo' }, { status: 400 });
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
