// =============================================================================
// GET /api/ads-manager/targeting — pickers de segmentación (desde Meta)
// =============================================================================
// ?kind=audiences            → públicos personalizados (retargeting incluir/excluir)
// ?kind=interests&q=<texto>  → intereses con su id real (los que Meta acepta)
// ?kind=leadforms            → formularios instantáneos existentes (lead ads)
// =============================================================================

import type { NextRequest } from 'next/server';
import { listCustomAudiences, searchInterests, listLeadForms, metaErrorEnvelope } from '@/lib/meta-ads-create';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const kind = req.nextUrl.searchParams.get('kind');
  const q = req.nextUrl.searchParams.get('q') ?? '';
  try {
    if (kind === 'audiences') return Response.json({ ok: true, items: await listCustomAudiences() });
    if (kind === 'interests') return Response.json({ ok: true, items: await searchInterests(q) });
    if (kind === 'leadforms') return Response.json({ ok: true, items: await listLeadForms() });
    return Response.json({ ok: false, error: 'kind inválido (audiences | interests | leadforms)' }, { status: 400 });
  } catch (err) {
    const env = metaErrorEnvelope(err);
    console.error(`[ads-manager:targeting] ${env.message}`);
    return Response.json({ ok: false, error: env.message, code: env.code, error_subcode: env.error_subcode }, { status: env.status });
  }
}
