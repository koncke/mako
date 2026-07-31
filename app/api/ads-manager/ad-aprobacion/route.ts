// =============================================================================
// /api/ads-manager/ad-aprobacion — ¿Meta retuvo estos anuncios esperando el OK?
// =============================================================================
// GET ?ids=<id1,id2,…> → { pendientes: [{id,name,mid}], leidos, accountId }
//
// Meta tiene un control de seguridad ("aprobación de pares") que retiene los
// anuncios recién publicados hasta que un usuario de confianza o un admin del
// portfolio dueño los apruebe A MANO en Ads Manager (issues_info error_code
// 2446984). NO se puede aprobar por API — los edges /confirm, /approve, /review
// y /appeal no existen en la Graph API. Por eso esta ruta solo LEE: sirve para
// que, al terminar de publicar, la app no cante "listo" cuando en realidad el
// anuncio no va a entregar hasta que el dueño entre a Meta.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getAdsAprobacionPendiente, getAdAccountId, metaErrorEnvelope } from '@/lib/meta-ads-create';
import { guardAdsDueno } from '@/lib/ads-guard';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const no = await guardAdsDueno(); if (no) return no;
  const ids = (req.nextUrl.searchParams.get('ids') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) return Response.json({ ok: false, error: 'faltan ids' }, { status: 400 });
  if (ids.some((id) => !/^\d+$/.test(id))) return Response.json({ ok: false, error: 'ids inválidos' }, { status: 400 });
  try {
    const [r, accountId] = await Promise.all([getAdsAprobacionPendiente(ids), getAdAccountId()]);
    return Response.json({ ok: true, ...r, accountId });
  } catch (err) {
    const env = metaErrorEnvelope(err);
    console.error(`[ads-manager:ad-aprobacion] ${env.message}`);
    return Response.json({ ok: false, error: env.message, code: env.code, error_subcode: env.error_subcode }, { status: env.status });
  }
}
