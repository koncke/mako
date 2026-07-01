// =============================================================================
// /api/ads-manager/ad-edit — leer y EDITAR los textos de un anuncio publicado
// =============================================================================
// GET  ?ad_id=<id>                 → copy + media actuales para prellenar el editor
// POST { ad_id, edited:{...} }     → crea un creativo NUEVO (mismo video/imagen) con
//                                    el copy editado y apunta el anuncio a él. Cambiar
//                                    el texto re-dispara la revisión de Meta (repara
//                                    rechazos por copy). Mismo envelope de error que
//                                    el resto: Meta manda errores con HTTP 200.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getAdForEdit, updateAdCopy, metaErrorEnvelope } from '@/lib/meta-ads-create';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const adId = req.nextUrl.searchParams.get('ad_id') ?? '';
  if (!/^\d+$/.test(adId)) return Response.json({ ok: false, error: 'ad_id inválido' }, { status: 400 });
  try {
    return Response.json({ ok: true, ad: await getAdForEdit(adId) });
  } catch (err) {
    const env = metaErrorEnvelope(err);
    console.error(`[ads-manager:ad-edit GET] ${env.message}`);
    return Response.json({ ok: false, error: env.message, code: env.code, error_subcode: env.error_subcode }, { status: env.status });
  }
}

export async function POST(req: NextRequest) {
  let body: { ad_id?: string; edited?: { primary_text?: string; headline?: string; description?: string; cta_type?: string; destination_url?: string } };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }
  const adId = String(body.ad_id ?? '');
  if (!/^\d+$/.test(adId)) return Response.json({ ok: false, error: 'ad_id inválido' }, { status: 400 });
  if (!body.edited || typeof body.edited !== 'object') return Response.json({ ok: false, error: 'faltan los textos a guardar' }, { status: 400 });
  try {
    const r = await updateAdCopy(adId, body.edited);
    return Response.json({ ok: true, creative_id: r.creative_id });
  } catch (err) {
    const env = metaErrorEnvelope(err);
    console.error(`[ads-manager:ad-edit POST] ${env.message}`);
    return Response.json({ ok: false, error: env.message, code: env.code, error_subcode: env.error_subcode }, { status: env.status });
  }
}
