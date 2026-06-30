// =============================================================================
// POST /api/ads-manager/campaign-preview — previsualización de Meta (sin crear)
// =============================================================================
// { creative, formats? } → GET act_<id>/generatepreviews por cada formato.
// Devuelve [{ ad_format, body }] donde body es el <iframe> HTML de Meta.
// =============================================================================

import type { NextRequest } from 'next/server';
import { generatePreviews, metaErrorEnvelope, PREVIEW_FORMATS } from '@/lib/meta-ads-create';
import type { Creative } from '@/lib/campaign-types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: { creative?: Creative; formats?: string[] };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }
  if (!body.creative) return Response.json({ ok: false, error: 'falta el creativo' }, { status: 400 });

  const formats = Array.isArray(body.formats) && body.formats.length ? body.formats : PREVIEW_FORMATS.map((f) => f.ad_format);
  try {
    const previews = await generatePreviews(body.creative, formats);
    return Response.json({ ok: true, previews });
  } catch (err) {
    const env = metaErrorEnvelope(err);
    console.error(`[ads-manager:campaign-preview] ${env.message}`);
    return Response.json({ ok: false, error: env.message, code: env.code, error_subcode: env.error_subcode }, { status: env.status });
  }
}
